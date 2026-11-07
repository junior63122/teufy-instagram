import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { genererBeat } from '../src/beat.mjs';
import { analyserSon } from '../src/son.mjs';

test('tempo du morceau détecté pour caler les coupes', async () => {
  for (const [style, bpm] of [['club', 124], ['techno', 132]]) {
    const f = await genererBeat({ style, duree: 16, sortie: path.join(os.tmpdir(), `teufy-${style}.wav`) });
    const t = await analyserSon(f);
    assert.ok(Math.abs(t.bpm - bpm) < 1, `${style} : ${t.bpm} au lieu de ${bpm}`);
    assert.ok(t.phase >= 0 && t.phase < 60 / bpm);
  }
});
