import { Hono } from 'hono';
import {
  Env,
  WorkspaceRole,
  generateId,
  queryAll,
  queryFirst,
  executeRun,
  verifyWorkspaceRole,
  hasMinimumRole,
  recordAuditLog,
} from '../database/d1';
import { requireAuth, AppVariables } from '../middleware/authMiddleware';

export const workspaceRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

workspaceRoutes.use('*', requireAuth);

// GET /api/workspaces — List all workspaces where the authenticated user is a member
workspaceRoutes.get('/', async (c) => {
  const user = c.get('user');
  const rows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT w.*, wm.role AS current_user_role
     FROM workspaces w
     INNER JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = ?
     ORDER BY CASE WHEN w.type = 'personal' THEN 0 ELSE 1 END, w.created_at ASC`,
    [user.id]
  );

  const workspaces = await Promise.all(
    rows.map(async (r) => {
      const wsId = String(r.id);
      const memRows = await queryAll<{ user_id: string }>(
        c.env.DB,
        `SELECT user_id FROM workspace_members WHERE workspace_id = ?`,
        [wsId]
      );
      return {
        id: wsId,
        name: String(r.name),
        description: String(r.description || ''),
        type: r.type === 'team' ? 'team' : 'personal',
        ownerId: String(r.owner_id),
        inviteCode: String(r.invite_code),
        memberUids: memRows.map((m) => m.user_id),
        createdBy: String(r.created_by),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      };
    })
  );

  return c.json({ workspaces });
});

// POST /api/workspaces — Create a new Personal or Team Workspace
workspaceRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    name?: string;
    description?: string;
    type?: 'personal' | 'team';
  }>();

  const name = (body.name || '').trim().slice(0, 120);
  if (!name) {
    return c.json({ error: 'Workspace name is required.' }, 400);
  }
  const description = (body.description || '').trim().slice(0, 1000);
  const type = body.type === 'team' ? 'team' : 'personal';
  const wsId = generateId(type === 'team' ? 'ws_team' : 'ws_pers');
  const memId = generateId('mem');
  const inviteCode = `WM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await executeRun(
    c.env.DB,
    `INSERT INTO workspaces (id, name, description, type, owner_id, invite_code, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [wsId, name, description, type, user.id, inviteCode, user.id, now, now]
  );

  await executeRun(
    c.env.DB,
    `INSERT INTO workspace_members (id, workspace_id, user_id, display_name, photo_url, role, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Owner', ?, ?, ?)`,
    [memId, wsId, user.id, user.displayName, user.photoURL, user.id, now, now]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId: wsId,
    actionType: 'Workspace Created',
    entityType: 'team',
    entityId: wsId,
    entityTitle: name,
    category: 'Workspace',
    summary: `Created ${type} workspace "${name}".`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({
    workspace: {
      id: wsId,
      name,
      description,
      type,
      ownerId: user.id,
      inviteCode,
      memberUids: [user.id],
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    },
  });
});

// PUT /api/workspaces/:id — Update workspace settings (Owner or Admin only)
workspaceRoutes.put('/:id', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!hasMinimumRole(role, 'Admin')) {
    return c.json({ error: 'Only Workspace Owners and Admins can modify workspace settings.' }, 403);
  }

  const body = await c.req.json<{ name?: string; description?: string }>();
  const name = (body.name || '').trim().slice(0, 120);
  if (!name) {
    return c.json({ error: 'Workspace name cannot be empty.' }, 400);
  }
  const description = (body.description || '').trim().slice(0, 1000);
  const now = new Date().toISOString();

  await executeRun(
    c.env.DB,
    `UPDATE workspaces SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
    [name, description, now, workspaceId]
  );

  return c.json({ success: true, name, description, updatedAt: now });
});

// GET /api/workspaces/:id/members — List workspace members & invitations
workspaceRoutes.get('/:id/members', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!role) {
    return c.json({ error: 'Access denied to this workspace.' }, 403);
  }

  const memRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY created_at ASC`,
    [workspaceId]
  );
  const memberUids = memRows.map((m) => String(m.user_id));

  const members = memRows.map((m) => ({
    id: String(m.id),
    workspaceId: String(m.workspace_id),
    userId: String(m.user_id),
    displayName: String(m.display_name),
    photoURL: String(m.photo_url || ''),
    role: String(m.role) as WorkspaceRole,
    memberUids,
    createdBy: String(m.created_by),
    createdAt: String(m.created_at),
    updatedAt: String(m.updated_at),
  }));

  const invRows = await queryAll<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC`,
    [workspaceId]
  );

  const invitations = invRows.map((i) => ({
    id: String(i.id),
    workspaceId: String(i.workspace_id),
    workspaceName: String(i.workspace_name),
    inviteCode: String(i.invite_code),
    invitedLabel: String(i.invited_label),
    assignedRole: String(i.assigned_role) as 'Admin' | 'Manager' | 'Member',
    status: String(i.status) as 'Pending' | 'Accepted' | 'Revoked',
    expiresAt: String(i.expires_at),
    memberUids,
    createdBy: String(i.created_by),
    createdAt: String(i.created_at),
    updatedAt: String(i.updated_at),
  }));

  return c.json({ members, invitations });
});

// POST /api/workspaces/:id/invitations — Generate an expiring invitation token/code
workspaceRoutes.post('/:id/invitations', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!hasMinimumRole(role, 'Admin')) {
    return c.json({ error: 'Only Owners and Admins can create workspace invitations.' }, 403);
  }

  const ws = await queryFirst<{ id: string; name: string }>(
    c.env.DB,
    `SELECT id, name FROM workspaces WHERE id = ? LIMIT 1`,
    [workspaceId]
  );
  if (!ws) {
    return c.json({ error: 'Workspace not found.' }, 404);
  }

  const body = await c.req.json<{
    invitedLabel?: string;
    assignedRole?: 'Admin' | 'Manager' | 'Member';
    expiresInDays?: number;
  }>();

  const invitedLabel = (body.invitedLabel || 'Team Member').trim().slice(0, 160);
  const assignedRole: 'Admin' | 'Manager' | 'Member' =
    body.assignedRole === 'Admin' || body.assignedRole === 'Manager' ? body.assignedRole : 'Member';
  const days = Math.min(30, Math.max(1, Number(body.expiresInDays) || 7));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString();

  const invId = generateId('inv');
  const inviteCode = `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  await executeRun(
    c.env.DB,
    `INSERT INTO invitations (
      id, workspace_id, workspace_name, invite_code, invited_label,
      assigned_role, status, expires_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
    [
      invId,
      workspaceId,
      ws.name,
      inviteCode,
      invitedLabel,
      assignedRole,
      expiresAt,
      user.id,
      now.toISOString(),
      now.toISOString(),
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'Team Invitation Created',
    entityType: 'team',
    entityId: invId,
    entityTitle: invitedLabel,
    category: 'Team',
    summary: `Generated expiring invitation (${assignedRole}) for ${invitedLabel}.`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({
    invitation: {
      id: invId,
      workspaceId,
      workspaceName: ws.name,
      inviteCode,
      invitedLabel,
      assignedRole,
      status: 'Pending',
      expiresAt,
      memberUids: [user.id],
      createdBy: user.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
});

// DELETE /api/workspaces/:id/invitations/:invId — Revoke an invitation
workspaceRoutes.delete('/:id/invitations/:invId', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const invId = c.req.param('invId');
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!hasMinimumRole(role, 'Admin')) {
    return c.json({ error: 'Only Owners and Admins can revoke invitations.' }, 403);
  }

  const now = new Date().toISOString();
  await executeRun(
    c.env.DB,
    `UPDATE invitations SET status = 'Revoked', updated_at = ? WHERE id = ? AND workspace_id = ?`,
    [now, invId, workspaceId]
  );

  return c.json({ success: true });
});

// POST /api/workspaces/join — Accept an expiring invitation link/code or workspace token
workspaceRoutes.post('/join', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ token?: string }>();
  const rawToken = (body.token || '').trim();

  if (!rawToken) {
    return c.json({ error: 'Invitation code or token is required.' }, 400);
  }

  const nowIso = new Date().toISOString();

  // Case 1: Expiring invitation code from `invitations` table (or WORKSPACE_ID:INV-XXXX)
  const codePart = rawToken.includes(':') ? rawToken.split(':')[1].trim() : rawToken;
  const invRow = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM invitations WHERE invite_code = ? LIMIT 1`,
    [codePart]
  );

  let targetWorkspaceId = '';
  let assignedRole: WorkspaceRole = 'Member';

  if (invRow) {
    if (String(invRow.status) !== 'Pending') {
      return c.json({ error: `This invitation is no longer active (status: ${invRow.status}).` }, 400);
    }
    if (String(invRow.expires_at) <= nowIso) {
      return c.json({ error: 'This invitation code has expired.' }, 400);
    }
    targetWorkspaceId = String(invRow.workspace_id);
    assignedRole = (String(invRow.assigned_role) as WorkspaceRole) || 'Member';

    await executeRun(
      c.env.DB,
      `UPDATE invitations SET status = 'Accepted', updated_at = ? WHERE id = ?`,
      [nowIso, String(invRow.id)]
    );
  } else {
    // Case 2: Direct workspace inviteCode or WORKSPACE_ID:WM-XXXX
    const wsRow = await queryFirst<Record<string, unknown>>(
      c.env.DB,
      `SELECT * FROM workspaces WHERE invite_code = ? AND type = 'team' LIMIT 1`,
      [codePart]
    );
    if (!wsRow) {
      return c.json({ error: 'Invalid or expired invitation code.' }, 404);
    }
    targetWorkspaceId = String(wsRow.id);
    assignedRole = 'Member';
  }

  const existingMember = await verifyWorkspaceRole(c.env.DB, targetWorkspaceId, user.id);
  if (existingMember) {
    return c.json({ workspaceId: targetWorkspaceId, message: 'You are already a member of this workspace.' });
  }

  const memId = generateId('mem');
  await executeRun(
    c.env.DB,
    `INSERT INTO workspace_members (id, workspace_id, user_id, display_name, photo_url, role, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [memId, targetWorkspaceId, user.id, user.displayName, user.photoURL, assignedRole, user.id, nowIso, nowIso]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId: targetWorkspaceId,
    actionType: 'Member Joined Workspace',
    entityType: 'team',
    entityId: memId,
    entityTitle: user.displayName,
    category: 'Team',
    summary: `${user.displayName} joined the workspace as ${assignedRole}.`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({
    success: true,
    workspaceId: targetWorkspaceId,
    role: assignedRole,
  });
});

// PUT /api/workspaces/:id/members/:memberId — Update member role (Owner or Admin)
workspaceRoutes.put('/:id/members/:memberId', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const memberId = c.req.param('memberId');
  const callerRole = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!hasMinimumRole(callerRole, 'Admin')) {
    return c.json({ error: 'Only Workspace Owners and Admins can modify member roles.' }, 403);
  }

  const targetMem = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM workspace_members WHERE id = ? AND workspace_id = ? LIMIT 1`,
    [memberId, workspaceId]
  );
  if (!targetMem) {
    return c.json({ error: 'Member record not found.' }, 404);
  }
  if (targetMem.role === 'Owner') {
    return c.json({ error: 'The Workspace Owner role cannot be reassigned.' }, 400);
  }

  const body = await c.req.json<{ role?: WorkspaceRole }>();
  const nextRole: WorkspaceRole =
    body.role === 'Admin' || body.role === 'Manager' || body.role === 'Member' ? body.role : 'Member';

  const now = new Date().toISOString();
  await executeRun(
    c.env.DB,
    `UPDATE workspace_members SET role = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
    [nextRole, now, memberId, workspaceId]
  );

  return c.json({ success: true, role: nextRole });
});

// DELETE /api/workspaces/:id/members/:memberId — Remove member (Owner or Admin)
workspaceRoutes.delete('/:id/members/:memberId', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.param('id');
  const memberId = c.req.param('memberId');
  const callerRole = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);

  if (!hasMinimumRole(callerRole, 'Admin')) {
    return c.json({ error: 'Only Workspace Owners and Admins can remove members.' }, 403);
  }

  const targetMem = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM workspace_members WHERE id = ? AND workspace_id = ? LIMIT 1`,
    [memberId, workspaceId]
  );
  if (!targetMem) {
    return c.json({ error: 'Member not found.' }, 404);
  }
  if (targetMem.role === 'Owner') {
    return c.json({ error: 'Cannot remove the Workspace Owner.' }, 400);
  }

  await executeRun(
    c.env.DB,
    `DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?`,
    [memberId, workspaceId]
  );

  return c.json({ success: true });
});
