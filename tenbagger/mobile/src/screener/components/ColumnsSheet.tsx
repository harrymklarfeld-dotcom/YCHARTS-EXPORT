import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Eyebrow } from '../../components/ui';
import { useTheme } from '../../theme';
import { columnGroups, getColumn } from '../columns';
import { MAX_COLUMNS } from '../lists';
import { useScreenerPrefs } from '../store';

/** Choose and order result columns. Saved on this device. Phones show the first 3. */
export function ColumnsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const columns = useScreenerPrefs((s) => s.columns);
  const toggle = useScreenerPrefs((s) => s.toggleColumn);
  const move = useScreenerPrefs((s) => s.moveColumn);
  const reset = useScreenerPrefs((s) => s.resetColumns);
  return (
    <Sheet visible={visible} onClose={onClose} title="Columns">
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Eyebrow>Shown ({columns.length}/{MAX_COLUMNS}) · phones show the first 3</Eyebrow>
          {columns.map((id, i) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.c.line }}>
              <Text style={{ flex: 1, color: t.c.ink, fontWeight: '700' }}>
                {i + 1}. {getColumn(id)?.label ?? id}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${getColumn(id)?.label} up`} onPress={() => move(id, -1)} hitSlop={6} disabled={i === 0}>
                <Icon name="arrowUp" color={i === 0 ? t.c.locked : t.c.ink} size={18} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${getColumn(id)?.label} down`} onPress={() => move(id, 1)} hitSlop={6} disabled={i === columns.length - 1}>
                <Icon name="arrowDown" color={i === columns.length - 1 ? t.c.locked : t.c.ink} size={18} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Hide ${getColumn(id)?.label}`} onPress={() => toggle(id)} hitSlop={6} disabled={columns.length <= 1}>
                <Icon name="close" color={t.c.inkSoft} size={18} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Reset columns to defaults" onPress={reset} style={{ paddingVertical: 8 }}>
            <Text style={{ color: t.c.primary, fontWeight: '800' }}>Reset to defaults</Text>
          </Pressable>
        </View>
        {columnGroups().map((g) => (
          <View key={g.group} style={{ gap: 6 }}>
            <Eyebrow>{g.group}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {g.columns.map((c) => {
                const on = columns.includes(c.id);
                const full = !on && columns.length >= MAX_COLUMNS;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: full }}
                    accessibilityLabel={c.label}
                    disabled={full}
                    onPress={() => toggle(c.id)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? t.c.ink : t.c.line, backgroundColor: on ? t.c.ink : t.c.surface, opacity: full ? 0.5 : 1 }}
                  >
                    <Text style={{ color: on ? t.c.bg : t.c.ink, fontWeight: '700', fontSize: 12 }}>{c.short}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </Sheet>
  );
}
