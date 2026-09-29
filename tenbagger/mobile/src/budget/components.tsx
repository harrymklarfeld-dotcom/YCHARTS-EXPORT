/**
 * Mountable budget components. Connected ones read the budget store themselves, so the lead can
 * drop them anywhere: <SafeToSpendCard />, <BudgetSummaryCard />, <InsightList />.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Button, Card } from '../components/ui';
import { useFeature } from '../monetization';
import { useTheme } from '../theme';
import { formatUSD, shortDate, type Budget, type Envelope, type GoalTimeline, type Insight, type PaycheckPlan, type SafeToSpend } from './engine';
import { BUDGET_PRO_FEATURE } from './gating';
import { useBudgetView } from './hooks';
import { useBudgetStore } from './store';
import { KV, LabelChip, LinkText, MathList, Meter, SectionHead, toneColor } from './ui';

// ------------------------------------------------------------------ safe to spend

/** Presentational hero: answer first, then the math on tap. */
export function SafeToSpendHero({ safe, compact }: { safe: SafeToSpend; compact?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const short = safe.status === 'short';
  const tone = short ? toneColor(t, 'amber') : safe.status === 'tight' ? toneColor(t, 'amber') : toneColor(t, 'good');
  const payday = safe.nextPaycheck ? `until payday · ${shortDate(safe.until)}` : `next ${safe.days} days`;
  return (
    <Card style={{ gap: 12, borderColor: short ? t.c.accent : t.c.line, borderWidth: short ? 2 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', flex: 1 }}>
          {short ? `Before payday · ${shortDate(safe.until)}` : `Safe to spend ${payday}`}
        </Text>
        <LabelChip label={safe.label} />
      </View>
      {short ? (
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ color: t.c.accent, fontSize: compact ? 34 : 46, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
            {formatUSD(-safe.amount)} to find
          </Text>
          <Text style={{ color: t.c.ink, fontSize: 15, lineHeight: 21 }}>{safe.sentence}</Text>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ color: t.c.ink, fontSize: compact ? 38 : 54, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1.5 }}>
            {formatUSD(safe.amount)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: tone.bg, borderRadius: t.radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: tone.fg, fontWeight: '800', fontSize: 13 }}>≈ {formatUSD(safe.perDay)}/day for {safe.days} day{safe.days === 1 ? '' : 's'}</Text>
            </View>
            {safe.excludedPending.length ? (
              <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>+{formatUSD(safe.excludedPending.reduce((s, d) => s + d.amount, 0))} pending not counted</Text>
            ) : null}
          </View>
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} hitSlop={6}>
        <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 14 }}>{open ? 'Hide the math ▴' : 'Show the math ▾'}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 8 }}>
          <MathList lines={safe.lines} />
          {safe.notes.map((n) => (
            <Text key={n} style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>· {n}</Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function SetupPromptCard() {
  const t = useTheme();
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>SAFE TO SPEND UNTIL PAYDAY</Text>
      <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 22, fontWeight: '700' }}>Know your number in 30 seconds</Text>
      <Text style={{ color: t.c.inkSoft, fontSize: 14, lineHeight: 20 }}>Four quick answers (cash, payday, card, one bill). No bank login needed.</Text>
      <Button label="Find my number" onPress={() => router.push('/onboarding')} />
      <LinkText label="See a sample plan (Alex, fictional)" onPress={() => { useBudgetStore.getState().setSampleMode(true); router.push('/budget'); }} />
    </Card>
  );
}

/** Connected hero for any screen. Shows the setup prompt when there is no plan yet. */
export function SafeToSpendCard({ compact }: { compact?: boolean }) {
  const view = useBudgetView();
  if (!view.budget) return <SetupPromptCard />;
  return <SafeToSpendHero safe={view.budget.safe} compact={compact} />;
}

// ------------------------------------------------------------------ plan progress (endowed)

export function BuildPlanCard({ budget }: { budget: Budget }) {
  const t = useTheme();
  const p = budget.progress;
  if (p.pct >= 100) return null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Meter value={p.pct / 100} height={12} />
        <Text style={{ color: t.c.ink, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{p.pct}%</Text>
      </View>
      <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{p.reason}</Text>
      <Button label="Build my full plan" variant="secondary" onPress={() => router.push('/onboarding/plan')} />
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Optional. Income sources, envelopes, goals and a budgeting style. About 3 minutes, and you can skip any step.</Text>
    </Card>
  );
}

// ------------------------------------------------------------------ paycheck plan

export function PaycheckPlanCard({ plans }: { plans: PaycheckPlan[] }) {
  const t = useTheme();
  if (!plans.length) {
    return (
      <Card>
        <Text style={{ color: t.c.inkSoft }}>No paycheck is expected in the next few weeks. The plan uses the cash you already have.</Text>
      </Card>
    );
  }
  const colors: Record<string, string> = { bill: t.c.inkSoft, card: t.c.ink, goal: t.c.primary, cushion: t.c.unitB, flexible: t.c.primarySoft };
  return (
    <View style={{ gap: 10 }}>
      {plans.map((pc, idx) => (
        <Card key={`${pc.deposit.date}-${pc.deposit.streamId}`} style={{ gap: 10, opacity: idx === 0 ? 1 : 0.95 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: t.c.ink, fontWeight: '800', fontSize: 15 }}>
              {formatUSD(pc.deposit.amount)} · {pc.deposit.streamName} · {shortDate(pc.deposit.date)}
            </Text>
            <LabelChip label={pc.deposit.basis} />
          </View>
          <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: t.c.surfaceAlt }}>
            {pc.lines.filter((l) => l.amount > 0).map((l) => (
              <View key={l.id} style={{ flex: l.amount, backgroundColor: colors[l.kind] }} />
            ))}
          </View>
          <View style={{ gap: 2 }}>
            {pc.lines.filter((l) => l.amount > 0 || l.kind === 'flexible').map((l) => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[l.kind] }} />
                <Text style={{ flex: 1, color: t.c.ink, fontSize: 13 }}>{l.kind === 'card' ? l.label.replace(/ payment/, '') : l.kind === 'flexible' ? 'Flexible (yours to spend)' : l.label.charAt(0).toUpperCase() + l.label.slice(1)}</Text>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatUSD(l.amount)}</Text>
              </View>
            ))}
          </View>
          {pc.deposit.basis === 'pending' ? <Text style={{ color: t.c.accent, fontSize: 12 }}>{pc.deposit.note}</Text> : null}
          {!pc.goalsFullyFunded ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Bills take most of this one; goals pick up again next paycheck.</Text> : null}
        </Card>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ envelopes

export function EnvelopeList({ envelopes }: { envelopes: Envelope[] }) {
  const t = useTheme();
  if (!envelopes.length) return null;
  return (
    <Card style={{ gap: 12 }}>
      {envelopes.map((e) => {
        const color = e.status === 'on_track' ? t.c.primary : t.c.accent;
        return (
          <View key={e.id} style={{ gap: 6 }} accessibilityLabel={e.sentence}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ flex: 1, color: t.c.ink, fontWeight: '700', fontSize: 14 }}>{e.title}</Text>
              <Text style={{ color: e.status === 'over' ? t.c.accent : t.c.inkSoft, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                {e.status === 'over' ? `${formatUSD(-e.remaining)} past` : `${formatUSD(e.remaining)} left`} · {formatUSD(e.available)}
              </Text>
            </View>
            <Meter value={e.progress} color={color} height={8} />
            {e.carried !== 0 ? <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>{formatUSD(e.carried, { signed: true })} rolled over from last month</Text> : null}
          </View>
        );
      })}
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{envelopes[0]!.label === 'verified' ? 'Spending from linked transactions.' : 'Link an account to fill these in automatically.'}</Text>
    </Card>
  );
}

// ------------------------------------------------------------------ goals

export function GoalList({ goals, bufferSentence }: { goals: GoalTimeline[]; bufferSentence?: string }) {
  const t = useTheme();
  if (!goals.length) return null;
  return (
    <Card style={{ gap: 14 }}>
      {goals.map((g) => (
        <View key={g.goalId} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{g.title}</Text>
            <LabelChip label={g.label} />
          </View>
          {g.kind !== 'cover_card' ? <Meter value={g.progress} color={t.c.primary} height={8} /> : null}
          <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 18 }}>{g.sentence}</Text>
        </View>
      ))}
      {bufferSentence ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Buffer month: {bufferSentence}</Text> : null}
    </Card>
  );
}

// ------------------------------------------------------------------ insights

export function InsightCard({ insight }: { insight: Insight }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const tone = toneColor(t, insight.tone);
  return (
    <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.line, borderLeftWidth: 5, borderLeftColor: tone.fg, padding: 14, gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LabelChip label={insight.label} />
          {insight.tier === 'pro' ? <Text style={{ color: t.c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>PRO</Text> : null}
        </View>
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15, lineHeight: 21 }}>{insight.title}</Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 19 }}>{insight.body}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 6 }}>
          {insight.math.length ? (
            <View style={{ backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.sm, padding: 10 }}>
              <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>THE MATH</Text>
              {insight.math.map((m) => <KV key={m.label} label={m.label} value={m.value} />)}
            </View>
          ) : null}
          {insight.options.length ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>YOUR OPTIONS · YOU DECIDE</Text>
              {insight.options.map((o) => (
                <Text key={o} style={{ color: t.c.ink, fontSize: 13 }}>○ {o}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <Pressable accessibilityRole="link" onPress={() => router.push(insight.link.route as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="book" size={14} color={t.c.primary} />
        <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>{insight.link.title}</Text>
      </Pressable>
    </View>
  );
}

/** Ranked insights. Free ones always show; Pro ones show as locked titles for free users. */
export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const t = useTheme();
  const gate = useFeature(BUDGET_PRO_FEATURE);
  const list = limit ? insights.slice(0, limit) : insights;
  if (!list.length) return <Text style={{ color: t.c.inkSoft }}>No insights right now. Everything looks on plan.</Text>;
  return (
    <View style={{ gap: 10 }}>
      {list.map((i) =>
        i.tier === 'pro' && !gate.allowed ? (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={`${i.title}. Pro insight. See Pro plans`}
            onPress={() => gate.openPaywall()}
            style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.accent, borderStyle: 'dashed', padding: 14, gap: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="lock" size={14} color={t.c.accent} />
              <Text style={{ color: t.c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>PRO INSIGHT</Text>
            </View>
            <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15, lineHeight: 21 }}>{i.title}</Text>
            <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>See the math with Pro ›</Text>
          </Pressable>
        ) : (
          <InsightCard key={i.id} insight={i} />
        ),
      )}
    </View>
  );
}

/** Connected insights (reads the store). Renders nothing until there is a plan. */
export function BudgetInsights({ limit }: { limit?: number }) {
  const view = useBudgetView();
  if (!view.budget) return null;
  return <InsightList insights={view.budget.insights} {...(limit ? { limit } : {})} />;
}

// ------------------------------------------------------------------ summary for the Money dashboard

/** Compact card for the Money dashboard: the hero number, this paycheck's plan, and a link in. */
export function BudgetSummaryCard() {
  const t = useTheme();
  const view = useBudgetView();
  if (!view.budget) return <SetupPromptCard />;
  const b = view.budget;
  const next = b.paychecks.find((p) => p.deposit.basis === 'projected') ?? b.paychecks[0];
  const top = b.insights.find((i) => i.tier === 'free');
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>YOUR BUDGET{view.source === 'sample' ? ' · SAMPLE' : ''}</Text>
        <LabelChip label={b.safe.label} />
      </View>
      <Text style={{ color: b.safe.status === 'short' ? t.c.accent : t.c.ink, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
        {b.safe.status === 'short' ? `${formatUSD(-b.safe.amount)} to find` : formatUSD(b.safe.amount)}
      </Text>
      <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>{b.safe.status === 'short' ? `before payday · ${shortDate(b.safe.until)}` : `safe to spend until ${shortDate(b.safe.until)}`}</Text>
      {next ? <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{next.sentence}</Text> : null}
      {top ? <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '700' }}>Next up: {top.title}</Text> : null}
      <LinkText label="Open my budget ›" onPress={() => router.push('/budget')} />
    </Card>
  );
}

export { SectionHead };
