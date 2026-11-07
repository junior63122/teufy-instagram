// Génère des pages de test imitant Shotgun (schema.org + RSC) et DICE (__NEXT_DATA__).
import { writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('./fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
const ld = [
  ['Techno Bunker : Opening Season', '2026-11-13T23:00:00+01:00', 'Le Bunker', 'Nice', 15],
  ['Afro Vibes Night', '2026-11-14T22:30:00+01:00', 'Le Ghost', 'Nice', 12],
  ['House Rooftop Sunset', '2026-11-15T17:00:00+01:00', 'Rooftop Hôtel Aston', 'Nice', 0],
  ['Student Party Erasmus', '2026-11-11T22:00:00+01:00', 'Wayne\'s', 'Nice', 8],
  ['Paris Only Event', '2026-11-14T23:00:00+01:00', 'Rex Club', 'Paris', 20],
  ['Acid Rave 303', '2026-11-20T23:00:00+01:00', 'Le Six', 'Nice', 9],
  ['Hardgroove Session', '2026-11-21T23:30:00+01:00', 'La Cave', 'Cannes', 14],
  ['Shatta Fever', '2026-11-21T23:00:00+01:00', 'High Club', 'Nice', 10],
  ['Amapiano Sunday', '2026-11-22T16:00:00+01:00', 'Plage Beau Rivage', 'Nice', 0],
  ['Afterwork Électro', '2026-11-26T19:00:00+01:00', 'Le Bar Rooftop', 'Nice', 0],
  ['Techno Marathon', '2026-11-27T23:00:00+01:00', 'Le Bunker', 'Nice', 18],
  ['Industrial Night', '2026-11-28T23:00:00+01:00', 'Warehouse 06', 'Saint-Laurent-du-Var', 12],
  ['Raw Techno Club', '2026-11-29T00:30:00+01:00', 'Le Six', 'Nice', 8],
  ['RnB Friday', '2026-11-27T23:00:00+01:00', 'Le Ghost', 'Nice', 10],
  ['Disco Party Juan', '2026-11-28T22:00:00+01:00', 'Le Village', 'Juan-les-Pins', 5],
  ['Latino Night', '2026-11-29T21:00:00+01:00', 'Casa', 'Antibes', 0],
  ['Big Techno Festival', '2026-12-12T22:00:00+01:00', 'Palais Nikaïa', 'Nice', 35],
  ['NYE Monaco', '2026-12-31T22:00:00+01:00', 'Sporting', 'Monaco', 90],
  ['House Nation', '2026-12-05T23:00:00+01:00', 'Palais Club', 'Cannes', 25],
  ['Techno Lundi', '2026-11-02T23:00:00+01:00', 'Le Six', 'Nice', 8],
  ['Afro Night Novembre', '2026-11-06T23:00:00+01:00', 'High Club', 'Nice', 10],
  ['Rap Show Nice', '2026-11-07T21:00:00+01:00', 'Le Ghost', 'Nice', 15],
  ['Techno Nov 1', '2026-11-07T23:30:00+01:00', 'Le Bunker', 'Nice', 12],
  ['Hard Techno Early', '2026-11-05T23:30:00+01:00', 'Le Six', 'Nice', 9],
  ['Shatta Early', '2026-11-05T23:00:00+01:00', 'Le Ghost', 'Nice', 0],
].map(([name, startDate, v, city, price]) => ({ '@context': 'https://schema.org', '@type': 'MusicEvent', name, startDate,
  location: { '@type': 'Place', name: v, address: { '@type': 'PostalAddress', addressLocality: city } },
  url: '/fr/events/' + name.toLowerCase().replace(/\W+/g, '-'), image: [], offers: { '@type': 'Offer', price } }));
const rsc = JSON.stringify([ '$', 'div', null, { events: [{ title: 'Hard Techno Cannes', startTime: '2026-11-14T23:30:00.000Z', slug: 'hard-techno-cannes', venue: { name: 'Palais Club', city: 'Cannes' }, coverUrl: '' }] } ]);
writeFileSync(new URL('shotgun-shotgun-live-fr-cities-nice.html', dir), `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><script>self.__next_f.push([1,${JSON.stringify('5:' + rsc)}])</script></body></html>`);
const dice = { props: { pageProps: { events: [
  { name: 'Jazz Club Monaco Live', perm_name: 'jazz-monaco', dates: { event_start_date: '2026-11-12T21:00:00+01:00' }, venues: [{ name: 'Monte-Carlo Jazz', city: { name: 'Monaco' } }], images: { square: '' }, price: { amount: 2500 } },
  { name: 'Afro Vibes Night', perm_name: 'afro-vibes', dates: { event_start_date: '2026-11-14T22:30:00+01:00' }, venues: [{ name: 'Le Ghost', city: { name: 'Nice' } }], price: { amount: 1200 } },
  { name: 'Disco Antibes', perm_name: 'disco-antibes', dates: { event_start_date: '2026-11-15T23:00:00+01:00' }, venues: [{ name: 'La Siesta', city: { name: 'Antibes' } }] },
] } } };
writeFileSync(new URL('dice-dice-fm-browse-nice.html', dir), `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(dice)}</script></html>`);
console.log('ok');
