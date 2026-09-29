import { Pressable, Text, View } from 'react-native';
import type { RangeInfo } from '../funds/range';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  info: RangeInfo;
  format: (v: number) => string;
  onPress?: () => void;
};

/**
 * "lowest ← marker → highest" bar: where one company sits among its peers.
 * The track is neutral (position, not a grade); the marker is the company, the small tick the
 * peer median. The sentence underneath comes from the screener's compareToPeers.
 */
export function RangeBar({ label, info, format, onPress }: Props) {
  const t = useTheme();
  const pos: `${number}%` = `${Math.round(info.position * 1000) / 10}%`;
  const medPos =
    info.median !== null && info.max > info.min ? Math.max(0, Math.min(1, (info.median - info.min) / (info.max - info.min))) : null;
  const a11y = `${label}: ${format(info.value)}. Lowest ${format(info.min)}, highest ${format(info.max)} among ${info.peerCount + 1} ${info.groupLabel}. ${info.sentence}`;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={onPress ? `${a11y} Tap for explanation.` : a11y}
      onPress={onPress}
      style={({ pressed }) => ({ gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: t.radius.md, backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface, borderWidth: 1, borderColor: t.c.line })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{label}</Text>
          {onPress && <Icon name="info" color={t.c.locked} size={13} />}
        </View>
        <Text style={{ color: t.c.ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{format(info.value)}</Text>
      </View>
      <View style={{ height: 22, justifyContent: 'center' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.c.surfaceAlt, borderWidth: 1, borderColor: t.c.line }} />
        {medPos !== null && (
          <View style={{ position: 'absolute', left: `${medPos * 100}%`, width: 2, height: 12, marginLeft: -1, backgroundColor: t.c.inkSoft, borderRadius: 1 }} />
        )}
        <View
          style={{
            position: 'absolute',
            left: pos,
            marginLeft: -9,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: t.c.ink,
            borderWidth: 3,
            borderColor: t.c.surface,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontVariant: ['tabular-nums'] }}>← lowest {format(info.min)}</Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontVariant: ['tabular-nums'] }}>highest {format(info.max)} →</Text>
      </View>
      <Text style={{ color: t.c.ink, fontSize: 12 }}>{info.sentence}</Text>
    </Pressable>
  );
}
