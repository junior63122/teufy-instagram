import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ajouterSuggestion, cle } from '../src/suggestions-nuit.mjs';
import { questionDuJour } from '../src/stories.mjs';

test('suggestions : même lieu cité deux fois = une fiche, plusieurs personnes, toujours « à vérifier »', () => {
  const f = path.join(mkdtempSync(path.join(tmpdir(), 'sugg-')), 's.json');
  ajouterSuggestion({ nom: 'Snack du Port', ville: 'Cannes', origine: 'commentaire', auteur: 'a', ref: '1' }, { fichier: f });
  ajouterSuggestion({ nom: 'le snack du port', ville: 'Cannes', horaires: 'jusqu\'à 5h', origine: 'commentaire', auteur: 'b', ref: '2' }, { fichier: f });
  ajouterSuggestion({ nom: 'Snack du Port', ville: 'Cannes', origine: 'commentaire', auteur: 'b', ref: '2' }, { fichier: f }); // même commentaire relu
  const d = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(d.suggestions.length, 1);
  assert.equal(d.suggestions[0].personnes, 2);
  assert.equal(d.suggestions[0].mentions.length, 2);
  assert.equal(d.suggestions[0].statut, 'a_verifier');
  assert.equal(cle('Le Snack du Port', 'Cannes'), cle('snack du port', 'cannes'));
});

test('stories : vendredi et samedi, la question « où tu manges à 4 h » passe en priorité', () => {
  const questions = [{ id: 'x', q: 'Question normale ?' }, { id: 'faim-a', q: 'Tu manges où ?', theme: 'faim' }];
  const vendredi = Date.parse('2026-11-13T19:00:00Z'), mardi = Date.parse('2026-11-10T19:00:00Z');
  assert.equal(questionDuJour(vendredi, [], { questions, debats: [] }).cle, 'q-faim-a');
  assert.equal(questionDuJour(mardi, [], { questions, debats: [] }).cle, 'q-x');
});
