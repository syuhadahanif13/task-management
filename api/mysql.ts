import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function isMysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_DATABASE &&
    process.env.MYSQL_USER
  );
}

export function getMysqlPool(): mysql.Pool | null {
  if (pool) return pool;
  if (!isMysqlConfigured()) return null;

  try {
    pool = mysql.createPool({
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
    return pool;
  } catch (err: any) {
    console.error('Failed to initialize MySQL pool:', err.message);
    return null;
  }
}

export async function mysqlGetMeetings(): Promise<any[]> {
  const p = getMysqlPool();
  if (!p) return [];

  const [meetingsRows]: any = await p.query(
    'SELECT * FROM meetings ORDER BY meeting_date DESC, created_at DESC;'
  );
  const [tasksRows]: any = await p.query(
    'SELECT * FROM tasks ORDER BY due_date ASC, created_at ASC;'
  );

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

  return meetings;
}

export async function mysqlCreateMeeting(meeting: any): Promise<void> {
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
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM meetings WHERE id = ?', [id]);
}

export async function mysqlUpsertTask(meetingId: string, task: any): Promise<void> {
  const p = getMysqlPool();
  if (!p) return;

  const rawAssignees = Array.isArray(task.assignees)
    ? task.assignees
    : (task.assignee ? String(task.assignee).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  const resolvedAssignee = rawAssignees.length > 0 ? rawAssignees.join(', ') : (task.assignee || 'Unassigned');
  const assigneesJson = JSON.stringify(rawAssignees.length > 0 ? rawAssignees : [resolvedAssignee]);
  const tagsJson = JSON.stringify(Array.isArray(task.tags) ? task.tags : []);
  const dueDate = String(task.dueDate || task.due_date || new Date().toISOString().split('T')[0]).split('T')[0];

  await p.execute(
    `INSERT INTO tasks (id, meeting_id, title, assignee, assignees, due_date, due_time, status, priority, description, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
      createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      updatedAt: t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString(),
      meetingTitle: t.meeting_title || 'Tugas Mandiri',
      meetingDate: meetingDateStr,
    };
  });
}

export async function mysqlDeleteTask(id: string): Promise<void> {
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM tasks WHERE id = ?', [id]);
}

export async function mysqlGetDivisions(): Promise<any[]> {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows]: any = await p.query('SELECT * FROM divisions ORDER BY name ASC');
  return rows.map((d: any) => ({
    id: d.id,
    name: d.name,
    createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
    updatedAt: d.updated_at ? new Date(d.updated_at).toISOString() : new Date().toISOString(),
  }));
}

export async function mysqlCreateDivision(id: string, name: string): Promise<any> {
  const p = getMysqlPool();
  if (!p) return { id, name };
  await p.execute('INSERT INTO divisions (id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [id, name]);
  return { id, name };
}

export async function mysqlDeleteDivision(id: string): Promise<void> {
  const p = getMysqlPool();
  if (!p) return;
  await p.execute('DELETE FROM divisions WHERE id = ?', [id]);
}

export async function mysqlGetUsers(): Promise<any[]> {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows]: any = await p.query('SELECT id, username, password, division_id, role, created_at, updated_at FROM users ORDER BY username ASC');
  return rows.map((u: any) => ({
    id: u.id,
    username: u.username,
    password: u.password,
    divisionId: u.division_id,
    role: u.role || 'user',
    createdAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
    updatedAt: u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString(),
  }));
}

export async function mysqlCreateUser(user: any): Promise<any> {
  const p = getMysqlPool();
  if (!p) return user;
  await p.execute(
    'INSERT INTO users (id, username, password, division_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
    [user.id, user.username, user.password, user.divisionId || null, user.role || 'user']
  );
  return user;
}

export async function mysqlDeleteUser(id: string): Promise<void> {
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
