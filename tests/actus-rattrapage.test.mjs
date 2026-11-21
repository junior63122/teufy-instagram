// Rattrapage des actus (21/11/2026) : un article n'est publié que si la page source confirme l'info ; jamais sinon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('actus : rattrapage seulement si la source confirme, idée marquée sinon', async () => {
  const { rattraperActus } = await import('../src/veille.mjs');
  const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const sauve = { idees: readFileSync(path.join(racine, 'contenus/idees.json'), 'utf8'), actus: readFileSync(path.join(racine, 'contenus/actus.json'), 'utf8') };
  try {
    writeFileSync(path.join(racine, 'contenus/idees.json'), JSON.stringify([
      { id: 'idee-a', ajout: '2026-11-20T10:00:00Z', type: 'annonce', titre: 'Acid Pauli au Frigo 16', resume: 'REF invite Acid Pauli', source: 'https://exemple.fr/a', importance: 70 },
      { id: 'idee-b', ajout: '2026-11-20T10:00:00Z', type: 'annonce', titre: 'Rumeur', resume: 'x', source: 'https://exemple.fr/b', importance: 65 },
      { id: 'idee-d', ajout: '2026-11-20T10:00:00Z', type: 'annonce', titre: 'Déjà publiée', source: 'https://exemple.fr/deja', importance: 90 },
      { id: 'idee-e', ajout: '2026-11-20T10:00:00Z', type: 'annonce', titre: 'Image', source: 'https://exemple.fr/affiche.webp', importance: 90 },
      { id: 'idee-c', ajout: '2026-11-20T10:00:00Z', type: 'annonce', titre: 'Petite info', source: 'https://exemple.fr/c', importance: 40 },
    ]));
    writeFileSync(path.join(racine, 'contenus/actus.json'), JSON.stringify([{ cle: '2026-11|autre-cle', source: 'https://exemple.fr/deja', titre: 'x' }]));
    const ia = { json: async ({ prompt }) => (prompt.includes('Acid Pauli')
      ? { confirme: true, titre: 'Acid Pauli joue au Frigo 16', chapo: 'Le collectif REF invite Acid Pauli.', paragraphes: ['Le collectif REF invite le DJ allemand Acid Pauli au Frigo 16 à Nice pour une nuit entière.', 'Les billets sont en vente sur la billetterie indiquée par les organisateurs.'], ville: 'Nice' }
      : { confirme: false, titre: '', chapo: '', paragraphes: [], ville: '' }) };
    const lirePage = async () => 'Texte de la page '.repeat(40);
    const n = await rattraperActus({ config: { veille: { seuil_site: 60 } }, ia, lirePage, now: new Date('2026-11-21T19:00:00Z'), log: () => {} });
    assert.equal(n, 1);
    const actus = JSON.parse(readFileSync(path.join(racine, 'contenus/actus.json'), 'utf8'));
    assert.deepEqual(actus.map((a) => a.cle), ['2026-11|autre-cle', 'idee-a'], 'pas de doublon (même source)');
    const idees = JSON.parse(readFileSync(path.join(racine, 'contenus/idees.json'), 'utf8'));
    assert.equal(idees.find((x) => x.id === 'idee-b').actu_refusee, 'non confirmée par la source');
    assert.ok(!idees.find((x) => x.id === 'idee-e').actu_refusee, 'une image n\'est pas lue');
    assert.ok(!idees.find((x) => x.id === 'idee-c').actu_refusee, 'une idée sous le seuil n\'est pas traitée');
  } finally {
    writeFileSync(path.join(racine, 'contenus/idees.json'), sauve.idees);
    writeFileSync(path.join(racine, 'contenus/actus.json'), sauve.actus);
  }
});
