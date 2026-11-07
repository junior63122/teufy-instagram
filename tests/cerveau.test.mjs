import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyserSemaine } from '../src/cerveau.mjs';
import { note, generalFeatures, effets, objectif } from '../src/learn.mjs';

const donnees = () => {
  const posts = [];
  for (let i = 0; i < 10; i++) {
    const soir = i % 2 === 0;
    posts.push({
      media: String(i), source: i < 3 ? 'manuel' : 'bot', id: i < 3 ? 'manuel' : 'incontournables-commercial', type: 'incontournables', nb_images: 9,
      publie_le: `2026-11-0${(i % 9) + 1}T${soir ? '19' : '11'}:00:00Z`, legende: soir ? 'Tu sors où ? #TeufyParty #nice' : 'Programme #cannes',
      metrics: { reach: 1000, likes: soir ? 120 : 40, comments: soir ? 15 : 3, saved: soir ? 20 : 4, shares: soir ? 8 : 1, follows: soir ? 5 : 0 },
    });
  }
  return { posts, abonnes: [] };
};

test('notes /100, objectif et traits qui font monter la note', () => {
  const d = donnees();
  const ef = effets(d);
  const n = d.posts.map(note);
  assert.ok(n.every((x) => x >= 0 && x <= 100));
  assert.ok(ef.find((e) => e.trait === 'heure:20h').effet > 0, 'publier le soir fait monter la note');
  assert.ok(ef.find((e) => e.trait === 'heure:12h').effet < 0);
  assert.ok(objectif(d) >= 50);
  assert.ok(generalFeatures(d.posts[0]).includes('auteur:equipe'));
  assert.ok(generalFeatures(d.posts[5]).includes('hashtag:#cannes') || generalFeatures(d.posts[4]).includes('hashtag:#nice'));
});

test('analyse hebdomadaire : garde-fous sur ce que propose Claude', async () => {
  const reponses = [
    'Veille : Instagram teste les carrousels de 20 images. Source : https://about.instagram.com/blog/x',
    JSON.stringify({
      resume: 'Les posts du soir marchent mieux.',
      nouveautes: [{ titre: 'Carrousels 20 images', date: '2026-11-03', source: 'https://about.instagram.com/blog/x', officiel: true, impact: 'Plus de soirées par post' }],
      analyse: [{ constat: 'Le soir marche mieux', preuve: '+30 points', action: 'Publier après 18h' }],
      regles: { hashtags_max: 5, reel_duree_min_s: 7, reel_duree_max_s: 30, accroche_max_s: 1.6, source_officielle: '' },
      nouvelles_accroches: [
        { variante: 'weekend', titre: 'Ton week-end commence ici', sous: 'Côte d\'Azur' },
        { variante: 'techno', titre: 'Télécharge l\'app — maintenant', sous: 'Techno' },
      ],
      nouvelles_intros: [{ variante: 'commercial', texte: 'Trois villes, une seule question : tu sors où ?' }],
      nouveaux_debats: [{ q: 'Rooftop ou cave ?', a: 'Rooftop', b: 'Cave', legende: 'Choisis ton camp.' }],
      hashtags_a_tester: ['#nicebynight', 'pas un hashtag', '#teufyparty'],
      objectif_prochaine_semaine: 62,
    }),
  ];
  let i = 0;
  const client = { beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: reponses[i++] }] }) }) } } };
  const avant = readFileSync(new URL('../contenus/tendances.json', import.meta.url), 'utf8');
  const res = await analyserSemaine({ client, dryRun: true, log: () => {} });
  assert.equal(readFileSync(new URL('../contenus/tendances.json', import.meta.url), 'utf8'), avant, 'aperçu : aucun fichier modifié');
  const a = res.appliques.join('\n');
  assert.match(a, /Ton week-end commence ici/);
  assert.doesNotMatch(a, /Télécharge/, 'texte interdit refusé');
  assert.match(a, /#nicebynight/);
  assert.doesNotMatch(a, /pas un hashtag|#teufyparty/);
  assert.doesNotMatch(a, /hashtags max/, 'pas de changement de règle sans source officielle');
  assert.match(res.md, /Objectif des prochains posts/);
});
