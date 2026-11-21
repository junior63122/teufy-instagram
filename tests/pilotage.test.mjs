// Tableau de bord du directeur (/pilotage/) : contenu chiffré (rien de lisible sans le code), données réelles seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donneesPilotage, pagePilotage, contenuPilotage } from '../src/pilotage.mjs';

test('pilotage : rien de lisible dans la page sans le code', () => {
  const D = donneesPilotage({ now: new Date('2026-11-21T20:00:00Z') });
  const html = pagePilotage(D, 'code-de-test');
  assert.match(html, /data-d="/);
  assert.doesNotMatch(html, /Actions rapides|Planning de la semaine|gel-site/);
  assert.match(html, /noindex/);
  assert.match(pagePilotage(D, ''), /Page fermée/);
});

test('pilotage : un post prêt n\'est dit publié que si l\'auto-contrôle l\'a vu en ligne', () => {
  const D = donneesPilotage({ now: new Date('2026-11-21T20:00:00Z') });
  for (const p of D.prets) if (p.publie) assert.match(p.lien, /^https:\/\/www\.instagram\.com\//);
  const h = contenuPilotage({ ...D, prets: [{ nom: 'Essai', valide: false, publie: false }] });
  assert.match(h, /à valider par toi/);
  assert.match(contenuPilotage(D), /Robots/);
});
