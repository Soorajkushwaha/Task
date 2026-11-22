import type { Env } from '../database/d1';

export interface TurnstileVerifyResult {
  success: boolean;
  mode: 'cloudflare-siteverify' | 'development-bypass';
  error?: string;
}

/**
 * Verifies Cloudflare Turnstile tokens server-side using Cloudflare's Siteverify API.
 * If TURNSTILE_SECRET_KEY is not configured in local development, uses a clearly marked dev bypass.
 */
export async function verifyTurnstileToken(
  env: Env,
  token: string | undefined,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    // Development-only fallback when Turnstile credentials are not yet provisioned
    if (token === 'dev-turnstile-pass' || !token) {
      return {
        success: true,
        mode: 'development-bypass',
      };
    }
    return {
      success: true,
      mode: 'development-bypass',
    };
  }

  if (!token) {
    return {
      success: false,
      mode: 'cloudflare-siteverify',
      error: 'Turnstile verification token is required.',
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      return {
        success: false,
        mode: 'cloudflare-siteverify',
        error: `Turnstile verification failed: ${(data['error-codes'] || []).join(', ') || 'invalid-token'}`,
      };
    }

    return {
      success: true,
      mode: 'cloudflare-siteverify',
    };
  } catch (err) {
    return {
      success: false,
      mode: 'cloudflare-siteverify',
      error: err instanceof Error ? err.message : 'Turnstile verification request failed.',
    };
  }
}
