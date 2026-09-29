/** Goals: emergency fund (N weeks of spending), card payoff by a date, Roth target. Targets are editable and saved locally. */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { ProgressRing } from '../charts';
import { LabelChip } from '../components';
import { formatUSD, isISODate, shortDate } from '../engine';
import { useMoneyStore } from '../store';
import type { TabProps } from './types';
import { Explainer, LinkPill, Panel } from './ui';

export default function GoalsTab({ dash, wide }: TabProps) {
  const t = useTheme();
  const setGoals = useMoneyStore((s) => s.setGoals);
  const g = dash.goals.settings;
  const [date, setDate] = useState(g.cardPayoffBy);
  const [roth, setRoth] = useState(String(g.rothTarget));
  const colors = [t.c.primary, t.c.danger, t.c.accent];
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
        {dash.goals.items.map((it, i) => (
          <View key={it.id} style={{ flex: wide ? 1 : undefined, backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.line, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <ProgressRing progress={it.progress} color={colors[i]} label={it.title} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: t.c.ink, fontWeight: '900', fontSize: 16 }}>{it.title}</Text>
                <Text style={{ color: t.c.ink, fontSize: 14, fontVariant: ['tabular-nums'] }}>
                  {formatUSD(it.current)} <Text style={{ color: t.c.inkSoft }}>of {formatUSD(it.target)}</Text>
                </Text>
                <LabelChip label={it.label} small />
              </View>
            </View>
            <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>{it.detail}</Text>
            {it.remaining > 0 ? <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '700' }}>{formatUSD(it.remaining)} to go</Text> : <Text style={{ color: t.c.primary, fontWeight: '800' }}>Reached</Text>}
          </View>
        ))}
      </View>

      <Panel eyebrow="Saved on this device" title="Edit targets">
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800' }}>Emergency fund size</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Step label="Fewer weeks" text="−" onPress={() => setGoals({ emergencyFundWeeks: Math.max(1, g.emergencyFundWeeks - 1) })} />
            <Text style={{ color: t.c.ink, fontSize: 18, fontWeight: '900', minWidth: 90, textAlign: 'center' }}>{g.emergencyFundWeeks} weeks</Text>
            <Step label="More weeks" text="+" onPress={() => setGoals({ emergencyFundWeeks: Math.min(52, g.emergencyFundWeeks + 1) })} />
          </View>
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>At about {formatUSD(dash.dailySpend.value * 7)} of spending a week (last 30 days).</Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800' }}>Card paid off by (YYYY-MM-DD)</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            onEndEditing={() => isISODate(date) && date > dash.asOf && setGoals({ cardPayoffBy: date })}
            onBlur={() => isISODate(date) && date > dash.asOf && setGoals({ cardPayoffBy: date })}
            accessibilityLabel="Card payoff target date"
            style={input(t)}
          />
          {!isISODate(date) || date <= dash.asOf ? <Text style={{ color: t.c.danger, fontSize: 12 }}>Enter a future date like 2027-03-31.</Text> : null}
          {dash.goals.cardMonthly !== null ? (
            <Text style={{ color: t.c.ink, fontSize: 13 }}>
              About {formatUSD(dash.goals.cardMonthly, { cents: true })} a month reaches $0 by {shortDate(g.cardPayoffBy)} {g.cardPayoffBy.slice(0, 4)}, if no new charges are added (ESTIMATE at the card APR).
            </Text>
          ) : null}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800' }}>Roth IRA target ($)</Text>
          <TextInput
            value={roth}
            onChangeText={setRoth}
            keyboardType="number-pad"
            onEndEditing={() => Number(roth) > 0 && setGoals({ rothTarget: Math.round(Number(roth)) })}
            onBlur={() => Number(roth) > 0 && setGoals({ rothTarget: Math.round(Number(roth)) })}
            accessibilityLabel="Roth IRA target in dollars"
            style={input(t)}
          />
        </View>
      </Panel>

      <Explainer title="Why weeks of spending?">
        An emergency fund is sized by what it has to cover. The same idea shows up in companies as the current ratio: cash against the bills due soon.
      </Explainer>
      <LinkPill label="Learn: emergency fund" href="/money/learn/emergency-fund" />
    </View>
  );
}

function Step({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: t.c.line, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.c.ink, fontSize: 20, fontWeight: '900' }}>{text}</Text>
    </Pressable>
  );
}

const input = (t: ReturnType<typeof useTheme>) => ({
  borderWidth: 1.5,
  borderColor: t.c.line,
  borderRadius: t.radius.md,
  paddingHorizontal: 12,
  paddingVertical: 9,
  fontSize: 16,
  fontWeight: '700' as const,
  color: t.c.ink,
  backgroundColor: t.c.bg,
  maxWidth: 260,
});
