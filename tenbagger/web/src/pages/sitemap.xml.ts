/** sitemap.xml — every public page, generated from the same data the pages use. */
import type { APIRoute } from 'astro';
import site from '../../site.config.ts';
import { companies, companiesFile, tickerSlug } from '../lib/data.ts';
import { articles } from '../lib/articles.ts';
import { METRIC_CATALOG } from '../../../packages/screener/src/index.ts';

export const GET: APIRoute = () => {
  const dataDate = (companiesFile().generated_at || '').slice(0, 10) || undefined;
  const urls: Array<{ loc: string; lastmod?: string; priority: number }> = [
    { loc: '/', priority: 1 },
    { loc: '/learn/', priority: 0.9 },
    { loc: '/companies/', priority: 0.9 },
    { loc: '/metrics/', priority: 0.8 },
    { loc: '/screener/', priority: 0.8 },
    ...(site.features.showPricing ? [{ loc: '/pricing/', priority: 0.6 }] : []),
    { loc: '/about/', priority: 0.4 },
    { loc: '/legal/disclaimer/', priority: 0.2 },
    { loc: '/legal/privacy/', priority: 0.2 },
    ...articles().map((a) => ({ loc: `/learn/${a.slug}/`, lastmod: a.updated ?? a.date, priority: 0.8 })),
    ...companies().map((c) => ({ loc: `/companies/${tickerSlug(c.ticker)}/`, lastmod: dataDate, priority: 0.7 })),
    ...METRIC_CATALOG.map((m) => ({ loc: `/metrics/${m.key.replace(/_/g, '-')}/`, priority: 0.6 })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${site.url}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority.toFixed(1)}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
