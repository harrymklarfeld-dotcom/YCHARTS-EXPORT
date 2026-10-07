# Design tokens for the three prototype directions

There is one file per direction:

| File | Direction | Default scheme |
|---|---|---|
| `a-ledger.tokens.json` | A · Ledger | system |
| `b-arcade.tokens.json` | B · Arcade | system |
| `c-terminal-lite.tokens.json` | C · Terminal Lite | dark |

The values match the CSS custom properties in each prototype's `<style>` block. If you change a prototype, update its JSON to match.

## Shape

```jsonc
{
  "color": {
    "light": { /* the 18 keys of Palette in mobile/src/theme/tokens.ts */ },
    "dark":  { /* same keys */ },
    "extra": { "light": {}, "dark": {} }   // direction-only colours (outline, sky, up/down…)
  },
  "font":   { "display": {...}, "body": {...}, "mono": {...} | null },   // Google family, Expo package, RN family names per weight
  "type":   { "h1": { "fontSize", "lineHeight", "fontWeight", "font" }, ... },
  "radius": { "sm", "md", "lg", "pill" },
  "space":  { "unit": 4, "screenX", "stackGap", "rowY", "cardPad" },
  "border", "elevation", "motion"          // notes the RN port needs
}
```

`color.light` and `color.dark` use the **same keys, in the same order**, as the existing `Palette` type (`bg, surface, surfaceAlt, ink, inkSoft, line, primary, primaryInk, primarySoft, accent, accentSoft, danger, dangerSoft, locked, flame, heart, unitA, unitB`). That lets them replace `light` and `dark` in `tokens.ts` directly.

## Mapping into the mobile theme (`tenbagger/mobile/src/theme/`)

1. **Palette.** Paste `color.light` over `export const light` and `color.dark` over `export const dark` in `tokens.ts`. Nothing else has to change, because `useTheme()` in `index.tsx` already picks light or dark from `themePref` and the system scheme.
   - C uses `rgba(...)` for the `*Soft` colours. React Native accepts rgba strings, so they paste as-is.
2. **Extra colours.** If you adopt a direction's `color.extra` keys (for example B's `outline` or C's `up`/`down`/`info`), add them to the `Palette` type and to both objects. Components should read them through `useTheme().c` like every other colour.
3. **Fonts.** The current `fonts` object uses system faces and downloads nothing. To use a direction's faces:
   - Install `expo-font` and the packages named in `font.*.expoPackage`. For A that is `@expo-google-fonts/newsreader` and `@expo-google-fonts/public-sans`.
   - Load them with `useFonts({...})` in the root layout, before first render.
   - Set `fonts.display`, `fonts.body` and `fonts.mono` to the regular-weight family from `font.*.rnFamilies`.
   - With custom fonts, React Native does not pick a weight from `fontWeight`. Choose the weight by family name (`Newsreader_600SemiBold`, `Figtree_800ExtraBold`, …). Adding a small helper, `fontFor(role, weight)`, keeps call sites tidy.
   - Check the family names against each package's exports when installing.
4. **Type scale.** `type.*` gives size, line height, weight and font role in points, ready for `StyleSheet`. `letterSpacing` is in points too, so a CSS `0.14em` at 11px becomes about 1.5.
5. **Radius and spacing.** Replace `radius` with `radius` from the JSON. `space` stays `(n) => n * 4`. `space.unit` is 4 in all three directions. The other `space.*` values are the screen gutter and row paddings the prototypes use; the dense direction (C) uses smaller ones.
6. **Elevation.**
   - A keeps the current inset "3D" press on buttons and flat, bordered cards.
   - B needs hard offset shadows. On iOS use `shadowOffset {0,4}`, `shadowRadius 0`, `shadowOpacity 1`. Android can't draw hard shadows, so use a 4px bottom border in `outline`, the same trick the current buttons use. B also needs `borderWidth: 2` on cards, tiles and buttons.
7. **Default scheme.** C is designed dark-first. To ship it, change the default `themePref: 'system'` in `mobile/src/state/store.ts` to `'dark'`. The profile screen already lets people switch.
8. **Motion.** Respect `AccessibilityInfo.isReduceMotionEnabled()` in the same places the prototypes respect `prefers-reduced-motion`. `motion.reducedMotion` lists them.

## Mapping into the website config

The repo has no website package yet. When there is one, the prototypes already show the pattern to copy:

```css
:root { --bg: <color.light.bg>; --ink: <color.light.ink>; /* …one variable per key… */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* color.dark */ } }
:root[data-theme="dark"] { /* color.dark again, for the manual toggle */ }
```

If the site uses Tailwind, point the theme at those variables so one token file drives both schemes:

```js
// tailwind.config.js (sketch)
const t = require('../prototypes/tokens/a-ledger.tokens.json');
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: Object.fromEntries(Object.keys(t.color.light).map((k) => [k, `var(--${k})`])),
      borderRadius: { sm: `${t.radius.sm}px`, md: `${t.radius.md}px`, lg: `${t.radius.lg}px` },
      fontFamily: { display: [t.font.display.family, 'serif'], body: [t.font.body.family, 'sans-serif'] },
    },
  },
};
```

To load the fonts, build one Google Fonts `<link>` from the `font.*.googleFonts` values. Each prototype's `<head>` contains the exact URL.
