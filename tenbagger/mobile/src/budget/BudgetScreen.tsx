/** /budget — answer first: safe to spend, then this paycheck's plan, envelopes, goals, insights. */
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Disclaimer } from '../components/ui';
import { useTheme } from '../theme';
import { BuildPlanCard, EnvelopeList, GoalList, InsightList, PaycheckPlanCard, SafeToSpendCard, SafeToSpendHero } from './components';
import { STYLES } from './engine';
import { useBudgetView } from './hooks';
import { useBudgetStore } from './store';
import { LinkText, PrivacyNote, SectionHead } from './ui';

export default function BudgetScreen({ embedded, section }: { embedded?: boolean; section?: 'insights' }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const view = useBudgetView();
  const b = view.budget;
  const setSample = useBudgetStore((s) => s.setSampleMode);
  const hasOwn = useBudgetStore((s) => !!s.profile);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: 16, paddingTop: embedded ? 16 : insets.top + 12, paddingBottom: 48, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }}>{view.source === 'sample' ? 'SAMPLE PLAN · ALEX IS FICTIONAL' : 'YOUR BUDGET'}</Text>
        <Text accessibilityRole="header" style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 30, fontWeight: '700' }}>
          {b ? (b.safe.status === 'short' ? 'A little short before payday' : 'You’re set until payday') : 'Your budget'}
        </Text>
        {view.sampleLabel ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{view.sampleLabel}</Text> : null}
      </View>

      {!b ? (
        <SafeToSpendCard />
      ) : (
        <>
          {section !== 'insights' ? <SafeToSpendHero safe={b.safe} /> : null}
          {view.source === 'mine' ? <BuildPlanCard budget={b} /> : null}

          {section === 'insights' ? null : (
            <>
              <SectionHead eyebrow={STYLES[b.profile.style].title} title="When your next paychecks land" />
              <PaycheckPlanCard plans={b.paychecks} />
            </>
          )}

          <SectionHead eyebrow="Ranked · the math is shown · you decide" title="Insights" />
          <InsightList insights={b.insights} />

          {section === 'insights' ? null : (
            <>
              {b.envelopes.length && b.profile.mode === 'full' ? (
                <>
                  <SectionHead eyebrow="Envelopes · leftovers roll over" title="This month" />
                  <EnvelopeList envelopes={b.envelopes} />
                </>
              ) : null}
              {b.goals.length ? (
                <>
                  <SectionHead eyebrow="Goals" title="Where you’re headed" />
                  <GoalList goals={b.goals} bufferSentence={b.buffer.sentence} />
                </>
              ) : null}
              <Card style={{ gap: 6 }}>
                <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>INCOME THE PLAN COUNTS</Text>
                <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{b.baseline.sentence}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 19 }}>{b.plan.sentence}</Text>
              </Card>
            </>
          )}

          <View style={{ gap: 10 }}>
            {view.source === 'sample' ? (
              <>
                <Button label={hasOwn ? 'Back to my plan' : 'Set up my own (30 seconds)'} onPress={() => { setSample(false); if (!hasOwn) router.push('/onboarding'); }} />
              </>
            ) : (
              <>
                <Button label="Edit my setup" variant="secondary" onPress={() => router.push('/onboarding/plan')} />
                <LinkText label="Redo quick setup" onPress={() => router.push('/onboarding')} />
              </>
            )}
          </View>
        </>
      )}
      <PrivacyNote />
      <Disclaimer compact />
    </ScrollView>
  );
}
