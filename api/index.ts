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

router.get('/supabase/config', (req, res) => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  res.json({
    configured: Boolean(url && (anonKey || process.env.SUPABASE_SERVICE_ROLE_KEY)),
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    hasServerClient: Boolean(supabase),
  });
});

router.get('/supabase/test', async (req, res) => {
  if (!supabase) {
    return res.json({
      connected: false,
      message: 'Supabase belum dikonfigurasi di server environment.',
      meetingsCount: 0,
      tasksCount: 0,
    });
  }

  try {
    const [mRes, tRes] = await Promise.all([
      supabase.from('meetings').select('count', { count: 'exact', head: true }),
      supabase.from('tasks').select('count', { count: 'exact', head: true }),
    ]);

    res.json({
      connected: !mRes.error || !tRes.error,
      meetingsCount: mRes.count ?? 0,
      tasksCount: tRes.count ?? 0,
      meetingsError: mRes.error ? mRes.error.message : null,
      tasksError: tRes.error ? tRes.error.message : null,
      message: (!mRes.error && !tRes.error) ? 'Terhubung normal ke tabel meetings dan tasks' : 'Terhubung sebagian / terdapat error tabel',
    });
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      error: err?.message || 'Error saat menghubungi Supabase',
    });
  }
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

const SYSTEM_SUBMISSIONS_MEETING_ID = 'system-task-submissions';
const SUBMISSION_DELIMITER = '__SUBMISSION_DATA__';

function isValidUuid(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

function generateSafeUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return 'a0000000-0000-0000-0000-000000000001';
}

function extractTaskDescription(desc?: string): string {
  if (!desc) return '';
  const idx = desc.indexOf(SUBMISSION_DELIMITER);
  if (idx >= 0) {
    return desc.substring(0, idx).trim();
  }
  return desc;
}

function extractTaskSubmissionFromDescription(desc?: string): TaskSubmission | null {
  if (!desc) return null;
  const idx = desc.indexOf(SUBMISSION_DELIMITER);
  if (idx < 0) return null;
  try {
    const jsonStr = desc.substring(idx + SUBMISSION_DELIMITER.length).trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      return parsed as TaskSubmission;
    }
    return null;
  } catch {
    return null;
  }
}

function embedTaskSubmissionIntoDescription(originalDesc: string = '', sub: TaskSubmission): string {
  const cleanDesc = extractTaskDescription(originalDesc);
  return `${cleanDesc}\n${SUBMISSION_DELIMITER}\n${JSON.stringify(sub)}`;
}

async function loadSubmissionsFromSupabase(sb: SupabaseClient): Promise<TaskSubmission[]> {
  // 1. Read from system meeting record in meetings table (use title query to avoid UUID syntax error on id)
  try {
    const { data: sysMeeting, error: smErr } = await sb
      .from('meetings')
      .select('meeting_notes')
      .eq('title', '__SYSTEM_TASK_SUBMISSIONS__')
      .maybeSingle();

    if (!smErr && sysMeeting && sysMeeting.meeting_notes) {
      try {
        const parsed = JSON.parse(sysMeeting.meeting_notes);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const existingIdx = submissions.findIndex(s => s.id === item.id || s.taskId === item.taskId || (item.taskTitle && s.taskTitle === item.taskTitle));
            if (existingIdx >= 0) {
              const existingAtt = Array.isArray(submissions[existingIdx].attachments) ? submissions[existingIdx].attachments : [];
              const itemAtt = Array.isArray(item.attachments) ? item.attachments : [];
              submissions[existingIdx] = {
                ...submissions[existingIdx],
                ...item,
                attachments: itemAtt.length > 0 ? itemAtt : existingAtt,
              };
            } else {
              submissions.push({
                ...item,
                attachments: Array.isArray(item.attachments) ? item.attachments : [],
              });
            }
          }
        }
      } catch (e) {
        console.warn('Failed parsing submissions from system-task-submissions:', e);
      }
    }
  } catch (e1: any) {
    console.warn('Step 1 loadSubmissionsFromSupabase warning:', e1?.message);
  }

  // 2. Also try reading from task_submissions table if available
  try {
    const { data: dbSubs, error: dbErr } = await sb
      .from('task_submissions')
      .select('*');

    if (!dbErr && Array.isArray(dbSubs)) {
      for (const s of dbSubs) {
        const item: TaskSubmission = {
          id: s.id,
          taskId: s.task_id,
          taskTitle: s.task_title,
          assignee: s.assignee,
          notes: s.notes || '',
          attachments: Array.isArray(s.attachments) ? s.attachments : [],
          status: s.status || 'pending',
          submittedAt: s.submitted_at,
          reviewedBy: s.reviewed_by,
          reviewedAt: s.reviewed_at,
          reviewNote: s.review_note
        };
        const existingIdx = submissions.findIndex(x => x.id === item.id || x.taskId === item.taskId);
        if (existingIdx >= 0) {
          const existingAtt = Array.isArray(submissions[existingIdx].attachments) ? submissions[existingIdx].attachments : [];
          submissions[existingIdx] = {
            ...submissions[existingIdx],
            ...item,
            attachments: item.attachments.length > 0 ? item.attachments : existingAtt,
          };
        } else {
          submissions.push(item);
        }
      }
    }
  } catch (e2: any) {
    console.warn('Step 2 loadSubmissionsFromSupabase warning:', e2?.message);
  }

  // 3. Read tasks table directly to extract submissions embedded in description (most reliable)
  try {
    const { data: dbTasks, error: taskErr } = await sb
      .from('tasks')
      .select('id, title, description, status');
    if (!taskErr && Array.isArray(dbTasks)) {
      for (const t of dbTasks) {
        const extracted = extractTaskSubmissionFromDescription(t.description);
        if (extracted) {
          if (!extracted.taskId) extracted.taskId = t.id;
          if (!extracted.taskTitle) extracted.taskTitle = t.title;
          const existingIdx = submissions.findIndex(x => x.id === extracted.id || x.taskId === t.id || (t.title && x.taskTitle === t.title));
          if (existingIdx >= 0) {
            const existingAtt = Array.isArray(submissions[existingIdx].attachments) ? submissions[existingIdx].attachments : [];
            const extAtt = Array.isArray(extracted.attachments) ? extracted.attachments : [];
            submissions[existingIdx] = {
              ...submissions[existingIdx],
              ...extracted,
              taskTitle: t.title,
              attachments: extAtt.length > 0 ? extAtt : existingAtt,
            };
          } else {
            submissions.push({ ...extracted, taskTitle: t.title });
          }
        }
      }
    }
  } catch (e3: any) {
    console.warn('Step 3 loadSubmissionsFromSupabase warning:', e3?.message);
  }

  return submissions;
}

async function saveSubmissionsToSupabase(sb: SupabaseClient, subs: TaskSubmission[]) {
  const nowIso = new Date().toISOString();

  // 1. Read existing submissions from Supabase system meeting
  let combined: TaskSubmission[] = [];
  try {
    const { data: sysMeeting } = await sb
      .from('meetings')
      .select('meeting_notes')
      .eq('title', '__SYSTEM_TASK_SUBMISSIONS__')
      .maybeSingle();

    if (sysMeeting && sysMeeting.meeting_notes) {
      try {
        const parsed = JSON.parse(sysMeeting.meeting_notes);
        if (Array.isArray(parsed)) combined = parsed;
      } catch {}
    }
  } catch {}

  // Merge in-memory submissions into combined
  for (const mem of submissions) {
    const idx = combined.findIndex(s => s.id === mem.id || (mem.taskId && s.taskId === mem.taskId) || (mem.taskTitle && s.taskTitle === mem.taskTitle));
    if (idx >= 0) {
      const existingAtt = Array.isArray(combined[idx].attachments) ? combined[idx].attachments : [];
      const memAtt = Array.isArray(mem.attachments) ? mem.attachments : [];
      combined[idx] = {
        ...combined[idx],
        ...mem,
        attachments: memAtt.length > 0 ? memAtt : existingAtt,
      };
    } else {
      combined.push(mem);
    }
  }

  // Merge incoming subs into combined
  for (const sub of subs) {
    const idx = combined.findIndex(s => s.id === sub.id || (sub.taskId && s.taskId === sub.taskId) || (sub.taskTitle && s.taskTitle === sub.taskTitle));
    if (idx >= 0) {
      const existingAtt = Array.isArray(combined[idx].attachments) ? combined[idx].attachments : [];
      const subAtt = Array.isArray(sub.attachments) ? sub.attachments : [];
      combined[idx] = {
        ...combined[idx],
        ...sub,
        attachments: subAtt.length > 0 ? subAtt : existingAtt,
      };
    } else {
      combined.push(sub);
    }
  }

  // Update global in-memory submissions
  submissions = combined;

  const notesJson = JSON.stringify(combined);

  // 1. Save to meetings system record by title (UUID-safe)
  try {
    const { data: existingMeeting } = await sb
      .from('meetings')
      .select('id')
      .eq('title', '__SYSTEM_TASK_SUBMISSIONS__')
      .maybeSingle();

    if (existingMeeting) {
      await sb.from('meetings').update({
        title: '__SYSTEM_TASK_SUBMISSIONS__',
        meeting_date: '2000-01-01',
        participants: ['system'],
        meeting_notes: notesJson,
        updated_at: nowIso
      }).eq('id', existingMeeting.id);
    } else {
      await sb.from('meetings').insert([{
        id: generateSafeUuid(),
        title: '__SYSTEM_TASK_SUBMISSIONS__',
        meeting_date: '2000-01-01',
        participants: ['system'],
        meeting_notes: notesJson,
        created_at: nowIso,
        updated_at: nowIso
      }]);
    }
  } catch (err: any) {
    console.warn('saveSubmissionsToSupabase system meeting notice:', err?.message);
  }

  // 2. Embed submissions directly into tasks.description in Supabase for 100% resilient access
  for (const sub of subs) {
    try {
      let currTask: any = null;
      if (isValidUuid(sub.taskId)) {
        try {
          const { data } = await sb.from('tasks').select('id, description, title').eq('id', sub.taskId).maybeSingle();
          currTask = data;
        } catch {}
      }
      if (!currTask && (sub.taskTitle || sub.taskId)) {
        try {
          const searchTitle = sub.taskTitle || sub.taskId;
          const { data } = await sb.from('tasks').select('id, description, title').eq('title', searchTitle).limit(1).maybeSingle();
          currTask = data;
        } catch {}
      }
      if (currTask) {
        const updatedDesc = embedTaskSubmissionIntoDescription(currTask.description || '', sub);
        await sb.from('tasks').update({ description: updatedDesc, updated_at: nowIso }).eq('id', currTask.id);
      }
    } catch (e: any) {
      console.warn('Embed into task.description notice:', e?.message);
    }
  }

  // 3. Try saving to task_submissions table if it exists
  for (const sub of subs) {
    if (isValidUuid(sub.taskId) && Array.isArray(sub.attachments) && sub.attachments.length > 0) {
      try {
        await sb.from('task_submissions').upsert({
          id: isValidUuid(sub.id) ? sub.id : generateSafeUuid(),
          task_id: sub.taskId,
          assignee: sub.assignee || 'User',
          notes: sub.notes || '',
          attachments: sub.attachments,
          status: sub.status || 'pending',
          submitted_at: sub.submittedAt || nowIso,
        });
      } catch {}
    }
  }
}

async function updateTaskStatusInSupabase(sb: SupabaseClient, taskId: string, status: TaskStatus, description?: string) {
  const now = new Date().toISOString();
  const updatePayload: any = { updated_at: now };
  if (description !== undefined) updatePayload.description = description;

  if (isValidUuid(taskId)) {
    try {
      if (status === 'Pending Approval') {
        updatePayload.status = 'Pending Approval';
        const { error: err1 } = await sb.from('tasks').update(updatePayload).eq('id', taskId);
        if (err1) {
          console.warn('Supabase update Pending Approval rejected by constraint, using Blocked fallback:', err1.message);
          updatePayload.status = 'Blocked';
          const { error: err2 } = await sb.from('tasks').update(updatePayload).eq('id', taskId);
          if (err2) {
            console.warn('Supabase update Blocked fallback failed:', err2.message);
          }
        }
      } else {
        updatePayload.status = status;
        const { error } = await sb.from('tasks').update(updatePayload).eq('id', taskId);
        if (error) {
          console.warn(`Supabase update task status ${status} warning:`, error.message);
        }
      }
    } catch (err: any) {
      console.warn('Supabase updateTaskStatus error:', err?.message);
    }
  }
}

async function syncMeetingsFromSupabase(): Promise<Meeting[]> {
  if (!supabase) return meetings;
  try {
    // Sync submissions from Supabase system store and task_submissions table
    try {
      await loadSubmissionsFromSupabase(supabase);
    } catch (subErr: any) {
      console.warn('loadSubmissionsFromSupabase non-fatal warning:', subErr?.message);
    }

    let rawMeetings: any[] = [];
    let rawTasks: any[] = [];

    // Attempt 1: Try joined query (faster if foreign key exists)
    const { data: dbMeetings, error: joinErr } = await supabase
      .from('meetings')
      .select('*, tasks(*)')
      .order('meeting_date', { ascending: false });

    if (!joinErr && Array.isArray(dbMeetings) && dbMeetings.length > 0) {
      rawMeetings = dbMeetings;
    } else {
      if (joinErr) {
        console.warn('Supabase join query error (likely no foreign key constraint), falling back to independent queries:', joinErr.message);
      }
      // Attempt 2: Independent queries (100% resilient, independent of foreign key constraint!)
      const [mRes, tRes] = await Promise.all([
        supabase.from('meetings').select('*').order('meeting_date', { ascending: false }),
        supabase.from('tasks').select('*'),
      ]);

      if (!mRes.error && Array.isArray(mRes.data)) {
        const tasksByMeeting: Record<string, any[]> = {};
        if (!tRes.error && Array.isArray(tRes.data)) {
          rawTasks = tRes.data;
          for (const t of tRes.data) {
            const mId = t.meeting_id || 'general-tasks';
            if (!tasksByMeeting[mId]) tasksByMeeting[mId] = [];
            tasksByMeeting[mId].push(t);
          }
        }
        rawMeetings = mRes.data.map((m: any) => ({
          ...m,
          tasks: tasksByMeeting[m.id] || [],
        }));

        // Handle orphaned tasks
        const mIds = new Set(mRes.data.map((m: any) => m.id));
        const orphaned = rawTasks.filter((t: any) => !t.meeting_id || !mIds.has(t.meeting_id));
        if (orphaned.length > 0) {
          rawMeetings.push({
            id: 'general-tasks',
            title: 'Tugas Mandiri',
            meeting_date: new Date().toISOString().split('T')[0],
            participants: [],
            meeting_notes: 'Tugas umum tanpa rapat',
            tasks: orphaned,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } else if (mRes.error) {
        console.warn('Supabase meetings independent query failed:', mRes.error.message);
        if (!tRes.error && Array.isArray(tRes.data) && tRes.data.length > 0) {
          rawMeetings = [{
            id: 'general-tasks',
            title: 'Tugas Mandiri',
            meeting_date: new Date().toISOString().split('T')[0],
            participants: [],
            meeting_notes: 'Tugas tersimpan di Supabase',
            tasks: tRes.data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }];
        }
      }
    }

    // Collect all task IDs that have pending submissions
    const pendingTaskIdSet = new Set<string>();
    for (const s of submissions) {
      if (s.status === 'pending') {
        pendingTaskIdSet.add(s.taskId);
      }
    }
    for (const m of meetings) {
      for (const t of m.tasks || []) {
        if (t.status === 'Pending Approval') {
          pendingTaskIdSet.add(t.id);
        }
      }
    }

    if (Array.isArray(rawMeetings) && rawMeetings.length > 0) {
      const cleanDbMeetings = rawMeetings.filter(
        (m: any) => m.id !== SYSTEM_SUBMISSIONS_MEETING_ID && !String(m.id).startsWith('system-') && m.title !== '__SYSTEM_TASK_SUBMISSIONS__'
      );

      const formatted: Meeting[] = cleanDbMeetings.map((m: any) => ({
        id: m.id,
        title: m.title || `Meeting ${m.meeting_date || ''}`,
        meetingDate: m.meeting_date,
        participants: Array.isArray(m.participants) ? m.participants : [],
        meetingNotes: m.meeting_notes || '',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        tasks: (m.tasks || []).map((t: any) => {
          const isPending = pendingTaskIdSet.has(t.id) || t.status === 'Pending Approval' || t.status === 'Blocked';
          return {
            id: t.id,
            meetingId: t.meeting_id,
            title: t.title,
            assignee: t.assignee || 'Unassigned',
            assignees: t.assignees || (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
            dueDate: t.due_date,
            dueTime: t.due_time,
            status: isPending ? ('Pending Approval' as TaskStatus) : (t.status as TaskStatus),
            priority: t.priority || 'Medium',
            description: t.description || '',
            tags: t.tags || [],
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          };
        }),
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
          priority: t.priority || 'Medium',
          description: t.description || '',
          tags: t.tags || [],
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          meetingTitle: t.meetings?.title || (t.meetings?.meeting_date ? `Meeting ${t.meetings.meeting_date}` : 'Tugas Mandiri'),
          meetingDate: t.meetings?.meeting_date || '',
        }));
        return res.json(formatted);
      } else {
        // Fallback: Query tasks and meetings independently without foreign key requirement
        let fallbackQuery = supabase
          .from('tasks')
          .select('*')
          .order('due_date', { ascending: true });

        if (meetingId) fallbackQuery = fallbackQuery.eq('meeting_id', String(meetingId));
        if (status) fallbackQuery = fallbackQuery.eq('status', String(status));
        if (assignee) fallbackQuery = fallbackQuery.ilike('assignee', `%${assignee}%`);
        if (search) fallbackQuery = fallbackQuery.ilike('title', `%${search}%`);

        const [tRes, mRes] = await Promise.all([
          fallbackQuery,
          supabase.from('meetings').select('id, title, meeting_date'),
        ]);

        if (!tRes.error && Array.isArray(tRes.data)) {
          const mMap = new Map<string, any>();
          if (Array.isArray(mRes.data)) {
            for (const m of mRes.data) mMap.set(m.id, m);
          }

          const formatted = tRes.data.map((t: any) => {
            const m = mMap.get(t.meeting_id);
            return {
              id: t.id,
              meetingId: t.meeting_id,
              title: t.title,
              assignee: t.assignee,
              assignees: t.assignees || (t.assignee ? String(t.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []),
              dueDate: t.due_date,
              status: t.status,
              priority: t.priority || 'Medium',
              description: t.description || '',
              tags: t.tags || [],
              createdAt: t.created_at,
              updatedAt: t.updated_at,
              meetingTitle: m?.title || (m?.meeting_date ? `Meeting ${m.meeting_date}` : 'Tugas Mandiri'),
              meetingDate: m?.meeting_date || '',
            };
          });
          return res.json(formatted);
        }
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
        description: newTask.description,
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
        description: newTask.description,
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

  if (supabase) {
    try {
      await loadSubmissionsFromSupabase(supabase);
    } catch {}
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
    taskTitle: targetTask.title,
    assignee: targetTask.assignee,
    notes: String(notes).trim(),
    attachments,
    status: 'pending',
    submittedAt: now,
  };

  const existingSubIdx = submissions.findIndex(s => s.id === submission.id || s.taskId === taskId || (s.taskTitle && s.taskTitle === targetTask?.title));
  if (existingSubIdx >= 0) {
    submissions[existingSubIdx] = submission;
  } else {
    submissions.push(submission);
  }
  targetTask.status = 'Pending Approval';
  targetTask.updatedAt = now;
  targetTask.description = embedTaskSubmissionIntoDescription(targetTask.description || '', submission);

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
      await updateTaskStatusInSupabase(supabase, taskId, 'Pending Approval', targetTask.description);
      await saveSubmissionsToSupabase(supabase, submissions);
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

router.post('/tasks/:taskId/sync-submission', async (req, res) => {
  const { taskId } = req.params;
  const sub = req.body as TaskSubmission;
  if (!sub || !sub.attachments || sub.attachments.length === 0) {
    return res.status(400).json({ error: 'No attachments provided for sync' });
  }

  if (supabase) {
    try {
      await loadSubmissionsFromSupabase(supabase);
    } catch {}
  }

  let targetTask: Task | undefined;
  for (const m of meetings) {
    const f = m.tasks.find(t => t.id === taskId || (sub.taskTitle && t.title === sub.taskTitle));
    if (f) { targetTask = f; break; }
  }

  if (targetTask) {
    sub.taskTitle = targetTask.title;
    targetTask.description = embedTaskSubmissionIntoDescription(targetTask.description || '', sub);
  }

  const existingIdx = submissions.findIndex(s => s.id === sub.id || s.taskId === taskId || (targetTask && s.taskTitle === targetTask.title));
  if (existingIdx >= 0) {
    const existAtt = Array.isArray(submissions[existingIdx].attachments) ? submissions[existingIdx].attachments : [];
    const subAtt = Array.isArray(sub.attachments) ? sub.attachments : [];
    submissions[existingIdx] = {
      ...submissions[existingIdx],
      ...sub,
      attachments: subAtt.length > 0 ? subAtt : existAtt,
    };
  } else {
    submissions.push(sub);
  }

  if (supabase) {
    try {
      if (targetTask) {
        await updateTaskStatusInSupabase(supabase, targetTask.id, targetTask.status, targetTask.description);
      }
      await saveSubmissionsToSupabase(supabase, submissions);
      await supabase.from('task_submissions').upsert({
        id: sub.id,
        task_id: taskId,
        assignee: sub.assignee || 'User',
        notes: sub.notes || '',
        attachments: sub.attachments,
        status: sub.status || 'pending',
        submitted_at: sub.submittedAt || new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn('sync-submission Supabase save warning:', e?.message);
    }
  }

  res.json({ success: true, submission: submissions.find(s => s.id === sub.id || s.taskId === taskId) });
});

router.post('/submissions/sync-all', async (req, res) => {
  const incoming = req.body?.submissions;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  if (supabase) {
    await loadSubmissionsFromSupabase(supabase);
  }

  let updatedCount = 0;
  for (const sub of incoming) {
    if (!sub || !sub.attachments || sub.attachments.length === 0) continue;
    const existingIdx = submissions.findIndex(s => s.id === sub.id || (sub.taskId && s.taskId === sub.taskId) || (sub.taskTitle && s.taskTitle === sub.taskTitle));
    if (existingIdx >= 0) {
      const existAtt = Array.isArray(submissions[existingIdx].attachments) ? submissions[existingIdx].attachments : [];
      const subAtt = Array.isArray(sub.attachments) ? sub.attachments : [];
      submissions[existingIdx] = {
        ...submissions[existingIdx],
        ...sub,
        attachments: subAtt.length > 0 ? subAtt : existAtt,
      };
    } else {
      submissions.push(sub);
    }
    updatedCount++;
  }

  if (supabase) {
    await saveSubmissionsToSupabase(supabase, incoming);
  }

  res.json({ success: true, count: updatedCount });
});

router.get('/tasks/:taskId/submissions', async (req, res) => {
  const { taskId } = req.params;
  const queryTitle = (req.query.title as string) || '';
  let targetTask: Task | undefined;

  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId || (queryTitle && t.title === queryTitle));
    if (f) { targetTask = f; break; }
  }

  if (supabase) {
    try {
      await loadSubmissionsFromSupabase(supabase);

      if (!targetTask) {
        if (isValidUuid(taskId)) {
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
                description: sbTask.description,
                createdAt: sbTask.created_at,
                updatedAt: sbTask.updated_at,
              };
            }
          } catch {}
        }
        if (!targetTask && queryTitle) {
          try {
            const { data: sbTaskByTitle } = await supabase.from('tasks').select('*').eq('title', queryTitle).limit(1).maybeSingle();
            if (sbTaskByTitle) {
              targetTask = {
                id: sbTaskByTitle.id,
                meetingId: sbTaskByTitle.meeting_id,
                title: sbTaskByTitle.title,
                assignee: sbTaskByTitle.assignee,
                dueDate: sbTaskByTitle.due_date,
                status: sbTaskByTitle.status,
                description: sbTaskByTitle.description,
                createdAt: sbTaskByTitle.created_at,
                updatedAt: sbTaskByTitle.updated_at,
              };
            }
          } catch {}
        }
      }

      const validId = isValidUuid(taskId) ? taskId : (targetTask && isValidUuid(targetTask.id) ? targetTask.id : null);
      if (validId) {
        try {
          const { data, error } = await supabase
            .from('task_submissions')
            .select('*')
            .eq('task_id', validId)
            .order('submitted_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        for (const s of data) {
          const item: TaskSubmission = {
            id: s.id,
            taskId: s.task_id,
            taskTitle: targetTask?.title,
            assignee: s.assignee,
            notes: s.notes || '',
            attachments: Array.isArray(s.attachments) ? s.attachments : [],
            status: s.status || 'pending',
            submittedAt: s.submitted_at,
            reviewedBy: s.reviewed_by,
            reviewedAt: s.reviewed_at,
            reviewNote: s.review_note
          };
          const existingIdx = submissions.findIndex(x => x.id === item.id || x.taskId === item.taskId || (targetTask && x.taskTitle === targetTask.title));
          if (existingIdx >= 0) {
            const existingAtt = Array.isArray(submissions[existingIdx].attachments) ? submissions[existingIdx].attachments : [];
            submissions[existingIdx] = {
              ...submissions[existingIdx],
              ...item,
              attachments: item.attachments.length > 0 ? item.attachments : existingAtt,
            };
          } else {
            submissions.push(item);
          }
        }
      }
    } catch (err: any) {
      console.warn('Supabase read task_submissions warning:', err?.message);
    }
  }

  // Look up by taskId OR by taskTitle
  let rawList = submissions.filter(s =>
    s.taskId === taskId ||
    (targetTask && s.taskId === targetTask.id) ||
    (queryTitle && s.taskTitle && s.taskTitle === queryTitle) ||
    (targetTask && s.taskTitle && s.taskTitle === targetTask.title)
  );

  // If no submissions found OR none have attachments, check embedded submission in targetTask.description
  const hasValidAtt = rawList.some(s => Array.isArray(s.attachments) && s.attachments.length > 0);
  if (!hasValidAtt && targetTask?.description) {
    const embedded = extractTaskSubmissionFromDescription(targetTask.description);
    if (embedded && Array.isArray(embedded.attachments) && embedded.attachments.length > 0) {
      rawList.unshift(embedded);
    }
  }

  // If still empty or no attachments, search Supabase tasks directly for this title
  if (!rawList.some(s => Array.isArray(s.attachments) && s.attachments.length > 0) && (queryTitle || targetTask?.title) && supabase) {
    try {
      const searchTitle = queryTitle || targetTask?.title;
      const { data: dbTasks } = await supabase.from('tasks').select('*').eq('title', searchTitle).limit(5);
      if (Array.isArray(dbTasks)) {
        for (const t of dbTasks) {
          if (t.description) {
            const emb = extractTaskSubmissionFromDescription(t.description);
            if (emb && Array.isArray(emb.attachments) && emb.attachments.length > 0) {
              rawList.unshift(emb);
            }
          }
        }
      }
    } catch {}
  }

  // Consolidate submissions for this task: merge any duplicate records so attachments are preserved
  const consolidated: TaskSubmission[] = [];
  for (const s of rawList) {
    const existing = consolidated.find(c => c.id === s.id || c.taskId === s.taskId || (targetTask && c.taskTitle === targetTask.title));
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

  res.json(consolidated.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
});

router.post('/tasks/:taskId/approve', async (req, res) => {
  const { taskId } = req.params;
  const { submissionId, reviewNote } = req.body;

  if (supabase) {
    try {
      await loadSubmissionsFromSupabase(supabase);
    } catch (e: any) {
      console.warn('loadSubmissionsFromSupabase in approve warning:', e?.message);
    }
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
          description: sbTask.description,
          createdAt: sbTask.created_at,
          updatedAt: sbTask.updated_at,
        };
      }
    } catch {}
  }
  if (!targetTask) return res.status(404).json({ error: 'Task not found' });

  let submission = submissions.find(s => s.id === submissionId) ||
                   submissions.find(s => s.taskId === taskId && s.status === 'pending') ||
                   submissions.find(s => s.taskId === taskId) ||
                   submissions.find(s => s.taskTitle && s.taskTitle === targetTask?.title);
  if (!submission && targetTask?.description) {
    submission = extractTaskSubmissionFromDescription(targetTask.description) || undefined;
  }

  if (!submission && supabase) {
    try {
      const query = submissionId
        ? supabase.from('task_submissions').select('*').eq('id', submissionId).maybeSingle()
        : supabase.from('task_submissions').select('*').eq('task_id', taskId).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
      const { data: sbSub } = await query;
      if (sbSub) {
        submission = {
          id: sbSub.id,
          taskId: sbSub.task_id,
          taskTitle: targetTask.title,
          assignee: sbSub.assignee,
          notes: sbSub.notes,
          attachments: Array.isArray(sbSub.attachments) ? sbSub.attachments : [],
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
    submission.reviewNote = reviewNote || submission.reviewNote;
    submission.taskTitle = targetTask.title;
    targetTask.description = embedTaskSubmissionIntoDescription(targetTask.description || '', submission);
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
      await updateTaskStatusInSupabase(supabase, taskId, 'Done', targetTask.description);
      await saveSubmissionsToSupabase(supabase, submission ? [submission] : submissions);
      const subTargetId = submission?.id || submissionId;
      if (subTargetId) {
        await supabase.from('task_submissions').update({
          status: 'approved',
          reviewed_by: 'admin',
          reviewed_at: now,
          review_note: reviewNote,
        }).eq('id', subTargetId);
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

  if (supabase) {
    try {
      await loadSubmissionsFromSupabase(supabase);
    } catch (e: any) {
      console.warn('loadSubmissionsFromSupabase in reject warning:', e?.message);
    }
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

  let submission = submissions.find(s => s.id === submissionId) ||
                   submissions.find(s => s.taskId === taskId && s.status === 'pending') ||
                   submissions.find(s => s.taskId === taskId);
  if (!submission && supabase) {
    try {
      const query = submissionId
        ? supabase.from('task_submissions').select('*').eq('id', submissionId).maybeSingle()
        : supabase.from('task_submissions').select('*').eq('task_id', taskId).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
      const { data: sbSub } = await query;
      if (sbSub) {
        submission = {
          id: sbSub.id,
          taskId: sbSub.task_id,
          assignee: sbSub.assignee,
          notes: sbSub.notes,
          attachments: Array.isArray(sbSub.attachments) ? sbSub.attachments : [],
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
      await updateTaskStatusInSupabase(supabase, taskId, 'In Progress');
      await saveSubmissionsToSupabase(supabase, submission ? [submission] : submissions);
      const subTargetId = submission?.id || submissionId;
      if (subTargetId) {
        await supabase.from('task_submissions').update({
          status: 'rejected',
          reviewed_by: 'admin',
          reviewed_at: now,
          review_note: reviewNote,
        }).eq('id', subTargetId);
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
        description: targetTask.description,
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
