"""Montage « fête » pour TikTok (22/11/2026, directeur : « je veux voir des gens qui s'amusent, qui font la fête ; ça doit être
captivant, viral, pas une campagne marketing ; pas forcément montrer l'application »). Principes : on démarre SUR la drop
(pas d'intro), une coupe à chaque temps (ou deux temps pour les moments forts), zoom d'impact sur chaque temps, secousse sur les
basses, choix du passage le plus vivant de chaque vidéo (mouvement, couleurs), une seule phrase courte où l'on se reconnaît, en
haut, pendant toute la vidéo, 7 à 10 s pour qu'on la regarde en boucle, marque discrète.
Usage : python3 fete.py scenario.json
scenario = {sortie, musique, rythme, musique_debut, plans:[{fichier, fiche, temps}], phrase, marque?}
"""
import json, os, subprocess, sys, tempfile

L, H, FPS = 1080, 1920, 30
POLICE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'polices', 'InterDisplay-Black.otf')


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])


def esc(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", '’').replace('%', '\\%').replace(',', '\\,')


def passage_vivant(f, duree):
    """Fenêtre où ça bouge le plus (foule qui saute, bras, confettis), sans plan noir ni flou total."""
    ps = f['parsec']
    if f['duree'] <= duree + 0.3:
        return 0.0
    best, tb, t = -1e9, 0.2, 0.2
    while t + duree <= f['duree'] - 0.1:
        w = [p for p in ps if t <= p['t'] < t + duree] or ps[:1]
        mvt = sum(p['mvt'] for p in w) / len(w); lum = sum(p['luma'] for p in w) / len(w); net = sum(p['net'] for p in w) / len(w)
        s = min(mvt, 0.22) * 6 - abs(lum - 0.3) * 2 + min(net, 0.08) * 4 - (3 if lum < 0.08 else 0)
        if s > best:
            best, tb = s, t
        t += 0.25
    return round(tb, 2)


def grade(f):
    b = max(-0.1, min(0.12, (0.29 - f['luma']) * 0.6))
    s = max(0.9, min(1.4, 0.62 / max(f['saturation'], 0.05)))
    return f"eq=brightness={b:.3f}:contrast=1.12:saturation={s:.3f}"


def plan(c, duree, beat, sortie):
    # zoom d'impact à chaque temps (décroissance rapide) + secousse brève sur la basse
    z = f"(1.06+0.10*exp(-mod(t\\,{beat:.4f})/0.09))"
    sx = f"14*sin(t*73)*exp(-mod(t\\,{beat:.4f})/0.07)"
    vf = (f"scale={L}:{H}:force_original_aspect_ratio=increase,crop={L}:{H},fps={FPS},{grade(c['fiche'])},"
          f"scale=w='{L}*{z}':h=-2:eval=frame,crop={L}:{H}:x='(iw-{L})/2+{sx}':y='(ih-{H})/2+{sx}*0.6',setsar=1")
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{c['debut']:.3f}", '-t', f'{duree:.3f}', '-i', c['fichier'], '-an', '-vf', vf,
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', sortie])


def main(f):
    P = json.load(open(f))
    R = json.load(open(P['rythme']))
    temps = [b for b in R['temps'] if b >= P['musique_debut'] - 0.05]
    t0, beat = temps[0], 60 / R['bpm']
    tmp = tempfile.mkdtemp(prefix='fete-')
    k, out = 0, []
    for i, c in enumerate(P['plans']):
        d = temps[k + c['temps']] - temps[k]
        c = dict(c, fiche=json.load(open(c['fiche'])) if isinstance(c['fiche'], str) else c['fiche'])
        c.setdefault('debut', passage_vivant(c['fiche'], d))
        o = os.path.join(tmp, f'{i:02d}.mp4'); plan(c, d, beat, o); out.append(o); k += c['temps']
    total = temps[k] - t0
    open(os.path.join(tmp, 'l.txt'), 'w').write(''.join(f"file '{m}'\n" for m in out))
    brut = os.path.join(tmp, 'brut.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'l.txt'), '-c', 'copy', brut])
    lignes = P['phrase'].split('\n')
    taille = min(64, int(900 / (0.5 * max(len(l) for l in lignes))))
    vf = [f"drawtext=fontfile={POLICE}:text='{esc(l)}':fontsize={taille}:fontcolor=white:borderw=6:bordercolor=black:x=(w-text_w)/2:y={250 + n * int(taille * 1.15)}"
          for n, l in enumerate(lignes)]
    if P.get('marque', True):
        vf.append(f"drawtext=fontfile={POLICE}:text='teufy':fontsize=34:fontcolor=white@0.75:borderw=3:bordercolor=black@0.5:x=60:y=h-470")
    vf.append('noise=alls=4:allf=t')
    run(['ffmpeg', '-v', 'error', '-y', '-i', brut, '-ss', f'{t0:.3f}', '-t', f'{total:.3f}', '-i', P['musique'], '-vf', ','.join(vf),
         '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
         '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-shortest',
         '-movflags', '+faststart', P['sortie']])
    print(json.dumps({'sortie': P['sortie'], 'duree': round(total, 2), 'depart_musique': round(t0, 2)}))


if __name__ == '__main__':
    main(sys.argv[1])
