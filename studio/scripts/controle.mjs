// Contrôle qualité avant publication. Bloque un export qui ne respecte pas les règles techniques
// d'Instagram ou qui présente un défaut visible : node scripts/controle.mjs fichier.mp4|png …
// Code de sortie 1 si un contrôle bloquant échoue.
import {spawnSync} from 'node:child_process';
import {statSync} from 'node:fs';

const sh = (cmd, args) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 64e6});
const probe = (f) => JSON.parse(sh('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).stdout || '{}');

export function controler(f) {
  const res = [];
  const ok = (nom, bon, detail, bloquant = true) => res.push({nom, ok: !!bon, detail, bloquant});
  const p = probe(f);
  const v = (p.streams || []).find((s) => s.codec_type === 'video');
  const a = (p.streams || []).find((s) => s.codec_type === 'audio');
  const taille = statSync(f).size;
  if (/\.(png|jpe?g)$/i.test(f)) {
    ok('format 4:5 (1080×1350) ou carré', v && v.width === 1080 && [1350, 1080].includes(v.height), `${v?.width}×${v?.height}`);
    ok('poids < 8 Mo', taille < 8e6, `${(taille / 1e6).toFixed(1)} Mo`);
    return res;
  }
  const duree = parseFloat(p.format?.duration || 0);
  const debit = parseFloat(p.format?.bit_rate || 0) / 1e6;
  const [n, d] = (v?.r_frame_rate || '0/1').split('/').map(Number);
  ok('vertical 1080×1920', v && v.width === 1080 && v.height === 1920, `${v?.width}×${v?.height}`);
  ok('H.264 yuv420p', v?.codec_name === 'h264' && v?.pix_fmt === 'yuv420p', `${v?.codec_name} ${v?.pix_fmt}`);
  ok('30 ou 60 i/s', [30, 60].includes(Math.round(n / d)), `${(n / d).toFixed(2)} i/s`);
  ok('durée 5 à 90 s', duree >= 5 && duree <= 90, `${duree.toFixed(1)} s`);
  ok('débit ≤ 25 Mbit/s', debit <= 25, `${debit.toFixed(1)} Mbit/s`);
  ok('fichier < 95 Mo (dépôt GitHub)', taille < 95e6, `${(taille / 1e6).toFixed(1)} Mo`);
  ok('piste audio AAC', a?.codec_name === 'aac', a?.codec_name || 'aucune');
  if (a) {
    const eb = sh('ffmpeg', ['-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
    const I = parseFloat((eb.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.split(/\s+/)[1]);
    const crete = parseFloat((eb.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.split(/\s+/)[1]);
    ok('volume −17 à −11 LUFS', I >= -17 && I <= -11, `${I} LUFS`, false);
    ok('pas de saturation (crête ≤ −0,5 dBFS)', !(crete > -0.5), `${crete} dBFS`, false);
  }
  // Images noires (plus de 0,4 s) et images figées (plus de 1,5 s) : défauts de rendu ou de montage.
  const bd = sh('ffmpeg', ['-hide_banner', '-i', f, '-vf', 'blackdetect=d=0.4:pix_th=0.06', '-an', '-f', 'null', '-']).stderr;
  const noirs = (bd.match(/black_start:[\d.]+/g) || []).map((x) => x.split(':')[1]);
  ok('aucun écran noir > 0,4 s', !noirs.length, noirs.length ? `à ${noirs.join(', ')} s` : 'aucun');
  const fz = sh('ffmpeg', ['-hide_banner', '-i', f, '-vf', 'freezedetect=n=0.002:d=1.5', '-an', '-f', 'null', '-']).stderr;
  const figes = (fz.match(/freeze_start: [\d.]+/g) || []).map((x) => x.split(': ')[1]);
  ok('aucune image figée > 1,5 s', !figes.length, figes.length ? `à ${figes.join(', ')} s` : 'aucune', false);
  // Première image non vide (c'est la vignette dans le fil).
  const st = sh('ffmpeg', ['-hide_banner', '-i', f, '-vf', 'select=eq(n\\,0),signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-frames:v', '1', '-f', 'null', '-']).stderr;
  const yavg = parseFloat((st.match(/YAVG=([\d.]+)/) || [])[1]);
  ok('1re image visible (luminance > 12)', yavg > 12, `luminance ${yavg?.toFixed?.(0)}`, false);
  return res;
}

if (process.argv[1].endsWith('controle.mjs')) {
  let echec = false;
  for (const f of process.argv.slice(2)) {
    const r = controler(f);
    console.log(`\n${f}`);
    for (const x of r) { console.log(`  ${x.ok ? '✅' : x.bloquant ? '❌' : '⚠️ '} ${x.nom} : ${x.detail}`); if (!x.ok && x.bloquant) echec = true; }
  }
  process.exit(echec ? 1 : 0);
}
