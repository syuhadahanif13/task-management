import { Meeting, Task, CreateMeetingInput, CreateTaskInput, AIParseResult, TaskSubmission, SubmitTaskInput, Division, User, CreateDivisionInput, CreateUserInput } from '../types';
import { getSupabaseClient } from '../lib/supabase';
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

function isValidUuid(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

const SYSTEM_SUBMISSIONS_MEETING_ID = 'system-task-submissions';

function getValidSystemMeetingUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return 'a0000000-0000-0000-0000-000000000001';
}

async function updateTaskStatusInSupabaseClient(sbClient: any, taskId: string, status: string, description?: string, taskTitle?: string) {
  const now = new Date().toISOString();
  const updatePayload: any = { updated_at: now };
  if (description !== undefined) updatePayload.description = description;

  if (!isValidUuid(taskId) && taskTitle) {
    try {
      const { data } = await sbClient.from('tasks').select('id').eq('title', taskTitle).limit(1).maybeSingle();
      if (data && data.id) {
        taskId = data.id;
      }
    } catch {}
  }

  if (isValidUuid(taskId)) {
    try {
      if (status === 'Pending Approval') {
        updatePayload.status = 'Pending Approval';
        const { error: err1 } = await sbClient.from('tasks').update(updatePayload).eq('id', taskId);
        if (err1) {
          console.warn('Supabase update Pending Approval failed, using Blocked constraint fallback:', err1.message);
          updatePayload.status = 'Blocked';
          await sbClient.from('tasks').update(updatePayload).eq('id', taskId);
        }
      } else {
        updatePayload.status = status;
        await sbClient.from('tasks').update(updatePayload).eq('id', taskId);
      }
    } catch (e) {
      console.warn('updateTaskStatusInSupabaseClient notice:', e);
    }
  }
}

async function saveSubmissionToSupabaseSystemMeeting(sbClient: any, sub: TaskSubmission) {
  try {
    let sysMeeting: any = null;
    try {
      const { data } = await sbClient
        .from('meetings')
        .select('id, meeting_notes')
        .eq('title', '__SYSTEM_TASK_SUBMISSIONS__')
        .maybeSingle();
      sysMeeting = data;
    } catch {}

    let list: TaskSubmission[] = [];
    if (sysMeeting && sysMeeting.meeting_notes) {
      try {
        const parsed = JSON.parse(sysMeeting.meeting_notes);
        if (Array.isArray(parsed)) list = parsed;
      } catch {}
    }
    const idx = list.findIndex(s => s.id === sub.id || (sub.taskId && s.taskId === sub.taskId) || (sub.taskTitle && s.taskTitle === sub.taskTitle));
    if (idx >= 0) {
      const existingAtt = Array.isArray(list[idx].attachments) ? list[idx].attachments : [];
      const subAtt = Array.isArray(sub.attachments) ? sub.attachments : [];
      list[idx] = {
        ...list[idx],
        ...sub,
        attachments: subAtt.length > 0 ? subAtt : existingAtt,
      };
    } else {
      list.push(sub);
    }

    const nowIso = new Date().toISOString();
    const notesJson = JSON.stringify(list);

    if (sysMeeting) {
      await sbClient.from('meetings').update({
        meeting_notes: notesJson,
        updated_at: nowIso
      }).eq('id', sysMeeting.id);
    } else {
      await sbClient.from('meetings').insert([{
        id: getValidSystemMeetingUuid(),
        title: '__SYSTEM_TASK_SUBMISSIONS__',
        meeting_date: '2000-01-01',
        participants: ['system'],
        meeting_notes: notesJson,
        created_at: nowIso,
        updated_at: nowIso
      }]);
    }
  } catch (e) {
    console.warn('saveSubmissionToSupabaseSystemMeeting notice:', e);
  }
}

async function updateSubmissionStatusInSupabaseSystemMeeting(sbClient: any, taskId: string, submissionId: string, status: 'approved' | 'rejected', reviewNote?: string) {
  try {
    let sysMeeting: any = null;
    try {
      const { data } = await sbClient
        .from('meetings')
        .select('id, meeting_notes')
        .eq('title', '__SYSTEM_TASK_SUBMISSIONS__')
        .maybeSingle();
      sysMeeting = data;
    } catch {}

    if (sysMeeting && sysMeeting.meeting_notes) {
      try {
        let list: TaskSubmission[] = JSON.parse(sysMeeting.meeting_notes);
        if (Array.isArray(list)) {
          list = list.map(s => {
            if (s.id === submissionId || s.taskId === taskId) {
              return { ...s, status, reviewNote: reviewNote || s.reviewNote, reviewedAt: new Date().toISOString(), reviewedBy: 'admin' };
            }
            return s;
          });

          await sbClient.from('meetings').update({
            meeting_notes: JSON.stringify(list),
            updated_at: new Date().toISOString()
          }).eq('id', sysMeeting.id);
        }
      } catch {}
    }
  } catch (e) {
    console.warn('updateSubmissionStatusInSupabaseSystemMeeting notice:', e);
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

    const sbClient = getSupabaseClient();
    if (sbClient) {
      for (const sub of withContent) {
        try {
          await saveSubmissionToSupabaseSystemMeeting(sbClient, sub);
          if (sub.taskId) {
            const { data: taskData } = await sbClient.from('tasks').select('id, description').eq('id', sub.taskId).maybeSingle();
            if (taskData) {
              const newDesc = embedTaskSubmissionIntoDescription(taskData.description || '', sub);
              await sbClient.from('tasks').update({ description: newDesc }).eq('id', sub.taskId);
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('syncAllCachedSubmissions notice:', err);
  }
}

export const api = {
  async getMeetings(): Promise<Meeting[]> {
    let meetingsData: Meeting[] = [];
    try {
      const res = await apiFetch('/api/meetings');
      if (res.ok) {
        meetingsData = await res.json();
      }
    } catch (err) {
      console.warn('API getMeetings failed, checking Supabase client:', err);
    }

    const sbClient = getSupabaseClient();

    // Direct Supabase fallback if API failed or returned empty
    if (!meetingsData || meetingsData.length === 0) {
      if (sbClient) {
        try {
          const { data, error } = await sbClient
            .from('meetings')
            .select('*, tasks(*)')
            .order('meeting_date', { ascending: false });
          if (!error && Array.isArray(data) && data.length > 0) {
            // Check system submissions store in meetings table
            const sysMeeting = data.find((m: any) => m.title === '__SYSTEM_TASK_SUBMISSIONS__' || m.id === SYSTEM_SUBMISSIONS_MEETING_ID);
            if (sysMeeting && sysMeeting.meeting_notes) {
              try {
                const parsedSubs: TaskSubmission[] = JSON.parse(sysMeeting.meeting_notes);
                if (Array.isArray(parsedSubs)) {
                  for (const s of parsedSubs) {
                    saveCachedTaskSubmission(s);
                    if (s.status === 'pending') {
                      addCachedPendingTaskId(s.taskId);
                    }
                  }
                }
              } catch {}
            }

            meetingsData = data.map((m: any) => ({
              id: m.id,
              title: m.title,
              meetingDate: m.meeting_date,
              participants: m.participants || [],
              meetingNotes: m.meeting_notes,
              createdAt: m.created_at,
              updatedAt: m.updated_at,
              tasks: (m.tasks || []).map((t: any) => ({
                id: t.id,
                meetingId: t.meeting_id,
                title: t.title,
                assignee: t.assignee,
                assignees: t.assignees || (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                dueDate: t.due_date,
                dueTime: t.due_time,
                status: t.status === 'Blocked' ? 'Pending Approval' : t.status,
                priority: t.priority,
                description: t.description,
                tags: t.tags || [],
                createdAt: t.created_at,
                updatedAt: t.updated_at
              }))
            }));
          }
        } catch (sbErr) {
          console.warn('Direct Supabase getMeetings error:', sbErr);
        }
      }
    }

    // Always filter out system meetings
    if (Array.isArray(meetingsData)) {
      meetingsData = meetingsData.filter(
        (m: any) => m.id !== SYSTEM_SUBMISSIONS_MEETING_ID && !String(m.id).startsWith('system-') && m.title !== '__SYSTEM_TASK_SUBMISSIONS__'
      );
    }

    // Background sync of any locally cached submissions to database/server
    syncAllCachedSubmissions().catch(() => {});

    // Extract any embedded submissions from task descriptions into cache and pending set
    if (Array.isArray(meetingsData)) {
      for (const m of meetingsData) {
        if (Array.isArray(m.tasks)) {
          for (const t of m.tasks) {
            if (t.description) {
              const embeddedSub = extractTaskSubmissionFromDescription(t.description);
              if (embeddedSub) {
                if (!embeddedSub.taskId) embeddedSub.taskId = t.id;
                if (!embeddedSub.taskTitle) embeddedSub.taskTitle = t.title;
                saveCachedTaskSubmission(embeddedSub);
                if (embeddedSub.status === 'pending' || t.status === 'Pending Approval' || t.status === 'Blocked') {
                  addCachedPendingTaskId(t.id);
                }
              }
            }
          }
        }
      }
    }

    // Merge cached pending tasks so status 'Pending Approval' is preserved
    const pendingIds = getCachedPendingTaskIds();
    if (Array.isArray(meetingsData)) {
      meetingsData = meetingsData.map((m) => ({
        ...m,
        tasks: (m.tasks || []).map((t) => {
          if (t.status === 'Done') {
            if (pendingIds.has(t.id)) removeCachedPendingTaskId(t.id);
            return t;
          }
          if (t.status === 'Blocked' || t.status === 'Pending Approval' || pendingIds.has(t.id)) {
            return { ...t, status: 'Pending Approval' as const };
          }
          return t;
        }),
      }));
    }

    return meetingsData;
  },

  async getMeeting(id: string): Promise<Meeting> {
    const res = await apiFetch(`/api/meetings/${id}`);
    if (!res.ok) throw new Error('Failed to fetch meeting');
    return res.json();
  },

  async createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const res = await apiFetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create meeting');
    }
    return res.json();
  },

  async updateMeeting(id: string, input: Partial<CreateMeetingInput>): Promise<Meeting> {
    const res = await apiFetch(`/api/meetings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update meeting');
    return res.json();
  },

  async deleteMeeting(id: string): Promise<{ message: string; id: string }> {
    const res = await apiFetch(`/api/meetings/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete meeting');
    return res.json();
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

    try {
      const res = await apiFetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        return res.json();
      }
      const err = await res.json().catch(() => ({}));
      // Fallback ke Supabase client-side jika server mengembalikan error
      const sbClient = getSupabaseClient();
      if (sbClient) {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.assignee !== undefined) updateData.assignee = updates.assignee;
        if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
        if (updates.description !== undefined) updateData.description = updates.description;

        let targetId = isValidUuid(id) ? id : null;
        if (!targetId && updates.title) {
          try {
            const { data: found } = await sbClient.from('tasks').select('id').eq('title', updates.title).limit(1).maybeSingle();
            if (found && found.id) targetId = found.id;
          } catch {}
        }

        if (targetId) {
          let { data: sbTask, error: sbErr } = await sbClient
            .from('tasks')
            .update(updateData)
            .eq('id', targetId)
            .select()
            .maybeSingle();

          // If check constraint blocked 'Pending Approval', retry without status column but keep in local cache
          if (sbErr && updates.status === 'Pending Approval') {
            delete updateData.status;
            const retry = await sbClient.from('tasks').update(updateData).eq('id', targetId).select().maybeSingle();
            if (!retry.error && retry.data) {
              sbTask = retry.data;
              sbErr = null;
            }
          }

          if (sbTask && !sbErr) {
            return {
              id: sbTask.id,
              meetingId: sbTask.meeting_id,
              title: sbTask.title,
              assignee: sbTask.assignee,
              dueDate: sbTask.due_date,
              status: updates.status || sbTask.status,
              priority: (updates.priority || sbTask.priority || 'Medium') as any,
              description: updates.description !== undefined ? updates.description : sbTask.description,
              createdAt: sbTask.created_at,
              updatedAt: sbTask.updated_at,
            };
          }
        }
      }
      throw new Error(err.error || `Gagal memperbarui status tugas (${res.status})`);
    } catch (fetchErr: any) {
      // Fallback ke Supabase jika server offline / network error
      const sbClient = getSupabaseClient();
      if (sbClient) {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.assignee !== undefined) updateData.assignee = updates.assignee;
        if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
        if (updates.description !== undefined) updateData.description = updates.description;

        let targetId = isValidUuid(id) ? id : null;
        if (!targetId && updates.title) {
          try {
            const { data: found } = await sbClient.from('tasks').select('id').eq('title', updates.title).limit(1).maybeSingle();
            if (found && found.id) targetId = found.id;
          } catch {}
        }

        if (targetId) {
          let { data: sbTask, error: sbErr } = await sbClient
            .from('tasks')
            .update(updateData)
            .eq('id', targetId)
            .select()
            .maybeSingle();

          if (sbErr && updates.status === 'Pending Approval') {
            delete updateData.status;
            const retry = await sbClient.from('tasks').update(updateData).eq('id', targetId).select().maybeSingle();
            if (!retry.error && retry.data) {
              sbTask = retry.data;
              sbErr = null;
            }
          }

          if (sbTask && !sbErr) {
            return {
              id: sbTask.id,
              meetingId: sbTask.meeting_id,
              title: sbTask.title,
              assignee: sbTask.assignee,
              dueDate: sbTask.due_date,
              status: updates.status || sbTask.status,
              priority: (updates.priority || sbTask.priority || 'Medium') as any,
              description: updates.description !== undefined ? updates.description : sbTask.description,
              createdAt: sbTask.created_at,
              updatedAt: sbTask.updated_at,
            };
          }
        }
      }
      throw fetchErr;
    }
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

    const res = await apiFetch(`/api/tasks?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async submitTask(taskId: string, input: SubmitTaskInput): Promise<TaskSubmission> {
    const sbClient = getSupabaseClient();
    const now = new Date().toISOString();
    const submissionId = 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

    // 1. Immediately cache the pending task ID locally so it is never lost
    addCachedPendingTaskId(taskId);

    let taskTitle = input.taskTitle;
    let existingDesc = '';
    let assignee = 'User';

    if (sbClient) {
      try {
        const { data: taskData } = await sbClient.from('tasks').select('*').eq('id', taskId).maybeSingle();
        if (taskData) {
          if (!taskTitle) taskTitle = taskData.title;
          existingDesc = taskData.description || '';
          if (taskData.assignee) assignee = taskData.assignee;
        }
      } catch {}
    }

    const createdSub: TaskSubmission = {
      id: submissionId,
      taskId,
      taskTitle,
      assignee,
      notes: input.notes,
      attachments: input.attachments,
      status: 'pending',
      submittedAt: now,
    };

    const newDesc = embedTaskSubmissionIntoDescription(existingDesc, createdSub);

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, taskTitle }),
      });
      if (res.ok) {
        const sub: TaskSubmission = await res.json();
        saveCachedTaskSubmission(sub);
        if (sbClient) {
          try {
            await updateTaskStatusInSupabaseClient(sbClient, taskId, 'Pending Approval', newDesc);
            await saveSubmissionToSupabaseSystemMeeting(sbClient, sub);
            await sbClient.from('task_submissions').upsert({
              id: sub.id,
              task_id: taskId,
              assignee: sub.assignee || assignee,
              notes: sub.notes,
              attachments: sub.attachments,
              status: sub.status || 'pending',
              submitted_at: sub.submittedAt || now,
            });
          } catch (e) {
            console.warn('Direct Supabase submit fallback notice:', e);
          }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return sub;
      }
    } catch (err) {
      console.warn('apiFetch submitTask error, trying direct Supabase:', err);
    }

    if (sbClient) {
      try {
        await updateTaskStatusInSupabaseClient(sbClient, taskId, 'Pending Approval', newDesc);
        await saveSubmissionToSupabaseSystemMeeting(sbClient, createdSub);
        await sbClient.from('task_submissions').upsert({
          id: submissionId,
          task_id: taskId,
          assignee,
          notes: input.notes,
          attachments: input.attachments,
          status: 'pending',
          submitted_at: now,
        });

        saveCachedTaskSubmission(createdSub);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return createdSub;
      } catch (sbErr) {
        console.warn('Direct Supabase submitTask failed:', sbErr);
      }
    }

    // Offline / fallback response
    saveCachedTaskSubmission(createdSub);
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
      console.warn('API getTaskSubmissions error, trying direct Supabase:', err);
    }

    const sbClient = getSupabaseClient();
    if (sbClient) {
      // 2. Direct Supabase tasks table description embedding (fastest & most reliable)
      let taskRecord: any = null;
      try {
        if (isValidUuid(taskId)) {
          try {
            const { data } = await sbClient.from('tasks').select('*').eq('id', taskId).maybeSingle();
            taskRecord = data;
          } catch {}
        }
        if (!taskRecord && taskTitle) {
          try {
            const { data } = await sbClient.from('tasks').select('*').eq('title', taskTitle).limit(1).maybeSingle();
            taskRecord = data;
          } catch {}
        }
        if (taskRecord && taskRecord.description) {
          const emb = extractTaskSubmissionFromDescription(taskRecord.description);
          if (emb) {
            if (!emb.taskId) emb.taskId = taskRecord.id;
            if (!emb.taskTitle && taskRecord.title) emb.taskTitle = taskRecord.title;
            result.push(emb);
          }
        }
        // Also check by taskTitle in tasks table if available
        if (taskTitle && (!result.length || !result.some(r => Array.isArray(r.attachments) && r.attachments.length > 0))) {
          try {
            const { data: titleTasks } = await sbClient.from('tasks').select('*').eq('title', taskTitle).limit(5);
            if (Array.isArray(titleTasks)) {
              for (const tt of titleTasks) {
                if (tt.description) {
                  const emb = extractTaskSubmissionFromDescription(tt.description);
                  if (emb) {
                    if (!emb.taskId) emb.taskId = tt.id;
                    if (!emb.taskTitle) emb.taskTitle = tt.title;
                    result.push(emb);
                  }
                }
              }
            }
          } catch {}
        }
      } catch (embErr) {
        console.warn('Direct Supabase task description check error:', embErr);
      }

      // 3. Direct Supabase task_submissions table
      const validQueryId = isValidUuid(taskId) ? taskId : (taskRecord?.id && isValidUuid(taskRecord.id) ? taskRecord.id : null);
      if (validQueryId) {
        try {
          const { data, error } = await sbClient
            .from('task_submissions')
            .select('*')
            .eq('task_id', validQueryId)
            .order('submitted_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            const directSubs: TaskSubmission[] = data.map((s: any) => ({
              id: s.id,
              taskId: s.task_id,
              taskTitle: s.task_title || taskTitle,
              assignee: s.assignee,
              notes: s.notes || '',
              attachments: Array.isArray(s.attachments) ? s.attachments : [],
              status: s.status || 'pending',
              submittedAt: s.submitted_at,
              reviewedBy: s.reviewed_by,
              reviewedAt: s.reviewed_at,
              reviewNote: s.review_note,
            }));

            for (const ds of directSubs) {
              const idx = result.findIndex(r => r.id === ds.id || r.taskId === ds.taskId);
              if (idx >= 0) {
                const resAtt = Array.isArray(result[idx].attachments) ? result[idx].attachments : [];
                const dsAtt = Array.isArray(ds.attachments) ? ds.attachments : [];
                result[idx] = {
                  ...result[idx],
                  ...ds,
                  attachments: dsAtt.length > 0 ? dsAtt : resAtt,
                };
              } else {
                result.push(ds);
              }
            }
          }
        } catch (sbErr) {
          console.warn('Direct Supabase getTaskSubmissions warning:', sbErr);
        }
      }

      // 4. Direct Supabase system meeting store
      try {
        let sysMeeting: any = null;
        try {
          const { data } = await sbClient
            .from('meetings')
            .select('meeting_notes')
            .eq('title', '__SYSTEM_TASK_SUBMISSIONS__')
            .maybeSingle();
          sysMeeting = data;
        } catch {}

        if (sysMeeting && sysMeeting.meeting_notes) {
          const list: TaskSubmission[] = JSON.parse(sysMeeting.meeting_notes);
          if (Array.isArray(list)) {
            const matched = list.filter(s => s.taskId === taskId || (taskTitle && s.taskTitle === taskTitle));
            for (const sm of matched) {
              const idx = result.findIndex(r => r.id === sm.id || r.taskId === sm.taskId);
              if (idx >= 0) {
                const resAtt = Array.isArray(result[idx].attachments) ? result[idx].attachments : [];
                const smAtt = Array.isArray(sm.attachments) ? sm.attachments : [];
                result[idx] = {
                  ...result[idx],
                  ...sm,
                  attachments: smAtt.length > 0 ? smAtt : resAtt,
                };
              } else {
                result.push(sm);
              }
            }
          }
        }
      } catch (sysErr) {
        console.warn('Direct Supabase system meeting submissions warning:', sysErr);
      }
    }

    // 5. Merge with locally cached submissions (localStorage)
    const cached = getCachedTaskSubmissions(taskId, taskTitle);
    let cachedHasAttachments = false;
    let localSubWithAtt: TaskSubmission | null = null;
    if (Array.isArray(cached) && cached.length > 0) {
      for (const cs of cached) {
        if (Array.isArray(cs.attachments) && cs.attachments.length > 0) {
          cachedHasAttachments = true;
          localSubWithAtt = cs;
        }
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

    // 6. Self-healing: if localStorage has attachments that weren't found on the server, push to server and Supabase!
    const serverHasAttachments = result.some(r => Array.isArray(r.attachments) && r.attachments.length > 0);
    if (cachedHasAttachments && localSubWithAtt && !serverHasAttachments) {
      try {
        apiFetch(`/api/tasks/${taskId}/sync-submission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localSubWithAtt),
        }).catch(() => {});
        if (sbClient) {
          saveSubmissionToSupabaseSystemMeeting(sbClient, localSubWithAtt).catch(() => {});
          sbClient.from('tasks').select('description').eq('id', taskId).maybeSingle().then(({ data }: any) => {
            if (data) {
              const nd = embedTaskSubmissionIntoDescription(data.description || '', localSubWithAtt!);
              sbClient.from('tasks').update({ description: nd }).eq('id', taskId).then(() => {});
            }
          }).catch(() => {});
        }
      } catch {}
    }

    // 7. Consolidate and deduplicate so multiple entries for same taskId don't mask each other
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

    // 8. Update local cache with merged results so future queries keep attachments
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

    const sbClient = getSupabaseClient();
    const now = new Date().toISOString();

    // Prepare embedded description update if sbClient exists
    let newApprovedDesc: string | undefined;
    if (sbClient) {
      try {
        const { data: taskRecord } = await sbClient.from('tasks').select('*').eq('id', taskId).maybeSingle();
        if (taskRecord) {
          let subToApprove = extractTaskSubmissionFromDescription(taskRecord.description || '');
          if (!subToApprove) {
            const cachedSubs = getCachedTaskSubmissions(taskId, taskTitle || taskRecord.title);
            subToApprove = cachedSubs.find(s => s.id === submissionId || s.taskId === taskId) || null;
          }
          if (subToApprove) {
            subToApprove = {
              ...subToApprove,
              status: 'approved',
              reviewedBy: 'admin',
              reviewedAt: now,
              reviewNote: reviewNote || subToApprove.reviewNote,
            };
            newApprovedDesc = embedTaskSubmissionIntoDescription(taskRecord.description || '', subToApprove);
          }
        }
      } catch {}
    }

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, reviewNote, taskTitle }),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        if (sbClient) {
          try {
            await updateTaskStatusInSupabaseClient(sbClient, taskId, 'Done', newApprovedDesc);
            await updateSubmissionStatusInSupabaseSystemMeeting(sbClient, taskId, submissionId, 'approved', reviewNote);
            if (submissionId) {
              await sbClient.from('task_submissions').update({
                status: 'approved',
                reviewed_by: 'admin',
                reviewed_at: now,
                review_note: reviewNote,
              }).eq('id', submissionId);
            }
          } catch {}
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return updatedTask;
      }
    } catch (err) {
      console.warn('API approve error, trying direct Supabase:', err);
    }

    if (sbClient) {
      try {
        await updateTaskStatusInSupabaseClient(sbClient, taskId, 'Done', newApprovedDesc);
        await updateSubmissionStatusInSupabaseSystemMeeting(sbClient, taskId, submissionId, 'approved', reviewNote);
        if (submissionId) {
          await sbClient.from('task_submissions').update({
            status: 'approved',
            reviewed_by: 'admin',
            reviewed_at: now,
            review_note: reviewNote,
          }).eq('id', submissionId);
        }
        const { data: updated } = await sbClient.from('tasks').select('*').eq('id', taskId).maybeSingle();
        if (updated) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tasksUpdated'));
          }
          return {
            id: updated.id,
            meetingId: updated.meeting_id,
            title: updated.title,
            assignee: updated.assignee,
            dueDate: updated.due_date,
            status: 'Done',
            description: updated.description,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
        }
      } catch (sbErr) {
        console.warn('Direct Supabase approveTaskSubmission failed:', sbErr);
      }
    }

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

    const sbClient = getSupabaseClient();
    const now = new Date().toISOString();

    let newRejectedDesc: string | undefined;
    if (sbClient) {
      try {
        const { data: taskRecord } = await sbClient.from('tasks').select('*').eq('id', taskId).maybeSingle();
        if (taskRecord) {
          let subToReject = extractTaskSubmissionFromDescription(taskRecord.description || '');
          if (!subToReject) {
            const cachedSubs = getCachedTaskSubmissions(taskId, taskTitle || taskRecord.title);
            subToReject = cachedSubs.find(s => s.id === submissionId || s.taskId === taskId) || null;
          }
          if (subToReject) {
            subToReject = {
              ...subToReject,
              status: 'rejected',
              reviewedBy: 'admin',
              reviewedAt: now,
              reviewNote: reviewNote || subToReject.reviewNote,
            };
            newRejectedDesc = embedTaskSubmissionIntoDescription(taskRecord.description || '', subToReject);
          }
        }
      } catch {}
    }

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, reviewNote, taskTitle }),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        if (sbClient) {
          try {
            await updateTaskStatusInSupabaseClient(sbClient, taskId, 'In Progress', newRejectedDesc);
            await updateSubmissionStatusInSupabaseSystemMeeting(sbClient, taskId, submissionId, 'rejected', reviewNote);
            if (submissionId) {
              await sbClient.from('task_submissions').update({
                status: 'rejected',
                reviewed_by: 'admin',
                reviewed_at: now,
                review_note: reviewNote,
              }).eq('id', submissionId);
            }
          } catch {}
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
        return updatedTask;
      }
    } catch (err) {
      console.warn('API reject error, trying direct Supabase:', err);
    }

    if (sbClient) {
      try {
        await updateTaskStatusInSupabaseClient(sbClient, taskId, 'In Progress', newRejectedDesc);
        await updateSubmissionStatusInSupabaseSystemMeeting(sbClient, taskId, submissionId, 'rejected', reviewNote);
        if (submissionId) {
          await sbClient.from('task_submissions').update({
            status: 'rejected',
            reviewed_by: 'admin',
            reviewed_at: now,
            review_note: reviewNote,
          }).eq('id', submissionId);
        }
        const { data: updated } = await sbClient.from('tasks').select('*').eq('id', taskId).maybeSingle();
        if (updated) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tasksUpdated'));
          }
          return {
            id: updated.id,
            meetingId: updated.meeting_id,
            title: updated.title,
            assignee: updated.assignee,
            dueDate: updated.due_date,
            status: 'In Progress',
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
        }
      } catch (sbErr) {
        console.warn('Direct Supabase rejectTaskSubmission failed:', sbErr);
      }
    }

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
    const sbClient = getSupabaseClient();

    // 1. Load locally cached divisions first
    let localDivisions: Division[] = [];
    try {
      const cached = localStorage.getItem('cached_divisions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localDivisions = parsed;
      }
    } catch {}

    let fetchedDivisions: Division[] = [];

    // 2. Try direct Supabase client query
    if (sbClient) {
      try {
        const { data, error } = await sbClient.from('divisions').select('*').order('name', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          fetchedDivisions = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (sbErr) {
        console.warn('Direct Supabase getDivisions warning:', sbErr);
      }
    }

    // 3. If direct Supabase didn't return data, try API fetch
    if (fetchedDivisions.length === 0) {
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
    }

    // 4. Fallback defaults if both empty
    const baseList = fetchedDivisions.length > 0 ? fetchedDivisions : (localDivisions.length > 0 ? localDivisions : [
      { id: 'div-1', name: 'REI' },
      { id: 'div-2', name: 'LM' },
      { id: 'div-3', name: 'Sosmed' },
      { id: 'div-4', name: 'PH' },
      { id: 'div-5', name: 'Maps' },
    ]);

    // 5. CRITICAL MERGE: Ensure any custom division created locally is preserved and never dropped
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
    const sbClient = getSupabaseClient();
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
      console.warn('API createDivision failed, will attempt direct Supabase client / cache:', err);
    }

    const divisionId = createdDivision?.id || `div-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const divisionName = input.name.trim();

    if (sbClient) {
      try {
        const { data: sbData, error: sbErr } = await sbClient
          .from('divisions')
          .upsert({
            id: divisionId,
            name: divisionName,
            created_at: now,
            updated_at: now,
          })
          .select()
          .maybeSingle();

        if (!sbErr && sbData) {
          createdDivision = {
            id: sbData.id,
            name: sbData.name,
            createdAt: sbData.created_at,
            updatedAt: sbData.updated_at,
          };
        } else if (sbErr) {
          console.warn('Direct Supabase upsert division warning:', sbErr.message);
        }
      } catch (sbErr: any) {
        console.warn('Direct Supabase upsert division error:', sbErr?.message);
      }
    }

    if (!createdDivision) {
      createdDivision = {
        id: divisionId,
        name: divisionName,
        createdAt: now,
        updatedAt: now,
      };
    }

    // Persist in localStorage cache immediately
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

    // Dispatch global event for other components to re-read divisions immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('divisionsUpdated', { detail: createdDivision }));
    }

    return createdDivision;
  },

  async updateDivision(id: string, input: Partial<CreateDivisionInput>): Promise<Division> {
    const sbClient = getSupabaseClient();
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
      console.warn('API updateDivision failed, falling back to direct Supabase / cache:', err);
    }

    if (sbClient && input.name) {
      try {
        const { data, error } = await sbClient
          .from('divisions')
          .update({ name: input.name.trim(), updated_at: now })
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          updatedDivision = {
            id: data.id,
            name: data.name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (sbErr) {
        console.warn('Direct Supabase updateDivision warning:', sbErr);
      }
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
    const sbClient = getSupabaseClient();
    try {
      await apiFetch(`/api/divisions/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API deleteDivision failed, attempting direct Supabase / cache:', err);
    }

    if (sbClient) {
      try {
        await sbClient.from('divisions').delete().eq('id', id);
      } catch (sbErr) {
        console.warn('Direct Supabase deleteDivision warning:', sbErr);
      }
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
    const sbClient = getSupabaseClient();

    let localUsers: Omit<User, 'password'>[] = [];
    try {
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localUsers = parsed;
      }
    } catch {}

    let fetchedUsers: Omit<User, 'password'>[] = [];

    if (sbClient) {
      try {
        const { data, error } = await sbClient
          .from('users')
          .select('id, username, division_id, role, created_at, updated_at')
          .order('username', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          fetchedUsers = data.map((u: any) => ({
            id: u.id,
            username: u.username,
            divisionId: u.division_id || '',
            role: u.role || 'user',
            createdAt: u.created_at,
            updatedAt: u.updated_at,
          }));
        }
      } catch (sbErr) {
        console.warn('Direct Supabase getUsers warning:', sbErr);
      }
    }

    if (fetchedUsers.length === 0) {
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

    // Merge logic
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
    const sbClient = getSupabaseClient();
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
      console.warn('API createUser failed, falling back to direct Supabase / cache:', err);
    }

    const userId = createdUser?.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    if (sbClient) {
      try {
        const { data: sbData, error: sbErr } = await sbClient
          .from('users')
          .upsert({
            id: userId,
            username: input.username.trim(),
            password: input.password,
            division_id: input.divisionId,
            role: input.role || 'user',
            created_at: now,
            updated_at: now,
          })
          .select('id, username, division_id, role, created_at, updated_at')
          .maybeSingle();

        if (!sbErr && sbData) {
          createdUser = {
            id: sbData.id,
            username: sbData.username,
            divisionId: sbData.division_id,
            role: sbData.role,
            createdAt: sbData.created_at,
            updatedAt: sbData.updated_at,
          };
        }
      } catch (sbErr) {
        console.warn('Direct Supabase createUser warning:', sbErr);
      }
    }

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
    const sbClient = getSupabaseClient();
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
      console.warn('API updateUser failed, falling back to direct Supabase / cache:', err);
    }

    if (sbClient) {
      try {
        const updateData: any = { updated_at: now };
        if (input.username !== undefined) updateData.username = input.username.trim();
        if (input.password !== undefined) updateData.password = input.password;
        if (input.divisionId !== undefined) updateData.division_id = input.divisionId;
        if (input.role !== undefined) updateData.role = input.role;

        const { data, error } = await sbClient
          .from('users')
          .update(updateData)
          .eq('id', id)
          .select('id, username, division_id, role, created_at, updated_at')
          .maybeSingle();

        if (!error && data) {
          updatedUser = {
            id: data.id,
            username: data.username,
            divisionId: data.division_id,
            role: data.role,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (sbErr) {
        console.warn('Direct Supabase updateUser warning:', sbErr);
      }
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
    const sbClient = getSupabaseClient();
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API deleteUser failed, attempting direct Supabase / cache:', err);
    }

    if (sbClient) {
      try {
        await sbClient.from('users').delete().eq('id', id);
      } catch (sbErr) {
        console.warn('Direct Supabase deleteUser warning:', sbErr);
      }
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

  syncAllCachedSubmissions,
};
