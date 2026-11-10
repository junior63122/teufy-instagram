// Signale à IndexNow (Bing, Yandex, Seznam, Naver… ; Bing alimente aussi la recherche de ChatGPT) toutes les pages du sitemap,
// pour qu'elles soient explorées sans attendre. Lancé après la publication du site (workflow). Clé publique : config.site.indexnow_cle.
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const cle = config.site?.indexnow_cle;
if (!cle) { console.log('IndexNow : pas de clé, rien envoyé.'); process.exit(0); }
const urls = [...readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const host = new URL(urls[0]).host;
for (let i = 0; i < urls.length; i += 10000) {
  const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: cle, keyLocation: `https://${host}/${cle}.txt`, urlList: urls.slice(i, i + 10000) }) }).catch((e) => ({ status: e.message }));
  console.log(`IndexNow : ${urls.slice(i, i + 10000).length} page(s) envoyée(s) → réponse ${r.status}${r.status === 200 || r.status === 202 ? ' (acceptées)' : ''}`);
}
