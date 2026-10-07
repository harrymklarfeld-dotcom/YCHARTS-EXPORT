/**
 * Quick setup: 4 inputs (cash now, next payday + amount, card balance + due date, one big bill)
 * → ONE hero number: "Safe to spend until payday", with the equation. Everything else is optional.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card } from '../../components/ui';
import { today } from '../../state/store';
import { useTheme } from '../../theme';
import { SafeToSpendHero } from '../components';
import { quickSetup, safeToSpend, setupProgress, type QuickSetupInput } from '../engine';
import { dayChips, moneyText, parseMoney } from '../model';
import { useBudgetStore } from '../store';
import { ChipRow, LinkText, Meter, MoneyField, PrivacyNote, TextField, Toggle } from '../ui';
import { StepShell } from './StepShell';

type PayFrequencyInput = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

const FREQS: { value: PayFrequencyInput; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
];

const BILL_NAMES = ['Rent', 'Phone', 'Car payment', 'Insurance', 'Tuition plan', 'Other'];

export default function QuickSetupScreen({ initialStep = 0 }: { initialStep?: number }) {
  const t = useTheme();
  const asOf = today();
  const existing = useBudgetStore((s) => s.profile);
  const saveQuick = useBudgetStore((s) => s.saveQuick);
  const skip = useBudgetStore((s) => s.skipOnboarding);
  const setSample = useBudgetStore((s) => s.setSampleMode);

  const main = existing?.income.find((s) => s.id === 'main-pay');
  const oldBill = existing?.bills.find((b) => b.id === 'big-bill');
  const oldCard = existing?.balances.card;
  const [step, setStep] = useState(Math.max(0, Math.min(4, initialStep)));
  const [cash, setCash] = useState(moneyText(existing?.balances.cash));
  const [payday, setPayday] = useState<string | null>(main?.nextPayDate && main.nextPayDate > asOf ? main.nextPayDate : null);
  const [payAmount, setPayAmount] = useState(moneyText(main?.rate));
  const [freq, setFreq] = useState<PayFrequencyInput>((main?.frequency as PayFrequencyInput) ?? 'biweekly');
  const [hasCard, setHasCard] = useState(true);
  const [cardBal, setCardBal] = useState(moneyText(oldCard?.balance));
  const [cardDue, setCardDue] = useState<string | null>(oldCard?.dueDate && oldCard.dueDate >= asOf ? oldCard.dueDate : null);
  const [hasBill, setHasBill] = useState(true);
  const [billName, setBillName] = useState(oldBill?.name ?? 'Rent');
  const [billAmount, setBillAmount] = useState(moneyText(oldBill?.amount));
  const [billDay, setBillDay] = useState<number | null>(oldBill?.dueDay ?? 1);

  const payChips = useMemo(() => dayChips(asOf, 21), [asOf]);
  const dueChips = useMemo(() => dayChips(asOf, 35, 0), [asOf]);

  const input: QuickSetupInput = {
    asOf,
    cash: parseMoney(cash) ?? 0,
    nextPayday: payday ?? payChips[13]!.date,
    nextPayAmount: parseMoney(payAmount) ?? 0,
    payFrequency: freq,
    card: hasCard && (parseMoney(cardBal) ?? 0) > 0 && cardDue ? { balance: parseMoney(cardBal)!, dueDate: cardDue } : null,
    bill: hasBill && (parseMoney(billAmount) ?? 0) > 0 && billDay ? { name: billName, amount: parseMoney(billAmount)!, dueDay: billDay } : null,
  };
  const preview = useMemo(() => {
    const p = quickSetup(input, existing ?? undefined);
    return { safe: safeToSpend(p, asOf), progress: setupProgress(p) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(input), existing]);

  const leave = () => {
    skip();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const back = step > 0 ? () => setStep(step - 1) : undefined;
  const label = step < 4 ? `Quick setup · ${step + 1} of 4` : 'Quick setup · done';

  if (step === 0) {
    return (
      <StepShell
        progress={0.25}
        progressLabel={label}
        eyebrow="Fresh start · new ledger"
        title="How much is in checking right now?"
        subtitle="A rough number is fine. You can fix it anytime."
        why="Safe-to-spend starts from the cash you actually have, not from what you expect. Savings stays out of it: that's your cushion."
        onNext={() => setStep(1)}
        nextDisabled={parseMoney(cash) === null}
        onSkip={leave}
        skipLabel="Not now"
        footer={
          <View style={{ gap: 12 }}>
            <PrivacyNote />
            <LinkText label="Just looking? See a sample plan (Alex, fictional)" onPress={() => { setSample(true); router.replace('/budget'); }} />
          </View>
        }
      >
        <MoneyField label="Cash in checking" value={cash} onChange={setCash} placeholder="640" autoFocus />
      </StepShell>
    );
  }

  if (step === 1) {
    return (
      <StepShell
        progress={0.5}
        progressLabel={label}
        title="When is your next payday?"
        subtitle="And about how much will land. Guess low if it changes."
        why="We plan until your next payday, so we only count money that is actually coming. If your hours change, a low guess keeps you safe."
        onNext={() => setStep(2)}
        nextDisabled={!payday || parseMoney(payAmount) === null}
        onBack={back}
      >
        <ChipRow label="Next payday" options={payChips.map((c) => ({ value: c.date, label: c.label }))} value={payday} onChange={setPayday} />
        <MoneyField label="About how much lands" value={payAmount} onChange={setPayAmount} placeholder="186" hint="After taxes, what hits your account." />
        <ChipRow label="How often" options={FREQS} value={freq} onChange={setFreq} />
      </StepShell>
    );
  }

  if (step === 2) {
    return (
      <StepShell
        progress={0.75}
        progressLabel={label}
        title="Any credit card balance?"
        subtitle="Balance and the due date. Skip if you don't have one."
        why="A card payment due before your paycheck is money that's already spoken for. We set it aside so the number you see is really yours to spend."
        onNext={() => setStep(3)}
        nextDisabled={hasCard && (parseMoney(cardBal) === null || !cardDue)}
        onBack={back}
      >
        <Toggle label="I have a card balance" value={hasCard} onChange={setHasCard} />
        {hasCard ? (
          <>
            <MoneyField label="Card balance" value={cardBal} onChange={setCardBal} placeholder="350" hint="The statement balance if you know it, otherwise the current balance." />
            <ChipRow label="Payment due" options={dueChips.map((c) => ({ value: c.date, label: c.label }))} value={cardDue} onChange={setCardDue} />
          </>
        ) : null}
      </StepShell>
    );
  }

  if (step === 3) {
    return (
      <StepShell
        progress={1}
        progressLabel={label}
        title="Your one biggest fixed bill"
        subtitle="Rent, phone, a car payment: whatever is largest. Add the rest later if you like."
        why="A big bill right after payday changes what's safe to spend today. One is enough to start."
        nextLabel="Show my number"
        onNext={() => {
          saveQuick(input);
          setStep(4);
        }}
        nextDisabled={hasBill && (parseMoney(billAmount) === null || !billDay)}
        onBack={back}
      >
        <Toggle label="I have a fixed bill" value={hasBill} onChange={setHasBill} />
        {hasBill ? (
          <>
            <ChipRow options={BILL_NAMES.map((n) => ({ value: n, label: n }))} value={BILL_NAMES.includes(billName) ? billName : 'Other'} onChange={(n) => setBillName(n === 'Other' ? '' : n)} />
            {!BILL_NAMES.slice(0, -1).includes(billName) ? <TextField label="Bill name" value={billName} onChange={setBillName} placeholder="e.g. Gym" /> : null}
            <MoneyField label="Amount" value={billAmount} onChange={setBillAmount} placeholder="450" />
            <ChipRow label="Due on the" options={[1, 5, 10, 15, 20, 25, 28].map((d) => ({ value: d, label: ordinal(d) }))} value={billDay} onChange={setBillDay} />
            <TextField label="Or type a day (1–31)" value={billDay ? String(billDay) : ''} onChange={(s) => setBillDay(Math.min(31, Math.max(1, Number(s.replace(/\D/g, '')) || 1)))} numeric />
          </>
        ) : null}
      </StepShell>
    );
  }

  // Result: ONE hero number with the equation.
  return (
    <StepShell
      progress={preview.progress.pct / 100}
      progressLabel={`Your plan is ${preview.progress.pct}% built`}
      eyebrow="Here's your number"
      title={preview.safe.status === 'short' ? 'A little short before payday' : 'Safe to spend until payday'}
      nextLabel="Go to my budget"
      onNext={() => router.replace('/budget')}
      onBack={() => setStep(3)}
    >
      <SafeToSpendHero safe={preview.safe} />
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Meter value={preview.progress.pct / 100} height={12} />
          <Text style={{ color: t.c.ink, fontWeight: '900' }}>{preview.progress.pct}%</Text>
        </View>
        <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{preview.progress.reason}</Text>
        <Button label="Build my full plan (optional)" variant="secondary" onPress={() => router.push('/onboarding/plan')} />
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Income sources, envelopes, goals and a budgeting style that fits irregular pay. Skip any step.</Text>
      </Card>
      <PrivacyNote />
    </StepShell>
  );
}

function ordinal(n: number): string {
  const s = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${s}`;
}
