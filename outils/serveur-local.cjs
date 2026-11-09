// Serveur local qui imite GitHub Pages (gzip, cache 10 min, page 404) pour tester le site : node outils/serveur-local.cjs
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const R = require('path').resolve(__dirname, '..');
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.ics': 'text/calendar' };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.startsWith('/teufy-instagram/')) p = p.slice(16); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(R, p);
  if (!f.startsWith(R) || !fs.existsSync(f)) { r.writeHead(404, { 'content-type': 'text/html' }); return r.end(fs.readFileSync(R + '/404.html')); }
  const ext = path.extname(f), d = fs.readFileSync(f);
  const h = { 'content-type': T[ext] || 'application/octet-stream', 'cache-control': 'max-age=600' };
  if (/html|css|javascript|json|manifest|calendar/.test(h['content-type']) && /gzip/.test(q.headers['accept-encoding'] || '')) { h['content-encoding'] = 'gzip'; r.writeHead(200, h); return r.end(zlib.gzipSync(d)); }
  r.writeHead(200, h); r.end(d);
}).listen(8765);
