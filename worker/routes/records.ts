import { Hono } from 'hono';
import {
  Env,
  generateId,
  queryAll,
  queryFirst,
  executeRun,
  verifyWorkspaceRole,
  hasMinimumRole,
  recordAuditLog,
  recalculateProjectProgress,
} from '../database/d1';
import { requireAuth, AppVariables } from '../middleware/authMiddleware';

export const recordsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

recordsRoutes.use('*', requireAuth);

function parseJsonArray<T = string>(raw: unknown): T[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET /api/records/bootstrap?workspaceId=...&limit=100&offset=0
// Fetches indexed, workspace-isolated records for the active workspace
recordsRoutes.get('/bootstrap', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.query('workspaceId') || '';
  const limit = Math.min(200, Math.max(10, Number(c.req.query('limit')) || 100));
  const offset = Math.max(0, Number(c.req.query('offset')) || 0);

  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) {
    return c.json({ error: 'Unauthorized workspace access.' }, 403);
  }

  const memRows = await queryAll<{ user_id: string }>(
    c.env.DB,
    `SELECT user_id FROM workspace_members WHERE workspace_id = ?`,
    [workspaceId]
  );
  const memberUids = memRows.map((m) => m.user_id);

  // 1. Projects
  const projRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const projects = projRows.map((p) => ({
    id: String(p.id),
    workspaceId: String(p.workspace_id),
    name: String(p.name),
    description: String(p.description || ''),
    ownerId: String(p.owner_id),
    ownerName: String(p.owner_name),
    startDate: String(p.start_date || ''),
    targetDeadline: String(p.target_deadline || ''),
    status: String(p.status),
    priority: String(p.priority),
    notes: String(p.notes || ''),
    progressPercentage: Number(p.progress_percentage || 0),
    memberUids,
    createdBy: String(p.created_by),
    createdAt: String(p.created_at),
    updatedAt: String(p.updated_at),
  }));

  // 2. Tasks + Normalized Task Checklists
  const taskRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM tasks WHERE workspace_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const checklistRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM task_checklists WHERE workspace_id = ? ORDER BY sort_order ASC`,
    [workspaceId]
  );
  const checklistsByTask = new Map<string, { id: string; text: string; done: boolean }[]>();
  for (const chk of checklistRows) {
    const tId = String(chk.task_id);
    const list = checklistsByTask.get(tId) || [];
    list.push({
      id: String(chk.id),
      text: String(chk.text),
      done: Boolean(chk.done),
    });
    checklistsByTask.set(tId, list);
  }

  const tasks = taskRows.map((t) => {
    const tId = String(t.id);
    const chkList = checklistsByTask.get(tId) || [];
    return {
      id: tId,
      workspaceId: String(t.workspace_id),
      title: String(t.title),
      description: String(t.description || ''),
      projectId: String(t.project_id || ''),
      projectName: String(t.project_name || ''),
      assignedTo: String(t.assigned_to),
      assignedToName: String(t.assigned_to_name),
      createdBy: String(t.created_by),
      createdByName: String(t.created_by_name),
      startDate: String(t.start_date || ''),
      dueDate: String(t.due_date || ''),
      priority: String(t.priority),
      status: String(t.status),
      estimatedHours: Number(t.estimated_hours || 0),
      actualHours: Number(t.actual_hours || 0),
      tags: parseJsonArray<string>(t.tags_json),
      checklistSummary: JSON.stringify(chkList),
      completionDate: String(t.completion_date || ''),
      isArchived: Boolean(t.is_archived),
      memberUids,
      createdAt: String(t.created_at),
      updatedAt: String(t.updated_at),
    };
  });

  // 3. Planner Activities
  const planRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM planner_activities WHERE workspace_id = ? AND is_archived = 0 ORDER BY start_date ASC, start_time ASC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const plannerActivities = planRows.map((a) => ({
    id: String(a.id),
    workspaceId: String(a.workspace_id),
    title: String(a.title),
    description: String(a.description || ''),
    startDate: String(a.start_date),
    endDate: String(a.end_date),
    startTime: String(a.start_time),
    endTime: String(a.end_time),
    priority: String(a.priority),
    category: String(a.category),
    projectId: String(a.project_id || ''),
    projectName: String(a.project_name || ''),
    reminderMinutes: Number(a.reminder_minutes || 0),
    recurrence: String(a.recurrence || 'None'),
    completed: Boolean(a.completed),
    isArchived: Boolean(a.is_archived),
    memberUids,
    createdBy: String(a.created_by),
    createdAt: String(a.created_at),
    updatedAt: String(a.updated_at),
  }));

  // 4. Work Journal Entries — Strictly enforce Private-by-Default rule in SQL
  const jrnlRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM journal_entries
     WHERE workspace_id = ? AND is_archived = 0 AND (created_by = ? OR visibility = 'Shared')
     ORDER BY entry_date DESC, created_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, user.id, limit, offset]
  );
  const journalEntries = jrnlRows.map((j) => ({
    id: String(j.id),
    workspaceId: String(j.workspace_id),
    title: String(j.title),
    entryDate: String(j.entry_date),
    entryTime: String(j.entry_time || '17:00'),
    category: String(j.category || 'General'),
    projectId: String(j.project_id || ''),
    projectName: String(j.project_name || ''),
    relatedTaskId: String(j.related_task_id || ''),
    relatedTaskTitle: String(j.related_task_title || ''),
    description: String(j.description || ''),
    activitiesPerformed: String(j.activities_performed || ''),
    achievements: String(j.achievements || ''),
    challenges: String(j.challenges || ''),
    decisionsMade: String(j.decisions_made || ''),
    lessonsLearned: String(j.lessons_learned || ''),
    nextSteps: String(j.next_steps || ''),
    timeSpentHours: Number(j.time_spent_hours || 0),
    tags: parseJsonArray<string>(j.tags_json),
    visibility: j.visibility === 'Shared' ? 'Shared' : 'Private',
    isArchived: Boolean(j.is_archived),
    memberUids,
    createdBy: String(j.created_by),
    createdByName: String(j.created_by_name),
    createdAt: String(j.created_at),
    updatedAt: String(j.updated_at),
  }));

  // 5. Analysis Records
  const anlRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM analysis_records WHERE workspace_id = ? AND is_archived = 0 ORDER BY analysis_date DESC, created_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const analysisRecords = anlRows.map((a) => ({
    id: String(a.id),
    workspaceId: String(a.workspace_id),
    title: String(a.title),
    category: String(a.category),
    analysisDate: String(a.analysis_date),
    projectId: String(a.project_id || ''),
    projectName: String(a.project_name || ''),
    objective: String(a.objective || ''),
    problemStatement: String(a.problem_statement || ''),
    datasetDescription: String(a.dataset_description || ''),
    methodology: String(a.methodology || ''),
    observations: String(a.observations || ''),
    keyFindings: String(a.key_findings || ''),
    risksAndAssumptions: String(a.risks_and_assumptions || ''),
    conclusion: String(a.conclusion || ''),
    recommendations: String(a.recommendations || ''),
    expectedOutcome: String(a.expected_outcome || ''),
    actualOutcome: String(a.actual_outcome || ''),
    confidenceLevel: String(a.confidence_level || 'High'),
    status: String(a.status || 'Completed'),
    supportingLinks: String(a.supporting_links || ''),
    relatedTaskId: String(a.related_task_id || ''),
    stockSymbol: String(a.stock_symbol || ''),
    exchange: String(a.exchange || ''),
    timeframe: String(a.timeframe || ''),
    marketTrend: String(a.market_trend || ''),
    technicalObservations: String(a.technical_observations || ''),
    supportAndResistance: String(a.support_and_resistance || ''),
    indicatorsUsed: String(a.indicators_used || ''),
    tradingThesis: String(a.trading_thesis || ''),
    entryExitAssumptions: String(a.entry_exit_assumptions || ''),
    stopLossAssumption: String(a.stop_loss_assumption || ''),
    targetAssumption: String(a.target_assumption || ''),
    riskRewardRatio: String(a.risk_reward_ratio || ''),
    actualResult: String(a.actual_result || ''),
    lessonsLearned: String(a.lessons_learned || ''),
    isArchived: Boolean(a.is_archived),
    memberUids,
    createdBy: String(a.created_by),
    createdByName: String(a.created_by_name),
    createdAt: String(a.created_at),
    updatedAt: String(a.updated_at),
  }));

  // 6. Work Sessions
  const sessRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM work_sessions WHERE workspace_id = ? ORDER BY session_date DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const workSessions = sessRows.map((s) => ({
    id: String(s.id),
    workspaceId: String(s.workspace_id),
    title: String(s.title),
    projectId: String(s.project_id || ''),
    taskId: String(s.task_id || ''),
    durationHours: Number(s.duration_hours || 0),
    sessionDate: String(s.session_date),
    notes: String(s.notes || ''),
    memberUids,
    createdBy: String(s.created_by),
    createdAt: String(s.created_at),
    updatedAt: String(s.updated_at),
  }));

  // 7. Task Comments
  const commRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM task_comments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const comments = commRows.map((cm) => ({
    id: String(cm.id),
    workspaceId: String(cm.workspace_id),
    targetType: String(cm.target_type),
    targetId: String(cm.target_id),
    content: String(cm.content),
    authorName: String(cm.author_name),
    memberUids,
    createdBy: String(cm.created_by),
    createdAt: String(cm.created_at),
    updatedAt: String(cm.updated_at),
  }));

  // 8. Milestones
  const msRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM milestones WHERE workspace_id = ? ORDER BY due_date ASC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const milestones = msRows.map((m) => ({
    id: String(m.id),
    workspaceId: String(m.workspace_id),
    projectId: String(m.project_id),
    title: String(m.title),
    dueDate: String(m.due_date),
    completed: Boolean(m.completed),
    memberUids,
    createdBy: String(m.created_by),
    createdAt: String(m.created_at),
    updatedAt: String(m.updated_at),
  }));

  // 9. Notifications (User-specific)
  const notifRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 100`,
    [user.id]
  );
  const notifications = notifRows.map((n) => ({
    id: String(n.id),
    workspaceId: String(n.workspace_id),
    recipientId: String(n.recipient_id),
    type: String(n.type),
    title: String(n.title),
    message: String(n.message),
    linkTab: String(n.link_tab || 'dashboard'),
    targetId: String(n.target_id || ''),
    read: Boolean(n.read),
    createdBy: String(n.created_by),
    createdAt: String(n.created_at),
    updatedAt: String(n.updated_at),
  }));

  // 10. Audit Logs (Track Record)
  const logRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );
  const auditLogs = logRows.map((l) => ({
    id: String(l.id),
    workspaceId: String(l.workspace_id),
    actionType: String(l.action_type),
    entityType: String(l.entity_type),
    entityId: String(l.entity_id),
    entityTitle: String(l.entity_title),
    projectId: String(l.project_id || ''),
    category: String(l.category || 'General'),
    summary: String(l.summary),
    actorName: String(l.actor_name),
    memberUids,
    createdBy: String(l.created_by),
    createdAt: String(l.created_at),
    updatedAt: String(l.updated_at),
  }));

  return c.json({
    role,
    projects,
    tasks,
    plannerActivities,
    journalEntries,
    analysisRecords,
    workSessions,
    comments,
    milestones,
    notifications,
    auditLogs,
  });
});

// ============================================================================
// PROJECTS CRUD
// ============================================================================
recordsRoutes.post('/projects', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!hasMinimumRole(role, 'Manager')) {
    // In Personal workspaces user is Owner; in Team workspaces Manager/Admin/Owner can create projects
    if (role !== 'Member') {
      return c.json({ error: 'Unauthorized workspace access.' }, 403);
    }
  }
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('proj');
  const now = new Date().toISOString();
  const name = String(body.name || 'Untitled Project').trim().slice(0, 160);
  const description = String(body.description || '').trim().slice(0, 4000);
  const startDate = String(body.startDate || now.split('T')[0]).slice(0, 32);
  const targetDeadline = String(body.targetDeadline || '').slice(0, 32);
  const status = String(body.status || 'Active');
  const priority = String(body.priority || 'Medium');
  const notes = String(body.notes || '').slice(0, 8000);

  await executeRun(
    c.env.DB,
    `INSERT INTO projects (
      id, workspace_id, name, description, owner_id, owner_name,
      start_date, target_deadline, status, priority, notes,
      progress_percentage, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      workspaceId,
      name,
      description,
      user.id,
      user.displayName,
      startDate,
      targetDeadline,
      status,
      priority,
      notes,
      user.id,
      now,
      now,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Project Created',
    entityType: 'project',
    entityId: id,
    entityTitle: name,
    projectId: id,
    category: status,
    summary: `Created project "${name}" (${priority} priority).`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now, updatedAt: now });
});

recordsRoutes.put('/projects/:id', async (c) => {
  const user = c.get('user');
  const projectId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const existing = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM projects WHERE id = ? AND workspace_id = ? LIMIT 1`,
    [projectId, workspaceId]
  );
  if (!existing) return c.json({ error: 'Project not found.' }, 404);

  const now = new Date().toISOString();
  const name = String(body.name ?? existing.name).trim().slice(0, 160);
  const description = String(body.description ?? existing.description).slice(0, 4000);
  const startDate = String(body.startDate ?? existing.start_date).slice(0, 32);
  const targetDeadline = String(body.targetDeadline ?? existing.target_deadline).slice(0, 32);
  const status = String(body.status ?? existing.status);
  const priority = String(body.priority ?? existing.priority);
  const notes = String(body.notes ?? existing.notes).slice(0, 8000);

  await executeRun(
    c.env.DB,
    `UPDATE projects SET
      name = ?, description = ?, start_date = ?, target_deadline = ?,
      status = ?, priority = ?, notes = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
    [name, description, startDate, targetDeadline, status, priority, notes, now, projectId, workspaceId]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Project Updated',
    entityType: 'project',
    entityId: projectId,
    entityTitle: name,
    projectId,
    category: status,
    summary: `Updated project "${name}" (${status}).`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ success: true, updatedAt: now });
});

// ============================================================================
// TASKS + TASK_CHECKLISTS CRUD
// ============================================================================
async function syncTaskChecklistRows(
  db: Env['DB'],
  workspaceId: string,
  taskId: string,
  userId: string,
  checklistSummaryRaw: unknown
) {
  let items: { id?: string; text?: string; done?: boolean }[] = [];
  if (typeof checklistSummaryRaw === 'string' && checklistSummaryRaw) {
    try {
      items = JSON.parse(checklistSummaryRaw);
    } catch {
      items = [];
    }
  } else if (Array.isArray(checklistSummaryRaw)) {
    items = checklistSummaryRaw;
  }

  await executeRun(db, `DELETE FROM task_checklists WHERE task_id = ? AND workspace_id = ?`, [taskId, workspaceId]);
  const now = new Date().toISOString();
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const text = String(item.text || '').trim().slice(0, 500);
    if (!text) continue;
    const chkId = item.id && String(item.id).length <= 64 ? String(item.id) : generateId('chk');
    await executeRun(
      db,
      `INSERT INTO task_checklists (id, task_id, workspace_id, text, done, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [chkId, taskId, workspaceId, text, item.done ? 1 : 0, idx, userId, now, now]
    );
  }
}

recordsRoutes.post('/tasks', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('task');
  const now = new Date().toISOString();
  const title = String(body.title || 'Untitled Task').trim().slice(0, 200);
  const description = String(body.description || '').slice(0, 5000);
  const projectId = String(body.projectId || '');
  const projectName = String(body.projectName || '');
  const assignedTo = String(body.assignedTo || user.id);
  const assignedToName = String(body.assignedToName || user.displayName);
  const startDate = String(body.startDate || now.split('T')[0]);
  const dueDate = String(body.dueDate || '');
  const priority = String(body.priority || 'Medium');
  const status = String(body.status || 'Not Started');
  const estimatedHours = Math.max(0, Number(body.estimatedHours) || 0);
  const actualHours = Math.max(0, Number(body.actualHours) || 0);
  const tagsJson = JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 15) : []);
  const completionDate = status === 'Completed' ? now.split('T')[0] : '';

  await executeRun(
    c.env.DB,
    `INSERT INTO tasks (
      id, workspace_id, project_id, project_name, title, description,
      assigned_to, assigned_to_name, created_by, created_by_name,
      start_date, due_date, priority, status, estimated_hours, actual_hours,
      tags_json, completion_date, is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      workspaceId,
      projectId,
      projectName,
      title,
      description,
      assignedTo,
      assignedToName,
      user.id,
      user.displayName,
      startDate,
      dueDate,
      priority,
      status,
      estimatedHours,
      actualHours,
      tagsJson,
      completionDate,
      now,
      now,
    ]
  );

  await syncTaskChecklistRows(c.env.DB, workspaceId, id, user.id, body.checklistSummary);

  if (projectId) {
    await recalculateProjectProgress(c.env.DB, workspaceId, projectId);
  }

  if (assignedTo && assignedTo !== user.id) {
    const notifId = generateId('notif');
    await executeRun(
      c.env.DB,
      `INSERT INTO notifications (
        id, workspace_id, recipient_id, type, title, message, link_tab, target_id, read, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'assignment', ?, ?, 'tasks', ?, 0, ?, ?, ?)`,
      [
        notifId,
        workspaceId,
        assignedTo,
        `New Task Assigned: ${title}`,
        `${user.displayName} assigned you "${title}".`,
        id,
        user.id,
        now,
        now,
      ]
    );
  }

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Task Created',
    entityType: 'task',
    entityId: id,
    entityTitle: title,
    projectId,
    category: priority,
    summary: `Created task "${title}" (${status}).`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now, updatedAt: now });
});

recordsRoutes.put('/tasks/:id', async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const existing = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM tasks WHERE id = ? AND workspace_id = ? LIMIT 1`,
    [taskId, workspaceId]
  );
  if (!existing) return c.json({ error: 'Task not found.' }, 404);

  const now = new Date().toISOString();
  const title = String(body.title ?? existing.title).trim().slice(0, 200);
  const description = String(body.description ?? existing.description).slice(0, 5000);
  const projectId = String(body.projectId ?? existing.project_id);
  const projectName = String(body.projectName ?? existing.project_name);
  const assignedTo = String(body.assignedTo ?? existing.assigned_to);
  const assignedToName = String(body.assignedToName ?? existing.assigned_to_name);
  const startDate = String(body.startDate ?? existing.start_date);
  const dueDate = String(body.dueDate ?? existing.due_date);
  const priority = String(body.priority ?? existing.priority);
  const status = String(body.status ?? existing.status);
  const estimatedHours = Math.max(0, Number(body.estimatedHours ?? existing.estimated_hours) || 0);
  const actualHours = Math.max(0, Number(body.actualHours ?? existing.actual_hours) || 0);
  const tagsJson =
    body.tags !== undefined
      ? JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 15) : [])
      : String(existing.tags_json || '[]');
  const isArchived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : Number(existing.is_archived || 0);
  const completionDate =
    status === 'Completed'
      ? String(existing.completion_date || now.split('T')[0])
      : '';

  await executeRun(
    c.env.DB,
    `UPDATE tasks SET
      project_id = ?, project_name = ?, title = ?, description = ?,
      assigned_to = ?, assigned_to_name = ?, start_date = ?, due_date = ?,
      priority = ?, status = ?, estimated_hours = ?, actual_hours = ?,
      tags_json = ?, completion_date = ?, is_archived = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
    [
      projectId,
      projectName,
      title,
      description,
      assignedTo,
      assignedToName,
      startDate,
      dueDate,
      priority,
      status,
      estimatedHours,
      actualHours,
      tagsJson,
      completionDate,
      isArchived,
      now,
      taskId,
      workspaceId,
    ]
  );

  if (body.checklistSummary !== undefined) {
    await syncTaskChecklistRows(c.env.DB, workspaceId, taskId, user.id, body.checklistSummary);
  }

  if (projectId) {
    await recalculateProjectProgress(c.env.DB, workspaceId, projectId);
  }
  if (existing.project_id && String(existing.project_id) !== projectId) {
    await recalculateProjectProgress(c.env.DB, workspaceId, String(existing.project_id));
  }

  const actionType =
    status !== String(existing.status) ? `Task Status -> ${status}` : isArchived ? 'Task Archived' : 'Task Updated';

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType,
    entityType: 'task',
    entityId: taskId,
    entityTitle: title,
    projectId,
    category: priority,
    summary: `${actionType}: "${title}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ success: true, updatedAt: now });
});

// ============================================================================
// PLANNER ACTIVITIES CRUD
// ============================================================================
recordsRoutes.post('/planner', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('plan');
  const now = new Date().toISOString();
  const title = String(body.title || 'Planned Activity').trim().slice(0, 200);
  const description = String(body.description || '').slice(0, 3000);
  const startDate = String(body.startDate || now.split('T')[0]);
  const endDate = String(body.endDate || startDate);
  const startTime = String(body.startTime || '09:00');
  const endTime = String(body.endTime || '10:00');
  const priority = String(body.priority || 'Medium');
  const category = String(body.category || 'Work');
  const projectId = String(body.projectId || '');
  const projectName = String(body.projectName || '');
  const reminderMinutes = Math.max(0, Number(body.reminderMinutes) || 15);
  const recurrence = String(body.recurrence || 'None');
  const completed = body.completed ? 1 : 0;

  await executeRun(
    c.env.DB,
    `INSERT INTO planner_activities (
      id, workspace_id, project_id, project_name, title, description,
      start_date, end_date, start_time, end_time, priority, category,
      reminder_minutes, recurrence, completed, is_archived, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      workspaceId,
      projectId,
      projectName,
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      priority,
      category,
      reminderMinutes,
      recurrence,
      completed,
      user.id,
      now,
      now,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Planner Activity Scheduled',
    entityType: 'planner',
    entityId: id,
    entityTitle: title,
    projectId,
    category,
    summary: `Scheduled "${title}" on ${startDate} (${startTime}–${endTime}).`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now, updatedAt: now });
});

recordsRoutes.put('/planner/:id', async (c) => {
  const user = c.get('user');
  const activityId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const existing = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM planner_activities WHERE id = ? AND workspace_id = ? LIMIT 1`,
    [activityId, workspaceId]
  );
  if (!existing) return c.json({ error: 'Activity not found.' }, 404);

  const now = new Date().toISOString();
  const title = String(body.title ?? existing.title).trim().slice(0, 200);
  const description = String(body.description ?? existing.description).slice(0, 3000);
  const startDate = String(body.startDate ?? existing.start_date);
  const endDate = String(body.endDate ?? existing.end_date);
  const startTime = String(body.startTime ?? existing.start_time);
  const endTime = String(body.endTime ?? existing.end_time);
  const priority = String(body.priority ?? existing.priority);
  const category = String(body.category ?? existing.category);
  const projectId = String(body.projectId ?? existing.project_id);
  const projectName = String(body.projectName ?? existing.project_name);
  const reminderMinutes = Number(body.reminderMinutes ?? existing.reminder_minutes) || 0;
  const recurrence = String(body.recurrence ?? existing.recurrence);
  const completed = body.completed !== undefined ? (body.completed ? 1 : 0) : Number(existing.completed || 0);
  const isArchived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : Number(existing.is_archived || 0);

  await executeRun(
    c.env.DB,
    `UPDATE planner_activities SET
      project_id = ?, project_name = ?, title = ?, description = ?,
      start_date = ?, end_date = ?, start_time = ?, end_time = ?,
      priority = ?, category = ?, reminder_minutes = ?, recurrence = ?,
      completed = ?, is_archived = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
    [
      projectId,
      projectName,
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      priority,
      category,
      reminderMinutes,
      recurrence,
      completed,
      isArchived,
      now,
      activityId,
      workspaceId,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: completed && !existing.completed ? 'Activity Completed' : 'Activity Updated',
    entityType: 'planner',
    entityId: activityId,
    entityTitle: title,
    projectId,
    category,
    summary: `Updated planner activity "${title}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ success: true, updatedAt: now });
});

// ============================================================================
// WORK JOURNAL CRUD (Strictly enforces Private-by-Default Ownership)
// ============================================================================
recordsRoutes.post('/journal', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('jrnl');
  const now = new Date().toISOString();
  const title = String(body.title || 'Work Journal Entry').trim().slice(0, 200);
  const entryDate = String(body.entryDate || now.split('T')[0]);
  const entryTime = String(body.entryTime || '17:00');
  const category = String(body.category || 'General').slice(0, 64);
  const projectId = String(body.projectId || '');
  const projectName = String(body.projectName || '');
  const relatedTaskId = String(body.relatedTaskId || '');
  const relatedTaskTitle = String(body.relatedTaskTitle || '');
  const description = String(body.description || '').slice(0, 10000);
  const activitiesPerformed = String(body.activitiesPerformed || '').slice(0, 5000);
  const achievements = String(body.achievements || '').slice(0, 5000);
  const challenges = String(body.challenges || '').slice(0, 5000);
  const decisionsMade = String(body.decisionsMade || '').slice(0, 5000);
  const lessonsLearned = String(body.lessonsLearned || '').slice(0, 5000);
  const nextSteps = String(body.nextSteps || '').slice(0, 5000);
  const timeSpentHours = Math.min(24, Math.max(0, Number(body.timeSpentHours) || 0));
  const tagsJson = JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 15) : []);
  const visibility = body.visibility === 'Shared' ? 'Shared' : 'Private';

  await executeRun(
    c.env.DB,
    `INSERT INTO journal_entries (
      id, workspace_id, project_id, project_name, related_task_id, related_task_title,
      title, entry_date, entry_time, category, description, activities_performed,
      achievements, challenges, decisions_made, lessons_learned, next_steps,
      time_spent_hours, tags_json, visibility, is_archived,
      created_by, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      projectId,
      projectName,
      relatedTaskId,
      relatedTaskTitle,
      title,
      entryDate,
      entryTime,
      category,
      description,
      activitiesPerformed,
      achievements,
      challenges,
      decisionsMade,
      lessonsLearned,
      nextSteps,
      timeSpentHours,
      tagsJson,
      visibility,
      user.id,
      user.displayName,
      now,
      now,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Journal Entry Recorded',
    entityType: 'journal',
    entityId: id,
    entityTitle: title,
    projectId,
    category,
    summary: `Recorded ${visibility.toLowerCase()} journal entry "${title}" (${timeSpentHours}h).`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now, updatedAt: now });
});

recordsRoutes.put('/journal/:id', async (c) => {
  const user = c.get('user');
  const entryId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  // Enforce strict creator ownership on journal entry mutations
  const existing = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM journal_entries WHERE id = ? AND workspace_id = ? AND created_by = ? LIMIT 1`,
    [entryId, workspaceId, user.id]
  );
  if (!existing) {
    return c.json({ error: 'Journal entry not found or you are not the owner of this private record.' }, 403);
  }

  const now = new Date().toISOString();
  const title = String(body.title ?? existing.title).trim().slice(0, 200);
  const entryDate = String(body.entryDate ?? existing.entry_date);
  const entryTime = String(body.entryTime ?? existing.entry_time);
  const category = String(body.category ?? existing.category).slice(0, 64);
  const projectId = String(body.projectId ?? existing.project_id);
  const projectName = String(body.projectName ?? existing.project_name);
  const relatedTaskId = String(body.relatedTaskId ?? existing.related_task_id);
  const relatedTaskTitle = String(body.relatedTaskTitle ?? existing.related_task_title);
  const description = String(body.description ?? existing.description).slice(0, 10000);
  const activitiesPerformed = String(body.activitiesPerformed ?? existing.activities_performed).slice(0, 5000);
  const achievements = String(body.achievements ?? existing.achievements).slice(0, 5000);
  const challenges = String(body.challenges ?? existing.challenges).slice(0, 5000);
  const decisionsMade = String(body.decisionsMade ?? existing.decisions_made).slice(0, 5000);
  const lessonsLearned = String(body.lessonsLearned ?? existing.lessons_learned).slice(0, 5000);
  const nextSteps = String(body.nextSteps ?? existing.next_steps).slice(0, 5000);
  const timeSpentHours = Math.min(24, Math.max(0, Number(body.timeSpentHours ?? existing.time_spent_hours) || 0));
  const tagsJson =
    body.tags !== undefined
      ? JSON.stringify(Array.isArray(body.tags) ? body.tags.slice(0, 15) : [])
      : String(existing.tags_json || '[]');
  const visibility =
    body.visibility !== undefined
      ? body.visibility === 'Shared'
        ? 'Shared'
        : 'Private'
      : String(existing.visibility);
  const isArchived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : Number(existing.is_archived || 0);

  await executeRun(
    c.env.DB,
    `UPDATE journal_entries SET
      project_id = ?, project_name = ?, related_task_id = ?, related_task_title = ?,
      title = ?, entry_date = ?, entry_time = ?, category = ?,
      description = ?, activities_performed = ?, achievements = ?, challenges = ?,
      decisions_made = ?, lessons_learned = ?, next_steps = ?, time_spent_hours = ?,
      tags_json = ?, visibility = ?, is_archived = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ? AND created_by = ?`,
    [
      projectId,
      projectName,
      relatedTaskId,
      relatedTaskTitle,
      title,
      entryDate,
      entryTime,
      category,
      description,
      activitiesPerformed,
      achievements,
      challenges,
      decisionsMade,
      lessonsLearned,
      nextSteps,
      timeSpentHours,
      tagsJson,
      visibility,
      isArchived,
      now,
      entryId,
      workspaceId,
      user.id,
    ]
  );

  if (!body.silent) {
    await recordAuditLog(c.env.DB, {
      workspaceId,
      actionType: isArchived ? 'Journal Archived' : 'Journal Entry Updated',
      entityType: 'journal',
      entityId: entryId,
      entityTitle: title,
      projectId,
      category,
      summary: `Updated journal entry "${title}".`,
      actorName: user.displayName,
      createdBy: user.id,
    });
  }

  return c.json({ success: true, updatedAt: now });
});

// ============================================================================
// ANALYST DESK & STOCK MARKET ANALYSIS CRUD
// ============================================================================
recordsRoutes.post('/analysis', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('anl');
  const now = new Date().toISOString();
  const title = String(body.title || 'Analysis Record').trim().slice(0, 200);
  const category = String(body.category || 'Business Analysis');

  await executeRun(
    c.env.DB,
    `INSERT INTO analysis_records (
      id, workspace_id, project_id, project_name, related_task_id,
      title, category, analysis_date, objective, problem_statement,
      dataset_description, methodology, observations, key_findings,
      risks_and_assumptions, conclusion, recommendations,
      expected_outcome, actual_outcome, confidence_level, status, supporting_links,
      stock_symbol, exchange, timeframe, market_trend, technical_observations,
      support_and_resistance, indicators_used, trading_thesis, entry_exit_assumptions,
      stop_loss_assumption, target_assumption, risk_reward_ratio, actual_result, lessons_learned,
      is_archived, created_by, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      String(body.projectId || ''),
      String(body.projectName || ''),
      String(body.relatedTaskId || ''),
      title,
      category,
      String(body.analysisDate || now.split('T')[0]),
      String(body.objective || '').slice(0, 4000),
      String(body.problemStatement || '').slice(0, 4000),
      String(body.datasetDescription || '').slice(0, 4000),
      String(body.methodology || '').slice(0, 4000),
      String(body.observations || '').slice(0, 5000),
      String(body.keyFindings || '').slice(0, 5000),
      String(body.risksAndAssumptions || '').slice(0, 4000),
      String(body.conclusion || '').slice(0, 4000),
      String(body.recommendations || '').slice(0, 4000),
      String(body.expectedOutcome || '').slice(0, 3000),
      String(body.actualOutcome || '').slice(0, 3000),
      String(body.confidenceLevel || 'High'),
      String(body.status || 'Completed'),
      String(body.supportingLinks || '').slice(0, 2000),
      String(body.stockSymbol || '').slice(0, 32),
      String(body.exchange || '').slice(0, 64),
      String(body.timeframe || '').slice(0, 64),
      String(body.marketTrend || '').slice(0, 64),
      String(body.technicalObservations || '').slice(0, 4000),
      String(body.supportAndResistance || '').slice(0, 1000),
      String(body.indicatorsUsed || '').slice(0, 1000),
      String(body.tradingThesis || '').slice(0, 4000),
      String(body.entryExitAssumptions || '').slice(0, 2000),
      String(body.stopLossAssumption || '').slice(0, 500),
      String(body.targetAssumption || '').slice(0, 500),
      String(body.riskRewardRatio || '').slice(0, 64),
      String(body.actualResult || '').slice(0, 2000),
      String(body.lessonsLearned || '').slice(0, 4000),
      user.id,
      user.displayName,
      now,
      now,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Analysis Record Created',
    entityType: 'analysis',
    entityId: id,
    entityTitle: title,
    projectId: String(body.projectId || ''),
    category,
    summary: `Published ${category}: "${title}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now, updatedAt: now });
});

recordsRoutes.put('/analysis/:id', async (c) => {
  const user = c.get('user');
  const analysisId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const existing = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM analysis_records WHERE id = ? AND workspace_id = ? LIMIT 1`,
    [analysisId, workspaceId]
  );
  if (!existing) return c.json({ error: 'Analysis record not found.' }, 404);

  const now = new Date().toISOString();
  const title = String(body.title ?? existing.title).trim().slice(0, 200);
  const category = String(body.category ?? existing.category);
  const isArchived = body.isArchived !== undefined ? (body.isArchived ? 1 : 0) : Number(existing.is_archived || 0);

  await executeRun(
    c.env.DB,
    `UPDATE analysis_records SET
      project_id = ?, project_name = ?, related_task_id = ?,
      title = ?, category = ?, analysis_date = ?,
      objective = ?, problem_statement = ?, dataset_description = ?, methodology = ?,
      observations = ?, key_findings = ?, risks_and_assumptions = ?,
      conclusion = ?, recommendations = ?, expected_outcome = ?, actual_outcome = ?,
      confidence_level = ?, status = ?, supporting_links = ?,
      stock_symbol = ?, exchange = ?, timeframe = ?, market_trend = ?,
      technical_observations = ?, support_and_resistance = ?, indicators_used = ?,
      trading_thesis = ?, entry_exit_assumptions = ?, stop_loss_assumption = ?,
      target_assumption = ?, risk_reward_ratio = ?, actual_result = ?, lessons_learned = ?,
      is_archived = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
    [
      String(body.projectId ?? existing.project_id),
      String(body.projectName ?? existing.project_name),
      String(body.relatedTaskId ?? existing.related_task_id),
      title,
      category,
      String(body.analysisDate ?? existing.analysis_date),
      String(body.objective ?? existing.objective).slice(0, 4000),
      String(body.problemStatement ?? existing.problem_statement).slice(0, 4000),
      String(body.datasetDescription ?? existing.dataset_description).slice(0, 4000),
      String(body.methodology ?? existing.methodology).slice(0, 4000),
      String(body.observations ?? existing.observations).slice(0, 5000),
      String(body.keyFindings ?? existing.key_findings).slice(0, 5000),
      String(body.risksAndAssumptions ?? existing.risks_and_assumptions).slice(0, 4000),
      String(body.conclusion ?? existing.conclusion).slice(0, 4000),
      String(body.recommendations ?? existing.recommendations).slice(0, 4000),
      String(body.expectedOutcome ?? existing.expected_outcome).slice(0, 3000),
      String(body.actualOutcome ?? existing.actual_outcome).slice(0, 3000),
      String(body.confidenceLevel ?? existing.confidence_level),
      String(body.status ?? existing.status),
      String(body.supportingLinks ?? existing.supporting_links).slice(0, 2000),
      String(body.stockSymbol ?? existing.stock_symbol).slice(0, 32),
      String(body.exchange ?? existing.exchange).slice(0, 64),
      String(body.timeframe ?? existing.timeframe).slice(0, 64),
      String(body.marketTrend ?? existing.market_trend).slice(0, 64),
      String(body.technicalObservations ?? existing.technical_observations).slice(0, 4000),
      String(body.supportAndResistance ?? existing.support_and_resistance).slice(0, 1000),
      String(body.indicatorsUsed ?? existing.indicators_used).slice(0, 1000),
      String(body.tradingThesis ?? existing.trading_thesis).slice(0, 4000),
      String(body.entryExitAssumptions ?? existing.entry_exit_assumptions).slice(0, 2000),
      String(body.stopLossAssumption ?? existing.stop_loss_assumption).slice(0, 500),
      String(body.targetAssumption ?? existing.target_assumption).slice(0, 500),
      String(body.riskRewardRatio ?? existing.risk_reward_ratio).slice(0, 64),
      String(body.actualResult ?? existing.actual_result).slice(0, 2000),
      String(body.lessonsLearned ?? existing.lessons_learned).slice(0, 4000),
      isArchived,
      now,
      analysisId,
      workspaceId,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: isArchived ? 'Analysis Archived' : 'Analysis Updated',
    entityType: 'analysis',
    entityId: analysisId,
    entityTitle: title,
    projectId: String(body.projectId ?? existing.project_id),
    category,
    summary: `Updated ${category}: "${title}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ success: true, updatedAt: now });
});

// ============================================================================
// WORK SESSIONS, COMMENTS, MILESTONES & NOTIFICATIONS
// ============================================================================
recordsRoutes.post('/sessions', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('sess');
  const now = new Date().toISOString();
  const title = String(body.title || 'Work Session').trim().slice(0, 200);
  const durationHours = Math.min(24, Math.max(0.1, Number(body.durationHours) || 1));
  const sessionDate = String(body.sessionDate || now.split('T')[0]);

  await executeRun(
    c.env.DB,
    `INSERT INTO work_sessions (id, workspace_id, project_id, task_id, title, duration_hours, session_date, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      String(body.projectId || ''),
      String(body.taskId || ''),
      title,
      durationHours,
      sessionDate,
      String(body.notes || '').slice(0, 2000),
      user.id,
      now,
      now,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Work Session Logged',
    entityType: 'session',
    entityId: id,
    entityTitle: title,
    projectId: String(body.projectId || ''),
    category: 'Work Session',
    summary: `Logged ${durationHours}h session: "${title}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now });
});

recordsRoutes.post('/comments', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('comm');
  const now = new Date().toISOString();
  const content = String(body.content || '').trim().slice(0, 3000);
  if (!content) return c.json({ error: 'Comment content is required.' }, 400);

  await executeRun(
    c.env.DB,
    `INSERT INTO task_comments (id, workspace_id, target_type, target_id, content, author_name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      String(body.targetType || 'task'),
      String(body.targetId || ''),
      content,
      user.displayName,
      user.id,
      now,
      now,
    ]
  );

  return c.json({ id, createdAt: now });
});

recordsRoutes.post('/milestones', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const id = generateId('ms');
  const now = new Date().toISOString();
  const projectId = String(body.projectId || '');
  const title = String(body.title || 'Milestone').trim().slice(0, 200);
  const dueDate = String(body.dueDate || now.split('T')[0]);

  await executeRun(
    c.env.DB,
    `INSERT INTO milestones (id, workspace_id, project_id, title, due_date, completed, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, workspaceId, projectId, title, dueDate, user.id, now, now]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Milestone Added',
    entityType: 'milestone',
    entityId: id,
    entityTitle: title,
    projectId,
    category: 'Milestone',
    summary: `Added project milestone "${title}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({ id, createdAt: now });
});

recordsRoutes.put('/milestones/:id', async (c) => {
  const user = c.get('user');
  const milestoneId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const workspaceId = String(body.workspaceId || '');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  const now = new Date().toISOString();
  const completed = body.completed ? 1 : 0;
  await executeRun(
    c.env.DB,
    `UPDATE milestones SET completed = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
    [completed, now, milestoneId, workspaceId]
  );

  return c.json({ success: true });
});

recordsRoutes.delete('/milestones/:id', async (c) => {
  const user = c.get('user');
  const milestoneId = c.req.param('id');
  const workspaceId = c.req.query('workspaceId') || '';
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  await executeRun(
    c.env.DB,
    `DELETE FROM milestones WHERE id = ? AND workspace_id = ?`,
    [milestoneId, workspaceId]
  );
  return c.json({ success: true });
});

recordsRoutes.put('/notifications/:id/read', async (c) => {
  const user = c.get('user');
  const notifId = c.req.param('id');
  const now = new Date().toISOString();
  await executeRun(
    c.env.DB,
    `UPDATE notifications SET read = 1, updated_at = ? WHERE id = ? AND recipient_id = ?`,
    [now, notifId, user.id]
  );
  return c.json({ success: true });
});

recordsRoutes.put('/notifications/read-all', async (c) => {
  const user = c.get('user');
  const now = new Date().toISOString();
  await executeRun(
    c.env.DB,
    `UPDATE notifications SET read = 1, updated_at = ? WHERE recipient_id = ? AND read = 0`,
    [now, user.id]
  );
  return c.json({ success: true });
});
