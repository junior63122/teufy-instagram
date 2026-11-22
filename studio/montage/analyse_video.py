"""Fiche qualité d'une vidéo pour les montages (22/11/2026) : luminosité, saturation, netteté, mouvement, teinte dominante,
empreinte (doublons). Les plans trop sombres, flous ou secoués sont écartés ; les teintes servent à enchaîner des plans qui
vont ensemble (pas de montage « grossier » aux couleurs incohérentes, demande du directeur).
Usage : python3 analyse_video.py fichier.mp4 → JSON sur la sortie standard.
"""
import json, subprocess, sys
import numpy as np

W, H = 96, 170


def images(f, fps=4):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', f'fps={fps},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255


def info(f):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration',
                                   '-of', 'json', f], capture_output=True, check=True).stdout)
    s = j['streams'][0]; n, d = s['r_frame_rate'].split('/')
    return {'largeur': s['width'], 'hauteur': s['height'], 'fps': round(int(n) / max(1, int(d)), 2), 'duree': round(float(j['format']['duration']), 2)}


def main(f):
    I = info(f)
    im = images(f)
    luma = im @ np.array([0.299, 0.587, 0.114])
    mx, mn = im.max(axis=3), im.min(axis=3)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lap = np.abs(4 * luma[:, 1:-1, 1:-1] - luma[:, :-2, 1:-1] - luma[:, 2:, 1:-1] - luma[:, 1:-1, :-2] - luma[:, 1:-1, 2:])
    nettete = lap.mean(axis=(1, 2))
    mouvement = np.abs(np.diff(luma, axis=0)).mean(axis=(1, 2)) if len(luma) > 1 else np.zeros(1)
    # teinte moyenne pondérée par la saturation (angle sur le cercle des couleurs)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    hx, hy = (2 * r - g - b) / 2, (np.sqrt(3) / 2) * (g - b)
    w = sat
    teinte = float(np.degrees(np.arctan2((hy * w).sum(), (hx * w).sum())) % 360)
    chaleur = float((r - b).mean())
    # empreinte : image du milieu réduite à 8x8, comparée à sa moyenne
    m = luma[len(luma) // 2][::H // 8 or 1, ::W // 8 or 1][:8, :8]
    emp = ''.join('1' if v else '0' for v in (m > m.mean()).flatten())
    # par seconde (pour choisir le meilleur passage de chaque plan)
    parsec = [{'t': round(i / 4, 2), 'luma': round(float(luma[i].mean()), 3), 'net': round(float(nettete[i]), 4),
               'mvt': round(float(mouvement[min(i, len(mouvement) - 1)]), 4)} for i in range(0, len(luma), 2)]
    print(json.dumps({**I, 'luma': round(float(luma.mean()), 3), 'saturation': round(float(sat.mean()), 3), 'nettete': round(float(nettete.mean()), 4),
                      'mouvement': round(float(mouvement.mean()), 4), 'teinte': round(teinte, 1), 'chaleur': round(chaleur, 3), 'empreinte': emp, 'parsec': parsec}))


if __name__ == '__main__':
    main(sys.argv[1])
