/**
 * Where the session lives.
 *
 *  - iOS / Android (real mode): expo-secure-store → Keychain / Keystore-backed storage, readable
 *    only after first unlock and never synced to other devices (…_THIS_DEVICE_ONLY).
 *  - Web: MEMORY ONLY. Browsers have no keychain, and localStorage / AsyncStorage are readable by
 *    any script on the page, so the session is deliberately lost on reload and the user signs in
 *    again. Never put tokens in AsyncStorage or localStorage.
 *  - Sandbox (mock mode): memory only on every platform, so nothing from a sandbox sign-in is
 *    ever written to the device.
 *
 * The access token and the rest of the record are stored under two keys because secure-store
 * values over ~2 KB may be rejected on some devices.
 */
import * as SecureStore from 'expo-secure-store';
import type { StoredSession } from './types';

export interface SessionStorage {
  readonly kind: 'secure' | 'memory';
  load(): Promise<StoredSession | null>;
  save(s: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export class MemorySessionStorage implements SessionStorage {
  readonly kind = 'memory' as const;
  private value: StoredSession | null = null;
  async load() {
    return this.value ? { ...this.value } : null;
  }
  async save(s: StoredSession) {
    this.value = { ...s };
  }
  async clear() {
    this.value = null;
  }
}

/** Subset of expo-secure-store we use (injectable for tests). */
export type SecureStoreLike = {
  getItemAsync(key: string, opts?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, opts?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, opts?: SecureStore.SecureStoreOptions): Promise<void>;
};

const KEY_ACCESS = 'tenbagger.auth.access.v1';
const KEY_REST = 'tenbagger.auth.session.v1';

export class SecureSessionStorage implements SessionStorage {
  readonly kind = 'secure' as const;
  private readonly opts: SecureStore.SecureStoreOptions;
  constructor(private readonly store: SecureStoreLike = SecureStore) {
    this.opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  }
  async load(): Promise<StoredSession | null> {
    try {
      const [access, rest] = await Promise.all([this.store.getItemAsync(KEY_ACCESS, this.opts), this.store.getItemAsync(KEY_REST, this.opts)]);
      if (!access || !rest) return null;
      const r = JSON.parse(rest) as Omit<StoredSession, 'accessToken'>;
      if (typeof r.refreshToken !== 'string' || typeof r.userId !== 'string') return null;
      return { ...r, accessToken: access };
    } catch {
      return null; // unreadable (e.g. restored onto a new device): treat as signed out
    }
  }
  async save(s: StoredSession) {
    const { accessToken, ...rest } = s;
    await this.store.setItemAsync(KEY_ACCESS, accessToken, this.opts);
    await this.store.setItemAsync(KEY_REST, JSON.stringify(rest), this.opts);
  }
  async clear() {
    await Promise.all([this.store.deleteItemAsync(KEY_ACCESS, this.opts), this.store.deleteItemAsync(KEY_REST, this.opts)]);
  }
}

/** Picks storage by platform and mode (see the header comment). */
export function pickSessionStorage(opts: { os: string; mode: 'mock' | 'http'; secureStore?: SecureStoreLike }): SessionStorage {
  if (opts.mode === 'mock') return new MemorySessionStorage();
  if (opts.os === 'ios' || opts.os === 'android') return new SecureSessionStorage(opts.secureStore);
  return new MemorySessionStorage(); // web and anything else: memory only, lost on reload
}
