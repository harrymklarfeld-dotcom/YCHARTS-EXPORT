import { Text, View } from 'react-native';
import { useTheme } from '../theme';

/** Tiny renderer for lesson intros: '# heading', '- bullets', blank-line paragraphs, **bold**, *italic*. */
export function Markdownish({ source }: { source: string }) {
  const t = useTheme();
  const blocks = source.split(/\n{2,}/);
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <Text key={`${key}-${i}`} style={{ fontWeight: '800', color: t.c.ink }}>{part.slice(2, -2)}</Text>;
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <Text key={`${key}-${i}`} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
      return part;
    });
  return (
    <View style={{ gap: 12 }}>
      {blocks.map((b, bi) => {
        const lines = b.split('\n');
        if (lines[0].startsWith('# ')) {
          return (
            <Text key={bi} accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 28, fontWeight: '700', color: t.c.ink }}>
              {lines[0].slice(2)}
            </Text>
          );
        }
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <View key={bi} style={{ gap: 8, backgroundColor: t.c.surfaceAlt, borderRadius: 14, padding: 14 }}>
              {lines.map((l, li) => (
                <View key={li} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ color: t.c.primary, fontWeight: '900' }}>▸</Text>
                  <Text style={{ flex: 1, color: t.c.ink, fontSize: 15, lineHeight: 22 }}>{inline(l.slice(2), `${bi}-${li}`)}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={bi} style={{ color: t.c.ink, fontSize: 16, lineHeight: 24 }}>
            {inline(lines.join(' '), String(bi))}
          </Text>
        );
      })}
    </View>
  );
}
