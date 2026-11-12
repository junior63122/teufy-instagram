#!/usr/bin/env node
// Images des lieux et affiches retrouvées sur Instagram (API officielle, comptes publics des lieux).
// Pour chaque lieu suivi : ses publications des 60 derniers jours et sa photo la plus aimée sont gardées
// (contenus/lieux-nuit.json → insta) ; la photo est copiée sur le site (les liens Instagram expirent) ; pour chaque soirée
// à venir chez ce lieu sans affiche, la publication qui annonce sa date est copiée comme affiche
// (contenus/affiches-instagram.json). La construction du site s'en sert ensuite (src/site.mjs → imagesManquantes).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { igConfig, businessDiscovery } from '../src/instagram.mjs';
import { annonceLaDate } from '../src/site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const h = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const sansAccent = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const normLieu = (x) => sansAccent(x).replace(/\b(le|la|les|l|club|bar|the)\b/g, '').replace(/[^a-z0-9]/g, '');
const jourParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.parse(d) - 5 * 3600e3));
const ig = igConfig();
if (!ig) { console.log('Pas de secrets Instagram : rien à faire.'); process.exit(0); }
const now = Date.now();
async function telecharger(url, f) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) return false; const tmp = `${f}.src`; writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', "scale='min(1080,iw)':-2", '-q:v', '3', f]); spawnSync('rm', ['-f', tmp]); return c.status === 0 && existsSync(f); } catch { return false; }
}
const webp = (f, l) => spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale='min(${l},iw)':-2`, '-c:v', 'libwebp', '-quality', '80', f.replace(/\.jpg$/, `-${l}.webp`)]);

const LN = lire('contenus/lieux-nuit.json', { lieux: [], insta: {} }); LN.insta ||= {};
const lieux = [...(LN.lieux || []), ...(lire('contenus/lieux-manuels.json', { lieux: [] }).lieux || [])].filter((l) => l.instagram);
const soirees = [...(lire('evenements-web.json', {}).evenements || []), ...lire('evenements-manuels.json', [])].filter((e) => e.start && Date.parse(e.start) > now - 6 * 3600e3 && Date.parse(e.start) < now + 45 * 864e5);
const AI = lire('contenus/affiches-instagram.json', {});
const aVenir = (l) => soirees.filter((e) => normLieu(l.nom).length >= 3 && (normLieu(e.venue) === normLieu(l.nom) || normLieu(e.venue).startsWith(normLieu(l.nom))));
// 1. Les comptes Instagram liés aux soirées SANS image (organisateur, lieu) : leur publication qui annonce la date est
//    presque toujours l'affiche. 2. Les lieux qui ont des soirées à venir. 3. Les données les plus anciennes.
const sansImage = soirees.filter((e) => !e.image);
const comptesSoirees = new Map();
// Seulement des comptes vérifiés qui correspondent à la soirée (jamais l'affiche d'un compte deviné, 12/11/2026).
const { comptesConfirmes } = await import('../src/comptes.mjs');
for (const e of sansImage) for (const c of comptesConfirmes(e)) { const k = String(c).replace(/^@/, '').toLowerCase(); if (/^[a-z0-9._]{2,30}$/.test(k) && !comptesSoirees.has(k)) comptesSoirees.set(k, { nom: e.venue || e.name, instagram: k, soirees: [] }); comptesSoirees.get(k)?.soirees.push(e); }
const deja = (c) => LN.insta[c] && now - Date.parse(LN.insta[c].le || 0) < 20 * 3600e3; // lu il y a moins de 20 h
const ordre = [
  ...[...comptesSoirees.values()].filter((c) => !deja(c.instagram)),
  ...[...new Map(lieux.map((l) => [l.instagram.toLowerCase(), l])).values()].filter((l) => !comptesSoirees.has(l.instagram.toLowerCase()))
    .sort((a, b) => (aVenir(b).length > 0) - (aVenir(a).length > 0) || Date.parse(LN.insta[a.instagram]?.le || 0) - Date.parse(LN.insta[b.instagram]?.le || 0)),
].slice(0, Number(process.env.MAX_IMAGES || 60));
mkdirSync(path.join(ROOT, 'site', 'lieux'), { recursive: true }); mkdirSync(path.join(ROOT, 'site', 'affiches'), { recursive: true });
let nPhotos = 0, nAffiches = 0, nLus = 0;
for (const l of ordre) {
  let bd;
  try { bd = await businessDiscovery(l.instagram, ig); nLus++; }
  catch (err) { if (/rate|limit|\(#4\)|\(#32\)|\(#17\)/i.test(err.message)) { console.log(`Limite Instagram atteinte après ${nLus} lieu(x).`); break; } LN.insta[l.instagram] = { ...(LN.insta[l.instagram] || {}), le: new Date().toISOString(), absent: true }; continue; }
  const medias = (bd?.media?.data || []).filter((m) => m.media_url && m.media_type !== 'VIDEO');
  const posts = medias.filter((m) => now - Date.parse(m.timestamp) < 60 * 864e5).map((m) => ({ u: m.media_url, c: String(m.caption || '').slice(0, 400), t: m.timestamp }));
  // Photo du lieu : jamais une affiche de soirée (12/11/2026 : l'affiche « Stanislas, 22 mai 2027 » servait de photo du
  // Frigo 16 sur d'autres soirées). Les publications qui annoncent une date ou des billets sont écartées.
  const ANNONCE = /(\b\d{1,2}\s*[./]\s*\d{1,2}\b|\b\d{1,2}(er)?\s+(janv|f[eé]v|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)|billet|ticket|pr[eé]vente|line.?up|shotgun|r[eé]serv|guest|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|ce soir|tonight|this (friday|saturday)|save the date|€)/i;
  const couv = [...medias].filter((m) => !ANNONCE.test(m.caption || '')).sort((a, b) => (b.like_count || 0) - (a.like_count || 0))[0];
  LN.insta[l.instagram] = { ...(LN.insta[l.instagram] || {}), le: new Date().toISOString(), absent: false, abonnes: bd?.followers_count ?? null, photo: bd?.profile_picture_url || LN.insta[l.instagram]?.photo || '', posts, couv: couv ? { u: couv.media_url, lien: couv.permalink || '' } : null };
  if (couv) {
    const f = path.join(ROOT, 'site', 'lieux', `${l.instagram.replace(/[^a-z0-9._-]/g, '')}-couv.jpg`);
    if (await telecharger(couv.media_url, f)) { webp(f, 480); webp(f, 800); nPhotos++; }
  }
  for (const e of [...new Set([...aVenir(l), ...(l.soirees || [])])].filter((x) => x && typeof x === 'object' && x.start && !isNaN(Date.parse(x.start)))) {
    if (e.image) continue; // la soirée a déjà son affiche officielle
    const cle = `${normLieu(e.venue)}|${jourParis(e.start)}`;
    if (AI[cle] && existsSync(path.join(ROOT, AI[cle].fichier))) continue;
    const jour = jourParis(e.start), lendemain = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date(Date.parse(`${jour}T12:00:00Z`) + 864e5));
    const p = posts.filter((x) => Date.parse(x.t) <= Date.parse(e.start) && (annonceLaDate(x.c, jour) || annonceLaDate(x.c, lendemain))).sort((a, b) => Date.parse(b.t) - Date.parse(a.t))[0];
    if (!p) continue;
    const f = path.join(ROOT, 'site', 'affiches', `${h(p.u.split('?')[0])}.jpg`);
    if (existsSync(f) || await telecharger(p.u, f)) { for (const w of [480, 800, 1080]) webp(f, w); AI[cle] = { fichier: path.relative(ROOT, f), source: `@${l.instagram}`, soiree: e.name, le: new Date().toISOString() }; nAffiches++; }
  }
}
writeFileSync(path.join(ROOT, 'contenus', 'lieux-nuit.json'), JSON.stringify(LN, null, 1) + '\n');
writeFileSync(path.join(ROOT, 'contenus', 'affiches-instagram.json'), JSON.stringify(AI, null, 1) + '\n');
console.log(`Images des lieux : ${nLus} compte(s) lu(s), ${nPhotos} photo(s) de lieu, ${nAffiches} affiche(s) retrouvée(s).`);
