/**
 * Supabase Auth (GoTrue) over plain fetch. No SDK; the anon key goes in the `apikey` header.
 *
 *   email code   POST /auth/v1/otp {email, create_user}       → email with a 6-digit {{ .Token }}
 *                POST /auth/v1/verify {type:'email', email, token} → session (aal1)
 *   refresh      POST /auth/v1/token?grant_type=refresh_token  (60 s before expiry, single-flight)
 *   sign out     POST /auth/v1/logout?scope=local              (storage is cleared either way)
 *   TOTP MFA     GET  /auth/v1/user (factors) · POST /auth/v1/factors · DELETE /auth/v1/factors/{id}
 *                POST /auth/v1/factors/{id}/challenge → POST /auth/v1/factors/{id}/verify → session (aal2)
 *
 * The JWT is decoded only to read `exp` and `aal`; the backend verifies it on every call.
 */
import { aalOf, decodeJwtPayload } from './jwt';
import type { SessionStorage } from './storage';
import { AuthError, type Factor, type FetchLike, type Session, type StoredSession, type TotpEnrollment } from './types';

export type AuthClientOptions = {
  baseUrl: string;
  anonKey: string;
  fetch: FetchLike;
  storage: SessionStorage;
  /** Epoch ms (tests inject a clock). */
  now?: () => number;
  /** Refresh this long before the access token expires. */
  refreshMarginMs?: number;
};

type Listener = (s: StoredSession | null) => void;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export class AuthClient {
  private session: StoredSession | null = null;
  private refreshing: Promise<StoredSession> | null = null;
  private listeners = new Set<Listener>();
  private readonly base: string;
  private readonly now: () => number;
  private readonly margin: number;

  constructor(private readonly opts: AuthClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '') + '/auth/v1';
    this.now = opts.now ?? Date.now;
    this.margin = opts.refreshMarginMs ?? 60_000;
  }

  get current(): StoredSession | null {
    return this.session;
  }

  get storageKind(): SessionStorage['kind'] {
    return this.opts.storage.kind;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- session lifecycle ----------

  /** Load a saved session (secure store). Refreshes it if it is about to expire. */
  async restore(): Promise<StoredSession | null> {
    const saved = await this.opts.storage.load();
    if (!saved) return null;
    this.session = saved;
    this.emit();
    if (this.needsRefresh()) {
      try {
        await this.refresh();
      } catch {
        /* signed_out already cleared; network errors keep the saved session for later */
      }
    }
    return this.session;
  }

  async sendCode(email: string): Promise<void> {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) throw new AuthError('invalid_email', 'invalid email');
    // create_user: first sign-in creates the account. The email template must show {{ .Token }}.
    await this.request('POST', '/otp', { email: e, create_user: true }, { auth: 'anon' });
  }

  async verifyCode(email: string, code: string, extra: { ageConfirmed?: boolean } = {}): Promise<StoredSession> {
    const token = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(token)) throw new AuthError('invalid_code', 'code must be 6 digits');
    const body = await this.request('POST', '/verify', { type: 'email', email: email.trim().toLowerCase(), token }, { auth: 'anon', codeCall: true });
    return this.adopt(body, { ageConfirmed: !!extra.ageConfirmed });
  }

  /** A valid access token (refreshed when within the margin of expiry), or null when signed out. */
  async getAccessToken(): Promise<string | null> {
    if (!this.session) return null;
    if (!this.needsRefresh()) return this.session.accessToken;
    try {
      return (await this.refresh()).accessToken;
    } catch (e) {
      if (e instanceof AuthError && e.code === 'signed_out') return null;
      // Offline: hand back the old token while it is still technically valid.
      const s = this.session;
      return s && s.expiresAt * 1000 > this.now() ? s.accessToken : null;
    }
  }

  /** Single-flight: concurrent callers share one refresh request (refresh tokens are single-use). */
  refresh(): Promise<StoredSession> {
    if (!this.session) return Promise.reject(new AuthError('signed_out', 'no session'));
    if (!this.refreshing) {
      const rt = this.session.refreshToken;
      this.refreshing = (async () => {
        try {
          const body = await this.request('POST', '/token?grant_type=refresh_token', { refresh_token: rt }, { auth: 'anon', refreshCall: true });
          return await this.adopt(body);
        } catch (e) {
          if (e instanceof AuthError && e.code === 'signed_out') await this.clearLocal();
          throw e;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  async signOut(): Promise<void> {
    const s = this.session;
    try {
      if (s) await this.request('POST', '/logout?scope=local', undefined, { auth: 'user', token: s.accessToken });
    } catch {
      /* best effort: the local session is cleared regardless */
    } finally {
      await this.clearLocal();
    }
  }

  async setAgeConfirmed(v: boolean): Promise<void> {
    if (!this.session) return;
    this.session = { ...this.session, ageConfirmed: v };
    await this.opts.storage.save(this.session);
    this.emit();
  }

  // ---------- TOTP MFA ----------

  async listFactors(): Promise<Factor[]> {
    const body = (await this.request('GET', '/user', undefined, { auth: 'user' })) as { factors?: unknown[] };
    return (body.factors ?? []).map((f) => {
      const x = f as { id: string; factor_type?: string; status?: string; friendly_name?: string | null };
      return { id: x.id, type: x.factor_type ?? 'totp', status: x.status ?? 'unverified', friendlyName: x.friendly_name ?? null };
    });
  }

  /** Starts TOTP enrollment. Clears half-finished (unverified) TOTP factors first. */
  async enrollTotp(): Promise<TotpEnrollment> {
    const stale = (await this.listFactors()).filter((f) => f.type === 'totp' && f.status !== 'verified');
    for (const f of stale) await this.request('DELETE', `/factors/${encodeURIComponent(f.id)}`, undefined, { auth: 'user' });
    const body = (await this.request('POST', '/factors', { factor_type: 'totp', issuer: 'Tenbagger' }, { auth: 'user' })) as {
      id: string;
      totp?: { secret?: string; uri?: string };
    };
    if (!body.id || !body.totp?.secret || !body.totp?.uri) throw new AuthError('server', 'enroll response missing totp');
    return { factorId: body.id, secret: body.totp.secret, uri: body.totp.uri };
  }

  /** Challenge + verify. On success the new session is aal2 (required for linking accounts). */
  async verifyTotp(factorId: string, code: string): Promise<StoredSession> {
    const c = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(c)) throw new AuthError('invalid_code', 'code must be 6 digits');
    const id = encodeURIComponent(factorId);
    const ch = (await this.request('POST', `/factors/${id}/challenge`, {}, { auth: 'user' })) as { id?: string };
    if (!ch.id) throw new AuthError('server', 'no challenge id');
    const body = await this.request('POST', `/factors/${id}/verify`, { challenge_id: ch.id, code: c }, { auth: 'user', codeCall: true });
    return this.adopt(body);
  }

  // ---------- internals ----------

  private needsRefresh(): boolean {
    return !!this.session && this.session.expiresAt * 1000 - this.now() <= this.margin;
  }

  private emit() {
    for (const l of this.listeners) l(this.session);
  }

  private async clearLocal() {
    this.session = null;
    try {
      await this.opts.storage.clear();
    } finally {
      this.emit();
    }
  }

  /** Turns a GoTrue session response into our session and persists it. */
  private async adopt(raw: unknown, extra: { ageConfirmed?: boolean } = {}): Promise<StoredSession> {
    const b = raw as { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id?: string; email?: string } };
    if (!b.access_token || !b.refresh_token) throw new AuthError('server', 'session response missing tokens');
    const claims = decodeJwtPayload(b.access_token);
    const expiresAt =
      (typeof claims?.exp === 'number' && claims.exp) ||
      b.expires_at ||
      Math.floor(this.now() / 1000) + (b.expires_in ?? 3600);
    const session: Session = {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt,
      userId: b.user?.id ?? claims?.sub ?? this.session?.userId ?? '',
      email: b.user?.email ?? (typeof claims?.email === 'string' ? claims.email : null) ?? this.session?.email ?? null,
      aal: aalOf(claims),
    };
    const stored: StoredSession = { ...session, ageConfirmed: extra.ageConfirmed ?? this.session?.ageConfirmed ?? false };
    this.session = stored;
    await this.opts.storage.save(stored);
    this.emit();
    return stored;
  }

  private async request(
    method: string,
    path: string,
    body: unknown,
    o: { auth: 'anon' | 'user'; token?: string; codeCall?: boolean; refreshCall?: boolean },
  ): Promise<unknown> {
    let bearer = this.opts.anonKey;
    if (o.auth === 'user') {
      const t = o.token ?? (await this.getAccessToken());
      if (!t) throw new AuthError('signed_out', 'not signed in');
      bearer = t;
    }
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.opts.fetch(this.base + path, {
        method,
        headers: { apikey: this.opts.anonKey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AuthError('network', 'network error');
    }
    const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (res.ok) return json;
    const err = json as { error_code?: string; code?: string | number; error?: string };
    const code = String(err.error_code ?? err.code ?? err.error ?? '');
    if (res.status === 429 || /rate_limit/.test(code)) throw new AuthError('rate_limited', code || 'rate limited', res.status);
    if (o.refreshCall && res.status >= 400 && res.status < 500) throw new AuthError('signed_out', code || 'refresh rejected', res.status);
    if (o.auth === 'user' && res.status === 401) {
      await this.clearLocal();
      throw new AuthError('signed_out', code || 'unauthorized', res.status);
    }
    if (o.codeCall && res.status >= 400 && res.status < 500) throw new AuthError('invalid_code', code || 'invalid code', res.status);
    if (code === 'email_address_invalid' || code === 'validation_failed') throw new AuthError('invalid_email', code, res.status);
    throw new AuthError('server', code || `http ${res.status}`, res.status);
  }
}
