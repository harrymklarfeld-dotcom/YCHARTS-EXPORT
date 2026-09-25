// Tiny static server for dist/ (no dependencies). Usage: node scripts/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4321);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.webp': 'image/webp',
};

export function createServer() {
  return http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
    let file = path.join(root, url);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      const notFound = path.join(root, '404.html');
      res.writeHead(404, { 'Content-Type': types['.html'] });
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createServer().listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
}
