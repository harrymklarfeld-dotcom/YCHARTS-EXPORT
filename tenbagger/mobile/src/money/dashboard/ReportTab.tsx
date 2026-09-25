/**
 * Report ("Personal 10-K"): a monthly statement written like a company's annual report —
 * income statement, balance sheet, cash-flow summary, the scorecard with reasons, company
 * analogs linking lessons, and a shareable summary with no account names or numbers.
 */
import { useMemo, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { getLesson } from '../../data';
import { useTheme } from '../../theme';
import { LabelChip } from '../components';
import { reportFor } from '../dashboard';
import { formatUSD, shortDate } from '../engine';
import { ScorecardGrid } from '../sections';
import type { TabProps } from './types';
import { Divider, Explainer, Grid, KV, LinkPill, Panel, pct, Segmented } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export default function ReportTab({ dash, hub, local, wide }: TabProps) {
  const t = useTheme();
  const months = dash.reportMonths.slice(0, 3);
  const [month, setMonth] = useState(months[0] ?? dash.spendMonth);
  const [shared, setShared] = useState<string | null>(null);
  const r = useMemo(() => reportFor(hub.data, month, local), [hub.data, month, local]);
  const is = r.incomeStatement;
  const bs = r.balanceSheet;
  const cf = r.cashFlow;

  const share = async () => {
    try {
      await Share.share({ message: r.shareText, title: r.title });
      setShared('Shared.');
    } catch {
      setShared('Sharing is not available here: select the text above to copy it.');
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 26, fontWeight: '700', color: t.c.ink }}>
          {r.title}
        </Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>
          {hub.data.persona.name}'s month written up the way a public company reports its year. {hub.data.sample ? 'Sample data.' : ''}
        </Text>
        {months.length > 1 ? <Segmented label="Report month" value={month} onChange={setMonth} options={months.map((m) => ({ id: m, label: monthName(m) }))} /> : null}
      </View>

      <Grid wide={wide} min={320}>
        <Panel eyebrow="Part I" title="Income statement" right={<LabelChip label={is.label} small />}>
          {is.incomeByStream.map((s) => (
            <KV key={s.streamId} label={s.name} value={formatUSD(s.total)} />
          ))}
          <KV label="Total income" value={formatUSD(is.income)} strong />
          <Divider />
          {is.topCategories.map((c) => (
            <KV key={c.category} label={c.title} value={`−${formatUSD(c.total)}`} />
          ))}
          <KV label="Total spending" value={`−${formatUSD(is.spending)}`} strong />
          <Divider />
          <KV label="Personal free cash flow" value={formatUSD(is.freeCashFlow, { signed: true })} strong color={is.freeCashFlow >= 0 ? t.c.primary : t.c.danger} />
          {is.savingsRate !== null ? <KV label={is.freeCashFlow >= 0 ? 'Share of income kept' : 'Spending as a share of income'} value={is.freeCashFlow >= 0 ? pct(is.savingsRate) : pct(is.spending / Math.max(1, is.income))} /> : null}
          <KV label="Moved into investments (like capex)" value={formatUSD(is.moneyInvested)} />
        </Panel>

        <Panel eyebrow={bs ? `Part II · as of ${shortDate(bs.asOf)}` : 'Part II'} title="Balance sheet" right={bs ? <LabelChip label={bs.label} small /> : undefined}>
          {bs ? (
            <>
              <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ASSETS</Text>
              <KV label="Cash (checking + savings)" value={formatUSD(bs.cash)} />
              <KV label="Investments" value={formatUSD(bs.investments)} />
              <KV label="Total assets" value={formatUSD(bs.totalAssets)} strong />
              <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 6 }}>LIABILITIES</Text>
              <KV label="Credit card" value={formatUSD(bs.cardDebt)} />
              {bs.otherDebt ? <KV label="Loans" value={formatUSD(bs.otherDebt)} /> : null}
              <KV label="Total liabilities" value={formatUSD(bs.totalLiabilities)} strong />
              <Divider />
              <KV label="Net worth (your equity)" value={formatUSD(bs.netWorth)} strong color={t.c.primary} />
            </>
          ) : (
            <Text style={{ color: t.c.inkSoft }}>No snapshot on or before this month's end.</Text>
          )}
        </Panel>
      </Grid>

      <Panel eyebrow="Part III" title="Cash-flow summary" right={<LabelChip label={cf.label} small />}>
        <KV label="Cash at the start (last snapshot before the month)" value={cf.startCash === null ? '—' : formatUSD(cf.startCash)} />
        <KV label="Income deposits" value={formatUSD(cf.moneyIn, { signed: true })} />
        <KV label="Spending (card + debit)" value={formatUSD(-cf.moneyOut, { signed: true })} />
        <KV label="Card payments from checking" value={formatUSD(-cf.cardPayments, { signed: true })} />
        <KV label="Cash at the end" value={cf.endCash === null ? '—' : formatUSD(cf.endCash)} strong />
        <KV label="Change in debt" value={cf.debtChange === null ? '—' : formatUSD(cf.debtChange, { signed: true })} color={cf.debtChange !== null && cf.debtChange > 0 ? t.c.danger : undefined} />
        <KV label="Change in net worth" value={cf.netWorthChange === null ? '—' : formatUSD(cf.netWorthChange, { signed: true })} strong />
        {is.freeCashFlow < 0 && cf.debtChange !== null && cf.debtChange > 0 ? (
          <Explainer title="Where the gap came from" tone="warn">
            {`Spending was ${formatUSD(-is.freeCashFlow)} more than income, and the card balance grew by ${formatUSD(cf.debtChange)} across the period: borrowing covered part of the month, the way a company can fund a cash shortfall with debt.`}
          </Explainer>
        ) : null}
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Sample data: balances come from snapshots and flows from transactions, so the two may not tie out to the dollar.</Text>
      </Panel>

      {r.scorecard ? <ScorecardGrid scorecard={r.scorecard} wide={wide} title={`Scorecard through ${monthName(month)}`} /> : null}

      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 21, fontWeight: '700', color: t.c.ink }}>
          Company analogs
        </Text>
        <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
          {r.analogs.map((a) => {
            const lesson = getLesson(a.lessonId);
            return (
              <View key={a.id} style={{ flexGrow: 1, flexBasis: wide ? 280 : undefined, backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.line, borderLeftWidth: 4, borderLeftColor: t.c.accent, padding: 14, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ color: t.c.accent, fontWeight: '900', fontSize: 14 }}>{a.title}</Text>
                  <LabelChip label={a.label} small />
                </View>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{a.personal}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Company version: {a.company}</Text>
                <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{a.text}</Text>
                {lesson ? <LinkPill label={`Lesson: ${lesson.lesson.title}`} href={`/lesson/${a.lessonId}`} /> : null}
              </View>
            );
          })}
        </View>
      </View>

      <Panel eyebrow="No account names or numbers" title="Share a summary">
        <View style={{ backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12 }}>
          <Text selectable style={{ color: t.c.ink, fontFamily: t.fonts.mono, fontSize: 12, lineHeight: 18 }}>
            {r.shareText}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <LinkPill label="Share" icon="link" onPress={share} />
          <LinkPill label="Learn: the Personal 10-K" href="/money/learn/personal-10k" />
        </View>
        {shared ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{shared}</Text> : null}
      </Panel>
    </View>
  );
}
