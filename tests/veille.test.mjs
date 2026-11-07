import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veiller } from '../src/veille.mjs';

const sujet = (titre, extra = {}) => ({
  titre, type: 'annonce', resume: 'Annonce.', date_publication: '2026-11-10T19:30:00+01:00', source_url: 'https://www.instagram.com/p/x', source_officielle: true,
  importance: 85, raison: 'Inédit.', angle: 'Ça change l\'hiver.', format: 'post-annonce', comptes_instagram: ['orga'], image: '',
  post: { surtitre: "C'EST OFFICIEL", titre: 'Le festival revient en hiver', sous_titre: 'Une première', faits: ['Fait 1', 'Fait 2'], legende: 'Légende sourcée. Source : @orga #TeufyParty' }, ...extra,
});

test('veille : seul un sujet exceptionnel, officiel, frais et dans le créneau est publié tout de suite', async () => {
  const now = new Date('2026-11-10T20:30:00Z'); // 21h30 à Paris
  const sujets = [
    sujet('Soirée banale', { importance: 40 }),
    sujet('Rumeur non confirmée', { source_officielle: false, importance: 95 }),
    sujet('Annonce trop ancienne', { date_publication: '2026-11-05T10:00:00+01:00', importance: 92 }),
    sujet('Grande annonce', { importance: 88 }),
    sujet('Annonce importante mais moins forte', { importance: 82 }),
  ];
  const ia = { rechercher: async () => 'signaux', json: async () => ({ sujets }) };
  const r = await veiller({ config: { veille: { seuil: 80 } }, now, ia, dryRun: true, log: () => {} });
  assert.equal(r.apublier.titre, 'Grande annonce');
  assert.ok(r.idees.some((s) => s.titre === 'Annonce importante mais moins forte'), 'le reste part en idées');
  assert.ok(!r.idees.some((s) => s.titre === 'Soirée banale'));
});

test('veille : rien la nuit (hors créneau 8h-23h)', async () => {
  const now = new Date('2026-11-10T02:00:00Z'); // 3h à Paris
  const ia = { rechercher: async () => '', json: async () => ({ sujets: [sujet('Grande annonce', { date_publication: '2026-11-10T01:30:00Z' })] }) };
  const r = await veiller({ config: { veille: {} }, now, ia, dryRun: true, log: () => {} });
  assert.equal(r.apublier, null);
});
