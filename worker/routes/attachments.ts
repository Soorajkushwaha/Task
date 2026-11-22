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
} from '../database/d1';
import {
  validateAttachmentUpload,
  putObjectToR2,
  getObjectFromR2,
  deleteObjectFromR2,
} from '../services/r2Storage';
import { requireAuth, AppVariables } from '../middleware/authMiddleware';

export const attachmentRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

attachmentRoutes.use('*', requireAuth);

// GET /api/attachments?workspaceId=...&entityType=...&entityId=...
attachmentRoutes.get('/', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.query('workspaceId') || '';
  const entityType = c.req.query('entityType') || '';
  const entityId = c.req.query('entityId') || '';

  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  let sql = `SELECT * FROM attachments WHERE workspace_id = ? AND (created_by = ? OR visibility = 'Shared')`;
  const params: unknown[] = [workspaceId, user.id];

  if (entityType) {
    sql += ` AND entity_type = ?`;
    params.push(entityType);
  }
  if (entityId) {
    sql += ` AND entity_id = ?`;
    params.push(entityId);
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;

  const rows = await queryAll<Record<string, unknown>>(c.env.DB, sql, params);
  const attachments = rows.map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    fileName: String(r.file_name),
    contentType: String(r.content_type),
    sizeBytes: Number(r.size_bytes),
    r2Key: String(r.r2_key),
    visibility: r.visibility === 'Private' ? 'Private' : 'Shared',
    storageDriver: String(r.storage_driver || 'r2'),
    createdBy: String(r.created_by),
    createdByName: String(r.created_by_name),
    createdAt: String(r.created_at),
  }));

  return c.json({
    attachments,
    r2Configured: Boolean(c.env.FILES),
  });
});

// POST /api/attachments/upload — Multipart file upload to Cloudflare R2 + metadata in D1
attachmentRoutes.post('/upload', async (c) => {
  const user = c.get('user');
  const formData = await c.req.formData();

  const file = formData.get('file') as File | null;
  const workspaceId = String(formData.get('workspaceId') || '');
  const entityType = String(formData.get('entityType') || 'project') as
    | 'journal'
    | 'project'
    | 'analysis'
    | 'report'
    | 'profile';
  const entityId = String(formData.get('entityId') || 'general');
  const visibility = String(formData.get('visibility') || 'Shared') === 'Private' ? 'Private' : 'Shared';

  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Unauthorized workspace access.' }, 403);

  if (!file || typeof file.arrayBuffer !== 'function') {
    return c.json({ error: 'No valid file attached.' }, 400);
  }

  const check = validateAttachmentUpload(file.name, file.type, file.size);
  if (!check.valid) {
    return c.json({ error: check.error }, 400);
  }

  const attId = generateId('att');
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 140);
  const r2Key = `workspaces/${workspaceId}/${entityType}/${attId}_${safeFileName}`;
  const buffer = await file.arrayBuffer();

  const r2Result = await putObjectToR2(
    c.env,
    r2Key,
    buffer,
    file.type || 'application/octet-stream'
  );

  if (!r2Result.stored) {
    return c.json(
      {
        error:
          'Cloudflare R2 bucket binding (FILES) is not configured yet. Create the R2 bucket via `npx wrangler r2 bucket create whimsymaya-files` to enable binary file storage.',
      },
      503
    );
  }

  const now = new Date().toISOString();
  await executeRun(
    c.env.DB,
    `INSERT INTO attachments (
      id, workspace_id, entity_type, entity_id, file_name, content_type,
      size_bytes, r2_key, visibility, storage_driver, created_by, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attId,
      workspaceId,
      entityType,
      entityId,
      safeFileName,
      file.type || 'application/octet-stream',
      file.size,
      r2Key,
      visibility,
      r2Result.driver,
      user.id,
      user.displayName,
      now,
      now,
    ]
  );

  await recordAuditLog(c.env.DB, {
    workspaceId,
    actionType: 'File Uploaded to R2',
    entityType: 'attachment',
    entityId: attId,
    entityTitle: safeFileName,
    category: entityType,
    summary: `Uploaded ${safeFileName} (${Math.round(file.size / 1024)} KB) to Cloudflare R2.`,
    actorName: user.displayName,
    createdBy: user.id,
  });

  return c.json({
    attachment: {
      id: attId,
      workspaceId,
      entityType,
      entityId,
      fileName: safeFileName,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      r2Key,
      visibility,
      storageDriver: r2Result.driver,
      createdBy: user.id,
      createdByName: user.displayName,
      createdAt: now,
    },
  });
});

// GET /api/attachments/:id/download — Protected R2 file download
attachmentRoutes.get('/:id/download', async (c) => {
  const user = c.get('user');
  const attId = c.req.param('id');

  const row = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM attachments WHERE id = ? LIMIT 1`,
    [attId]
  );
  if (!row) return c.json({ error: 'Attachment not found.' }, 404);

  const workspaceId = String(row.workspace_id);
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied to this workspace.' }, 403);

  // Enforce private attachment ownership
  if (row.visibility === 'Private' && String(row.created_by) !== user.id) {
    return c.json({ error: 'This private attachment is restricted to its owner.' }, 403);
  }

  const obj = await getObjectFromR2(c.env, String(row.r2_key));
  if (!obj) {
    return c.json({ error: 'File object not found in Cloudflare R2 bucket.' }, 404);
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': String(row.content_type || obj.contentType),
      'Content-Disposition': `attachment; filename="${String(row.file_name)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});

// DELETE /api/attachments/:id
attachmentRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const attId = c.req.param('id');

  const row = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM attachments WHERE id = ? LIMIT 1`,
    [attId]
  );
  if (!row) return c.json({ error: 'Attachment not found.' }, 404);

  const workspaceId = String(row.workspace_id);
  const role = await verifyWorkspaceRole(c.env.DB, workspaceId, user.id);
  if (!role) return c.json({ error: 'Access denied.' }, 403);

  if (String(row.created_by) !== user.id && !hasMinimumRole(role, 'Admin')) {
    return c.json({ error: 'Only the file owner or a Workspace Admin can delete this attachment.' }, 403);
  }

  await deleteObjectFromR2(c.env, String(row.r2_key));
  await executeRun(c.env.DB, `DELETE FROM attachments WHERE id = ?`, [attId]);

  return c.json({ success: true });
});
