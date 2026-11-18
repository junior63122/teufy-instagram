# Mixage de la promo Teufy v2 : voix off + beat (src/beat.mjs, sans droits) bien présent, qui baisse un peu sous la voix,
# + bruitages Mixkit calés sur l'image (drop, glitchs, tampon, montée, acclamations).
import json,subprocess,sys
lang=sys.argv[1];TL=json.load(open(f'timeline_{lang}.json'));D=TL[-1]['start']+TL[-1]['dur']+1.3
SS=lambda i:TL[i]['start']
def wt(i,sub,n=0):
    ws=[w for w in TL[i]['words'] if sub in w[0].lower()];return ws[n][1] if len(ws)>n else SS(i)
ev=[('swoosh',SS(i)-.08,.5) for i in (2,3,5,6,7)]+[('glitch',SS(4)-.05,.45),('glitch',wt(0,'soir'),.35)]
ev+=[('basse',wt(1,'teufy'),.9),('clic',SS(1)+.1,.5),('acclamation',wt(1,'teufy'),.35)]
ev+=[('pop',wt(3,'boîtes')+k*.18,.4) for k in range(4)]+[('pop-dur',wt(3,'ouvertes'),.35)]
ev+=[('impact',wt(4,m)-.05,.55) for m in ('techno','house','afro','shatta')]+[('pop-dur',wt(4,'choisis'),.4)]
ev+=[('zoom',wt(5,'gratuites')-.2,.4),('tampon',wt(5,'gratuites')+.15,.8),('pop',wt(5,'bons'),.45),('fete',wt(5,'plans'),.35)]
ev+=[('flash',wt(6,'ferme'),.5),('pop-dur',wt(6,'cinq'),.5)]
ev+=[('clic',wt(6,'trouve')+k*(wt(6,'cinq')-wt(6,'trouve'))/4,.45) for k in range(5)]
ev+=[('pop',wt(7,'toulon')+k*.18,.3) for k in range(7)]+[('pop-dur',wt(7,'toute'),.45)]
ev+=[('riser',SS(8)-1.6,.5),('basse',SS(8),.9),('acclamation',wt(8,'teufyparty')+.4,.5),('clic',wt(8,'abonne')+.2,.6)]
inputs=[];filt=[];vox=[];bed=[];k=0
for g in TL:
    inputs+=['-i',g['file']];d=int(g['start']*1000);filt.append(f'[{k}]adelay={d}|{d},volume=1.3[v{k}]');vox.append(f'[v{k}]');k+=1
inputs+=['-i','son/beat.wav'];filt.append(f'[{k}]atrim=0:{D},volume=0.95,afade=t=out:st={D-1.0}:d=1.0[m]');bed.append('[m]');k+=1
for n,t,vol in ev:
    inputs+=['-i',f'son/{n}.mp3'];d=int(max(t,0)*1000);filt.append(f'[{k}]adelay={d}|{d},volume={vol}[e{k}]');bed.append(f'[e{k}]');k+=1
filt.append(''.join(vox)+f'amix=inputs={len(vox)}:normalize=0:duration=longest,asplit=2[vo1][vo2]')
filt.append(''.join(bed)+f'amix=inputs={len(bed)}:normalize=0:duration=longest[bed]')
filt.append('[bed][vo2]sidechaincompress=threshold=0.03:ratio=3.5:attack=15:release=250:makeup=1[duck]')
filt.append(f'[vo1][duck]amix=inputs=2:normalize=0:duration=longest,atrim=0:{D},alimiter=limit=0.95[a]')
import os
if os.environ.get('MIX_STEMS'):
    f2=[x.replace(',asplit=2[vo1][vo2]',',asplit=3[vo1][vo2][vo3]') for x in filt[:-1]]+[f'[duck]atrim=0:{D}[dk]',f'[vo3]atrim=0:{D}[vx]','[vo1]anullsink']
    subprocess.run(['ffmpeg','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(f2),'-map','[dk]','stem_fond.wav','-map','[vx]','stem_voix.wav'],check=True)
subprocess.run(['ffmpeg','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(filt),'-map','[a]','-ac','2','-ar','48000','-c:a','aac','-b:a','192k',f'mix_{lang}.m4a'],check=True);print(lang,'mix ok',round(D,2))
