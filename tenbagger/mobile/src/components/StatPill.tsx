import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export function StatPill({ icon, value, color, label }: { icon: IconName; value: string | number; color: string; label: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: t.radius.pill, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line }}>
      <Icon name={icon} color={color} fill={color} size={18} strokeWidth={1.5} />
      <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
