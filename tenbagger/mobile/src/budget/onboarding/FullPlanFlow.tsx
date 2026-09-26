/**
 * "Build my full plan" (optional): goals → income → bills → spending → balances → comfort → style.
 * Every step is skippable and editable later (/onboarding/plan from Settings or the Budget screen).
 * The progress bar starts where quick setup left it (endowed progress, with the reason shown).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip } from '../../components/ui';
import { today } from '../../state/store';
import { useTheme } from '../../theme';
import {
  addDays,
  bufferFor,
  DEFAULT_BUFFER,
  emptyProfile,
  FULL_PLAN_STEPS,
  recommendStyle,
  setupProgress,
  STYLES,
  type Bill,
  type BudgetGoal,
  type BudgetProfile,
  type BudgetStyle,
  type GoalKind,
  type IncomeSource,
  type SetupStep,
  type Tightness,
} from '../engine';
import { dayChips, moneyText, parseMoney } from '../model';
import { useBudgetStore } from '../store';
import { ChipRow, MoneyField, OptionCard, TextField } from '../ui';
import { BillEditor, CategoryEditor, Row, SourceEditor } from './editors';
import { StepShell } from './StepShell';

const GOALS: { kind: GoalKind; title: string; body: string }[] = [
  { kind: 'cover_card', title: 'Cover my card every month', body: 'Pay the full statement by the due date, so interest stays at $0.' },
  { kind: 'emergency_fund', title: 'Build an emergency fund', body: 'A buffer month in savings, so a slow month never lands on the card.' },
  { kind: 'roth', title: 'Invest in a Roth IRA', body: 'Set aside money for this year’s contribution. Where and what you invest in is your call.' },
  { kind: 'pay_off_card', title: 'Pay off my card', body: 'Pick a date; we work out the monthly amount and the interest.' },
  { kind: 'save_for', title: 'Save for something', body: 'A trip, a laptop, next semester’s books: an amount and a date.' },
];

const STEP_TITLES: Record<SetupStep, string> = {
  quick: 'Quick setup',
  goals: 'What do you want your money to do?',
  income: 'Where does your money come from?',
  bills: 'Fixed bills',
  spending: 'Everyday spending',
  balances: 'What you have and owe',
  comfort: 'How tight do you want it?',
  style: 'Pick a budgeting style',
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

function monthEnds(asOf: string, n: number): { value: string; label: string }[] {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const out: { value: string; label: string }[] = [];
  let y = Number(asOf.slice(0, 4));
  let m = Number(asOf.slice(5, 7));
  for (let i = 0; i < n; i++) {
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    out.push({ value: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`, label: `${names[m - 1]} ${String(y).slice(2)}` });
  }
  return out;
}

export default function FullPlanFlow({ initialStep }: { initialStep?: SetupStep }) {
  const t = useTheme();
  const asOf = today();
  const stored = useBudgetStore((s) => s.profile);
  const saveStep = useBudgetStore((s) => s.saveStep);
  const [draft, setDraft] = useState<BudgetProfile>(() => stored ?? emptyProfile(asOf));
  const startIdx = Math.max(0, initialStep ? FULL_PLAN_STEPS.indexOf(initialStep) : 0);
  const [idx, setIdx] = useState(startIdx);
  const step = FULL_PLAN_STEPS[idx]!;
  const progress = setupProgress(draft);
  const rec = recommendStyle(draft);

  const patch = (p: Partial<BudgetProfile>) => setDraft((d) => ({ ...d, ...p }));
  const finish = () => router.replace('/budget');
  const next = (save: boolean) => {
    if (save) {
      const fields: Record<SetupStep, (keyof BudgetProfile)[]> = {
        quick: [],
        goals: ['goals'],
        income: ['income'],
        bills: ['bills'],
        spending: ['categories'],
        balances: ['balances'],
        comfort: ['comfort'],
        style: ['style'],
      };
      const p: Partial<BudgetProfile> = {};
      for (const k of fields[step]) (p as Record<string, unknown>)[k] = draft[k];
      saveStep(step, p, asOf);
      setDraft((d) => ({ ...d, answered: d.answered.includes(step) ? d.answered : [...d.answered, step] }));
    }
    if (idx + 1 < FULL_PLAN_STEPS.length) setIdx(idx + 1);
    else finish();
  };
  const common = {
    progress: progress.pct / 100,
    progressLabel: `Plan ${progress.pct}% built · step ${idx + 1} of ${FULL_PLAN_STEPS.length}`,
    title: STEP_TITLES[step],
    onNext: () => next(true),
    onSkip: () => next(false),
    onBack: idx > 0 ? () => setIdx(idx - 1) : () => (router.canGoBack() ? router.back() : router.replace('/budget')),
    nextLabel: idx + 1 === FULL_PLAN_STEPS.length ? 'Finish my plan' : 'Next',
  };

  if (step === 'goals') {
    const has = (k: GoalKind) => draft.goals.find((g) => g.kind === k);
    const toggle = (k: GoalKind, title: string) =>
      patch({ goals: has(k) ? draft.goals.filter((g) => g.kind !== k) : [...draft.goals, { id: uid(k), kind: k, title, ...(k === 'roth' ? { target: 1000 } : {}) }] });
    const edit = (k: GoalKind, p: Partial<BudgetGoal>) => patch({ goals: draft.goals.map((g) => (g.kind === k ? { ...g, ...p } : g)) });
    const months = monthEnds(asOf, 12);
    return (
      <StepShell {...common} eyebrow="New ledger, your rules" subtitle="Pick any. The order you pick them is the order they get paid." why="Goals decide where each paycheck goes after the bills. Nothing here moves money; it only plans it.">
        {progress.pct > 0 ? (
          <Card style={{ backgroundColor: t.c.primarySoft, borderColor: t.c.primarySoft }}>
            <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{progress.reason}</Text>
          </Card>
        ) : null}
        {GOALS.map((g) => {
          const cur = has(g.kind);
          return (
            <OptionCard key={g.kind} title={g.title} body={g.body} selected={!!cur} onPress={() => toggle(g.kind, g.title)}>
              {g.kind === 'emergency_fund' && cur ? (
                <TextField label="Target (blank = one month of your spending)" numeric value={moneyText(cur.target)} onChange={(v) => { const n = parseMoney(v); const { target: _t, ...rest } = cur; patch({ goals: draft.goals.map((x) => (x.kind === 'emergency_fund' ? (n ? { ...rest, target: n } : rest) : x)) }); }} />
              ) : null}
              {g.kind === 'roth' && cur ? (
                <Row>
                  <TextField style={{ flex: 1, minWidth: 120 }} label="Amount this year" numeric value={moneyText(cur.target)} onChange={(v) => edit('roth', { target: parseMoney(v) ?? 0 })} />
                  <TextField style={{ flex: 1, minWidth: 120 }} label="Already put in" numeric value={moneyText(cur.current ?? 0)} onChange={(v) => edit('roth', { current: parseMoney(v) ?? 0 })} />
                </Row>
              ) : null}
              {g.kind === 'pay_off_card' && cur ? <ChipRow label="Paid off by" options={months} value={cur.byDate ?? null} onChange={(byDate) => edit('pay_off_card', { byDate })} /> : null}
              {g.kind === 'save_for' && cur ? (
                <>
                  <TextField label="What for" value={cur.title === g.title ? '' : cur.title} placeholder="Spring break" onChange={(v) => edit('save_for', { title: v || g.title })} />
                  <TextField label="Amount" numeric value={moneyText(cur.target)} onChange={(v) => edit('save_for', { target: parseMoney(v) ?? 0 })} />
                  <ChipRow label="By" options={months} value={cur.byDate ?? null} onChange={(byDate) => edit('save_for', { byDate })} />
                </>
              ) : null}
            </OptionCard>
          );
        })}
      </StepShell>
    );
  }

  if (step === 'income') {
    const add = (s: IncomeSource) => patch({ income: [...draft.income, s] });
    const nextPay = addDays(asOf, 7);
    return (
      <StepShell {...common} subtitle="Add each one. Irregular is normal: we plan on a low-but-normal month." why="Your plan counts the lower of your usual schedule and a slow recent month, and never counts pay that depends on submitting hours until it's confirmed.">
        {draft.income.map((s) => (
          <SourceEditor key={s.id} s={s} asOf={asOf} onChange={(n) => patch({ income: draft.income.map((x) => (x.id === s.id ? n : x)) })} onRemove={() => patch({ income: draft.income.filter((x) => x.id !== s.id) })} />
        ))}
        <Text style={{ color: t.c.inkSoft, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>ADD INCOME</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="+ Hourly job" onPress={() => add({ id: uid('hourly'), name: 'Campus job', kind: 'hourly', rate: 15, unitsPerWeek: 10, frequency: 'biweekly', nextPayDate: nextPay, paidOnlyIfSubmitted: true })} />
          <Chip label="+ Per-session gig" onPress={() => add({ id: uid('gig'), name: 'Tutoring', kind: 'per_session', rate: 30, unitsPerWeek: 2, frequency: 'biweekly', nextPayDate: nextPay })} />
          <Chip label="+ Family support" onPress={() => add({ id: uid('fam'), name: 'Family help', kind: 'allowance', rate: 100, frequency: 'monthly', nextPayDate: nextPay })} />
          <Chip label="+ Stipend / aid refund" onPress={() => add({ id: uid('aid'), name: 'Aid refund', kind: 'stipend', rate: 0, frequency: 'monthly', disbursements: [{ date: nextPay, amount: 0 }] })} />
          <Chip label="+ Salary" onPress={() => add({ id: uid('sal'), name: 'Salary', kind: 'salary', rate: 30000, frequency: 'biweekly', nextPayDate: nextPay, withholdingRate: 0.15 })} />
        </View>
      </StepShell>
    );
  }

  if (step === 'bills') {
    const add = (name: string, kind: Bill['kind'], amount: number, dueDay: number) => patch({ bills: [...draft.bills, { id: uid('bill'), name, kind, amount, dueDay }] });
    return (
      <StepShell {...common} subtitle="Rent, phone, subscriptions: anything with a due day." why="Bills due before your next paycheck come out of safe-to-spend first, so the number never double-counts money that's spoken for.">
        {draft.bills.map((b) => (
          <BillEditor key={b.id} b={b} onChange={(n) => patch({ bills: draft.bills.map((x) => (x.id === b.id ? n : x)) })} onRemove={() => patch({ bills: draft.bills.filter((x) => x.id !== b.id) })} />
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="+ Rent" onPress={() => add('Rent', 'rent', 600, 1)} />
          <Chip label="+ Phone" onPress={() => add('Phone', 'phone', 30, 8)} />
          <Chip label="+ Streaming" onPress={() => add('Streaming', 'subscription', 15.49, 21)} />
          <Chip label="+ Music" onPress={() => add('Music', 'subscription', 10.99, 12)} />
          <Chip label="+ Transit pass" onPress={() => add('Transit pass', 'transport', 45, 25)} />
          <Chip label="+ Other" onPress={() => add('Bill', 'other', 0, 1)} />
        </View>
      </StepShell>
    );
  }

  if (step === 'spending') {
    return (
      <StepShell {...common} subtitle="Rough monthly amounts are perfect. These become envelopes." why="Envelopes show how much is left in each category. Leftovers can roll into next month; going over just comes out of next month, no drama.">
        <Card style={{ paddingVertical: 4 }}>
          {draft.categories.map((c) => (
            <CategoryEditor key={c.id} c={c} onChange={(n) => patch({ categories: draft.categories.map((x) => (x.id === c.id ? n : x)) })} onRemove={() => patch({ categories: draft.categories.filter((x) => x.id !== c.id) })} />
          ))}
        </Card>
        <Chip label="+ Add an envelope" onPress={() => patch({ categories: [...draft.categories, { id: uid('env'), title: 'New envelope', monthly: 20, kind: 'want', rollover: true }] })} />
        <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>Total: ${draft.categories.reduce((s, c) => s + c.monthly, 0).toFixed(0)} a month</Text>
      </StepShell>
    );
  }

  if (step === 'balances') {
    const b = draft.balances;
    const card = b.card;
    const setCard = (p: Partial<NonNullable<typeof card>>) => patch({ balances: { ...b, card: { balance: 0, ...card, ...p } } });
    return (
      <StepShell {...common} subtitle="All optional. Linking an account later fills these in for you." why="Cash is the starting point for safe-to-spend. The card's APR lets us show payoff dates and interest; savings sizes your buffer month.">
        <Row>
          <View style={{ flex: 1, minWidth: 150 }}><MoneyField label="Checking" value={moneyText(b.cash)} onChange={(v) => patch({ balances: { ...b, cash: parseMoney(v) ?? 0 } })} /></View>
          <View style={{ flex: 1, minWidth: 150 }}><MoneyField label="Savings" value={moneyText(b.savings)} onChange={(v) => patch({ balances: { ...b, savings: parseMoney(v) ?? 0 } })} /></View>
        </Row>
        <MoneyField label="Investments (optional)" value={moneyText(b.investments)} onChange={(v) => patch({ balances: { ...b, investments: parseMoney(v) ?? 0 } })} hint="Never counted as spendable." />
        <Card style={{ gap: 10 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800' }}>Credit card</Text>
          <Row>
            <TextField style={{ flex: 1, minWidth: 110 }} label="Balance" numeric value={moneyText(card?.balance)} onChange={(v) => setCard({ balance: parseMoney(v) ?? 0, statementBalance: parseMoney(v) ?? 0 })} />
            <TextField style={{ flex: 1, minWidth: 90 }} label="APR %" numeric value={card?.apr ? String(Math.round(card.apr * 10000) / 100) : ''} placeholder="24.99" onChange={(v) => setCard({ apr: (parseMoney(v) ?? 0) / 100 })} />
            <TextField style={{ flex: 1, minWidth: 90 }} label="Minimum" numeric value={moneyText(card?.minimumDue)} placeholder="25" onChange={(v) => setCard({ minimumDue: parseMoney(v) ?? 0 })} />
          </Row>
          <ChipRow label="Due" options={dayChips(asOf, 35, 0).map((c) => ({ value: c.date, label: c.label }))} value={card?.dueDate ?? null} onChange={(dueDate) => setCard({ dueDate })} />
        </Card>
      </StepShell>
    );
  }

  if (step === 'comfort') {
    const c = draft.comfort;
    const opts: { id: Tightness; title: string; body: string }[] = [
      { id: 'tight', title: 'Keep it tight', body: `Bigger cushion ($${DEFAULT_BUFFER.tight}), more to goals. Good when money feels unpredictable.` },
      { id: 'balanced', title: 'Balanced', body: `A $${DEFAULT_BUFFER.balanced} cushion and room for fun.` },
      { id: 'flexible', title: 'Flexible', body: `A small $${DEFAULT_BUFFER.flexible} cushion. You like breathing room day to day.` },
    ];
    return (
      <StepShell {...common} subtitle="There's no wrong answer, and you can change it anytime." why="Your comfort level sets the cushion we keep out of safe-to-spend, and how often we check in.">
        {opts.map((o) => (
          <OptionCard key={o.id} title={o.title} body={o.body} selected={c.tightness === o.id} onPress={() => { const { buffer: _b, ...rest } = c; patch({ comfort: { ...rest, tightness: o.id } }); }} />
        ))}
        <MoneyField label="Cushion kept out of safe-to-spend" value={moneyText(bufferFor(draft))} onChange={(v) => patch({ comfort: { ...c, buffer: parseMoney(v) ?? 0 } })} />
        <ChipRow
          label="Check in with me"
          options={[{ value: 'paycheck', label: 'When pay lands' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'off', label: 'Never' }]}
          value={c.notify}
          onChange={(notify) => patch({ comfort: { ...c, notify } })}
        />
      </StepShell>
    );
  }

  // style
  const order: BudgetStyle[] = [rec.style, ...(['paycheck', 'fifty_thirty_twenty', 'zero_based', 'pay_yourself_first'] as BudgetStyle[]).filter((s) => s !== rec.style)];
  return (
    <StepShell {...common} subtitle="Four common ways to run a budget, in plain words. Switch anytime; your numbers stay." why="The style decides how each paycheck is split. The safe-to-spend number works the same way in all of them.">
      <Card style={{ backgroundColor: t.c.accentSoft, borderColor: t.c.accentSoft, gap: 4 }}>
        <Text style={{ color: t.c.ink, fontWeight: '900', fontSize: 13, letterSpacing: 0.6 }}>WHY WE RECOMMEND {STYLES[rec.style].title.toUpperCase()}</Text>
        <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{rec.reason}</Text>
      </Card>
      {order.map((id) => {
        const s = STYLES[id];
        return (
          <OptionCard key={id} title={s.title} body={s.short} selected={draft.style === id} onPress={() => patch({ style: id })} {...(id === rec.style ? { badge: 'RECOMMENDED' } : {})}>
            <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{s.how}</Text>
            <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Best for: {s.bestFor}</Text>
          </OptionCard>
        );
      })}
    </StepShell>
  );
}
