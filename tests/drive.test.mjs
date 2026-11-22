// Dossier Drive du directeur : lecture de la vue publique (fichiers et sous-dossiers), sans clé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireVueDossier } from '../src/drive.mjs';

test('drive : fichiers et sous-dossiers lus dans la vue du dossier', () => {
  const html = `<div class="flip-entry"><a href="https://drive.google.com/file/d/AbC_123-x/view?usp=drive_web" target="_blank"><div class="flip-entry-title">Soirée &amp; foule.mp4</div></a></div>
<div class="flip-entry"><a href="https://drive.google.com/drive/folders/Dossier_9" target="_blank"><div class="flip-entry-title">Clients</div></a></div>`;
  assert.deepEqual(lireVueDossier(html), [{ id: 'AbC_123-x', nom: 'Soirée & foule.mp4', type: 'fichier' }, { id: 'Dossier_9', nom: 'Clients', type: 'dossier' }]);
});
