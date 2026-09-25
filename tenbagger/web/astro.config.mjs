// Astro configuration. Most things you want to change live in site.config.ts instead.
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import site from './site.config.ts';

const tenbaggerRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: {
    // Allow importing the shared engines in ../packages (screener, money) and data in ../data.
    server: { fs: { allow: [tenbaggerRoot] } },
  },
});
