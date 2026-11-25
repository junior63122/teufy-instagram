#!/usr/bin/env bash
# Pousse le commit de l'historique des publications (25/11/2026 : un conflit de rebase avec un autre commit du robot a
# empêché l'historique d'arriver sur GitHub, et le passage suivant a republié le même carrousel). Si le rebase échoue, on
# repart de la version en ligne et on fusionne les deux historiques (union des publications, par identifiant Instagram).
set -u
for i in 1 2 3; do git pull --rebase -X theirs --autostash && git push && exit 0; git rebase --abort 2>/dev/null; sleep 5; done
cp historique.json /tmp/historique-local.json
git fetch origin main && git reset --hard origin/main || exit 1
node -e '
const fs = require("fs");
const lire = (f) => { const j = JSON.parse(fs.readFileSync(f, "utf8")); return Array.isArray(j) ? j : (j.posts || []); };
const enLigne = lire("historique.json"), local = lire("/tmp/historique-local.json");
const cle = (h) => h.media || `${h.id}|${h.date}`;
const vus = new Set(enLigne.map(cle));
const tout = [...enLigne, ...local.filter((h) => !vus.has(cle(h)))].sort((a, b) => String(a.le || a.date).localeCompare(String(b.le || b.date)));
fs.writeFileSync("historique.json", JSON.stringify(tout.slice(-300), null, 2));
'
git add historique.json && { git diff --cached --quiet || git commit -m "Teufy Instagram : historique fusionné après conflit"; }
for i in 1 2 3; do git pull --rebase -X theirs --autostash && git push && exit 0; git rebase --abort 2>/dev/null; sleep 5; done
echo "::error::Historique des publications NON enregistré sur GitHub : risque de doublon au passage suivant."
exit 1
