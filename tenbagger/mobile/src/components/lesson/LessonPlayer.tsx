import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isCorrect, keypadToValue, lessonXp, msUntilNextHeart, practiceXp, type Submission, type UsdScale } from '../../game';
import { useApp } from '../../state/store';
import type { Lesson, Question } from '../../types/contract';
import { useTheme } from '../../theme';
import { Icon } from '../Icon';
import { Markdownish } from '../Markdownish';
import { Body, Button, Disclaimer, Eyebrow, ProgressBar, Title } from '../ui';
import { FeedbackPanel } from './FeedbackPanel';
import { CompareView, MultipleChoiceView, NumericView, OrderView, TrueFalseView } from './QuestionViews';

type Mode = 'lesson' | 'practice';
type Phase = 'intro' | 'question' | 'complete' | 'no_hearts';

type Draft = { index: number | null; tf: boolean | null; keypad: string; scale: UsdScale; order: number[] };
const emptyDraft = (): Draft => ({ index: null, tf: null, keypad: '', scale: 1e9, order: [] });

const TYPE_LABEL: Record<Question['type'], string> = {
  multiple_choice: 'Pick one',
  numeric: 'Type the number',
  true_false: 'True or false',
  compare: 'Compare',
  order: 'Put in order',
};

function draftToSubmission(q: Question, d: Draft): Submission | null {
  switch (q.type) {
    case 'multiple_choice':
    case 'compare':
      return d.index === null ? null : { type: q.type, index: d.index };
    case 'true_false':
      return d.tf === null ? null : { type: 'true_false', value: d.tf };
    case 'numeric': {
      const v = keypadToValue(d.keypad, q.unit, d.scale);
      return v === null ? null : { type: 'numeric', value: v };
    }
    case 'order':
      return d.order.length === q.choices.length ? { type: 'order', order: d.order } : null;
  }
}

export function LessonPlayer({ lesson, mode, initialPhase = 'intro' }: { lesson: Lesson; mode: Mode; initialPhase?: Phase }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const hearts = useApp((s) => s.hearts);
  const loseHeartAction = useApp((s) => s.loseHeart);
  const completeLesson = useApp((s) => s.completeLesson);
  const awardXp = useApp((s) => s.awardLearningXp);
  const alreadyCompleted = useApp((s) => Boolean(s.completed[lesson.id]));

  const total = lesson.questions.length;
  const [phase, setPhase] = useState<Phase>(hearts.count <= 0 ? 'no_hearts' : initialPhase);
  const [queue, setQueue] = useState<number[]>(() => lesson.questions.map((_, i) => i));
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [missed] = useState(() => new Set<string>());
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [checked, setChecked] = useState<null | { correct: boolean }>(null);
  const [earned, setEarned] = useState(0);
  const awarded = useRef(false);

  const q = lesson.questions[queue[0]];
  const submission = useMemo(() => (q ? draftToSubmission(q, draft) : null), [q, draft]);

  const finish = () => {
    if (awarded.current) return;
    awarded.current = true;
    // Rewards are for learning only — computed from answers, never from any trading activity.
    if (mode === 'lesson') {
      const xp = lessonXp({ baseXp: lesson.xp, mistakes, alreadyCompleted });
      completeLesson(lesson.id, mistakes, xp);
      setEarned(xp);
    } else {
      const xp = practiceXp(firstTryCorrect);
      if (xp > 0) awardXp(xp);
      setEarned(xp);
    }
    setPhase('complete');
  };

  const check = () => {
    if (!q || !submission) return;
    const ok = isCorrect(q, submission);
    setChecked({ correct: ok });
    if (ok) {
      setCorrectCount((n) => n + 1);
      if (!missed.has(q.id)) setFirstTryCorrect((n) => n + 1);
    } else {
      missed.add(q.id);
      setMistakes((n) => n + 1);
      loseHeartAction();
    }
  };

  const next = () => {
    const wasCorrect = checked?.correct;
    setChecked(null);
    setDraft(emptyDraft());
    const [head, ...rest] = queue;
    const newQueue = wasCorrect ? rest : [...rest, head]; // missed questions come back at the end
    setQueue(newQueue);
    if (newQueue.length === 0) return finish();
    if (!wasCorrect && useApp.getState().hearts.count <= 0) setPhase('no_hearts');
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // ---------- chrome ----------
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quit lesson" onPress={close} hitSlop={10}>
        <Icon name="close" color={t.c.inkSoft} size={26} />
      </Pressable>
      <ProgressBar value={total ? correctCount / total : 0} label={`Lesson progress: ${correctCount} of ${total}`} height={14} />
      <View accessible accessibilityLabel={`${hearts.count} hearts left`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="heart" color={t.c.heart} fill={t.c.heart} size={22} strokeWidth={1.5} />
        <Text style={{ color: t.c.heart, fontWeight: '900', fontSize: 16 }}>{hearts.count}</Text>
      </View>
    </View>
  );

  if (phase === 'no_hearts') {
    const ms = msUntilNextHeart(hearts, Date.now());
    const mins = ms === null ? 0 : Math.ceil(ms / 60000);
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        {header}
        <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <Icon name="heart" color={t.c.locked} size={72} />
          <Title style={{ textAlign: 'center' }}>Out of hearts</Title>
          <Body soft style={{ textAlign: 'center' }}>
            Hearts refill on their own — one every 30 minutes{ms !== null ? ` (next in ~${mins} min)` : ''}. Take a breather and re-read the intro.
          </Body>
          <Button label="Back to path" onPress={close} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  if (phase === 'intro') {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Eyebrow color={t.c.primary}>{mode === 'practice' ? 'Practice' : `Lesson · ${lesson.xp} XP`}</Eyebrow>
          <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, padding: 20, borderWidth: 1, borderColor: t.c.line }}>
            <Markdownish source={lesson.intro} />
          </View>
          <Body soft size={13}>{total} questions · wrong answers cost a heart and come back at the end.</Body>
        </ScrollView>
        <View style={{ padding: 16, paddingBottom: 16 + insets.bottom }}>
          <Button label="Start" onPress={() => setPhase('question')} />
        </View>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top }}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 8, borderBottomColor: 'rgba(0,0,0,0.2)' }}>
              <Icon name="star" color="#fff" fill="#fff" size={56} />
            </View>
            <Title style={{ textAlign: 'center' }}>{mode === 'practice' ? 'Practice done' : 'Lesson complete'}</Title>
            <Body soft style={{ textAlign: 'center' }}>{lesson.title}</Body>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              ['XP earned', `+${earned}`, t.c.accent],
              ['Mistakes', String(mistakes), mistakes ? t.c.danger : t.c.primary],
              ['First try', `${firstTryCorrect}/${total}`, t.c.primary],
            ].map(([label, v, color]) => (
              <View key={label} accessible accessibilityLabel={`${label}: ${v}`} style={{ flex: 1, borderRadius: t.radius.md, borderWidth: 2, borderColor: color, overflow: 'hidden' }}>
                <Text style={{ backgroundColor: color, color: '#fff', textAlign: 'center', fontWeight: '900', fontSize: 11, paddingVertical: 4, letterSpacing: 0.8 }}>{label.toUpperCase()}</Text>
                <Text style={{ textAlign: 'center', paddingVertical: 12, fontSize: 22, fontWeight: '900', color: t.c.ink, backgroundColor: t.c.surface }}>{v}</Text>
              </View>
            ))}
          </View>
          {mistakes === 0 && mode === 'lesson' && <Body style={{ textAlign: 'center', color: t.c.primary, fontWeight: '800' }}>Perfect lesson bonus included.</Body>}
          <Body soft size={12} style={{ textAlign: 'center' }}>XP is earned for learning only — never for trading.</Body>
        </View>
        <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 10 }}>
          <Button label="Continue" onPress={close} />
          <Disclaimer compact />
        </View>
      </View>
    );
  }

  if (!q) return null;
  const locked = checked !== null;
  const setIdx = (i: number) => setDraft((d) => ({ ...d, index: i }));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 32 }}>
        <Eyebrow color={t.c.accent}>{TYPE_LABEL[q.type]}</Eyebrow>
        <Text accessibilityRole="header" style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 22, lineHeight: 30, fontWeight: '700' }}>
          {q.prompt}
        </Text>
        {q.type === 'multiple_choice' && <MultipleChoiceView q={q} value={draft.index} onChange={setIdx} locked={locked} />}
        {q.type === 'compare' && <CompareView q={q} value={draft.index} onChange={setIdx} locked={locked} />}
        {q.type === 'true_false' && <TrueFalseView q={q} value={draft.tf} onChange={(v) => setDraft((d) => ({ ...d, tf: v }))} locked={locked} />}
        {q.type === 'order' && <OrderView q={q} value={draft.order} onChange={(v) => setDraft((d) => ({ ...d, order: v }))} locked={locked} />}
        {q.type === 'numeric' && (
          <NumericView
            q={q}
            value={draft.keypad}
            onChange={(v) => setDraft((d) => ({ ...d, keypad: v }))}
            scale={draft.scale}
            onScale={(s) => setDraft((d) => ({ ...d, scale: s }))}
            locked={locked}
          />
        )}
      </ScrollView>
      {checked ? (
        <FeedbackPanel q={q} correct={checked.correct} onContinue={next} bottomInset={insets.bottom} />
      ) : (
        <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: t.c.line }}>
          <Button label="Check" onPress={check} disabled={!submission} />
        </View>
      )}
    </View>
  );
}

/** Apply any heart regen that happened while the app was closed, before a lesson starts. */
export function useEnsureHeartsFresh() {
  const tick = useApp((s) => s.tickHearts);
  useEffect(() => {
    tick();
  }, [tick]);
}
