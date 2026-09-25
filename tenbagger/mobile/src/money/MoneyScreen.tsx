/**
 * Money dashboard: a tabbed personal-finance view (Overview · Investments · Bank · Credit ·
 * Income · Spending · Goals · Report). Scrollable segmented tabs on phones, a left rail on
 * wide screens (≥ 900px). Every tab shares one header (net worth, freshness, sample banner).
 *
 * Read-only and educational. Nothing here awards XP (XP only comes from lessons; see src/game/xp.ts).
 * The selected tab lives in the URL (`/money?tab=credit`), so tabs are linkable.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Disclaimer, Eyebrow } from '../components/ui';
import { useTheme } from '../theme';
import { buildDashboard, DASH_TABS, isDashTab, TAB_TITLES, type DashTab } from './dashboard';
import BankTab from './dashboard/BankTab';
import CreditTab from './dashboard/CreditTab';
import GoalsTab from './dashboard/GoalsTab';
import { DashboardHeader } from './dashboard/Header';
import IncomeTab from './dashboard/IncomeTab';
import InvestmentsTab from './dashboard/InvestmentsTab';
import OverviewTab from './dashboard/OverviewTab';
import ReportTab from './dashboard/ReportTab';
import SpendingTab from './dashboard/SpendingTab';
import type { TabProps } from './dashboard/types';
import { getSampleHub } from './hub';
import { useLocalMoney } from './store';

export const WIDE_RAIL = 900;

const TABS: Record<DashTab, ComponentType<TabProps>> = {
  overview: OverviewTab,
  investments: InvestmentsTab,
  bank: BankTab,
  credit: CreditTab,
  income: IncomeTab,
  spending: SpendingTab,
  goals: GoalsTab,
  report: ReportTab,
};

export default function MoneyScreen({ initialTab, embedded }: { initialTab?: DashTab; embedded?: boolean }) {
  const t = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const fromUrl = isDashTab(params.tab) ? params.tab : undefined;
  const [tab, setTabState] = useState<DashTab>(initialTab ?? fromUrl ?? 'overview');
  const hub = useMemo(() => getSampleHub(), []);
  const local = useLocalMoney();
  const dash = useMemo(() => buildDashboard(hub.data, local), [hub.data, local]);
  const { width } = useWindowDimensions();
  const rail = width >= WIDE_RAIL;
  const scroll = useRef<ScrollView>(null);

  const goTab = (next: DashTab) => {
    setTabState(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (!embedded) {
      try {
        router.setParams({ tab: next });
      } catch {
        // setParams is best-effort (deep-link sync only).
      }
    }
  };
  const Active = TABS[tab];
  const contentWide = rail ? width - 220 >= 700 : width >= 700;
  const body = (
    <>
      <Active dash={dash} hub={hub} local={local} wide={contentWide} goTab={goTab} />
      <Disclaimer />
    </>
  );

  if (rail) {
    return (
      <SafeAreaView edges={embedded ? [] : ['top']} style={{ flex: 1, backgroundColor: t.c.bg, flexDirection: 'row' }}>
        <View accessibilityRole="tablist" style={{ width: 208, borderRightWidth: 1, borderRightColor: t.c.line, paddingVertical: 20, paddingHorizontal: 12, gap: 4, backgroundColor: t.c.surface }}>
          <View style={{ paddingHorizontal: 10, paddingBottom: 12, gap: 2 }}>
            <Eyebrow>Money</Eyebrow>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 22, fontWeight: '700', color: t.c.ink }}>Dashboard</Text>
          </View>
          {DASH_TABS.map((id) => (
            <RailItem key={id} id={id} active={id === tab} onPress={() => goTab(id)} />
          ))}
        </View>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48, maxWidth: 1160, width: '100%', alignSelf: 'center' }}>
          <DashboardHeader dash={dash} hub={hub} />
          <Text accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 24, fontWeight: '700', color: t.c.ink }}>
            {TAB_TITLES[tab]}
          </Text>
          {body}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={embedded ? [] : ['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scroll} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <DashboardHeader dash={dash} hub={hub} compact />
        </View>
        <View style={{ backgroundColor: t.c.bg, paddingVertical: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
            {DASH_TABS.map((id) => {
              const on = id === tab;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${TAB_TITLES[id]} tab`}
                  onPress={() => goTab(id)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: t.radius.pill, backgroundColor: on ? t.c.ink : t.c.surface, borderWidth: 1, borderColor: on ? t.c.ink : t.c.line }}
                >
                  <Text style={{ color: on ? t.c.bg : t.c.ink, fontWeight: '800', fontSize: 13 }}>{TAB_TITLES[id]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 14 }}>{body}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RailItem({ id, active, onPress }: { id: DashTab; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${TAB_TITLES[id]} tab`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: t.radius.md,
        backgroundColor: active ? t.c.primarySoft : pressed ? t.c.surfaceAlt : 'transparent',
      })}
    >
      <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: active ? t.c.primary : 'transparent' }} />
      <Text style={{ color: active ? t.c.primary : t.c.ink, fontWeight: active ? '900' : '700', fontSize: 15 }}>{TAB_TITLES[id]}</Text>
    </Pressable>
  );
}
