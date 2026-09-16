/**
 * Core Data Models adhering strictly to the 4 Core Fields:
 * 1. Meeting Date (Tanggal Rapat)
 * 2. Participants (Peserta)
 * 3. Meeting Notes/Minutes (Catatan)
 * 4. Tasks (Action Items: title, assignee, due date, status)
 * 
 * Relationship: Meetings (1) -> Tasks (Many)
 */

export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked' | 'Pending Approval';

export interface Task {
  id: string;
  meetingId: string;
  title: string;
  assignee: string;
  dueDate: string;
  status: TaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskAttachment {
  name: string;
  type: string;
  size: number;
  data: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  assignee: string;
  notes: string;
  attachments: TaskAttachment[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface Meeting {
  id: string;
  meetingDate: string;
  participants: string[];
  meetingNotes: string;
  tasks: Task[];
  submissions?: TaskSubmission[];
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMeetingInput {
  meetingDate: string;
  participants: string[];
  meetingNotes: string;
  title?: string;
  tasks?: Array<{
    title: string;
    assignee: string;
    dueDate: string;
    status: TaskStatus;
  }>;
}

export interface CreateTaskInput {
  title: string;
  assignee: string;
  dueDate: string;
  status: TaskStatus;
}

export interface AIParseResult {
  title: string;
  meetingDate: string;
  participants: string[];
  meetingNotes: string;
  tasks: Array<{
    title: string;
    assignee: string;
    dueDate: string;
    status: TaskStatus;
  }>;
}

export interface SubmitTaskInput {
  notes: string;
  attachments: TaskAttachment[];
}

export interface Division {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  divisionId: string;
  role: 'admin' | 'user';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDivisionInput {
  name: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  divisionId: string;
  role?: 'admin' | 'user';
}
