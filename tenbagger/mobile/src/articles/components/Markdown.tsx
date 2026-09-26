import { useMemo } from 'react';
import { Linking, Text, View, type TextStyle } from 'react-native';
import { useTheme } from '../../theme';
import { parseMarkdown, type Inline } from '../markdown';

function InlineNodes({ nodes, base }: { nodes: Inline[]; base?: TextStyle }) {
  const t = useTheme();
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return n.v;
          case 'b':
            return (
              <Text key={i} style={{ fontWeight: '800', color: t.c.ink }}>
                <InlineNodes nodes={n.c} />
              </Text>
            );
          case 'i':
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                <InlineNodes nodes={n.c} />
              </Text>
            );
          case 'code':
            return (
              <Text key={i} style={{ fontFamily: t.fonts.mono, fontSize: (base?.fontSize ?? 16) - 2, backgroundColor: t.c.surfaceAlt }}>
                {n.v}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={i}
                accessibilityRole="link"
                style={{ color: t.c.primary, textDecorationLine: 'underline', fontWeight: '700' }}
                onPress={() => {
                  if (/^https?:\/\//.test(n.href)) Linking.openURL(n.href).catch(() => undefined);
                }}
              >
                <InlineNodes nodes={n.c} />
              </Text>
            );
        }
      })}
    </>
  );
}

/** Renders the article Markdown subset (see content/WIDGETS.md) with the app's type scale. */
export function Markdown({ md }: { md: string }) {
  const t = useTheme();
  const blocks = useMemo(() => parseMarkdown(md), [md]);
  const body: TextStyle = { fontFamily: t.fonts.body, fontSize: 17, lineHeight: 27, color: t.c.ink };
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={{
                  fontFamily: t.fonts.display,
                  fontWeight: '700',
                  color: t.c.ink,
                  fontSize: b.level === 2 ? 23 : 19,
                  lineHeight: b.level === 2 ? 29 : 25,
                  marginTop: b.level === 2 ? 10 : 4,
                  letterSpacing: -0.3,
                }}
              >
                <InlineNodes nodes={b.content} />
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i} style={body}>
                <InlineNodes nodes={b.content} base={body} />
              </Text>
            );
          case 'quote':
            return (
              <View key={i} style={{ borderLeftWidth: 4, borderLeftColor: t.c.accent, backgroundColor: t.c.accentSoft, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6 }}>
                <Text style={{ ...body, fontSize: 16, lineHeight: 24, fontWeight: '600' }}>
                  <InlineNodes nodes={b.content} base={body} />
                </Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={{ gap: 8 }}>
                {b.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 10, paddingRight: 4 }}>
                    <Text style={{ ...body, color: t.c.primary, fontWeight: '800', minWidth: b.ordered ? 22 : 12 }}>{b.ordered ? `${b.start + j}.` : '•'}</Text>
                    <Text style={{ ...body, flex: 1 }}>
                      <InlineNodes nodes={item} base={body} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'code':
            return (
              <View key={i} style={{ backgroundColor: t.c.surfaceAlt, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontFamily: t.fonts.mono, fontSize: 13, lineHeight: 19, color: t.c.ink }}>{b.text}</Text>
              </View>
            );
          case 'rule':
            return <View key={i} style={{ height: 1, backgroundColor: t.c.line, marginVertical: 6 }} />;
        }
      })}
    </View>
  );
}
