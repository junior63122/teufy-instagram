import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versionGrande } from '../src/site.mjs';

test('affiches de billetterie : on demande la grande version de la même image', () => {
  assert.equal(versionGrande('https://assets.shotgun.live/image/upload/c_limit,w_384,fl_lossy,f_webp,q_5/dev/artworks/a.jpg'), 'https://assets.shotgun.live/image/upload/c_limit,w_1080,f_jpg,q_85/dev/artworks/a.jpg');
  assert.equal(versionGrande('https://thumb.bizouk.com/t/width=500,height=600,fit=scale-down/events/x.png?v=2'), 'https://thumb.bizouk.com/t/width=1080,height=1350,fit=scale-down/events/x.png?v=2');
  assert.equal(versionGrande('https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9zdGF0aWMucmEuY28vaW1hZ2VzL2NsdWJzL3VidS5qcGc_ZGF0ZVVwZGF0ZWQ9MTcxNDU0Njc1NTIyMA=='), 'https://static.ra.co/images/clubs/ubu.jpg?dateUpdated=1714546755220');
  // Autres sites et adresses inattendues : inchangées (jamais d'adresse inventée).
  assert.equal(versionGrande('https://exemple.fr/affiche.jpg'), 'https://exemple.fr/affiche.jpg');
  assert.equal(versionGrande('https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9ldmlsLmV4YW1wbGUv'), 'https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9ldmlsLmV4YW1wbGUv');
});
