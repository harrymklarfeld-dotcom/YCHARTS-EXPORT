/** Home: every account in one list (Cash · Investing · Owed), with a hide-balances switch. Read-only. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { groupAccounts, sourcesLine } from '../accounts';
import { LabelChip } from '../components';
import { formatUSD, shortDate, type Snapshot } from '../engine';
import type { TabProps } from './types';
import { Panel } from './ui';

const HIDDEN = '••••';

export function AccountsPanel({ snapshot, goTab, sample }: { snapshot: Snapshot; goTab: TabProps['goTab']; sample: boolean }) {
  const t = useTheme();
  const [hide, setHide] = useState(false);
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
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 4 }}>
        <Icon name="link" color={t.c.inkSoft} size={16} />
        <Text style={{ flex: 1, color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>
          {sample
            ? 'Sample accounts. Read-only bank and brokerage linking is planned for the beta; nothing here can move money.'
            : 'Read-only: Tenbagger can see balances but can never move money.'}
        </Text>
      </View>
    </Panel>
  );
}
