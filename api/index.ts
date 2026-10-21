import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

// ==========================================
// MySQL Adapter & Helpers (Self-Hosted)
// ==========================================
let mysqlPool: mysql.Pool | null = null;

export function isMysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_DATABASE &&
    process.env.MYSQL_USER
  );
}

export function getMysqlPool(): mysql.Pool | null {
  if (mysqlPool) return mysqlPool;
  if (!isMysqlConfigured()) return null;

  try {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    });
    return mysqlPool;
  } catch (err: any) {
    console.error('Failed to initialize MySQL pool:', err.message);
    return null;
  }
}

// In-memory cache for ultra-fast meeting data loads
let cachedMeetingsResponse: any[] | null = null;
let lastMeetingsCacheTime = 0;
const MEETINGS_CACHE_TTL_MS = 5000; // 5 seconds TTL

export function invalidateMeetingsCache() {
  cachedMeetingsResponse = null;
  lastMeetingsCacheTime = 0;
}

export async function mysqlGetMeetings(): Promise<any[]> {
  const now = Date.now();
  if (cachedMeetingsResponse && (now - lastMeetingsCacheTime < MEETINGS_CACHE_TTL_MS)) {
    return cachedMeetingsResponse;
  }

  const p = getMysqlPool();
  if (!p) return cachedMeetingsResponse || [];

  // Parallel query execution to cut round-trip latency
  const [[meetingsRows], [tasksRows]]: any = await Promise.all([
    p.query('SELECT * FROM meetings ORDER BY meeting_date DESC, created_at DESC;'),
    p.query('SELECT * FROM tasks ORDER BY due_date ASC, created_at ASC;'),
  ]);

  const tasksByMeeting: Record<string, any[]> = {};
  for (const t of tasksRows) {
    const mId = t.meeting_id || 'general-tasks';
    if (!tasksByMeeting[mId]) tasksByMeeting[mId] = [];

    let assignees = [t.assignee || 'Unassigned'];
    if (t.assignees) {
      try {
        assignees = typeof t.assignees === 'string' ? JSON.parse(t.assignees) : t.assignees;
      } catch {}
    }

    let tags: string[] = [];
    if (t.tags) {
      try {
        tags = typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags;
      } catch {}
    }

    let githubMetadata = undefined;
    if (t.github_metadata) {
      try {
        githubMetadata = typeof t.github_metadata === 'string' ? JSON.parse(t.github_metadata) : t.github_metadata;
      } catch {}
    }

    const dueDateStr = t.due_date instanceof Date
      ? t.due_date.toISOString().split('T')[0]
      : String(t.due_date || '').split('T')[0];

    tasksByMeeting[mId].push({
      id: t.id,
      meetingId: t.meeting_id,
      title: t.title,
      assignee: t.assignee,
      assignees: Array.isArray(assignees) ? assignees : [t.assignee],
      dueDate: dueDateStr,
      dueTime: t.due_time || undefined,
      status: t.status,
      priority: t.priority || 'Medium',
      description: t.description || '',
      tags: Array.isArray(tags) ? tags : [],
      githubRepo: t.github_repo || undefined,
      githubBranch: t.github_branch || undefined,
      githubPrUrl: t.github_pr_url || undefined,
      githubIssueUrl: t.github_issue_url || undefined,
      githubProjectUrl: t.github_project_url || undefined,
      githubMetadata,
      createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      updatedAt: t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString(),
    });
  }

  const meetings = meetingsRows.map((m: any) => {
    let participants: string[] = [];
    if (m.participants) {
      try {
        participants = typeof m.participants === 'string' ? JSON.parse(m.participants) : m.participants;
      } catch {
        participants = [String(m.participants)];
      }
    }

    const mDateStr = m.meeting_date instanceof Date
      ? m.meeting_date.toISOString().split('T')[0]
      : String(m.meeting_date || '').split('T')[0];

    return {
      id: m.id,
      title: m.title,
      meetingDate: mDateStr,
      participants: Array.isArray(participants) ? participants : [],
      meetingNotes: m.meeting_notes || '',
      tasks: tasksByMeeting[m.id] || [],
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
      updatedAt: m.updated_at ? new Date(m.updated_at).toISOString() : new Date().toISOString(),
    };
  });

  cachedMeetingsResponse = meetings;
  lastMeetingsCacheTime = Date.now();
  return meetings;
}

export async function mysqlCreateMeeting(meeting: any): Promise<void> {
  invalidateMeetingsCache();
  const p = getMysqlPool();
  if (!p) return;

  const participantsJson = JSON.stringify(meeting.participants || []);
  const meetingDate = String(meeting.meetingDate || '').split('T')[0];

  await p.execute(
    `INSERT INTO meetings (id, title, meeting_date, participants, meeting_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       meeting_date = VALUES(meeting_date),
       participants = VALUES(participants),
       meeting_notes = VALUES(meeting_notes),
       updated_at = NOW()`,
    [meeting.id, meeting.title, meetingDate, participantsJson, meeting.meetingNotes || '']
  );

  if (Array.isArray(meeting.tasks) && meeting.tasks.length > 0) {
    for (const t of meeting.tasks) {
      await mysqlUpsertTask(meeting.id, t);
    }
  }
}

export async function mysqlUpdateMeeting(id: string, updates: any): Promise<void> {
  invalidateMeetingsCache();
  const p = getMysqlPool();
  if (!p) return;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.meetingDate !== undefined) {
    fields.push('meeting_date = ?');
    values.push(String(updates.meetingDate).split('T')[0]);
  }
  if (updates.participants !== undefined) {
    fields.push('participants = ?');
    values.push(JSON.stringify(updates.participants));
  }
  if (updates.meetingNotes !== undefined) {
    fields.push('meeting_notes = ?');
    values.push(updates.meetingNotes);
  }

  if (fields.length === 0) return;
  fields.push('updated_at = NOW()');
  values.push(id);

  await p.execute(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function mysqlDeleteMeeting(id: string): Promise<void> {
  invalidateMeetingsCache();
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM meetings WHERE id = ?', [id]);
}

export async function mysqlUpsertTask(meetingId: string, task: any): Promise<void> {
  invalidateMeetingsCache();
  const p = getMysqlPool();
  if (!p) return;

  const rawAssignees = Array.isArray(task.assignees)
    ? task.assignees
    : (task.assignee ? String(task.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  const resolvedAssignee = rawAssignees.length > 0 ? rawAssignees.join(', ') : (task.assignee || 'Unassigned');
  const assigneesJson = JSON.stringify(rawAssignees.length > 0 ? rawAssignees : [resolvedAssignee]);
  const tagsJson = JSON.stringify(Array.isArray(task.tags) ? task.tags : []);
  const dueDate = String(task.dueDate || task.due_date || new Date().toISOString().split('T')[0]).split('T')[0];

  const githubMetadataJson = task.githubMetadata
    ? JSON.stringify(task.githubMetadata)
    : (task.github_metadata ? (typeof task.github_metadata === 'string' ? task.github_metadata : JSON.stringify(task.github_metadata)) : null);

  await p.execute(
    `INSERT INTO tasks (id, meeting_id, title, assignee, assignees, due_date, due_time, status, priority, description, tags, github_repo, github_branch, github_pr_url, github_issue_url, github_project_url, github_metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       meeting_id = VALUES(meeting_id),
       title = VALUES(title),
       assignee = VALUES(assignee),
       assignees = VALUES(assignees),
       due_date = VALUES(due_date),
       due_time = VALUES(due_time),
       status = VALUES(status),
       priority = VALUES(priority),
       description = VALUES(description),
       tags = VALUES(tags),
       github_repo = VALUES(github_repo),
       github_branch = VALUES(github_branch),
       github_pr_url = VALUES(github_pr_url),
       github_issue_url = VALUES(github_issue_url),
       github_project_url = VALUES(github_project_url),
       github_metadata = VALUES(github_metadata),
       updated_at = NOW()`,
    [
      task.id,
      meetingId,
      task.title || 'Untitled Task',
      resolvedAssignee,
      assigneesJson,
      dueDate,
      task.dueTime || task.due_time || null,
      task.status || 'To Do',
      task.priority || 'Medium',
      task.description || '',
      tagsJson,
      task.githubRepo || task.github_repo || null,
      task.githubBranch || task.github_branch || null,
      task.githubPrUrl || task.github_pr_url || null,
      task.githubIssueUrl || task.github_issue_url || null,
      task.githubProjectUrl || task.github_project_url || null,
      githubMetadataJson,
    ]
  );
}

export async function mysqlGetTasks(filters: { meetingId?: string; status?: string; assignee?: string; search?: string }): Promise<any[]> {
  const p = getMysqlPool();
  if (!p) return [];

  let query = `
    SELECT t.*, m.title AS meeting_title, m.meeting_date AS meeting_date
    FROM tasks t
    LEFT JOIN meetings m ON t.meeting_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.meetingId) {
    query += ' AND t.meeting_id = ?';
    params.push(filters.meetingId);
  }
  if (filters.status) {
    query += ' AND t.status = ?';
    params.push(filters.status);
  }
  if (filters.assignee) {
    query += ' AND t.assignee LIKE ?';
    params.push(`%${filters.assignee}%`);
  }
  if (filters.search) {
    query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' ORDER BY t.due_date ASC, t.created_at ASC';

  const [rows]: any = await p.execute(query, params);

  return rows.map((t: any) => {
    let assignees = [t.assignee || 'Unassigned'];
    if (t.assignees) {
      try {
        assignees = typeof t.assignees === 'string' ? JSON.parse(t.assignees) : t.assignees;
      } catch {}
    }

    let tags: string[] = [];
    if (t.tags) {
      try {
        tags = typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags;
      } catch {}
    }

    let githubMetadata = undefined;
    if (t.github_metadata) {
      try {
        githubMetadata = typeof t.github_metadata === 'string' ? JSON.parse(t.github_metadata) : t.github_metadata;
      } catch {}
    }

    const dueDateStr = t.due_date instanceof Date
      ? t.due_date.toISOString().split('T')[0]
      : String(t.due_date || '').split('T')[0];

    const meetingDateStr = t.meeting_date instanceof Date
      ? t.meeting_date.toISOString().split('T')[0]
      : (t.meeting_date ? String(t.meeting_date).split('T')[0] : '');

    return {
      id: t.id,
      meetingId: t.meeting_id,
      title: t.title,
      assignee: t.assignee,
      assignees: Array.isArray(assignees) ? assignees : [t.assignee],
      dueDate: dueDateStr,
      dueTime: t.due_time || undefined,
      status: t.status,
      priority: t.priority || 'Medium',
      description: t.description || '',
      tags: Array.isArray(tags) ? tags : [],
      githubRepo: t.github_repo || undefined,
      githubBranch: t.github_branch || undefined,
      githubPrUrl: t.github_pr_url || undefined,
      githubIssueUrl: t.github_issue_url || undefined,
      githubProjectUrl: t.github_project_url || undefined,
      githubMetadata,
      createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      updatedAt: t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString(),
      meetingTitle: t.meeting_title || 'Tugas Mandiri',
      meetingDate: meetingDateStr,
    };
  });
}

export async function mysqlDeleteTask(id: string): Promise<void> {
  invalidateMeetingsCache();
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM tasks WHERE id = ?', [id]);
}

let cachedDivisionsResponse: any[] | null = null;
let lastDivisionsCacheTime = 0;
const DIVISIONS_CACHE_TTL_MS = 10000;

export function invalidateDivisionsCache() {
  cachedDivisionsResponse = null;
  lastDivisionsCacheTime = 0;
}

export async function mysqlGetDivisions(): Promise<any[]> {
  const now = Date.now();
  if (cachedDivisionsResponse && (now - lastDivisionsCacheTime < DIVISIONS_CACHE_TTL_MS)) {
    return cachedDivisionsResponse;
  }
  const p = getMysqlPool();
  if (!p) return cachedDivisionsResponse || [];
  const [rows]: any = await p.query('SELECT * FROM divisions ORDER BY name ASC');
  const res = rows.map((d: any) => ({
    id: d.id,
    name: d.name,
    createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
    updatedAt: d.updated_at ? new Date(d.updated_at).toISOString() : new Date().toISOString(),
  }));
  cachedDivisionsResponse = res;
  lastDivisionsCacheTime = Date.now();
  return res;
}

export async function mysqlCreateDivision(id: string, name: string): Promise<any> {
  invalidateDivisionsCache();
  const p = getMysqlPool();
  if (!p) return { id, name };
  await p.execute('INSERT INTO divisions (id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [id, name]);
  return { id, name };
}

export async function mysqlUpdateDivision(id: string, name: string): Promise<void> {
  invalidateDivisionsCache();
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('UPDATE divisions SET name = ?, updated_at = NOW() WHERE id = ?', [name, id]);
}

export async function mysqlDeleteDivision(id: string): Promise<void> {
  invalidateDivisionsCache();
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM divisions WHERE id = ?', [id]);
}

export async function mysqlGetGitProjects(): Promise<any[]> {
  const p = getMysqlPool();
  if (!p) return [];
  try {
    const [rows]: any = await p.execute('SELECT id, name, repo, url, description, created_at FROM git_projects ORDER BY created_at DESC');
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      repo: r.repo,
      url: r.url,
      description: r.description,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  } catch (err: any) {
    console.warn('mysqlGetGitProjects error:', err.message);
    return [];
  }
}

export async function mysqlCreateGitProject(proj: { id: string; name: string; repo: string; url?: string; description?: string }): Promise<any> {
  const p = getMysqlPool();
  if (!p) return proj;
  await p.execute(
    `INSERT INTO git_projects (id, name, repo, url, description, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), url = VALUES(url), description = VALUES(description)`,
    [proj.id, proj.name, proj.repo, proj.url || null, proj.description || null]
  );
  return proj;
}

export async function mysqlDeleteGitProject(id: string): Promise<void> {
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM git_projects WHERE id = ?', [id]);
}

let cachedUsersResponse: any[] | null = null;
let lastUsersCacheTime = 0;
const USERS_CACHE_TTL_MS = 10000;

export function invalidateUsersCache() {
  cachedUsersResponse = null;
  lastUsersCacheTime = 0;
}

export async function mysqlGetUsers(): Promise<any[]> {
  const now = Date.now();
  if (cachedUsersResponse && (now - lastUsersCacheTime < USERS_CACHE_TTL_MS)) {
    return cachedUsersResponse;
  }
  const p = getMysqlPool();
  if (!p) return cachedUsersResponse || [];
  const [rows]: any = await p.query('SELECT id, username, password, division_id, role, github_id, github_username, github_avatar_url, created_at, updated_at FROM users ORDER BY username ASC');
  const res = rows.map((u: any) => ({
    id: u.id,
    username: u.username,
    password: u.password,
    divisionId: u.division_id,
    role: u.role || 'user',
    githubId: u.github_id || null,
    githubUsername: u.github_username || null,
    githubAvatarUrl: u.github_avatar_url || null,
    createdAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
    updatedAt: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
  }));
  cachedUsersResponse = res;
  lastUsersCacheTime = Date.now();
  return res;
}

export async function mysqlCreateUser(user: any): Promise<any> {
  invalidateUsersCache();
  const p = getMysqlPool();
  if (!p) return user;
  await p.execute(
    'INSERT INTO users (id, username, password, division_id, role, github_id, github_username, github_avatar_url, github_access_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [
      user.id,
      user.username,
      user.password || '',
      user.divisionId || null,
      user.role || 'user',
      user.githubId || null,
      user.githubUsername || null,
      user.githubAvatarUrl || null,
      user.githubAccessToken || null,
    ]
  );
  return user;
}

export async function mysqlUpdateUser(id: string, updates: any): Promise<void> {
  invalidateUsersCache();
  const p = getMysqlPool();
  if (!p) return;
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(String(updates.username).trim());
  }
  if (updates.password !== undefined && String(updates.password).trim().length > 0) {
    fields.push('password = ?');
    values.push(String(updates.password).trim());
  }
  if (updates.divisionId !== undefined) {
    fields.push('division_id = ?');
    values.push(updates.divisionId || null);
  }
  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }
  if (updates.githubId !== undefined) {
    fields.push('github_id = ?');
    values.push(updates.githubId || null);
  }
  if (updates.githubUsername !== undefined) {
    fields.push('github_username = ?');
    values.push(updates.githubUsername || null);
  }
  if (updates.githubAvatarUrl !== undefined) {
    fields.push('github_avatar_url = ?');
    values.push(updates.githubAvatarUrl || null);
  }
  if (updates.githubAccessToken !== undefined) {
    fields.push('github_access_token = ?');
    values.push(updates.githubAccessToken || null);
  }
  if (fields.length === 0) return;
  fields.push('updated_at = NOW()');
  values.push(id);
  await p.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function mysqlDeleteUser(id: string): Promise<void> {
  invalidateUsersCache();
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM users WHERE id = ?', [id]);
}

export async function mysqlGetSubmissions(): Promise<any[]> {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows]: any = await p.query('SELECT * FROM task_submissions ORDER BY submitted_at DESC');
  return rows.map((s: any) => {
    let attachments: any[] = [];
    if (s.attachments) {
      try {
        attachments = typeof s.attachments === 'string' ? JSON.parse(s.attachments) : s.attachments;
      } catch {}
    }
    return {
      id: s.id,
      taskId: s.task_id,
      assignee: s.assignee,
      notes: s.notes || '',
      attachments: Array.isArray(attachments) ? attachments : [],
      status: s.status || 'pending',
      submittedAt: s.submitted_at ? new Date(s.submitted_at).toISOString() : new Date().toISOString(),
      reviewedBy: s.reviewed_by || undefined,
      reviewedAt: s.reviewed_at ? new Date(s.reviewed_at).toISOString() : undefined,
      reviewNote: s.review_note || undefined,
    };
  });
}

export async function mysqlCreateSubmission(sub: any): Promise<void> {
  const p = getMysqlPool();
  if (!p) return;
  const attachmentsJson = JSON.stringify(sub.attachments || []);
  await p.execute(
    `INSERT INTO task_submissions (id, task_id, assignee, notes, attachments, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       notes = VALUES(notes),
       attachments = VALUES(attachments),
       status = VALUES(status)`,
    [sub.id, sub.taskId, sub.assignee, sub.notes || '', attachmentsJson, sub.status || 'pending']
  );
}

export async function mysqlUpdateSubmissionStatus(id: string, status: string, reviewer?: string, note?: string): Promise<void> {
  const p = getMysqlPool();
  if (!p) return;
  await p.execute(
    'UPDATE task_submissions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ? WHERE id = ?',
    [status, reviewer || null, note || null, id]
  );
}

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
  githubRepo?: string;
  githubBranch?: string;
  githubPrUrl?: string;
  githubIssueUrl?: string;
  githubProjectUrl?: string;
  githubMetadata?: any;
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

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory data store (clean state)
let meetings: Meeting[] = [];
let submissions: TaskSubmission[] = [];
let divisions: Division[] = [];
let users: User[] = [];
let inMemoryGitProjects: any[] = [
  { id: 'gp-task-mgmt', name: 'Task Management System', repo: 'syuhadahanif13/task-management', url: 'https://github.com/syuhadahanif13/task-management' },
  { id: 'gp-raja-kerupuk', name: 'Raja Kerupuk', repo: 'muhalhanifiyyah-max/raja-kerupuk', url: 'https://github.com/muhalhanifiyyah-max/raja-kerupuk' }
];

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

// Router that supports both /api prefix and root-relative endpoints
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mysqlConnected: isMysqlConfigured(),
  });
});

router.get('/mysql/test', async (req, res) => {
  if (!isMysqlConfigured()) {
    return res.json({
      connected: false,
      message: 'MySQL belum dikonfigurasi di environment.',
      meetingsCount: 0,
      tasksCount: 0,
    });
  }

  try {
    const [meetings, tasks] = await Promise.all([
      mysqlGetMeetings(),
      mysqlGetTasks({})
    ]);

    res.json({
      connected: true,
      meetingsCount: meetings.length,
      tasksCount: tasks.length,
      message: 'Terhubung normal ke database MySQL hosting!',
    });
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      error: err?.message || 'Error saat menghubungi MySQL hosting',
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
async function syncMeetingsFromDatabase(): Promise<Meeting[]> {
  if (isMysqlConfigured()) {
    try {
      const mysqlMeetings = await mysqlGetMeetings();
      if (mysqlMeetings.length > 0) {
        meetings = mysqlMeetings;
        return meetings;
      }
    } catch (err: any) {
      console.warn('MySQL get meetings warning:', err?.message);
    }
  }
  return meetings;
}

router.get('/meetings', async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=1, stale-while-revalidate=5');

  if (isMysqlConfigured()) {
    try {
      const synced = await mysqlGetMeetings();
      meetings = synced;
      return res.json(synced);
    } catch (err: any) {
      console.warn('MySQL get meetings error, falling back:', err?.message);
    }
  }

  const sorted = [...meetings].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  res.json(sorted);
});

router.get('/meetings/:id', async (req, res) => {
  if (isMysqlConfigured()) {
    try {
      const all = await mysqlGetMeetings();
      meetings = all;
      const m = all.find(x => x.id === req.params.id);
      if (m) return res.json(m);
    } catch (err: any) {
      console.warn('MySQL get meeting error:', err?.message);
    }
  }

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

  // Sync to MySQL if connected
  if (isMysqlConfigured()) {
    try {
      await mysqlCreateMeeting(newMeeting);
    } catch (err: any) {
      console.warn('MySQL meeting creation sync warning:', err?.message);
    }
  }

  meetings.unshift(newMeeting);
  res.status(201).json(newMeeting);
});

router.put('/meetings/:id', async (req, res) => {
  let meetingIndex = meetings.findIndex(m => m.id === req.params.id);
  if (meetingIndex === -1 && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
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
    title: title !== undefined ? String(title).trim() : existing.title,
    updatedAt: new Date().toISOString(),
  };

  if (isMysqlConfigured()) {
    try {
      await mysqlUpdateMeeting(updated.id, updated);
    } catch (err: any) {
      console.warn('MySQL meeting update warning:', err?.message);
    }
  }

  meetings[meetingIndex] = updated;
  res.json(updated);
});

// DELETE /api/meetings/:id - Menghapus data meeting dan tugas terkait dari MySQL & memori
router.delete('/meetings/:id', async (req, res) => {
  const meetingId = req.params.id;

  if (isMysqlConfigured()) {
    try {
      await mysqlDeleteMeeting(meetingId);
    } catch (err: any) {
      console.warn('MySQL meeting delete warning:', err?.message);
    }
  }

  const meetingIndex = meetings.findIndex(m => m.id === meetingId);
  if (meetingIndex !== -1) {
    meetings.splice(meetingIndex, 1);
  }

  res.json({
    message: 'Meeting and associated tasks deleted successfully',
    id: meetingId,
  });
});

router.get('/tasks', async (req, res) => {
  const { meetingId, status, assignee, search } = req.query;

  if (isMysqlConfigured()) {
    try {
      const mysqlTasks = await mysqlGetTasks({
        meetingId: meetingId ? String(meetingId) : undefined,
        status: status ? String(status) : undefined,
        assignee: assignee ? String(assignee) : undefined,
        search: search ? String(search) : undefined,
      });
      return res.json(mysqlTasks);
    } catch (err: any) {
      console.warn('MySQL get tasks error, falling back:', err?.message);
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
    githubRepo: req.body.githubRepo ? String(req.body.githubRepo).trim() : undefined,
    githubProjectUrl: req.body.githubProjectUrl ? String(req.body.githubProjectUrl).trim() : undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (isMysqlConfigured()) {
    try {
      await mysqlUpsertTask(targetMeeting.id, newTask);
    } catch (err: any) {
      console.warn('MySQL task insert warning:', err?.message);
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
    githubRepo: req.body.githubRepo ? String(req.body.githubRepo).trim() : undefined,
    githubProjectUrl: req.body.githubProjectUrl ? String(req.body.githubProjectUrl).trim() : undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (isMysqlConfigured()) {
    try {
      await mysqlUpsertTask(meeting.id, newTask);
    } catch (err: any) {
      console.warn('MySQL task insert warning:', err?.message);
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

  if (!targetTask && isMysqlConfigured()) {
    try {
      await syncMeetingsFromDatabase();
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

  if (isMysqlConfigured()) {
    try {
      await mysqlCreateSubmission(submission);
      await mysqlUpsertTask(targetMeeting?.id || 'general-tasks', {
        ...targetTask,
        status: 'Pending Approval',
        description: targetTask.description,
      });
    } catch (err: any) {
      console.warn('MySQL submit task warning:', err?.message);
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

  if (isMysqlConfigured()) {
    try {
      await mysqlCreateSubmission(sub);
    } catch (e: any) {
      console.warn('sync-submission MySQL save warning:', e?.message);
    }
  }

  res.json({ success: true, submission: submissions.find(s => s.id === sub.id || s.taskId === taskId) });
});

router.post('/submissions/sync-all', async (req, res) => {
  const incoming = req.body?.submissions;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.json({ success: true, count: 0 });
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

    if (isMysqlConfigured()) {
      try {
        await mysqlCreateSubmission(sub);
      } catch (err: any) {
        console.warn('MySQL sync submission warning:', err?.message);
      }
    }
    updatedCount++;
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

  if (isMysqlConfigured()) {
    try {
      const mysqlSubs = await mysqlGetSubmissions();
      for (const item of mysqlSubs) {
        const existingIdx = submissions.findIndex(x => x.id === item.id || x.taskId === item.taskId);
        if (existingIdx >= 0) {
          submissions[existingIdx] = { ...submissions[existingIdx], ...item };
        } else {
          submissions.push(item);
        }
      }
    } catch (err: any) {
      console.warn('MySQL get submissions error:', err?.message);
    }
  }

  let rawList = submissions.filter(s =>
    s.taskId === taskId ||
    (targetTask && s.taskId === targetTask.id) ||
    (queryTitle && s.taskTitle && s.taskTitle === queryTitle) ||
    (targetTask && s.taskTitle && s.taskTitle === targetTask.title)
  );

  const hasValidAtt = rawList.some(s => Array.isArray(s.attachments) && s.attachments.length > 0);
  if (!hasValidAtt && targetTask?.description) {
    const embedded = extractTaskSubmissionFromDescription(targetTask.description);
    if (embedded && Array.isArray(embedded.attachments) && embedded.attachments.length > 0) {
      rawList.unshift(embedded);
    }
  }

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
  if (!targetTask && isMysqlConfigured()) {
    try {
      await syncMeetingsFromDatabase();
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
  if (!targetTask) return res.status(404).json({ error: 'Task not found' });

  let submission = submissions.find(s => s.id === submissionId) ||
                   submissions.find(s => s.taskId === taskId && s.status === 'pending') ||
                   submissions.find(s => s.taskId === taskId) ||
                   submissions.find(s => s.taskTitle && s.taskTitle === targetTask?.title);
  if (!submission && targetTask?.description) {
    submission = extractTaskSubmissionFromDescription(targetTask.description) || undefined;
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

  if (isMysqlConfigured()) {
    try {
      const subTargetId = submission?.id || submissionId;
      if (subTargetId) {
        await mysqlUpdateSubmissionStatus(subTargetId, 'approved', 'admin', reviewNote);
      }
      await mysqlUpsertTask(targetMeeting?.id || 'general-tasks', targetTask);
    } catch (err: any) {
      console.warn('MySQL approve task error:', err?.message);
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
  if (!targetTask && isMysqlConfigured()) {
    try {
      await syncMeetingsFromDatabase();
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
  if (!targetTask) return res.status(404).json({ error: 'Task not found' });

  let submission = submissions.find(s => s.id === submissionId) ||
                   submissions.find(s => s.taskId === taskId && s.status === 'pending') ||
                   submissions.find(s => s.taskId === taskId);

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

  if (isMysqlConfigured()) {
    try {
      const subTargetId = submission?.id || submissionId;
      if (subTargetId) {
        await mysqlUpdateSubmissionStatus(subTargetId, 'rejected', 'admin', reviewNote);
      }
      await mysqlUpsertTask(targetMeeting?.id || 'general-tasks', targetTask);
    } catch (err: any) {
      console.warn('MySQL reject task error:', err?.message);
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

  for (const m of meetings) {
    const found = (m.tasks || []).find(t => t.id === taskId);
    if (found) {
      targetMeeting = m;
      targetTask = found;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const found = (m.tasks || []).find(t => t.id === taskId);
      if (found) {
        targetMeeting = m;
        targetTask = found;
        break;
      }
    }
  }

  if (!targetTask) {
    return res.status(404).json({ error: `Task dengan id '${taskId}' tidak ditemukan di server.` });
  }

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
  if (req.body.githubRepo !== undefined) targetTask.githubRepo = req.body.githubRepo;
  if (req.body.githubBranch !== undefined) targetTask.githubBranch = req.body.githubBranch;
  if (req.body.githubPrUrl !== undefined) targetTask.githubPrUrl = req.body.githubPrUrl;
  if (req.body.githubProjectUrl !== undefined) targetTask.githubProjectUrl = req.body.githubProjectUrl;
  if (req.body.githubMetadata !== undefined) targetTask.githubMetadata = req.body.githubMetadata;
  targetTask.updatedAt = now;
  if (targetMeeting) targetMeeting.updatedAt = now;

  if (isMysqlConfigured()) {
    try {
      await mysqlUpsertTask(targetMeeting?.id || targetTask.meetingId || 'general-tasks', targetTask);
    } catch (err: any) {
      console.warn('MySQL task update warning:', err?.message);
    }
  }

  return res.json(targetTask);
});

// DELETE /api/tasks/:id - Menghapus data task dari MySQL & memori
router.delete('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;

  if (isMysqlConfigured()) {
    try {
      await mysqlDeleteTask(taskId);
    } catch (err: any) {
      console.warn('MySQL task delete warning:', err?.message);
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

// Division Database Sync (MySQL)
async function syncDivisionsFromDatabase(): Promise<Division[]> {
  if (isMysqlConfigured()) {
    try {
      const mysqlDivs = await mysqlGetDivisions();
      if (mysqlDivs.length > 0) {
        divisions = mysqlDivs;
        return divisions;
      }
    } catch (err: any) {
      console.warn('MySQL divisions sync warning:', err?.message);
    }
  }
  return divisions;
}

// Division CRUD
router.get('/divisions', async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=2, stale-while-revalidate=10');
  const data = await syncDivisionsFromDatabase();
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

  if (isMysqlConfigured()) {
    try {
      await mysqlCreateDivision(division.id, division.name);
    } catch (err: any) {
      console.warn('MySQL insert division warning:', err?.message);
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

  if (isMysqlConfigured() && name !== undefined) {
    try {
      await mysqlUpdateDivision(req.params.id, String(name).trim());
    } catch (err: any) {
      console.warn('MySQL update division warning:', err?.message);
    }
  }

  if (idx === -1) return res.status(404).json({ error: 'Division not found' });
  res.json(divisions[idx]);
});

router.delete('/divisions/:id', async (req, res) => {
  const idx = divisions.findIndex(d => d.id === req.params.id);
  if (idx !== -1) divisions.splice(idx, 1);

  if (isMysqlConfigured()) {
    try {
      await mysqlDeleteDivision(req.params.id);
    } catch (err: any) {
      console.warn('MySQL delete division warning:', err?.message);
    }
  }

  res.json({ message: 'Division deleted', id: req.params.id });
});

// User Database Sync (MySQL)
async function syncUsersFromDatabase(): Promise<User[]> {
  if (isMysqlConfigured()) {
    try {
      const mysqlUsers = await mysqlGetUsers();
      if (mysqlUsers.length > 0) {
        users = mysqlUsers;
        return users;
      }
    } catch (err: any) {
      console.warn('MySQL users sync warning:', err?.message);
    }
  }
  return users;
}

// User CRUD
router.get('/users', async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=2, stale-while-revalidate=10');
  await syncUsersFromDatabase();
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

  if (isMysqlConfigured()) {
    try {
      await mysqlCreateUser(user);
    } catch (err: any) {
      console.warn('MySQL insert user warning:', err?.message);
    }
  }

  const { password: _pwd, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.put('/users/:id', async (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  const { username, password, divisionId, role } = req.body;
  const now = new Date().toISOString();
  const trimmedPassword = password !== undefined && password !== null ? String(password).trim() : '';

  if (idx !== -1) {
    if (username !== undefined) users[idx].username = String(username).trim();
    if (trimmedPassword.length > 0) users[idx].password = trimmedPassword;
    if (divisionId !== undefined) users[idx].divisionId = String(divisionId);
    if (role !== undefined && ['admin', 'user'].includes(role)) users[idx].role = role;
    if (req.body.githubId !== undefined) users[idx].githubId = req.body.githubId;
    if (req.body.githubUsername !== undefined) users[idx].githubUsername = req.body.githubUsername;
    if (req.body.githubAvatarUrl !== undefined) users[idx].githubAvatarUrl = req.body.githubAvatarUrl;
    if (req.body.githubAccessToken !== undefined) users[idx].githubAccessToken = req.body.githubAccessToken;
    users[idx].updatedAt = now;
  }

  if (isMysqlConfigured()) {
    try {
      const updates: any = {};
      if (username !== undefined) updates.username = String(username).trim();
      if (trimmedPassword.length > 0) updates.password = trimmedPassword;
      if (divisionId !== undefined) updates.divisionId = divisionId;
      if (role !== undefined) updates.role = role;
      if (req.body.githubId !== undefined) updates.githubId = req.body.githubId;
      if (req.body.githubUsername !== undefined) updates.githubUsername = req.body.githubUsername;
      if (req.body.githubAvatarUrl !== undefined) updates.githubAvatarUrl = req.body.githubAvatarUrl;
      if (req.body.githubAccessToken !== undefined) updates.githubAccessToken = req.body.githubAccessToken;
      await mysqlUpdateUser(req.params.id, updates);
    } catch (err: any) {
      console.warn('MySQL update user warning:', err?.message);
    }
  }

  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const { password: _pwd, ...safeUser } = users[idx];
  res.json(safeUser);
});

router.delete('/users/:id', async (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx !== -1) users.splice(idx, 1);

  if (isMysqlConfigured()) {
    try {
      await mysqlDeleteUser(req.params.id);
    } catch (err: any) {
      console.warn('MySQL delete user warning:', err?.message);
    }
  }

  res.json({ message: 'User deleted', id: req.params.id });
});

// Auth
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  await syncUsersFromDatabase();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase() && u.password === String(password));
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  const { password: _pwd, ...safeUser } = user;
  res.json({ user: safeUser, token: generateId('token') });
});

// Helper: Slugify text for Jira-style branch names
function slugifyText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 45);
}

// ─────────────────────────────────────────────────────────────
// GITHUB INTEGRATION & JIRA-STYLE DEV TRACKING
// ─────────────────────────────────────────────────────────────

// 0. Git Projects Management (Multi-project support for IT Team)
router.get('/git-projects', async (req, res) => {
  if (isMysqlConfigured()) {
    try {
      const projects = await mysqlGetGitProjects();
      if (projects.length > 0) return res.json(projects);
    } catch (e: any) {
      console.warn('Error fetching git projects from MySQL:', e.message);
    }
  }
  res.json(inMemoryGitProjects);
});

router.post('/git-projects', async (req, res) => {
  const { name, repo, url, description } = req.body;
  if (!name || !repo) {
    return res.status(400).json({ error: 'Nama project dan repositori GitHub wajib diisi.' });
  }

  let normalizedRepo = String(repo).trim();
  const urlMatch = normalizedRepo.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (urlMatch) {
    normalizedRepo = `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/i, '')}`;
  } else {
    normalizedRepo = normalizedRepo.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  }

  const projId = `gp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const projectObj = {
    id: projId,
    name: String(name).trim(),
    repo: normalizedRepo,
    url: url ? String(url).trim() : `https://github.com/${normalizedRepo}`,
    description: description ? String(description).trim() : '',
    createdAt: new Date().toISOString(),
  };

  if (isMysqlConfigured()) {
    try {
      await mysqlCreateGitProject(projectObj);
    } catch (e: any) {
      console.warn('MySQL create git project warning:', e.message);
    }
  }

  const idx = inMemoryGitProjects.findIndex(p => p.repo.toLowerCase() === normalizedRepo.toLowerCase());
  if (idx >= 0) {
    inMemoryGitProjects[idx] = projectObj;
  } else {
    inMemoryGitProjects.unshift(projectObj);
  }

  res.json({ message: 'Project Git berhasil ditambahkan', project: projectObj });
});

router.delete('/git-projects/:id', async (req, res) => {
  const { id } = req.params;
  if (isMysqlConfigured()) {
    try {
      await mysqlDeleteGitProject(id);
    } catch (e: any) {
      console.warn('MySQL delete git project warning:', e.message);
    }
  }
  inMemoryGitProjects = inMemoryGitProjects.filter(p => p.id !== id);
  res.json({ message: 'Project Git berhasil dihapus' });
});

// 1. Get GitHub OAuth and Repo Config
router.get('/auth/github/config', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const defaultRepo = process.env.GITHUB_DEFAULT_REPO || null;
  res.json({
    configured: Boolean(clientId && clientId.trim().length > 0),
    clientId: clientId ? clientId.trim() : null,
    defaultRepo,
  });
});

// 2. Initiate GitHub OAuth Redirect
router.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  if (!clientId || !clientId.trim()) {
    return res.status(400).json({
      error: 'GITHUB_CLIENT_ID belum dikonfigurasi di file .env server.',
    });
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${protocol}://${host}/api/auth/github/callback`;
  const state = req.query.state ? String(req.query.state) : generateId('gh_state');

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,repo&state=${encodeURIComponent(state)}`;
  res.redirect(githubAuthUrl);
});

// 3. GitHub OAuth Callback Handler
router.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';

  if (!code) {
    return res.redirect('/?github_error=' + encodeURIComponent('Kode otorisasi dari GitHub tidak ditemukan'));
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code,
      }),
    });

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      const errMsg = tokenData.error_description || tokenData.error || 'Gagal memperoleh access token dari GitHub';
      return res.redirect('/?github_error=' + encodeURIComponent(errMsg));
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'TaskManagementSystem-App',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const ghUser: any = await userRes.json();
    if (!ghUser || !ghUser.login) {
      return res.redirect('/?github_error=' + encodeURIComponent('Gagal memuat profil pengguna dari GitHub'));
    }

    await syncUsersFromDatabase();

    let targetUser: any = null;
    if (state && String(state).startsWith('link_user_')) {
      const linkUserId = String(state).replace('link_user_', '');
      targetUser = users.find(u => u.id === linkUserId);
    }

    if (!targetUser) {
      targetUser = users.find(u =>
        (u.githubId && String(u.githubId) === String(ghUser.id)) ||
        u.username.toLowerCase() === ghUser.login.toLowerCase()
      );
    }

    const now = new Date().toISOString();

    if (targetUser) {
      targetUser.githubId = String(ghUser.id);
      targetUser.githubUsername = ghUser.login;
      targetUser.githubAvatarUrl = ghUser.avatar_url;
      targetUser.githubAccessToken = accessToken;
      targetUser.updatedAt = now;

      if (isMysqlConfigured()) {
        await mysqlUpdateUser(targetUser.id, {
          githubId: String(ghUser.id),
          githubUsername: ghUser.login,
          githubAvatarUrl: ghUser.avatar_url,
          githubAccessToken: accessToken,
        });
      }
    } else {
      const newUserId = generateId('user');
      const newUser = {
        id: newUserId,
        username: ghUser.login,
        password: '',
        divisionId: 'div-it',
        role: 'user' as const,
        githubId: String(ghUser.id),
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        githubAccessToken: accessToken,
        createdAt: now,
        updatedAt: now,
      };
      users.push(newUser);
      targetUser = newUser;

      if (isMysqlConfigured()) {
        await mysqlCreateUser(newUser);
      }
    }

    const { password: _p, githubAccessToken: _tok, ...safeUser } = targetUser;
    const sessionToken = generateId('token');

    const redirectUrl = `/?github_auth=success&token=${encodeURIComponent(sessionToken)}&user=${encodeURIComponent(JSON.stringify(safeUser))}`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error('GitHub OAuth callback error:', err);
    return res.redirect('/?github_error=' + encodeURIComponent(err.message || 'Terjadi kesalahan otentikasi GitHub'));
  }
});

// 4. Login or Link Account using GitHub Personal Access Token (PAT)
router.post('/auth/github/token-login', async (req, res) => {
  const { token, linkUserId } = req.body;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'Token GitHub (PAT) wajib diisi.' });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'User-Agent': 'TaskManagementSystem-App',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Token GitHub tidak valid atau tidak memiliki izin akses.' });
    }

    const ghUser: any = await userRes.json();
    await syncUsersFromDatabase();

    let targetUser: any = null;
    if (linkUserId) {
      targetUser = users.find(u => u.id === linkUserId);
    }
    if (!targetUser) {
      targetUser = users.find(u =>
        (u.githubId && String(u.githubId) === String(ghUser.id)) ||
        u.username.toLowerCase() === ghUser.login.toLowerCase()
      );
    }

    const now = new Date().toISOString();

    if (targetUser) {
      targetUser.githubId = String(ghUser.id);
      targetUser.githubUsername = ghUser.login;
      targetUser.githubAvatarUrl = ghUser.avatar_url;
      targetUser.githubAccessToken = token.trim();
      targetUser.updatedAt = now;

      if (isMysqlConfigured()) {
        await mysqlUpdateUser(targetUser.id, {
          githubId: String(ghUser.id),
          githubUsername: ghUser.login,
          githubAvatarUrl: ghUser.avatar_url,
          githubAccessToken: token.trim(),
        });
      }
    } else {
      const newUserId = generateId('user');
      const newUser = {
        id: newUserId,
        username: ghUser.login,
        password: '',
        divisionId: 'div-it',
        role: 'user' as const,
        githubId: String(ghUser.id),
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        githubAccessToken: token.trim(),
        createdAt: now,
        updatedAt: now,
      };
      users.push(newUser);
      targetUser = newUser;

      if (isMysqlConfigured()) {
        await mysqlCreateUser(newUser);
      }
    }

    const { password: _p, githubAccessToken: _tok, ...safeUser } = targetUser;
    return res.json({
      user: safeUser,
      token: generateId('token'),
      github: {
        id: ghUser.id,
        username: ghUser.login,
        name: ghUser.name,
        avatarUrl: ghUser.avatar_url,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gagal memverifikasi token GitHub' });
  }
});

// 5. Unlink GitHub Account
router.post('/auth/github/unlink', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  await syncUsersFromDatabase();
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  user.githubId = null;
  user.githubUsername = null;
  user.githubAvatarUrl = null;
  user.githubAccessToken = null;
  user.updatedAt = new Date().toISOString();

  if (isMysqlConfigured()) {
    try {
      await mysqlUpdateUser(userId, {
        githubId: null,
        githubUsername: null,
        githubAvatarUrl: null,
        githubAccessToken: null,
      });
    } catch (e: any) {
      console.warn('MySQL unlink warning:', e.message);
    }
  }

  const { password: _p, githubAccessToken: _t, ...safeUser } = user;
  res.json({ message: 'Akun GitHub berhasil diputuskan', user: safeUser });
});

// 6. Jira-style GitHub Development Info for a Task
router.get('/github/task-dev', async (req, res) => {
  const { taskId, repo: requestedRepo, userId } = req.query;
  if (!taskId || typeof taskId !== 'string') {
    return res.status(400).json({ error: 'taskId is required' });
  }

  // Resolve target task
  let targetTask: Task | undefined;
  let targetMeetingId = 'general-tasks';
  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId);
    if (f) {
      targetTask = f;
      targetMeetingId = m.id;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const f = (m.tasks || []).find(t => t.id === taskId);
      if (f) {
        targetTask = f;
        targetMeetingId = m.id;
        break;
      }
    }
  }

  if (!targetTask) {
    return res.status(404).json({ error: 'Task tidak ditemukan' });
  }

  const repo = (typeof requestedRepo === 'string' && requestedRepo.trim())
    ? requestedRepo.trim()
    : (targetTask.githubRepo || '');

  // Resolve GitHub Token: check user token or server token
  let token = process.env.GITHUB_TOKEN || '';
  if (userId) {
    const u = users.find(usr => usr.id === userId);
    if (u?.githubAccessToken) {
      token = u.githubAccessToken;
    }
  }

  // Clean Task Key & slug (like Jira's PROJ-123)
  const taskNumberMatch = taskId.match(/task-(\d+)/i) || taskId.match(/(\d+)/);
  const taskNum = taskNumberMatch ? taskNumberMatch[1] : '';
  const taskKey = taskNum ? `REI-${taskNum}` : `REI-${taskId.slice(-6)}`;
  const taskSlug = slugifyText(targetTask.title);
  const recommendedBranchName = `feature/${taskKey}-${taskSlug}`;
  const recommendedGitCommand = `git checkout -b ${recommendedBranchName}`;
  const recommendedCommitMsg = `feat(${taskKey}): ${targetTask.title.slice(0, 50)} #${taskKey}`;

  if (!repo) {
    return res.json({
      taskKey,
      taskId: targetTask.id,
      taskTitle: targetTask.title,
      repo: '',
      hasRepo: false,
      hasToken: Boolean(token),
      recommendedBranchName,
      recommendedGitCommand,
      recommendedCommitMsg,
      branches: [],
      commits: [],
      pullRequests: [],
      issue: targetTask.githubMetadata?.issue || null,
      project: targetTask.githubMetadata?.project || null,
      githubIssueUrl: targetTask.githubIssueUrl || null,
      githubProjectUrl: targetTask.githubProjectUrl || null,
      counts: { branches: 0, commits: 0, pullRequests: 0 },
      lastSyncedAt: targetTask.githubMetadata?.lastSyncedAt || null,
    });
  }

  // Start with existing saved metadata
  let existingMeta: any = targetTask.githubMetadata || {
    repo,
    branches: [],
    commits: [],
    pullRequests: [],
  };

  const branches: any[] = [...(existingMeta.branches || [])];
  const commits: any[] = [...(existingMeta.commits || [])];
  const pullRequests: any[] = [...(existingMeta.pullRequests || [])];

  // If token is available and repo format is valid (owner/repo), fetch live GitHub activity
  const repoParts = repo.split('/');
  if (token && repoParts.length === 2) {
    const [owner, repoName] = repoParts;
    const headers = {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'TaskManagementSystem-App',
      Accept: 'application/vnd.github.v3+json',
    };

    try {
      // 1. Fetch Pull Requests
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=all&per_page=30`, { headers });
      if (prRes.ok) {
        const prList: any[] = await prRes.json();
        const searchTerms = [taskId.toLowerCase(), taskKey.toLowerCase()];
        if (taskNum) searchTerms.push(`#${taskNum}`);

        for (const pr of prList) {
          const titleLower = (pr.title || '').toLowerCase();
          const bodyLower = (pr.body || '').toLowerCase();
          const branchLower = (pr.head?.ref || '').toLowerCase();

          const isMatch = searchTerms.some(term =>
            titleLower.includes(term) || bodyLower.includes(term) || branchLower.includes(term)
          );

          if (isMatch) {
            const prObj = {
              number: pr.number,
              title: pr.title,
              url: pr.html_url,
              state: pr.merged_at ? 'merged' : pr.state,
              author: pr.user?.login || 'Unknown',
              authorAvatar: pr.user?.avatar_url,
              branch: pr.head?.ref,
              mergedAt: pr.merged_at,
              updatedAt: pr.updated_at,
            };
            const idx = pullRequests.findIndex(p => p.number === pr.number);
            if (idx >= 0) pullRequests[idx] = prObj;
            else pullRequests.unshift(prObj);
          }
        }
      }

      // 2. Fetch Commits
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=40`, { headers });
      if (commitRes.ok) {
        const commitList: any[] = await commitRes.json();
        const searchTerms = [taskId.toLowerCase(), taskKey.toLowerCase()];
        if (taskNum) searchTerms.push(`#${taskNum}`);

        for (const c of commitList) {
          const msg = c.commit?.message || '';
          const msgLower = msg.toLowerCase();
          const isMatch = searchTerms.some(term => msgLower.includes(term));

          if (isMatch) {
            const commitObj = {
              id: c.sha.substring(0, 7),
              fullSha: c.sha,
              message: msg.split('\n')[0],
              author: c.commit?.author?.name || c.author?.login || 'Unknown',
              authorAvatar: c.author?.avatar_url,
              url: c.html_url,
              timestamp: c.commit?.author?.date,
            };
            const idx = commits.findIndex(cm => cm.id === commitObj.id);
            if (idx >= 0) commits[idx] = commitObj;
            else commits.unshift(commitObj);
          }
        }
      }

      // 3. Fetch Branches
      const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches?per_page=30`, { headers });
      if (branchRes.ok) {
        const branchList: any[] = await branchRes.json();
        const searchTerms = [taskId.toLowerCase(), taskKey.toLowerCase(), taskSlug.slice(0, 15)];
        for (const b of branchList) {
          const bLower = (b.name || '').toLowerCase();
          const isMatch = searchTerms.some(term => term && bLower.includes(term));
          if (isMatch) {
            const branchObj = {
              name: b.name,
              url: `https://github.com/${owner}/${repoName}/tree/${encodeURIComponent(b.name)}`,
              lastCommit: b.commit?.sha?.substring(0, 7),
            };
            const idx = branches.findIndex(br => br.name === b.name);
            if (idx >= 0) branches[idx] = branchObj;
            else branches.push(branchObj);
          }
        }
      }
    } catch (err: any) {
      console.warn('GitHub live fetch warning:', err.message);
    }
  }

  // Live sync GitHub Issue status if linked
  const issue = existingMeta.issue || null;
  const project = existingMeta.project || null;
  if (issue && issue.number && repoParts.length === 2 && token) {
    const [owner, repoName] = repoParts;
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'TaskManagementSystem-App',
        Accept: 'application/vnd.github.v3+json',
      };
      const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${issue.number}`, { headers });
      if (issueRes.ok) {
        const apiIssue: any = await issueRes.json();
        issue.title = apiIssue.title || issue.title;
        issue.state = apiIssue.state || issue.state;
        issue.assignee = apiIssue.assignee?.login;
        issue.labels = (apiIssue.labels || []).map((l: any) => typeof l === 'string' ? l : l.name);
        issue.commentsCount = apiIssue.comments;
        issue.updatedAt = apiIssue.updated_at;
      }
    } catch {}
  }

  // Update targetTask with new metadata
  targetTask.githubRepo = repo;
  if (branches.length > 0 && !targetTask.githubBranch) {
    targetTask.githubBranch = branches[0].name;
  }
  if (pullRequests.length > 0 && !targetTask.githubPrUrl) {
    targetTask.githubPrUrl = pullRequests[0].url;
  }
  if (issue?.url && !targetTask.githubIssueUrl) {
    targetTask.githubIssueUrl = issue.url;
  }
  if (project?.url && !targetTask.githubProjectUrl) {
    targetTask.githubProjectUrl = project.url;
  }

  targetTask.githubMetadata = {
    repo,
    branches,
    commits,
    pullRequests,
    issue,
    project,
    lastSyncedAt: new Date().toISOString(),
  };

  if (isMysqlConfigured()) {
    try {
      await mysqlUpsertTask(targetMeetingId, targetTask);
    } catch (e: any) {
      console.warn('MySQL save task dev metadata warning:', e.message);
    }
  }

  res.json({
    taskKey,
    taskId: targetTask.id,
    taskTitle: targetTask.title,
    repo,
    hasToken: Boolean(token),
    recommendedBranchName,
    recommendedGitCommand,
    recommendedCommitMsg,
    branches,
    commits,
    pullRequests,
    issue,
    project,
    githubIssueUrl: targetTask.githubIssueUrl || issue?.url || null,
    githubProjectUrl: targetTask.githubProjectUrl || project?.url || null,
    counts: {
      branches: branches.length,
      commits: commits.length,
      pullRequests: pullRequests.length,
    },
    lastSyncedAt: targetTask.githubMetadata.lastSyncedAt,
  });
});

// 7. Manually link a PR, Commit, or Branch to a Task
router.post('/github/link', async (req, res) => {
  const { taskId, url, branch, repo: userRepo, userId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId is required' });

  let targetTask: Task | undefined;
  let targetMeetingId = 'general-tasks';
  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId);
    if (f) {
      targetTask = f;
      targetMeetingId = m.id;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const f = (m.tasks || []).find(t => t.id === taskId);
      if (f) {
        targetTask = f;
        targetMeetingId = m.id;
        break;
      }
    }
  }

  if (!targetTask) return res.status(404).json({ error: 'Task tidak ditemukan' });

  const metadata = targetTask.githubMetadata || {
    repo: userRepo || process.env.GITHUB_DEFAULT_REPO || 'syuhadahanif13/task-management',
    branches: [],
    commits: [],
    pullRequests: [],
  };

  // If a URL was provided, detect type (PR or Commit)
  if (url && typeof url === 'string') {
    const trimmedUrl = url.trim();
    const prMatch = trimmedUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
    const commitMatch = trimmedUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/commit\/([a-f0-9]+)/i);

    if (prMatch) {
      const [, owner, repoName, prNumStr] = prMatch;
      const prNumber = parseInt(prNumStr, 10);
      const prObj = {
        number: prNumber,
        title: `PR #${prNumber}`,
        url: trimmedUrl,
        state: 'open' as const,
        author: 'GitHub User',
        updatedAt: new Date().toISOString(),
      };

      // Try fetching richer PR details from GitHub API if token is available
      let token = process.env.GITHUB_TOKEN || '';
      if (userId) {
        const u = users.find(usr => usr.id === userId);
        if (u?.githubAccessToken) token = u.githubAccessToken;
      }

      if (token) {
        try {
          const apiPrRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'TaskManagementSystem-App',
              Accept: 'application/vnd.github.v3+json',
            },
          });
          if (apiPrRes.ok) {
            const apiPr: any = await apiPrRes.json();
            prObj.title = apiPr.title || prObj.title;
            prObj.state = apiPr.merged_at ? 'merged' : apiPr.state;
            prObj.author = apiPr.user?.login || prObj.author;
            (prObj as any).authorAvatar = apiPr.user?.avatar_url;
            (prObj as any).branch = apiPr.head?.ref;
            (prObj as any).mergedAt = apiPr.merged_at;
          }
        } catch {}
      }

      const existingIdx = (metadata.pullRequests || []).findIndex(p => p.number === prNumber);
      if (existingIdx >= 0) {
        metadata.pullRequests![existingIdx] = prObj;
      } else {
        metadata.pullRequests = metadata.pullRequests || [];
        metadata.pullRequests.unshift(prObj);
      }

      targetTask.githubPrUrl = trimmedUrl;
      targetTask.githubRepo = `${owner}/${repoName}`;
    } else if (commitMatch) {
      const [, owner, repoName, sha] = commitMatch;
      const shortSha = sha.substring(0, 7);
      const commitObj = {
        id: shortSha,
        fullSha: sha,
        message: `Commit ${shortSha}`,
        author: 'GitHub Committer',
        url: trimmedUrl,
        timestamp: new Date().toISOString(),
      };

      const existingIdx = (metadata.commits || []).findIndex(c => c.id === shortSha);
      if (existingIdx >= 0) {
        metadata.commits![existingIdx] = commitObj;
      } else {
        metadata.commits = metadata.commits || [];
        metadata.commits.unshift(commitObj);
      }

      targetTask.githubRepo = `${owner}/${repoName}`;
    } else {
      // 3. Issue URL or Issue Number Match
      const issueMatch = trimmedUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i);
      const issueNumOnly = trimmedUrl.match(/^#?(\d+)$/);

      if (issueMatch || issueNumOnly) {
        const owner = issueMatch ? issueMatch[1] : (userRepo ? userRepo.split('/')[0] : 'syuhadahanif13');
        const repoName = issueMatch ? issueMatch[2] : (userRepo ? userRepo.split('/')[1] : 'task-management');
        const issueNumber = parseInt(issueMatch ? issueMatch[3] : issueNumOnly![1], 10);

        const issueObj: any = {
          number: issueNumber,
          title: `Issue #${issueNumber}`,
          url: issueMatch ? trimmedUrl : `https://github.com/${owner}/${repoName}/issues/${issueNumber}`,
          state: 'open',
          updatedAt: new Date().toISOString(),
        };

        let token = process.env.GITHUB_TOKEN || '';
        if (userId) {
          const u = users.find(usr => usr.id === userId);
          if (u?.githubAccessToken) token = u.githubAccessToken;
        }

        if (token) {
          try {
            const apiIssueRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'TaskManagementSystem-App',
                Accept: 'application/vnd.github.v3+json',
              },
            });
            if (apiIssueRes.ok) {
              const apiIssue: any = await apiIssueRes.json();
              issueObj.id = apiIssue.id;
              issueObj.title = apiIssue.title || issueObj.title;
              issueObj.state = apiIssue.state || issueObj.state;
              issueObj.url = apiIssue.html_url || issueObj.url;
              issueObj.assignee = apiIssue.assignee?.login;
              issueObj.labels = (apiIssue.labels || []).map((l: any) => typeof l === 'string' ? l : l.name);
              issueObj.commentsCount = apiIssue.comments;
              issueObj.createdAt = apiIssue.created_at;
              issueObj.updatedAt = apiIssue.updated_at;
            }
          } catch {}
        }

        metadata.issue = issueObj;
        targetTask.githubIssueUrl = issueObj.url;
        targetTask.githubRepo = `${owner}/${repoName}`;
      } else {
        // 4. Project URL Match (Users, Orgs, or Repo Projects)
        const projectMatch = trimmedUrl.match(/github\.com\/(users|orgs)?\/?([^\/]+)\/projects\/(\d+)/i) ||
                             trimmedUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/projects\/(\d+)/i);

        if (projectMatch) {
          const projectOwner = projectMatch[2] || projectMatch[1] || 'GitHub';
          const projectNum = parseInt(projectMatch[3], 10);
          metadata.project = {
            number: projectNum,
            title: `Project #${projectNum} (${projectOwner})`,
            url: trimmedUrl,
          };
          targetTask.githubProjectUrl = trimmedUrl;
        }
      }
    }
  }

  if (branch && typeof branch === 'string') {
    const trimmedBranch = branch.trim();
    targetTask.githubBranch = trimmedBranch;
    const existingIdx = (metadata.branches || []).findIndex(b => b.name === trimmedBranch);
    if (existingIdx < 0) {
      metadata.branches = metadata.branches || [];
      metadata.branches.push({
        name: trimmedBranch,
        url: `https://github.com/${metadata.repo || 'syuhadahanif13/task-management'}/tree/${encodeURIComponent(trimmedBranch)}`,
      });
    }
  }

  metadata.lastSyncedAt = new Date().toISOString();
  targetTask.githubMetadata = metadata;
  targetTask.updatedAt = new Date().toISOString();

  if (isMysqlConfigured()) {
    await mysqlUpsertTask(targetMeetingId, targetTask);
  }

  res.json({
    message: 'Item GitHub berhasil ditautkan ke tugas',
    task: targetTask,
    metadata,
  });
});

// 8. Unlink PR, Commit, Branch, Issue, or Project from Task
router.delete('/github/unlink-item', async (req, res) => {
  const { taskId, itemType, itemId } = req.body;
  if (!taskId || !itemType) {
    return res.status(400).json({ error: 'taskId and itemType are required' });
  }

  let targetTask: Task | undefined;
  let targetMeetingId = 'general-tasks';
  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId);
    if (f) {
      targetTask = f;
      targetMeetingId = m.id;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const f = (m.tasks || []).find(t => t.id === taskId);
      if (f) {
        targetTask = f;
        targetMeetingId = m.id;
        break;
      }
    }
  }

  if (!targetTask) return res.status(404).json({ error: 'Task tidak ditemukan' });

  const metadata = targetTask.githubMetadata || { repo: '', branches: [], commits: [], pullRequests: [] };

  if (itemType === 'pr') {
    metadata.pullRequests = (metadata.pullRequests || []).filter(p => String(p.number) !== String(itemId));
    if (metadata.pullRequests.length === 0) targetTask.githubPrUrl = undefined;
  } else if (itemType === 'commit') {
    metadata.commits = (metadata.commits || []).filter(c => c.id !== itemId && (c as any).fullSha !== itemId);
  } else if (itemType === 'branch') {
    metadata.branches = (metadata.branches || []).filter(b => b.name !== itemId);
    if (metadata.branches.length === 0) targetTask.githubBranch = undefined;
  } else if (itemType === 'issue') {
    delete metadata.issue;
    targetTask.githubIssueUrl = undefined;
  } else if (itemType === 'project') {
    delete metadata.project;
    targetTask.githubProjectUrl = undefined;
  }

  metadata.lastSyncedAt = new Date().toISOString();
  targetTask.githubMetadata = metadata;
  targetTask.updatedAt = new Date().toISOString();

  if (isMysqlConfigured()) {
    await mysqlUpsertTask(targetMeetingId, targetTask);
  }

  res.json({ message: 'Item berhasil dihapus', metadata, task: targetTask });
});

// 8b. Get List of GitHub Projects (Projects v2)
router.get('/github/projects', async (req, res) => {
  const { repo: requestedRepo, userId } = req.query;
  let token = process.env.GITHUB_TOKEN || '';
  if (userId) {
    const u = users.find(usr => usr.id === String(userId));
    if (u?.githubAccessToken) token = u.githubAccessToken;
  }

  const defaultRepo = (typeof requestedRepo === 'string' && requestedRepo.trim())
    ? requestedRepo.trim()
    : (process.env.GITHUB_DEFAULT_REPO || 'syuhadahanif13/task-management');

  if (!token) {
    return res.json({ projects: [], hasToken: false, defaultRepo });
  }

  const [owner, repoName] = defaultRepo.split('/');

  try {
    const graphqlQuery = {
      query: `
        query($owner: String!, $repoName: String!) {
          viewer {
            login
            projectsV2(first: 20) {
              nodes {
                id
                number
                title
                url
                closed
                shortDescription
              }
            }
          }
          user(login: $owner) {
            projectsV2(first: 20) {
              nodes {
                id
                number
                title
                url
                closed
                shortDescription
              }
            }
          }
          repository(owner: $owner, name: $repoName) {
            projectsV2(first: 20) {
              nodes {
                id
                number
                title
                url
                closed
                shortDescription
              }
            }
          }
        }
      `,
      variables: { owner: owner || 'syuhadahanif13', repoName: repoName || 'task-management' },
    };

    const gqlRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'User-Agent': 'TaskManagementSystem-App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
    });

    const projectList: Array<{ id: string; number: number; title: string; url: string; owner: string; description?: string }> = [];
    const seenUrls = new Set<string>();

    if (gqlRes.ok) {
      const gqlData: any = await gqlRes.json();
      const viewerProjects = gqlData.data?.viewer?.projectsV2?.nodes || [];
      const userProjects = gqlData.data?.user?.projectsV2?.nodes || [];
      const repoProjects = gqlData.data?.repository?.projectsV2?.nodes || [];

      for (const p of [...viewerProjects, ...userProjects, ...repoProjects]) {
        if (p && !p.closed && !seenUrls.has(p.url)) {
          seenUrls.add(p.url);
          projectList.push({
            id: p.id,
            number: p.number,
            title: p.title,
            url: p.url,
            owner: p.url.includes('/users/') ? p.url.split('/users/')[1].split('/')[0] : (owner || 'GitHub'),
            description: p.shortDescription || undefined,
          });
        }
      }
    }

    res.json({
      projects: projectList,
      hasToken: true,
      defaultRepo,
    });
  } catch (err: any) {
    console.warn('Failed to query GitHub projects:', err.message);
    res.json({ projects: [], hasToken: true, defaultRepo, error: err.message });
  }
});

// 8c. Create GitHub Issue from Task and optionally add to GitHub Project
router.post('/github/task-issue/create', async (req, res) => {
  const { taskId, repo: requestedRepo, projectId, projectTitle, projectUrl, userId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId is required' });

  let targetTask: Task | undefined;
  let targetMeetingId = 'general-tasks';
  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId);
    if (f) {
      targetTask = f;
      targetMeetingId = m.id;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const f = (m.tasks || []).find(t => t.id === taskId);
      if (f) {
        targetTask = f;
        targetMeetingId = m.id;
        break;
      }
    }
  }

  if (!targetTask) return res.status(404).json({ error: 'Task tidak ditemukan' });

  let token = process.env.GITHUB_TOKEN || '';
  if (userId) {
    const u = users.find(usr => usr.id === userId);
    if (u?.githubAccessToken) token = u.githubAccessToken;
  }

  if (!token) {
    return res.status(400).json({ error: 'GitHub Token belum dikonfigurasi di server atau akun Anda.' });
  }

  const repo = (typeof requestedRepo === 'string' && requestedRepo.trim())
    ? requestedRepo.trim()
    : targetTask.githubRepo;

  if (!repo) {
    return res.status(400).json({ error: 'Task ini belum memiliki Project Git / Repositori. Silakan pilih project Git terlebih dahulu.' });
  }

  const repoParts = repo.split('/');
  if (repoParts.length !== 2) {
    return res.status(400).json({ error: `Format repo tidak valid: '${repo}'. Harus berupa 'owner/repo'.` });
  }
  const [owner, repoName] = repoParts;

  // Generate Task Key
  const taskNumberMatch = taskId.match(/task-(\d+)/i) || taskId.match(/(\d+)/);
  const taskNum = taskNumberMatch ? taskNumberMatch[1] : '';
  const taskKey = taskNum ? `REI-${taskNum}` : `REI-${taskId.slice(-6)}`;

  // Construct GitHub Issue Payload
  const issueTitle = `[${taskKey}] ${targetTask.title}`;
  const issueBody = `### 📋 Task Action Item
- **Task Key**: \`${taskKey}\`
- **Task ID**: \`${targetTask.id}\`
- **Assignee**: **${targetTask.assignee || 'Unassigned'}**
- **Due Date**: ${targetTask.dueDate || 'N/A'} ${targetTask.dueTime ? `(${targetTask.dueTime})` : ''}
- **Status**: \`${targetTask.status}\`
- **Priority**: \`${targetTask.priority || 'Medium'}\`

### 📝 Deskripsi
${targetTask.description || '*Tidak ada deskripsi tambahan.*'}

${targetTask.tags && targetTask.tags.length > 0 ? `\n### 🏷️ Tags\n${targetTask.tags.map((t: string) => `\`${t}\``).join(' ')}` : ''}

---
*Dibuat otomatis dari Task Management System REI*`;

  try {
    const createIssueRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'TaskManagementSystem-App',
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ['task', (targetTask.priority || 'Medium').toLowerCase()],
      }),
    });

    if (!createIssueRes.ok) {
      const err = await createIssueRes.json().catch(() => ({}));
      return res.status(createIssueRes.status).json({
        error: err.message || 'Gagal membuat issue di GitHub',
      });
    }

    const apiIssue: any = await createIssueRes.json();

    // If projectId is specified, add the created issue to GitHub Project v2 via GraphQL
    if (projectId) {
      try {
        const addCardQuery = {
          query: `
            mutation($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
                item {
                  id
                }
              }
            }
          `,
          variables: { projectId, contentId: apiIssue.node_id },
        };

        await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            Authorization: `bearer ${token}`,
            'User-Agent': 'TaskManagementSystem-App',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(addCardQuery),
        });
      } catch (e: any) {
        console.warn('Gagal menambahkan issue ke Project v2:', e.message);
      }
    }

    const metadata = targetTask.githubMetadata || { repo, branches: [], commits: [], pullRequests: [] };
    metadata.repo = repo;
    metadata.issue = {
      id: apiIssue.id,
      number: apiIssue.number,
      title: apiIssue.title,
      url: apiIssue.html_url,
      state: apiIssue.state,
      assignee: apiIssue.assignee?.login,
      labels: (apiIssue.labels || []).map((l: any) => typeof l === 'string' ? l : l.name),
      commentsCount: apiIssue.comments || 0,
      createdAt: apiIssue.created_at,
      updatedAt: apiIssue.updated_at,
    };

    if (projectUrl) {
      metadata.project = {
        id: projectId,
        title: projectTitle || `Project GitHub`,
        url: projectUrl,
      };
      targetTask.githubProjectUrl = projectUrl;
    }

    targetTask.githubIssueUrl = apiIssue.html_url;
    targetTask.githubRepo = repo;
    targetTask.githubMetadata = metadata;
    targetTask.updatedAt = new Date().toISOString();

    if (isMysqlConfigured()) {
      await mysqlUpsertTask(targetMeetingId, targetTask);
    }

    res.json({
      message: `Issue #${apiIssue.number} berhasil dibuat dan ditautkan ke GitHub`,
      issue: metadata.issue,
      project: metadata.project,
      task: targetTask,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Terjadi kesalahan saat membuat issue GitHub' });
  }
});

// 8d. Update GitHub Issue Status (Open / Close / Sync)
router.post('/github/task-issue/update-status', async (req, res) => {
  const { taskId, state, syncTaskDone, userId } = req.body;
  if (!taskId || !state) {
    return res.status(400).json({ error: 'taskId and state (open/closed/sync) are required' });
  }

  let targetTask: Task | undefined;
  let targetMeetingId = 'general-tasks';
  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId);
    if (f) {
      targetTask = f;
      targetMeetingId = m.id;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const f = (m.tasks || []).find(t => t.id === taskId);
      if (f) {
        targetTask = f;
        targetMeetingId = m.id;
        break;
      }
    }
  }

  if (!targetTask) return res.status(404).json({ error: 'Task tidak ditemukan' });

  const metadata = targetTask.githubMetadata;
  if (!metadata?.issue?.number) {
    return res.status(400).json({ error: 'Task belum memiliki GitHub Issue yang terhubung' });
  }

  const repo = metadata.repo || targetTask.githubRepo || process.env.GITHUB_DEFAULT_REPO || 'syuhadahanif13/task-management';
  const [owner, repoName] = repo.split('/');

  let token = process.env.GITHUB_TOKEN || '';
  if (userId) {
    const u = users.find(usr => usr.id === userId);
    if (u?.githubAccessToken) token = u.githubAccessToken;
  }

  if (!token) {
    return res.status(400).json({ error: 'GitHub Token belum tersedia' });
  }

  try {
    let apiIssue: any;
    if (state === 'closed' || state === 'open') {
      const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${metadata.issue.number}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'TaskManagementSystem-App',
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ state }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        return res.status(patchRes.status).json({ error: err.message || 'Gagal mengubah status issue di GitHub' });
      }
      apiIssue = await patchRes.json();
    } else {
      // Sync only
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${metadata.issue.number}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'TaskManagementSystem-App',
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        return res.status(getRes.status).json({ error: err.message || 'Gagal mengambil status issue dari GitHub' });
      }
      apiIssue = await getRes.json();
    }

    metadata.issue.state = apiIssue.state;
    metadata.issue.title = apiIssue.title;
    metadata.issue.commentsCount = apiIssue.comments || 0;
    metadata.issue.updatedAt = apiIssue.updated_at;

    if (syncTaskDone) {
      if (apiIssue.state === 'closed') {
        targetTask.status = 'Done';
      } else if (apiIssue.state === 'open' && targetTask.status === 'Done') {
        targetTask.status = 'In Progress';
      }
    }

    targetTask.githubMetadata = metadata;
    targetTask.updatedAt = new Date().toISOString();

    if (isMysqlConfigured()) {
      await mysqlUpsertTask(targetMeetingId, targetTask);
    }

    res.json({
      message: `Status GitHub Issue #${apiIssue.number} berhasil diperbarui menjadi ${apiIssue.state}`,
      issue: metadata.issue,
      task: targetTask,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengupdate status GitHub Issue' });
  }
});

// 8e. Link Task to GitHub Project
router.post('/github/task-project/link', async (req, res) => {
  const { taskId, projectUrl, projectTitle, projectId } = req.body;
  if (!taskId || !projectUrl) {
    return res.status(400).json({ error: 'taskId and projectUrl are required' });
  }

  let targetTask: Task | undefined;
  let targetMeetingId = 'general-tasks';
  for (const m of meetings) {
    const f = (m.tasks || []).find(t => t.id === taskId);
    if (f) {
      targetTask = f;
      targetMeetingId = m.id;
      break;
    }
  }

  if (!targetTask && isMysqlConfigured()) {
    await syncMeetingsFromDatabase();
    for (const m of meetings) {
      const f = (m.tasks || []).find(t => t.id === taskId);
      if (f) {
        targetTask = f;
        targetMeetingId = m.id;
        break;
      }
    }
  }

  if (!targetTask) return res.status(404).json({ error: 'Task tidak ditemukan' });

  const metadata = targetTask.githubMetadata || { repo: '', branches: [], commits: [], pullRequests: [] };
  metadata.project = {
    id: projectId,
    title: projectTitle || 'GitHub Project',
    url: projectUrl,
  };
  targetTask.githubProjectUrl = projectUrl;
  targetTask.githubMetadata = metadata;
  targetTask.updatedAt = new Date().toISOString();

  if (isMysqlConfigured()) {
    await mysqlUpsertTask(targetMeetingId, targetTask);
  }

  res.json({
    message: 'Task berhasil dihubungkan ke GitHub Project',
    project: metadata.project,
    task: targetTask,
  });
});

// 9. Webhook Receiver for GitHub (push, pull_request)
router.post('/github/webhook', async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (!payload) return res.status(400).send('No payload');

  try {
    await syncMeetingsFromDatabase();

    // Event 1: Pull Request
    if (event === 'pull_request') {
      const pr = payload.pull_request;
      const action = payload.action;
      const repoFullName = payload.repository?.full_name || '';

      if (pr) {
        const prTitle = (pr.title || '').toLowerCase();
        const prBody = (pr.body || '').toLowerCase();
        const prBranch = (pr.head?.ref || '').toLowerCase();

        for (const m of meetings) {
          for (const t of m.tasks || []) {
            const taskMatch = t.id.toLowerCase();
            const numMatch = (t.id.match(/task-(\d+)/i) || [])[1];
            const isMatch = prTitle.includes(taskMatch) ||
              prBody.includes(taskMatch) ||
              prBranch.includes(taskMatch) ||
              (numMatch && (prTitle.includes(`#${numMatch}`) || prBranch.includes(`task-${numMatch}`)));

            if (isMatch) {
              const meta = t.githubMetadata || { repo: repoFullName, branches: [], commits: [], pullRequests: [] };
              meta.repo = repoFullName;
              meta.pullRequests = meta.pullRequests || [];

              const prObj = {
                number: pr.number,
                title: pr.title,
                url: pr.html_url,
                state: pr.merged_at ? 'merged' : pr.state,
                author: pr.user?.login || 'Unknown',
                authorAvatar: pr.user?.avatar_url,
                branch: pr.head?.ref,
                mergedAt: pr.merged_at,
                updatedAt: pr.updated_at,
              };

              const idx = meta.pullRequests.findIndex(p => p.number === pr.number);
              if (idx >= 0) meta.pullRequests[idx] = prObj;
              else meta.pullRequests.unshift(prObj);

              t.githubMetadata = meta;
              t.githubPrUrl = pr.html_url;

              // Jira-like automation: If PR is merged, transition status to Done or Pending Approval
              if (pr.merged_at) {
                t.status = 'Done';
              } else if (action === 'opened' && t.status === 'To Do') {
                t.status = 'In Progress';
              }

              t.updatedAt = new Date().toISOString();
              if (isMysqlConfigured()) {
                await mysqlUpsertTask(m.id, t);
              }
            }
          }
        }
      }
    }

    // Event 2: Push
    if (event === 'push') {
      const commitsList = payload.commits || [];
      const repoFullName = payload.repository?.full_name || '';

      for (const c of commitsList) {
        const msg = (c.message || '').toLowerCase();
        for (const m of meetings) {
          for (const t of m.tasks || []) {
            const taskMatch = t.id.toLowerCase();
            const numMatch = (t.id.match(/task-(\d+)/i) || [])[1];
            const isMatch = msg.includes(taskMatch) || (numMatch && msg.includes(`#${numMatch}`));

            if (isMatch) {
              const meta = t.githubMetadata || { repo: repoFullName, branches: [], commits: [], pullRequests: [] };
              meta.repo = repoFullName;
              meta.commits = meta.commits || [];

              const shortSha = c.id.substring(0, 7);
              const commitObj = {
                id: shortSha,
                fullSha: c.id,
                message: c.message.split('\n')[0],
                author: c.author?.name || c.author?.username || 'Unknown',
                url: c.url,
                timestamp: c.timestamp,
              };

              const idx = meta.commits.findIndex(cm => cm.id === shortSha);
              if (idx >= 0) meta.commits[idx] = commitObj;
              else meta.commits.unshift(commitObj);

              t.githubMetadata = meta;
              if (t.status === 'To Do') {
                t.status = 'In Progress';
              }
              t.updatedAt = new Date().toISOString();

              if (isMysqlConfigured()) {
                await mysqlUpsertTask(m.id, t);
              }
            }
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('GitHub webhook error:', err);
    res.status(500).json({ error: err.message });
  }
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
