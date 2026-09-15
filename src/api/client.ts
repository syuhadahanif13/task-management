import { Meeting, Task, CreateMeetingInput, CreateTaskInput, AIParseResult } from '../types';

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

  async createTask(meetingId: string, task: CreateTaskInput): Promise<Task> {
    const res = await fetch(`/api/meetings/${meetingId}/tasks`, {
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
  }
};
