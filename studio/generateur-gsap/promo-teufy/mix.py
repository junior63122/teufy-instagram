# Mixage de la promo Teufy : voix off + beat (src/beat.mjs, sans droits) qui s'efface sous la voix + bruitages Mixkit.
# Usage : python3 mix.py fr  →  mix_fr.m4a (avant accélération et normalisation, faites à l'assemblage).
import json,subprocess,sys
lang=sys.argv[1];TL=json.load(open(f'timeline_{lang}.json'));D=TL[-1]['start']+TL[-1]['dur']+1.0
SS=lambda i:TL[i]['start']
def wt(i,sub,n=0):
    ws=[w for w in TL[i]['words'] if sub in w[0].lower()];return ws[n][1] if len(ws)>n else SS(i)
# whoosh à chaque changement de plan, pop sur les apparitions (bulles, villes, styles, compteurs), impact sur l'appel final
ev=[('whoosh',SS(i)-.08,.5) for i in range(1,len(TL))]
ev+=[('pop',t,.45) for t in (.35,.75,1.15)]
ev+=[('pop',wt(2,m)-.08,.4) for m in ('nice','cannes','monaco','toulon')]
ev+=[('pop',wt(3,m)-.06,.4) for m in ('techno','house','afro','shatta')]
ev+=[('pop-dur',wt(1,'quatre'),.45),('pop-dur',SS(4)+.25,.45),('impact',SS(7),.55),('pop',wt(7,'abonne'),.6)]
ev+=[('pop-dur',wt(6,x)-.12,.45) for x in ('soirées','boîtes','plans')]
inputs=[];filt=[];vox=[];bed=[];k=0
for g in TL:
    inputs+=['-i',g['file']];d=int(g['start']*1000);filt.append(f'[{k}]adelay={d}|{d},volume=1.25[v{k}]');vox.append(f'[v{k}]');k+=1
inputs+=['-i','son/beat.wav'];filt.append(f'[{k}]atrim=0:{D},volume=0.55,afade=t=in:d=0.3,afade=t=out:st={D-1.2}:d=1.2[m]');bed.append('[m]');k+=1
for n,t,vol in ev:
    inputs+=['-i',f'son/{n}.mp3'];d=int(max(t,0)*1000);filt.append(f'[{k}]adelay={d}|{d},volume={vol}[e{k}]');bed.append(f'[e{k}]');k+=1
filt.append(''.join(vox)+f'amix=inputs={len(vox)}:normalize=0:duration=longest,asplit=2[vo1][vo2]')
filt.append(''.join(bed)+f'amix=inputs={len(bed)}:normalize=0:duration=longest[bed]')
# la musique et les bruitages baissent automatiquement quand la voix parle
filt.append('[bed][vo2]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=300:makeup=1[duck]')
filt.append(f'[vo1][duck]amix=inputs=2:normalize=0:duration=longest,atrim=0:{D},alimiter=limit=0.95[a]')
subprocess.run(['ffmpeg','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(filt),'-map','[a]','-ac','2','-ar','48000','-c:a','aac','-b:a','192k',f'mix_{lang}.m4a'],check=True);print(lang,'mix ok',round(D,2))
