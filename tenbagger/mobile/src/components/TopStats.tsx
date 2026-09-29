import { View } from 'react-native';
import { displayedStreak } from '../game';
import { today, useApp } from '../state/store';
import { useTheme } from '../theme';
import { StatPill } from './StatPill';

export function TopStats() {
  const t = useTheme();
  const streak = useApp((s) => s.streak);
  const hearts = useApp((s) => s.hearts.count);
  const xp = useApp((s) => s.totalXp);
  const days = displayedStreak(streak, today());
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <StatPill icon="flame" value={days} color={days > 0 ? t.c.flame : t.c.locked} label={`${days} day streak`} />
      <StatPill icon="heart" value={hearts} color={t.c.heart} label={`${hearts} of 5 hearts`} />
      <StatPill icon="star" value={xp} color={t.c.accent} label={`${xp} total XP`} />
    </View>
  );
}
