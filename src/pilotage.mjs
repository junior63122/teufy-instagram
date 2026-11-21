// Tableau de bord du directeur (21/11/2026, directeur : « la vision d'ensemble de qui fait quoi derrière le mot de passe,
// comme pour la page TikTok : un tableau de bord utilisable pour faire 2-3 choses rapidement, voir les données du site et le
// back-office sans devoir te demander à chaque fois quel est le planning »). Page cachée /pilotage/, même code que /tiktok/
// (secret TIKTOK_CODE) : tout le contenu est chiffré dans la page, rien n'est lisible sans le code.
// Données relues à chaque passage des robots (fichiers de contenus/) : rien n'est inventé, une donnée absente est dite absente.
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verrou, DECHIFFRE } from './tiktok.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPOT = 'https://github.com/junior63122/teufy-instagram';
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const quand = (iso) => { const t = Date.parse(iso); if (!t) return 'jamais relevé';
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(t)); };
const depuis = (iso, now) => { const t = Date.parse(iso); if (!t) return Infinity; return (now - t) / 3600e3; };
const jourParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

// Ce que fait chaque robot et quand (heures de Paris, heure d'hiver), relevé dans les workflows le 21/11/2026.
// « fichier » + « champ » : la trace laissée par son dernier passage ; « max » : au-delà (en heures), il est signalé en retard.
const ROBOTS = [
  { nom: 'Instagram automatique', quand: 'chaque heure, 16 h → 23 h', role: 'posts, réels, stories, relecture sur Instagram, auto-contrôle', fichier: 'contenus/controle-publication.json', trace: (j) => j?.jours?.at(-1)?.le, max: 26 },
  { nom: 'Veille et actus', quand: 'toutes les 30 min, 8 h → 2 h', role: 'annonces, actus du site, recherche web, reconstruction du site', fichier: 'contenus/veille-vus.json', trace: (j) => j?._dernier_passage, max: 8 },
  { nom: 'Lieux (photos, carte)', quand: '5 h 37, 13 h 37, 17 h 37', role: 'affiches et photos des lieux, carte, transports, annuaire', fichier: 'contenus/soirees-sans-image.json', trace: (j) => j?.le, max: 14 },
  { nom: 'Veille technique + sauvegarde', quand: '6 h 17', role: 'versions des outils, billetteries, infos manquantes, sauvegarde du jour', fichier: 'contenus/veille-technique.json', trace: (j) => j?.le, max: 30 },
];
const CLAUDE = [
  ['Chaque jour 7 h 47', 'veille quotidienne : annonces officielles, réparations, VEILLE.md'],
  ['Chaque jour 19 h 52', 'contrôle des publications du jour, réparation si besoin'],
  ['Mardi et vendredi 11 h 13', 'chiffres, concurrents, planning Instagram'],
  ['Lundi 10 h 41', 'veille hebdomadaire + audit (site ou parcours clients et robots, en alternance)'],
];
const SEMAINE = [
  ['Lundi', 'format libre (celui qui marche le mieux)', 'tendance'], ['Mardi', 'bon plan (petits prix ou à réserver)', '« Tague ton pote »'],
  ['Mercredi', '—', 'promo de Teufy'], ['Jeudi', 'incontournables techno / Tekno', 'viral'], ['Vendredi', 'incontournables du week-end + story débat', '—'],
  ['Samedi', '—', 'promo de Teufy'], ['Dimanche', '—', '—'],
];
const STORIES = '16 h soirées de ce soir · 17 h astuce (mar., mer., dim.) · 18 h offre partenaire ou repost · 19 h appel à vos vidéos (lundi) · 20 h question du jour · 22 h coup de cœur (jeu., ven., sam.)';

export function donneesPilotage({ root = ROOT, now = new Date() } = {}) {
  const f = (r) => lire(path.join(root, r), null);
  const controle = f('contenus/controle-publication.json');
  const sansImg = f('contenus/soirees-sans-image.json');
  const vt = f('contenus/veille-technique.json');
  const budget = f('contenus/budget-ia.json');
  const actus = f('contenus/actus.json') || [];
  const versions = f('contenus/version.json');
  const tiktok = f('contenus/tiktok.json');
  const stories = f('contenus/stories.json') || [];
  const auj = jourParis(now);
  const dernierControle = controle?.jours?.at(-1);
  const prets = existsSync(path.join(root, 'media/posts-prets')) ? readdirSync(path.join(root, 'media/posts-prets')).map((d) => {
    const p = lire(path.join(root, 'media/posts-prets', d, 'publication.json'), {});
    // Publié = relu en ligne par l'auto-contrôle (« pret-<nom> : en ligne et conforme (lien) »), jamais supposé.
    const vu = (controle?.jours || []).flatMap((j) => j.ok || []).find((l) => l.startsWith(`pret-${d} :`));
    return { nom: p.titre || d, valide: p.valide === true, publie: !!vu, lien: vu?.match(/https:\/\/\S+?(?=\))/)?.[0] || '' };
  }) : [];
  return {
    le: now.toISOString(), auj,
    robots: ROBOTS.map((r) => { const t = r.trace(f(r.fichier)); const h = depuis(t, now); return { ...r, dernier: t, retard: h > r.max }; }),
    controle: dernierControle ? { jour: dernierControle.jour, le: dernierControle.le, ok: dernierControle.ok || [], problemes: dernierControle.problemes || [] } : null,
    storiesAuj: stories.filter((s) => s.jour === auj).map((s) => ({ type: s.type, n: (s.ids || []).length })),
    soirees: sansImg ? { total: sansImg.total, sans: (sansImg.sans_image || []).length, liste: (sansImg.sans_image || []).slice(0, 12), le: sansImg.le } : null,
    donnees: vt?.donnees || null, alertes: vt?.alertes || [], billetteries: vt?.sources || {},
    actus: { total: actus.length, dernieres: [...actus].sort((a, b) => String(b.ajout || b.date).localeCompare(String(a.ajout || a.date))).slice(0, 6).map((a) => ({ titre: a.titre, le: a.ajout || a.date })) },
    version: Array.isArray(versions?.versions) ? versions.versions[0] : null,
    ia: budget ? { jour: budget.jour, aujourdhui: budget.aujourdhui || {}, euros_jour: budget.euros_jour, euros_mois: budget.euros_mois } : null,
    tiktokAuj: (tiktok?.plan?.[auj] || []).map((v) => ({ heure: v.heure, type: v.type, id: v.id })),
    prets,
  };
}

const bloc = (titre, corps) => `<section><h2>${esc(titre)}</h2>${corps}</section>`;
const pastille = (ok, txt) => `<span class="p ${ok ? 'ok' : 'ko'}">${esc(txt)}</span>`;

export function contenuPilotage(D) {
  const robots = `<table>${D.robots.map((r) => `<tr><td><b>${esc(r.nom)}</b><br><small>${esc(r.quand)} · ${esc(r.role)}</small></td><td>${pastille(!r.retard, r.retard ? 'en retard' : 'à l\'heure')}<br><small>dernier passage : ${esc(quand(r.dernier))}</small></td></tr>`).join('')}</table>
<p><small>Mes tâches programmées : ${CLAUDE.map(([q, t]) => `<b>${esc(q)}</b> ${esc(t)}`).join(' · ')}.</small></p>`;
  const c = D.controle;
  const pub = c ? `<p>Dernier auto-contrôle : ${esc(quand(c.le))}${c.jour !== D.auj ? ' <b>(pas encore aujourd\'hui)</b>' : ''}</p>
${c.problemes.length ? `<ul class="ko">${c.problemes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p class="vert">Aucun problème : tout ce qui était dû est en ligne.</p>'}
<details><summary>En ligne (${c.ok.length})</summary><ul>${c.ok.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>` : '<p>Pas encore de contrôle enregistré.</p>';
  const st = D.storiesAuj.length ? `<p><small>Stories du jour : ${D.storiesAuj.map((s) => `${esc(s.type)} (${s.n})`).join(', ')}</small></p>` : '';
  const tk = D.tiktokAuj.length ? `<p>TikTok aujourd'hui : ${D.tiktokAuj.map((v) => `${esc(v.heure)} ${esc(v.type)}`).join(' · ')} → <a href="../tiktok/">ouvrir la page TikTok</a></p>` : '<p>TikTok : rien de prévu aujourd\'hui.</p>';
  const s = D.soirees, d = D.donnees;
  const site = `<div class="chiffres">${s ? `<div><b>${esc(s.total)}</b>soirées à venir</div><div><b>${esc(s.sans)}</b>sans photo</div>` : ''}<div><b>${esc(D.actus.total)}</b>actus</div>${D.version ? `<div><b>${esc(D.version.numero)}</b>version du site</div>` : ''}</div>
${d ? `<p><small>Cette semaine : ${esc(d.semaine)} soirées · sans heure ${esc(d.sans_heure)} · sans prix ${esc(d.sans_prix)} · sans billetterie ${esc(d.sans_billetterie)} · par ville : ${Object.entries(d.par_ville || {}).map(([v, n]) => `${esc(v)} ${esc(n)}`).join(', ')}</small></p>` : ''}
${s?.liste?.length ? `<details><summary>Soirées sans photo (les ${s.liste.length} plus proches)</summary><ul>${s.liste.map((e) => `<li>${esc(e.jour)} · ${esc(e.nom)} · ${esc(e.lieu)}${e.instagram ? ` · <a href="https://www.instagram.com/${esc(e.instagram)}/" target="_blank" rel="noopener">@${esc(e.instagram)}</a>` : ''}</li>`).join('')}</ul><p><small>Si tu as l'affiche, envoie-la-moi : je l'ajoute.</small></p></details>` : ''}
<details><summary>Dernières actus</summary><ul>${D.actus.dernieres.map((a) => `<li>${esc(quand(a.le))} · ${esc(a.titre)}</li>`).join('')}</ul></details>`;
  const bil = Object.entries(D.billetteries).map(([u, v]) => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, '') + new URL(u).pathname.slice(0, 28); } catch {} return `<li>${pastille((v.soirees || 0) > 0, `${v.soirees || 0} soirée(s)`)} ${esc(h)}${v.http && v.http !== 200 ? ` <small>(réponse ${esc(v.http)})</small>` : ''}</li>`; }).join('');
  const veille = `${D.alertes.length ? `<p>${D.alertes.length} point(s) relevé(s) ce matin : ${[...new Set(D.alertes.map((a) => a.sujet))].map(esc).join(', ')}.</p><details><summary>Voir le détail</summary><ul>${D.alertes.map((a) => `<li><b>${esc(a.sujet)}</b> : ${esc(a.detail)}</li>`).join('')}</ul></details>` : '<p class="vert">Aucune alerte.</p>'}
<p><small>Je traite ces alertes chaque matin ; rien à faire de ton côté sauf si je te le demande.</small></p>${bil ? `<details><summary>Billetteries</summary><ul>${bil}</ul></details>` : ''}`;
  const ia = D.ia ? `<p>Aujourd'hui : ${Object.entries(D.ia.aujourdhui).map(([k, n]) => `${esc({ groq: 'IA gratuite', tavily: 'recherches web', gemini: 'Gemini', anthropic: 'Claude' }[k] || k)} ${esc(n)}`).join(' · ')} — ${esc(D.ia.euros_jour ?? 0)} € aujourd'hui, ${esc(Math.round((D.ia.euros_mois ?? 0) * 100) / 100)} € ce mois-ci.</p><p><small>Recherches web gratuites : 30 par jour au plus (1 000 par mois).</small></p>` : '';
  const planning = `<table><tr><th>Jour</th><th>Post</th><th>Réel</th></tr>${SEMAINE.map(([j, p, r]) => `<tr><td>${j}</td><td>${esc(p)}</td><td>${esc(r)}</td></tr>`).join('')}</table>
<p><small>Le post du jour part à 16 h, 17 h ou 18 h (l'heure qui marche le mieux). En plus : actus importantes (8 h → 23 h), concours validés, suites quand un post cartonne. Stories : ${esc(STORIES)}. TikTok : 12 h 30 et 19 h 30 (toi).</small></p>`;
  const prets = D.prets.length ? `<ul>${D.prets.map((p) => `<li>${esc(p.nom)} · ${p.publie ? `${pastille(true, 'publié, vérifié en ligne')}${p.lien ? ` <a href="${esc(p.lien)}" target="_blank" rel="noopener">voir</a>` : ''}` : p.valide ? pastille(true, 'validé, part au prochain créneau') : pastille(false, 'à valider par toi')}</li>`).join('')}</ul>` : '<p>Aucun post en attente.</p>';
  const actions = `<div class="actions">
<a class="btn" href="https://www.instagram.com/teufy_official/" target="_blank" rel="noopener">Instagram</a>
<a class="btn" href="../tiktok/">Planning TikTok</a>
<a class="btn" href="../">Le site</a>
<a class="btn" href="${DEPOT}/actions" target="_blank" rel="noopener">Robots en direct (GitHub)</a>
<a class="btn sec" href="${DEPOT}/actions/workflows/teufy-site.yml" target="_blank" rel="noopener">Relancer photos et carte</a>
<a class="btn sec" href="${DEPOT}/new/main?filename=contenus/gel-site.txt&value=sauvegarde-${esc(D.auj)}" target="_blank" rel="noopener">Geler le site (souci grave)</a>
<a class="btn sec" href="${DEPOT}/delete/main/contenus/gel-site.txt" target="_blank" rel="noopener">Dégeler le site</a>
<a class="btn sec" href="${DEPOT}/blob/main/outils/RESTAURER.md" target="_blank" rel="noopener">Revenir à une sauvegarde</a>
</div><p><small>« Relancer photos et carte » : bouton « Run workflow » (ce robot n'utilise pas d'IA). Geler : garde en ligne la sauvegarde du jour pendant qu'on répare.</small></p>`;
  return `<p class="i">Mis à jour ${esc(quand(D.le))} · se met à jour à chaque passage des robots.</p>
${bloc('Actions rapides', actions)}
${bloc('Publications du jour', pub + st + tk)}
${bloc('Robots', robots)}
${bloc('Le site', site)}
${bloc('Posts prêts et concours', prets)}
${bloc('Veille technique', veille)}
${bloc('IA et recherches', ia)}
${bloc('Planning de la semaine', planning)}`;
}

export function pagePilotage(D, code = process.env.TIKTOK_CODE) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'"><title>Pilotage · Teufy</title>
<style>:root{--nuit:#0B0B0F;--creme:#F4EFE6;--corail:#FF5A3C;--live:#3DFF8A}*{box-sizing:border-box}body{margin:0;background:var(--nuit);color:var(--creme);font:16px/1.45 system-ui,sans-serif;padding:16px;max-width:860px;margin:auto}
h1{font-size:28px;margin:8px 0 4px}p.i{opacity:.8;margin:0 0 16px}section{background:#16161C;border:1px solid #ffffff22;border-radius:16px;padding:14px 16px;margin-bottom:14px}h2{font-size:19px;margin:0 0 10px;color:var(--corail)}
a{color:var(--creme)}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px 6px;border-top:1px solid #ffffff14;vertical-align:top}small{opacity:.75}ul{padding-left:20px;margin:6px 0}li{margin:3px 0}
.p{display:inline-block;font-size:12px;font-weight:800;padding:2px 9px;border-radius:999px}.p.ok{background:var(--live);color:var(--nuit)}.p.ko{background:var(--corail);color:var(--nuit)}ul.ko li{color:#ffb4a6}.vert{color:var(--live)}
.chiffres{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.chiffres div{background:#0B0B0F;border-radius:12px;padding:10px;font-size:13px;opacity:.9}.chiffres b{display:block;font-size:26px}
.actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.btn{display:block;text-align:center;background:var(--creme);color:var(--nuit);font-weight:800;border:0;border-radius:10px;padding:12px;text-decoration:none;font-size:15px;cursor:pointer}.btn.sec{background:transparent;color:var(--creme);border:2px solid #ffffff55}
details{margin-top:8px}summary{cursor:pointer;font-weight:700}.sans{opacity:.7;font-size:14px}</style></head><body>
<h1>Pilotage Teufy</h1>
<div id="contenu">${verrou(code, contenuPilotage(D))}</div>
<script src="pilotage.js"></script></body></html>
`;
}
export const SCRIPT_PILOTAGE = `${DECHIFFRE}\nfunction activer(){}\n`;

export function construirePilotage({ root = ROOT, now = new Date(), log = console.log } = {}) {
  const D = donneesPilotage({ root, now });
  mkdirSync(path.join(root, 'pilotage'), { recursive: true });
  writeFileSync(path.join(root, 'pilotage', 'index.html'), pagePilotage(D));
  writeFileSync(path.join(root, 'pilotage', 'pilotage.js'), SCRIPT_PILOTAGE);
  log(`Pilotage : tableau de bord mis à jour (${D.robots.filter((r) => r.retard).length} robot(s) en retard, ${D.alertes.length} alerte(s)).`);
  return D;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) construirePilotage();
