import { useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { getCompany } from '../../data';
import { formatPercent, formatUsdCompact } from '../../lib/format';
import { useTheme } from '../../theme';
import { dcfCalc, dcfRanges, liquidityCalc, liquidityRanges, normalizedFcf, pct, peCalc, peRanges } from '../calc';
import { Slider } from '../components/Slider';
import { isSampleFundamentals } from '../provenance';
import { Stat, Unsupported, WidgetFrame } from './WidgetFrame';

const money2 = (v: number) => (Math.abs(v) >= 1000 ? formatUsdCompact(v, 2) : `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`);
const mult = (v: number) => `${v.toFixed(1)}×`;

function Formula({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17, fontFamily: t.fonts.mono }}>{children}</Text>;
}

/* ------------------------------------------------------------------------------------ P/E */

export function PeCalculator(props: { ticker?: string; price?: number; eps?: number; requiredReturn: number; caption?: string }) {
  const c = props.ticker ? getCompany(props.ticker) : undefined;
  const price0 = props.price ?? c?.price ?? null;
  const eps0 = props.eps ?? c?.fundamentals.eps_diluted ?? null;
  const ranges = useMemo(() => peRanges(price0 ?? 1, eps0 ?? 1), [price0, eps0]);
  const [price, setPrice] = useState(price0 ?? 1);
  const [eps, setEps] = useState(eps0 ?? 1);
  const [r, setR] = useState(props.requiredReturn);
  if (price0 === null || eps0 === null) return <Unsupported reason="no price or EPS" />;
  const res = peCalc(price, eps, r);
  const usesCompanyPrice = props.price === undefined && !!c;
  return (
    <WidgetFrame
      eyebrow="Calculator · P/E"
      title={c ? `${c.name.replace(/,? Inc\.?$/, '')}: price vs. earnings` : 'Price vs. earnings'}
      caption={props.caption}
      sample={c ? isSampleFundamentals(c) : false}
      samplePrice={usesCompanyPrice && !!c?.price_is_sample}
    >
      <Slider label="Share price" value={price} range={ranges.price} format={money2} onChange={setPrice} />
      <Slider label="Earnings per share (EPS)" value={eps} range={ranges.eps} format={money2} onChange={setEps} />
      <Slider label="Required return" value={r} range={ranges.required} format={pct} onChange={setR} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat big label="P/E" value={res.pe === null ? 'n/m' : mult(res.pe)} />
        <Stat big label="Earnings yield" value={res.earningsYield === null ? '—' : pct(res.earningsYield)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat
          label="Growth the price implies (forever)"
          value={res.impliedGrowth === null ? '—' : pct(res.impliedGrowth)}
          tone={res.impliedGrowth !== null && res.impliedGrowth > 0.07 ? 'warn' : undefined}
        />
      </View>
      <Formula>{`P/E = price ÷ EPS · earnings yield = EPS ÷ price\nimplied growth ≈ required return − earnings yield${res.pe === null ? '\nP/E is not meaningful when EPS ≤ 0' : ''}`}</Formula>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------------------------------ DCF */

type DcfProps = {
  ticker?: string;
  fcf?: number;
  growth: number;
  discount: number;
  terminal: number;
  years: number;
  netCash?: number;
  shares?: number;
  normalizedFcf?: number;
  cyclical: boolean;
  caption?: string;
};

export function DcfCalculator(p: DcfProps) {
  const t = useTheme();
  const c = p.ticker ? getCompany(p.ticker) : undefined;
  const fcf0 = p.fcf ?? c?.fundamentals.free_cash_flow ?? null;
  const norm = p.normalizedFcf ?? (c ? normalizedFcf(c.history.free_cash_flow) : null);
  const netCash = p.netCash ?? c?.metrics.net_cash ?? 0;
  const shares = p.shares ?? c?.fundamentals.shares_diluted ?? null;
  const ranges = useMemo(() => dcfRanges(fcf0 ?? 1, norm), [fcf0, norm]);
  const [fcf, setFcf] = useState(fcf0 ?? 0);
  const [growth, setGrowth] = useState(p.growth);
  const [discount, setDiscount] = useState(p.discount);
  const [terminal, setTerminal] = useState(p.terminal);
  const [useNorm, setUseNorm] = useState(p.cyclical && norm !== null);
  if (fcf0 === null) return <Unsupported reason="no free cash flow" />;
  const start = useNorm && norm !== null ? norm : fcf;
  const res = dcfCalc({ fcf: start, growth, discount, terminal, years: p.years, netCash, shares });
  const histYears = c?.history.free_cash_flow?.filter(([, v]) => v !== null).length ?? 0;
  return (
    <WidgetFrame
      eyebrow="Calculator · DCF"
      title={c ? `Napkin DCF: ${c.name.replace(/ Technology,? Inc\.?$|,? Inc\.?$/, '')}` : 'Napkin DCF'}
      caption={p.caption}
      sample={c ? isSampleFundamentals(c) : false}
    >
      <Slider label="Starting free cash flow (per year)" value={fcf} range={ranges.fcf} format={(v) => formatUsdCompact(v, 2)} onChange={setFcf} disabled={useNorm} />
      {norm !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: useNorm ? t.c.accentSoft : t.c.surfaceAlt, borderRadius: 12, padding: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>Cyclical: use normalized FCF</Text>
            <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 16 }}>
              {c && histYears ? `${histYears}-year average` : 'Through-cycle estimate'}: {formatUsdCompact(norm, 2)}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Cyclical: use normalized free cash flow"
            value={useNorm}
            onValueChange={setUseNorm}
            trackColor={{ true: t.c.accent, false: t.c.locked }}
            thumbColor={t.c.surface}
          />
        </View>
      )}
      <Slider label={`Growth, years 1–${p.years}`} value={growth} range={ranges.growth} format={pct} onChange={setGrowth} />
      <Slider label="Discount rate (required return)" value={discount} range={ranges.discount} format={pct} onChange={setDiscount} />
      <Slider label={`Terminal multiple (× year-${p.years} FCF)`} value={terminal} range={ranges.terminal} format={mult} onChange={setTerminal} />
      <View style={{ height: 1, backgroundColor: t.c.line }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat big label="Estimated value" value={formatUsdCompact(res.equityValue, 1)} tone={res.equityValue < 0 ? 'bad' : undefined} />
        {res.perShare !== null && <Stat big label="Per share" value={money2(res.perShare)} tone={res.perShare < 0 ? 'bad' : undefined} />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label={`PV of ${p.years} years`} value={formatUsdCompact(res.pvYears, 1)} />
        <Stat label="PV of terminal" value={formatUsdCompact(res.pvTerminal, 1)} />
        <Stat label={netCash >= 0 ? 'Net cash' : 'Net debt'} value={formatUsdCompact(Math.abs(netCash), 1)} />
      </View>
      <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>
        Share from terminal value:{' '}
        <Text style={{ color: t.c.ink, fontWeight: '800' }}>{res.terminalShare === null ? '—' : formatPercent(res.terminalShare, 0)}</Text>
      </Text>
      <Formula>{`value = Σ FCF·(1+g)^t ÷ (1+r)^t  +  FCF·(1+g)^${p.years}·multiple ÷ (1+r)^${p.years}  ${netCash >= 0 ? '+ net cash' : '− net debt'}`}</Formula>
      <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>
        An estimate from your assumptions, not a fair value or a forecast.
      </Text>
    </WidgetFrame>
  );
}

/* ------------------------------------------------------------------------------------ Liquidity */

const GRADE_NOTE: Record<string, string> = {
  A: 'Cash covers the card balance twice or more.',
  B: 'A solid cushion.',
  C: 'Covered, but the cushion is thin.',
  D: 'Cash covers most, not all, of the balance.',
  F: 'The card balance is well above cash.',
};

export function LiquidityCalculator({ cash: cash0, card: card0, caption }: { cash: number; card: number; caption?: string }) {
  const t = useTheme();
  const ranges = useMemo(() => liquidityRanges(cash0, card0), [cash0, card0]);
  const [cash, setCash] = useState(cash0);
  const [card, setCard] = useState(card0);
  const res = liquidityCalc(cash, card);
  const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
  const tone = res.grade === 'A' || res.grade === 'B' ? 'good' : res.grade === 'C' ? 'warn' : 'bad';
  return (
    <WidgetFrame eyebrow="Calculator · Your money" title="Personal liquidity ratio" caption={caption}>
      <Slider label="Cash (checking + savings)" value={cash} range={ranges.cash} format={usd} onChange={setCash} />
      <Slider label="Credit card balance" value={card} range={ranges.card} format={usd} onChange={setCard} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <Stat big label="Liquidity ratio" value={res.ratio === null ? 'No balance' : `${res.ratio.toFixed(2)}×`} tone={tone} />
        <Stat big label="Grade" value={res.grade} tone={tone} />
        <Stat label="Cash − card" value={usd(res.cushion)} tone={res.cushion < 0 ? 'bad' : undefined} />
      </View>
      <Text style={{ color: t.c.ink, fontSize: 14 }}>{res.ratio === null ? 'No card balance: nothing short-term to cover.' : GRADE_NOTE[res.grade]}</Text>
      <Formula>{'liquidity ratio = cash ÷ card balance (your personal current ratio)\nA ≥ 2.0 · B 1.5–2 · C 1–1.5 · D 0.75–1 · F < 0.75'}</Formula>
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Same bands as the Money hub. Stays on this device.</Text>
    </WidgetFrame>
  );
}
