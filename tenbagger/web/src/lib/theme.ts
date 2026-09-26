/** Turns site.config colors + fonts into CSS custom properties and a Google Fonts URL. */
import site from '../../site.config.ts';

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

function vars(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([k, v]) => `--${kebab(k)}:${v};`)
    .join('');
}

export function themeCss(): string {
  const f = site.fonts;
  const fonts = `--font-display:'${f.display.family}',${f.display.fallback};--font-body:'${f.body.family}',${f.body.fallback};--font-mono:'${f.mono.family}',${f.mono.fallback};`;
  const light = vars(site.colors.light);
  const dark = vars(site.colors.dark);
  return [
    `:root{${fonts}${light}color-scheme:light;}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}color-scheme:dark;}}`,
    `:root[data-theme="dark"]{${dark}color-scheme:dark;}`,
  ].join('\n');
}

export function googleFontsHref(): string {
  const fams = [site.fonts.display, site.fonts.body, site.fonts.mono].map((f) => {
    const name = f.family.trim().replace(/ /g, '+');
    const w = f.weights.split(';').map((x) => x.trim()).filter(Boolean).join(';');
    return `family=${name}:wght@${w}`;
  });
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
}
