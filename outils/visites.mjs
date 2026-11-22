// Visites du site (22/11/2026, directeur : « les données d'utilisation ») : relevé GoatCounter (comptage sans cookie) pour le
// tableau de bord /pilotage/. Clé API en lecture seule dans le secret GitHub GOATCOUNTER_TOKEN (jamais dans le code ni la
// conversation). Sans clé : rien n'est écrit, le tableau de bord le dit. Écrit contenus/visites.json.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://teufy.goatcounter.com/api/v0';
const jour = (d) => d.toISOString().slice(0, 10);

async function api(chemin, params) {
  const u = new URL(BASE + chemin); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { authorization: `Bearer ${process.env.GOATCOUNTER_TOKEN}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 3000)); return api(chemin, params); }
  if (!r.ok) throw new Error(`GoatCounter ${chemin} : HTTP ${r.status}`);
  return r.json();
}

export async function releverVisites(now = new Date()) {
  if (!process.env.GOATCOUNTER_TOKEN) { console.log('Visites : pas de clé GOATCOUNTER_TOKEN, relevé non fait.'); return null; }
  const periode = (n) => ({ start: jour(new Date(now - n * 864e5)), end: jour(now) });
  const total = async (n) => { const j = await api('/stats/total', periode(n)); return { vues: j.total ?? null, evenements: j.total_events ?? null, par_jour: (j.stats || []).map((x) => ({ jour: x.day, vues: x.daily })) }; };
  const [j1, j7, j30] = [await total(1), await total(7), await total(30)];
  const hits = await api('/stats/hits', { ...periode(7), limit: 40 });
  const liste = (hits.hits || []).map((h) => ({ page: h.path, titre: h.title || '', vues: h.count, evenement: !!h.event }));
  const refs = await api('/stats/toprefs', periode(7)).catch(() => ({}));
  const sortie = {
    le: now.toISOString(), aujourdhui: j1.vues, sept_jours: j7.vues, trente_jours: j30.vues, par_jour: j30.par_jour,
    pages: liste.filter((x) => !x.evenement).slice(0, 15),
    soirees: liste.filter((x) => !x.evenement && /^\/(?:[a-z]{2}\/)?soiree\//.test(x.page)).slice(0, 10),
    billets: liste.filter((x) => x.evenement).slice(0, 10),
    provenance: (refs.stats || []).map((x) => ({ site: x.name || '(direct)', vues: x.count })).slice(0, 8),
  };
  writeFileSync(path.join(ROOT, 'contenus', 'visites.json'), JSON.stringify(sortie, null, 1) + '\n');
  console.log(`Visites : ${sortie.aujourdhui ?? '?'} aujourd'hui, ${sortie.sept_jours ?? '?'} sur 7 jours.`);
  return sortie;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await releverVisites().catch((e) => { console.error(`Visites : ${e.message}`); process.exitCode = 0; });
