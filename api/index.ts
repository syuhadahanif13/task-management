import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked';

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

export interface Meeting {
  id: string;
  meetingDate: string;
  participants: string[];
  meetingNotes: string;
  tasks: Task[];
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

const app = express();

app.use(express.json({ limit: '10mb' }));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// In-memory data store (clean state)
let meetings: Meeting[] = [];

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

router.get('/meetings', async (req, res) => {
  if (supabase) {
    try {
      const { data: dbMeetings, error } = await supabase
        .from('meetings')
        .select('*, tasks(*)')
        .order('meeting_date', { ascending: false });

      if (!error && Array.isArray(dbMeetings)) {
        const formatted: Meeting[] = dbMeetings.map((m: any) => ({
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
            dueDate: t.due_date,
            status: t.status,
            createdAt: t.created_at,
            updatedAt: t.updated_at
          }))
        }));
        return res.json(formatted);
      }
    } catch (err: any) {
      console.warn('Supabase read fallback to memory:', err?.message);
    }
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
    ? initialTasks.map((t: any, index: number) => ({
        id: generateId(`task-${index + 1}`),
        meetingId,
        title: String(t.title || 'Untitled Action Item').trim(),
        assignee: String(t.assignee || (participants[0] || 'Unassigned')).trim(),
        dueDate: String(t.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
        status: (['To Do', 'In Progress', 'Done', 'Blocked'].includes(t.status) ? t.status : 'To Do') as TaskStatus,
        createdAt: now,
        updatedAt: now
      }))
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
  const meetingIndex = meetings.findIndex(m => m.id === req.params.id);
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
  if (assignee) allTasks = allTasks.filter(t => t.assignee.toLowerCase().includes(String(assignee).toLowerCase()));
  if (search) {
    const s = String(search).toLowerCase();
    allTasks = allTasks.filter(t => t.title.toLowerCase().includes(s) || t.assignee.toLowerCase().includes(s));
  }
  allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  res.json(allTasks);
});

router.post('/meetings/:meetingId/tasks', async (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: 'Parent meeting not found' });
  const { title, assignee, dueDate, status } = req.body;
  if (!title || !dueDate) return res.status(400).json({ error: 'Title and due date are required.' });
  const now = new Date().toISOString();
  const newTask: Task = {
    id: generateId('task'),
    meetingId: meeting.id,
    title: String(title).trim(),
    assignee: String(assignee || (meeting.participants[0] || 'Unassigned')).trim(),
    dueDate: String(dueDate).trim(),
    status: (['To Do', 'In Progress', 'Done', 'Blocked'].includes(status) ? status : 'To Do') as TaskStatus,
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

router.put('/tasks/:id', async (req, res) => {
  let targetMeeting: Meeting | undefined;
  let targetTask: Task | undefined;
  for (const m of meetings) {
    const found = m.tasks.find(t => t.id === req.params.id);
    if (found) {
      targetMeeting = m;
      targetTask = found;
      break;
    }
  }
  if (!targetMeeting || !targetTask) return res.status(404).json({ error: 'Task not found' });
  const { title, assignee, dueDate, status } = req.body;
  const now = new Date().toISOString();
  if (title !== undefined) targetTask.title = String(title).trim();
  if (assignee !== undefined) targetTask.assignee = String(assignee).trim();
  if (dueDate !== undefined) targetTask.dueDate = String(dueDate).trim();
  if (status !== undefined && ['To Do', 'In Progress', 'Done', 'Blocked'].includes(status)) {
    targetTask.status = status as TaskStatus;
  }
  targetTask.updatedAt = now;
  targetMeeting.updatedAt = now;

  if (supabase) {
    try {
      await supabase.from('tasks').update({
        title: targetTask.title,
        assignee: targetTask.assignee,
        due_date: targetTask.dueDate,
        status: targetTask.status,
        updated_at: targetTask.updatedAt
      }).eq('id', targetTask.id);
    } catch (err: any) {
      console.warn('Supabase task update warning:', err?.message);
    }
  }

  res.json(targetTask);
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
    const idx = m.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      targetMeeting = m;
      taskIndex = idx;
      break;
    }
  }
  if (!targetMeeting || taskIndex === -1) return res.status(404).json({ error: 'Task not found' });
  const removed = targetMeeting.tasks.splice(taskIndex, 1)[0];
  targetMeeting.updatedAt = new Date().toISOString();
  res.json({ message: 'Task deleted successfully', id: removed.id });
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

// Support both /api/... and root-relative routes (e.g. if Vercel strips /api during rewrites)
app.use('/api', router);
app.use(router);

export default app;
