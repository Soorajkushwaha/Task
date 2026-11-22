import { Hono } from 'hono';
import {
  Env,
  queryAll,
  queryFirst,
  verifyWorkspaceRole,
} from '../database/d1';
import { requireAuth, AppVariables } from '../middleware/authMiddleware';

export const analyticsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

analyticsRoutes.use('*', requireAuth);

/**
 * GET /api/analytics/summary?workspaceId=...
 * Computes dashboard & BI KPIs directly in D1 SQLite via indexed aggregate queries
 * so the application does not load every historical row to compute metrics.
 */
analyticsRoutes.get('/summary', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.query('workspaceId') || '';
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) {
    return c.json({ error: 'Unauthorized workspace access.' }, 403);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const taskAgg = await queryFirst<{
    total_eligible: number;
    completed_tasks: number;
    pending_tasks: number;
    overdue_tasks: number;
    on_time_completed: number;
    completed_with_due: number;
    total_est_hours: number;
    total_act_hours: number;
  }>(
    c.env.DB,
    `SELECT
      COUNT(CASE WHEN status != 'Cancelled' THEN 1 END) AS total_eligible,
      COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_tasks,
      COUNT(CASE WHEN status NOT IN ('Completed', 'Cancelled') THEN 1 END) AS pending_tasks,
      COUNT(CASE WHEN status NOT IN ('Completed', 'Cancelled') AND due_date != '' AND due_date < ? THEN 1 END) AS overdue_tasks,
      COUNT(CASE WHEN status = 'Completed' AND due_date != '' AND completion_date != '' AND completion_date <= due_date THEN 1 END) AS on_time_completed,
      COUNT(CASE WHEN status = 'Completed' AND due_date != '' THEN 1 END) AS completed_with_due,
      COALESCE(SUM(estimated_hours), 0) AS total_est_hours,
      COALESCE(SUM(actual_hours), 0) AS total_act_hours
     FROM tasks
     WHERE workspace_id = ? AND is_archived = 0`,
    [todayStr, workspaceId]
  );

  const projAgg = await queryFirst<{
    active_projects: number;
    completed_projects: number;
  }>(
    c.env.DB,
    `SELECT
      COUNT(CASE WHEN status IN ('Active', 'Planning') THEN 1 END) AS active_projects,
      COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_projects
     FROM projects
     WHERE workspace_id = ?`,
    [workspaceId]
  );

  const jrnlAgg = await queryFirst<{
    total_journals: number;
    journal_hours: number;
    distinct_days: number;
  }>(
    c.env.DB,
    `SELECT
      COUNT(*) AS total_journals,
      COALESCE(SUM(time_spent_hours), 0) AS journal_hours,
      COUNT(DISTINCT entry_date) AS distinct_days
     FROM journal_entries
     WHERE workspace_id = ? AND is_archived = 0 AND (created_by = ? OR visibility = 'Shared')`,
    [workspaceId, user.id]
  );

  const anlAgg = await queryFirst<{ total_analyses: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS total_analyses FROM analysis_records WHERE workspace_id = ? AND is_archived = 0`,
    [workspaceId]
  );

  const sessAgg = await queryFirst<{ session_hours: number }>(
    c.env.DB,
    `SELECT COALESCE(SUM(duration_hours), 0) AS session_hours FROM work_sessions WHERE workspace_id = ?`,
    [workspaceId]
  );

  const statusRows = await queryAll<{ status: string; count: number }>(
    c.env.DB,
    `SELECT status, COUNT(*) AS count
     FROM tasks
     WHERE workspace_id = ? AND is_archived = 0
     GROUP BY status`,
    [workspaceId]
  );

  const priorityRows = await queryAll<{ priority: string; count: number }>(
    c.env.DB,
    `SELECT priority, COUNT(*) AS count
     FROM tasks
     WHERE workspace_id = ? AND is_archived = 0 AND status != 'Cancelled'
     GROUP BY priority`,
    [workspaceId]
  );

  const totalEligible = Number(taskAgg?.total_eligible || 0);
  const completedTasks = Number(taskAgg?.completed_tasks || 0);
  const completedWithDue = Number(taskAgg?.completed_with_due || 0);
  const onTimeCompleted = Number(taskAgg?.on_time_completed || 0);

  const taskCompletionRate =
    totalEligible > 0 ? Number(((completedTasks / totalEligible) * 100).toFixed(1)) : null;
  const onTimeCompletionRate =
    completedWithDue > 0 ? Number(((onTimeCompleted / completedWithDue) * 100).toFixed(1)) : null;

  const totalWorkHours = Number(
    (
      Number(taskAgg?.total_act_hours || 0) +
      Number(jrnlAgg?.journal_hours || 0) +
      Number(sessAgg?.session_hours || 0)
    ).toFixed(1)
  );

  return c.json({
    summary: {
      totalEligibleTasks: totalEligible,
      completedTasks,
      pendingTasks: Number(taskAgg?.pending_tasks || 0),
      overdueTasks: Number(taskAgg?.overdue_tasks || 0),
      taskCompletionRate,
      onTimeCompletionRate,
      activeProjects: Number(projAgg?.active_projects || 0),
      completedProjects: Number(projAgg?.completed_projects || 0),
      journalEntries: Number(jrnlAgg?.total_journals || 0),
      journalDistinctDays: Number(jrnlAgg?.distinct_days || 0),
      analysisRecords: Number(anlAgg?.total_analyses || 0),
      totalWorkHours,
      totalEstimatedHours: Number(Number(taskAgg?.total_est_hours || 0).toFixed(1)),
      totalActualTaskHours: Number(Number(taskAgg?.total_act_hours || 0).toFixed(1)),
    },
    statusDistribution: statusRows,
    priorityDistribution: priorityRows,
  });
});
