/**
 * Hearts (lives). Wrong answers cost a heart; hearts regenerate over time.
 * Hearts can never be bought — there are no purchases or trading rewards in the app.
 */

export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 30 * 60 * 1000; // one heart every 30 minutes

export type HeartsState = {
  count: number;
  /** Epoch ms from which the next heart's regen timer counts; null when full. */
  regenFrom: number | null;
};

export const INITIAL_HEARTS: HeartsState = { count: MAX_HEARTS, regenFrom: null };

/** Apply elapsed regen time. Pure; call with the current time before reading hearts. */
export function regenHearts(state: HeartsState, now: number): HeartsState {
  if (state.count >= MAX_HEARTS || state.regenFrom === null) {
    return { count: Math.min(state.count, MAX_HEARTS), regenFrom: null };
  }
  const elapsed = Math.max(0, now - state.regenFrom);
  const gained = Math.floor(elapsed / HEART_REGEN_MS);
  if (gained <= 0) return state;
  const count = Math.min(MAX_HEARTS, state.count + gained);
  if (count >= MAX_HEARTS) return { count: MAX_HEARTS, regenFrom: null };
  return { count, regenFrom: state.regenFrom + gained * HEART_REGEN_MS };
}

export function loseHeart(state: HeartsState, now: number): HeartsState {
  const s = regenHearts(state, now);
  if (s.count <= 0) return s;
  return {
    count: s.count - 1,
    // Start the timer only if we were full; otherwise keep the in-progress timer.
    regenFrom: s.regenFrom ?? now,
  };
}

/** Milliseconds until the next heart, or null when full. */
export function msUntilNextHeart(state: HeartsState, now: number): number | null {
  const s = regenHearts(state, now);
  if (s.regenFrom === null) return null;
  return Math.max(0, s.regenFrom + HEART_REGEN_MS - now);
}
