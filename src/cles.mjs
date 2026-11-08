// Retrouve les clés dans les secrets GitHub, quel que soit leur nom exact.
// Le workflow passe tous les secrets en JSON (SECRETS_JSON) ; pour chaque variable attendue encore vide,
// on prend le secret dont le NOM ressemble (ex. « ELEVEN_LABS », « elevenlabs_key », « CLE_ELEVENLABS »…).
// Les valeurs ne sont jamais affichées (GitHub les masque de toute façon) : seuls les noms sont journalisés.
import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const ATTENDUES = [
  ['ELEVENLABS_API_KEY', /eleven|xi_?api|voix|voice/i],
  ['GEMINI_API_KEY', /gemini|google_?ai|ai_?studio|google_?api|gmni|grmini/i],
  ['ANTHROPIC_API_KEY', /anthropic|claude/i],
  ['IG_ACCESS_TOKEN', /(ig|insta|meta|facebook|fb|graph).*(token|acces|access)|^(ig|insta).*key/i],
  ['IG_USER_ID', /(ig|insta|meta|facebook|fb).*(user|account|compte|business).*(id)?$|^(ig|insta).*_id$/i],
  ['PEXELS_API_KEY', /pexels/i],
  ['PIXABAY_API_KEY', /pixabay/i],
];

export function associer(secrets, env = {}) {
  const noms = Object.keys(secrets).filter((n) => n !== 'github_token' && n !== 'GITHUB_TOKEN' && String(secrets[n] || '').trim());
  const pris = new Set();
  const out = [];
  for (const [cible, re] of ATTENDUES) {
    if (String(env[cible] || '').trim()) { out.push({ cible, source: cible, deja: true }); continue; }
    const nom = noms.find((n) => !pris.has(n) && (n === cible || re.test(n)));
    if (nom) { pris.add(nom); out.push({ cible, source: nom }); }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let secrets = {};
  try { secrets = JSON.parse(process.env.SECRETS_JSON || '{}'); } catch { /* rien */ }
  console.log(`Secrets présents (noms) : ${Object.keys(secrets).filter((n) => n.toLowerCase() !== 'github_token').join(', ') || 'aucun'}`);
  const trouvees = associer(secrets, process.env);
  for (const { cible, source, deja } of trouvees) {
    if (deja) { console.log(`${cible} : ok`); continue; }
    const v = String(secrets[source]).trim();
    console.log(`::add-mask::${v}`);
    if (process.env.GITHUB_ENV) { const d = `EOF_${randomUUID()}`; appendFileSync(process.env.GITHUB_ENV, `${cible}<<${d}\n${v}\n${d}\n`); }
    console.log(`${cible} ← secret « ${source} »`);
  }
  for (const [cible] of ATTENDUES) if (!trouvees.some((a) => a.cible === cible)) console.log(`${cible} : introuvable`);
}
