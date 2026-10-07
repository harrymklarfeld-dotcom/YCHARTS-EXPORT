/**
 * Auth state for the UI. Tokens never enter this store: it only mirrors status, email and aal.
 * Wires the money layer's JWT provider (setMoneyAccessTokenProvider) to AuthClient.getAccessToken().
 *
 * Real mode: EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY set (see money/live/config.ts).
 * Sandbox: readMoneyConfig().mode === 'mock' → the local fake in ./sandbox.ts, memory only.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import { readMoneyConfig, setMoneyAccessTokenProvider, type MoneyClientConfig } from '../money/live/config';
import { useConnections } from '../money/live/store';
import { AuthClient } from './AuthClient';
import { AUTH_COPY } from './copy';
import { deriveStatus, linkGate, type AuthStatus, type LinkGate } from './gate';
import { createSandboxAuthFetch } from './sandbox';
import { MemorySessionStorage, pickSessionStorage } from './storage';
import { AuthError, type Aal, type StoredSession, type TotpEnrollment } from './types';

export function createAuthClient(cfg: MoneyClientConfig = readMoneyConfig(), os: string = Platform.OS): AuthClient {
  if (cfg.mode === 'http' && cfg.supabaseUrl && cfg.anonKey) {
    return new AuthClient({
      baseUrl: cfg.supabaseUrl,
      anonKey: cfg.anonKey,
      fetch: (url, init) => fetch(url, init),
      storage: pickSessionStorage({ os, mode: 'http' }),
    });
  }
  return new AuthClient({ baseUrl: 'https://sandbox.invalid', anonKey: 'sandbox', fetch: createSandboxAuthFetch(), storage: new MemorySessionStorage() });
}

let client: AuthClient | null = null;
let unsubscribe: (() => void) | null = null;

export function getAuthClient(): AuthClient {
  if (!client) setAuthClient(createAuthClient());
  return client!;
}

/** Tests / config changes: swap the client (also rewires the money JWT provider). */
export function setAuthClient(c: AuthClient | null, sandbox: boolean = readMoneyConfig().mode === 'mock'): void {
  unsubscribe?.();
  unsubscribe = null;
  client = c;
  if (!c) return;
  setMoneyAccessTokenProvider(() => c.getAccessToken());
  unsubscribe = c.onChange((s) => useAuth.getState()._sync(s));
  useAuth.setState({ sandbox, ready: false });
}

export type PendingAfterAuth = 'link' | null;

type State = {
  ready: boolean;
  sandbox: boolean;
  status: AuthStatus;
  email: string | null;
  pendingEmail: string | null;
  aal: Aal | null;
  ageConfirmed: boolean;
  /** null = not checked yet. */
  mfaEnrolled: boolean | null;
  enrollment: TotpEnrollment | null;
  busy: boolean;
  error: string | null;
  /** What to resume once sign-in finishes (Connections → Link an account). */
  pendingAfterAuth: PendingAfterAuth;
};

type Actions = {
  init: () => Promise<void>;
  sendCode: (email: string, ageConfirmed: boolean) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  changeEmail: () => void;
  confirmAge: () => Promise<void>;
  loadFactors: () => Promise<void>;
  startEnroll: () => Promise<boolean>;
  verifyMfa: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setPendingAfterAuth: (p: PendingAfterAuth) => void;
  clearError: () => void;
  /** Internal: mirror the client's session. */
  _sync: (s: StoredSession | null) => void;
};

export type AuthStore = State & Actions;

const INITIAL: State = {
  ready: false,
  sandbox: true,
  status: 'signed_out',
  email: null,
  pendingEmail: null,
  aal: null,
  ageConfirmed: false,
  mfaEnrolled: null,
  enrollment: null,
  busy: false,
  error: null,
  pendingAfterAuth: null,
};

export function friendlyAuthError(e: unknown): string {
  if (e instanceof AuthError) return AUTH_COPY.errors[e.code];
  return AUTH_COPY.errors.server;
}

export const useAuth = create<AuthStore>()((set, get) => {
  const recompute = (patch: Partial<State> = {}) => {
    const next = { ...get(), ...patch };
    const session = getAuthClient().current;
    set({ ...patch, status: deriveStatus({ session, pendingEmail: next.pendingEmail, mfaEnrolled: next.mfaEnrolled }) });
  };

  const guarded = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    set({ busy: true, error: null });
    try {
      return await fn();
    } catch (e) {
      set({ error: friendlyAuthError(e) });
      return fallback;
    } finally {
      set({ busy: false });
    }
  };

  return {
    ...INITIAL,
    _sync: (s) => {
      if (!s) {
        recompute({ email: null, aal: null, mfaEnrolled: null, enrollment: null, ageConfirmed: get().pendingEmail ? get().ageConfirmed : false });
        return;
      }
      recompute({ email: s.email, aal: s.aal, ageConfirmed: s.ageConfirmed, pendingEmail: null, ...(s.aal === 'aal2' ? { mfaEnrolled: true } : {}) });
    },
    init: async () => {
      if (get().ready) return;
      const c = getAuthClient();
      try {
        const s = await c.restore();
        get()._sync(s);
        if (s && s.aal === 'aal1') await get().loadFactors();
      } finally {
        set({ ready: true });
      }
    },
    sendCode: (email, ageConfirmed) =>
      guarded(async () => {
        await getAuthClient().sendCode(email);
        recompute({ pendingEmail: email.trim().toLowerCase(), ageConfirmed });
        return true;
      }, false),
    verifyCode: (code) =>
      guarded(async () => {
        const email = get().pendingEmail;
        if (!email) throw new AuthError('signed_out', 'no pending email');
        const s = await getAuthClient().verifyCode(email, code, { ageConfirmed: get().ageConfirmed });
        if (s.aal === 'aal1') await get().loadFactors();
        return true;
      }, false),
    changeEmail: () => recompute({ pendingEmail: null, error: null }),
    confirmAge: async () => {
      await getAuthClient().setAgeConfirmed(true);
      set({ ageConfirmed: true });
    },
    loadFactors: async () => {
      try {
        const factors = await getAuthClient().listFactors();
        recompute({ mfaEnrolled: factors.some((f) => f.type === 'totp' && f.status === 'verified') });
      } catch (e) {
        set({ error: friendlyAuthError(e) });
      }
    },
    startEnroll: () =>
      guarded(async () => {
        set({ enrollment: await getAuthClient().enrollTotp() });
        return true;
      }, false),
    verifyMfa: (code) =>
      guarded(async () => {
        const c = getAuthClient();
        let factorId = get().enrollment?.factorId;
        if (!factorId) {
          const verified = (await c.listFactors()).find((f) => f.type === 'totp' && f.status === 'verified');
          if (!verified) throw new AuthError('signed_out', 'no factor');
          factorId = verified.id;
        }
        await c.verifyTotp(factorId, code);
        recompute({ enrollment: null, mfaEnrolled: true });
        return true;
      }, false),
    signOut: async () => {
      set({ busy: true });
      try {
        await getAuthClient().signOut();
      } finally {
        set({ busy: false, pendingAfterAuth: null, pendingEmail: null, ageConfirmed: false });
        get()._sync(null);
        // Real mode: drop linked-account data from memory. Sandbox connections are fictional; keep them.
        if (!get().sandbox) useConnections.getState().reset();
      }
    },
    setPendingAfterAuth: (p) => set({ pendingAfterAuth: p }),
    clearError: () => set({ error: null }),
  };
});

/** Selector helper for the link gate. */
export function selectLinkGate(s: Pick<State, 'status' | 'aal' | 'ageConfirmed'>): LinkGate {
  return linkGate(s);
}

/** Tests: forget everything (client and state). */
export function resetAuthForTests(c: AuthClient | null = null, sandbox = true): void {
  useAuth.setState({ ...INITIAL });
  setAuthClient(c, sandbox);
}
