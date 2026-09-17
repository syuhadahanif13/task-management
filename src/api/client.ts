import { Meeting, Task, CreateMeetingInput, CreateTaskInput, AIParseResult, TaskSubmission, SubmitTaskInput, Division, User, CreateDivisionInput, CreateUserInput } from '../types';

export const api = {
  async getMeetings(): Promise<Meeting[]> {
    const res = await fetch('/api/meetings');
    if (!res.ok) throw new Error('Failed to fetch meetings');
    return res.json();
  },

  async getMeeting(id: string): Promise<Meeting> {
    const res = await fetch(`/api/meetings/${id}`);
    if (!res.ok) throw new Error('Failed to fetch meeting');
    return res.json();
  },

  async createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const res = await fetch('/api/meetings', {
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
    const res = await fetch(`/api/meetings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update meeting');
    return res.json();
  },

  async deleteMeeting(id: string): Promise<{ message: string; id: string }> {
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete meeting');
    return res.json();
  },

  async createTask(meetingId: string | undefined | null, task: CreateTaskInput): Promise<Task> {
    const url = meetingId ? `/api/meetings/${meetingId}/tasks` : '/api/tasks';
    const res = await fetch(url, {
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
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },

  async deleteTask(id: string): Promise<{ message: string; id: string }> {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  async getTasks(params?: { meetingId?: string; status?: string; assignee?: string; search?: string }): Promise<Array<Task & { meetingTitle: string; meetingDate: string }>> {
    const searchParams = new URLSearchParams();
    if (params?.meetingId) searchParams.append('meetingId', params.meetingId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.assignee) searchParams.append('assignee', params.assignee);
    if (params?.search) searchParams.append('search', params.search);

    const res = await fetch(`/api/tasks?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async submitTask(taskId: string, input: SubmitTaskInput): Promise<TaskSubmission> {
    const res = await fetch(`/api/tasks/${taskId}/submit`, {
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
    const res = await fetch(`/api/tasks/${taskId}/submissions`);
    if (!res.ok) throw new Error('Failed to fetch submissions');
    return res.json();
  },

  async approveTaskSubmission(taskId: string, submissionId: string, reviewNote?: string): Promise<Task> {
    const res = await fetch(`/api/tasks/${taskId}/approve`, {
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
    const res = await fetch(`/api/tasks/${taskId}/reject`, {
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
    const res = await fetch('/api/ai/extract', {
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
    const res = await fetch('/api/schema');
    if (!res.ok) throw new Error('Failed to fetch schema');
    return res.json();
  },

  async getDivisions(): Promise<Division[]> {
    const res = await fetch('/api/divisions');
    if (!res.ok) throw new Error('Failed to fetch divisions');
    return res.json();
  },

  async createDivision(input: CreateDivisionInput): Promise<Division> {
    const res = await fetch('/api/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create division');
    }
    return res.json();
  },

  async updateDivision(id: string, input: Partial<CreateDivisionInput>): Promise<Division> {
    const res = await fetch(`/api/divisions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update division');
    return res.json();
  },

  async deleteDivision(id: string): Promise<{ message: string; id: string }> {
    const res = await fetch(`/api/divisions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete division');
    return res.json();
  },

  async getUsers(): Promise<Omit<User, 'password'>[]> {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async createUser(input: CreateUserInput): Promise<Omit<User, 'password'>> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create user');
    }
    return res.json();
  },

  async updateUser(id: string, input: Partial<CreateUserInput>): Promise<Omit<User, 'password'>> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },

  async deleteUser(id: string): Promise<{ message: string; id: string }> {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  async login(username: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const res = await fetch('/api/auth/login', {
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
