// Banque de médias gratuits pour les reels « choc » (13/11/2026, directeur : « des vraies vidéos de club de folie,
// des bruitages, une baffe à chaque seconde »). Catalogue seulement (liens) : contenus/banque-medias.json.
// Les fichiers sont téléchargés au moment du rendu dans .cache/banque (jamais dans le dépôt : les licences Mixkit et
// Coverr autorisent l'usage commercial dans nos vidéos, pas la redistribution des fichiers bruts).
//   node outils/banque-medias.mjs            → met à jour le catalogue
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(ROOT, 'contenus', 'banque-medias.json');
const get = (u) => { try { return execFileSync('curl', ['-sL', '--max-time', '30', '-A', 'TeufyBot/1.0 (+https://teufyparty.com)', u], { maxBuffer: 64 << 20 }).toString(); } catch { return ''; } };
const pause = () => execFileSync('sleep', ['0.6']);

// Thèmes : ce qui fait « soirée de folie » (foule, lasers, DJ, potes, verres, nuit en ville, confettis…).
const THEMES = ['nightclub', 'party', 'dj', 'concert', 'dance', 'disco', 'neon', 'laser', 'festival', 'crowd', 'friends', 'celebration', 'cocktail', 'bar', 'night-city', 'confetti', 'fireworks', 'drinks', 'rave', 'music', 'vertical'];
const titreDe = (slug) => slug.replace(/-\d+$/, '').replace(/-/g, ' ');
const videos = new Map();
for (const t of THEMES) {
  for (let p = 1; p <= (t === 'vertical' ? 8 : 3); p++) {
    const h = get(`https://mixkit.co/free-stock-video/discover/${t}/${p > 1 ? `?page=${p}` : ''}`); pause();
    const ids = [...new Set([...h.matchAll(/href="\/free-stock-video\/([a-z0-9-]+-(\d+))\/"/g)].map((m) => m[1]))];
    if (!ids.length) break;
    for (const s of ids) {
      const id = s.match(/(\d+)$/)[1];
      const v = videos.get(id) || { id, source: 'mixkit', titre: titreDe(s), page: `https://mixkit.co/free-stock-video/${s}/`, mp4: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`, themes: [] };
      if (!v.themes.includes(t)) v.themes.push(t);
      videos.set(id, v);
    }
  }
}
// Garde ce qui ressemble à une soirée (les thèmes larges ramènent aussi des paysages, des bureaux…).
const SOIREE = /club|party|danc|dj|concert|crowd|neon|laser|light|drink|cheer|toast|festival|night|bar|friend|celebrat|confetti|firework|rave|music|stage|cocktail|disco|singing|jump|smok|spark|champagne|glass|disco|mirror ball|turntable|fun|laugh|selfie|people/i;
const HORS = /office|business|kitchen|baby|child|kid|hospital|doctor|cow|farm|laptop|meeting|yoga|wedding cake/i;
const accessible = (u) => { try { return execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-r', '0-100', '--max-time', '15', '-e', 'https://mixkit.co/', u]).toString().startsWith('20'); } catch { return false; } };
// Seulement les vidéos réellement téléchargeables (certaines récentes renvoient 403).
const listeVideos = [...videos.values()].filter((v) => SOIREE.test(v.titre) && !HORS.test(v.titre) && accessible(v.mp4)).map((v) => ({ ...v, vertical: v.themes.includes('vertical') }));

// Bruitages (aperçus mp3 complets) et musiques.
const sons = [];
for (const [t, pages] of [['whoosh', 2], ['transition', 2], ['impact', 2], ['swoosh', 1], ['riser', 1], ['glitch', 1], ['bass', 1], ['crowd', 2], ['cheering', 1], ['applause', 1], ['notification', 1], ['camera', 1], ['record', 1], ['drop', 1], ['boom', 1], ['pop', 1], ['laugh', 1], ['party', 1], ['scratch', 1], ['cash', 1]]) {
  for (let p = 1; p <= pages; p++) {
    const h = get(`https://mixkit.co/free-sound-effects/${t}/${p > 1 ? `?page=${p}` : ''}`); pause();
    for (const m of h.matchAll(/https:\/\/assets\.mixkit\.co\/active_storage\/sfx\/(\d+)\/\1-preview\.mp3/g)) if (!sons.some((s) => s.id === m[1])) sons.push({ id: m[1], type: t, mp3: m[0] });
  }
}
const musiques = [];
for (const t of ['edm', 'house', 'hip-hop', 'party', 'dance', 'club', 'electro', 'techno', 'trap', 'deep-house']) {
  const h = get(`https://mixkit.co/free-stock-music/tag/${t}/`); pause();
  for (const m of h.matchAll(/https:\/\/assets\.mixkit\.co\/music\/(\d+)\/\1\.mp3/g)) if (!musiques.some((s) => s.id === m[1])) musiques.push({ id: m[1], style: t, mp3: m[0] });
}
const ancien = existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')) : {};
const out = { maj: new Date().toISOString(), licences: { mixkit: 'https://mixkit.co/license/ (usage commercial gratuit, pas de redistribution des fichiers bruts)' }, videos: listeVideos, sons, musiques, notes: ancien.notes || {} };
writeFileSync(SORTIE, JSON.stringify(out, null, 1) + '\n');
console.log(`Banque : ${listeVideos.length} vidéos (${listeVideos.filter((v) => v.vertical).length} verticales), ${sons.length} bruitages, ${musiques.length} musiques.`);
