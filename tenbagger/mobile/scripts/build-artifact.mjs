// Packs the Expo web export (dist/) into ONE self-contained HTML file that can be
// hosted anywhere, including under an unknown sub-path (e.g. a private preview link):
//  - inlines the JS bundle and every /assets/* file referenced by it as data: URIs
//  - resets the URL path to "/" before the app boots so expo-router starts on Learn
// Usage: npx expo export --platform web && node scripts/build-artifact.mjs [dist] [out.html]
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const out = path.resolve(process.argv[3] ?? 'dist/tenbagger-app.html');
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml' };

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)];
for (const [tag, src] of scripts) {
  let js = fs.readFileSync(path.join(dist, src), 'utf8');
  js = js.replace(/"\/assets\/[^"]+"/g, (q) => {
    const rel = q.slice(1, -1);
    const file = path.join(dist, rel);
    if (!fs.existsSync(file)) return q;
    const type = mime[path.extname(file)] ?? 'application/octet-stream';
    return JSON.stringify(`data:${type};base64,${fs.readFileSync(file).toString('base64')}`);
  });
  // Escape any closing script tag inside the bundle.
  js = js.replace(/<\/script/gi, '<\\/script');
  html = html.replace(tag, () => `<script>${js}</script>`);
}
const shim = `<script>try{if(location.pathname!=='/'){history.replaceState(null,'','/'+location.hash)}}catch(e){}</script>`;
html = html.replace('<head>', `<head>${shim}`).replace(/<link rel="icon"[^>]*>/, '');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB)`);
