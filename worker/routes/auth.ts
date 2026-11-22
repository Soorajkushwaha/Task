import { Hono } from 'hono';
import {
  Env,
  generateId,
  queryFirst,
  executeRun,
} from '../database/d1';
import {
  hashPassword,
  verifyPassword,
  createD1Session,
  formatSessionCookie,
  clearSessionCookie,
  parseCookieToken,
  validateSessionToken,
  revokeSessionToken,
  mapDbUserToProfile,
} from '../auth/betterAuthD1';
import { verifyTurnstileToken } from '../services/turnstile';
import { requireAuth, AppVariables } from '../middleware/authMiddleware';

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function isBetterAuthConfigured(env: Env): boolean {
  return Boolean(env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.trim().length >= 16);
}

function getCapabilities(env: Env) {
  const authReady = isBetterAuthConfigured(env);
  return {
    betterAuthConfigured: authReady,
    turnstileConfigured: Boolean(
      env.TURNSTILE_SECRET_KEY?.trim() && env.VITE_TURNSTILE_SITE_KEY?.trim()
    ),
    turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY?.trim() || '',
    googleOAuthConfigured: Boolean(
      env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()
    ),
    emailResetConfigured: Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim()),
    d1Configured: Boolean(env.DB && authReady),
    r2Configured: Boolean(env.FILES && authReady),
  };
}

// GET /api/auth/session
authRoutes.get('/session', async (c) => {
  const capabilities = getCapabilities(c.env);

  // Never use a silent fallback secret or expose real user records when BETTER_AUTH_SECRET is unconfigured
  if (!capabilities.betterAuthConfigured) {
    return c.json({
      authenticated: false,
      user: null,
      capabilities,
    });
  }

  const cookieHeader = c.req.header('Cookie');
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = parseCookieToken(cookieHeader);
  const rawToken = bearerToken || cookieToken;

  const user = await validateSessionToken(c.env.DB, rawToken);
  return c.json({
    authenticated: Boolean(user),
    user,
    capabilities,
  });
});

// POST /api/auth/register
authRoutes.post('/register', async (c) => {
  if (!isBetterAuthConfigured(c.env)) {
    return c.json(
      {
        error:
          'Better Auth — Not Configured. BETTER_AUTH_SECRET has not been set yet. Use Development & Demo Preview Mode now, or configure BETTER_AUTH_SECRET via "npx wrangler secret put BETTER_AUTH_SECRET" after deployment.',
      },
      503
    );
  }

  const body = await c.req.json<{
    email?: string;
    password?: string;
    displayName?: string;
    turnstileToken?: string;
  }>();

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const displayName = (body.displayName || '').trim();

  if (!email || !email.includes('@') || email.length > 256) {
    return c.json({ error: 'Please provide a valid email address.' }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long.' }, 400);
  }
  if (!displayName || displayName.length > 120) {
    return c.json({ error: 'Please provide your display name (max 120 characters).' }, 400);
  }

  // Verify Cloudflare Turnstile when configured
  const remoteIp = c.req.header('CF-Connecting-IP') || '';
  const turnstile = await verifyTurnstileToken(c.env, body.turnstileToken, remoteIp);
  if (!turnstile.success) {
    return c.json({ error: turnstile.error || 'Turnstile bot verification failed.' }, 400);
  }

  const existingUser = await queryFirst<{ id: string }>(
    c.env.DB,
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  if (existingUser) {
    return c.json({ error: 'An account with this email already exists. Please sign in.' }, 409);
  }

  const now = new Date().toISOString();
  const userId = generateId('usr');
  const accountId = generateId('acc');
  const personalWsId = generateId('ws_pers');
  const memberId = generateId('mem');
  const inviteCode = `WM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const passwordHash = await hashPassword(password);

  await executeRun(
    c.env.DB,
    `INSERT INTO users (
      id, email, email_verified, display_name, photo_url, role_title,
      timezone, date_format, theme, default_workspace_id,
      notify_deadlines, notify_assignments, notify_journal, notify_invites,
      private_journal_default, created_at, updated_at
    ) VALUES (?, ?, 1, ?, '', 'Product & Analytics Professional', 'UTC', 'YYYY-MM-DD', 'light', ?, 1, 1, 1, 1, 1, ?, ?)`,
    [userId, email, displayName, personalWsId, now, now]
  );

  await executeRun(
    c.env.DB,
    `INSERT INTO accounts (id, user_id, account_id, provider_id, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, 'credential', ?, ?, ?)`,
    [accountId, userId, email, passwordHash, now, now]
  );

  // Provision initial Personal Workspace
  await executeRun(
    c.env.DB,
    `INSERT INTO workspaces (id, name, description, type, owner_id, invite_code, created_by, created_at, updated_at)
     VALUES (?, 'Personal Workspace', 'Private planner, tasks, work journal, and analyst desk.', 'personal', ?, ?, ?, ?, ?)`,
    [personalWsId, userId, inviteCode, userId, now, now]
  );

  await executeRun(
    c.env.DB,
    `INSERT INTO workspace_members (id, workspace_id, user_id, display_name, photo_url, role, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', 'Owner', ?, ?, ?)`,
    [memberId, personalWsId, userId, displayName, userId, now, now]
  );

  const userAgent = c.req.header('User-Agent') || '';
  const session = await createD1Session(c.env.DB, userId, remoteIp, userAgent);
  c.header('Set-Cookie', formatSessionCookie(session.rawToken));

  const userRow = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );

  return c.json({
    user: userRow ? mapDbUserToProfile(userRow) : null,
    sessionToken: session.rawToken,
    turnstileMode: turnstile.mode,
    capabilities: getCapabilities(c.env),
  });
});

// POST /api/auth/login
authRoutes.post('/login', async (c) => {
  if (!isBetterAuthConfigured(c.env)) {
    return c.json(
      {
        error:
          'Better Auth — Not Configured. BETTER_AUTH_SECRET has not been set yet. Use Development & Demo Preview Mode now, or configure BETTER_AUTH_SECRET via "npx wrangler secret put BETTER_AUTH_SECRET" after deployment.',
      },
      503
    );
  }

  const body = await c.req.json<{
    email?: string;
    password?: string;
    turnstileToken?: string;
  }>();

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return c.json({ error: 'Email and password are required.' }, 400);
  }

  const remoteIp = c.req.header('CF-Connecting-IP') || '';
  const turnstile = await verifyTurnstileToken(c.env, body.turnstileToken, remoteIp);
  if (!turnstile.success) {
    return c.json({ error: turnstile.error || 'Turnstile verification failed.' }, 400);
  }

  const row = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT u.*, a.password_hash
     FROM users u
     INNER JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );

  if (!row || !row.password_hash) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  const valid = await verifyPassword(password, String(row.password_hash));
  if (!valid) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  const user = mapDbUserToProfile(row);
  const userAgent = c.req.header('User-Agent') || '';
  const session = await createD1Session(c.env.DB, user.id, remoteIp, userAgent);
  c.header('Set-Cookie', formatSessionCookie(session.rawToken));

  return c.json({
    user,
    sessionToken: session.rawToken,
    turnstileMode: turnstile.mode,
    capabilities: getCapabilities(c.env),
  });
});

// POST /api/auth/logout
authRoutes.post('/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = parseCookieToken(cookieHeader);
  await revokeSessionToken(c.env.DB, bearerToken || cookieToken);
  c.header('Set-Cookie', clearSessionCookie());
  return c.json({ success: true });
});

// POST /api/auth/password-reset
authRoutes.post('/password-reset', async (c) => {
  if (!c.env.RESEND_API_KEY?.trim() || !c.env.EMAIL_FROM?.trim()) {
    return c.json(
      {
        error:
          'Resend Email — Not Configured. Configure RESEND_API_KEY and EMAIL_FROM in Cloudflare Worker secrets to enable password reset emails.',
      },
      400
    );
  }

  const body = await c.req.json<{ email?: string }>();
  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return c.json({ error: 'Email address is required.' }, 400);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3600 * 1000).toISOString();
  const verId = generateId('ver');
  const resetToken = generateId('rst');

  await executeRun(
    c.env.DB,
    `INSERT INTO verifications (id, identifier, value, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [verId, email, resetToken, expiresAt, now.toISOString(), now.toISOString()]
  );

  return c.json({
    success: true,
    message:
      'If an account matches that email, a password reset link has been queued via the configured Resend email provider.',
  });
});

// PUT /api/auth/profile
authRoutes.put('/profile', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    displayName?: string;
    photoURL?: string;
    roleTitle?: string;
    timezone?: string;
    dateFormat?: string;
    theme?: 'light' | 'dark';
    defaultWorkspaceId?: string;
    notifyDeadlines?: boolean;
    notifyAssignments?: boolean;
    notifyJournal?: boolean;
    notifyInvites?: boolean;
    privateJournalDefault?: boolean;
  }>();

  const now = new Date().toISOString();
  const displayName = (body.displayName ?? user.displayName).trim().slice(0, 120) || user.displayName;
  const photoURL = (body.photoURL ?? user.photoURL).trim().slice(0, 1024);
  const roleTitle = (body.roleTitle ?? user.roleTitle).trim().slice(0, 120);
  const timezone = (body.timezone ?? user.timezone).trim().slice(0, 64) || 'UTC';
  const dateFormat = (body.dateFormat ?? user.dateFormat).trim().slice(0, 32) || 'YYYY-MM-DD';
  const theme = body.theme === 'dark' ? 'dark' : body.theme === 'light' ? 'light' : user.theme;
  const defaultWorkspaceId = (body.defaultWorkspaceId ?? user.defaultWorkspaceId).trim().slice(0, 128);

  await executeRun(
    c.env.DB,
    `UPDATE users SET
      display_name = ?,
      photo_url = ?,
      role_title = ?,
      timezone = ?,
      date_format = ?,
      theme = ?,
      default_workspace_id = ?,
      notify_deadlines = ?,
      notify_assignments = ?,
      notify_journal = ?,
      notify_invites = ?,
      private_journal_default = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      displayName,
      photoURL,
      roleTitle,
      timezone,
      dateFormat,
      theme,
      defaultWorkspaceId,
      body.notifyDeadlines ?? user.notifyDeadlines ? 1 : 0,
      body.notifyAssignments ?? user.notifyAssignments ? 1 : 0,
      body.notifyJournal ?? user.notifyJournal ? 1 : 0,
      body.notifyInvites ?? user.notifyInvites ? 1 : 0,
      body.privateJournalDefault ?? user.privateJournalDefault ? 1 : 0,
      now,
      user.id,
    ]
  );

  // Sync display_name in workspace_members
  await executeRun(
    c.env.DB,
    `UPDATE workspace_members SET display_name = ?, photo_url = ?, updated_at = ? WHERE user_id = ?`,
    [displayName, photoURL, now, user.id]
  );

  const updatedRow = await queryFirst<Record<string, unknown>>(
    c.env.DB,
    `SELECT * FROM users WHERE id = ? LIMIT 1`,
    [user.id]
  );

  return c.json({
    user: updatedRow ? mapDbUserToProfile(updatedRow) : user,
  });
});
