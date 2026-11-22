"""Montage vidéo calé sur le rythme (22/11/2026, directeur : « fais le montage avec les sons que je t'ai donnés, moi je mettrai
les mêmes sons depuis la bibliothèque TikTok : au moins ça suivra le rythme » ; « que ça ne fasse pas bizarre, mauvais montage,
montage grossier, ou avec des couleurs ou un grain incohérents »).

Entrée : un plan JSON (voir composer() dans composer.py) ; sortie : une vidéo 1080x1920 30 i/s, coupes sur les temps de la
musique, couleurs ramenées vers une même étalonnage (luminosité, contraste, saturation, température), léger grain commun pour
fondre des sources différentes, texte d'accroche dans la zone sûre TikTok (ni le haut, ni la colonne de droite, ni le bas où
s'affichent la légende et les boutons), carte de fin Teufy. Le son de la musique est gardé dans le fichier comme repère de rythme.
Usage : python3 montage.py plan.json
"""
import json, os, subprocess, sys, tempfile

L, H, FPS = 1080, 1920, 30
ICI = os.path.dirname(os.path.abspath(__file__))
POLICE_TITRE = os.path.join(ICI, '..', 'polices', 'InterDisplay-Black.otf')
CREME, CORAIL, NUIT = '0xF4EFE6', '0xFF5A3C', '0x0B0B0F'


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])


def echapper(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", '’').replace('%', '\\%')


def etalonnage(f, cible):
    """Ramène chaque plan vers l'étalonnage commun du montage (mesures de analyse_video.py)."""
    luma, sat, chaleur = f['luma'], f['saturation'], f['chaleur']
    b = max(-0.12, min(0.12, (cible['luma'] - luma) * 0.6))          # éclaircit les plans sombres, calme les plans brûlés
    s = max(0.75, min(1.3, cible['saturation'] / max(sat, 0.05)))     # saturations rapprochées
    t = max(-0.08, min(0.08, (cible['chaleur'] - chaleur) * 0.35))    # température rapprochée (rouge ↔ bleu)
    return f"eq=brightness={b:.3f}:contrast=1.06:saturation={s:.3f},colorbalance=rm={t:.3f}:bm={-t:.3f}:rh={t/2:.3f}:bh={-t/2:.3f}"


def plan_video(src, debut, duree, fiche, cible, sortie, zoom):
    vf = (f"scale={L}:{H}:force_original_aspect_ratio=increase,crop={L}:{H},fps={FPS},"
          f"{etalonnage(fiche, cible)},"
          # léger mouvement de caméra commun (poussée lente) : les plans fixes ne « tombent » pas
          f"scale=w='{L}*(1+{zoom}*t/{duree:.3f})':h=-2:eval=frame,crop={L}:{H},setsar=1")
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{debut:.3f}', '-t', f'{duree:.3f}', '-i', src, '-an', '-vf', vf,
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', sortie])


def main(p):
    P = json.load(open(p))
    tmp = tempfile.mkdtemp(prefix='montage-')
    cible = P.get('etalonnage', {'luma': 0.27, 'saturation': 0.55, 'chaleur': 0.03})
    morceaux = []
    for i, c in enumerate(P['plans']):
        o = os.path.join(tmp, f'{i:02d}.mp4')
        plan_video(c['fichier'], c['debut'], c['duree'], c['fiche'], cible, o, 0.06 if i % 2 == 0 else 0.04)
        morceaux.append(o)
    liste = os.path.join(tmp, 'liste.txt')
    open(liste, 'w').write(''.join(f"file '{m}'\n" for m in morceaux))
    total = sum(c['duree'] for c in P['plans'])
    brut = os.path.join(tmp, 'brut.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', brut])

    # Texte : accroche (0 → accroche_fin), carte de fin (dernières secondes). Zone sûre : x de 90 à 900, y de 620 à 1250.
    sous = echapper(P.get('sous', ''))
    fin_t = total - P.get('duree_fin', 1.7)
    af = P.get('accroche_fin', 2.4)
    txt = [
        # voile discret derrière le texte pour la lisibilité sur n'importe quel plan
        f"drawbox=x=0:y=560:w={L}:h=760:color=black@0.28:t=fill:enable='lt(t,{af})+gte(t,{fin_t})'",
    ]
    lignes = P['accroche'].split('\n')
    # taille qui tient dans la zone sûre (900 px de large) : la plus longue ligne décide (Inter Black ≈ 0,5 em par signe)
    taille = min(96, int(880 / (0.5 * max(len(l) for l in lignes))))
    for k, ligne in enumerate(lignes):  # une ligne = un texte centré (les lignes d'un même texte s'aligneraient à gauche)
        y = 800 - (len(lignes) - 1) * int(taille * 0.58) + k * int(taille * 1.15) - taille // 2
        txt.append(f"drawtext=fontfile={POLICE_TITRE}:text='{echapper(ligne)}':fontcolor={CREME}:fontsize={taille}:x=(w-text_w)/2:y={y}:"
                   f"shadowcolor=black@0.6:shadowx=0:shadowy=4:enable='lt(t,{af})'")
    if sous:
        txt.append(f"drawtext=fontfile={POLICE_TITRE}:text='{sous}':fontcolor={NUIT}:fontsize=40:x=(w-text_w)/2:y=940:box=1:boxcolor={CORAIL}:"
                   f"boxborderw=18:enable='lt(t,{af})'")
    txt += [
        f"drawtext=fontfile={POLICE_TITRE}:text='{echapper(P.get('fin', 'Toutes les soirées de la Côte'))}':fontcolor={CREME}:fontsize=64:"
        f"x=(w-text_w)/2:y=800:shadowcolor=black@0.6:shadowy=4:enable='gte(t,{fin_t})'",
        f"drawtext=fontfile={POLICE_TITRE}:text='teufyparty.com':fontcolor={NUIT}:fontsize=52:x=(w-text_w)/2:y=920:box=1:boxcolor={CORAIL}:"
        f"boxborderw=20:enable='gte(t,{fin_t})'",
        # grain commun très léger : fond les sources de qualités différentes (pas de « plan propre » au milieu de plans bruts)
        "noise=alls=5:allf=t",
    ]
    m = P['musique']
    sortie = P['sortie']
    os.makedirs(os.path.dirname(sortie) or '.', exist_ok=True)
    run(['ffmpeg', '-v', 'error', '-y', '-i', brut, '-ss', f"{m['debut']:.3f}", '-t', f'{total:.3f}', '-i', m['fichier'],
         '-vf', ','.join(txt), '-af', f"afade=t=in:d=0.08,afade=t=out:st={max(0, total - 0.6):.3f}:d=0.6,loudnorm=I=-14:TP=-1.5:LRA=11",
         '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', '-r', str(FPS),  # ≈ 10 Mo pour 13 s
         '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', sortie])
    print(json.dumps({'sortie': sortie, 'duree': round(total, 2), 'plans': len(morceaux)}))


if __name__ == '__main__':
    main(sys.argv[1])
