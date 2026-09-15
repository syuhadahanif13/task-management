/**
 * Core Data Models adhering strictly to the 4 Core Fields:
 * 1. Meeting Date (Tanggal Rapat)
 * 2. Participants (Peserta)
 * 3. Meeting Notes/Minutes (Catatan)
 * 4. Tasks (Action Items: title, assignee, due date, status)
 * 
 * Relationship: Meetings (1) -> Tasks (Many)
 */

export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked';

export interface Task {
  id: string;
  meetingId: string; // Foreign key establishing the One-to-Many relationship
  title: string;      // Action item title (Judul Tindakan)
  assignee: string;   // Assignee name (Penanggung Jawab, typically one of the participants)
  dueDate: string;    // Due date in YYYY-MM-DD format (Tenggat Waktu)
  status: TaskStatus; // Status (Status pengerjaan)
  createdAt?: string;
  updatedAt?: string;
}

export interface Meeting {
  id: string;
  // Field 1: Meeting Date (Tanggal Rapat)
  meetingDate: string; // YYYY-MM-DD or ISO string
  
  // Field 2: Participants (Peserta)
  participants: string[]; // List of attendees / peserta
  
  // Field 3: Meeting Notes/Minutes (Catatan)
  meetingNotes: string; // Detailed minutes, summary, discussion points
  
  // Field 4: Tasks (Action items: title, assignee, due date, status)
  // Related Action Items (One-to-Many relationship)
  tasks: Task[];
  
  // Optional helpful metadata for organizational clarity
  title?: string; // Meeting topic or title (e.g. "Sprint Planning Q3")
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
