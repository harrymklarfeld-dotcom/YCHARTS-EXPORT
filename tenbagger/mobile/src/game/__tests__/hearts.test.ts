import { HEART_REGEN_MS, INITIAL_HEARTS, loseHeart, MAX_HEARTS, msUntilNextHeart, regenHearts } from '../hearts';

const T0 = 1_800_000_000_000;

describe('hearts', () => {
  it('starts full with no timer', () => {
    expect(INITIAL_HEARTS).toEqual({ count: MAX_HEARTS, regenFrom: null });
    expect(msUntilNextHeart(INITIAL_HEARTS, T0)).toBeNull();
  });

  it('losing a heart from full starts the regen timer', () => {
    const s = loseHeart(INITIAL_HEARTS, T0);
    expect(s).toEqual({ count: 4, regenFrom: T0 });
    expect(msUntilNextHeart(s, T0 + 1000)).toBe(HEART_REGEN_MS - 1000);
  });

  it('keeps the running timer when losing more hearts', () => {
    let s = loseHeart(INITIAL_HEARTS, T0);
    s = loseHeart(s, T0 + 10 * 60_000);
    expect(s).toEqual({ count: 3, regenFrom: T0 });
  });

  it('regenerates one heart per interval and carries remainder', () => {
    let s = { count: 1, regenFrom: T0 };
    s = regenHearts(s, T0 + 2.5 * HEART_REGEN_MS);
    expect(s).toEqual({ count: 3, regenFrom: T0 + 2 * HEART_REGEN_MS });
  });

  it('caps at max and clears the timer', () => {
    const s = regenHearts({ count: 2, regenFrom: T0 }, T0 + 100 * HEART_REGEN_MS);
    expect(s).toEqual({ count: MAX_HEARTS, regenFrom: null });
  });

  it('never goes below zero', () => {
    const s = loseHeart({ count: 0, regenFrom: T0 }, T0 + 1);
    expect(s.count).toBe(0);
  });

  it('is robust to clocks moving backwards', () => {
    const s = { count: 2, regenFrom: T0 };
    expect(regenHearts(s, T0 - 5_000)).toEqual(s);
  });
});
