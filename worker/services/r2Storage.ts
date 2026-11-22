import type { Env } from '../database/d1';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateAttachmentUpload(
  fileName: string,
  contentType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: 'File name is required.' };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: 'File cannot be empty.' };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File exceeds the 10 MB maximum size limit.' };
  }
  const normalizedMime = (contentType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      error: `Unsupported file type (${normalizedMime}). Allowed: PDF, PNG, JPEG, WEBP, CSV, XLSX, TXT, MD.`,
    };
  }
  return { valid: true };
}

export async function putObjectToR2(
  env: Env,
  r2Key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<{ stored: boolean; driver: 'r2' | 'unconfigured' }> {
  if (!env.FILES) {
    return { stored: false, driver: 'unconfigured' };
  }
  await env.FILES.put(r2Key, data, {
    httpMetadata: {
      contentType,
    },
  });
  return { stored: true, driver: 'r2' };
}

export async function getObjectFromR2(
  env: Env,
  r2Key: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!env.FILES) return null;
  const obj = await env.FILES.get(r2Key);
  if (!obj) return null;
  const body = await obj.arrayBuffer();
  return {
    body,
    contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
  };
}

export async function deleteObjectFromR2(env: Env, r2Key: string): Promise<void> {
  if (!env.FILES) return;
  await env.FILES.delete(r2Key);
}
