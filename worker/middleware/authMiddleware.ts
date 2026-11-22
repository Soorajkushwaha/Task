import { Context, Next } from 'hono';
import { Env, AuthenticatedUser } from '../database/d1';
import { parseCookieToken, validateSessionToken } from '../auth/betterAuthD1';

export type AppVariables = {
  user: AuthenticatedUser;
  sessionToken: string;
};

/**
 * Extracts session token from HTTP-only SameSite cookie or Authorization Bearer header,
 * enforces CSRF header verification on state-mutating requests, and validates the session in D1.
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  next: Next
) {
  if (!c.env.BETTER_AUTH_SECRET || c.env.BETTER_AUTH_SECRET.trim().length < 16) {
    return c.json(
      {
        error:
          'Better Auth is not configured (BETTER_AUTH_SECRET missing). Production data endpoints are locked until authentication is configured.',
      },
      503
    );
  }

  const method = c.req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const requestedWith = c.req.header('X-Requested-With');
    const authHeader = c.req.header('Authorization');
    if (!requestedWith && !authHeader) {
      return c.json({ error: 'Missing required CSRF protection header (X-Requested-With).' }, 403);
    }
  }

  const cookieHeader = c.req.header('Cookie');
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = parseCookieToken(cookieHeader);
  const rawToken = bearerToken || cookieToken;

  if (!rawToken) {
    return c.json({ error: 'Authentication required. Please sign in.' }, 401);
  }

  const user = await validateSessionToken(c.env.DB, rawToken);
  if (!user) {
    return c.json({ error: 'Session expired or invalid. Please sign in again.' }, 401);
  }

  c.set('user', user);
  c.set('sessionToken', rawToken);
  await next();
}
