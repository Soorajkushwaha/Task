import { Hono } from 'hono';
import { Env } from './database/d1';
import { AppVariables } from './middleware/authMiddleware';
import { authRoutes } from './routes/auth';
import { workspaceRoutes } from './routes/workspaces';
import { recordsRoutes } from './routes/records';
import { analyticsRoutes } from './routes/analytics';
import { attachmentRoutes } from './routes/attachments';

export const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Health & Runtime verification endpoint
app.get('/api/health', (c) => {
  return c.json({
    application: 'WhimsyMaya',
    runtime: 'Cloudflare Workers',
    database: 'Cloudflare D1 (SQLite)',
    objectStorage: c.env.FILES ? 'Cloudflare R2 (Connected)' : 'Cloudflare R2 (Optional / Standby)',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Mount Worker API routers
app.route('/api/auth', authRoutes);
app.route('/api/workspaces', workspaceRoutes);
app.route('/api/records', recordsRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/attachments', attachmentRoutes);

// 404 handler for unmatched /api/* routes
app.all('/api/*', (c) => {
  return c.json({ error: `API route not found: ${c.req.method} ${c.req.path}` }, 404);
});

// Fallback to Cloudflare Workers Static Assets for React SPA routes
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    const assetRes = await c.env.ASSETS.fetch(c.req.raw as unknown as Parameters<typeof c.env.ASSETS.fetch>[0]);
    return assetRes as unknown as Response;
  }
  return c.text('WhimsyMaya Cloudflare Worker is running. Static assets are served via Cloudflare Assets binding.', 200);
});

export default {
  fetch: app.fetch,
};
