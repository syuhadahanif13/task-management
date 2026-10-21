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

export interface GitHubCommit {
  id: string;
  message: string;
  author: string;
  authorAvatar?: string;
  url: string;
  timestamp?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  authorAvatar?: string;
  branch?: string;
  mergedAt?: string;
  updatedAt?: string;
}

export interface GitHubBranch {
  name: string;
  url?: string;
  lastCommit?: string;
}

export interface GitHubIssue {
  id?: number;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  assignee?: string;
  labels?: string[];
  commentsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GitHubProjectRef {
  id?: string | number;
  title: string;
  url: string;
  number?: number;
  columnOrStatus?: string;
}

export interface GitHubTaskMetadata {
  repo?: string;
  branches?: GitHubBranch[];
  commits?: GitHubCommit[];
  pullRequests?: GitHubPullRequest[];
  issue?: GitHubIssue;
  project?: GitHubProjectRef;
  lastSyncedAt?: string;
}

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
  githubRepo?: string;
  githubBranch?: string;
  githubPrUrl?: string;
  githubIssueUrl?: string;
  githubProjectUrl?: string;
  githubMetadata?: GitHubTaskMetadata;
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
    dueTime?: string;
    status: TaskStatus;
    priority?: TaskPriority;
    description?: string;
    tags?: string[];
  }>;
}

export interface GitProject {
  id: string;
  name: string;
  repo: string;
  url?: string;
  description?: string;
  createdAt?: string;
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
  githubRepo?: string;
  githubProjectUrl?: string;
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
  password?: string;
  divisionId: string;
  role: 'admin' | 'user';
  githubId?: string | null;
  githubUsername?: string | null;
  githubAvatarUrl?: string | null;
  githubAccessToken?: string | null;
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

export interface GitHubConnectedRepo {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description?: string;
  private: boolean;
  owner: string;
  updatedAt?: string;
}
