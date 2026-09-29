import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { ASSIST_DISCLAIMER, askScreener, type AssistAnswer } from '../assist';

const EXAMPLES = ['cheap profitable companies with low debt', 'fast growing, pricing power', 'pe < 20 and roic > 15%'];

/**
 * "Ask the screener": describe it in words, get editable filter chips. The parent owns the
 * screen; this box only proposes filters (replace, or append with "Add to this screen").
 */
export function AskBox({
  hasFilters,
  onApply,
  initialText = '',
  initialAnswer = null,
}: {
  hasFilters: boolean;
  onApply: (answer: AssistAnswer, mode: 'replace' | 'append') => void;
  initialText?: string;
  initialAnswer?: AssistAnswer | null;
}) {
  const t = useTheme();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AssistAnswer | null>(initialAnswer);
  const abort = useRef<AbortController | null>(null);

  const run = async (mode: 'replace' | 'append', q = text) => {
    if (!q.trim() || busy) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    try {
      const a = await askScreener(q, undefined, ctl.signal);
      if (ctl.signal.aborted) return;
      setAnswer(a);
      if (a.filters.length) onApply(a, mode);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.line, padding: 14, gap: 10 }}>
      <Text style={{ fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700', color: t.c.ink }}>Ask the screener</Text>
      <TextInput
        accessibilityLabel="Describe what you're looking for"
        value={text}
        onChangeText={setText}
        placeholder="Describe what you're looking for"
        placeholderTextColor={t.c.locked}
        onSubmitEditing={() => run(hasFilters ? 'append' : 'replace')}
        returnKeyType="search"
        maxLength={300}
        multiline
        style={{
          minHeight: 48,
          borderWidth: 1.5,
          borderColor: t.c.line,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: t.c.ink,
          fontSize: 16,
          backgroundColor: t.c.bg,
        }}
      />
      {!answer && !text ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {EXAMPLES.map((ex) => (
            <Pressable
              key={ex}
              accessibilityRole="button"
              accessibilityLabel={`Try: ${ex}`}
              onPress={() => {
                setText(ex);
                void run('replace', ex);
              }}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: t.c.surfaceAlt }}
            >
              <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '600' }}>“{ex}”</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Build filters from this description"
          accessibilityState={{ disabled: !text.trim() || busy }}
          disabled={!text.trim() || busy}
          onPress={() => run('replace')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: text.trim() ? t.c.primary : t.c.locked, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}
        >
          {busy ? <ActivityIndicator size="small" color={t.c.primaryInk} /> : <Icon name="filter" color={t.c.primaryInk} size={16} />}
          <Text style={{ color: t.c.primaryInk, fontWeight: '800' }}>Build filters</Text>
        </Pressable>
        {hasFilters ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add these filters to the current screen"
            accessibilityState={{ disabled: !text.trim() || busy }}
            disabled={!text.trim() || busy}
            onPress={() => run('append')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: t.c.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}
          >
            <Icon name="plus" color={t.c.primary} size={16} />
            <Text style={{ color: t.c.primary, fontWeight: '800' }}>Add to this screen</Text>
          </Pressable>
        ) : null}
      </View>

      {answer ? (
        <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
          <Text style={{ color: t.c.ink, fontSize: 14, fontWeight: '700' }}>
            {answer.filters.length ? `Interpreted as: ${answer.restatement}` : 'No filters could be built from that.'}
          </Text>
          {answer.notes.map((n, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: t.c.accentSoft, borderRadius: 8, padding: 8 }}>
              <Icon name="info" color={t.c.accent} size={15} />
              <Text style={{ flex: 1, color: t.c.ink, fontSize: 13 }}>{n}</Text>
            </View>
          ))}
          {answer.unrecognized.length ? (
            <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>
              Not a filter here: {answer.unrecognized.map((u) => `“${u}”`).join(', ')}.
            </Text>
          ) : null}
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
            {answer.adapter === 'backend' ? 'Built with AI help. ' : answer.adapter === 'mock' ? 'Built offline on this device. ' : 'Read exactly as typed. '}
            {ASSIST_DISCLAIMER}
          </Text>
        </View>
      ) : (
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{ASSIST_DISCLAIMER}</Text>
      )}
    </View>
  );
}
