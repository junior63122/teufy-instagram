import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import { analyserComptes, scoreHashtag, rapportTendances } from '../src/tendances.mjs';
import { hashtags, rng } from '../src/captions.mjs';
import { chooser } from '../src/learn.mjs';

const AUTO = new URL('../tendances-auto.json', import.meta.url);

test('veille : hashtags et formats des comptes suivis', async () => {
  const media = (h) => Array.from({ length: 10 }, (_, i) => ({
    caption: i % 2 ? `Ce soir ça part 🔥 #nicenightlife #afrohouse #${h}` : `Programme #nice #${h}`,
    like_count: i % 2 ? 300 : 40, comments_count: i % 2 ? 30 : 2,
    media_type: i % 2 ? 'VIDEO' : 'CAROUSEL_ALBUM', media_product_type: i % 2 ? 'REELS' : 'FEED',
    timestamp: `2026-11-0${(i % 7) + 1}T18:00:00+0000`, permalink: 'https://instagram.com/p/x',
  }));
  const api = { businessDiscovery: async (h) => ({ username: h, followers_count: 5000, media: { data: media(h) } }) };
  const t = await analyserComptes({ ig: {}, api, force: true });
  assert.ok(t.hashtags['#nicenightlife'] > t.hashtags['#nice'], 'les hashtags des posts qui marchent passent devant');
  assert.ok(t.formats.reel.score > t.formats.carrousel.score);
  assert.equal(scoreHashtag('#nicenightlife'), 1);
  assert.match(rapportTendances(), /Accroches des meilleurs posts/);
  const h = hashtags(chooser({ arms: {}, feats: {} }, rng('x')), 'commercial').split(' ');
  assert.equal(h[0], '#TeufyParty');
  assert.ok(h.length <= 5);
  if (existsSync(AUTO)) unlinkSync(AUTO);
});
