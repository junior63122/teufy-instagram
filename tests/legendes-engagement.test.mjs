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
