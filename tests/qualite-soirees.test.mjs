// 23/11/2026 : erreurs relevées par le testeur « vérité » sur les soirées de la semaine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corrigerNuit, corrigerRecurrence, estJourneeHorsSujet, fusionnerMemeNuit, nettoyerSoirees } from '../src/qualite-soirees.mjs';

test('« le vendredi 27, ouverture à minuit » = nuit du vendredi (samedi 0 h), pas la nuit du jeudi', () => {
  const e = { name: 'EUPHORIA', start: '2026-11-26T23:00:00.000Z', description: 'Le vendredi 27 novembre, le Naho Club accueille EUPHORIA' };
  assert.equal(corrigerNuit(e).start, '2026-11-27T23:00:00.000Z');
  const ok = { name: 'X', start: '2026-11-27T23:00:00.000Z', description: 'Le vendredi 27 novembre à minuit' }; // déjà juste (samedi 0 h)
  assert.equal(corrigerNuit(ok).start, ok.start);
  const tot = { name: 'Y', start: '2026-11-27T21:00:00.000Z', description: 'vendredi 27' };
  assert.equal(corrigerNuit(tot).start, tot.start);
});

test('« tous les vendredis » placé un jeudi : ramené au vendredi, même heure', () => {
  const e = { name: 'No Sleep Mode', start: '2026-11-26T21:00:00.000Z', description: 'Tous les vendredis au Bulldog Pub' };
  assert.equal(corrigerRecurrence(e).start, '2026-11-27T21:00:00.000Z');
  const ok = { name: 'Z', start: '2026-11-27T23:30:00.000Z', description: 'tous les vendredis' }; // samedi 0 h 30 = nuit du vendredi
  assert.equal(corrigerRecurrence(ok).start, ok.start);
});

test('journée sans rien d\'une sortie écartée ; day party et open air gardés ; soirée gardée', () => {
  assert.ok(estJourneeHorsSujet({ name: "Concert d'orgue du midi (entrée libre)", start: '2026-11-26T11:15:00.000Z' }));
  assert.ok(estJourneeHorsSujet({ name: 'Après-midi dansant avec Joël et Dédé', start: '2026-11-29T13:30:00.000Z' }));
  assert.ok(!estJourneeHorsSujet({ name: 'Open Air Techno', start: '2026-11-29T13:00:00.000Z' }));
  assert.ok(!estJourneeHorsSujet({ name: 'Blind test', start: '2026-11-29T19:00:00.000Z' }));
});

test('même club, même nuit, même artiste : une seule soirée, la billetterie l\'emporte', () => {
  const insta = { name: 'Marwa Loud Showcase', start: '2026-11-28T19:00:00.000Z', venue: 'High Club Nice', url: 'https://www.instagram.com/reel/x/', source: 'web' };
  const billet = { name: 'MARWA LOUD FAST PASS HIGH CLUB', start: '2026-11-28T22:59:00.000Z', venue: 'High Club', url: 'https://xceed.me/fr/nice/event/marwa-loud-fast-pass-high-club/252164', source: 'xceed' };
  const autre = { name: 'Techno Night', start: '2026-11-28T22:00:00.000Z', venue: 'High Club', url: 'https://a.b/c', source: 'x' };
  const r = fusionnerMemeNuit([insta, billet, autre]);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => /marwa/i.test(x.name)).url, billet.url);
  assert.equal(nettoyerSoirees([insta, billet, autre]).length, 2);
});

test('« week-end » placé un lundi : écarté ; un vrai week-end gardé', async () => {
  const { weekEndIncoherent } = await import('../src/qualite-soirees.mjs');
  assert.ok(weekEndIncoherent({ name: "Week‑end Techno L'Antre", start: '2026-11-23T19:00:00.000Z' }));
  assert.ok(!weekEndIncoherent({ name: 'Week-end Techno', start: '2026-11-27T21:00:00.000Z' }));
  assert.ok(!weekEndIncoherent({ name: 'Techno Night', start: '2026-11-23T19:00:00.000Z' }));
});

test('événement de journée : gardé et signalé « journee » (directeur 24/11), soirée de nuit non signalée', async () => {
  const { nettoyerSoirees, estDeJour } = await import('../src/qualite-soirees.mjs');
  const jour = { name: 'Coachellito Opening Edition (day party)', start: '2026-11-26T11:15:00.000Z', venue: 'Auron 1600' };
  const nuit = { name: 'Techno Night', start: '2026-11-28T22:00:00.000Z', venue: 'High Club' };
  const r = nettoyerSoirees([jour, nuit]);
  assert.equal(r.length, 2);
  assert.equal(r.find((e) => /Coachellito/.test(e.name)).journee, true);
  assert.ok(!r.find((e) => /Techno/.test(e.name)).journee);
  assert.ok(estDeJour({ start: '2026-11-29T15:59:00.000Z' })); // 16 h 59 à Paris
  assert.ok(!estDeJour({ start: '2026-11-29T16:00:00.000Z' })); // 17 h
});

test('pour les jeunes (directeur 24/11) : orgue, Bach, après-midi dansant retirés, de jour comme de nuit ; day party gardée', async () => {
  const { nettoyerSoirees, pourJeunes } = await import('../src/qualite-soirees.mjs');
  const r = nettoyerSoirees([
    { name: "Concert d'orgue du midi (entrée libre)", start: '2026-11-26T11:15:00.000Z', venue: 'Temple' },
    { name: 'Après-midi dansant avec Joël et Dédé', start: '2026-11-29T13:30:00.000Z', venue: 'Salle' },
    { name: 'Eclat de Bach', start: '2026-11-29T19:00:00.000Z', venue: 'Église' },
    { name: "Concert d'orgue du Nouvel An", start: '2026-12-31T21:00:00.000Z', venue: 'Cathédrale' },
    { name: 'Coachellito & Le Blanchon - Opening Edition', start: '2026-12-12T13:00:00.000Z', venue: 'Auron' },
    { name: 'Brunch & DJ set', start: '2026-12-13T11:00:00.000Z', venue: 'Rooftop' },
    { name: 'Exposition de peinture', start: '2026-12-13T10:00:00.000Z', venue: 'Galerie' },
  ]);
  assert.deepEqual(r.map((e) => e.name).sort(), ['Brunch & DJ set', 'Coachellito & Le Blanchon - Opening Edition']);
  assert.ok(pourJeunes({ name: 'Techno Night', start: '2026-11-28T22:00:00.000Z' }));
  assert.ok(pourJeunes({ name: 'House classique all night long', start: '2026-11-28T22:00:00.000Z' })); // « classique » seul ne suffit pas à retirer
});

test('pour les jeunes : une vraie soirée n\'est jamais retirée pour un mot isolé (quatuor funk, DJ « Recital »)', async () => {
  const { pourJeunes } = await import('../src/qualite-soirees.mjs');
  assert.ok(pourJeunes({ name: 'Jerrycans Release Party @ Frigo 16', description: 'Ce quatuor envoie un mélange explosif de basses funk et italo-disco.', start: '2026-11-26T19:00:00.000Z' }));
  assert.ok(pourJeunes({ name: 'SHATTA', description: 'Soirée 100 % shatta avec les DJs Ozenn et Dezze Recital aux platines.', start: '2026-11-27T23:00:00.000Z' }));
  assert.ok(!pourJeunes({ name: 'Concert à Nice : Tchaikovsky, Vivaldi, Pachelbel', start: '2026-12-16T19:00:00.000Z' }));
});

test('ville d\'un lieu (24/11) : L\'Antre placée à Antibes par une IA, Nice pour toutes les billetteries → Nice', async () => {
  const { corrigerVilles } = await import('../src/qualite-soirees.mjs');
  const ev = [
    { name: 'Je Dis Techno', venue: 'L’Antre', city: 'Antibes', start: '2026-11-26T21:00:00Z' },
    { name: 'Pump Up', venue: "L'Antre Bar Electro", city: 'Nice', start: '2026-11-14T20:00:00Z' },
    { name: 'Da Grow', venue: "L'Antre Bar Electro", city: 'Nice', start: '2026-11-28T21:00:00Z' },
    { name: 'Seul', venue: 'Autre lieu', city: 'Cannes', start: '2026-11-28T21:00:00Z' },
  ];
  const r = corrigerVilles(ev);
  assert.equal(r[0].city, 'Nice');
  assert.equal(r[3].city, 'Cannes');
});

test('affiche qui contredit la date (24/11) : soirée retirée ; affiche sans date ou à J±1 : gardée', async () => {
  const { dateContredite } = await import('../src/site.mjs');
  const e = { name: 'Je Dis Techno', venue: 'L’Antre', city: 'Nice', start: '2026-11-24T21:00:00.000Z' };
  assert.equal(dateContredite(e, { titre: 'Je Dis Techno', dates: ['2026-11-26'] }), true);
  assert.equal(dateContredite(e, { titre: 'Je Dis Techno', dates: ['2026-11-25'] }), false);
  assert.equal(dateContredite(e, { titre: 'Je Dis Techno', dates: [] }), false);
  assert.equal(dateContredite(e, { titre: 'Autre soirée', dates: ['2026-11-26'] }), false); // autre affiche : jugée ailleurs
});

test('minuit et « 26 novembre » dans le titre (24/11) : la nuit du 26, pas celle du 25', async () => {
  const { corrigerNuit } = await import('../src/qualite-soirees.mjs');
  const e = corrigerNuit({ name: 'Soirée Shatta 26 novembre', description: '', start: '2026-11-25T23:00:00.000Z' });
  assert.equal(e.start, '2026-11-26T23:00:00.000Z');
  const f = corrigerNuit({ name: 'Soirée du 1er décembre', description: '', start: '2026-11-30T23:00:00.000Z' });
  assert.equal(f.start, '2026-12-01T23:00:00.000Z');
  const g = corrigerNuit({ name: 'Afterwork 26 novembre', description: '', start: '2026-11-26T18:00:00.000Z' }); // 19 h : rien à corriger
  assert.equal(g.start, '2026-11-26T18:00:00.000Z');
});

test('affiche « Jeudi 26 novembre, 00h-05h » et soirée lue le 26 à 0 h : nuit du 26', async () => {
  const { nuitDeLAffiche } = await import('../src/site.mjs');
  const e = { name: '100% Shatta', venue: 'Bora Club', city: 'Toulon', start: '2026-11-25T23:00:00.000Z' };
  assert.equal(nuitDeLAffiche(e, { titre: '100% Shatta', dates: ['2026-11-26'] }), true);
  assert.equal(nuitDeLAffiche({ ...e, start: '2026-11-26T21:00:00.000Z' }, { titre: '100% Shatta', dates: ['2026-11-26'] }), false); // 22 h : déjà bon
  assert.equal(nuitDeLAffiche(e, { titre: 'Autre soirée', dates: ['2026-11-26'] }), false);
});

test('contrôle qui corrige (24/11) : texte réparé, nom censuré écarté, titre à une autre date écarté', async () => {
  const { nettoyerTexte, titreDateIncoherente, nettoyerSoirees, estCorrigee } = await import('../src/qualite-soirees.mjs');
  assert.equal(nettoyerTexte('soul, hip-hop and R&amp;amp;B'), 'soul, hip-hop and R&B');
  assert.equal(nettoyerTexte('**Line-up** complet'), 'Line-up complet');
  assert.equal(titreDateIncoherente({ name: 'Soirée Shatta 26 novembre', start: '2026-11-26T23:00:00.000Z' }), false);
  assert.equal(titreDateIncoherente({ name: 'Soirée Shatta 26 novembre', start: '2026-11-27T21:00:00.000Z' }), true);
  const r = nettoyerSoirees([{ name: 'The Boiler R***', start: '2026-12-18T22:00:00.000Z', venue: 'X' }, { name: 'Techno Night', start: '2026-12-18T22:00:00.000Z', venue: 'Y' }]);
  assert.deepEqual(r.map((e) => e.name), ['Techno Night']);
  assert.equal(estCorrigee({ name: 'Le Mome & Adame', start: '2026-12-18T22:00:00.000Z' }, [{ nom_cle: 'lemomeadame', nuit: '2026-12-18' }]), true);
});

test('agenda .ics (restant du 23/11) : 23 h 59 = minuit, lignes repliées à 75 octets', async () => {
  const { debutIcs, plierIcs } = await import('../src/site.mjs');
  assert.equal(new Date(debutIcs('2026-11-28T22:59:00.000Z')).toISOString(), '2026-11-28T23:00:00.000Z');
  assert.equal(debutIcs('2026-11-28T22:00:00.000Z'), Date.parse('2026-11-28T22:00:00.000Z'));
  const l = plierIcs(`DESCRIPTION:${'é'.repeat(100)}`);
  for (const x of l.split('\r\n')) assert.ok(Buffer.byteLength(x) <= 75, x);
});

// 27/11/2026 (audit SEO) : « minuit » saisi 23h59 la veille de la date de l'affiche → nuit de l'affiche.
test('minuit (23h59) la veille de la seule date de l affiche : soirée décalée au jour de l affiche', async () => {
  const { nuitDeLAffiche } = await import('../src/site.mjs');
  const e = { name: 'Spicy Saturday', start: '2026-11-27T22:59:00.000Z', venue: 'Honey Club', city: 'Juan-les-Pins' };
  assert.equal(nuitDeLAffiche(e, { titre: 'Spicy', dates: ['2026-11-28'] }), true);
  assert.equal(nuitDeLAffiche({ ...e, start: '2026-11-27T21:00:00.000Z' }, { titre: 'Spicy', dates: ['2026-11-28'] }), false);
  assert.equal(nuitDeLAffiche(e, { titre: 'Autre soirée', dates: ['2026-11-28'] }), false);
});
