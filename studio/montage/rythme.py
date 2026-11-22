"""Tempo et temps forts d'une musique (22/11/2026, directeur : « fais le montage avec les sons que je t'ai donnés, je mettrai
les mêmes depuis la bibliothèque TikTok : ça suivra le rythme »). Sans bibliothèque externe : ffmpeg décode, numpy calcule.
Usage : python3 rythme.py fichier_audio → JSON {bpm, duree, temps:[s...], meilleur:{debut, fin}} sur la sortie standard.
"""
import json, subprocess, sys
import numpy as np

SR, HOP = 11025, 128


def decoder(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def enveloppe(x):
    n = 1024
    trames = np.lib.stride_tricks.sliding_window_view(x, n)[::HOP] * np.hanning(n)
    spec = np.log1p(np.abs(np.fft.rfft(trames, axis=1)) * 10)
    flux = np.maximum(spec[1:] - spec[:-1], 0).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, 'same')  # enlève la tendance lente
    return np.maximum(flux, 0), np.sqrt((trames ** 2).mean(axis=1))


def tempo(env, fps):
    e = env - env.mean()
    ac = np.correlate(e, e, 'full')[len(e) - 1:]
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    ok = (bpm >= 70) & (bpm <= 180)
    poids = ac * np.exp(-0.5 * (np.log2(bpm / 120) / 0.9) ** 2)  # préférence douce autour de 120
    poids[~ok] = -np.inf
    lag = int(np.argmax(poids))
    return 60 * fps / lag, lag


def temps_forts(env, lag):
    # phase : la grille régulière (pas = lag) qui ramasse le plus d'énergie d'attaque, puis recalage local de chaque temps
    phases = [env[p::lag].sum() for p in range(lag)]
    p = int(np.argmax(phases))
    t, r = [], max(2, lag // 8)
    for b in range(p, len(env), lag):
        a, z = max(0, b - r), min(len(env), b + r + 1)
        t.append(a + int(np.argmax(env[a:z])))
    return np.array(t)


def main(f):
    x = decoder(f)
    fps = SR / HOP
    env, rms = enveloppe(x)
    bpm, lag = tempo(env[: int(fps * 240)], fps)
    beats = temps_forts(env, lag) / fps
    # section la plus énergique de 20 s (là où ça « part ») pour caler le montage
    fen = int(20 * fps)
    cum = np.concatenate([[0], np.cumsum(rms)])
    if len(rms) > fen:
        s = cum[fen:] - cum[:-fen]
        d = int(np.argmax(s[: max(1, len(s))]))
        debut = d / fps
    else:
        debut = 0.0
    print(json.dumps({'bpm': round(float(bpm), 1), 'duree': round(len(x) / SR, 2), 'temps': [round(float(b), 3) for b in beats],
                      'meilleur': {'debut': round(debut, 2), 'fin': round(debut + 20, 2)}, 'energie': round(float(rms.mean()), 4)}))


if __name__ == '__main__':
    main(sys.argv[1])
