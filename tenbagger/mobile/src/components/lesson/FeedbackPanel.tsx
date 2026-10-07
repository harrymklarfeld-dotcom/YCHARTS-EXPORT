import { Text, View } from 'react-native';
import { formatForUnit, sourceLabel } from '../../lib/format';
import type { Question } from '../../types/contract';
import { useTheme } from '../../theme';
import { Icon } from '../Icon';
import { Button } from '../ui';

export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case 'multiple_choice':
    case 'compare':
      return q.choices[q.answer] ?? '';
    case 'true_false':
      return q.answer ? 'True' : 'False';
    case 'numeric':
      return formatForUnit(q.answer, q.unit);
    case 'order':
      return q.answer.map((i) => q.choices[i]).join(' → ');
  }
}

export function FeedbackPanel({ q, correct, onContinue, bottomInset }: { q: Question; correct: boolean; onContinue: () => void; bottomInset: number }) {
  const t = useTheme();
  const fg = correct ? t.c.primary : t.c.danger;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: correct ? t.c.primarySoft : t.c.dangerSoft, padding: 18, paddingBottom: 18 + bottomInset, gap: 10, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: fg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={correct ? 'check' : 'close'} color="#fff" size={20} strokeWidth={3} />
        </View>
        <Text accessibilityRole="header" style={{ color: fg, fontFamily: t.fonts.display, fontSize: 22, fontWeight: '700' }}>
          {correct ? 'Nicely done.' : 'Not quite.'}
        </Text>
      </View>
      {!correct && (
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>
          Answer: <Text style={{ color: fg }}>{correctAnswerText(q)}</Text>
        </Text>
      )}
      <Text style={{ color: t.c.ink, fontSize: 15, lineHeight: 22 }}>{q.explanation}</Text>
      {q.source && (
        <View
          accessible
          accessibilityLabel={sourceLabel(q.source)}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.c.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: t.c.line }}
        >
          <Icon name="book" color={t.c.inkSoft} size={14} />
          <Text style={{ color: t.c.inkSoft, fontSize: 12, fontFamily: t.fonts.mono }}>{sourceLabel(q.source)}</Text>
        </View>
      )}
      <Button label="Continue" variant={correct ? 'primary' : 'danger'} onPress={onContinue} style={{ marginTop: 4 }} />
    </View>
  );
}
