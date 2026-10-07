import type { Widget } from '../types';
import { DcfCalculator, LiquidityCalculator, PeCalculator } from './Calculators';
import { CompareWidget } from './CompareWidget';
import { HistoryWidget } from './HistoryWidget';
import { MetricWidget } from './MetricWidget';
import { QuizWidget } from './QuizWidget';
import { Unsupported } from './WidgetFrame';

/** Renders any article widget natively. */
export function WidgetView({ widget }: { widget: Widget }) {
  switch (widget.kind) {
    case 'metric':
      return <MetricWidget {...widget} />;
    case 'compare':
      return <CompareWidget {...widget} />;
    case 'history':
      return <HistoryWidget {...widget} />;
    case 'quiz':
      return <QuizWidget {...widget} />;
    case 'calc_pe':
      return <PeCalculator {...widget} />;
    case 'calc_dcf':
      return <DcfCalculator {...widget} />;
    case 'calc_liquidity':
      return <LiquidityCalculator {...widget} />;
    case 'unsupported':
      return <Unsupported reason={widget.reason} />;
  }
}
