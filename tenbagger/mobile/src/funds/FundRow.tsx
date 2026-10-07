import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { TickerBadge } from '../components/CompanyRow';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme';
import { expensePercent } from './facts';
import type { Fund } from './types';

export function FundRow({ fund }: { fund: Fund }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fund.name}, ${fund.ticker}. ${fund.category}. Expense ratio ${expensePercent(fund.expense_ratio)}.${fund.is_sample ? ' Sample data.' : ''} Open fund.`}
      onPress={() => router.push(`/fund/${fund.ticker}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.c.line,
      })}
    >
      <TickerBadge ticker={fund.ticker} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{fund.name}</Text>
        <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 12 }}>
          {fund.category}
          {fund.is_sample ? ' · sample' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, color: t.c.inkSoft }}>Fee</Text>
        <Text style={{ fontWeight: '800', fontSize: 14, color: t.c.ink, fontVariant: ['tabular-nums'] }}>{expensePercent(fund.expense_ratio)}</Text>
      </View>
      <Icon name="chevron" color={t.c.inkSoft} size={18} />
    </Pressable>
  );
}
