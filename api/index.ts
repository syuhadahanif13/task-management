import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Pending Approval';

export interface Task {
  id: string;
  meetingId?: string;
  title: string;
  assignee: string;
  assignees?: string[];
  dueDate: string;
  dueTime?: string;
  status: TaskStatus;
  priority?: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
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

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// In-memory data store (clean state)
let meetings: Meeting[] = [];
let submissions: TaskSubmission[] = [];
let divisions: Division[] = [];
let users: User[] = [];

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

// Router that supports both /api prefix and root-relative endpoints
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected: Boolean(supabase)
  });
});

router.get('/schema', (req, res) => {
  res.json({
    architecture: 'Meeting-Driven Action Item Management System',
    relationship: 'One-to-Many (Meeting 1 ---> * Tasks)',
    coreFields: {
      meetingDate: { name: 'Meeting Date (Tanggal Rapat)', type: 'DATE (YYYY-MM-DD)', required: true },
      participants: { name: 'Participants (Peserta)', type: 'ARRAY<STRING>', required: true },
      meetingNotes: { name: 'Meeting Notes / Minutes (Catatan)', type: 'TEXT', required: true },
      tasks: { name: 'Tasks (Action items: title, assignee, due date, status)', required: true }
    }
  });
});

async function syncMeetingsFromSupabase(): Promise<Meeting[]> {
  if (!supabase) return meetings;
  try {
    const { data: dbMeetings, error } = await supabase
      .from('meetings')
      .select('*, tasks(*)')
      .order('meeting_date', { ascending: false });

    // Collect all task IDs that have pending submissions
    const pendingTaskIdSet = new Set<string>();

    try {
      const { data: pendingSubs } = await supabase
        .from('task_submissions')
        .select('task_id')
        .eq('status', 'pending');
      if (Array.isArray(pendingSubs)) {
        for (const s of pendingSubs) {
          if (s.task_id) pendingTaskIdSet.add(s.task_id);
        }
      }
    } catch (e) {
      console.warn('Failed to query pending task_submissions:', e);
    }

    // Add pending tasks from in-memory submissions
    for (const s of submissions) {
      if (s.status === 'pending') {
        pendingTaskIdSet.add(s.taskId);
      }
    }

    // Retain Pending Approval status currently in memory to prevent race condition reversion
    for (const m of meetings) {
      for (const t of m.tasks || []) {
        if (t.status === 'Pending Approval') {
          pendingTaskIdSet.add(t.id);
        }
      }
    }

    if (!error && Array.isArray(dbMeetings)) {
      const formatted: Meeting[] = dbMeetings.map((m: any) => ({
        id: m.id,
        title: m.title,
        meetingDate: m.meeting_date,
        participants: m.participants || [],
        meetingNotes: m.meeting_notes,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        tasks: (m.tasks || []).map((t: any) => {
          const isPending = pendingTaskIdSet.has(t.id) || t.status === 'Pending Approval';
          return {
            id: t.id,
            meetingId: t.meeting_id,
            title: t.title,
            assignee: t.assignee,
            assignees: t.assignees || (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
            dueDate: t.due_date,
            dueTime: t.due_time,
            status: isPending ? ('Pending Approval' as TaskStatus) : (t.status as TaskStatus),
            priority: t.priority,
            description: t.description,
            tags: t.tags || [],
            createdAt: t.created_at,
            updatedAt: t.updated_at
          };
        })
      }));
      meetings = formatted;
      return formatted;
    }
  } catch (err: any) {
    console.warn('Supabase read fallback to memory:', err?.message);
  }
  return meetings;
}

router.get('/meetings', async (req, res) => {
  if (supabase) {
    const synced = await syncMeetingsFromSupabase();
    return res.json(synced);
  }

  const sorted = [...meetings].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  res.json(sorted);
});

router.get('/meetings/:id', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json(meeting);
});

router.post('/meetings', async (req, res) => {
  const { meetingDate, participants, meetingNotes, title, tasks: initialTasks } = req.body;
  if (!meetingDate || !participants || !meetingNotes) {
    return res.status(400).json({ error: 'Missing required core fields: meetingDate, participants, meetingNotes are mandatory.' });
  }
  const meetingId = generateId('meet');
  const now = new Date().toISOString();
  const parsedTasks: Task[] = Array.isArray(initialTasks)
    ? initialTasks.map((t: any, index: number) => {
        const rawAssignees = Array.isArray(t.assignees)
          ? t.assignees
          : (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        const resolvedAssignee = rawAssignees.length > 0
          ? rawAssignees.join(', ')
          : String(t.assignee || (participants[0] || 'Unassigned')).trim();
        const resolvedAssignees = rawAssignees.length > 0 ? rawAssignees : [resolvedAssignee];

        return {
          id: generateId(`task-${index + 1}`),
          meetingId,
          title: String(t.title || 'Untitled Action Item').trim(),
          assignee: resolvedAssignee,
          assignees: resolvedAssignees,
          dueDate: String(t.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
          status: (['To Do', 'In Progress', 'Done', 'Pending Approval'].includes(t.status) ? t.status : 'To Do') as TaskStatus,
          createdAt: now,
          updatedAt: now
        };
      })
    : [];

  const newMeeting: Meeting = {
    id: meetingId,
    title: title ? String(title).trim() : `Meeting on ${meetingDate}`,
    meetingDate: String(meetingDate).trim(),
    participants: Array.isArray(participants) ? participants.map(p => String(p).trim()).filter(Boolean) : [String(participants)],
    meetingNotes: String(meetingNotes).trim(),
    tasks: parsedTasks,
    createdAt: now,
    updatedAt: now,
  };

  // Sync to Supabase if connected
  if (supabase) {
    try {
      await supabase.from('meetings').insert([{
        id: newMeeting.id,
        title: newMeeting.title,
        meeting_date: newMeeting.meetingDate,
        participants: newMeeting.participants,
        meeting_notes: newMeeting.meetingNotes,
        created_at: newMeeting.createdAt,
        updated_at: newMeeting.updatedAt,
      }]);
      if (parsedTasks.length > 0) {
        await supabase.from('tasks').insert(parsedTasks.map(t => ({
          id: t.id,
          meeting_id: newMeeting.id,
          title: t.title,
          assignee: t.assignee,
          due_date: t.dueDate,
          status: t.status,
          created_at: t.createdAt,
          updated_at: t.updatedAt
        })));
      }
    } catch (err: any) {
      console.warn('Supabase meeting creation sync warning:', err?.message);
    }
  }

  meetings.unshift(newMeeting);
  res.status(201).json(newMeeting);
});

router.put('/meetings/:id', async (req, res) => {
  let meetingIndex = meetings.findIndex(m => m.id === req.params.id);
  if (meetingIndex === -1 && supabase) {
    await syncMeetingsFromSupabase();
    meetingIndex = meetings.findIndex(m => m.id === req.params.id);
  }
  if (meetingIndex === -1) return res.status(404).json({ error: 'Meeting not found' });
  const existing = meetings[meetingIndex];
  const { meetingDate, participants, meetingNotes, title } = req.body;
  const updated: Meeting = {
    ...existing,
    meetingDate: meetingDate ? String(meetingDate).trim() : existing.meetingDate,
    participants: Array.isArray(participants) ? participants.map(p => String(p).trim()).filter(Boolean) : existing.participants,
    meetingNotes: meetingNotes !== undefined ? String(meetingNotes) : existing.meetingNotes,
    title: title ? String(title).trim() : existing.title,
    updatedAt: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from('meetings').update({
        title: updated.title,
        meeting_date: updated.meetingDate,
        participants: updated.participants,
        meeting_notes: updated.meetingNotes,
        updated_at: updated.updatedAt
      }).eq('id', updated.id);
    } catch (err: any) {
      console.warn('Supabase meeting update warning:', err?.message);
    }
  }

  meetings[meetingIndex] = updated;
  res.json(updated);
});

// DELETE /api/meetings/:id - Menghapus data meeting dan tugas terkait dari Supabase & memori
router.delete('/meetings/:id', async (req, res) => {
  const meetingId = req.params.id;
  let supabaseDeleted = false;
  let supabaseError: string | null = null;

  // 1. Hapus dari Supabase jika koneksi aktif
  if (supabase) {
    try {
      // Hapus tasks terkait (1:N relationship)
      const { error: tasksErr } = await supabase.from('tasks').delete().eq('meeting_id', meetingId);
      if (tasksErr) {
        console.warn('Supabase tasks delete warning:', tasksErr.message);
      }

      // Hapus row meeting
      const { error: mErr } = await supabase.from('meetings').delete().eq('id', meetingId);
      if (mErr) {
        supabaseError = mErr.message;
        console.warn('Supabase meeting delete warning:', mErr.message);
      } else {
        supabaseDeleted = true;
      }
    } catch (err: any) {
      supabaseError = err?.message || 'Unknown error';
      console.error('Supabase delete error:', err);
    }
  }

  // 2. Hapus dari in-memory state
  const meetingIndex = meetings.findIndex(m => m.id === meetingId);
  if (meetingIndex !== -1) {
    meetings.splice(meetingIndex, 1);
  }

  res.json({
    message: 'Meeting and associated tasks deleted successfully',
    id: meetingId,
    supabaseDeleted,
    supabaseError: supabaseError || undefined
  });
});

router.get('/tasks', async (req, res) => {
  const { meetingId, status, assignee, search } = req.query;

  if (supabase) {
    try {
      let query = supabase
        .from('tasks')
        .select('*, meetings(title, meeting_date)')
        .order('due_date', { ascending: true });

      if (meetingId) query = query.eq('meeting_id', String(meetingId));
      if (status) query = query.eq('status', String(status));
      if (assignee) query = query.ilike('assignee', `%${assignee}%`);
      if (search) query = query.ilike('title', `%${search}%`);

      const { data: dbTasks, error } = await query;
      if (!error && Array.isArray(dbTasks)) {
        const formatted = dbTasks.map((t: any) => ({
          id: t.id,
          meetingId: t.meeting_id,
          title: t.title,
          assignee: t.assignee,
          assignees: t.assignees || (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
          dueDate: t.due_date,
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          meetingTitle: t.meetings?.title || `Meeting ${t.meetings?.meeting_date || ''}`,
          meetingDate: t.meetings?.meeting_date || '',
        }));
        return res.json(formatted);
      }
    } catch (err: any) {
      console.warn('Supabase get tasks error:', err?.message);
    }
  }

  let allTasks: Array<Task & { meetingTitle: string; meetingDate: string }> = [];
  for (const meeting of meetings) {
    for (const task of meeting.tasks || []) {
      allTasks.push({
        ...task,
        meetingTitle: meeting.title || `Meeting ${meeting.meetingDate}`,
        meetingDate: meeting.meetingDate,
      });
    }
  }
  if (meetingId) allTasks = allTasks.filter(t => t.meetingId === String(meetingId));
  if (status) allTasks = allTasks.filter(t => t.status === String(status));
  if (assignee) {
    const targetAssignee = String(assignee).toLowerCase();
    allTasks = allTasks.filter(t =>
      (t.assignee && t.assignee.toLowerCase().includes(targetAssignee)) ||
      (Array.isArray(t.assignees) && t.assignees.some(a => a.toLowerCase().includes(targetAssignee)))
    );
  }
  if (search) {
    const s = String(search).toLowerCase();
    allTasks = allTasks.filter(t =>
      t.title.toLowerCase().includes(s) ||
      (t.assignee && t.assignee.toLowerCase().includes(s)) ||
      (Array.isArray(t.assignees) && t.assignees.some(a => a.toLowerCase().includes(s)))
    );
  }
  allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  res.json(allTasks);
});

// Ensure virtual general-tasks meeting exists (for standalone tasks)
async function ensureGeneralMeeting(): Promise<Meeting> {
  let generalMeeting = meetings.find(m => m.id === 'general-tasks');
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  if (!generalMeeting) {
    generalMeeting = {
      id: 'general-tasks',
      title: 'Tugas Mandiri',
      meetingDate: today,
      participants: [],
      meetingNotes: 'Tugas umum tanpa rapat',
      tasks: [],
      createdAt: now,
      updatedAt: now,
    };
    meetings.push(generalMeeting);

    if (supabase) {
      try {
        const { data: existing } = await supabase.from('meetings').select('id').eq('id', 'general-tasks').single();
        if (!existing) {
          await supabase.from('meetings').insert([{
            id: 'general-tasks',
            title: 'Tugas Mandiri',
            meeting_date: today,
            participants: [],
            meeting_notes: 'Tugas umum tanpa rapat',
            created_at: now,
            updated_at: now,
          }]);
        }
      } catch (err: any) {
        console.warn('Supabase ensure general meeting warning:', err?.message);
      }
    }
  }

  return generalMeeting;
}

// POST /api/tasks - Create a standalone task (tanpa rapat wajib)
router.post('/tasks', async (req, res) => {
  const { title, assignee, dueDate, status, meetingId } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'Title and due date are required.' });

  let targetMeeting: Meeting | undefined;
  if (meetingId && meetingId !== 'general-tasks') {
    targetMeeting = meetings.find(m => m.id === meetingId);
  }
  if (!targetMeeting) {
    targetMeeting = await ensureGeneralMeeting();
  }

  const rawAssignees = Array.isArray(req.body.assignees)
    ? req.body.assignees
    : (assignee ? String(assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  const resolvedAssignee = rawAssignees.length > 0
    ? rawAssignees.join(', ')
    : String(assignee || (targetMeeting.participants[0] || 'Unassigned')).trim();
  const resolvedAssignees = rawAssignees.length > 0 ? rawAssignees : [resolvedAssignee];

  const now = new Date().toISOString();
  const newTask: Task = {
    id: generateId('task'),
    meetingId: targetMeeting.id,
    title: String(title).trim(),
    assignee: resolvedAssignee,
    assignees: resolvedAssignees,
    dueDate: String(dueDate).trim(),
    dueTime: req.body.dueTime ? String(req.body.dueTime).trim() : undefined,
    status: (['To Do', 'In Progress', 'Done', 'Pending Approval'].includes(status) ? status : 'To Do') as TaskStatus,
    priority: (['Low', 'Medium', 'High'].includes(req.body.priority) ? req.body.priority : 'Medium') as any,
    description: req.body.description ? String(req.body.description).trim() : undefined,
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    createdAt: now,
    updatedAt: now,
  };

  if (supabase) {
    try {
      await supabase.from('tasks').insert([{
        id: newTask.id,
        meeting_id: newTask.meetingId,
        title: newTask.title,
        assignee: newTask.assignee,
        due_date: newTask.dueDate,
        status: newTask.status,
        created_at: newTask.createdAt,
        updated_at: newTask.updatedAt
      }]);
    } catch (err: any) {
      console.warn('Supabase task insert warning:', err?.message);
    }
  }

  targetMeeting.tasks.push(newTask);
  targetMeeting.updatedAt = now;
  res.status(201).json(newTask);
});

router.post('/meetings/:meetingId/tasks', async (req, res) => {
  const meetingId = req.params.meetingId;
  let meeting: Meeting | undefined;
  if (meetingId === 'general-tasks') {
    meeting = await ensureGeneralMeeting();
  } else {
    meeting = meetings.find(m => m.id === meetingId);
  }
  if (!meeting) return res.status(404).json({ error: 'Parent meeting not found' });
  const { title, assignee, dueDate, status } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'Title and due date are required.' });

  const rawAssignees = Array.isArray(req.body.assignees)
    ? req.body.assignees
    : (assignee ? String(assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  const resolvedAssignee = rawAssignees.length > 0
    ? rawAssignees.join(', ')
    : String(assignee || (meeting.participants[0] || 'Unassigned')).trim();
  const resolvedAssignees = rawAssignees.length > 0 ? rawAssignees : [resolvedAssignee];

  const now = new Date().toISOString();
  const newTask: Task = {
    id: generateId('task'),
    meetingId: meeting.id,
    title: String(title).trim(),
    assignee: resolvedAssignee,
    assignees: resolvedAssignees,
    dueDate: String(dueDate).trim(),
    dueTime: req.body.dueTime ? String(req.body.dueTime).trim() : undefined,
    status: (['To Do', 'In Progress', 'Done', 'Pending Approval'].includes(status) ? status : 'To Do') as TaskStatus,
    priority: (['Low', 'Medium', 'High'].includes(req.body.priority) ? req.body.priority : 'Medium') as any,
    description: req.body.description ? String(req.body.description).trim() : undefined,
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    createdAt: now,
    updatedAt: now,
  };

  if (supabase) {
    try {
      await supabase.from('tasks').insert([{
        id: newTask.id,
        meeting_id: newTask.meetingId,
        title: newTask.title,
        assignee: newTask.assignee,
        due_date: newTask.dueDate,
        status: newTask.status,
        created_at: newTask.createdAt,
        updated_at: newTask.updatedAt
      }]);
    } catch (err: any) {
      console.warn('Supabase task insert warning:', err?.message);
    }
  }

  meeting.tasks.push(newTask);
  meeting.updatedAt = now;
  res.status(201).json(newTask);
});

router.post('/tasks/:taskId/submit', async (req, res) => {
  const { taskId } = req.params;
  const { notes, attachments } = req.body as SubmitTaskInput;

  let targetMeeting: Meeting | undefined;
  let targetTask: Task | undefined;
  for (const m of meetings) {
    const found = m.tasks.find(t => t.id === taskId);
    if (found) {
      targetMeeting = m;
      targetTask = found;
      break;
    }
  }

  // Fallback: sync from Supabase if not in memory
  if (!targetTask && supabase) {
    try {
      await syncMeetingsFromSupabase();
      for (const m of meetings) {
        const found = m.tasks.find(t => t.id === taskId);
        if (found) {
          targetMeeting = m;
          targetTask = found;
          break;
        }
      }
    } catch {}
  }

  // Fallback: standalone task lookup in Supabase
  if (!targetTask && supabase) {
    try {
      const { data: sbTask } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (sbTask) {
        targetTask = {
          id: sbTask.id,
          meetingId: sbTask.meeting_id,
          title: sbTask.title,
          assignee: sbTask.assignee,
          dueDate: sbTask.due_date,
          status: sbTask.status,
          createdAt: sbTask.created_at,
          updatedAt: sbTask.updated_at,
        };
      }
    } catch {}
  }

  if (!targetTask) return res.status(404).json({ error: 'Task not found' });
  if (!notes || !attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return res.status(400).json({ error: 'Submission must include notes and at least one attachment.' });
  }

  const now = new Date().toISOString();
  const submission: TaskSubmission = {
    id: generateId('submission'),
    taskId: targetTask.id,
    assignee: targetTask.assignee,
    notes: String(notes).trim(),
    attachments,
    status: 'pending',
    submittedAt: now,
  };

  submissions.push(submission);
  targetTask.status = 'Pending Approval';
  targetTask.updatedAt = now;

  if (targetMeeting) {
    if (!targetMeeting.tasks) targetMeeting.tasks = [];
    const idx = targetMeeting.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      targetMeeting.tasks[idx] = { ...targetTask, status: 'Pending Approval', updatedAt: now };
    } else {
      targetMeeting.tasks.push(targetTask);
    }
    targetMeeting.updatedAt = now;
  } else {
    let generalMeeting = meetings.find(m => m.id === 'general-tasks');
    if (!generalMeeting) {
      generalMeeting = {
        id: 'general-tasks',
        title: 'Tugas Mandiri',
        meetingDate: now.split('T')[0],
        participants: [],
        meetingNotes: 'Wadah otomatis tugas mandiri',
        tasks: [],
        createdAt: now,
        updatedAt: now,
      };
      meetings.push(generalMeeting);
    }
    const idx = generalMeeting.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      generalMeeting.tasks[idx] = { ...targetTask, status: 'Pending Approval', updatedAt: now };
    } else {
      generalMeeting.tasks.push(targetTask);
    }
  }

  if (supabase) {
    try {
      const { error: taskErr } = await supabase.from('tasks').update({ status: 'Pending Approval', updated_at: now }).eq('id', taskId);
      if (taskErr) {
        console.warn('Supabase tasks.update status warning:', taskErr.message);
      }
      const { error: subErr } = await supabase.from('task_submissions').upsert({
        id: submission.id,
        task_id: submission.taskId,
        assignee: submission.assignee,
        notes: submission.notes,
        attachments: submission.attachments,
        status: submission.status,
        submitted_at: submission.submittedAt,
      });
      if (subErr) {
        console.warn('Supabase task_submissions.upsert warning:', subErr.message);
      }
    } catch (err: any) {
      console.warn('Supabase submit warning:', err?.message);
    }
  }

  res.status(201).json(submission);
});

router.get('/tasks/:taskId/submissions', async (req, res) => {
  const { taskId } = req.params;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', taskId)
        .order('submitted_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: TaskSubmission[] = data.map((s: any) => ({
          id: s.id,
          taskId: s.task_id,
          assignee: s.assignee,
          notes: s.notes || '',
          attachments: s.attachments || [],
          status: s.status || 'pending',
          submittedAt: s.submitted_at,
          reviewedBy: s.reviewed_by,
          reviewedAt: s.reviewed_at,
          reviewNote: s.review_note
        }));
        return res.json(mapped);
      }
    } catch (err: any) {
      console.warn('Supabase read task_submissions warning:', err?.message);
    }
  }
  const taskSubmissions = submissions.filter(s => s.taskId === taskId);
  res.json(taskSubmissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
});

router.post('/tasks/:taskId/approve', async (req, res) => {
  const { taskId } = req.params;
  const { submissionId, reviewNote } = req.body;

  let targetMeeting: Meeting | undefined;
  let targetTask: Task | undefined;
  for (const m of meetings) {
    const found = m.tasks.find(t => t.id === taskId);
    if (found) {
      targetMeeting = m;
      targetTask = found;
      break;
    }
  }
  if (!targetTask && supabase) {
    try {
      await syncMeetingsFromSupabase();
      for (const m of meetings) {
        const found = m.tasks.find(t => t.id === taskId);
        if (found) {
          targetMeeting = m;
          targetTask = found;
          break;
        }
      }
    } catch {}
  }
  if (!targetTask && supabase) {
    try {
      const { data: sbTask } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (sbTask) {
        targetTask = {
          id: sbTask.id,
          meetingId: sbTask.meeting_id,
          title: sbTask.title,
          assignee: sbTask.assignee,
          dueDate: sbTask.due_date,
          status: sbTask.status,
          createdAt: sbTask.created_at,
          updatedAt: sbTask.updated_at,
        };
      }
    } catch {}
  }
  if (!targetTask) return res.status(404).json({ error: 'Task not found' });

  let submission = submissions.find(s => (s.id === submissionId || s.taskId === taskId) && s.status === 'pending');
  if (!submission && supabase) {
    try {
      const { data: sbSub } = await supabase.from('task_submissions').select('*').eq('id', submissionId).maybeSingle();
      if (sbSub) {
        submission = {
          id: sbSub.id,
          taskId: sbSub.task_id,
          assignee: sbSub.assignee,
          notes: sbSub.notes,
          attachments: sbSub.attachments,
          status: sbSub.status,
          submittedAt: sbSub.submitted_at,
        };
        submissions.push(submission);
      }
    } catch {}
  }

  const now = new Date().toISOString();
  if (submission) {
    submission.status = 'approved';
    submission.reviewedBy = 'admin';
    submission.reviewedAt = now;
    submission.reviewNote = reviewNote;
  }

  targetTask.status = 'Done';
  targetTask.updatedAt = now;
  if (targetMeeting) {
    if (!targetMeeting.tasks) targetMeeting.tasks = [];
    const idx = targetMeeting.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      targetMeeting.tasks[idx] = { ...targetTask, status: 'Done', updatedAt: now };
    } else {
      targetMeeting.tasks.push(targetTask);
    }
    targetMeeting.updatedAt = now;
  } else {
    const generalMeeting = meetings.find(m => m.id === 'general-tasks');
    if (generalMeeting) {
      const idx = generalMeeting.tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        generalMeeting.tasks[idx] = { ...targetTask, status: 'Done', updatedAt: now };
      }
    }
  }

  if (supabase) {
    try {
      await supabase.from('tasks').update({ status: 'Done', updated_at: now }).eq('id', taskId);
      if (submissionId) {
        await supabase.from('task_submissions').update({
          status: 'approved',
          reviewed_by: 'admin',
          reviewed_at: now,
          review_note: reviewNote,
        }).eq('id', submissionId);
      }
    } catch (err: any) {
      console.warn('Supabase approve warning:', err?.message);
    }
  }

  res.json(targetTask);
});

router.post('/tasks/:taskId/reject', async (req, res) => {
  const { taskId } = req.params;
  const { submissionId, reviewNote } = req.body;

  if (!reviewNote) {
    return res.status(400).json({ error: 'Review note is required for rejection.' });
  }

  let targetMeeting: Meeting | undefined;
  let targetTask: Task | undefined;
  for (const m of meetings) {
    const found = m.tasks.find(t => t.id === taskId);
    if (found) {
      targetMeeting = m;
      targetTask = found;
      break;
    }
  }
  if (!targetTask && supabase) {
    try {
      await syncMeetingsFromSupabase();
      for (const m of meetings) {
        const found = m.tasks.find(t => t.id === taskId);
        if (found) {
          targetMeeting = m;
          targetTask = found;
          break;
        }
      }
    } catch {}
  }
  if (!targetTask && supabase) {
    try {
      const { data: sbTask } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (sbTask) {
        targetTask = {
          id: sbTask.id,
          meetingId: sbTask.meeting_id,
          title: sbTask.title,
          assignee: sbTask.assignee,
          dueDate: sbTask.due_date,
          status: sbTask.status,
          createdAt: sbTask.created_at,
          updatedAt: sbTask.updated_at,
        };
      }
    } catch {}
  }
  if (!targetTask) return res.status(404).json({ error: 'Task not found' });

  let submission = submissions.find(s => (s.id === submissionId || s.taskId === taskId) && s.status === 'pending');
  if (!submission && supabase) {
    try {
      const { data: sbSub } = await supabase.from('task_submissions').select('*').eq('id', submissionId).maybeSingle();
      if (sbSub) {
        submission = {
          id: sbSub.id,
          taskId: sbSub.task_id,
          assignee: sbSub.assignee,
          notes: sbSub.notes,
          attachments: sbSub.attachments,
          status: sbSub.status,
          submittedAt: sbSub.submitted_at,
        };
        submissions.push(submission);
      }
    } catch {}
  }

  const now = new Date().toISOString();
  if (submission) {
    submission.status = 'rejected';
    submission.reviewedBy = 'admin';
    submission.reviewedAt = now;
    submission.reviewNote = reviewNote;
  }

  targetTask.status = 'In Progress';
  targetTask.updatedAt = now;
  if (targetMeeting) {
    if (!targetMeeting.tasks) targetMeeting.tasks = [];
    const idx = targetMeeting.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      targetMeeting.tasks[idx] = { ...targetTask, status: 'In Progress', updatedAt: now };
    } else {
      targetMeeting.tasks.push(targetTask);
    }
    targetMeeting.updatedAt = now;
  } else {
    const generalMeeting = meetings.find(m => m.id === 'general-tasks');
    if (generalMeeting) {
      const idx = generalMeeting.tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        generalMeeting.tasks[idx] = { ...targetTask, status: 'In Progress', updatedAt: now };
      }
    }
  }

  if (supabase) {
    try {
      await supabase.from('tasks').update({ status: 'In Progress', updated_at: now }).eq('id', taskId);
      if (submissionId) {
        await supabase.from('task_submissions').update({
          status: 'rejected',
          reviewed_by: 'admin',
          reviewed_at: now,
          review_note: reviewNote,
        }).eq('id', submissionId);
      }
    } catch (err: any) {
      console.warn('Supabase reject warning:', err?.message);
    }
  }

  res.json(targetTask);
});

router.put('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  const { title, assignee, dueDate, dueTime, status, priority, description, tags } = req.body;
  const now = new Date().toISOString();

  let targetMeeting: Meeting | undefined;
  let targetTask: Task | undefined;

  // 1. Cari di memori
  for (const m of meetings) {
    const found = (m.tasks || []).find(t => t.id === taskId);
    if (found) {
      targetMeeting = m;
      targetTask = found;
      break;
    }
  }

  // 2. Jika tidak ada di memori dan Supabase terhubung, sinkronkan dari database
  if (!targetTask && supabase) {
    await syncMeetingsFromSupabase();
    for (const m of meetings) {
      const found = (m.tasks || []).find(t => t.id === taskId);
      if (found) {
        targetMeeting = m;
        targetTask = found;
        break;
      }
    }
  }

  // 3. Jika masih belum ditemukan di memori tapi Supabase aktif, cari langsung di tabel tasks
  if (!targetTask && supabase) {
    try {
      const { data: dbTask, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (dbTask && !error) {
        targetTask = {
          id: dbTask.id,
          meetingId: dbTask.meeting_id,
          title: dbTask.title,
          assignee: dbTask.assignee,
          assignees: dbTask.assignees || (dbTask.assignee ? String(dbTask.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
          dueDate: dbTask.due_date,
          dueTime: dbTask.due_time,
          status: dbTask.status,
          priority: dbTask.priority,
          description: dbTask.description,
          tags: dbTask.tags || [],
          createdAt: dbTask.created_at,
          updatedAt: dbTask.updated_at
        };
        targetMeeting = meetings.find(m => m.id === dbTask.meeting_id);
        if (targetMeeting) {
          if (!targetMeeting.tasks) targetMeeting.tasks = [];
          targetMeeting.tasks.push(targetTask);
        }
      }
    } catch (err: any) {
      console.warn('Supabase single task query warning:', err?.message);
    }
  }

  // Jika tetap tidak ditemukan sama sekali
  if (!targetTask) {
    return res.status(404).json({ error: `Task dengan id '${taskId}' tidak ditemukan di server.` });
  }

  // 4. Update data task
  if (title !== undefined) targetTask.title = String(title).trim();
  if (assignee !== undefined || req.body.assignees !== undefined) {
    if (Array.isArray(req.body.assignees)) {
      targetTask.assignees = req.body.assignees;
      targetTask.assignee = req.body.assignees.join(', ');
    } else {
      targetTask.assignee = String(assignee).trim();
      targetTask.assignees = targetTask.assignee.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (dueDate !== undefined) targetTask.dueDate = String(dueDate).trim();
  if (dueTime !== undefined) targetTask.dueTime = String(dueTime).trim();
  if (status !== undefined) {
    if (['To Do', 'In Progress', 'Done', 'Pending Approval'].includes(status)) {
      targetTask.status = status as TaskStatus;
    } else {
      console.warn('Invalid status provided to updateTask:', status);
    }
  }
  if (priority !== undefined) targetTask.priority = priority;
  if (description !== undefined) targetTask.description = description;
  if (Array.isArray(tags)) targetTask.tags = tags;
  targetTask.updatedAt = now;
  if (targetMeeting) targetMeeting.updatedAt = now;

  // 5. Update ke Supabase jika aktif
  if (supabase) {
    try {
      const updateData: any = {
        title: targetTask.title,
        assignee: targetTask.assignee,
        due_date: targetTask.dueDate,
        status: targetTask.status,
        updated_at: targetTask.updatedAt
      };
      const { error: sbErr } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', targetTask.id);

      if (sbErr) {
        console.error('Supabase task update error:', sbErr);
        if (targetTask.status === 'Pending Approval' && (sbErr.message?.includes('chk_task_status') || sbErr.message?.includes('check constraint'))) {
          console.warn('Supabase check constraint prevented writing Pending Approval to tasks table. Handled gracefully.');
          return res.json(targetTask);
        }
        return res.status(500).json({ error: sbErr.message || 'Gagal menyimpan perubahan ke database Supabase.' });
      }
    } catch (err: any) {
      console.error('Supabase task update exception:', err);
      return res.status(500).json({ error: err?.message || 'Terjadi kesalahan saat menghubungi database.' });
    }
  }

  return res.json(targetTask);
});

// DELETE /api/tasks/:id - Menghapus data task dari Supabase & memori
router.delete('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;

  if (supabase) {
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
    } catch (err: any) {
      console.warn('Supabase task delete warning:', err?.message);
    }
  }

  let targetMeeting: Meeting | undefined;
  let taskIndex = -1;
  for (const m of meetings) {
    const idx = (m.tasks || []).findIndex(t => t.id === taskId);
    if (idx !== -1) {
      targetMeeting = m;
      taskIndex = idx;
      break;
    }
  }

  if (targetMeeting && taskIndex !== -1) {
    targetMeeting.tasks.splice(taskIndex, 1);
    targetMeeting.updatedAt = new Date().toISOString();
  }

  return res.json({ message: 'Task deleted successfully', id: taskId });
});


router.post('/ai/extract', async (req, res) => {
  const { rawText, fallbackDate } = req.body;
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'rawText is required for AI extraction.' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  const todayStr = new Date().toISOString().split('T')[0];

  if (!apiKey) {
    const fallbackResult = parseHeuristicMeeting(rawText, fallbackDate || todayStr);
    return res.json({
      ...fallbackResult,
      isAiGenerated: false,
      notice: 'Parsed using local pattern extractor.'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Extract meeting details into JSON with title, meetingDate (${fallbackDate || todayStr}), participants (array), meetingNotes, tasks (array of {title, assignee, dueDate, status}).\nText:\n${rawText}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    const parsedJson = JSON.parse(response.text?.trim() || '{}');
    return res.json({ ...parsedJson, isAiGenerated: true });
  } catch (error: any) {
    const fallbackResult = parseHeuristicMeeting(rawText, fallbackDate || todayStr);
    return res.json({
      ...fallbackResult,
      isAiGenerated: false,
      notice: `AI unavailable (${error.message || '503'}). Using heuristic parser.`
    });
  }
});

function parseHeuristicMeeting(text: string, defaultDate: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const title = lines[0] ? lines[0].replace(/^[#*\-=\s]+/, '').slice(0, 80) : 'Rapat Koordinasi';
  const participants: string[] = [];
  const participantLine = lines.find(l => /peserta|participants|attendees|hadir/i.test(l));
  if (participantLine) {
    const rawP = participantLine.replace(/^.*?(peserta|participants|attendees|hadir)[\s:=-]+/i, '');
    rawP.split(/[,;\/&]|\bdan\b|\band\b/i).forEach(p => {
      const clean = p.trim();
      if (clean && clean.length > 1) participants.push(clean);
    });
  }
  if (participants.length === 0) participants.push('Tim Proyek', 'Budi Santoso');

  const tasks: Array<{ title: string; assignee: string; dueDate: string; status: TaskStatus }> = [];
  const actionLines = lines.filter(l => /^(?:[-*•]|\d+\.)|\b(todo|action item|tugas|tindak lanjut|deadline|pic)\b/i.test(l));
  const dueDateDefault = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  actionLines.slice(0, 5).forEach((line, idx) => {
    const cleanTitle = line.replace(/^[-*•\d.\s]+/, '').trim();
    if (cleanTitle.length > 5) {
      tasks.push({
        title: cleanTitle,
        assignee: participants[idx % participants.length] || 'Tim',
        dueDate: dueDateDefault,
        status: 'To Do'
      });
    }
  });

  if (tasks.length === 0) {
    tasks.push({
      title: 'Tindak lanjut hasil rapat dan koordinasi implementasi',
      assignee: participants[0] || 'Koordinator',
      dueDate: dueDateDefault,
      status: 'To Do'
    });
  }

  return { title, meetingDate: defaultDate, participants, meetingNotes: text, tasks };
}

// Division Supabase Sync
async function syncDivisionsFromSupabase(): Promise<Division[]> {
  if (!supabase) return divisions;
  try {
    const { data: dbDivisions, error } = await supabase
      .from('divisions')
      .select('*')
      .order('name', { ascending: true });

    if (!error && Array.isArray(dbDivisions)) {
      if (dbDivisions.length > 0) {
        divisions = dbDivisions.map((d: any) => ({
          id: d.id,
          name: d.name,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        return divisions;
      } else if (divisions.length > 0) {
        // Table exists in Supabase but is empty: seed in-memory initial divisions to Supabase
        const now = new Date().toISOString();
        const records = divisions.map(d => ({
          id: d.id,
          name: d.name,
          created_at: d.createdAt || now,
          updated_at: d.updatedAt || now,
        }));
        await supabase.from('divisions').insert(records);
      }
    }
  } catch (err: any) {
    console.warn('Supabase divisions sync warning:', err?.message);
  }
  return divisions;
}

// Division CRUD
router.get('/divisions', async (req, res) => {
  const data = await syncDivisionsFromSupabase();
  res.json(data);
});

router.post('/divisions', async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Division name is required' });
  const trimmedName = String(name).trim();
  const now = new Date().toISOString();
  const division: Division = {
    id: generateId('div'),
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
  };
  divisions.push(division);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('divisions')
        .insert([{
          id: division.id,
          name: division.name,
          created_at: division.createdAt,
          updated_at: division.updatedAt
        }])
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Supabase insert division warning:', error.message);
      } else if (data) {
        division.id = data.id || division.id;
      }
    } catch (err: any) {
      console.warn('Supabase insert division error:', err?.message);
    }
  }

  res.status(201).json(division);
});

router.put('/divisions/:id', async (req, res) => {
  const idx = divisions.findIndex(d => d.id === req.params.id);
  const { name } = req.body;
  const now = new Date().toISOString();
  if (idx !== -1 && name !== undefined) {
    divisions[idx].name = String(name).trim();
    divisions[idx].updatedAt = now;
  }

  if (supabase) {
    try {
      await supabase.from('divisions').update({
        name: String(name).trim(),
        updated_at: now
      }).eq('id', req.params.id);
    } catch (err: any) {
      console.warn('Supabase update division warning:', err?.message);
    }
  }

  if (idx === -1) return res.status(404).json({ error: 'Division not found' });
  res.json(divisions[idx]);
});

router.delete('/divisions/:id', async (req, res) => {
  const idx = divisions.findIndex(d => d.id === req.params.id);
  if (idx !== -1) divisions.splice(idx, 1);

  if (supabase) {
    try {
      await supabase.from('divisions').delete().eq('id', req.params.id);
    } catch (err: any) {
      console.warn('Supabase delete division warning:', err?.message);
    }
  }

  res.json({ message: 'Division deleted', id: req.params.id });
});

// User Supabase Sync
async function syncUsersFromSupabase(): Promise<User[]> {
  if (!supabase) return users;
  try {
    const { data: dbUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('username', { ascending: true });

    if (!error && Array.isArray(dbUsers)) {
      if (dbUsers.length > 0) {
        users = dbUsers.map((u: any) => ({
          id: u.id,
          username: u.username,
          password: u.password,
          divisionId: u.division_id || u.divisionId || '',
          role: u.role || 'user',
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        }));
        return users;
      } else if (users.length > 0) {
        // Table exists in Supabase but is empty: seed in-memory initial users to Supabase
        const now = new Date().toISOString();
        const records = users.map(u => ({
          id: u.id,
          username: u.username,
          password: u.password,
          division_id: u.divisionId || null,
          role: u.role,
          created_at: u.createdAt || now,
          updated_at: u.updatedAt || now,
        }));
        await supabase.from('users').insert(records);
      }
    }
  } catch (err: any) {
    console.warn('Supabase users sync warning:', err?.message);
  }
  return users;
}

// User CRUD
router.get('/users', async (req, res) => {
  await syncUsersFromSupabase();
  const safeUsers = users.map(({ password, ...u }) => ({ ...u }));
  res.json(safeUsers);
});

router.post('/users', async (req, res) => {
  const { username, password, divisionId, role } = req.body;
  if (!username || !password || !divisionId) {
    return res.status(400).json({ error: 'Username, password, and division are required' });
  }
  if (users.some(u => u.username.toLowerCase() === String(username).trim().toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const now = new Date().toISOString();
  const user: User = {
    id: generateId('user'),
    username: String(username).trim(),
    password: String(password),
    divisionId: String(divisionId),
    role: ['admin', 'user'].includes(role) ? role : 'user',
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          username: user.username,
          password: user.password,
          division_id: user.divisionId,
          role: user.role,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }])
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Supabase insert user warning:', error.message);
      } else if (data) {
        user.id = data.id || user.id;
      }
    } catch (err: any) {
      console.warn('Supabase insert user error:', err?.message);
    }
  }

  const { password: _pwd, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.put('/users/:id', async (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  const { username, password, divisionId, role } = req.body;
  const now = new Date().toISOString();
  if (idx !== -1) {
    if (username !== undefined) users[idx].username = String(username).trim();
    if (password !== undefined) users[idx].password = String(password);
    if (divisionId !== undefined) users[idx].divisionId = String(divisionId);
    if (role !== undefined && ['admin', 'user'].includes(role)) users[idx].role = role;
    users[idx].updatedAt = now;
  }

  if (supabase) {
    try {
      const updates: any = { updated_at: now };
      if (username !== undefined) updates.username = String(username).trim();
      if (password !== undefined) updates.password = String(password);
      if (divisionId !== undefined) updates.division_id = String(divisionId);
      if (role !== undefined) updates.role = role;
      await supabase.from('users').update(updates).eq('id', req.params.id);
    } catch (err: any) {
      console.warn('Supabase update user warning:', err?.message);
    }
  }

  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const { password: _pwd, ...safeUser } = users[idx];
  res.json(safeUser);
});

router.delete('/users/:id', async (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx !== -1) users.splice(idx, 1);

  if (supabase) {
    try {
      await supabase.from('users').delete().eq('id', req.params.id);
    } catch (err: any) {
      console.warn('Supabase delete user warning:', err?.message);
    }
  }

  res.json({ message: 'User deleted', id: req.params.id });
});

// Auth
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  await syncUsersFromSupabase();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase() && u.password === String(password));
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  const { password: _pwd, ...safeUser } = user;
  res.json({ user: safeUser, token: generateId('token') });
});

// Support both /api/... and root-relative routes (e.g. if Vercel strips /api during rewrites)
app.use('/api', router);
app.use(router);

// Seed initial data
function seedInitialData() {
  if (divisions.length === 0) {
    const initialDivisions = [
      { id: 'div-1', name: 'REI' },
      { id: 'div-2', name: 'LM' },
      { id: 'div-3', name: 'Sosmed' },
      { id: 'div-4', name: 'PH' },
      { id: 'div-5', name: 'Maps' },
    ];
    divisions.push(...initialDivisions);
  }

  if (users.length === 0) {
    const initialUsers = [
      { id: 'user-1', username: 'rizki', password: 'r@jaemas123', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-2', username: 'ajeng', password: 'r@jaemas123', divisionId: 'div-2', role: 'user' as const },
      { id: 'user-3', username: 'annisa', password: 'r@jaemas123', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-4', username: 'Dinda', password: 'r@jaemas123', divisionId: 'div-5', role: 'user' as const },
      { id: 'user-5', username: 'Devi', password: 'r@jaemas123', divisionId: 'div-3', role: 'user' as const },
      { id: 'user-6', username: 'Hanif', password: 'r@jaemas123', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-7', username: 'Sonia', password: 'r@jaemas123', divisionId: 'div-1', role: 'user' as const },
      { id: 'user-8', username: 'Azka', password: 'r@jaemas123', divisionId: 'div-4', role: 'user' as const },
    ];
    users.push(...initialUsers);
  }
}

seedInitialData();

// Serve static frontend in production (Vercel)
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Service-Worker-Allowed', '/');
        } else if (filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        }
      },
    })
  );
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;
