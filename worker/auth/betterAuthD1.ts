import type { D1Database } from '@cloudflare/workers-types';
import { AuthenticatedUser, generateId, queryFirst, executeRun } from '../database/d1';

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_NAME = 'whimsymaya_session';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Web Crypto API PBKDF2-HMAC-SHA256 password hashing (100% compatible with Cloudflare Workers workerd).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  const saltHex = bytesToHex(salt);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBytes(parts[2]);
  const expectedHex = parts[3];

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const actualHex = bytesToHex(new Uint8Array(derivedBits));
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function createD1Session(
  db: D1Database,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{ rawToken: string; expiresAt: string }> {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const rawToken = bytesToHex(tokenBytes);
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const sessionId = generateId('sess_auth');

  await executeRun(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userId,
      tokenHash,
      expiresAt,
      ipAddress.slice(0, 64),
      userAgent.slice(0, 256),
      now.toISOString(),
      now.toISOString(),
    ]
  );

  return { rawToken, expiresAt };
}

export function formatSessionCookie(rawToken: string, maxAgeSeconds = 30 * 24 * 60 * 60): string {
  return `${SESSION_COOKIE_NAME}=${rawToken}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`;
}

export function parseCookieToken(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [k, ...rest] = pair.trim().split('=');
    if (k === SESSION_COOKIE_NAME) {
      const val = rest.join('=').trim();
      return val.length > 0 ? val : null;
    }
  }
  return null;
}

export function mapDbUserToProfile(row: Record<string, unknown>): AuthenticatedUser {
  return {
    id: String(row.id),
    email: String(row.email),
    emailVerified: Boolean(row.email_verified),
    displayName: String(row.display_name),
    photoURL: String(row.photo_url || ''),
    roleTitle: String(row.role_title || 'Product & Analytics Professional'),
    timezone: String(row.timezone || 'UTC'),
    dateFormat: String(row.date_format || 'YYYY-MM-DD'),
    theme: row.theme === 'dark' ? 'dark' : 'light',
    defaultWorkspaceId: String(row.default_workspace_id || ''),
    notifyDeadlines: Boolean(row.notify_deadlines),
    notifyAssignments: Boolean(row.notify_assignments),
    notifyJournal: Boolean(row.notify_journal),
    notifyInvites: Boolean(row.notify_invites),
    privateJournalDefault: Boolean(row.private_journal_default),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function validateSessionToken(
  db: D1Database,
  rawToken: string | null
): Promise<AuthenticatedUser | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = await sha256Hex(rawToken);
  const nowIso = new Date().toISOString();

  const row = await queryFirst<Record<string, unknown>>(
    db,
    `SELECT u.*
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?
     LIMIT 1`,
    [tokenHash, nowIso]
  );

  if (!row) return null;
  return mapDbUserToProfile(row);
}

export async function revokeSessionToken(db: D1Database, rawToken: string | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = await sha256Hex(rawToken);
  await executeRun(db, `DELETE FROM sessions WHERE token_hash = ?`, [tokenHash]);
}
