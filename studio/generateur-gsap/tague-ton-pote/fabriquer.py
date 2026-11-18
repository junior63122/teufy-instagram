# « Tague ton pote » : fabrique un épisode à partir d'un fichier episodes/NN-sujet.json (sans IA, sans voix).
# Usage : python3 fabriquer.py NN-sujet   → dossier NN-sujet/ (index.html, episode.js, timeline_fr.json, mix_fr.m4a)
# puis : node ../rendu.cjs NN-sujet 1 NN-sujet/video_silent.mp4 && ffmpeg … && python3 ../controle.py …
import json,os,shutil,subprocess,sys
nom=sys.argv[1];E=json.load(open(f'episodes/{nom}.json'));D=nom
if os.path.exists(D):shutil.rmtree(D)
shutil.copytree('modele',D);open(f'{D}/episode.js','w').write('window.EP='+json.dumps(E,ensure_ascii=False)+';')
# minutage : accroche 1,7 s, puis chaque type 2,4 s (chute à +1,05 s), fin 2,3 s — calé sur le tempo de la musique
HOOK,TYPE,CHUTE,FIN=1.7,2.4,1.05,2.3
mots=lambda txt,t0,pas=.12:[[w,round(t0+i*pas,3),round(t0+i*pas+.1,3)] for i,w in enumerate(txt.replace('<br>',' ').replace('<em>','').replace('</em>','').split())]
TL=[{'i':0,'start':0,'dur':HOOK,'words':mots('TAGUE le pote qui… '+E['sous_texte'],0,.1)}];t=HOOK
for k,ty in enumerate(E['types']):
    TL.append({'i':k+1,'start':round(t,3),'dur':TYPE,'words':[[ty['ligne_texte'],round(t,3),round(t+.5,3)],[ty['chute_texte'],round(t+CHUTE,3),round(t+CHUTE+.6,3)]]});t+=TYPE
TL.append({'i':len(TL),'start':round(t,3),'dur':FIN,'words':[['Tague-les en commentaire',round(t,3),round(t+.8,3)]]})
json.dump(TL,open(f'{D}/timeline_fr.json','w'),ensure_ascii=False)
# son : musique (src/beat.mjs) + bruitages synthétisés (son/synthe.py) + Mixkit sans note tenue
R=os.path.abspath('../../..')
subprocess.run(['node','-e',f"import('{R}/src/beat.mjs').then(m=>m.genererBeat({{style:'{E.get('style','club')}',duree:{t+FIN+1},sortie:'{os.path.abspath(D)}/son/beat.wav',seed:{E.get('graine',11)}}}))"],check=True)
subprocess.run(['python3','son/synthe.py'],cwd=D,check=True,capture_output=True)
ev=[('sub',0,.8),('kick',0,.6),('snap',.6,.4),('kick',.6,.5)]
for g in TL[1:-1]:
    a,c=g['words'][0][1],g['words'][1][1];ev+=[('swoosh',a-.08,.5),('kick',a,.6),('snap',a,.4),('kick',c+.17,.7),('tampon',c+.17,.8),('clic',c+.35,.4)]
f=TL[-1]['start'];ev+=[('montee',f-1.3,.35),('sub',f,.9),('snap',f,.5),('acclamation',f+.2,.35)];END=f+FIN
inp=['-i',f'{D}/son/beat.wav'];flt=[f'[0]atrim=0:{END},afade=t=out:st={END-0.8:.2f}:d=0.8,volume=0.9[m]'];bed=['[m]']
for k,(n,tt,v) in enumerate(ev,1):
    fi=f'{D}/son/{n}.wav' if os.path.exists(f'{D}/son/{n}.wav') else f'{D}/son/{n}.mp3';ms=int(max(tt,0)*1000)
    inp+=['-i',fi];flt.append(f'[{k}]adelay={ms}|{ms},volume={v}[e{k}]');bed.append(f'[e{k}]')
flt.append(''.join(bed)+f'amix=inputs={len(bed)}:normalize=0:duration=longest,atrim=0:{END},alimiter=limit=0.95[a]')
subprocess.run(['ffmpeg','-loglevel','error','-y',*inp,'-filter_complex',';'.join(flt),'-map','[a]','-ac','2','-ar','48000','-c:a','aac','-b:a','192k',f'{D}/mix_fr.m4a'],check=True)
print(D,'prêt :',round(END,2),'s')
