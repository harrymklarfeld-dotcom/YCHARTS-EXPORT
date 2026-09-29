import type { APIRoute } from 'astro';
import site from '../../site.config.ts';
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /app/\n\nSitemap: ${site.url}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain' } });
