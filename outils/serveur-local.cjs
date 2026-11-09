// Serveur local qui imite GitHub Pages pour tester le site : node outils/serveur-local.cjs   (port 8765)
// Comme GitHub Pages : gzip, cache 10 min, page 404, redirection d'un dossier vers « dossier/ », lecture des vidéos
// par morceaux (en-tête Range, indispensable à Safari). Une erreur de fichier ne fait jamais tomber le serveur.
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const R = path.resolve(__dirname, '..');
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webmanifest': 'application/manifest+json', '.ics': 'text/calendar', '.xml': 'application/xml', '.txt': 'text/plain' };
const page404 = (r) => { r.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); try { r.end(fs.readFileSync(path.join(R, '404.html'))); } catch { r.end('404'); } };

http.createServer((q, r) => {
  try {
    const brut = q.url.split('?')[0];
    let p = decodeURIComponent(brut);
    if (p.startsWith('/teufy-instagram/')) p = p.slice(16);
    let f = path.join(R, p);
    if (!f.startsWith(R)) return page404(r);
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
      if (!brut.endsWith('/')) { r.writeHead(301, { location: `${brut}/${q.url.slice(brut.length)}` }); return r.end(); }
      f = path.join(f, 'index.html');
    }
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return page404(r);
    const ext = path.extname(f);
    const h = { 'content-type': T[ext] || 'application/octet-stream', 'cache-control': 'max-age=600', 'accept-ranges': 'bytes' };
    const taille = fs.statSync(f).size;
    const plage = /^bytes=(\d*)-(\d*)$/.exec(q.headers.range || '');
    if (plage && (ext === '.mp4' || ext === '.webm')) {
      const debut = plage[1] ? +plage[1] : Math.max(0, taille - +plage[2]);
      const fin = plage[1] && plage[2] ? Math.min(+plage[2], taille - 1) : taille - 1;
      if (debut >= taille || debut > fin) { r.writeHead(416, { 'content-range': `bytes */${taille}` }); return r.end(); }
      r.writeHead(206, { ...h, 'content-range': `bytes ${debut}-${fin}/${taille}`, 'content-length': fin - debut + 1 });
      return fs.createReadStream(f, { start: debut, end: fin }).pipe(r);
    }
    const d = fs.readFileSync(f);
    if (/html|css|javascript|json|manifest|calendar|xml|plain/.test(h['content-type']) && /gzip/.test(q.headers['accept-encoding'] || '')) { h['content-encoding'] = 'gzip'; r.writeHead(200, h); return r.end(zlib.gzipSync(d)); }
    r.writeHead(200, { ...h, 'content-length': d.length }); r.end(d);
  } catch (err) {
    if (!r.headersSent) { r.writeHead(500, { 'content-type': 'text/plain' }); r.end('erreur'); }
  }
}).listen(8765);
