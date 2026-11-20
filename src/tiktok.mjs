// Planning TikTok (20/11/2026, directeur : « je posterai moi-même les TikTok, 1 à 2 par jour ; un endroit facile où je
// comprends directement quelle vidéo poster et à quelle heure »).
// Chaque jour (avec la mise à jour du site) : les vidéos prêtes (Tague ton pote, spots promo, reels Instagram déjà publiés,
// archivés ici dès qu'ils sortent) sont réparties sur les 7 prochains jours, 2 créneaux espacés (12 h 30 et 19 h 30),
// jamais la même vidéo deux fois en 14 jours, jamais deux vidéos du même type le même jour. Page cachée /tiktok/
// (non référencée) : jour, heure, vidéo, bouton Télécharger, bouton Copier la légende.
import { readFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(ROOT, 'contenus', 'tiktok.json');
const STOCK = path.join(ROOT, 'media', 'tiktok');
export const CRENEAUX = ['12:30', '19:30'];
const ECART_JOURS = 14;
const lire = (f, d) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d; } catch { return d; } };
const jourParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
const plusJours = (j, n) => new Date(Date.parse(`${j}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const EMOJI = /(\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}\u{200D}])/gu;

/** Légende TikTok : l'accroche et l'essentiel de la légende Instagram, sans emoji ni @compte Instagram, 5 hashtags. */
export function legendeTiktok(texte, type) {
  const lignes = String(texte || '').replace(EMOJI, '').split('\n').map((l) => l.trim())
    .filter((l) => l && !/^#/.test(l) && !/abonne-toi|lien en bio|teufyparty\.com/i.test(l)).map((l) => l.replace(/@[\w.]+/g, '').replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
  const corps = lignes.slice(0, type === 'tague' ? 6 : 3).join('\n');
  const tags = type === 'tague' ? '#tagueTonPote #soiree #nice #cotedazur #fyp' : '#soiree #nice #cotedazur #sortiranice #fyp';
  return `${corps}\n\nToutes les soirées de la Côte : teufyparty.com (lien en bio)\n\n${tags}`;
}

/** Vidéos disponibles. Les reels Instagram publiés (media/reel-*) sont copiés dans media/tiktok/ dès qu'ils apparaissent. */
export function stockVideos(root = ROOT) {
  const out = [];
  const ajoute = (fichier, type, texte) => {
    const id = path.basename(fichier, '.mp4');
    const couv = path.join(root, 'media', 'tiktok', 'couvertures', `${id}.jpg`); // couverture dans la charte (directeur, 20/11/2026)
    out.push({ id, video: path.relative(root, fichier).split(path.sep).join('/'), type, legende: legendeTiktok(texte, type), ...(existsSync(couv) ? { couverture: `media/tiktok/couvertures/${id}.jpg` } : {}) });
  };
  for (const [dossier, type] of [['tague-ton-pote', 'tague'], ['spot-promo', 'spot']]) {
    const d = path.join(root, 'media', dossier);
    for (const f of existsSync(d) ? readdirSync(d).filter((x) => x.endsWith('.mp4')).sort() : []) {
      const txt = path.join(d, f.replace(/\.mp4$/, '.txt'));
      ajoute(path.join(d, f), type, existsSync(txt) ? readFileSync(txt, 'utf8') : '');
    }
  }
  const s = path.join(root, 'media', 'tiktok');
  for (const f of existsSync(s) ? readdirSync(s).filter((x) => x.endsWith('.mp4')).sort() : []) {
    const txt = path.join(s, f.replace(/\.mp4$/, '.txt'));
    ajoute(path.join(s, f), 'reel', existsSync(txt) ? readFileSync(txt, 'utf8') : '');
  }
  return out;
}

// Reels Instagram déjà publiés : archivés (les dossiers media/reel-* sont écrasés à chaque nouveau reel). Pas le Grand Débat
// en dessin animé (0 like) ni le spot promo (déjà dans media/spot-promo).
export function archiverReels(root = ROOT) {
  const m = path.join(root, 'media');
  const dest = path.join(root, 'media', 'tiktok');
  let n = 0;
  for (const d of existsSync(m) ? readdirSync(m).filter((x) => /^reel-/.test(x) && !/grand-debat|spot-promo|serie-nuit/.test(x)) : []) {
    for (const f of readdirSync(path.join(m, d)).filter((x) => /^reel-\d{4}-\d{2}-\d{2}\.mp4$/.test(x))) {
      const nom = `${d.replace(/^reel-/, '')}-${f.slice(5, 15)}`;
      if (existsSync(path.join(dest, `${nom}.mp4`))) continue;
      mkdirSync(dest, { recursive: true });
      copyFileSync(path.join(m, d, f), path.join(dest, `${nom}.mp4`));
      const c = path.join(m, d, f.replace(/\.mp4$/, '-couverture.jpg'));
      if (existsSync(c)) { mkdirSync(path.join(dest, 'couvertures'), { recursive: true }); copyFileSync(c, path.join(dest, 'couvertures', `${nom}.jpg`)); }
      const leg = path.join(m, d, 'legende.txt');
      writeFileSync(path.join(dest, `${nom}.txt`), existsSync(leg) ? readFileSync(leg, 'utf8') : '');
      n++;
    }
  }
  return n;
}

/** Répartit le stock sur les `jours` prochains jours ; les jours déjà planifiés ne bougent pas. */
export function planifier(plan, stock, aujourdhui, jours = 7, heureMin = '00:00') {
  const P = { ...plan };
  const dernier = (id) => Object.entries(P).filter(([, l]) => l.some((x) => x.id === id)).map(([j]) => j).sort().at(-1);
  const age = (id, j) => { const d = dernier(id); return d ? (Date.parse(j) - Date.parse(d)) / 864e5 : Infinity; };
  for (let k = 0; k < jours; k++) {
    const j = plusJours(aujourdhui, k);
    if (P[j]?.length) continue;
    const pris = [];
    for (const heure of CRENEAUX) {
      if (k === 0 && heure < heureMin) continue; // créneau d'aujourd'hui déjà passé
      const libres = stock.filter((v) => age(v.id, j) >= ECART_JOURS && !pris.some((p) => p.type === v.type && v.type !== 'reel') && !pris.some((p) => p.id === v.id))
        .sort((a, b) => age(b.id, j) - age(a.id, j) || a.id.localeCompare(b.id));
      // Stock trop court pour 2 vidéos : une seule, le soir (le créneau le plus regardé).
      if (!libres.length) continue;
      pris.push({ ...libres[0], heure });
    }
    if (pris.length === 1 && (k > 0 || CRENEAUX.at(-1) >= heureMin)) pris[0].heure = CRENEAUX.at(-1);
    P[j] = pris;
  }
  return P;
}

// Code d'accès (20/11/2026, directeur : « protège la page avec un code ») : le site est statique et public, donc le contenu
// (planning, légendes, liens des vidéos) est chiffré (AES-256-GCM, clé tirée du code par PBKDF2) avec le code du secret GitHub
// TIKTOK_CODE ; le navigateur le déchiffre une fois le bon code tapé. Sans secret : page fermée, rien n'est publié.
function verrou(code, html) {
  if (!code) return '<p class="i">Page fermée : le code d\'accès n\'est pas encore défini.</p>';
  const sel = randomBytes(16), iv = randomBytes(12);
  const cle = pbkdf2Sync(String(code), sel, 210000, 32, 'sha256');
  const c = createCipheriv('aes-256-gcm', cle, iv);
  const donnees = Buffer.concat([c.update(html, 'utf8'), c.final(), c.getAuthTag()]);
  return `<form id="verrou" data-sel="${sel.toString('base64')}" data-iv="${iv.toString('base64')}" data-d="${donnees.toString('base64')}"><p class="i">Page réservée à l'équipe Teufy.</p>
<input id="code" type="password" autocomplete="current-password" placeholder="Code d'accès" style="width:100%;padding:14px;border-radius:10px;border:1px solid #ffffff33;background:#16161C;color:#F4EFE6;font-size:17px">
<button class="btn" style="width:100%;margin-top:10px">Ouvrir</button><p id="err" class="sans" style="color:#FF5A3C"></p></form>`;
}
const DECHIFFRE = `const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function ouvrir(code,garder){const f=document.getElementById('verrou');if(!f)return;try{
const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveKey']);
const cle=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(f.dataset.sel),iterations:210000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['decrypt']);
const t=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(f.dataset.iv)},cle,b64(f.dataset.d));
document.getElementById('contenu').innerHTML=new TextDecoder().decode(t);if(garder)try{localStorage.setItem('tiktok:code',code)}catch{}activer();
}catch{try{localStorage.removeItem('tiktok:code')}catch{}const e=document.getElementById('err');if(e)e.textContent=garder?'Code incorrect.':''}}
document.addEventListener('submit',ev=>{if(ev.target.id==='verrou'){ev.preventDefault();ouvrir(document.getElementById('code').value,true)}});
try{const c=localStorage.getItem('tiktok:code');if(c)ouvrir(c,false)}catch{}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function pageTiktok(plan, aujourdhui, code = process.env.TIKTOK_CODE) {
  const date = (j) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(`${j}T12:00:00Z`));
  const jours = Object.keys(plan).filter((j) => j >= aujourdhui).sort().slice(0, 7);
  const carte = (j, v) => `<article class="v" data-cle="${esc(`${j}|${v.id}`)}">
   <p class="h">${esc(v.heure.replace(':', ' h '))}<span>${esc({ tague: 'Tague ton pote', spot: 'Spot Teufy', reel: 'Réel' }[v.type] || '')}</span></p>
   <video src="../${esc(v.video)}" controls preload="none" playsinline${v.couverture ? ` poster="../${esc(v.couverture)}"` : ''}></video>
   <div class="b"><a class="btn" href="../${esc(v.video)}" download="teufy-${esc(j)}-${esc(v.heure.replace(':', 'h'))}.mp4">Télécharger la vidéo</a>
   <button class="btn" data-copie>Copier la légende</button></div>
   ${v.couverture ? `<div class="b"><a class="btn sec" href="../${esc(v.couverture)}" download="teufy-${esc(j)}-${esc(v.heure.replace(':', 'h'))}-couverture.jpg">Télécharger la couverture</a></div>` : '<p class="sans">Pas de couverture : choisis une image de la vidéo.</p>'}
   <textarea readonly rows="7">${esc(v.legende)}</textarea>
   <label class="fait"><input type="checkbox"> Publié</label>
  </article>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Planning TikTok · Teufy</title>
<style>:root{--nuit:#0B0B0F;--creme:#F4EFE6;--corail:#FF5A3C;--live:#3DFF8A}*{box-sizing:border-box}body{margin:0;background:var(--nuit);color:var(--creme);font:16px/1.4 system-ui,sans-serif;padding:16px;max-width:760px;margin:auto}
h1{font-size:28px;margin:8px 0 4px}p.i{opacity:.8;margin:0 0 20px}h2{font-size:20px;margin:28px 0 10px;text-transform:capitalize}h2.auj{color:var(--corail)}
.v{background:#16161C;border:1px solid #ffffff22;border-radius:16px;padding:14px;margin-bottom:14px}.v.ok{opacity:.45}
.h{display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;font-size:22px;font-weight:800}.h span{font-size:13px;font-weight:700;background:var(--corail);color:var(--nuit);padding:3px 10px;border-radius:999px}
video{width:100%;max-height:60vh;border-radius:10px;background:#000}.b{display:flex;gap:8px;margin:10px 0}.btn{flex:1;text-align:center;background:var(--creme);color:var(--nuit);font-weight:800;border:0;border-radius:10px;padding:12px;text-decoration:none;font-size:15px;cursor:pointer}
textarea{width:100%;background:#0B0B0F;color:var(--creme);border:1px solid #ffffff22;border-radius:10px;padding:10px;font:14px/1.4 system-ui}.fait{display:block;margin-top:8px;font-weight:700}.btn.sec{background:transparent;color:var(--creme);border:2px solid var(--creme)}.sans{opacity:.7;font-size:14px}</style></head><body>
<h1>Planning TikTok</h1>
<div id="contenu">${verrou(code, `<p class="i">Une vidéo par créneau : télécharge-la, ajoute un son tendance de TikTok à volume bas, colle la légende, mets la couverture (Modifier la couverture, puis Importer), publie à l'heure indiquée. Coche « Publié » une fois fait.</p>
${jours.map((j) => `<h2${j === aujourdhui ? ' class="auj"' : ''}>${j === aujourdhui ? "Aujourd'hui · " : ''}${esc(date(j))}</h2>\n${plan[j].map((v) => carte(j, v)).join('\n')}`).join('\n')}`)}</div>
<script>
${DECHIFFRE}
function activer(){
document.querySelectorAll('[data-copie]').forEach(b=>b.onclick=async()=>{const t=b.closest('.v').querySelector('textarea');try{await navigator.clipboard.writeText(t.value)}catch{t.select();document.execCommand('copy')}b.textContent='Copiée';setTimeout(()=>b.textContent='Copier la légende',1500)});
document.querySelectorAll('.v').forEach(v=>{const c=v.querySelector('.fait input'),k='tiktok:'+v.dataset.cle;try{c.checked=localStorage.getItem(k)==='1'}catch{}v.classList.toggle('ok',c.checked);c.onchange=()=>{try{localStorage.setItem(k,c.checked?'1':'0')}catch{}v.classList.toggle('ok',c.checked)}});}
if(!document.getElementById('verrou'))activer();
</script></body></html>
`;
}

/** Met à jour le stock, le planning (contenus/tiktok.json) et la page tiktok/index.html. */
export function construireTiktok({ now = new Date(), root = ROOT, log = console.log } = {}) {
  const n = archiverReels(root);
  const auj0 = jourParis(now);
  const etat0 = lire(path.join(root, 'contenus', 'tiktok.json'), {});
  const auj = etat0.debut && etat0.debut > auj0 ? etat0.debut : auj0; // début choisi par le directeur (lundi 23/11/2026)
  const f = path.join(root, 'contenus', 'tiktok.json');
  const etat = lire(f, { _note: 'Planning TikTok (src/tiktok.mjs) : le directeur publie lui-même, page /tiktok/.', plan: {} });
  // On garde 30 jours d'historique (pour ne pas reposter trop tôt la même vidéo).
  if (auj !== auj0) for (const j of Object.keys(etat.plan || {})) if (j >= auj0 && j < auj) delete etat.plan[j]; // rien de planifié avant le début
  const hm = auj !== auj0 ? '00:00' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now.getTime() + 15 * 60e3));
  etat.plan = Object.fromEntries(Object.entries(planifier(etat.plan || {}, stockVideos(root), auj, 7, hm)).filter(([j]) => j >= plusJours(auj, -30)));
  writeFileSync(f, JSON.stringify(etat, null, 1) + '\n');
  mkdirSync(path.join(root, 'tiktok'), { recursive: true });
  writeFileSync(path.join(root, 'tiktok', 'index.html'), pageTiktok(etat.plan, auj0));
  const aVenir = Object.entries(etat.plan).filter(([j]) => j >= auj);
  log(`TikTok : ${n} reel(s) archivé(s), ${aVenir.reduce((s, [, l]) => s + l.length, 0)} vidéo(s) planifiée(s) sur ${aVenir.length} jour(s).`);
  return etat;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) construireTiktok();
