"""Prépare le plan d'un montage (22/11/2026) : choisit dans chaque vidéo le meilleur passage (net, ni trop sombre ni brûlé,
mouvement vivant sans secousse), le cale sur les temps de la musique (chaque plan dure un nombre entier de temps), et ordonne
les plans par teinte pour des enchaînements de couleurs doux.
Usage : python3 composer.py demande.json > plan.json
demande = {sortie, musique:{fichier, rythme(json de rythme.py), debut?}, plans:[{fichier, fiche(json de analyse_video.py)}],
           temps_par_plan:[...] (ex. [4,2,2,2,2,4]), accroche, sous?, fin?, ordonner_teintes?}
"""
import json, sys


def meilleur_passage(fiche, duree, deja=()):
    """Fenêtre de `duree` secondes au meilleur score (netteté, luminosité correcte, mouvement modéré)."""
    ps = fiche['parsec']
    if fiche['duree'] <= duree + 0.4:
        return 0.0
    best, t_best = -1e9, 0.3
    pas = 0.5
    t = 0.3
    while t + duree <= fiche['duree'] - 0.15:
        fen = [p for p in ps if t <= p['t'] < t + duree] or ps[:1]
        net = sum(p['net'] for p in fen) / len(fen)
        lum = sum(p['luma'] for p in fen) / len(fen)
        mvt = sum(p['mvt'] for p in fen) / len(fen)
        s = net * 10 - abs(lum - 0.28) * 3 - max(0, mvt - 0.18) * 8 + min(mvt, 0.12) * 2
        if any(abs(t - d) < duree for d in deja):
            s -= 5
        if s > best:
            best, t_best = s, t
        t += pas
    return round(t_best, 2)


def main(f):
    D = json.load(open(f))
    R = json.load(open(D['musique']['rythme']))
    debut = D['musique'].get('debut', R['meilleur']['debut'])
    temps = [b for b in R['temps'] if b >= debut]
    t0 = temps[0]
    plans = [dict(p, fiche=json.load(open(p['fiche'])) if isinstance(p['fiche'], str) else p['fiche']) for p in D['plans']]
    if D.get('ordonner_teintes'):
        # enchaînement par teinte voisine (en partant du premier plan, choisi pour l'accroche)
        reste, ordre = plans[1:], [plans[0]]
        while reste:
            h = ordre[-1]['fiche']['teinte']
            reste.sort(key=lambda p: min(abs(p['fiche']['teinte'] - h), 360 - abs(p['fiche']['teinte'] - h)))
            ordre.append(reste.pop(0))
        plans = ordre
    n = D['temps_par_plan']
    sortie, i = [], 0
    for k, p in enumerate(plans):
        if k >= len(n):
            break
        a, b = temps[i], temps[i + n[k]]
        duree = round(b - a, 3)
        sortie.append({'fichier': p['fichier'], 'fiche': p['fiche'], 'debut': meilleur_passage(p['fiche'], duree), 'duree': duree})
        i += n[k]
    print(json.dumps({'sortie': D['sortie'], 'musique': {'fichier': D['musique']['fichier'], 'debut': round(t0, 3)},
                      'plans': sortie, 'accroche': D['accroche'], 'sous': D.get('sous', ''), 'fin': D.get('fin', 'Toutes les soirées de la Côte'),
                      'bpm': R['bpm'], 'etalonnage': D.get('etalonnage', {'luma': 0.27, 'saturation': 0.55, 'chaleur': 0.03})}))


if __name__ == '__main__':
    main(sys.argv[1])
