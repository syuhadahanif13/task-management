import { Meeting, Task, TaskStatus, CreateMeetingInput, CreateTaskInput, AIParseResult, TaskSubmission, SubmitTaskInput, Division, User, CreateDivisionInput, CreateUserInput } from '../types';
import { embedTaskSubmissionIntoDescription, extractTaskSubmissionFromDescription, extractTaskDescription } from '../utils/submissionUtils';

const API_BASE = (((import.meta as any).env?.VITE_API_URL as string) || '').replace(/\/$/, '');

function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith('/api') ? `${API_BASE}${input}` : input;
  return fetch(url, init);
}

export function getCachedPendingTaskIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem('cached_pending_tasks');
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function addCachedPendingTaskId(taskId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const set = getCachedPendingTaskIds();
    set.add(taskId);
    localStorage.setItem('cached_pending_tasks', JSON.stringify(Array.from(set)));
  } catch {}
}

export function removeCachedPendingTaskId(taskId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const set = getCachedPendingTaskIds();
    set.delete(taskId);
    localStorage.setItem('cached_pending_tasks', JSON.stringify(Array.from(set)));
  } catch {}
}

export function getCachedMeetings(): Meeting[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('cached_meetings');
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCachedMeetings(meetings: Meeting[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('cached_meetings', JSON.stringify(meetings));
  } catch {}
}

export function saveSingleCachedMeeting(meeting: Meeting): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getCachedMeetings();
    const idx = current.findIndex((m) => m.id === meeting.id);
    let updated: Meeting[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...meeting };
    } else {
      updated = [meeting, ...current];
    }
    localStorage.setItem('cached_meetings', JSON.stringify(updated));
  } catch {}
}

export function removeCachedMeeting(meetingId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getCachedMeetings();
    const filtered = current.filter((m) => m.id !== meetingId);
    localStorage.setItem('cached_meetings', JSON.stringify(filtered));
  } catch {}
}

export function saveCachedTaskSubmission(sub: TaskSubmission): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem('cached_task_submissions');
    let list: TaskSubmission[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    const existingIdx = list.findIndex(s =>
      s.id === sub.id ||
      (sub.taskId && s.taskId === sub.taskId) ||
      (sub.taskTitle && s.taskTitle && s.taskTitle === sub.taskTitle)
    );
    if (existingIdx >= 0) {
      const existingAtt = Array.isArray(list[existingIdx].attachments) ? list[existingIdx].attachments : [];
      const subAtt = Array.isArray(sub.attachments) ? sub.attachments : [];
      list[existingIdx] = {
        ...list[existingIdx],
        ...sub,
        attachments: subAtt.length > 0 ? subAtt : existingAtt,
      };
    } else {
      list = [sub, ...list];
    }
    localStorage.setItem('cached_task_submissions', JSON.stringify(list));
  } catch {}
}

export function updateCachedTaskSubmissionStatus(taskId: string, submissionId: string, status: 'approved' | 'rejected', reviewNote?: string, taskTitle?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem('cached_task_submissions');
    let list: TaskSubmission[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    let updatedAny = false;
    list = list.map(s => {
      if (s.id === submissionId || (taskId && s.taskId === taskId) || (taskTitle && s.taskTitle === taskTitle)) {
        updatedAny = true;
        return {
          ...s,
          status,
          reviewNote: reviewNote || s.reviewNote,
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'admin',
          attachments: Array.isArray(s.attachments) ? s.attachments : []
        };
      }
      return s;
    });
    if (!updatedAny && taskId) {
      list.push({
        id: submissionId || ('sub-' + taskId),
        taskId,
        taskTitle,
        assignee: 'User',
        notes: '',
        attachments: [],
        status,
        submittedAt: new Date().toISOString(),
        reviewedBy: 'admin',
        reviewedAt: new Date().toISOString(),
        reviewNote
      });
    }
    localStorage.setItem('cached_task_submissions', JSON.stringify(list));
  } catch {}
}

export function getCachedTaskSubmissions(taskId: string, taskTitle?: string): TaskSubmission[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('cached_task_submissions');
    if (!raw) return [];
    const list: TaskSubmission[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const targetTitle = (taskTitle || '').trim().toLowerCase();
    return list.filter(s =>
      (taskId && s.taskId === taskId) ||
      (targetTitle && s.taskTitle && s.taskTitle.trim().toLowerCase() === targetTitle)
    );
  } catch {
    return [];
  }
}

export async function syncAllCachedSubmissions(): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem('cached_task_submissions');
    if (!raw) return;
    const list: TaskSubmission[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;

    const withContent = list.filter(s => (Array.isArray(s.attachments) && s.attachments.length > 0) || (s.notes && s.notes.trim().length > 0));
    if (withContent.length === 0) return;

    try {
      await apiFetch('/api/submissions/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions: withContent }),
      });
    } catch {}
  } catch (err) {
    console.warn('syncAllCachedSubmissions notice:', err);
  }
}

export const api = {
  async getMeetings(): Promise<Meeting[]> {
    // 1. Fetch from backend Express server (hosted MySQL)
    let serverMeetings: Meeting[] = [];
    try {
      const res = await apiFetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          serverMeetings = data;
        }
      }
    } catch (err) {
      console.warn('API getMeetings failed, checking local cache:', err);
    }

    if (serverMeetings.length > 0) {
      const pendingIds = getCachedPendingTaskIds();
      let mergedList = serverMeetings
        .filter((m) => !String(m.id).startsWith('system-') && m.title !== '__SYSTEM_TASK_SUBMISSIONS__')
        .map((m) => ({
          ...m,
          tasks: (m.tasks || []).map((t) => {
            if (t.status === 'Done') {
              if (pendingIds.has(t.id)) removeCachedPendingTaskId(t.id);
              return t;
            }
            if ((t.status as string) === 'Blocked' || t.status === 'Pending Approval' || pendingIds.has(t.id)) {
              return { ...t, status: 'Pending Approval' as const };
            }
            return t;
          }),
        }));

      mergedList.sort((a, b) => {
        const dateA = new Date(a.meetingDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.meetingDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      saveCachedMeetings(mergedList);
      syncAllCachedSubmissions().catch(() => {});
      return mergedList;
    }

    // 2. Fallback to localStorage cache
    const localCachedMeetings = getCachedMeetings();
    const pendingIds = getCachedPendingTaskIds();
    let mergedList = localCachedMeetings
      .filter((m) => !String(m.id).startsWith('system-') && m.title !== '__SYSTEM_TASK_SUBMISSIONS__')
      .map((m) => ({
        ...m,
        tasks: (m.tasks || []).map((t) => {
          if (t.status === 'Done') {
            if (pendingIds.has(t.id)) removeCachedPendingTaskId(t.id);
            return t;
          }
          if ((t.status as string) === 'Blocked' || t.status === 'Pending Approval' || pendingIds.has(t.id)) {
            return { ...t, status: 'Pending Approval' as const };
          }
          return t;
        }),
      }));

    mergedList.sort((a, b) => {
      const dateA = new Date(a.meetingDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.meetingDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return mergedList;
  },

  async getMeeting(id: string): Promise<Meeting> {
    const cached = getCachedMeetings().find(m => m.id === id);
    if (cached) return cached;
    const res = await apiFetch(`/api/meetings/${id}`);
    if (!res.ok) throw new Error('Failed to fetch meeting');
    return res.json();
  },

  async createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const meetingId = `meet-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const createdMeeting: Meeting = {
      id: meetingId,
      title: input.title ? String(input.title).trim() : `Rapat ${input.meetingDate}`,
      meetingDate: String(input.meetingDate).trim(),
      participants: Array.isArray(input.participants) ? input.participants.map(p => String(p).trim()).filter(Boolean) : [String(input.participants)],
      meetingNotes: String(input.meetingNotes || '').trim(),
      createdAt: now,
      updatedAt: now,
      tasks: (input.tasks || []).map((t, idx) => {
        const rawAssignees = Array.isArray(t.assignees)
          ? t.assignees
          : (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        const resolvedAssignee = rawAssignees.length > 0 ? rawAssignees.join(', ') : String(t.assignee || 'Unassigned').trim();
        return {
          id: `task-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          meetingId,
          title: String(t.title).trim(),
          assignee: resolvedAssignee,
          assignees: rawAssignees.length > 0 ? rawAssignees : [resolvedAssignee],
          dueDate: String(t.dueDate || input.meetingDate).trim(),
          dueTime: t.dueTime ? String(t.dueTime).trim() : undefined,
          status: (t.status || 'To Do') as TaskStatus,
          priority: t.priority || 'Medium',
          description: t.description || '',
          tags: Array.isArray(t.tags) ? t.tags : [],
          createdAt: now,
          updatedAt: now,
        };
      }),
    };

    // Immediately cache in localStorage for instant 0ms feedback
    saveSingleCachedMeeting(createdMeeting);

    // Save to backend MySQL database
    try {
      const res = await apiFetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, id: createdMeeting.id, tasks: createdMeeting.tasks }),
      });
      if (res.ok) {
        const srvMeeting = await res.json();
        saveSingleCachedMeeting(srvMeeting);
        return srvMeeting;
      }
    } catch (err) {
      console.warn('Backend server createMeeting notice:', err);
    }

    return createdMeeting;
  },

  async updateMeeting(id: string, input: Partial<CreateMeetingInput>): Promise<Meeting> {
    const cached = getCachedMeetings().find(m => m.id === id);
    const updatedMeeting: Meeting = {
      ...(cached || {
        id,
        title: input.title || `Rapat ${input.meetingDate || ''}`,
        meetingDate: input.meetingDate || new Date().toISOString().split('T')[0],
        participants: input.participants || [],
        meetingNotes: input.meetingNotes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
      }),
      ...(input.title !== undefined ? { title: String(input.title).trim() } : {}),
      ...(input.meetingDate !== undefined ? { meetingDate: String(input.meetingDate).trim() } : {}),
      ...(input.participants !== undefined ? { participants: input.participants } : {}),
      ...(input.meetingNotes !== undefined ? { meetingNotes: String(input.meetingNotes).trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    saveSingleCachedMeeting(updatedMeeting);

    try {
      const res = await apiFetch(`/api/meetings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const srv = await res.json();
        saveSingleCachedMeeting(srv);
        return srv;
      }
    } catch (err) {
      console.warn('Backend server updateMeeting notice:', err);
    }

    return updatedMeeting;
  },

  async deleteMeeting(id: string): Promise<{ message: string; id: string }> {
    removeCachedMeeting(id);

    try {
      await apiFetch(`/api/meetings/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend server deleteMeeting notice:', err);
    }

    return { message: 'Meeting deleted successfully', id };
  },

  async createTask(meetingId: string | undefined | null, task: CreateTaskInput): Promise<Task> {
    const url = meetingId ? `/api/meetings/${meetingId}/tasks` : '/api/tasks';
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create task');
    }
    return res.json();
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    if (updates.status === 'Pending Approval') {
      addCachedPendingTaskId(id);
    } else if (updates.status === 'Done' || updates.status === 'In Progress') {
      removeCachedPendingTaskId(id);
    }

    const res = await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memperbarui status tugas (${res.status})`);
    }
    return res.json();
  },

  async deleteTask(id: string): Promise<{ message: string; id: string }> {
    const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  async getTasks(params?: { meetingId?: string; status?: string; assignee?: string; search?: string }): Promise<Array<Task & { meetingTitle: string; meetingDate: string }>> {
    const searchParams = new URLSearchParams();
    if (params?.meetingId) searchParams.append('meetingId', params.meetingId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.assignee) searchParams.append('assignee', params.assignee);
    if (params?.search) searchParams.append('search', params.search);

    try {
      const res = await apiFetch(`/api/tasks?${searchParams.toString()}`);
      if (res.ok) {
        const tasks = await res.json();
        if (Array.isArray(tasks) && tasks.length > 0) {
          return tasks;
        }
      }
    } catch {}

    // Fallback to locally cached meetings
    const cachedMeetings = getCachedMeetings();
    const allTasks: Array<Task & { meetingTitle: string; meetingDate: string }> = [];
    for (const m of cachedMeetings) {
      if (params?.meetingId && m.id !== params.meetingId) continue;
      for (const t of m.tasks || []) {
        if (params?.status && t.status !== params.status) continue;
        if (params?.assignee && !t.assignee?.toLowerCase().includes(params.assignee.toLowerCase())) continue;
        if (params?.search && !t.title?.toLowerCase().includes(params.search.toLowerCase())) continue;
        allTasks.push({
          ...t,
          meetingTitle: m.title || 'Tugas Mandiri',
          meetingDate: m.meetingDate || '',
        });
      }
    }
    return allTasks;
  },

  async submitTask(taskId: string, input: SubmitTaskInput): Promise<TaskSubmission> {
    const now = new Date().toISOString();
    const submissionId = 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

    addCachedPendingTaskId(taskId);

    const createdSub: TaskSubmission = {
      id: submissionId,
      taskId,
      taskTitle: input.taskTitle,
      assignee: 'User',
      notes: input.notes,
      attachments: input.attachments,
      status: 'pending',
      submittedAt: now,
    };

    saveCachedTaskSubmission(createdSub);

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const sub: TaskSubmission = await res.json();
        saveCachedTaskSubmission(sub);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return sub;
      }
    } catch (err) {
      console.warn('apiFetch submitTask notice:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
    }
    return createdSub;
  },

  async getTaskSubmissions(taskId: string, taskTitle?: string): Promise<TaskSubmission[]> {
    let result: TaskSubmission[] = [];

    // 1. Try API first
    try {
      const queryParam = taskTitle ? `?title=${encodeURIComponent(taskTitle)}` : '';
      const res = await apiFetch(`/api/tasks/${taskId}/submissions${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          result = data;
        }
      }
    } catch (err) {
      console.warn('API getTaskSubmissions error:', err);
    }

    // 2. Merge with locally cached submissions (localStorage)
    const cached = getCachedTaskSubmissions(taskId, taskTitle);
    if (Array.isArray(cached) && cached.length > 0) {
      for (const cs of cached) {
        const idx = result.findIndex(r => r.id === cs.id || r.taskId === cs.taskId || (taskTitle && r.taskTitle === taskTitle));
        if (idx >= 0) {
          const resAtt = Array.isArray(result[idx].attachments) ? result[idx].attachments : [];
          const csAtt = Array.isArray(cs.attachments) ? cs.attachments : [];
          result[idx] = {
            ...result[idx],
            ...cs,
            attachments: csAtt.length > 0 ? csAtt : resAtt,
          };
        } else {
          result.push(cs);
        }
      }
    }

    // 3. Deduplicate
    const consolidated: TaskSubmission[] = [];
    for (const s of result) {
      const existing = consolidated.find(c => c.id === s.id || c.taskId === s.taskId || (taskTitle && c.taskTitle === taskTitle));
      if (existing) {
        const existAtt = Array.isArray(existing.attachments) ? existing.attachments : [];
        const sAtt = Array.isArray(s.attachments) ? s.attachments : [];
        if (sAtt.length > 0 && existAtt.length === 0) {
          existing.attachments = sAtt;
        }
        if (!existing.notes && s.notes) existing.notes = s.notes;
        if (existing.status !== 'approved' && s.status === 'approved') existing.status = 'approved';
      } else {
        consolidated.push({ ...s });
      }
    }

    for (const sub of consolidated) {
      if (Array.isArray(sub.attachments) && sub.attachments.length > 0) {
        saveCachedTaskSubmission(sub);
      }
    }

    return consolidated.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  async approveTaskSubmission(taskId: string, submissionId: string, reviewNote?: string, taskTitle?: string): Promise<Task> {
    removeCachedPendingTaskId(taskId);
    updateCachedTaskSubmissionStatus(taskId, submissionId, 'approved', reviewNote, taskTitle);

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, reviewNote, taskTitle }),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return updatedTask;
      }
    } catch (err) {
      console.warn('API approve error:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
    }

    const now = new Date().toISOString();
    return {
      id: taskId,
      title: 'Tugas Selesai',
      assignee: 'User',
      dueDate: now.split('T')[0],
      status: 'Done',
      createdAt: now,
      updatedAt: now,
    };
  },

  async rejectTaskSubmission(taskId: string, submissionId: string, reviewNote: string, taskTitle?: string): Promise<Task> {
    removeCachedPendingTaskId(taskId);
    updateCachedTaskSubmissionStatus(taskId, submissionId, 'rejected', reviewNote, taskTitle);

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, reviewNote, taskTitle }),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return updatedTask;
      }
    } catch (err) {
      console.warn('API reject error:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
    }

    const now = new Date().toISOString();
    return {
      id: taskId,
      title: 'Tugas Dikembalikan',
      assignee: 'User',
      dueDate: now.split('T')[0],
      status: 'In Progress',
      createdAt: now,
      updatedAt: now,
    };
  },

  async extractFromNotes(rawText: string, fallbackDate?: string): Promise<AIParseResult & { isAiGenerated?: boolean; notice?: string }> {
    const res = await apiFetch('/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, fallbackDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to extract meeting data');
    }
    return res.json();
  },

  async getSchemaInfo() {
    const res = await apiFetch('/api/schema');
    if (!res.ok) throw new Error('Failed to fetch schema');
    return res.json();
  },

  async getDivisions(): Promise<Division[]> {
    let localDivisions: Division[] = [];
    try {
      const cached = localStorage.getItem('cached_divisions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localDivisions = parsed;
      }
    } catch {}

    let fetchedDivisions: Division[] = [];

    try {
      const res = await apiFetch('/api/divisions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedDivisions = data;
        }
      }
    } catch (fetchErr) {
      console.warn('API fetch divisions failed:', fetchErr);
    }

    const baseList = fetchedDivisions.length > 0 ? fetchedDivisions : (localDivisions.length > 0 ? localDivisions : [
      { id: 'div-1', name: 'REI' },
      { id: 'div-2', name: 'LM' },
      { id: 'div-3', name: 'Sosmed' },
      { id: 'div-4', name: 'PH' },
      { id: 'div-5', name: 'Maps' },
    ]);

    const mergedMap = new Map<string, Division>();
    for (const d of baseList) {
      mergedMap.set(d.id, d);
    }
    for (const d of localDivisions) {
      const exists = Array.from(mergedMap.values()).some(
        existing => existing.id === d.id || existing.name.toLowerCase() === d.name.toLowerCase()
      );
      if (!exists) {
        mergedMap.set(d.id, d);
      }
    }

    const result = Array.from(mergedMap.values());
    try { localStorage.setItem('cached_divisions', JSON.stringify(result)); } catch {}
    return result;
  },

  async createDivision(input: CreateDivisionInput): Promise<Division> {
    const now = new Date().toISOString();
    let createdDivision: Division | null = null;

    try {
      const res = await apiFetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        createdDivision = await res.json();
      }
    } catch (err) {
      console.warn('API createDivision failed, caching locally:', err);
    }

    const divisionId = createdDivision?.id || `div-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const divisionName = input.name.trim();

    if (!createdDivision) {
      createdDivision = {
        id: divisionId,
        name: divisionName,
        createdAt: now,
        updatedAt: now,
      };
    }

    try {
      const cached = localStorage.getItem('cached_divisions');
      const list: Division[] = cached ? JSON.parse(cached) : [];
      const existingIdx = list.findIndex(d => d.id === createdDivision!.id || d.name.toLowerCase() === divisionName.toLowerCase());
      if (existingIdx !== -1) {
        list[existingIdx] = createdDivision;
      } else {
        list.push(createdDivision);
      }
      localStorage.setItem('cached_divisions', JSON.stringify(list));
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('divisionsUpdated', { detail: createdDivision }));
    }

    return createdDivision;
  },

  async updateDivision(id: string, input: Partial<CreateDivisionInput>): Promise<Division> {
    const now = new Date().toISOString();
    let updatedDivision: Division | null = null;

    try {
      const res = await apiFetch(`/api/divisions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        updatedDivision = await res.json();
      }
    } catch (err) {
      console.warn('API updateDivision failed:', err);
    }

    if (!updatedDivision) {
      updatedDivision = {
        id,
        name: input.name?.trim() || '',
        updatedAt: now,
      };
    }

    try {
      const cached = localStorage.getItem('cached_divisions');
      if (cached) {
        const list: Division[] = JSON.parse(cached);
        const idx = list.findIndex(d => d.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updatedDivision };
          localStorage.setItem('cached_divisions', JSON.stringify(list));
        }
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('divisionsUpdated', { detail: updatedDivision }));
    }

    return updatedDivision;
  },

  async deleteDivision(id: string): Promise<{ message: string; id: string }> {
    try {
      await apiFetch(`/api/divisions/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API deleteDivision failed:', err);
    }

    try {
      const cached = localStorage.getItem('cached_divisions');
      if (cached) {
        const list: Division[] = JSON.parse(cached);
        const filtered = list.filter(d => d.id !== id);
        localStorage.setItem('cached_divisions', JSON.stringify(filtered));
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('divisionsUpdated', { detail: { id } }));
    }

    return { message: 'Division deleted', id };
  },

  async getUsers(): Promise<Omit<User, 'password'>[]> {
    let localUsers: Omit<User, 'password'>[] = [];
    try {
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localUsers = parsed;
      }
    } catch {}

    let fetchedUsers: Omit<User, 'password'>[] = [];

    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedUsers = data;
        }
      }
    } catch (err) {
      console.warn('API getUsers failed:', err);
    }

    const defaultUsers = [
      { id: 'user-1', username: 'rizki', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-2', username: 'ajeng', divisionId: 'div-2', role: 'user' as const },
      { id: 'user-3', username: 'annisa', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-4', username: 'Dinda', divisionId: 'div-5', role: 'user' as const },
      { id: 'user-5', username: 'Devi', divisionId: 'div-3', role: 'user' as const },
      { id: 'user-6', username: 'Hanif', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-7', username: 'Sonia', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-8', username: 'Azka', divisionId: 'div-4', role: 'user' as const },
    ];

    const baseList = fetchedUsers.length > 0 ? fetchedUsers : (localUsers.length > 0 ? localUsers : defaultUsers);

    const mergedMap = new Map<string, Omit<User, 'password'>>();
    for (const u of baseList) {
      mergedMap.set(u.id, u);
    }
    for (const u of localUsers) {
      const exists = Array.from(mergedMap.values()).some(
        existing => existing.id === u.id || existing.username.toLowerCase() === u.username.toLowerCase()
      );
      if (!exists) {
        mergedMap.set(u.id, u);
      }
    }

    const result = Array.from(mergedMap.values());
    try { localStorage.setItem('cached_users', JSON.stringify(result)); } catch {}
    return result;
  },

  async createUser(input: CreateUserInput): Promise<Omit<User, 'password'>> {
    const now = new Date().toISOString();
    let createdUser: Omit<User, 'password'> | null = null;

    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        createdUser = await res.json();
      }
    } catch (err) {
      console.warn('API createUser failed:', err);
    }

    const userId = createdUser?.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    if (!createdUser) {
      createdUser = {
        id: userId,
        username: input.username.trim(),
        divisionId: input.divisionId,
        role: input.role || 'user',
        createdAt: now,
        updatedAt: now,
      };
    }

    try {
      const cached = localStorage.getItem('cached_users');
      const list: any[] = cached ? JSON.parse(cached) : [];
      list.push(createdUser);
      localStorage.setItem('cached_users', JSON.stringify(list));
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: createdUser }));
    }

    return createdUser;
  },

  async updateUser(id: string, input: Partial<CreateUserInput>): Promise<Omit<User, 'password'>> {
    const now = new Date().toISOString();
    let updatedUser: Omit<User, 'password'> | null = null;

    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        updatedUser = await res.json();
      }
    } catch (err) {
      console.warn('API updateUser failed:', err);
    }

    if (!updatedUser) {
      updatedUser = {
        id,
        username: input.username?.trim() || '',
        divisionId: input.divisionId || '',
        role: input.role || 'user',
        updatedAt: now,
      };
    }

    try {
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const list: any[] = JSON.parse(cached);
        const idx = list.findIndex(u => u.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updatedUser };
          localStorage.setItem('cached_users', JSON.stringify(list));
        }
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUser }));
    }

    return updatedUser;
  },

  async deleteUser(id: string): Promise<{ message: string; id: string }> {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API deleteUser failed:', err);
    }

    try {
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const list: any[] = JSON.parse(cached);
        const filtered = list.filter(u => u.id !== id);
        localStorage.setItem('cached_users', JSON.stringify(filtered));
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: { id } }));
    }

    return { message: 'User deleted', id };
  },

  async login(username: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async getGitHubConfig(): Promise<{ configured: boolean; clientId: string | null; defaultRepo: string }> {
    const res = await apiFetch('/api/auth/github/config');
    if (!res.ok) return { configured: false, clientId: null, defaultRepo: 'syuhadahanif13/task-management' };
    return res.json();
  },

  async loginWithGitHubToken(token: string, linkUserId?: string): Promise<{ user: Omit<User, 'password'>; token: string; github: any }> {
    const res = await apiFetch('/api/auth/github/token-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, linkUserId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Autentikasi GitHub gagal');
    }
    return res.json();
  },

  async unlinkGitHub(userId: string): Promise<{ message: string; user: Omit<User, 'password'> }> {
    const res = await apiFetch('/api/auth/github/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal memutuskan akun GitHub');
    }
    return res.json();
  },

  async getTaskGitHubDev(taskId: string, repo?: string, userId?: string): Promise<{
    taskKey: string;
    taskId: string;
    taskTitle: string;
    repo: string;
    hasToken: boolean;
    recommendedBranchName: string;
    recommendedGitCommand: string;
    recommendedCommitMsg: string;
    branches: Array<{ name: string; url?: string; lastCommit?: string }>;
    commits: Array<{ id: string; message: string; author: string; authorAvatar?: string; url: string; timestamp?: string }>;
    pullRequests: Array<{ number: number; title: string; url: string; state: 'open' | 'closed' | 'merged'; author: string; authorAvatar?: string; branch?: string; mergedAt?: string }>;
    counts: { branches: number; commits: number; pullRequests: number };
    lastSyncedAt?: string;
  }> {
    const params = new URLSearchParams({ taskId });
    if (repo) params.set('repo', repo);
    if (userId) params.set('userId', userId);
    const res = await apiFetch(`/api/github/task-dev?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal memuat informasi development GitHub');
    }
    return res.json();
  },

  async linkGitHubItem(params: { taskId: string; url?: string; branch?: string; repo?: string; userId?: string }): Promise<any> {
    const res = await apiFetch('/api/github/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal menautkan item GitHub');
    }
    return res.json();
  },

  async unlinkGitHubItem(params: { taskId: string; itemType: 'pr' | 'commit' | 'branch'; itemId: string | number }): Promise<any> {
    const res = await apiFetch('/api/github/unlink-item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal menghapus tautan GitHub');
    }
    return res.json();
  },

  syncAllCachedSubmissions,
};
