import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { describeFilterPlain, type FunnelOutput } from '../../lib/screener';
import type { Filter } from '../../types/contract';
import { useTheme } from '../../theme';

/**
 * Editable filter chips. Each shows the condition and how many companies are left after it
 * ("→ 128 left"), in screen order. Tap to edit, × to remove (when editable).
 */
export function FilterChips({
  filters,
  funnel,
  onEdit,
  onRemove,
  onExplain,
}: {
  filters: readonly Filter[];
  funnel: FunnelOutput | null;
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
  onExplain?: (metric: string) => void;
}) {
  const t = useTheme();
  if (!filters.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {filters.map((f, i) => {
        const step = funnel?.steps[i];
        const isBig = funnel?.biggestCut?.index === i;
        const label = describeFilterPlain(f as never);
        return (
          <View
            key={`${f.metric}-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.c.primarySoft,
              borderRadius: 999,
              borderWidth: isBig ? 1.5 : 0,
              borderColor: t.c.accent,
              paddingLeft: 12,
              paddingRight: onRemove ? 4 : 12,
              paddingVertical: 4,
              gap: 6,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}${step ? `, ${step.after} left` : ''}. ${onEdit ? 'Edit filter' : 'What does this mean?'}`}
              onPress={() => (onEdit ? onEdit(i) : onExplain?.(f.metric))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}
            >
              <Text style={{ color: t.c.ink, fontWeight: '700', fontSize: 13 }}>{label}</Text>
              {step ? (
                <Text style={{ color: isBig ? t.c.accent : t.c.inkSoft, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] }}>
                  → {step.after} left
                </Text>
              ) : null}
            </Pressable>
            {onRemove ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove filter ${label}`} onPress={() => onRemove(i)} hitSlop={6} style={{ padding: 4 }}>
                <Icon name="close" color={t.c.inkSoft} size={14} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
