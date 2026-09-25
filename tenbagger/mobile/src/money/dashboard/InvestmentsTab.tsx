/**
 * Investments: holdings (value, weight, gain), allocation donut, benchmark comparison vs VOO
 * (ESTIMATE), dividends, Roth IRA contribution tracker, a look-through X-ray (reusing
 * src/funds/xray.ts) and links to company pages and the diversification explainer.
 * Descriptive only: no buy/sell language, no picks.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { getCompanies, getCompany } from '../../data';
import { getFunds } from '../../funds/data';
import { xray } from '../../funds/xray';
import { useTheme } from '../../theme';
import { Donut, LegendItem, LineChart, useCategorical } from '../charts';
import { LabelChip, Money } from '../components';
import { formatUSD, shortDate } from '../engine';
import type { TabProps } from './types';
import { Explainer, Grid, KV, LinkPill, Measure, Panel, pct } from './ui';

const ACCOUNT_NAMES: Record<string, string> = { brk: 'Brokerage', roth: 'Roth IRA' };

export default function InvestmentsTab({ dash, hub, wide }: TabProps) {
  const t = useTheme();
  const cat = useCategorical();
  const inv = dash.investments;
  const h = inv.holdings;
  const accountName = (id: string) => hub.latest.accounts.find((a) => a.id === id)?.name ?? ACCOUNT_NAMES[id] ?? id;

  const look = useMemo(() => {
    if (!hub.data.holdings?.length) return null;
    try {
      return xray(
        hub.data.holdings.map((x) => ({ ticker: x.ticker ?? 'CASH', name: x.name, market_value: x.shares * x.price })),
        getFunds(),
        getCompanies(),
      );
    } catch {
      return null;
    }
  }, [hub.data.holdings]);

  if (!h) {
    return (
      <Panel title="No holdings yet">
        <Text style={{ color: t.c.inkSoft }}>Link a brokerage (or add positions by hand) to see holdings here.</Text>
      </Panel>
    );
  }

  const slices = inv.allocation.map((s, i) => ({ key: s.key, label: s.key, value: s.value, color: cat[i] ?? t.c.inkSoft }));
  const bm = inv.benchmark;
  const div = inv.dividends;
  const roth = inv.roth;

  return (
    <View style={{ gap: 14 }}>
      <Panel eyebrow={`${h.rows.length} positions · ${formatUSD(h.total)}`} title="Holdings" right={<LabelChip label={h.label} small />}>
        <View style={{ flexDirection: 'row', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: t.c.line }}>
          <Text style={[th(t), { flex: 1 }]}>Position</Text>
          <Text style={[th(t), { width: 74, textAlign: 'right' }]}>Value</Text>
          <Text style={[th(t), { width: 48, textAlign: 'right' }]}>Weight</Text>
          <Text style={[th(t), { width: 74, textAlign: 'right' }]}>Gain</Text>
        </View>
        {h.rows.map((r, i) => {
          const linked = !!r.ticker && !!getCompany(r.ticker);
          return (
            <Pressable
              key={`${r.accountId}-${r.ticker ?? 'cash'}-${i}`}
              accessibilityRole={linked ? 'link' : 'text'}
              accessibilityLabel={`${r.ticker ?? r.name} in ${accountName(r.accountId)}: ${formatUSD(r.value)}, ${pct(r.weight)} of investments${r.gain !== null ? `, gain ${formatUSD(r.gain, { signed: true })}` : ''}.${linked ? ' Opens the company page.' : ''}`}
              disabled={!linked}
              onPress={() => router.push(`/company/${r.ticker}`)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.c.line, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>
                  {r.ticker ?? 'Cash'}
                  {linked ? <Text style={{ color: t.c.primary }}> ›</Text> : null}
                </Text>
                <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 11 }}>
                  {accountName(r.accountId)}
                  {r.kind !== 'cash' ? ` · ${r.shares} sh` : ''}
                </Text>
              </View>
              <Text style={[td(t), { width: 74 }]}>{formatUSD(r.value)}</Text>
              <Text style={[td(t), { width: 48, color: t.c.inkSoft }]}>{pct(r.weight)}</Text>
              <Text style={[td(t), { width: 74, color: r.gain === null ? t.c.inkSoft : r.gain >= 0 ? t.c.primary : t.c.danger }]}>
                {r.gain === null ? '—' : formatUSD(r.gain, { signed: true })}
              </Text>
            </Pressable>
          );
        })}
        <KV label="Unrealized gain (where cost is known)" value={h.gain === null ? '—' : formatUSD(h.gain, { signed: true })} basis={h.label} strong />
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Tickers with › open their company page. Gains are paper gains: nothing is locked in until a position is closed.</Text>
      </Panel>

      <Grid wide={wide} min={320}>
        <Panel eyebrow="What the money is in" title="Allocation">
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Donut
              slices={slices}
              summary={`Allocation: ${inv.allocation.map((s) => `${s.key} ${pct(s.weight)}`).join(', ')}.`}
              center={
                <View style={{ alignItems: 'center' }}>
                  <Money value={h.total} size={16} />
                  <Text style={{ color: t.c.inkSoft, fontSize: 10 }}>invested</Text>
                </View>
              }
            />
            <View style={{ gap: 8, flex: 1, minWidth: 150 }}>
              {slices.map((s) => (
                <LegendItem key={s.key} color={s.color} text={s.label} value={pct(inv.allocation.find((a) => a.key === s.key)?.weight)} />
              ))}
            </View>
          </View>
          <Explainer title="Concentration">
            {`The three largest positions are ${pct(h.top3Weight)} of the invested money. ${h.largest ? `The largest, ${h.largest.ticker ?? h.largest.name}, is ${pct(h.largest.weight)}.` : ''} Single stocks make up ${pct(inv.allocation.find((a) => a.key === 'Single stock')?.weight ?? 0)}.`}
          </Explainer>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <LinkPill label="Learn: diversification" href="/money/learn/diversification" />
          </View>
        </Panel>

        <Panel eyebrow="Look through the funds" title="Portfolio X-ray">
          {look ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>What these holdings own once funds are opened up (top listed fund holdings only).</Text>
              {look.exposures.slice(0, 5).map((e) => (
                <KV key={e.key} label={`${e.ticker ?? e.name}${e.via.length ? ` (incl. ${e.via.map((v) => v.fund).join(', ')})` : ''}`} value={pct(e.total, 1)} />
              ))}
              {look.warnings.slice(0, 2).map((w, i) => (
                <Text key={i} style={{ color: t.c.accent, fontSize: 12, fontWeight: '700' }}>
                  {w.message}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>See what your funds own underneath.</Text>
          )}
          <LinkPill label="Open the full X-ray" href="/xray" icon="filter" />
        </Panel>
      </Grid>

      {bm ? (
        <Panel eyebrow={`Since ${shortDate(bm.series[0]!.date)}`} title={`Compared with ${bm.ticker}`} right={<LabelChip label={bm.label} small />}>
          <Measure>
            {(w) => (
              <LineChart
                width={w}
                labels={bm.series.map((p) => shortDate(p.date))}
                series={[
                  { key: 'actual', label: 'Your accounts', color: cat[0]!, values: bm.series.map((p) => p.actual) },
                  { key: 'bench', label: `Same deposits in ${bm.ticker}`, color: cat[1]!, values: bm.series.map((p) => p.benchmark), dashed: true },
                ]}
                format={(v) => formatUSD(v)}
                summary={bm.sentence}
              />
            )}
          </Measure>
          <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{bm.sentence}</Text>
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
            ESTIMATE: built from snapshot values, deposits and sample {bm.ticker} prices; it ignores dividends, fees and timing within a day.
          </Text>
        </Panel>
      ) : null}

      <Grid wide={wide} min={320}>
        {div ? (
          <Panel eyebrow="Cash paid out by holdings" title="Dividends" right={<LabelChip label={div.label} small />}>
            <KV label="Last 12 months" value={formatUSD(div.trailing12m, { cents: true })} strong />
            {div.yieldOnValue !== null ? <KV label="As a share of today's value" value={pct(div.yieldOnValue, 2)} basis="estimate" /> : null}
            {div.byTicker.map((d) => (
              <KV key={d.ticker} label={`${d.ticker} · ${d.count} payment${d.count === 1 ? '' : 's'}`} value={formatUSD(d.total, { cents: true })} />
            ))}
            <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Sample amounts. Companies decide dividends each quarter; they can change or stop.</Text>
            <LinkPill label="Lesson: FCF yield & dividend yield" href="/lesson/u7-l4" />
          </Panel>
        ) : null}
        {roth ? (
          <Panel eyebrow={`Tax year ${roth.year}`} title="Roth IRA contributions">
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Money value={roth.contributed} size={24} weight="900" />
              <Text style={{ color: t.c.inkSoft }}>of {roth.limit !== null ? formatUSD(roth.limit) : '—'} limit</Text>
            </View>
            <View style={{ height: 10, backgroundColor: t.c.surfaceAlt, borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(1, (roth.progress ?? 0) * 100)}%`, height: '100%', backgroundColor: cat[0], borderRadius: 5 }} />
            </View>
            <KV label="Room left this year" value={roth.remaining === null ? '—' : formatUSD(roth.remaining)} />
            {roth.notes.map((n) => (
              <Text key={n} style={{ color: t.c.inkSoft, fontSize: 12 }}>
                • {n}
              </Text>
            ))}
          </Panel>
        ) : null}
      </Grid>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="info" color={t.c.inkSoft} size={15} />
        <Text style={{ flex: 1, color: t.c.inkSoft, fontSize: 12 }}>Educational view of sample holdings. Nothing here is a suggestion to trade.</Text>
      </View>
    </View>
  );
}

const th = (t: ReturnType<typeof useTheme>) => ({ color: t.c.inkSoft, fontSize: 11, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8 });
const td = (t: ReturnType<typeof useTheme>) => ({ color: t.c.ink, fontSize: 13, fontWeight: '700' as const, textAlign: 'right' as const, fontVariant: ['tabular-nums' as const] });
