import { Pressable, Text, View } from 'react-native';
import { METRIC_CATALOG, type MetricGroup } from '../lib/metricCatalog';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Eyebrow } from './ui';

const GROUPS: MetricGroup[] = ['Valuation', 'Profitability', 'Cash flow', 'Health', 'Growth', 'Size'];

export function MetricPicker({ visible, onClose, onPick, onExplain, title = 'Choose a metric' }: { visible: boolean; onClose: () => void; onPick: (key: string) => void; onExplain: (key: string) => void; title?: string }) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 16 }}>
        {GROUPS.map((g) => (
          <View key={g} style={{ gap: 6 }}>
            <Eyebrow>{g}</Eyebrow>
            {METRIC_CATALOG.filter((m) => m.group === g).map((m) => (
              <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.c.line }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Pick ${m.label}`} onPress={() => onPick(m.key)} style={{ flex: 1, paddingVertical: 12 }}>
                  <Text style={{ color: t.c.ink, fontWeight: '700', fontSize: 15 }}>
                    {m.label} <Text style={{ color: t.c.inkSoft, fontWeight: '500' }}>· {m.short}</Text>
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`What is ${m.label}?`} onPress={() => onExplain(m.key)} hitSlop={8} style={{ padding: 8 }}>
                  <Icon name="info" color={t.c.inkSoft} size={20} />
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Sheet>
  );
}
