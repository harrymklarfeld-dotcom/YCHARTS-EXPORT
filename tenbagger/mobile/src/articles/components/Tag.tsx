import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { Level } from '../types';

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'sample' | 'real' | 'primary' }) {
  const t = useTheme();
  const bg = tone === 'sample' ? t.c.accentSoft : tone === 'real' || tone === 'primary' ? t.c.primarySoft : t.c.surfaceAlt;
  const fg = tone === 'sample' ? t.c.accent : tone === 'real' || tone === 'primary' ? t.c.primary : t.c.inkSoft;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.3, fontFamily: t.fonts.body }}>{label}</Text>
    </View>
  );
}

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function LevelTag({ level }: { level: Level }) {
  return <Tag label={LEVEL_LABEL[level]} tone={level === 'beginner' ? 'primary' : level === 'advanced' ? 'sample' : 'neutral'} />;
}
