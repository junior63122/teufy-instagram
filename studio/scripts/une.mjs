// Stories « à la une » de @teufy_official : couvertures rondes + stories d'explication, dans la DA « Flash nuit ».
// Usage : node studio/scripts/une.mjs [dossier de sortie]  (défaut : media/a-la-une)
// Instagram ne permet pas de créer ni de modifier les « à la une » par son API : ces images sont à poster en story
// puis à épingler à la main (Profil → Nouveau → choisir les stories → couverture). Rien d'inventé : contenus tirés
// de config.json (tarifs, codes promo) et de ce que fait réellement le site.
import {readFileSync, existsSync} from 'node:fs';
import {mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(STUDIO, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'media', 'a-la-une'));
const config = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const site = config.site?.domaine || 'teufyparty.com';
const euros = (n) => `${String(n).replace('.', ',')} € HT`;
const F = config.site?.tarifs?.formules || [];
const f = (cle) => F.find((x) => x.cle === cle);
const jour = new Date().toISOString().slice(0, 10);
const codes = (config.codes_promo || []).filter((c) => !c.jusqu_au || c.jusqu_au >= jour);
const dateFr = (d) => new Intl.DateTimeFormat('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(`${d}T12:00:00Z`));

const UNE = [
  {cle: 'agenda', nom: 'AGENDA', stories: [
    {photo: 'foule', titre: 'Toutes les soirées de la [Côte]', lignes: ["Nice, Cannes, Antibes, Monaco et le Var", 'Mis à jour chaque jour, vérifié sur les billetteries', 'Ce soir, ce week-end, gratuit, par style'], pied: site},
    {photo: 'taxi', titre: 'Tu sors [ce soir] ?', lignes: ['Les soirées de ce soir, heure par heure', 'Les clubs et bars ouverts maintenant', "L'itinéraire et les billets en un clic"], pied: `${site}/ce-soir`},
  ]},
  {cle: 'infos', nom: 'INFOS', stories: [
    {photo: 'rire', titre: "Teufy, c'est [quoi] ?", lignes: ["Le guide des soirées de la Côte d'Azur et du Var", 'Chaque soirée vérifiée sur sa page officielle', 'Billets sur la billetterie officielle, sans frais en plus'], pied: site},
    {photo: 'selfie', titre: 'Comment [ça marche] ?', lignes: ['Cherche par ville, style, prix ou date', 'Enregistre tes soirées en favoris', 'Partage ta liste avec tes potes'], pied: site},
    {photo: 'dj', titre: 'Tu organises une [soirée] ?', lignes: ["L'ajout dans l'agenda est gratuit", "Envoie l'affiche, la date et le lien en DM", 'On vérifie et on la publie'], pied: `${site}/partenaires`},
  ]},
  ...(codes.length ? [{cle: 'avantages', nom: 'AVANTAGES', stories: codes.map((c, i) => ({photo: ['lasers', 'terrasse', 'rooftop'][i % 3], titre: `[${c.remise}] avec ${c.partenaire_nom || '@' + c.partenaire}`, lignes: [c.description, `Code : ${c.code}`, ...(c.jusqu_au ? [`Valable jusqu'au ${dateFr(c.jusqu_au)}`] : [])], pied: `Conditions sur ${site}`}))}] : []),
  {cle: 'themes', nom: 'THÈMES', stories: [
    {photo: 'lasers', titre: 'Une page par [style]', lignes: ['Techno, house, afro, shatta', 'Latino et rap', 'Soirées gratuites et soirées étudiantes'], pied: site},
  ]},
  ...(F.length ? [{cle: 'partenaires', nom: 'PARTENAIRES', stories: [
    {photo: 'dj', titre: 'Mets ta soirée en [avant]', lignes: [
      'Gratuit : ta soirée dans l\'agenda du site',
      ...(f('visibilite') ? [`Visibilité : ${euros(f('visibilite').prix)} par mois, 1 story dédiée`] : []),
      ...(f('premium') ? [`Premium : ${euros(f('premium').prix)} par mois, post + 2 stories`] : []),
      ...(f('post') && f('story') ? [`À l'unité : post ${euros(f('post').prix)}, story ${euros(f('story').prix)}`] : []),
    ], pied: `${site}/partenaires`},
  ]}] : []),
];

const B = process.env.CHROME_HEADLESS_SHELL || ['/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find(existsSync);
const serveUrl = await bundle({entryPoint: path.join(STUDIO, 'src', 'index.ts')});
const rendre = async (id, inputProps, sortie) => {
  const composition = await selectComposition({serveUrl, id, inputProps, browserExecutable: B});
  await renderStill({composition, serveUrl, output: sortie, inputProps, imageFormat: 'jpeg', jpegQuality: 92, browserExecutable: B});
};
await rm(OUT, {recursive: true, force: true});
const liste = [];
for (const [k, u] of UNE.entries()) {
  const d = path.join(OUT, `${k + 1}-${u.cle}`);
  await mkdir(d, {recursive: true});
  await rendre('une-couverture', {icone: u.cle}, path.join(d, '0-couverture.jpg'));
  for (const [i, s] of u.stories.entries()) {
    await rendre('une-story', {...s, titre: s.titre.replace(/ ([?!:])/g, '\u00a0$1'), photo: `decors/da/${s.photo}.jpg`, rubrique: u.nom, num: u.stories.length > 1 ? `${i + 1}/${u.stories.length}` : undefined}, path.join(d, `${i + 1}-story.jpg`));
  }
  liste.push(`${k + 1}. ${u.nom} : couverture + ${u.stories.length} story(s)`);
}
await writeFile(path.join(OUT, 'LISEZ-MOI.txt'), `Stories « à la une » de Teufy (générées le ${jour}).\n\n${liste.join('\n')}\n\nPour chaque dossier : publie les stories (dans l'ordre), ajoute un sticker Lien vers ${site} si tu veux,\npuis Profil → « Nouveau » (à la une) → choisis-les → « Modifier la couverture » → importe 0-couverture.jpg.\nPour remplacer une ancienne « à la une » : appuie longuement dessus → Modifier.\n`);
console.log(liste.join('\n'));
console.log(`→ ${OUT}`);
