/**
 * Sandbox sign-in: a local fake of the Supabase Auth endpoints AuthClient calls, used when
 * readMoneyConfig().mode === 'mock' so the web preview can click through the whole flow.
 * Any email works; the email code and the authenticator code are both 123456. Nothing is sent
 * anywhere and the session lives in memory only (see storage.ts). Tokens are unsigned fakes.
 */
import { makeUnsignedJwt } from './jwt';
import type { FetchLike } from './types';

export const SANDBOX_CODE = '123456';
/** A well-known demo base32 key; it protects nothing. */
export const SANDBOX_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

type Factor = { id: string; factor_type: 'totp'; status: 'verified' | 'unverified'; friendly_name: string | null };

export function createSandboxAuthFetch(now: () => number = Date.now): FetchLike {
  let pendingEmail: string | null = null;
  let user: { id: string; email: string } | null = null;
  const factors: Factor[] = [];
  const challenges = new Set<string>();
  const refreshTokens = new Map<string, 'aal1' | 'aal2'>();
  let seq = 0;

  const reply = (status: number, body: unknown = {}) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: async () => body });

  const session = (aal: 'aal1' | 'aal2') => {
    const iat = Math.floor(now() / 1000);
    const rt = `sandbox-refresh-${++seq}`;
    refreshTokens.set(rt, aal);
    return {
      access_token: makeUnsignedJwt({ sub: user!.id, email: user!.email, aal, exp: iat + 3600, iat, role: 'authenticated' }),
      refresh_token: rt,
      token_type: 'bearer',
      expires_in: 3600,
      user: { ...user!, factors },
    };
  };

  const authed = (headers: Record<string, string>) => {
    const h = headers.Authorization ?? '';
    return !!user && h.startsWith('Bearer ') && h.split('.').length === 3;
  };

  return async (url, init) => {
    const path = url.replace(/^.*\/auth\/v1/, '');
    const body = init.body ? (JSON.parse(init.body) as Record<string, string>) : {};
    const m = init.method;

    if (m === 'POST' && path === '/otp') {
      pendingEmail = String(body.email);
      return reply(200);
    }
    if (m === 'POST' && path === '/verify') {
      if (!pendingEmail || body.email !== pendingEmail || body.token !== SANDBOX_CODE) return reply(403, { error_code: 'otp_expired' });
      user = { id: 'sandbox-user', email: pendingEmail };
      pendingEmail = null;
      return reply(200, session('aal1'));
    }
    if (m === 'POST' && path.startsWith('/token')) {
      const aal = refreshTokens.get(body.refresh_token);
      if (!aal || !user) return reply(400, { error_code: 'refresh_token_not_found' });
      refreshTokens.delete(body.refresh_token);
      return reply(200, session(aal));
    }
    if (m === 'POST' && path.startsWith('/logout')) {
      refreshTokens.clear();
      return reply(204);
    }
    if (!authed(init.headers)) return reply(401, { error_code: 'no_authorization' });

    if (m === 'GET' && path === '/user') return reply(200, { ...user, factors });
    if (m === 'POST' && path === '/factors') {
      const f: Factor = { id: `sandbox-factor-${++seq}`, factor_type: 'totp', status: 'unverified', friendly_name: null };
      factors.push(f);
      const label = encodeURIComponent(`Tenbagger sandbox:${user!.email}`);
      return reply(200, {
        id: f.id,
        type: 'totp',
        totp: { secret: SANDBOX_TOTP_SECRET, uri: `otpauth://totp/${label}?secret=${SANDBOX_TOTP_SECRET}&issuer=Tenbagger%20sandbox`, qr_code: '' },
      });
    }
    const fm = path.match(/^\/factors\/([^/]+)(\/challenge|\/verify)?$/);
    const factor = fm ? factors.find((f) => f.id === decodeURIComponent(fm[1])) : undefined;
    if (fm && !factor) return reply(404, { error_code: 'mfa_factor_not_found' });
    if (factor && m === 'DELETE' && !fm![2]) {
      factors.splice(factors.indexOf(factor), 1);
      return reply(200, { id: factor.id });
    }
    if (factor && m === 'POST' && fm![2] === '/challenge') {
      const id = `sandbox-challenge-${++seq}`;
      challenges.add(id);
      return reply(200, { id, type: 'totp', expires_at: Math.floor(now() / 1000) + 300 });
    }
    if (factor && m === 'POST' && fm![2] === '/verify') {
      if (!challenges.delete(body.challenge_id) || body.code !== SANDBOX_CODE) return reply(422, { error_code: 'mfa_verification_failed' });
      factor.status = 'verified';
      return reply(200, session('aal2'));
    }
    return reply(404, { error_code: 'not_found' });
  };
}
