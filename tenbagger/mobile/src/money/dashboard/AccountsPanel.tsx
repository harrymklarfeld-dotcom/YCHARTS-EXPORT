/**
 * Home: every account in one list (Cash · Investing · Owed), with a hide-balances switch, a freshness
 * line for linked connections and a link to Manage connections. Read-only.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { groupAccounts, sourcesLine } from '../accounts';
import { LabelChip } from '../components';
import { formatUSD, shortDate, type Snapshot } from '../engine';
import { HOME_LINK_COPY } from '../live/copy';
import { useHomeFreshness } from '../live/hooks';
import { useConnections } from '../live/store';
import type { TabProps } from './types';
import { Panel } from './ui';

const HIDDEN = '••••';

export function AccountsPanel({ snapshot, goTab, sample }: { snapshot: Snapshot; goTab: TabProps['goTab']; sample: boolean }) {
  const t = useTheme();
  const [hide, setHide] = useState(false);
  const linked = useConnections((s) => s.connections.length) > 0;
  const freshness = useHomeFreshness();
  const groups = groupAccounts(snapshot);
  const amt = (v: number) => (hide ? HIDDEN : formatUSD(v));
  return (
    <Panel
      eyebrow={sourcesLine(snapshot)}
      title="All your accounts"
      right={
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: hide }}
          accessibilityLabel="Hide balances"
          onPress={() => setHide((h) => !h)}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.c.line, backgroundColor: hide ? t.c.ink : t.c.surface }}
        >
          <Text style={{ color: hide ? t.c.bg : t.c.ink, fontSize: 12, fontWeight: '800' }}>{hide ? 'Show balances' : 'Hide balances'}</Text>
        </Pressable>
      }
    >
      {groups.map((g) => (
        <View key={g.id} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: t.c.line }}>
            <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{g.title.toUpperCase()}</Text>
            <Text style={{ color: g.id === 'owed' ? t.c.danger : t.c.ink, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
              {g.id === 'owed' && !hide ? '−' : ''}
              {amt(g.total)}
            </Text>
          </View>
          {g.rows.map((r) => {
            const a = r.account;
            const owed = g.id === 'owed';
            return (
              <Pressable
                key={a.id}
                accessibilityRole="link"
                accessibilityLabel={`${a.name}, ${r.kindLabel}, ${hide ? 'balance hidden' : `${owed ? 'owed ' : ''}${formatUSD(a.balance)}`}. Opens the ${r.tab} tab.`}
                onPress={() => goTab(r.tab)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ color: t.c.ink, fontSize: 15, fontWeight: '700' }}>{a.name}</Text>
                    <LabelChip label={a.basis} small />
                  </View>
                  <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
                    {[r.kindLabel === a.name ? '' : r.kindLabel, r.daysOld > 0 ? `as of ${shortDate(a.asOf)}` : '', r.note].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: owed ? t.c.danger : t.c.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{amt(a.balance)}</Text>
                <Icon name="chevron" color={t.c.inkSoft} size={13} />
              </Pressable>
            );
          })}
        </View>
      ))}
      {linked && freshness ? (
        <Text accessibilityLabel={`Accounts: ${freshness}`} style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>
          {freshness}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 4 }}>
        <Icon name="link" color={t.c.inkSoft} size={16} />
        <Text style={{ flex: 1, color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>
          {!linked ? HOME_LINK_COPY.sample : sample ? HOME_LINK_COPY.sandbox : HOME_LINK_COPY.live}
        </Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${HOME_LINK_COPY.manage}. Opens the connections screen.`}
        onPress={() => router.push('/money/connections')}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>{HOME_LINK_COPY.manage}</Text>
        <Icon name="chevron" color={t.c.primary} size={13} />
      </Pressable>
    </Panel>
  );
}
