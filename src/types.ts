/**
 * Core Data Models adhering strictly to the 4 Core Fields:
 * 1. Meeting Date (Tanggal Rapat)
 * 2. Participants (Peserta)
 * 3. Meeting Notes/Minutes (Catatan)
 * 4. Tasks (Action Items: title, assignee, due date, status)
 * 
 * Relationship: Meetings (1) -> Tasks (Many)
 */

export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Pending Approval';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: string;
  meetingId?: string;
  title: string;
  assignee: string;
  assignees?: string[];
  dueDate: string;
  dueTime?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  description?: string;
  tags?: string[];
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
  taskTitle?: string;
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
    assignees?: string[];
    dueDate: string;
    status: TaskStatus;
  }>;
}

export interface CreateTaskInput {
  title: string;
  assignee: string;
  assignees?: string[];
  dueDate: string;
  dueTime?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  description?: string;
  tags?: string[];
  meetingId?: string;
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
  taskTitle?: string;
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

// Calendar types
export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'meeting' | 'task-due' | 'task-overdue';
  meetingId?: string;
  taskId?: string;
  color?: string;
}

// Team / Employee monitoring types
export interface EmployeeStats {
  name: string;
  divisionId?: string;
  divisionName?: string;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  pendingApprovalTasks: number;
  completionRate: number;
  tasks: Array<Task & { meetingTitle: string; meetingDate: string }>;
}

export type AppTab = 'dashboard' | 'calendar' | 'meetings' | 'active-meeting' | 'all-tasks' | 'team' | 'settings';
