import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationInconnue } from '../src/instagram.mjs';

// 25/11/2026 : carrousel publié deux fois (historique du premier envoi perdu sur GitHub).
test('publication du jour absente de l historique : repérée, pas de second envoi', () => {
  const medias = [{ id: '2', media_type: 'CAROUSEL_ALBUM', timestamp: '2026-11-25T16:23:30+0000' }, { id: '1', media_type: 'IMAGE', timestamp: '2026-11-25T16:57:00+0000' }];
  assert.equal(publicationInconnue(medias, [{ media: '1' }], { genre: 'CAROUSEL_ALBUM', jour: '2026-11-25' })?.id, '2');
  assert.equal(publicationInconnue(medias, [{ media: '1' }, { media: '2' }], { genre: 'CAROUSEL_ALBUM', jour: '2026-11-25' }), null);
  assert.equal(publicationInconnue(medias, [], { genre: 'VIDEO', jour: '2026-11-25' }), null);
  assert.equal(publicationInconnue(medias, [], { genre: 'CAROUSEL_ALBUM', jour: '2026-11-26' }), null);
});
