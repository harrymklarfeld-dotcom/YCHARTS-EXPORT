import { useColorScheme } from 'react-native';
import { useApp } from '../state/store';
import { dark, fonts, light, radius, space, type Palette } from './tokens';

export type Theme = { c: Palette; dark: boolean; fonts: typeof fonts; radius: typeof radius; space: typeof space };

export function useTheme(): Theme {
  const pref = useApp((s) => s.themePref);
  const system = useColorScheme();
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  return { c: isDark ? dark : light, dark: isDark, fonts, radius, space };
}

export { light, dark, fonts, radius, space };
export type { Palette };
