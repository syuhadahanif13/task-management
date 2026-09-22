import { Meeting, Task, CreateMeetingInput, CreateTaskInput, AIParseResult, TaskSubmission, SubmitTaskInput, Division, User, CreateDivisionInput, CreateUserInput } from '../types';
import { getSupabaseClient } from '../lib/supabase';

const API_BASE = (((import.meta as any).env?.VITE_API_URL as string) || '').replace(/\/$/, '');

function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith('/api') ? `${API_BASE}${input}` : input;
  return fetch(url, init);
}

export const api = {
  async getMeetings(): Promise<Meeting[]> {
    const res = await apiFetch('/api/meetings');
    if (!res.ok) throw new Error('Failed to fetch meetings');
    return res.json();
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

        const { data: sbTask, error: sbErr } = await sbClient
          .from('tasks')
          .update(updateData)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (sbTask && !sbErr) {
          return {
            id: sbTask.id,
            meetingId: sbTask.meeting_id,
            title: sbTask.title,
            assignee: sbTask.assignee,
            dueDate: sbTask.due_date,
            status: sbTask.status,
            priority: (updates.priority || sbTask.priority || 'Medium') as any,
            description: updates.description !== undefined ? updates.description : sbTask.description,
            createdAt: sbTask.created_at,
            updatedAt: sbTask.updated_at,
          };
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

        const { data: sbTask, error: sbErr } = await sbClient
          .from('tasks')
          .update(updateData)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (sbTask && !sbErr) {
          return {
            id: sbTask.id,
            meetingId: sbTask.meeting_id,
            title: sbTask.title,
            assignee: sbTask.assignee,
            dueDate: sbTask.due_date,
            status: sbTask.status,
            priority: (updates.priority || sbTask.priority || 'Medium') as any,
            description: updates.description !== undefined ? updates.description : sbTask.description,
            createdAt: sbTask.created_at,
            updatedAt: sbTask.updated_at,
          };
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
    const res = await apiFetch(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit task');
    }
    return res.json();
  },

  async getTaskSubmissions(taskId: string): Promise<TaskSubmission[]> {
    const res = await apiFetch(`/api/tasks/${taskId}/submissions`);
    if (!res.ok) throw new Error('Failed to fetch submissions');
    return res.json();
  },

  async approveTaskSubmission(taskId: string, submissionId: string, reviewNote?: string): Promise<Task> {
    const res = await apiFetch(`/api/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, reviewNote }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to approve task');
    }
    return res.json();
  },

  async rejectTaskSubmission(taskId: string, submissionId: string, reviewNote: string): Promise<Task> {
    const res = await apiFetch(`/api/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, reviewNote }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reject task');
    }
    return res.json();
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
    try {
      const res = await apiFetch('/api/divisions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try { localStorage.setItem('cached_divisions', JSON.stringify(data)); } catch {}
          return data;
        }
      }
    } catch (fetchErr) {
      console.warn('API fetch divisions failed, trying direct Supabase client:', fetchErr);
    }

    if (sbClient) {
      try {
        const { data, error } = await sbClient.from('divisions').select('*').order('name', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: Division[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
          try { localStorage.setItem('cached_divisions', JSON.stringify(mapped)); } catch {}
          return mapped;
        }
      } catch (sbErr) {
        console.warn('Direct Supabase getDivisions warning:', sbErr);
      }
    }

    try {
      const cached = localStorage.getItem('cached_divisions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    const defaultDivisions: Division[] = [
      { id: 'div-1', name: 'REI' },
      { id: 'div-2', name: 'LM' },
      { id: 'div-3', name: 'Sosmed' },
      { id: 'div-4', name: 'PH' },
      { id: 'div-5', name: 'Maps' },
    ];
    try { localStorage.setItem('cached_divisions', JSON.stringify(defaultDivisions)); } catch {}
    return defaultDivisions;
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

    return { message: 'Division deleted', id };
  },

  async getUsers(): Promise<Omit<User, 'password'>[]> {
    const sbClient = getSupabaseClient();
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try { localStorage.setItem('cached_users', JSON.stringify(data)); } catch {}
          return data;
        }
      }
    } catch (err) {
      console.warn('API getUsers failed, trying direct Supabase client:', err);
    }

    if (sbClient) {
      try {
        const { data, error } = await sbClient.from('users').select('id, username, division_id, role, created_at, updated_at').order('username', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((u: any) => ({
            id: u.id,
            username: u.username,
            divisionId: u.division_id || '',
            role: u.role || 'user',
            createdAt: u.created_at,
            updatedAt: u.updated_at,
          }));
          try { localStorage.setItem('cached_users', JSON.stringify(mapped)); } catch {}
          return mapped;
        }
      } catch (sbErr) {
        console.warn('Direct Supabase getUsers warning:', sbErr);
      }
    }

    try {
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

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
    return defaultUsers;
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
  }
};
