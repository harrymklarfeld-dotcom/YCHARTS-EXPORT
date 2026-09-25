import { useRef, useState } from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../../theme';
import { snap, type Range } from '../calc';

type Props = {
  label: string;
  value: number;
  range: Range;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
};

/**
 * Dependency-free slider that works on iOS, Android and web (responder events + pageX, so the
 * thumb follows the finger/mouse even when it leaves the track). ± buttons give precise steps
 * and screen readers get an "adjustable" control with increment/decrement actions.
 */
export function Slider({ label, value, range, format, onChange, disabled, hint }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const originX = useRef(0);
  const span = range.max - range.min || 1;
  const frac = Math.min(1, Math.max(0, (value - range.min) / span));
  const THUMB = 26;

  const setFromX = (x: number) => {
    if (disabled || width <= 0) return;
    const f = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, width - THUMB)));
    const next = snap(range.min + f * span, range);
    if (next !== value) onChange(next);
  };
  const nudge = (dir: 1 | -1) => {
    if (disabled) return;
    onChange(snap(value + dir * range.step * (span / range.step > 400 ? 5 : 1), range));
  };
  const grant = (e: GestureResponderEvent) => {
    originX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
    setFromX(e.nativeEvent.locationX);
  };
  const move = (e: GestureResponderEvent) => setFromX(e.nativeEvent.pageX - originX.current);

  const stepBtn = (dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dir > 0 ? 'Increase' : 'Decrease'} ${label}`}
      disabled={disabled}
      onPress={() => nudge(dir)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface,
        borderWidth: 1,
        borderColor: t.c.line,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 16, lineHeight: 18 }}>{dir > 0 ? '+' : '−'}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 4, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 13, fontWeight: '700', fontFamily: t.fonts.body }}>{label}</Text>
        <Text style={{ color: t.c.ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'], fontFamily: t.fonts.body }}>{format(value)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {stepBtn(-1)}
        <View
          style={{ flex: 1, height: 34, justifyContent: 'center', cursor: disabled ? 'auto' : 'pointer', userSelect: 'none' } as object}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderTerminationRequest={() => false}
          onResponderGrant={grant}
          onResponderMove={move}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ disabled: !!disabled }}
          accessibilityValue={{ text: format(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          <View style={{ height: 6, borderRadius: 3, backgroundColor: t.c.surfaceAlt, marginHorizontal: THUMB / 2, overflow: 'hidden', pointerEvents: 'none' }}>
            <View style={{ width: `${frac * 100}%`, height: '100%', backgroundColor: disabled ? t.c.locked : t.c.primary }} />
          </View>
          <View
            style={{
              position: 'absolute',
              left: frac * Math.max(0, width - THUMB),
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: t.c.surface,
              borderWidth: 3,
              borderColor: disabled ? t.c.locked : t.c.primary,
              pointerEvents: 'none',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            }}
          />
        </View>
        {stepBtn(1)}
      </View>
    </View>
  );
}
