import type { D1Database, R2Bucket, Fetcher } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  ASSETS?: Fetcher;
  BETTER_AUTH_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_NAME?: string;
  ENVIRONMENT?: string;
}

export type WorkspaceRole = 'Owner' | 'Admin' | 'Manager' | 'Member';

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  roleTitle: string;
  timezone: string;
  dateFormat: string;
  theme: 'light' | 'dark';
  defaultWorkspaceId: string;
  notifyDeadlines: boolean;
  notifyAssignments: boolean;
  notifyJournal: boolean;
  notifyInvites: boolean;
  privateJournalDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function generateId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${Date.now().toString(36)}_${hex}`;
}

export async function queryAll<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const res = await stmt.all<T>();
  return res.results || [];
}

export async function queryFirst<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  const res = await stmt.first<T>();
  return res || null;
}

export async function executeRun(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number }> {
  const stmt = db.prepare(sql).bind(...params);
  const res = await stmt.run();
  return { changes: res.meta?.changes ?? 0 };
}

/**
 * Zero-trust server-side workspace membership & role verification.
 * Never trusts workspaceId or role supplied by the frontend.
 */
export async function verifyWorkspaceRole(
  db: D1Database,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  if (!workspaceId || !userId) return null;
  const row = await queryFirst<{ role: WorkspaceRole }>(
    db,
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1`,
    [workspaceId, userId]
  );
  return row ? row.role : null;
}

export function hasMinimumRole(userRole: WorkspaceRole | null, minRole: WorkspaceRole): boolean {
  if (!userRole) return false;
  const weights: Record<WorkspaceRole, number> = {
    Owner: 4,
    Admin: 3,
    Manager: 2,
    Member: 1,
  };
  return weights[userRole] >= weights[minRole];
}

/**
 * Append an immutable chronological entry to D1 audit_logs (Track Record).
 */
export async function recordAuditLog(
  db: D1Database,
  params: {
    workspaceId: string;
    actionType: string;
    entityType: 'task' | 'project' | 'journal' | 'analysis' | 'planner' | 'milestone' | 'session' | 'team' | 'attachment';
    entityId: string;
    entityTitle: string;
    projectId?: string;
    category?: string;
    summary: string;
    actorName: string;
    createdBy: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const id = generateId('log');
  await executeRun(
    db,
    `INSERT INTO audit_logs (
      id, workspace_id, action_type, entity_type, entity_id, entity_title,
      project_id, category, summary, actor_name, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.workspaceId,
      params.actionType.slice(0, 64),
      params.entityType,
      params.entityId,
      params.entityTitle.slice(0, 200),
      params.projectId || '',
      (params.category || 'General').slice(0, 64),
      params.summary.slice(0, 1000),
      params.actorName.slice(0, 120),
      params.createdBy,
      now,
      now,
    ]
  );
}

/**
 * Recalculates project progress in D1 using SQL aggregation over eligible tasks (excluding Cancelled tasks).
 */
export async function recalculateProjectProgress(
  db: D1Database,
  workspaceId: string,
  projectId: string
): Promise<void> {
  if (!projectId) return;
  const stats = await queryFirst<{ total: number; completed: number }>(
    db,
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
     FROM tasks
     WHERE workspace_id = ? AND project_id = ? AND is_archived = 0 AND status != 'Cancelled'`,
    [workspaceId, projectId]
  );
  const total = Number(stats?.total || 0);
  const completed = Number(stats?.completed || 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const now = new Date().toISOString();
  await executeRun(
    db,
    `UPDATE projects SET progress_percentage = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
    [pct, now, projectId, workspaceId]
  );
}
