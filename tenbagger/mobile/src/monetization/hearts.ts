/** Pure helper for the rewarded "+1 heart" (a user-initiated ad; hearts are never sold). */
import { MAX_HEARTS, regenHearts, type HeartsState } from '../game/hearts';

export function grantOneHeart(state: HeartsState, now: number): HeartsState {
  const s = regenHearts(state, now);
  if (s.count >= MAX_HEARTS) return { count: MAX_HEARTS, regenFrom: null };
  const count = s.count + 1;
  return count >= MAX_HEARTS ? { count: MAX_HEARTS, regenFrom: null } : { count, regenFrom: s.regenFrom };
}
