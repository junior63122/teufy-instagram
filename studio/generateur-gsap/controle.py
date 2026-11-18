#!/usr/bin/env python3
"""Contrôle qualité automatique d'une vidéo AVANT publication.

Usage : python3 tools/qa.py <video.mp4> <timeline.json> [vitesse]
Mesure ce qu'on peut mesurer objectivement et le compare aux règles du
carnet (CARNET.md). Sort un rapport et un code de sortie 1 si une règle
BLOQUANTE est violée. Les seuils sont dans SEUILS ci-dessous : les ajuster
quand les données (data/episodes.jsonl) montrent mieux.
"""
import json, re, subprocess, sys

SEUILS = {
    "duree_max_s": 45,            # au-delà : rétention qui chute (retour propriétaire)
    "duree_min_s": 12,
    "mots_avant_1s5_min": 3,      # l'accroche doit avoir commencé avant 1,5 s
    "trou_voix_max_s": 0.45,      # silence entre deux mots (après vitesse)
    "plan_moyen_max_s": 2.5,      # durée moyenne d'un plan (changements de plan)
    "plan_max_s": 4.5,            # aucun plan plus long que ça
    "loudness_cible_lufs": (-16, -11),
    "fin_apres_derniere_parole_max_s": 2.0,
    "seconde_morte_abs": 1.8,      # mouvement moyen (0-255) sous ce seuil = seconde « morte » (calibré le 10/11/2026)
    "secondes_mortes_max": 2,      # règle : capter l'attention à CHAQUE seconde (CARNET R1)
}

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stderr + subprocess.run(cmd, capture_output=True, text=True).stdout

def duree(video):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",video],capture_output=True,text=True).stdout
    return float(out.strip())

def plans(video, d):
    """Détecte les changements de plan (scene detection ffmpeg)."""
    err = subprocess.run(["ffmpeg","-i",video,"-vf","select='gt(scene,0.28)',showinfo","-f","null","-"],capture_output=True,text=True).stderr
    ts = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", err)]
    cuts = [0.0] + ts + [d]
    lens = [b - a for a, b in zip(cuts, cuts[1:]) if b - a > 0.05]
    return ts, lens

def secondes_mortes(video, d):
    """Mouvement à l'écran seconde par seconde (images 96x170 en niveaux de gris, 10 i/s)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg","-loglevel","error","-i",video,"-vf","fps=10,scale=96:170,format=gray","-f","rawvideo","-"],capture_output=True).stdout
    f = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 170, 96).astype(np.float32)
    diff = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    par_s = [float(diff[i*10:(i+1)*10].mean()) for i in range(int(len(diff)/10))]
    med = sorted(par_s)[len(par_s)//2] if par_s else 0
    mortes = [i for i, v in enumerate(par_s) if v < SEUILS["seconde_morte_abs"]]
    return par_s, mortes

def loudness(video):
    err = subprocess.run(["ffmpeg","-i",video,"-af","ebur128","-f","null","-"],capture_output=True,text=True).stderr
    m = re.findall(r"I:\s+(-?[0-9.]+) LUFS", err)
    return float(m[-1]) if m else None

def main():
    video, tlp = sys.argv[1], sys.argv[2]
    f = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    tl = json.load(open(tlp))
    words = [(w, s / f, e / f) for g in tl for (w, s, e) in g["words"] if re.search(r"\w", w)]
    d = duree(video)
    gaps = [(words[i][0], words[i+1][0], words[i+1][1] - words[i][2]) for i in range(len(words)-1)]
    big_gaps = [g for g in gaps if g[2] > SEUILS["trou_voix_max_s"]]
    early = [w for w in words if w[1] < 1.5]
    cuts, lens = plans(video, d)
    lufs = loudness(video)
    fin = d - words[-1][2]
    mvt, mortes = secondes_mortes(video, d)
    R = []  # (niveau, règle, ok, détail)
    R.append(("BLOQUANT","Durée", SEUILS["duree_min_s"] <= d <= SEUILS["duree_max_s"], f"{d:.1f} s"))
    R.append(("BLOQUANT","Accroche parlée avant 1,5 s", len(early) >= SEUILS["mots_avant_1s5_min"], f"{len(early)} mots : {' '.join(w[0] for w in early)}"))
    R.append(("ALERTE","Pas de trou dans la voix", not big_gaps, f"{len(big_gaps)} trous > {SEUILS['trou_voix_max_s']} s " + "; ".join(f"{a}→{b} {g:.2f}s" for a,b,g in big_gaps[:4])))
    moy = sum(lens)/len(lens) if lens else d
    R.append(("ALERTE","Rythme des plans (moyenne)", moy <= SEUILS["plan_moyen_max_s"], f"{len(lens)} plans, moyenne {moy:.2f} s"))
    R.append(("ALERTE","Aucun plan trop long", max(lens) <= SEUILS["plan_max_s"], f"plus long : {max(lens):.2f} s"))
    lo, hi = SEUILS["loudness_cible_lufs"]
    R.append(("ALERTE","Volume (LUFS)", lufs is not None and lo <= lufs <= hi, f"{lufs} LUFS (cible {lo} à {hi})"))
    R.append(("ALERTE","Attention à chaque seconde", len(mortes) <= SEUILS["secondes_mortes_max"], f"{len(mortes)} seconde(s) quasi immobile(s) : " + ", ".join(f"{m}-{m+1}s" for m in mortes[:8])))
    R.append(("ALERTE","Fin courte après la dernière réplique", fin <= SEUILS["fin_apres_derniere_parole_max_s"], f"{fin:.2f} s"))
    print(f"\nCONTRÔLE QUALITÉ — {video}")
    bloque = False
    for niv, nom, ok, det in R:
        print(f"  {'✅' if ok else ('⛔' if niv=='BLOQUANT' else '⚠️ ')} {nom:38s} {det}")
        bloque |= (niv == "BLOQUANT" and not ok)
    print("\nÀ vérifier À L'ŒIL (images extraites par build) : titre lisible dès l'image 0, sous-titres jamais sur les visages,")
    print("une vanne par scène, une vraie info sourcée, vote en UN mot à la fin, rien de politique ni de diffamatoire.")
    json.dump({"duree":d,"mots_avant_1s5":len(early),"trous_voix":len(big_gaps),"nb_plans":len(lens),"plan_moyen":round(moy,2),"plan_max":round(max(lens),2),"lufs":lufs,"fin":round(fin,2),"secondes_mortes":mortes}, open(video+".qa.json","w"))
    sys.exit(1 if bloque else 0)

if __name__ == "__main__":
    main()
