import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'path' | 'filter' | 'building' | 'user' | 'flame' | 'heart' | 'lock' | 'check' | 'star'
  | 'close' | 'chevron' | 'info' | 'sort' | 'plus' | 'trash' | 'backspace' | 'link' | 'book' | 'arrowUp' | 'arrowDown';

type Props = { name: IconName; size?: number; color: string; fill?: string; strokeWidth?: number };

/** Hand-drawn stroke icon set (no icon-font dependency). Decorative: wrap in a labelled control. */
export function Icon({ name, size = 22, color, fill = 'none', strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'path' && (
        <>
          <Circle cx="6" cy="5" r="2.5" {...p} />
          <Circle cx="18" cy="12" r="2.5" {...p} />
          <Circle cx="6" cy="19" r="2.5" {...p} />
          <Path d="M8.3 6.2 15.7 10.8M15.7 13.2 8.3 17.8" {...p} />
        </>
      )}
      {name === 'filter' && <Path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" {...p} />}
      {name === 'building' && (
        <>
          <Rect x="4" y="3" width="10" height="18" rx="1" {...p} />
          <Path d="M14 9h6v12h-6M7 7h4M7 11h4M7 15h4M17 13h0M17 17h0" {...p} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8" r="4" {...p} />
          <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...p} />
        </>
      )}
      {name === 'flame' && (
        <Path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 1.8 1 3 2.5 3.5C11 9 11 5 12 2z" {...p} fill={fill} />
      )}
      {name === 'heart' && (
        <Path d="M12 20s-7.5-4.6-9-9.2C1.9 7.4 4.1 4 7.5 4c2 0 3.5 1.2 4.5 2.8C13 5.2 14.5 4 16.5 4 19.9 4 22.1 7.4 21 10.8 19.5 15.4 12 20 12 20z" {...p} fill={fill} />
      )}
      {name === 'lock' && (
        <>
          <Rect x="5" y="11" width="14" height="10" rx="2" {...p} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === 'star' && <Path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.5l-5.6 2.9 1.1-6.3L3 9.7l6.2-.9L12 3z" {...p} fill={fill} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...p} />}
      {name === 'chevron' && <Path d="M9 5l7 7-7 7" {...p} />}
      {name === 'info' && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 11v6M12 7.5v.01" {...p} />
        </>
      )}
      {name === 'sort' && <Path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'trash' && <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...p} />}
      {name === 'backspace' && <Path d="M21 5H8l-6 7 6 7h13V5zM11 9l6 6M17 9l-6 6" {...p} />}
      {name === 'link' && <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...p} />}
      {name === 'book' && <Path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13" {...p} />}
      {name === 'arrowUp' && <Path d="M12 19V5M6 11l6-6 6 6" {...p} />}
      {name === 'arrowDown' && <Path d="M12 5v14M6 13l6 6 6-6" {...p} />}
    </Svg>
  );
}
