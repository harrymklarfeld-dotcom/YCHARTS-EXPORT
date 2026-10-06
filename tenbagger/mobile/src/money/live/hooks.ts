/** React glue for the live money layer: Home data selection, auto-refresh on foreground, a minute clock. */
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { buildMoneyHub, getSampleHub, type MoneyHub } from '../hub';
import { homeFreshness } from './freshness';
import { selectLiveData, useConnections } from './store';

/** Re-renders every minute so "Updated X min ago" stays true. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Home's hub: live data when at least one connection exists, otherwise the fictional sample. */
export function useHomeHub(): { hub: MoneyHub; live: boolean } {
  const connections = useConnections((s) => s.connections);
  const data = useConnections((s) => s.data);
  const liveData = selectLiveData({ connections, data });
  return useMemo(() => {
    if (liveData) {
      try {
        return { hub: buildMoneyHub(liveData), live: true };
      } catch {
        // Malformed live data: fall back to the clearly-labelled sample rather than crash.
      }
    }
    return { hub: getSampleHub(), live: false };
  }, [liveData]);
}

export function useHomeFreshness(): string {
  const connections = useConnections((s) => s.connections);
  const now = useNow();
  return homeFreshness(connections, now);
}

/** Loads connections once, then refreshes stale ones (> 6 h) whenever the app returns to the foreground. */
export function useMoneyAutoRefresh(): void {
  const init = useConnections((s) => s.init);
  const refreshStale = useConnections((s) => s.refreshStale);
  useEffect(() => {
    let cancelled = false;
    void init().then(() => {
      if (!cancelled) void refreshStale();
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshStale();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [init, refreshStale]);
}
