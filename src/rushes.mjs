// Rushes vidéo des reels : une sélection Mixkit triée à la main (toujours dispo, gratuite), complétée
// par Pexels et Pixabay (API gratuites, clés PEXELS_API_KEY / PIXABAY_API_KEY) pour varier.
// Les fichiers sont téléchargés une fois dans out/rushes/.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONF = JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'rushes.json'), 'utf8'));
const exclu = (txt) => CONF.exclure.some((m) => String(txt || '').toLowerCase().includes(m));

async function pexels(tag, q) {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];
  for (const base of ['https://api.pexels.com/v1/videos/search', 'https://api.pexels.com/videos/search']) {
    try {
      const res = await fetch(`${base}?query=${encodeURIComponent(q)}&per_page=15&size=medium`, { headers: { Authorization: key }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const { videos = [] } = await res.json();
      return videos.filter((v) => v.duration >= 4 && !exclu(v.url)).map((v) => {
        const f = (v.video_files || []).filter((x) => x.link && x.height >= 1080 && x.height <= 2160).sort((a, b) => a.height - b.height)[0];
        return f && { id: `pexels-${v.id}`, url: f.link, duree: v.duration, tags: [tag] };
      }).filter(Boolean);
    } catch { /* source indisponible */ }
  }
  return [];
}

async function pixabay(tag, q) {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) return [];
  try {
    const res = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(q)}&per_page=20&safesearch=true`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const { hits = [] } = await res.json();
    return hits.filter((h) => h.duration >= 4 && !exclu(h.tags)).map((h) => { const f = h.videos?.large?.url ? h.videos.large : h.videos?.medium; return f?.url && { id: `pixabay-${h.id}`, url: f.url, duree: h.duration, tags: [tag] }; }).filter(Boolean);
  } catch { return []; }
}

const duree = (f) => parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout?.toString()) || 0;

// n rushes variés (au moins 2 par tag si possible), téléchargés et prêts pour montage.mjs.
export async function rassemblerRushes({ n = 12, r = Math.random, log = console.log } = {}) {
  const cands = CONF.mixkit.map((m) => ({ id: `mixkit-${m.id}`, urls: [1080, 720].map((q) => `https://assets.mixkit.co/videos/${m.id}/${m.id}-${q}.mp4`), tags: m.tags }));
  for (const [tag, qs] of Object.entries(CONF.recherches)) {
    const q = qs[Math.floor(r() * qs.length)];
    for (const x of [...await pexels(tag, q), ...await pixabay(tag, q)]) cands.push({ ...x, urls: [x.url] });
  }
  // Mélange, puis on prend en équilibrant les tags.
  const pool = cands.map((c) => [r(), c]).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  const choisis = [];
  for (const tag of ['foule', 'dj', 'potes', 'lumieres']) choisis.push(...pool.filter((c) => c.tags.includes(tag) && !choisis.includes(c)).slice(0, 2));
  for (const c of pool) if (choisis.length < n && !choisis.includes(c)) choisis.push(c);
  const dir = path.join(ROOT, 'out', 'rushes');
  await mkdir(dir, { recursive: true });
  const out = [];
  for (const c of choisis.slice(0, n)) {
    const fichier = path.join(dir, `${c.id}.mp4`);
    if (!existsSync(fichier)) {
      for (const u of c.urls) {
        try { const res = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (res.ok) { await writeFile(fichier, Buffer.from(await res.arrayBuffer())); break; } } catch { /* essai suivant */ }
      }
    }
    const d = existsSync(fichier) ? duree(fichier) : 0;
    if (d >= 3) out.push({ fichier, duree: d, tags: c.tags, source: c.id.split('-')[0] }); else log(`Rush ${c.id} indisponible.`);
  }
  return out;
}
