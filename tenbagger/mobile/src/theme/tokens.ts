import { Platform } from 'react-native';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  line: string;
  primary: string;
  primaryInk: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  locked: string;
  flame: string;
  heart: string;
  unitA: string;
  unitB: string;
};

/** "Ledger" palette: warm paper, deep navy ink, ledger green, brass accent. */
export const light: Palette = {
  bg: '#F5F2EA',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE7DB',
  ink: '#14213D',
  inkSoft: '#5B6475',
  line: '#DDD6C6',
  primary: '#0B7A57',
  primaryInk: '#FFFFFF',
  primarySoft: '#D5EDE3',
  accent: '#A8690F',
  accentSoft: '#FBEBC8',
  danger: '#C73E36',
  dangerSoft: '#F8DAD6',
  locked: '#C9C2B3',
  flame: '#E8701A',
  heart: '#D6453D',
  unitA: '#0B7A57',
  unitB: '#94600F',
};

export const dark: Palette = {
  bg: '#0D1422',
  surface: '#151E30',
  surfaceAlt: '#1C2740',
  ink: '#EEF1F6',
  inkSoft: '#97A3B8',
  line: '#26324A',
  primary: '#2BC48A',
  primaryInk: '#062117',
  primarySoft: '#123A2D',
  accent: '#F2B544',
  accentSoft: '#3A2E12',
  danger: '#FF6B61',
  dangerSoft: '#3E1B1A',
  locked: '#3A4660',
  flame: '#FF9A3D',
  heart: '#FF6B61',
  unitA: '#10563F',
  unitB: '#6B4E12',
};

/** Editorial serif for display, system sans for UI. No font downloads needed. */
export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }) as string,
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }) as string,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }) as string,
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = (n: number) => n * 4;
