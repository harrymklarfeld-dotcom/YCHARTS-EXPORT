import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { TickerBadge } from '../../components/CompanyRow';
import { Icon } from '../../components/Icon';
import type { Company } from '../../types/contract';
import { useTheme, type Theme } from '../../theme';
import { getColumn, type ColumnContext, type ColumnDef } from '../columns';
import type { SortSpec } from '../lists';

type CommonProps = {
  columns: readonly string[];
  ctx: ColumnContext;
  sort: SortSpec;
  onSort: (columnId: string) => void;
  onScore: (ticker: string, family: string) => void;
};

const COMPANY_COL_MIN = 220;
const COL_MIN = 92;

function scoreTint(t: Theme, v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { bg: 'transparent', fg: t.c.inkSoft };
  // Neutral ink scale (not red/green): a score is a position in this list, not a verdict.
  return { bg: n >= 67 ? t.c.primarySoft : n <= 33 ? t.c.surfaceAlt : 'transparent', fg: t.c.ink };
}

function Cell({ col, company, ctx, onScore, align = 'right' }: { col: ColumnDef; company: Company; ctx: ColumnContext; onScore: CommonProps['onScore']; align?: 'right' | 'left' }) {
  const t = useTheme();
  const text = col.display(company, ctx);
  if (col.kind === 'score') {
    const tint = scoreTint(t, text);
    const fam = col.id.slice('score:'.length);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${col.label} ${text} for ${company.ticker}. How is this calculated?`}
        onPress={() => onScore(company.ticker, fam)}
        style={{ alignSelf: align === 'right' ? 'flex-end' : 'flex-start', minWidth: 40, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tint.bg, borderWidth: 1, borderColor: t.c.line }}
      >
        <Text style={{ color: tint.fg, fontWeight: '800', fontSize: 13, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{text}</Text>
      </Pressable>
    );
  }
  return (
    <Text numberOfLines={1} style={{ color: t.c.ink, fontWeight: '700', fontSize: 13, textAlign: align, fontVariant: ['tabular-nums'] }}>
      {text}
    </Text>
  );
}

/** Sticky header row for the wide table (render as a direct child of the page ScrollView). */
export function ResultsTableHeader({ columns, sort, onSort }: Pick<CommonProps, 'columns' | 'sort' | 'onSort'>) {
  const t = useTheme();
  const cols = columns.map(getColumn).filter((c): c is ColumnDef => !!c);
  return (
    <View
      accessibilityRole="header"
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.c.surfaceAlt, borderTopLeftRadius: t.radius.md, borderTopRightRadius: t.radius.md, borderWidth: 1, borderColor: t.c.line, paddingHorizontal: 12, paddingVertical: 10 }}
    >
      <Text style={{ flex: 2.4, minWidth: COMPANY_COL_MIN, color: t.c.inkSoft, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>Company</Text>
      {cols.map((c) => {
        const active = sort.column === c.id;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${c.label}${active ? (sort.dir === 'desc' ? ', currently high to low' : ', currently low to high') : ''}`}
            onPress={() => onSort(c.id)}
            style={{ flex: 1, minWidth: COL_MIN, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}
          >
            <Text numberOfLines={1} style={{ color: active ? t.c.ink : t.c.inkSoft, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {c.short}
            </Text>
            {active ? <Icon name={sort.dir === 'desc' ? 'arrowDown' : 'arrowUp'} color={t.c.ink} size={13} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Body rows for the wide table. */
export function ResultsTableBody({ companies, columns, ctx, onScore }: Omit<CommonProps, 'sort' | 'onSort'> & { companies: readonly Company[] }) {
  const t = useTheme();
  const cols = columns.map(getColumn).filter((c): c is ColumnDef => !!c);
  return (
    <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: t.c.line, borderBottomLeftRadius: t.radius.md, borderBottomRightRadius: t.radius.md, overflow: 'hidden' }}>
      {companies.map((co, i) => (
        <Pressable
          key={co.ticker}
          accessibilityRole="button"
          accessibilityLabel={`${co.name}, ${co.ticker}. ${cols.map((c) => `${c.short} ${c.display(co, ctx)}`).join(', ')}. Open company.`}
          onPress={() => router.push(`/company/${co.ticker}`)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: pressed ? t.c.surfaceAlt : i % 2 ? t.c.bg : t.c.surface,
            borderTopWidth: i ? 1 : 0,
            borderTopColor: t.c.line,
          })}
        >
          <View style={{ flex: 2.4, minWidth: COMPANY_COL_MIN, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TickerBadge ticker={co.ticker} size={34} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>{co.name}</Text>
              <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 12 }}>{co.sector} · FY{co.latest_fy}</Text>
            </View>
          </View>
          {cols.map((c) => (
            <View key={c.id} style={{ flex: 1, minWidth: COL_MIN }}>
              <Cell col={c} company={co} ctx={ctx} onScore={onScore} />
            </View>
          ))}
        </Pressable>
      ))}
    </View>
  );
}

/** Phone layout: one card per company with the first 3 chosen columns. */
export function ResultCards({ companies, columns, ctx, onScore }: Omit<CommonProps, 'sort' | 'onSort'> & { companies: readonly Company[] }) {
  const t = useTheme();
  const cols = columns.map(getColumn).filter((c): c is ColumnDef => !!c).slice(0, 3);
  return (
    <View style={{ gap: 8 }}>
      {companies.map((co) => (
        <Pressable
          key={co.ticker}
          accessibilityRole="button"
          accessibilityLabel={`${co.name}, ${co.ticker}. ${cols.map((c) => `${c.short} ${c.display(co, ctx)}`).join(', ')}. Open company.`}
          onPress={() => router.push(`/company/${co.ticker}`)}
          style={({ pressed }) => ({ padding: 12, gap: 10, backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.line })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TickerBadge ticker={co.ticker} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{co.name}</Text>
              <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 12 }}>
                {co.sector}
                {ctx.styles.get(co.ticker)?.label ? ` · ${ctx.styles.get(co.ticker)!.label}` : ''}
              </Text>
            </View>
            <Icon name="chevron" color={t.c.inkSoft} size={18} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {cols.map((c) => (
              <View key={c.id} style={{ flex: 1, gap: 3, backgroundColor: t.c.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '700' }}>{c.short}</Text>
                <Cell col={c} company={co} ctx={ctx} onScore={onScore} align="left" />
              </View>
            ))}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
