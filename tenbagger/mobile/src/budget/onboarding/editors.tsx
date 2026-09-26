/** Field groups for the full-plan steps. All controlled; they edit a draft profile. */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Chip } from '../../components/ui';
import { useTheme } from '../../theme';
import type { Bill, IncomeSource, SpendingCategory } from '../engine';
import { dayChips, moneyText, parseMoney } from '../model';
import { ChipRow, TextField, Toggle } from '../ui';

const FREQ = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{children}</View>;
}

export function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={onPress} hitSlop={8} style={{ padding: 4 }}>
      <Icon name="trash" size={18} color={t.c.inkSoft} />
    </Pressable>
  );
}

export function Box({ title, onRemove, children }: { title: string; onRemove?: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1.5, borderColor: t.c.line, borderRadius: t.radius.md, backgroundColor: t.c.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{title}</Text>
        {onRemove ? <RemoveButton onPress={onRemove} label={title} /> : null}
      </View>
      {children}
    </View>
  );
}

const num = (s: string) => parseMoney(s) ?? 0;

export function SourceEditor({ s, asOf, onChange, onRemove }: { s: IncomeSource; asOf: string; onChange: (s: IncomeSource) => void; onRemove: () => void }) {
  const t = useTheme();
  const set = (patch: Partial<IncomeSource>) => onChange({ ...s, ...patch } as IncomeSource);
  const chips = dayChips(asOf, 21).map((c) => ({ value: c.date, label: c.label }));
  const kindLabel: Record<IncomeSource['kind'], string> = {
    hourly: 'Hourly job',
    per_session: 'Per-session gig',
    salary: 'Salary',
    paycheck: 'Paycheck',
    allowance: 'Allowance / family support',
    stipend: 'Stipend / aid refund',
  };
  return (
    <Box title={`${kindLabel[s.kind]}${s.name && s.name !== kindLabel[s.kind] ? ` · ${s.name}` : ''}`} onRemove={onRemove}>
      <TextField label="Name" value={s.name} onChange={(name) => set({ name })} />
      {s.kind === 'stipend' ? (
        <>
          {(s.disbursements ?? []).map((d, i) => (
            <Row key={i}>
              <TextField style={{ flex: 1, minWidth: 110 }} label="Amount" numeric value={moneyText(d.amount)} onChange={(v) => set({ disbursements: (s.disbursements ?? []).map((x, j) => (j === i ? { ...x, amount: num(v) } : x)) })} />
              <TextField style={{ flex: 1, minWidth: 110 }} label="Arrives (YYYY-MM-DD)" value={d.date} onChange={(v) => set({ disbursements: (s.disbursements ?? []).map((x, j) => (j === i ? { ...x, date: v } : x)) })} />
              <TextField style={{ flex: 1, minWidth: 110 }} label="Lasts until" value={d.coversUntil ?? ''} placeholder="semester end" onChange={(v) => set({ disbursements: (s.disbursements ?? []).map((x, j) => (j === i ? { ...x, ...(v ? { coversUntil: v } : {}) } : x)) })} />
            </Row>
          ))}
          <Chip label="+ Add a semester date" onPress={() => set({ disbursements: [...(s.disbursements ?? []), { date: asOf, amount: 0 }] })} />
        </>
      ) : (
        <>
          <Row>
            <TextField
              style={{ flex: 1, minWidth: 120 }}
              label={s.kind === 'hourly' ? '$ per hour' : s.kind === 'per_session' ? '$ per session' : s.kind === 'salary' ? '$ per year' : '$ each time'}
              numeric
              value={moneyText(s.rate)}
              onChange={(v) => set({ rate: num(v) })}
            />
            {s.kind === 'hourly' || s.kind === 'per_session' ? (
              <TextField style={{ flex: 1, minWidth: 120 }} label={s.kind === 'hourly' ? 'Typical hours / week' : 'Sessions / week'} numeric value={moneyText(s.unitsPerWeek ?? 0)} onChange={(v) => set({ unitsPerWeek: num(v) })} />
            ) : null}
          </Row>
          <ChipRow
            label="Paid"
            options={s.kind === 'allowance' ? [...FREQ, { value: 'occasional', label: 'Now and then' }] : [...FREQ]}
            value={s.frequency}
            onChange={(frequency) => set({ frequency: frequency as IncomeSource['frequency'] })}
          />
          {s.frequency !== 'occasional' ? <ChipRow label="Next pay date" options={chips} value={s.nextPayDate ?? null} onChange={(nextPayDate) => set({ nextPayDate })} /> : null}
          {s.kind === 'hourly' || s.kind === 'per_session' || s.kind === 'salary' ? (
            <TextField label="Withheld for taxes (%)" numeric value={s.withholdingRate ? String(Math.round(s.withholdingRate * 100)) : ''} placeholder="0" onChange={(v) => set({ withholdingRate: Math.min(0.9, num(v) / 100) })} />
          ) : null}
          {s.kind === 'hourly' || s.kind === 'per_session' ? (
            <>
              <Toggle
                label={s.kind === 'hourly' ? 'Paid only if hours are submitted' : 'Paid only after session reports are filed'}
                detail="Unsubmitted work shows as PENDING and never counts as spendable until it's confirmed."
                value={!!s.paidOnlyIfSubmitted}
                onChange={(paidOnlyIfSubmitted) => set({ paidOnlyIfSubmitted })}
              />
              {s.paidOnlyIfSubmitted ? (
                <TextField
                  label={s.kind === 'hourly' ? 'Hours worked but not submitted yet' : 'Sessions not filed yet'}
                  numeric
                  value={moneyText(s.pendingUnsubmitted?.units ?? 0)}
                  onChange={(v) => {
                    const units = num(v);
                    const { pendingUnsubmitted: _drop, ...rest } = s;
                    onChange(units > 0 ? { ...rest, pendingUnsubmitted: { units, periodEnd: asOf } } : rest);
                  }}
                />
              ) : null}
            </>
          ) : null}
          {s.frequency === 'occasional' ? <Text style={{ fontSize: 12, color: t.c.inkSoft }}>Money that shows up now and then is never counted in the plan. When it lands, it's a bonus.</Text> : null}
        </>
      )}
    </Box>
  );
}

export function BillEditor({ b, onChange, onRemove }: { b: Bill; onChange: (b: Bill) => void; onRemove: () => void }) {
  return (
    <Box title={b.name || 'Bill'} onRemove={onRemove}>
      <Row>
        <TextField style={{ flex: 2, minWidth: 140 }} label="Name" value={b.name} onChange={(name) => onChange({ ...b, name })} />
        <TextField style={{ flex: 1, minWidth: 90 }} label="Amount" numeric value={moneyText(b.amount)} onChange={(v) => onChange({ ...b, amount: num(v) })} />
        <TextField style={{ flex: 1, minWidth: 80 }} label="Due day (1–31)" numeric value={String(b.dueDay)} onChange={(v) => onChange({ ...b, dueDay: Math.min(31, Math.max(1, Number(v.replace(/\D/g, '')) || 1)) })} />
      </Row>
    </Box>
  );
}

export function CategoryEditor({ c, onChange, onRemove }: { c: SpendingCategory; onChange: (c: SpendingCategory) => void; onRemove: () => void }) {
  const t = useTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: t.c.line, paddingVertical: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <TextField style={{ flex: 2 }} label="Envelope" value={c.title} onChange={(title) => onChange({ ...c, title })} />
        <TextField style={{ flex: 1 }} label="$ / month" numeric value={moneyText(c.monthly)} onChange={(v) => onChange({ ...c, monthly: num(v) })} />
        <RemoveButton onPress={onRemove} label={c.title} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <ChipRow options={[{ value: 'need', label: 'Need' }, { value: 'want', label: 'Want' }]} value={c.kind} onChange={(kind) => onChange({ ...c, kind })} />
        <Toggle label="Leftovers roll over" value={c.rollover} onChange={(rollover) => onChange({ ...c, rollover })} />
      </View>
    </View>
  );
}
