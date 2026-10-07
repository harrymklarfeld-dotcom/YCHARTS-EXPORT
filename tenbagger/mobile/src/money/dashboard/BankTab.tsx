/** Bank: accounts, searchable transactions (in/out filter), paydays calendar, pending pay callout, cash runway. */
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { LabelChip, Money } from '../components';
import { addDays, categoryTitle, formatUSD, monthKey, parts, shortDate, weekday, type ISODate } from '../engine';
import type { TabProps } from './types';
import { Explainer, Grid, KV, LinkPill, Panel, Segmented } from './ui';

type Flow = 'all' | 'in' | 'out';

export default function BankTab({ dash, wide, goTab }: TabProps) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [flow, setFlow] = useState<Flow>('all');
  const [limit, setLimit] = useState(25);
  const accounts = dash.latest.accounts.filter((a) => a.kind === 'checking' || a.kind === 'savings');
  const names = Object.fromEntries(dash.latest.accounts.map((a) => [a.id, a.name]));
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dash.tx.filter(
      (x) =>
        (flow === 'all' || (flow === 'in' ? x.amount > 0 : x.amount < 0)) &&
        (!needle || x.name.toLowerCase().includes(needle) || categoryTitle(x.category).toLowerCase().includes(needle)),
    );
  }, [dash.tx, q, flow]);
  const pendingTotal = dash.pending.reduce((s, p) => s + p.net, 0);

  return (
    <View style={{ gap: 14 }}>
      <Grid wide={wide} min={300}>
        <Panel eyebrow="Checking + savings" title="Accounts">
          {accounts.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{a.name}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>as of {shortDate(a.asOf)}</Text>
              </View>
              <LabelChip label={a.basis} small />
              <Money value={a.balance} size={17} />
            </View>
          ))}
          <KV label="Total cash" value={formatUSD(dash.breakdown.liquidity.value)} basis={dash.breakdown.liquidity.label} strong />
        </Panel>
        <Panel eyebrow="If no new money came in" title="Cash runway" right={<LabelChip label="estimate" small />}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ color: t.c.ink, fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{dash.runwayDays ?? '—'}</Text>
            <Text style={{ color: t.c.inkSoft, fontSize: 15, fontWeight: '700' }}>days</Text>
          </View>
          <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>
            {formatUSD(dash.breakdown.liquidity.value)} of cash ÷ about {formatUSD(dash.dailySpend.value, { cents: true })} of spending a day (average of the last {dash.dailySpend.days} days, card and debit, excluding card payments and transfers).
          </Text>
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Card purchases count here too: they are paid from this cash when the bill comes.</Text>
        </Panel>
      </Grid>

      {dash.pending.length ? (
        <Explainer title={`Pending pay: ${formatUSD(pendingTotal)} waiting on paperwork`} tone="warn">
          <View style={{ gap: 6 }}>
            {dash.pending.map((p) => (
              <Text key={p.streamId} style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>
                {p.reminder}
              </Text>
            ))}
            <LinkPill label="Log or submit hours" onPress={() => goTab('income')} icon="plus" />
          </View>
        </Explainer>
      ) : null}

      <Panel eyebrow={`${monthLabel(dash.asOf)} and next month`} title="Paydays calendar">
        <PaydayCalendar dash={dash} />
      </Panel>

      <Panel eyebrow={`${rows.length} of ${dash.tx.length}`} title="Recent transactions">
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search merchant or category"
          placeholderTextColor={t.c.inkSoft}
          accessibilityLabel="Search transactions"
          style={{ borderWidth: 1, borderColor: t.c.line, borderRadius: t.radius.md, paddingHorizontal: 12, paddingVertical: 9, color: t.c.ink, backgroundColor: t.c.bg, fontSize: 14 }}
        />
        <Segmented<Flow>
          label="Filter by direction"
          value={flow}
          onChange={setFlow}
          options={[
            { id: 'all', label: 'All' },
            { id: 'in', label: 'Money in' },
            { id: 'out', label: 'Money out' },
          ]}
        />
        <View>
          {rows.slice(0, limit).map((x, i) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
              <Text style={{ width: 48, color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{shortDate(x.date)}</Text>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: t.c.ink, fontSize: 14, fontWeight: '700' }}>
                  {x.name}
                </Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>
                  {categoryTitle(x.category)} · {names[x.accountId] ?? x.accountId}
                  {x.pending ? ' · pending' : ''}
                </Text>
              </View>
              <Text style={{ color: x.amount > 0 ? t.c.primary : t.c.ink, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>{formatUSD(x.amount, { cents: true, signed: true })}</Text>
            </View>
          ))}
          {rows.length === 0 ? <Text style={{ color: t.c.inkSoft, paddingVertical: 8 }}>No transactions match.</Text> : null}
        </View>
        {rows.length > limit ? <LinkPill label={`Show more (${rows.length - limit} left)`} onPress={() => setLimit((l) => l + 25)} icon="plus" /> : null}
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>On the card, a purchase shows as money out and a payment as money in.</Text>
      </Panel>
    </View>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function monthLabel(d: ISODate): string {
  return MONTHS[parts(d).m - 1] ?? '';
}

function PaydayCalendar({ dash }: { dash: TabProps['dash'] }) {
  const t = useTheme();
  const start = `${monthKey(dash.asOf)}-01`;
  const first = weekday(start);
  const cells: (ISODate | null)[] = Array.from({ length: first }, () => null);
  for (let d = start, i = 0; i < 42 - first; d = addDays(d, 1), i++) cells.push(d);
  const byDate = new Map<string, { pay: number; pending: boolean; due: boolean }>();
  for (const p of dash.coverage.runway)
    for (const e of p.events) {
      const cur = byDate.get(p.date) ?? { pay: 0, pending: false, due: false };
      if (e.kind === 'deposit') {
        cur.pay += e.amount;
        cur.pending = cur.pending || e.basis === 'pending';
      } else cur.due = true;
      byDate.set(p.date, cur);
    }
  for (const x of dash.tx) {
    if (x.category !== 'income' || x.amount <= 0 || x.date < start) continue;
    const cur = byDate.get(x.date) ?? { pay: 0, pending: false, due: false };
    cur.pay += x.amount;
    byDate.set(x.date, cur);
  }
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.c.inkSoft, fontSize: 11, fontWeight: '800' }}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.slice(0, 6).map((w, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: 3 }}>
          {w.map((d, di) => {
            const ev = d ? byDate.get(d) : undefined;
            const today = d === dash.asOf;
            const other = d ? d.slice(0, 7) !== start.slice(0, 7) : false;
            return (
              <View
                key={di}
                accessible={!!ev}
                accessibilityLabel={d && ev ? `${shortDate(d)}: ${ev.pay ? `${formatUSD(ev.pay)} pay${ev.pending ? ', partly pending' : ''}` : ''}${ev.due ? ' card due' : ''}` : undefined}
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 8,
                  padding: 3,
                  backgroundColor: ev?.pay ? (ev.pending ? t.c.accentSoft : t.c.primarySoft) : 'transparent',
                  borderWidth: today || ev?.due ? 1.5 : 0,
                  borderColor: ev?.due ? t.c.danger : t.c.ink,
                  opacity: d ? (other ? 0.55 : 1) : 0,
                }}
              >
                <Text style={{ color: t.c.ink, fontSize: 11, fontWeight: today ? '900' : '600' }}>{d ? Number(d.slice(8)) : ''}</Text>
                {ev?.pay ? <Text style={{ color: t.c.ink, fontSize: 9, fontWeight: '800' }}>{formatUSD(ev.pay)}</Text> : null}
                {ev?.due ? <Text style={{ color: t.c.danger, fontSize: 9, fontWeight: '800' }}>due</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        <Key color={t.c.primarySoft} text="Pay landed or projected" />
        <Key color={t.c.accentSoft} text="Includes pending pay" />
        <Key color="transparent" border={t.c.danger} text="Card due" />
        <Key color="transparent" border={t.c.ink} text="Today (sample)" />
      </View>
    </View>
  );
}

function Key({ color, text, border }: { color: string; text: string; border?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, borderWidth: border ? 1.5 : 0, borderColor: border }} />
      <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>{text}</Text>
    </View>
  );
}
