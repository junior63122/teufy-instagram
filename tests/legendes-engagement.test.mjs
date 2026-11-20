// Légendes (analyse de l'engagement du 20/11/2026) : aucun emoji, un appel à envoyer le post, abonnement gardé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerLegende } from '../src/captions.mjs';

test('aucun emoji, les puces deviennent des tirets, les phrases restent séparées', () => {
  const t = nettoyerLegende('Tu sors ? 👀\n🔥 ce soir\n📍 près de toi\nDe Toulon à Monaco 🌊 Tout est sur teufyparty.com\n\n#TeufyParty #nice');
  assert.doesNotMatch(t, /\p{Extended_Pictographic}/u);
  assert.match(t, /^- ce soir$/m);
  assert.match(t, /Monaco\. Tout est/);
});
test('appel à envoyer le post ajouté avant les hashtags, une seule fois', () => {
  const t = nettoyerLegende('Les soirées du week-end.\n\n#TeufyParty #nice');
  assert.match(t, /Envoie-le[^\n]*\n\n#TeufyParty #nice$/);
  assert.equal(nettoyerLegende(t), t);
});
test('l\'appel à s\'abonner des promos est gardé (demande du directeur)', () => {
  assert.match(nettoyerLegende('Abonne-toi à @teufy_official : l\'appli arrive bientôt 📲'), /Abonne-toi à @teufy_official/);
});

import { readdirSync, readFileSync } from 'node:fs';
test('« Tague ton pote » : aucun emoji dans les épisodes (visuels) ni les légendes, au moins 4 épisodes prêts', () => {
  const ep = new URL('../studio/generateur-gsap/tague-ton-pote/episodes/', import.meta.url);
  const md = new URL('../media/tague-ton-pote/', import.meta.url);
  for (const f of readdirSync(ep)) assert.doesNotMatch(readFileSync(new URL(f, ep), 'utf8'), /\p{Extended_Pictographic}/u, f);
  assert.doesNotMatch(readFileSync(new URL('../studio/generateur-gsap/tague-ton-pote/modele/index.html', import.meta.url), 'utf8'), /\p{Extended_Pictographic}/u);
  for (const f of readdirSync(md).filter((x) => x.endsWith('.txt'))) assert.doesNotMatch(readFileSync(new URL(f, md), 'utf8'), /\p{Extended_Pictographic}/u, f);
  assert.ok(readdirSync(md).filter((x) => x.endsWith('.mp4')).length >= 4);
});

// 20/11/2026 : aucun emoji dans les visuels (stories, couvertures, reels), et le débat garde ses options A et B.
test('visuels sans emoji, débat avec « A. » et « B. » lisibles', async () => {
  const { sansEmoji, captionDebat, nettoyerLegende } = await import('../src/captions.mjs');
  const { readFileSync } = await import('node:fs');
  assert.deepEqual(sansEmoji({ texte: 'Réponds en message 👀', image: 'evenements/auto/x.jpg', options: ['A 🔥', 'B'] }), { texte: 'Réponds en message', image: 'evenements/auto/x.jpg', options: ['A', 'B'] });
  const EMO = /\p{Extended_Pictographic}/u;
  for (const f of ['montage.mjs', 'motion.mjs', 'render.mjs']) assert.doesNotMatch(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), EMO, `emoji dans src/${f}`);
  // run.mjs : les ✅ du journal sont permis (jamais affichés sur un visuel), pas les autres.
  assert.doesNotMatch(readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8').replace(/✅/g, ''), EMO, 'emoji dans src/run.mjs');
  const ch = { pick: (_, l) => l[0], pickMany: (_, l, k) => l.slice(0, k) };
  const t = nettoyerLegende(captionDebat({ debat: { legende: 'Le débat.', a: 'Rooftop', b: 'Club' }, ch, r: () => 0.1 }));
  assert.match(t, /^A\. Rooftop$/m);
  assert.match(t, /^B\. Club$/m);
});
