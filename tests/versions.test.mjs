// Page Nouveautés et bandeau « Nouveau » (21/11/2026) : titres courts (affichés en entier sur téléphone), phrases simples
// sans détail technique, une version datée pour chaque jour où le site change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { versions } = JSON.parse(readFileSync(new URL('../contenus/version.json', import.meta.url), 'utf8'));

test('versions : numéro au bon format, plus récente en premier, titre court, texte public sans jargon', () => {
  const v0 = versions[0];
  assert.ok(v0.titre.length <= 28, `titre trop long pour le bandeau : « ${v0.titre} » (${v0.titre.length})`);
  for (const v of versions) {
    assert.match(v.numero, /^\d+\.\d{2}\.\d{2}$/);
    for (const p of [v.titre, ...(v.public || [])]) assert.doesNotMatch(p, /\b(IA|Google|Gemini|Groq|Tavily|API|GitHub|robot|clé|secret|token)\b/i, `jargon dans « ${p} »`);
  }
  for (let i = 1; i < versions.length; i++) assert.ok(versions[i - 1].date >= versions[i].date, 'versions dans le désordre');
});
