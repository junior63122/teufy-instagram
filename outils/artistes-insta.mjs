#!/usr/bin/env node
// Fiches artistes à partir de leur compte Instagram VÉRIFIÉ — sans IA (12/11/2026, demande du directeur : « pour les
// artistes et les DJ, mets leur photo, leur description, le type de musique… là ça ne donne pas envie »).
// 1. Artistes des soirées à venir : comptes Instagram confirmés (outils/verifier-comptes.mjs) dont le nom figure dans le
//    TITRE de la soirée, qui ne sont ni le lieu ni un organisateur (club, bar, hôtel, agence, collectif…) et dont la bio
//    parle de musique ; plus les artistes saisis à la main (line-up) dont un compte au nom exact est confirmé par l'API.
// 2. Pour chacun (API officielle, gratuite) : photo de profil, photo la plus aimée de ses posts récents, bio, abonnés.
// 3. Résultat : contenus/artistes-insta.json + site/artistes/<slug>-avatar.jpg, <slug>.jpg (et .webp).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { igConfig, businessDiscovery } from '../src/instagram.mjs';
import { correspond } from '../src/comptes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const sa = (x) => String(x || '').normalize('NFKC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (x) => sa(x).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const MUSIQUE = /\b(dj|producer|productrice|producteur|produc|music|musique|techno|trance|psy|house|rap|rappeur|rappeuse|singer|chanteu|artist|artiste|booking|label|live|band|groupe|spotify|tour|tourn[eé]e|album|remix|beatmaker|selector|vinyl)/i;
const PAS_ARTISTE = /(\bclub\b|\bbar\b|restaurant|h[oô]tel|casino|resort|soci[eé]t[eé]|\bevents?\b|agence|collectif|festival|brasserie|auberge|[eé]ph[eé]m[eè]re|tiers.lieu|billetterie|discoth[eè]que|night ?club|rooftop|beach)/i;
const MAX = Number(process.env.MAX_ARTISTES || 40);
const ig = igConfig();
const now = Date.now();
const cache = lire('contenus/comptes-verifies.json', {});
const lieux = new Set(Object.values(lire('contenus/comptes-lieux.json', {})));
const corr = lire('contenus/comptes-corrections.json', { comptes: {} }).comptes || {};
const sortie = lire('contenus/artistes-insta.json', {});
const evts = [...(lire('evenements-web.json', {}).evenements || []), ...lire('evenements-manuels.json', [])]
  .filter((e) => e.start && Date.parse(e.start) > now - 6 * 3600e3 && Date.parse(e.start) < now + 60 * 864e5);

// Nom affiché : celui du compte, nettoyé (lettres décoratives, emojis, « official ») ; s'il est illisible, le passage du
// titre de la soirée qui correspond au pseudo (« selahsueOFFICIAL » → « Selah Sue »).
function nomPropre(h, fiche, titre) {
  let n = String(fiche?.nom || '').normalize('NFKC').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}‍️]/gu, '').replace(/\b(official|officiel|officiel·le|music|musique)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (/^[\p{Lu}\s.&'-]+$/u.test(n) && n.replace(/\s/g, '').length > 3) n = n.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()); // « CUT KILLER » → « Cut Killer »
  const cle = sa(h).replace(/[^a-z]/g, '').replace(/(official|officiel|music|musique|dj)$/g, '').replace(/^dj/, '');
  const mots = String(titre || '').split(/[^\p{L}\p{N}'.-]+/u).filter(Boolean);
  for (let i = 0; i < mots.length; i++) for (let j = i + 1; j <= Math.min(mots.length, i + 4); j++) {
    const bout = mots.slice(i, j).join(' ');
    if (sa(bout).replace(/[^a-z]/g, '') === cle) return /^[\p{Lu}\s.&'-]+$/u.test(bout) ? bout.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()) : bout;
  }
  if (!n || (!/\s/.test(n) && n === n.toLowerCase())) return n || h;
  return n;
}

// --- 1. Candidats ---------------------------------------------------------------------------------------------
const candidats = new Map(); // compte → { titre, soirees: [cle] }
const cleSoiree = (e) => `${e.name}|${new Date(e.start).toISOString()}`;
for (const e of evts) {
  for (const brut of e.instagram || []) {
    const h = sa(corr[sa(brut)] || brut).replace(/^@/, '');
    const x = cache[h];
    if (!x?.ok || lieux.has(h)) continue;
    if (!correspond(h, x, [e.name])) continue;            // nommé dans le titre de la soirée
    if (e.venue && correspond(h, x, [e.venue])) continue; // c'est le lieu
    if (PAS_ARTISTE.test(`${x.nom} ${x.bio}`) || !MUSIQUE.test(`${x.nom} ${x.bio}`)) continue;
    const c = candidats.get(h) || { titre: e.name, soirees: [] };
    c.soirees.push(cleSoiree(e)); candidats.set(h, c);
  }
}
// Artistes du line-up saisis par l'équipe : compte au nom exact, confirmé par l'API, bio musicale.
const variantes = (nom) => { const b = sa(nom).replace(/[^a-z0-9 ]/g, '').trim(); const j = b.replace(/\s+/g, ''), s = b.replace(/\s+/g, '_');
  return [...new Set([j, s, `${j}_music`, `${j}music`, `${j}_dj`, `${j}dj`, `dj${j}`, `dj_${j}`, `${j}.music`, `${j}_off`, `${j}officiel`, `${j}_officiel`])].filter((x) => x.length >= 3); };
let appels = 0, limite = false, erreurs = 0;
async function lireCompte(h) {
  if (limite || appels >= MAX || !ig) return null;
  appels++;
  try { return await businessDiscovery(h, ig); } catch (err) { if (erreurs++ < 3) console.log(`Instagram @${h} : ${String(err.message).slice(0, 160)}`); if (/rate|limit|\(#4\)|\(#32\)|\(#17\)/i.test(err.message)) limite = true; return null; }
}
for (const e of evts) for (const nom of e.artistes || []) {
  if (typeof nom !== 'string' || [...candidats.values()].some((c) => c.nomManuel === nom)) continue;
  const deja = Object.entries(sortie).find(([, a]) => a.nom === nom);
  if (deja) { const c = candidats.get(deja[1].compte) || { titre: nom, soirees: [], nomManuel: nom }; c.soirees.push(cleSoiree(e)); candidats.set(deja[1].compte, c); continue; }
  for (const h of variantes(nom)) {
    if (limite || appels >= MAX) break;
    const bd = await lireCompte(h);
    if (!bd?.username) continue;
    const fiche = { nom: bd.name || '', bio: String(bd.biography || '') };
    if (!correspond(h, fiche, [nom]) || !MUSIQUE.test(`${fiche.nom} ${fiche.bio}`) || PAS_ARTISTE.test(`${fiche.nom} ${fiche.bio}`)) continue;
    cache[h] = { ok: true, nom: fiche.nom, bio: fiche.bio.slice(0, 300), site: bd.website || '', abonnes: bd.followers_count ?? null, le: new Date().toISOString() };
    const c = candidats.get(h) || { titre: nom, soirees: [], nomManuel: nom }; c.soirees.push(cleSoiree(e)); candidats.set(h, c);
    break;
  }
}

// --- 2. Photos, bio, abonnés -----------------------------------------------------------------------------------
mkdirSync(path.join(ROOT, 'site', 'artistes'), { recursive: true });
async function telecharger(url, f, largeur) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) return false; const tmp = `${f}.src`; writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', `scale='min(${largeur},iw)':-2`, '-q:v', '3', f]); spawnSync('rm', ['-f', tmp]);
    if (c.status !== 0) { console.log(`ffmpeg indisponible ou image illisible pour ${path.basename(f)}`); return false; }
    for (const l of [320, 800]) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale='min(${l},iw)':-2`, '-c:v', 'libwebp', '-quality', '80', f.replace(/\.jpg$/, `-${l}.webp`)]);
    return true; } catch { return false; }
}
let n = 0;
for (const [h, c] of candidats) {
  const fiche = cache[h];
  const nom = c.nomManuel || nomPropre(h, fiche, c.titre);
  const s = slug(nom);
  const ancien = sortie[s];
  const frais = ancien && now - Date.parse(ancien.le || 0) < 7 * 864e5 && (ancien.photo || ancien.avatar);
  const A = { ...(ancien || {}), nom, compte: h, bio: fiche?.bio || '', abonnes: fiche?.abonnes ?? null, soirees: [...new Set(c.soirees)] };
  if (!frais) {
    const bd = await lireCompte(h);
    if (!bd?.username) console.log(`Artiste ${nom} (@${h}) : compte non lu${limite ? ' (limite Instagram atteinte)' : ''}.`);
    if (bd?.username) {
      A.bio = String(bd.biography || A.bio).slice(0, 400); A.abonnes = bd.followers_count ?? A.abonnes; A.site = bd.website || '';
      const fa = path.join(ROOT, 'site', 'artistes', `${s}-avatar.jpg`);
      if (bd.profile_picture_url && await telecharger(bd.profile_picture_url, fa, 320)) A.avatar = path.relative(ROOT, fa);
      const photos = (bd.media?.data || []).filter((m) => m.media_url && m.media_type !== 'VIDEO').sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      const fp = path.join(ROOT, 'site', 'artistes', `${s}.jpg`);
      if (photos[0] && await telecharger(photos[0].media_url, fp, 1080)) A.photo = path.relative(ROOT, fp);
      A.le = new Date().toISOString(); n++;
    }
  }
  sortie[s] = A;
}
writeFileSync(path.join(ROOT, 'contenus', 'artistes-insta.json'), `${JSON.stringify(sortie, null, 1)}\n`);
writeFileSync(path.join(ROOT, 'contenus', 'comptes-verifies.json'), `${JSON.stringify(cache, null, 1)}\n`);
console.log(`Artistes : ${candidats.size} artiste(s) avec compte Instagram vérifié, ${n} fiche(s) mise(s) à jour (photo, bio), ${appels} lecture(s) Instagram.`);
