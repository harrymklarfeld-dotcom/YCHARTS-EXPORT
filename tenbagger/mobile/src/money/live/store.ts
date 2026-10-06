/**
 * Linked-accounts state: connections, the latest MoneyData and refresh bookkeeping.
 *
 * PRIVACY: AsyncStorage persists ONLY connection ids, institution ids, statuses and timestamps.
 * Never tokens, balances, transactions or account names; MoneyData stays in memory and is
 * re-fetched on launch. REGULATORY NOTE: linking or refreshing never earns XP or rewards.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sampleMoneyData, type MoneyData } from '../hub';
import { getMoneyClient } from './config';
import { CONNECTIONS_COPY } from './copy';
import { canSync, FOREGROUND_STALE_MS, planRefresh, staleIds } from './freshness';
import { MockMoneyClient, type SavedConnection } from './MockMoneyClient';
import { openPlaidLink } from './plaidLink';
import { MoneyClientError, type Connection } from './types';

type Persisted = {
  saved: SavedConnection[];
  lastSyncedAt: string | null;
  /** Last refresh attempt per connection (epoch ms), for the 15-minute cooldown. */
  lastAttempt: Record<string, number>;
};

export type ActionResult = { ok: boolean; message?: string };

type State = Persisted & {
  connections: Connection[];
  data: MoneyData | null;
  refreshing: Record<string, boolean>;
  loading: boolean;
  initialized: boolean;
  error: string | null;
};

type Actions = {
  /** Load connections + summary from the client (restores sandbox connections in mock mode). */
  init: () => Promise<void>;
  reload: () => Promise<void>;
  link: (institutionId?: string) => Promise<ActionResult>;
  signInAgain: (id: string) => Promise<ActionResult>;
  /** Refresh (all syncable, or `ids`) subject to the 15-minute cooldown. */
  refresh: (ids?: string[]) => Promise<ActionResult>;
  /** App foreground: refresh connections not updated in the last 6 hours. */
  refreshStale: (maxAgeMs?: number) => Promise<void>;
  unlink: (id: string) => Promise<ActionResult>;
  /** Tests: drop everything. */
  reset: () => void;
};

export type ConnectionsStore = State & Actions;

const INITIAL: State = {
  saved: [],
  lastSyncedAt: null,
  lastAttempt: {},
  connections: [],
  data: null,
  refreshing: {},
  loading: false,
  initialized: false,
  error: null,
};

function toSaved(cs: readonly Connection[]): SavedConnection[] {
  return cs.map((c) => ({ id: c.id, institutionId: c.institutionId, lastSyncedAt: c.lastSyncedAt, status: c.status }));
}

function friendly(e: unknown): string {
  if (e instanceof MoneyClientError && e.code === 'signed_out') return 'Sign in to see your linked accounts.';
  return CONNECTIONS_COPY.linkFailed;
}

/** Persisted ids arrive asynchronously from AsyncStorage; wait so a mock session can be restored. */
async function whenHydrated(): Promise<void> {
  const p = useConnections.persist;
  if (!p || p.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const off = p.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

/** Live data when at least one connection exists and a summary loaded; otherwise null (Home shows the sample). */
export function selectLiveData(s: Pick<State, 'connections' | 'data'>): MoneyData | null {
  return s.connections.length > 0 && s.data && s.data.snapshots.length > 0 ? s.data : null;
}

/** What Home renders: live data, or the fictional sample persona (still flagged sample: true). */
export function selectHomeData(s: Pick<State, 'connections' | 'data'>): { data: MoneyData; live: boolean } {
  const live = selectLiveData(s);
  return live ? { data: live, live: true } : { data: sampleMoneyData, live: false };
}

export const useConnections = create<ConnectionsStore>()(
  persist(
    (set, get) => {
      const reload = async () => {
        const client = getMoneyClient();
        const connections = await client.listConnections();
        const data = connections.length ? await client.fetchSummary() : null;
        const times = connections.map((c) => c.lastSyncedAt).filter((x): x is string => !!x).sort();
        set({ connections, data, saved: toSaved(connections), lastSyncedAt: times[times.length - 1] ?? null, error: null });
      };

      const runRefresh = async (ids: string[]) => {
        if (!ids.length) return;
        const now = Date.now();
        set((s) => ({
          refreshing: { ...s.refreshing, ...Object.fromEntries(ids.map((id) => [id, true])) },
          lastAttempt: { ...s.lastAttempt, ...Object.fromEntries(ids.map((id) => [id, now])) },
        }));
        try {
          await getMoneyClient().refresh(ids);
          await reload();
        } finally {
          set((s) => {
            const r = { ...s.refreshing };
            for (const id of ids) delete r[id];
            return { refreshing: r };
          });
        }
      };

      return {
        ...INITIAL,
        reload: async () => {
          try {
            await reload();
          } catch (e) {
            set({ error: friendly(e) });
          }
        },
        init: async () => {
          if (get().loading) return;
          set({ loading: true });
          await whenHydrated();
          const client = getMoneyClient();
          if (client instanceof MockMoneyClient && get().saved.length) client.restore(get().saved);
          try {
            await reload();
          } catch (e) {
            set({ error: friendly(e) });
          } finally {
            set({ loading: false, initialized: true });
          }
        },
        link: async (institutionId) => {
          const client = getMoneyClient();
          try {
            const token = await client.createLinkToken({ institutionId });
            const r = await openPlaidLink(token.linkToken);
            if (r.status === 'unavailable') return { ok: false, message: CONNECTIONS_COPY.linkUnavailable };
            if (r.status === 'exit') return { ok: false, message: CONNECTIONS_COPY.linkCancelled };
            const c = await client.exchangePublicToken(r.publicToken);
            set((s) => ({ lastAttempt: { ...s.lastAttempt, [c.id]: Date.now() } }));
            await reload();
            return { ok: true, message: `${c.institution} linked.` };
          } catch (e) {
            return { ok: false, message: friendly(e) };
          }
        },
        signInAgain: async (id) => {
          const client = getMoneyClient();
          try {
            const token = await client.createLinkToken({ itemId: id });
            const r = await openPlaidLink(token.linkToken);
            if (r.status === 'unavailable') return { ok: false, message: CONNECTIONS_COPY.linkUnavailable };
            if (r.status === 'exit') return { ok: false, message: CONNECTIONS_COPY.linkCancelled };
            // Update mode needs no exchange: the backend flips the item back to active (LOGIN_REPAIRED) and we sync.
            await runRefresh([id]);
            return { ok: true, message: 'Signed in again. Updating now.' };
          } catch (e) {
            return { ok: false, message: friendly(e) };
          }
        },
        refresh: async (ids) => {
          const s = get();
          const candidates = (ids ?? s.connections.map((c) => c.id)).filter((id) => {
            const c = s.connections.find((x) => x.id === id);
            return c ? canSync(c) && !s.refreshing[id] : false;
          });
          const { due, cooling } = planRefresh(candidates, s.lastAttempt, Date.now());
          try {
            if (due.length) await runRefresh(due);
            else await reload(); // still pick up anything the server refreshed on its own (webhooks)
            return due.length || !cooling.length ? { ok: true } : { ok: true, message: CONNECTIONS_COPY.refreshCooling };
          } catch (e) {
            set({ error: friendly(e) });
            return { ok: false, message: friendly(e) };
          }
        },
        refreshStale: async (maxAgeMs = FOREGROUND_STALE_MS) => {
          const s = get();
          const stale = staleIds(s.connections, Date.now(), maxAgeMs).filter((id) => !s.refreshing[id]);
          const { due } = planRefresh(stale, s.lastAttempt, Date.now());
          try {
            await runRefresh(due);
          } catch (e) {
            set({ error: friendly(e) });
          }
        },
        unlink: async (id) => {
          try {
            await getMoneyClient().unlink(id);
            set((s) => {
              const lastAttempt = { ...s.lastAttempt };
              delete lastAttempt[id];
              return { lastAttempt };
            });
            await reload();
            return { ok: true };
          } catch (e) {
            return { ok: false, message: friendly(e) };
          }
        },
        reset: () => set({ ...INITIAL }),
      };
    },
    {
      name: 'tenbagger-money-connections-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): Persisted => ({ saved: s.saved, lastSyncedAt: s.lastSyncedAt, lastAttempt: s.lastAttempt }),
    },
  ),
);
