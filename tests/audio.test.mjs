import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motsDepuisAlignement, voixDisponibles } from '../src/audio.mjs';
import { surLaGrille, tempsBeat } from '../src/beat.mjs';

test('mots et minutage depuis l\'alignement ElevenLabs', () => {
  const t = 'Salut la Côte';
  const al = { characters: [...t], character_start_times_seconds: [...t].map((_, i) => i * 0.1), character_end_times_seconds: [...t].map((_, i) => i * 0.1 + 0.1) };
  const m = motsDepuisAlignement(al);
  assert.deepEqual(m.map((x) => x.mot), ['Salut', 'la', 'Côte']);
  assert.ok(Math.abs(m[1].debut - 0.6) < 1e-9);
});

test('voix off : ElevenLabs seulement avec une clé, Piper désactivé par défaut', () => {
  const avant = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  assert.deepEqual(voixDisponibles({ voix_off: { piper: false } }), []);
  process.env.ELEVENLABS_API_KEY = 'x';
  assert.deepEqual(voixDisponibles({ voix_off: {} }), ['elevenlabs']);
  if (avant) process.env.ELEVENLABS_API_KEY = avant; else delete process.env.ELEVENLABS_API_KEY;
});

test('coupes sur la grille du tempo', () => {
  const b = tempsBeat('club');
  const d = surLaGrille(2.1, 'club');
  assert.ok(Math.abs(d / b - Math.round(d / b)) < 1e-9);
});
