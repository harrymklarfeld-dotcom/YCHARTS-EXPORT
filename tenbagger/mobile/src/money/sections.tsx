/**
 * Money hub sections shared by the dashboard tabs (moved from the original single-page
 * MoneyScreen): buckets, "Can I cover the card?", upcoming pay vs dues, income streams,
 * scorecard and the 10-K analogies. Read-only and educational; nothing here awards XP.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Body, Card, Eyebrow } from '../components/ui';
import { getLesson } from '../data';
import { useTheme } from '../theme';
import { GradeBadge, LabelChip, Money, RunwayChart, SectionTitle, VerdictPill } from './components';
import { formatUSD, RUBRIC, shortDate, weekday, weekdayName, type Account, type CoverageReport, type Labeled, type NumberLabel, type Scorecard } from './engine';
import { describeStream, type MoneyHub } from './hub';

// ------------------------------------------------------------------ summary

export function accountsOf(hub: MoneyHub, kinds: Account['kind'][]): Account[] {
  return hub.latest.accounts.filter((a) => kinds.includes(a.kind));
}

export function BucketCard({ title, value, accounts, tone, note, style }: { title: string; value: Labeled; accounts: Account[]; tone: string; note?: string; style?: object }) {
  const t = useTheme();
  return (
    <Card style={[{ gap: 8, borderLeftWidth: 4, borderLeftColor: tone }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Eyebrow>{title}</Eyebrow>
        <LabelChip label={value.label} small />
      </View>
      <Money value={value.value} size={24} weight="900" />
      {accounts.map((a) => (
        <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 13, flex: 1 }}>{a.name}</Text>
          <LabelChip label={a.basis} small />
          <Money value={a.balance} size={13} weight="700" />
        </View>
      ))}
      {note ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{note}</Text> : null}
    </Card>
  );
}

export function Summary({ hub, wide }: { hub: MoneyHub; wide: boolean }) {
  const t = useTheme();
  const b = hub.breakdown;
  const net = (
    <Card style={{ gap: 6, backgroundColor: t.c.ink, borderColor: t.c.ink }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Eyebrow color={t.c.accent}>Net worth · {shortDate(b.asOf)}</Eyebrow>
        <LabelChip label={b.net.label} small />
      </View>
      <Money value={b.net.value} size={34} weight="900" color={t.c.bg} />
      <Text style={{ color: t.c.bg, opacity: 0.8, fontSize: 13 }}>
        {formatUSD(b.liquidity.value)} cash + {formatUSD(b.investments.value)} invested − {formatUSD(b.debt.value)} owed
      </Text>
    </Card>
  );
  const liquidity = (
    <BucketCard
      title="Liquidity"
      value={b.liquidity}
      accounts={accountsOf(hub, ['checking', 'savings'])}
      tone={t.c.primary}
      note={b.liquidityRatio.value === null ? undefined : `Covers short-term debt ${b.liquidityRatio.value.toFixed(2)}×`}
      style={wide ? { flex: 1 } : undefined}
    />
  );
  const debt = (
    <BucketCard title="Debt" value={b.debt} accounts={accountsOf(hub, ['credit_card', 'loan'])} tone={t.c.danger} style={wide ? { flex: 1 } : undefined} />
  );
  const investments = (
    <BucketCard
      title="Investments"
      value={b.investments}
      accounts={accountsOf(hub, ['brokerage', 'retirement', 'crypto'])}
      tone={t.c.accent}
      note="Not counted as spendable cash in the card check."
      style={wide ? { flex: 1 } : undefined}
    />
  );
  if (wide) {
    return (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 2, gap: 12 }}>
          {net}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {liquidity}
            {debt}
          </View>
        </View>
        <View style={{ flex: 1 }}>{investments}</View>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {net}
      {liquidity}
      {investments}
      {debt}
    </View>
  );
}

// ------------------------------------------------------------------ coverage

export function CoverCard({ coverage: cov, compact }: { coverage: CoverageReport; compact?: boolean }) {
  const t = useTheme();
  const [showAssumptions, setShowAssumptions] = useState(false);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <SectionTitle eyebrow={`Next ${cov.runway.length - 1} days`} title="Can I cover the card?" />
        <VerdictPill verdict={cov.verdict} />
      </View>
      {cov.dues.length === 0 ? <Body soft>{cov.headline}</Body> : null}
      {cov.dues.map((d) => (
        <View key={`${d.accountId}-${d.dueDate}`} style={{ gap: 10 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 13, fontWeight: '700' }}>
            {d.accountName} · due {shortDate(d.dueDate)} ({d.daysAway} days) · minimum {formatUSD(d.minimumDue)}
          </Text>
          {compact ? null : (
          <View style={{ borderRadius: t.radius.md, backgroundColor: t.c.surfaceAlt, padding: 12, gap: 8 }}>
            {d.steps.map((s, i) => {
              const isResult = s.op === '=';
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${s.op === '−' ? 'minus' : s.op === '=' ? 'equals' : 'plus'} ${s.label} ${formatUSD(Math.abs(s.amount))}, ${s.basis}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderTopWidth: isResult ? 1.5 : 0,
                    borderTopColor: t.c.ink,
                    paddingTop: isResult ? 8 : 0,
                  }}
                >
                  <Text style={{ width: 16, textAlign: 'center', color: t.c.inkSoft, fontWeight: '900', fontSize: 16 }}>{i === 0 ? ' ' : s.op}</Text>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: t.c.ink, fontSize: 14, fontWeight: isResult ? '900' : '600' }}>{s.label}</Text>
                    <LabelChip label={s.basis} small />
                  </View>
                  <Money value={isResult ? s.amount : Math.abs(s.amount)} size={isResult ? 20 : 15} weight={isResult ? '900' : '700'} color={isResult ? (s.amount >= 0 ? t.c.primary : t.c.danger) : undefined} />
                </View>
              );
            })}
          </View>
          )}
          <Body size={14}>{d.sentence}</Body>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <MiniStat label="If you pay in full" value={d.afterPayInFull} />
            <MiniStat label={`If you pay the ${formatUSD(d.minimumDue)} minimum`} value={d.afterMinimum} />
            {d.pendingIncomeBefore > 0 ? <MiniStat label="Without pending pay" value={d.afterPayInFull - d.pendingIncomeBefore} /> : null}
          </View>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => setShowAssumptions((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="info" color={t.c.inkSoft} size={16} />
        <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{showAssumptions ? 'Hide' : 'What this check includes'}</Text>
      </Pressable>
      {showAssumptions ? (
        <View style={{ gap: 4 }}>
          {cov.assumptions.map((a) => (
            <Text key={a} style={{ color: t.c.inkSoft, fontSize: 12 }}>
              • {a}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function MiniStat({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 140, borderWidth: 1, borderColor: t.c.line, borderRadius: t.radius.sm, padding: 10, gap: 2 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <Money value={value} size={16} color={value >= 0 ? t.c.ink : t.c.danger} />
      <Text style={{ color: t.c.inkSoft, fontSize: 10 }}>{value >= 0 ? 'left over' : 'short'}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ upcoming

export function Upcoming({ coverage }: { coverage: CoverageReport }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const events = coverage.runway.flatMap((p) => p.events.map((e) => ({ ...e, date: p.date, balance: p.payInFull })));
  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle eyebrow="Pay days vs due dates" title="What's coming">
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Projected cash each day, before everyday spending.</Text>
      </SectionTitle>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>{w > 0 ? <RunwayChart runway={coverage.runway} width={w} /> : <View style={{ height: 160 }} />}</View>
      <View style={{ gap: 0 }}>
        {events.map((e, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
            <View style={{ width: 46, alignItems: 'center' }}>
              <Text style={{ color: t.c.inkSoft, fontSize: 10, fontWeight: '800' }}>{weekdayName(weekday(e.date)).toUpperCase()}</Text>
              <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '800' }}>{shortDate(e.date)}</Text>
            </View>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: e.kind === 'due' ? t.c.danger : e.basis === 'pending' ? t.c.accent : t.c.primary }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: t.c.ink, fontSize: 14, fontWeight: '700' }}>{e.kind === 'due' ? e.label : `${e.label} pay`}</Text>
              <LabelChip label={e.basis} small />
            </View>
            <Money value={e.amount} size={15} signed color={e.amount < 0 ? t.c.danger : t.c.primary} />
          </View>
        ))}
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ streams

export function Streams({ hub }: { hub: MoneyHub }) {
  const t = useTheme();
  return (
    <Card style={{ gap: 4 }}>
      <SectionTitle eyebrow="When money actually lands" title="Income streams" />
      {hub.streams.map(({ stream: s, upcoming, lastPaid, chips }, i) => (
        <View key={s.id} style={{ gap: 6, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: t.c.ink, fontSize: 16, fontWeight: '800', flexShrink: 1 }}>{s.name}</Text>
            {chips.map((c) => (
              <LabelChip key={c} label={c} small />
            ))}
          </View>
          <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>
            {describeStream(s)}
            {s.schedule.weekdays.length ? ` · ${s.schedule.weekdays.map((d) => weekdayName(d)).join('/')}` : ''}
            {s.withholdingRate > 0 ? ` · ${Math.round(s.withholdingRate * 100)}% withheld` : ''}
          </Text>
          {s.condition ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Lands only when {s.condition}.</Text> : null}
          {lastPaid ? (
            <Row label={`Last paid ${shortDate(lastPaid.date)}`} amount={lastPaid.amount} basis={lastPaid.basis === 'manual' ? 'manual' : 'verified'} />
          ) : null}
          {upcoming.map((d) => (
            <View key={d.date} style={{ gap: 2 }}>
              <Row label={`${shortDate(d.date)}${d.units !== undefined ? ` · ${d.units} ${s.kind === 'per_session' ? 'sessions' : 'hrs'}` : ''}`} amount={d.amount} basis={d.basis} />
              {d.basis === 'pending' && d.note ? <Text style={{ color: t.c.accent, fontSize: 12, fontWeight: '700', marginLeft: 2 }}>{d.note}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}

export function Row({ label, amount, basis }: { label: string; amount: number; basis: NumberLabel }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ flex: 1, color: t.c.ink, fontSize: 13 }}>{label}</Text>
      <LabelChip label={basis} small />
      <Text style={{ width: 76, textAlign: 'right', color: t.c.ink, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatUSD(amount, { cents: true })}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ scorecard

export function ScorecardGrid({ scorecard: sc, wide, title = 'Scorecard' }: { scorecard: Scorecard; wide: boolean; title?: string }) {
  const t = useTheme();
  const [rubric, setRubric] = useState(false);
  const cols = wide ? 3 : 2;
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle eyebrow="Plain-English check-up" title={title} />
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <GradeBadge grade={sc.overall.grade} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>Overall</Text>
          <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 18 }}>{sc.overall.reason}</Text>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {sc.categories.map((c) => (
          <View
            key={c.id}
            accessible
            accessibilityLabel={`${c.title}: grade ${c.grade ?? 'not graded'}. ${c.reason}`}
            style={{
              width: `${100 / cols - 2.5}%` as `${number}%`,
              flexGrow: 1,
              backgroundColor: t.c.surface,
              borderRadius: t.radius.md,
              borderWidth: 1,
              borderColor: t.c.line,
              padding: 12,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GradeBadge grade={c.grade} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>{c.title}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{c.metric}</Text>
              </View>
            </View>
            <Text style={{ color: t.c.ink, fontSize: 12, lineHeight: 17 }}>{c.reason}</Text>
            <LabelChip label={c.label} small />
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setRubric((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="info" color={t.c.inkSoft} size={16} />
        <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{rubric ? 'Hide grading rules' : 'How grades work'}</Text>
      </Pressable>
      {rubric ? (
        <Card style={{ gap: 10 }}>
          {Object.values(RUBRIC).map((r) => (
            <View key={r.title} style={{ gap: 2 }}>
              <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{r.title}</Text>
              <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{r.measure}</Text>
              <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{r.bands.join(' · ')}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ 10-K

export function TenK({ hub, wide }: { hub: MoneyHub; wide: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle eyebrow="Same math, different scale" title="Your money, like a 10-K">
        <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>Each of your numbers has a twin on a company's balance sheet. Tap to learn the company version.</Text>
      </SectionTitle>
      <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
        {hub.analogies.map((a) => {
          const lesson = getLesson(a.lessonId);
          return (
            <Card key={a.id} style={[{ gap: 8 }, wide ? { width: '48.5%' } : null]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: t.c.ink, fontWeight: '900', fontSize: 15, flexShrink: 1 }}>{a.personal}</Text>
                <LabelChip label={a.label} small />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="building" color={t.c.accent} size={16} />
                <Text style={{ color: t.c.accent, fontWeight: '800', fontSize: 13 }}>
                  {a.company} <Text style={{ color: t.c.inkSoft, fontWeight: '600' }}>= {a.companyFormula}</Text>
                </Text>
              </View>
              <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{a.explanation}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={lesson ? `Open lesson: ${lesson.lesson.title}` : 'Lesson coming soon'}
                accessibilityState={{ disabled: !lesson }}
                disabled={!lesson}
                onPress={() => router.push(`/lesson/${a.lessonId}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'flex-start',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: t.radius.pill,
                  borderWidth: 1.5,
                  borderColor: lesson ? t.c.primary : t.c.line,
                  backgroundColor: pressed ? t.c.primarySoft : 'transparent',
                })}
              >
                <Icon name="book" color={lesson ? t.c.primary : t.c.inkSoft} size={16} />
                <Text style={{ color: lesson ? t.c.primary : t.c.inkSoft, fontWeight: '800', fontSize: 13 }}>
                  {lesson ? `Open lesson: ${lesson.lesson.title}` : 'Lesson coming soon'}
                </Text>
                {lesson ? <Icon name="chevron" color={t.c.primary} size={14} /> : null}
              </Pressable>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ history

export function History({ hub }: { hub: MoneyHub }) {
  const t = useTheme();
  const first = hub.log[0];
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Icon name="book" color={t.c.inkSoft} size={16} />
      <Text style={{ color: t.c.inkSoft, fontSize: 12, flex: 1 }}>
        {hub.log.length} snapshots since {first ? shortDate(first.takenAt.slice(0, 10)) : '—'}. Snapshots are only ever added, never edited, so trends come from real history.
      </Text>
    </View>
  );
}
