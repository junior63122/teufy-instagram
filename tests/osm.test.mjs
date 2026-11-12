// Prospects OpenStreetMap : catégories, contacts publiés, filtres (fermés, restaurants sans contact, doublons).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prospectsDepuisOSM, prospectsOSM } from '../src/osm.mjs';
import { FAMILLE } from '../src/prospection.mjs';

const OSM = { elements: [
  { type: 'node', id: 1, tags: { name: 'High Club', amenity: 'nightclub', 'addr:city': 'Nice', email: 'contact@highclub.fr;booking@highclub.fr', website: 'highclub.fr', 'contact:instagram': 'https://www.instagram.com/highclubnice/' } },
  { type: 'node', id: 2, tags: { name: 'Bar fermé', amenity: 'bar', disused: 'yes', email: 'x@y.fr' } },
  { type: 'node', id: 3, tags: { name: 'Petit resto', amenity: 'restaurant', website: 'https://resto.fr' } },
  { type: 'way', id: 4, tags: { name: 'Bowling de Nice', leisure: 'bowling_alley', 'addr:city': 'Nice', 'contact:email': 'Info@Bowling.fr' } },
  { type: 'node', id: 5, tags: { name: 'High Club', amenity: 'nightclub', 'addr:city': 'Nice', email: 'autre@highclub.fr' } },
  { type: 'node', id: 6, tags: { name: 'Sans contact', amenity: 'bar' } },
  { type: 'node', id: 7, tags: { name: 'Fête Folie', shop: 'party', 'addr:city': 'Antibes', email: 'pas-une-adresse' , website: 'https://fete.fr' } },
] };

test('OpenStreetMap : seulement des établissements joignables, contacts publiés, sans doublon', () => {
  const l = prospectsDepuisOSM(OSM);
  assert.deepEqual(l.map((x) => x.nom), ['High Club', 'Bowling de Nice', 'Fête Folie']);
  const h = l[0];
  assert.equal(h.email, 'contact@highclub.fr');
  assert.equal(h.site, 'https://highclub.fr');
  assert.equal(h.instagram, 'highclubnice');
  assert.match(h.email_source, /openstreetmap\.org\/node\/1$/);
  assert.equal(l[1].email, 'info@bowling.fr');
  assert.equal(l[2].email, undefined); // adresse mal formée ignorée, le site reste
  assert.equal(FAMILLE(l[0].categorie), 'nuit');
  assert.equal(FAMILLE(l[1].categorie), 'activite');
  assert.equal(FAMILLE(l[2].categorie), 'boutique');
});

test('OpenStreetMap indisponible : aucune erreur, liste vide', async () => {
  const l = await prospectsOSM({ fetchFn: async () => { throw new Error('réseau'); }, log: () => {} });
  assert.deepEqual(l, []);
});
