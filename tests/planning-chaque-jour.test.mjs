// 23/11/2026 (directeur : « la dernière publication date d'il y a deux jours, c'est absolument pas normal ») :
// chaque jour de la semaine a au moins une publication prévue dans le fil (post ou reel).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('planning : au moins une publication chaque jour (lundi à dimanche)', () => {
  const c = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
  for (let j = 1; j <= 7; j++) {
    const n = c.calendrier.filter((x) => x.jour === j).length + (c.calendrier_reels || []).filter((x) => x.jour === j).length;
    assert.ok(n > 0, `jour ${j} sans aucune publication prévue`);
  }
});
