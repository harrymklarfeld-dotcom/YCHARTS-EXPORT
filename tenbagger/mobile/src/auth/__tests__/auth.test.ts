jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import {
  AUTH_COPY,
  AuthClient,
  AuthError,
  createAuthClient,
  decodeJwtPayload,
  deriveStatus,
  gateRoute,
  groupSetupKey,
  linkGate,
  makeUnsignedJwt,
  MemorySessionStorage,
  pickSessionStorage,
  TabSessionStorage,
  resetAuthForTests,
  SecureSessionStorage,
  useAuth,
  type FetchLike,
  type SecureStoreLike,
  type StoredSession,
} from '..';
import { findBannedPhrases } from '../../money/engine';
import { createMoneyClient } from '../../money/live/config';

const T0 = Date.parse('2026-10-06T15:00:00Z');
const BASE = 'https://proj.supabase.co';
const ANON = 'anon-key';

type Call = { url: string; method: string; headers: Record<string, string>; body: any };
type Handler = (c: Call) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

/** Scripted GoTrue fake: route "METHOD /path" → handler; every call is recorded. */
function fakeFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const path = url.replace(`${BASE}/auth/v1`, '').replace(/\?.*$/, '');
    const call: Call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const h = routes[`${init.method} ${path}`];
    if (!h) return { status: 404, ok: false, json: async () => ({}) };
    const r = await h(call);
    return { status: r.status, ok: r.status < 300, json: async () => r.body ?? {} };
  };
  return { fetch, calls };
}

let clock = T0;
const now = () => clock;

function tokenResponse(aal: 'aal1' | 'aal2', rt: string, lifetimeSec = 3600) {
  const exp = Math.floor(clock / 1000) + lifetimeSec;
  return {
    access_token: makeUnsignedJwt({ sub: 'user-1', email: 'sam@example.com', aal, exp }),
    refresh_token: rt,
    expires_in: lifetimeSec,
    user: { id: 'user-1', email: 'sam@example.com' },
  };
}

function client(routes: Record<string, Handler>, storage = new MemorySessionStorage()) {
  const f = fakeFetch(routes);
  return { c: new AuthClient({ baseUrl: BASE, anonKey: ANON, fetch: f.fetch, storage, now }), calls: f.calls, storage };
}

beforeEach(() => {
  clock = T0;
});

describe('jwt', () => {
  it('decodes exp/aal (and unicode) without verifying', () => {
    const tok = makeUnsignedJwt({ exp: 123, aal: 'aal2', email: 'zoë@example.com' });
    expect(decodeJwtPayload(tok)).toMatchObject({ exp: 123, aal: 'aal2', email: 'zoë@example.com' });
    expect(decodeJwtPayload('garbage')).toBeNull();
    expect(decodeJwtPayload('a.!!!.c')).toBeNull();
  });
});

describe('AuthClient: email code', () => {
  it('sends a code with the anon key and create_user', async () => {
    const { c, calls } = client({ 'POST /otp': () => ({ status: 200 }) });
    await c.sendCode('  Sam@Example.com ');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ email: 'sam@example.com', create_user: true });
    expect(calls[0].headers.apikey).toBe(ANON);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${ANON}`);
  });

  it('rejects a bad email without calling the server', async () => {
    const { c, calls } = client({});
    await expect(c.sendCode('not-an-email')).rejects.toMatchObject({ code: 'invalid_email' });
    expect(calls).toHaveLength(0);
  });

  it('maps 429 to rate_limited', async () => {
    const { c } = client({ 'POST /otp': () => ({ status: 429, body: { error_code: 'over_email_send_rate_limit' } }) });
    await expect(c.sendCode('sam@example.com')).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('verifies the 6-digit code, stores the session and reads exp/aal from the JWT', async () => {
    const { c, calls, storage } = client({ 'POST /verify': () => ({ status: 200, body: tokenResponse('aal1', 'rt-1') }) });
    const s = await c.verifyCode('sam@example.com', '123 456', { ageConfirmed: true });
    expect(calls[0].body).toEqual({ type: 'email', email: 'sam@example.com', token: '123456' });
    expect(s).toMatchObject({ userId: 'user-1', email: 'sam@example.com', aal: 'aal1', refreshToken: 'rt-1', ageConfirmed: true });
    expect(s.expiresAt).toBe(Math.floor(T0 / 1000) + 3600);
    expect(await storage.load()).toEqual(s);
  });

  it('a wrong code is invalid_code and leaves no session', async () => {
    const { c } = client({ 'POST /verify': () => ({ status: 403, body: { error_code: 'otp_expired' } }) });
    await expect(c.verifyCode('sam@example.com', '000000')).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(c.verifyCode('sam@example.com', '12')).rejects.toBeInstanceOf(AuthError);
    expect(c.current).toBeNull();
  });
});

describe('AuthClient: refresh', () => {
  async function signedIn(routes: Record<string, Handler>) {
    const r = client({ 'POST /verify': () => ({ status: 200, body: tokenResponse('aal1', 'rt-1') }), ...routes });
    await r.c.verifyCode('sam@example.com', '123456');
    return r;
  }

  it('returns the current token while fresh, refreshes within 60 s of expiry', async () => {
    let n = 1;
    const { c, calls } = await signedIn({ 'POST /token': () => ({ status: 200, body: tokenResponse('aal1', `rt-${++n}`) }) });
    const first = c.current!.accessToken;
    clock = T0 + (3600 - 61) * 1000;
    expect(await c.getAccessToken()).toBe(first);
    expect(calls.filter((x) => x.url.includes('/token'))).toHaveLength(0);

    clock = T0 + (3600 - 59) * 1000;
    const next = await c.getAccessToken();
    expect(next).not.toBe(first);
    const tokenCall = calls.find((x) => x.url.includes('/token'))!;
    expect(tokenCall.url).toContain('grant_type=refresh_token');
    expect(tokenCall.body).toEqual({ refresh_token: 'rt-1' });
    expect(c.current!.refreshToken).toBe('rt-2');
  });

  it('is single-flight: concurrent callers share one refresh request', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { c, calls } = await signedIn({
      'POST /token': async () => {
        await gate;
        return { status: 200, body: tokenResponse('aal1', 'rt-2') };
      },
    });
    clock = T0 + 3600 * 1000; // expired
    const all = Promise.all([c.getAccessToken(), c.getAccessToken(), c.refresh().then((s) => s.accessToken)]);
    release();
    const tokens = await all;
    expect(new Set(tokens).size).toBe(1);
    expect(calls.filter((x) => x.url.includes('/token'))).toHaveLength(1);
  });

  it('a rejected refresh token signs out and clears storage', async () => {
    const { c, storage } = await signedIn({ 'POST /token': () => ({ status: 400, body: { error_code: 'refresh_token_not_found' } }) });
    const seen: Array<StoredSession | null> = [];
    c.onChange((s) => seen.push(s));
    clock = T0 + 3600 * 1000;
    expect(await c.getAccessToken()).toBeNull();
    expect(c.current).toBeNull();
    expect(await storage.load()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it('offline: keeps the session and hands back a still-valid token', async () => {
    const { c } = await signedIn({
      'POST /token': () => {
        throw new Error('offline');
      },
    });
    const tok = c.current!.accessToken;
    clock = T0 + (3600 - 30) * 1000; // inside the margin, not yet expired
    expect(await c.getAccessToken()).toBe(tok);
    clock = T0 + 3601 * 1000; // expired
    expect(await c.getAccessToken()).toBeNull();
    expect(c.current).not.toBeNull(); // kept for when the network is back
  });

  it('restores a saved session and refreshes it if near expiry', async () => {
    const storage = new MemorySessionStorage();
    const exp = Math.floor(T0 / 1000) + 10;
    await storage.save({ accessToken: makeUnsignedJwt({ exp, aal: 'aal2' }), refreshToken: 'rt-old', expiresAt: exp, userId: 'user-1', email: 'sam@example.com', aal: 'aal2', ageConfirmed: true });
    const { c, calls } = client({ 'POST /token': () => ({ status: 200, body: tokenResponse('aal2', 'rt-new') }) }, storage);
    const s = await c.restore();
    expect(calls).toHaveLength(1);
    expect(s).toMatchObject({ refreshToken: 'rt-new', aal: 'aal2', ageConfirmed: true });
  });
});

describe('AuthClient: TOTP MFA and sign-out', () => {
  it('enrolls (clearing unverified factors), then challenge + verify yields aal2', async () => {
    const { c, calls, storage } = client({
      'POST /verify': () => ({ status: 200, body: tokenResponse('aal1', 'rt-1') }),
      'GET /user': () => ({ status: 200, body: { id: 'user-1', factors: [{ id: 'old', factor_type: 'totp', status: 'unverified' }] } }),
      'DELETE /factors/old': () => ({ status: 200 }),
      'POST /factors': () => ({ status: 200, body: { id: 'f1', type: 'totp', totp: { secret: 'ABCDEFGH', uri: 'otpauth://totp/Tenbagger:sam?secret=ABCDEFGH', qr_code: '' } } }),
      'POST /factors/f1/challenge': () => ({ status: 200, body: { id: 'ch1' } }),
      'POST /factors/f1/verify': (call) =>
        call.body.code === '654321' ? { status: 200, body: tokenResponse('aal2', 'rt-2') } : { status: 422, body: { error_code: 'mfa_verification_failed' } },
    });
    await c.verifyCode('sam@example.com', '123456');
    const e = await c.enrollTotp();
    expect(e).toEqual({ factorId: 'f1', secret: 'ABCDEFGH', uri: 'otpauth://totp/Tenbagger:sam?secret=ABCDEFGH' });
    expect(calls.map((x) => `${x.method} ${x.url.replace(BASE, '')}`)).toContain('DELETE /auth/v1/factors/old');
    const enrollCall = calls.find((x) => x.method === 'POST' && x.url.endsWith('/factors'))!;
    expect(enrollCall.body).toMatchObject({ factor_type: 'totp' });
    expect(enrollCall.headers.Authorization).toBe(`Bearer ${c.current!.accessToken}`);

    await expect(c.verifyTotp('f1', '111111')).rejects.toMatchObject({ code: 'invalid_code' });
    expect(c.current!.aal).toBe('aal1');
    const s = await c.verifyTotp('f1', '654321');
    expect(calls.at(-1)!.body).toEqual({ challenge_id: 'ch1', code: '654321' });
    expect(s.aal).toBe('aal2');
    expect((await storage.load())!.aal).toBe('aal2');
  });

  it('sign-out calls /logout with the user token and clears storage even if it fails', async () => {
    const { c, calls, storage } = client({
      'POST /verify': () => ({ status: 200, body: tokenResponse('aal1', 'rt-1') }),
      'POST /logout': () => ({ status: 500 }),
    });
    await c.verifyCode('sam@example.com', '123456');
    const tok = c.current!.accessToken;
    await c.signOut();
    const logout = calls.find((x) => x.url.includes('/logout'))!;
    expect(logout.headers.Authorization).toBe(`Bearer ${tok}`);
    expect(c.current).toBeNull();
    expect(await storage.load()).toBeNull();
    expect(await c.getAccessToken()).toBeNull();
  });
});

describe('session storage', () => {
  it('secure store on iOS/Android, memory on web and in the sandbox', () => {
    expect(pickSessionStorage({ os: 'ios', mode: 'http' }).kind).toBe('secure');
    expect(pickSessionStorage({ os: 'android', mode: 'http' }).kind).toBe('secure');
    expect(pickSessionStorage({ os: 'web', mode: 'http', webStorage: null }).kind).toBe('memory');
    const mem = new Map<string, string>();
    const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    expect(pickSessionStorage({ os: 'web', mode: 'http', webStorage: fake }).kind).toBe('tab');
    expect(pickSessionStorage({ os: 'ios', mode: 'mock' }).kind).toBe('memory');
    expect(createAuthClient({ mode: 'mock', supabaseUrl: null, anonKey: null }, 'ios').storageKind).toBe('memory');
    expect(createAuthClient({ mode: 'http', supabaseUrl: BASE, anonKey: ANON }, 'web').storageKind).toBe('memory');
    expect(createAuthClient({ mode: 'http', supabaseUrl: BASE, anonKey: ANON }, 'ios').storageKind).toBe('secure');
  });

  it('SecureSessionStorage splits the access token from the rest, device-only, and clears both', async () => {
    const m = new Map<string, string>();
    const opts: unknown[] = [];
    const fake: SecureStoreLike = {
      getItemAsync: async (k, o) => (opts.push(o), m.get(k) ?? null),
      setItemAsync: async (k, v, o) => void (opts.push(o), m.set(k, v)),
      deleteItemAsync: async (k, o) => void (opts.push(o), m.delete(k)),
    };
    const st = new SecureSessionStorage(fake);
    const s: StoredSession = { accessToken: 'a.b.c', refreshToken: 'rt', expiresAt: 1, userId: 'u', email: 'e@x.co', aal: 'aal1', ageConfirmed: true };
    await st.save(s);
    expect(m.size).toBe(2);
    expect([...m.values()].some((v) => v === 'a.b.c')).toBe(true);
    expect([...m.values()].find((v) => v !== 'a.b.c')).not.toContain('a.b.c');
    expect(await st.load()).toEqual(s);
    expect(opts.every((o) => (o as { keychainAccessible: string }).keychainAccessible === 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY')).toBe(true);
    await st.clear();
    expect(m.size).toBe(0);
    expect(await st.load()).toBeNull();
  });
});

describe('gating', () => {
  it('derives status', () => {
    expect(deriveStatus({ session: null, pendingEmail: null, mfaEnrolled: null })).toBe('signed_out');
    expect(deriveStatus({ session: null, pendingEmail: 'a@b.co', mfaEnrolled: null })).toBe('code_sent');
    expect(deriveStatus({ session: { aal: 'aal1' }, pendingEmail: null, mfaEnrolled: false })).toBe('signed_in');
    expect(deriveStatus({ session: { aal: 'aal1' }, pendingEmail: null, mfaEnrolled: true })).toBe('mfa_required');
    expect(deriveStatus({ session: { aal: 'aal2' }, pendingEmail: null, mfaEnrolled: true })).toBe('signed_in');
  });

  it('linking needs sign-in, 18+, then aal2', () => {
    expect(linkGate({ status: 'signed_out', aal: null, ageConfirmed: true })).toBe('auth');
    expect(linkGate({ status: 'code_sent', aal: null, ageConfirmed: true })).toBe('auth');
    expect(linkGate({ status: 'signed_in', aal: 'aal2', ageConfirmed: false })).toBe('auth');
    expect(linkGate({ status: 'signed_in', aal: 'aal1', ageConfirmed: true })).toBe('mfa');
    expect(linkGate({ status: 'mfa_required', aal: 'aal1', ageConfirmed: true })).toBe('mfa');
    expect(linkGate({ status: 'signed_in', aal: 'aal2', ageConfirmed: true })).toBe('ok');
    expect(gateRoute('auth')).toBe('/auth');
    expect(gateRoute('mfa')).toBe('/auth/mfa');
    expect(gateRoute('ok')).toBeNull();
    expect(groupSetupKey('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
  });
});

describe('sandbox flow through the store', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('any email + 123456, enroll + 123456 → aal2; money layer gets the token; sign-out clears', async () => {
    const c = createAuthClient({ mode: 'mock', supabaseUrl: null, anonKey: null }, 'ios');
    resetAuthForTests(c, true);
    const a = () => useAuth.getState();
    await a().init();
    expect(a()).toMatchObject({ status: 'signed_out', sandbox: true, ready: true });

    expect(await a().sendCode('anyone@example.org', true)).toBe(true);
    expect(a().status).toBe('code_sent');
    expect(await a().verifyCode('000000')).toBe(false);
    expect(a().error).toBe(AUTH_COPY.errors.invalid_code);
    expect(await a().verifyCode('123456')).toBe(true);
    expect(a()).toMatchObject({ status: 'signed_in', email: 'anyone@example.org', aal: 'aal1', ageConfirmed: true, mfaEnrolled: false });
    expect(linkGate(a())).toBe('mfa');

    expect(await a().startEnroll()).toBe(true);
    expect(a().enrollment!.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(await a().verifyMfa('999999')).toBe(false);
    expect(await a().verifyMfa('123456')).toBe(true);
    expect(a()).toMatchObject({ status: 'signed_in', aal: 'aal2', mfaEnrolled: true, enrollment: null });
    expect(linkGate(a())).toBe('ok');

    // setMoneyAccessTokenProvider is wired: the HTTP money client sends the session JWT.
    const seen: string[] = [];
    globalThis.fetch = jest.fn(async (_u: unknown, init: any) => {
      seen.push(init.headers.authorization);
      return { ok: true, status: 200, json: async () => [] } as any;
    }) as any;
    await createMoneyClient({ mode: 'http', supabaseUrl: BASE, anonKey: ANON }).listConnections();
    expect(seen[0]).toBe(`Bearer ${c.current!.accessToken}`);
    expect(decodeJwtPayload(c.current!.accessToken)!.aal).toBe('aal2');

    await a().signOut();
    expect(a()).toMatchObject({ status: 'signed_out', email: null, aal: null, ageConfirmed: false });
    expect(c.current).toBeNull();

    // Second sign-in: the authenticator already exists, so the code is asked for (mfa_required).
    await a().sendCode('anyone@example.org', true);
    await a().verifyCode('123456');
    expect(a().status).toBe('mfa_required');
    expect(await a().verifyMfa('123456')).toBe(true);
    expect(a().aal).toBe('aal2');
  });
});

describe('copy', () => {
  it('auth copy has no advice / credit-offer wording', () => {
    const strings: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') strings.push(v);
      else if (typeof v === 'function') strings.push(String((v as (x: string) => string)('sam@example.com')));
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(AUTH_COPY);
    expect(strings.length).toBeGreaterThan(30);
    for (const s of strings) expect({ s, banned: findBannedPhrases(s) }).toEqual({ s, banned: [] });
    expect(AUTH_COPY.mfaWhy).toContain('Banks require two-step sign-in before we can read your accounts');
    expect(AUTH_COPY.sandboxLabel).toBe('Sandbox sign-in');
  });
});

describe('web tab storage', () => {
  it('round-trips a session, rejects junk and clears', async () => {
    const mem = new Map<string, string>();
    const st = new TabSessionStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) });
    const sess = { accessToken: 'a', refreshToken: 'r', userId: 'u', expiresAt: 1 } as never;
    await st.save(sess);
    expect(await st.load()).toEqual(sess);
    mem.set([...mem.keys()][0], '{bad');
    expect(await st.load()).toBeNull();
    await st.clear();
    expect(mem.size).toBe(0);
  });
});
