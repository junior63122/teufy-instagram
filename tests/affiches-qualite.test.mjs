// Contrôle qualité des affiches (post du 11/11/2026 : affiche du réveillon de L'Artiste sur « Honey Club »,
// affiche de « Caribbean Mood » sur « The Best or Nothing ») : ces cas ne doivent plus jamais passer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jugerAffiche } from '../src/site.mjs';
import { readFileSync } from 'node:fs';

const soiree = (name, start, venue, extra = {}) => ({ name, start, venue, city: 'Nice', ...extra });

test('affiche d\'une autre soirée du même club : refusée (le lieu seul ne prouve rien)', () => {
  const lu = { titre: 'CARIBBEAN MOOD', dates: ['2026-11-13'], artistes: ['DJ MyGO', 'DIRON', 'Skyfall'] };
  assert.equal(jugerAffiche(soiree('The Best or Nothing', '2026-11-14T22:59:00Z', 'Skyfall', { accroche: 'Au Skyfall' }), lu), false);
  assert.equal(jugerAffiche(soiree('Caribbean Mood', '2026-11-13T22:59:00Z', 'Skyfall'), lu), true);
});

test('affiche d\'un réveillon pour une soirée de novembre : refusée', () => {
  const lu = { titre: 'REVEILLON', dates: ['2026-12-31'], artistes: ['2point4', 'DJ Jérôme Delplanque'] };
  assert.equal(jugerAffiche(soiree('Honey Club - Saturday Bee Crazy', '2026-11-14T22:59:00Z', 'Honey Club'), lu), false);
});

test('bonne affiche, soirée après minuit (veille) : acceptée', () => {
  assert.equal(jugerAffiche(soiree('Jetlag Gang (+ Opening Act)', '2026-11-13T22:30:00Z', 'Frigo 16'), { titre: 'JETLAG GANG', dates: ['2026-11-13'] }), true);
  assert.equal(jugerAffiche(soiree('Nightly X Dovnrobs', '2026-11-13T23:30:00Z', 'ELVA'), { titre: 'Nightly.', dates: ['2026-11-14'] }), true);
});

test('lecture gratuite des dates (OCR) : jour + mois en lettres ou en chiffres', () => {
  const src = readFileSync(new URL('../studio/scripts/affiches.mjs', import.meta.url), 'utf8');
  const datesLues = new Function(`${src.slice(src.indexOf('const MOIS'), src.indexOf('function ocrAffiche')).replace('export function', 'function')}; return datesLues;`)();
  assert.deepEqual(datesLues('31 décembre RÉVEILLON'), [[31, 12]]);
  assert.deepEqual(datesLues('VENDREDI 13 NOVEMBRE 2026'), [[13, 11]]);
  assert.deepEqual(datesLues('rendez-vous le 14/11'), [[14, 11]]);
});

test('titres de carrousel fidèles aux dates (jamais « cette semaine » pour des dates du mois)', async () => {
  const { periodeDe } = await import('../src/periode.mjs');
  const jeudi = new Date('2026-11-12T10:00:00Z');
  assert.equal(periodeDe(['2026-11-13T22:00:00Z', '2026-11-14T22:00:00Z'], jeudi).label, 'ce week-end');
  assert.equal(periodeDe(['2026-11-12T22:00:00Z', '2026-11-15T22:00:00Z'], jeudi).label, 'cette semaine');
  assert.equal(periodeDe(['2026-11-13T22:00:00Z', '2026-11-28T22:00:00Z'], jeudi).label, 'en novembre');
  assert.equal(periodeDe(['2026-11-28T22:00:00Z', '2026-12-05T22:00:00Z'], jeudi).label, 'du 28 novembre au 5 décembre');
});

test('Édition Tekno : underground seulement, jamais la house', async () => {
  const { isUnderground } = await import('../src/genres.mjs');
  assert.equal(isUnderground({ name: 'Caravel', tags: ['hard techno', 'industrial techno', 'schranz'] }), true);
  assert.equal(isUnderground({ name: 'Noise Protocol', tags: ['Hardtek', 'Tribe', 'Acidcore', 'Tekno'] }), true);
  assert.equal(isUnderground({ name: 'REF Session', tags: ['acid house', 'melodic techno', 'organic house', 'house', 'techno'] }), false);
  assert.equal(isUnderground({ name: 'Friday', tags: ['tech house', 'house'] }), false);
});

test('collaborations : les comptes les plus suivis d\'abord', async () => {
  const { abonnesDe } = await import('../src/comptes.mjs');
  // Comptes réels relevés par le robot (fiches des lieux) : un club très suivi passe devant un petit compte.
  const a = abonnesDe('twigamontecarlo'), b = abonnesDe('pandaevents06');
  if (a && b) assert.ok(a > b);
  assert.equal(abonnesDe('compte-inconnu-xyz'), 0);
});

test('comptes Instagram : jamais un pseudo non vérifié, corrections appliquées', async () => {
  const { nettoyerComptes, correspond } = await import('../src/comptes.mjs');
  const p = { legende: 'Jetlag Gang au 109 @le109nice @compte_invente_xyz', tags: [[], ['le109nice', 'compte_invente_xyz']], collabs: ['compte_invente_xyz'],
    soirees: [{ name: 'Jetlag Gang', venue: 'Frigo 16 (Le 109)', instagram: ['le109nice', 'compte_invente_xyz'] }] };
  await nettoyerComptes(p, { log: () => {} }); // sans accès Instagram : rien n'est confirmé, donc rien n'est tagué
  assert.ok(!/@le109nice|@compte_invente_xyz/.test(p.legende));
  assert.deepEqual(p.tags[1], []);
  assert.deepEqual(p.collabs, []);
  // Un compte qui existe mais ne correspond pas au lieu ou à la soirée est refusé.
  assert.equal(correspond('le109_officiel', { nom: 'Le 109', bio: 'Tiers-lieu culturel, Nice' }, ['Frigo 16 (Le 109)']), true);
  assert.equal(correspond('mode_boutique', { nom: 'Boutique', bio: 'vêtements' }, ['Frigo 16 (Le 109)', 'Jetlag Gang']), false);
});
