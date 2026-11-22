"""Montage TikTok à histoire (22/11/2026, directeur : « tu crois vraiment que les gens vont regarder ça ? Ça doit donner envie
d'aller sur Teufy, de penser Teufy ; les 3 premières secondes sont ultra importantes ; à la rigueur des vibes Very Bad Trip ou
Projet X »). Différences avec montage.py : un récit (accroche choc, retour en arrière, Teufy à l'écran, montée, drop), des textes
qui changent au fil des temps de la musique, style des sous-titres TikTok (blanc cerné de noir), effets de coupe (zoom d'impact,
flash blanc sur la drop), écran du site filmé.
Usage : python3 tiktok.py scenario.json   (temps en nombre de temps musicaux depuis le début de l'extrait)
"""
import json, os, subprocess, sys, tempfile

L, H, FPS = 1080, 1920, 30
ICI = os.path.dirname(os.path.abspath(__file__))
POLICE = os.path.join(ICI, '..', 'polices', 'InterDisplay-Black.otf')


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])


def esc(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", '’').replace('%', '\\%').replace(',', '\\,')


def grade(f, cible):
    if not f:
        return 'null'
    b = max(-0.12, min(0.12, (cible['luma'] - f['luma']) * 0.6))
    s = max(0.8, min(1.35, cible['saturation'] / max(f['saturation'], 0.05)))
    t = max(-0.08, min(0.08, (cible['chaleur'] - f['chaleur']) * 0.35))
    return f"eq=brightness={b:.3f}:contrast=1.08:saturation={s:.3f},colorbalance=rm={t:.3f}:bm={-t:.3f}"


def plan(c, duree, cible, sortie):
    effets = []
    if c.get('effet') == 'punch':      # zoom d'impact : l'image « frappe » puis se pose (0,25 s)
        effets.append("scale=w='1080*(1+0.18*max(0\\,1-t/0.25))':h=-2:eval=frame,crop=1080:1920")
    else:                              # poussée lente commune
        effets.append(f"scale=w='1080*(1+0.05*t/{duree:.3f})':h=-2:eval=frame,crop=1080:1920")
    if c.get('desature'):
        effets.append('hue=s=0.35,eq=brightness=-0.05')
    if c.get('flash'):                 # flash blanc sur la drop
        effets.append("fade=t=in:st=0:d=0.18:color=white")
    if c.get('ecran'):
        # écran du site en « téléphone » au centre, sur un fond flouté du même écran : le texte du récit reste lisible au-dessus
        vf = (f"fps={FPS},split[a][b];[a]scale={L}:{H}:force_original_aspect_ratio=increase,crop={L}:{H},boxblur=30:2,eq=brightness=-0.25[fond];"
              f"[b]scale=780:-2,scale=w='780*(1+0.04*t/{duree:.3f})':h=-2:eval=frame,pad=iw+16:ih+16:8:8:color=0x222222[tel];"
              f"[fond][tel]overlay=(W-w)/2:480,crop={L}:{H},setsar=1")
        run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{c.get('debut', 0):.3f}", '-t', f'{duree:.3f}', '-i', c['fichier'], '-an', '-filter_complex', vf,
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', sortie])
        return
    vf = (f"scale={L}:{H}:force_original_aspect_ratio=increase,crop={L}:{H},fps={FPS},"
          f"{grade(c.get('fiche'), cible)},{','.join(effets)},setsar=1")
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{c.get('debut', 0):.3f}", '-t', f'{duree:.3f}', '-i', c['fichier'], '-an', '-vf', vf,
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', sortie])


STYLES = {
    # sous-titre TikTok : blanc cerné de noir, centré dans la zone sûre
    'accroche': dict(taille=92, couleur='white', bord=8, y=700),
    'recit': dict(taille=70, couleur='white', bord=7, y=420),
    'fin': dict(taille=76, couleur='white', bord=8, y=760),
}


def textes(T, temps, t0):
    out = []
    at = lambda k: temps[k] - t0
    for x in T:
        a, b = at(x['de']), at(x['a'])
        en = f"between(t,{a:.3f},{b:.3f})"
        st = x.get('style', 'recit')
        if st == 'heure':   # horodatage façon caméra, en haut à gauche sous l'interface TikTok
            out.append(f"drawtext=fontfile={POLICE}:text='{esc(x['texte'])}':fontsize=46:fontcolor=0x0B0B0F:box=1:boxcolor=0xFF5A3C:boxborderw=14:x=70:y=300:enable='{en}'")
            continue
        if st == 'lien':
            out.append(f"drawtext=fontfile={POLICE}:text='{esc(x['texte'])}':fontsize=60:fontcolor=0x0B0B0F:box=1:boxcolor=0xFF5A3C:boxborderw=22:x=(w-text_w)/2:y={x.get('y', 980)}:enable='{en}'")
            continue
        s = STYLES[st]
        lignes = x['texte'].split('\n')
        taille = min(s['taille'], int(900 / (0.5 * max(len(l) for l in lignes))))
        y0 = x.get('y', s['y'])
        for k, l in enumerate(lignes):
            out.append(f"drawtext=fontfile={POLICE}:text='{esc(l)}':fontsize={taille}:fontcolor={s['couleur']}:borderw={s['bord']}:bordercolor=black:"
                       f"x=(w-text_w)/2:y={y0 + k * int(taille * 1.12)}:enable='{en}'")
    return out


def main(f):
    P = json.load(open(f))
    R = json.load(open(P['rythme']))
    t0 = P['musique_debut']
    temps = [b for b in R['temps'] if b >= t0 - 0.05]
    t0 = temps[0]
    tmp = tempfile.mkdtemp(prefix='tiktok-')
    cible = P.get('etalonnage', {'luma': 0.27, 'saturation': 0.6, 'chaleur': -0.02})
    k, morceaux = 0, []
    for i, c in enumerate(P['plans']):
        d = temps[k + c['temps']] - temps[k]
        o = os.path.join(tmp, f'{i:02d}.mp4')
        plan(c, d, cible, o)
        morceaux.append(o)
        k += c['temps']
    total = temps[k] - t0
    liste = os.path.join(tmp, 'l.txt')
    open(liste, 'w').write(''.join(f"file '{m}'\n" for m in morceaux))
    brut = os.path.join(tmp, 'brut.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', brut])
    vf = textes(P['textes'], temps, t0) + ['noise=alls=4:allf=t']
    os.makedirs(os.path.dirname(P['sortie']) or '.', exist_ok=True)
    run(['ffmpeg', '-v', 'error', '-y', '-i', brut, '-ss', f'{t0:.3f}', '-t', f'{total:.3f}', '-i', P['musique'],
         '-vf', ','.join(vf), '-af', f"afade=t=out:st={max(0, total - 0.5):.3f}:d=0.5,loudnorm=I=-14:TP=-1.5:LRA=11",
         '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-maxrate', '7M', '-bufsize', '14M',
         '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', P['sortie']])
    print(json.dumps({'sortie': P['sortie'], 'duree': round(total, 2), 'depart_musique': round(t0, 2)}))


if __name__ == '__main__':
    main(sys.argv[1])
