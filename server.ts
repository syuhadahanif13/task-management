import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { Task, Meeting, TaskStatus } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initial seed data adhering strictly to the 4 core fields:
// 1. Meeting Date (Tanggal Rapat)
// 2. Participants (Peserta)
// 3. Meeting Notes/Minutes (Catatan)
// 4. Tasks (Action items: title, assignee, due date, status)
let meetings: Meeting[] = [
  {
    id: 'meet-101',
    title: 'Q3 Product Strategy & Roadmap Alignment',
    meetingDate: '2026-09-10',
    participants: ['Sarah Jenkins (Product Lead)', 'Budi Pratama (Tech Lead)', 'Dewi Lestari (UX Designer)', 'Alex Rivera (DevOps)'],
    meetingNotes: `Agenda Pembahasan:\n1. Peninjauan performa rilis Q2: Latensi backend turun 35%, namun retensi pengguna baru perlu ditingkatkan.\n2. Inisiatif modul kolaborasi real-time untuk rilis Q3.\n3. Rencana migrasi cloud infrastructure ke multi-region high-availability.\n\nKesepakatan Utama:\n- Dewi akan menyelesaikan wireframe alur kerja kolaborasi pada akhir pekan ini.\n- Budi dan Alex menyusun arsitektur WebSocket and pub/sub cluster.\n- Sarah mempersiapkan metrik KPI dan presentasi untuk stakeholder manajemen.`,
    createdAt: new Date('2026-09-10T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-10T11:30:00Z').toISOString(),
    tasks: [
      {
        id: 'task-101-1',
        meetingId: 'meet-101',
        title: 'Selesaikan prototype interaktif UI kolaborasi di Figma',
        assignee: 'Dewi Lestari (UX Designer)',
        dueDate: '2026-09-18',
        status: 'In Progress',
        createdAt: '2026-09-10T11:30:00Z',
      },
      {
        id: 'task-101-2',
        meetingId: 'meet-101',
        title: 'Buat dokumen RFC arsitektur WebSocket & cluster pub/sub',
        assignee: 'Budi Pratama (Tech Lead)',
        dueDate: '2026-09-22',
        status: 'To Do',
        createdAt: '2026-09-10T11:30:00Z',
      },
      {
        id: 'task-101-3',
        meetingId: 'meet-101',
        title: 'Estimasi biaya infrastruktur multi-region failover di Cloud Run',
        assignee: 'Alex Rivera (DevOps)',
        dueDate: '2026-09-20',
        status: 'Done',
        createdAt: '2026-09-10T11:30:00Z',
      },
      {
        id: 'task-101-4',
        meetingId: 'meet-101',
        title: 'Finalisasi slide deck KPI eksekutif untuk Q3 Board Review',
        assignee: 'Sarah Jenkins (Product Lead)',
        dueDate: '2026-09-15',
        status: 'In Progress',
        createdAt: '2026-09-10T11:30:00Z',
      }
    ]
  },
  {
    id: 'meet-102',
    title: 'Rapat Koordinasi Evaluasi Keamanan & Kepatuhan Data',
    meetingDate: '2026-09-12',
    participants: ['Budi Pratama (Tech Lead)', 'Fajar Ramadhan (Security Analyst)', 'Siti Rahma (Compliance Officer)'],
    meetingNotes: `Fokus Pertemuan:\n- Audit kepatuhan standar keamanan data (ISO 27001 & UU Perlindungan Data Pribadi).\n- Peninjauan enkripsi at-rest dan in-transit pada database transaksi.\n- Simulasi audit eksternal kuartal depan.\n\nCatatan Penting:\nSemua endpoint publik harus divalidasi dengan rate-limiting ketat. Audit log akses pengguna wajib disimpan dengan retention policy minimal 1 tahun.`,
    createdAt: new Date('2026-09-12T14:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-12T15:15:00Z').toISOString(),
    tasks: [
      {
        id: 'task-102-1',
        meetingId: 'meet-102',
        title: 'Lakukan vulnerability scanning berkala pada repository utama',
        assignee: 'Fajar Ramadhan (Security Analyst)',
        dueDate: '2026-09-19',
        status: 'In Progress',
        createdAt: '2026-09-12T15:15:00Z',
      },
      {
        id: 'task-102-2',
        meetingId: 'meet-102',
        title: 'Perbarui dokumen kebijakan privasi dan consent management',
        assignee: 'Siti Rahma (Compliance Officer)',
        dueDate: '2026-09-25',
        status: 'To Do',
        createdAt: '2026-09-12T15:15:00Z',
      },
      {
        id: 'task-102-3',
        meetingId: 'meet-102',
        title: 'Implementasi automated log rotation dan cold storage backup',
        assignee: 'Budi Pratama (Tech Lead)',
        dueDate: '2026-09-21',
        status: 'Blocked',
        createdAt: '2026-09-12T15:15:00Z',
      }
    ]
  },
  {
    id: 'meet-103',
    title: 'Sprint Retrospective & Performance Tuning Sync',
    meetingDate: '2026-09-08',
    participants: ['Sarah Jenkins (Product Lead)', 'Budi Pratama (Tech Lead)', 'Dewi Lestari (UX Designer)'],
    meetingNotes: `Ringkasan Diskusi:\n- Apa yang berjalan baik: Delivery fitur onboarding tepat waktu, feedback pengguna awal positif.\n- Yang perlu ditingkatkan: Terdapat bottleneck pada query reporting dashboard ketika filter tanggal luas dipilih.\n- Tindakan pencegahan: Tambahkan indexing komposit dan caching Redis untuk agregat data.`,
    createdAt: new Date('2026-09-08T09:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-08T10:00:00Z').toISOString(),
    tasks: [
      {
        id: 'task-103-1',
        meetingId: 'meet-103',
        title: 'Optimasi query laporan dengan composite index pada created_at & status',
        assignee: 'Budi Pratama (Tech Lead)',
        dueDate: '2026-09-14',
        status: 'Done',
        createdAt: '2026-09-08T10:00:00Z',
      },
      {
        id: 'task-103-2',
        meetingId: 'meet-103',
        title: 'Review user feedback telemetry untuk perbaikan micro-copy modal',
        assignee: 'Dewi Lestari (UX Designer)',
        dueDate: '2026-09-16',
        status: 'Done',
        createdAt: '2026-09-08T10:00:00Z',
      }
    ]
  }
];

// Helper to generate unique IDs
function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

// ---------------- REST API Routes ----------------

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/schema - Architectural Inspector Endpoint
app.get('/api/schema', (req, res) => {
  res.json({
    architecture: 'Meeting-Driven Action Item Management System',
    relationship: 'One-to-Many (Meeting 1 ---> * Tasks)',
    coreFields: {
      meetingDate: {
        name: 'Meeting Date (Tanggal Rapat)',
        type: 'DATE / ISO-8601 string (YYYY-MM-DD)',
        description: 'Chronological timestamp of when the meeting was conducted.',
        required: true,
      },
      participants: {
        name: 'Participants (Peserta)',
        type: 'ARRAY<STRING>',
        description: 'List of attendees present in the meeting.',
        required: true,
      },
      meetingNotes: {
        name: 'Meeting Notes / Minutes (Catatan)',
        type: 'TEXT / MARKDOWN',
        description: 'Verbatim or summarized minutes of meeting deliberations.',
        required: true,
      },
      tasks: {
        name: 'Tasks (Action items: title, assignee, due date, status)',
        type: 'COLLECTION OF TASKS (foreign key: meetingId -> meetings.id)',
        attributes: {
          title: 'STRING (Judul Tindakan)',
          assignee: 'STRING (Penanggung Jawab, linked to participants)',
          dueDate: 'DATE (YYYY-MM-DD) (Tenggat Waktu)',
          status: 'ENUM ("To Do" | "In Progress" | "Done" | "Blocked")'
        },
        required: true,
      }
    },
    sqlSchema: `
CREATE TABLE meetings (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,              -- 1. Meeting Date (Tanggal Rapat)
  participants TEXT[] NOT NULL,            -- 2. Participants (Peserta)
  meeting_notes TEXT NOT NULL,             -- 3. Meeting Notes (Catatan)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id VARCHAR(64) PRIMARY KEY,
  meeting_id VARCHAR(64) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, -- One-to-Many FK
  title VARCHAR(255) NOT NULL,             -- 4a. Action Item Title
  assignee VARCHAR(128) NOT NULL,          -- 4b. Assignee (Penanggung Jawab)
  due_date DATE NOT NULL,                  -- 4c. Due Date (Tenggat Waktu)
  status VARCHAR(32) NOT NULL              -- 4d. Status ('To Do', 'In Progress', 'Done', 'Blocked')
    CHECK (status IN ('To Do', 'In Progress', 'Done', 'Blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_meeting_id ON tasks(meeting_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
    `.trim()
  });
});

// GET /api/meetings
app.get('/api/meetings', (req, res) => {
  // Sort descending by meetingDate
  const sorted = [...meetings].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  res.json(sorted);
});

// GET /api/meetings/:id
app.get('/api/meetings/:id', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  res.json(meeting);
});

// POST /api/meetings
app.post('/api/meetings', (req, res) => {
  const { meetingDate, participants, meetingNotes, title, tasks: initialTasks } = req.body;

  if (!meetingDate || !participants || !meetingNotes) {
    return res.status(400).json({
      error: 'Missing required core fields: meetingDate (Tanggal Rapat), participants (Peserta), and meetingNotes (Catatan) are mandatory.'
    });
  }

  const meetingId = generateId('meet');
  const now = new Date().toISOString();

  // Normalize tasks adhering to the One-to-Many relationship
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

  meetings.unshift(newMeeting);
  res.status(201).json(newMeeting);
});

// PUT /api/meetings/:id
app.put('/api/meetings/:id', (req, res) => {
  const meetingIndex = meetings.findIndex(m => m.id === req.params.id);
  if (meetingIndex === -1) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const existing = meetings[meetingIndex];
  const { meetingDate, participants, meetingNotes, title } = req.body;

  const updated: Meeting = {
    ...existing,
    meetingDate: meetingDate ? String(meetingDate).trim() : existing.meetingDate,
    participants: Array.isArray(participants)
      ? participants.map(p => String(p).trim()).filter(Boolean)
      : existing.participants,
    meetingNotes: meetingNotes !== undefined ? String(meetingNotes) : existing.meetingNotes,
    title: title ? String(title).trim() : existing.title,
    updatedAt: new Date().toISOString(),
  };

  meetings[meetingIndex] = updated;
  res.json(updated);
});

// DELETE /api/meetings/:id
app.delete('/api/meetings/:id', (req, res) => {
  const meetingIndex = meetings.findIndex(m => m.id === req.params.id);
  if (meetingIndex === -1) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const removed = meetings.splice(meetingIndex, 1)[0];
  res.json({ message: 'Meeting and its associated action items deleted successfully', id: removed.id });
});

// GET /api/tasks (cross-meeting query or filtered)
app.get('/api/tasks', (req, res) => {
  const { meetingId, status, assignee, search } = req.query;

  let allTasks: Array<Task & { meetingTitle: string; meetingDate: string }> = [];
  for (const meeting of meetings) {
    for (const task of meeting.tasks) {
      allTasks.push({
        ...task,
        meetingTitle: meeting.title || `Meeting ${meeting.meetingDate}`,
        meetingDate: meeting.meetingDate,
      });
    }
  }

  if (meetingId) {
    allTasks = allTasks.filter(t => t.meetingId === String(meetingId));
  }
  if (status) {
    allTasks = allTasks.filter(t => t.status === String(status));
  }
  if (assignee) {
    allTasks = allTasks.filter(t => t.assignee.toLowerCase().includes(String(assignee).toLowerCase()));
  }
  if (search) {
    const s = String(search).toLowerCase();
    allTasks = allTasks.filter(t => t.title.toLowerCase().includes(s) || t.assignee.toLowerCase().includes(s));
  }

  // Sort by due date ascending
  allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  res.json(allTasks);
});

// POST /api/meetings/:meetingId/tasks - Create action item for specific meeting (1 to Many)
app.post('/api/meetings/:meetingId/tasks', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.meetingId);
  if (!meeting) {
    return res.status(404).json({ error: 'Parent meeting not found' });
  }

  const { title, assignee, dueDate, status } = req.body;
  if (!title || !dueDate) {
    return res.status(400).json({ error: 'Title and due date are required for an action item task.' });
  }

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

  meeting.tasks.push(newTask);
  meeting.updatedAt = now;

  res.status(201).json(newTask);
});

// PUT /api/tasks/:id - Update action item
app.put('/api/tasks/:id', (req, res) => {
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

  if (!targetMeeting || !targetTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

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

  res.json(targetTask);
});

// DELETE /api/tasks/:id - Delete an action item
app.delete('/api/tasks/:id', (req, res) => {
  let targetMeeting: Meeting | undefined;
  let taskIndex = -1;

  for (const m of meetings) {
    const idx = m.tasks.findIndex(t => t.id === req.params.id);
    if (idx !== -1) {
      targetMeeting = m;
      taskIndex = idx;
      break;
    }
  }

  if (!targetMeeting || taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const removed = targetMeeting.tasks.splice(taskIndex, 1)[0];
  targetMeeting.updatedAt = new Date().toISOString();

  res.json({ message: 'Task deleted successfully', id: removed.id });
});

// ---------------- AI Meeting Processing (Gemini API) ----------------
// POST /api/ai/extract
// Extracts the 4 core fields from raw notes or transcripts:
// 1. Meeting Date (Tanggal Rapat)
// 2. Participants (Peserta)
// 3. Meeting Notes/Minutes (Catatan)
// 4. Tasks (Action items: title, assignee, due date, status)
app.post('/api/ai/extract', async (req, res) => {
  const { rawText, fallbackDate } = req.body;

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'rawText is required for AI meeting extraction.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const todayStr = new Date().toISOString().split('T')[0];

  if (!apiKey) {
    // If API key is not yet provided, provide a high quality rule-based heuristic extraction
    const fallbackResult = parseHeuristicMeeting(rawText, fallbackDate || todayStr);
    return res.json({
      ...fallbackResult,
      isAiGenerated: false,
      notice: 'Parsed using local pattern extractor. Connect GEMINI_API_KEY for advanced neural extraction.'
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `You are an expert full-stack AI system architect specializing in meeting-to-task data pipelines.
Analyze the following meeting transcript, raw notes, or minutes (which may be in English or Bahasa Indonesia).
Strictly extract and format data adhering to the 4 core fields:
1. Meeting Date (Tanggal Rapat): Format strictly as YYYY-MM-DD. If unspecified, assume ${fallbackDate || todayStr}.
2. Participants (Peserta): Array of distinct attendee names and their titles if mentioned.
3. Meeting Notes/Minutes (Catatan): Clear, well-structured, formatted minutes synthesizing key discussions, context, and decisions.
4. Tasks (Action items): Concrete action items identified from the meeting. Each item MUST have:
   - title: concise action oriented title (e.g. "Draft security policy", "Implement API rate-limiter")
   - assignee: name of the responsible person (must match one of the participants if mentioned, or general title)
   - dueDate: realistic deadline in YYYY-MM-DD format (if relative like 'next Friday' or 'end of week', calculate from meeting date)
   - status: strictly one of "To Do", "In Progress", "Done", "Blocked" (default "To Do" for new action items)

Also provide a concise 'title' for the meeting.

INPUT MEETING TEXT:
"""
${rawText}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Concise title of the meeting' },
            meetingDate: { type: Type.STRING, description: 'Meeting date in YYYY-MM-DD format (Tanggal Rapat)' },
            participants: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of participants/attendees (Peserta)'
            },
            meetingNotes: { type: Type.STRING, description: 'Meeting notes/minutes summary (Catatan)' },
            tasks: {
              type: Type.ARRAY,
              description: 'Extracted action items (One-to-Many Tasks)',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Action item title' },
                  assignee: { type: Type.STRING, description: 'Assignee person name' },
                  dueDate: { type: Type.STRING, description: 'Due date in YYYY-MM-DD' },
                  status: {
                    type: Type.STRING,
                    enum: ['To Do', 'In Progress', 'Done', 'Blocked'],
                    description: 'Status of the action item'
                  }
                },
                required: ['title', 'assignee', 'dueDate', 'status']
              }
            }
          },
          required: ['title', 'meetingDate', 'participants', 'meetingNotes', 'tasks']
        }
      }
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');
    return res.json({
      ...parsedJson,
      isAiGenerated: true
    });
  } catch (error: any) {
    console.error('Gemini extraction error:', error);
    // Graceful fallback to heuristic parsing
    const fallbackResult = parseHeuristicMeeting(rawText, fallbackDate || todayStr);
    return res.json({
      ...fallbackResult,
      isAiGenerated: false,
      notice: `AI processing encountered an error (${error.message || 'unknown'}). Falling back to rule-based parser.`
    });
  }
});

// Heuristic fallback parser for offline / test situations
function parseHeuristicMeeting(text: string, defaultDate: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const title = lines[0] ? lines[0].replace(/^[#*\-=\s]+/, '').slice(0, 80) : 'Rapat Koordinasi';
  
  // Try to find participants
  const participants: string[] = [];
  const participantLine = lines.find(l => /peserta|participants|attendees|hadir/i.test(l));
  if (participantLine) {
    const rawP = participantLine.replace(/^.*?(peserta|participants|attendees|hadir)[\s:=-]+/i, '');
    rawP.split(/[,;\/&]|\bdan\b|\band\b/i).forEach(p => {
      const clean = p.trim();
      if (clean && clean.length > 1) participants.push(clean);
    });
  }

  if (participants.length === 0) {
    participants.push('Tim Proyek', 'Budi Santoso');
  }

  // Extract action items from bullet points or keywords
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

  return {
    title,
    meetingDate: defaultDate,
    participants,
    meetingNotes: text,
    tasks
  };
}

// ---------------- Production / Vite Middleware ----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Task Management System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
