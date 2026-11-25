import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { construireTiktok } from '../src/tiktok.mjs';

// 25/11/2026 : TikTok en pause (directeur) : aucun planning, aucune vidéo archivée.
test('TikTok en pause : plan vide, rien archivé', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'tk-'));
  mkdirSync(path.join(root, 'contenus')); mkdirSync(path.join(root, 'media', 'tiktok'), { recursive: true });
  writeFileSync(path.join(root, 'media', 'reel-x.mp4'), 'x');
  writeFileSync(path.join(root, 'contenus', 'tiktok.json'), JSON.stringify({ pause: 'test', plan: { '2026-11-25': [{ id: 'a' }] } }));
  const e = construireTiktok({ root, now: new Date('2026-11-25T12:00:00Z'), log: () => {} });
  assert.deepEqual(e.plan, {});
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, 'contenus', 'tiktok.json'), 'utf8')).plan, {});
  assert.ok(!existsSync(path.join(root, 'media', 'tiktok', 'reel-x.mp4')));
});

test('le dépôt est en pause TikTok tant que le directeur ne reprend pas', () => {
  assert.ok(JSON.parse(readFileSync(new URL('../contenus/tiktok.json', import.meta.url))).pause);
});
