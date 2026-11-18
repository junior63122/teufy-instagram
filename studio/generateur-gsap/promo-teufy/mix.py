# Mixage de la promo Teufy v3 (18/11/2026). Retours du directeur : plus de « klaxon » (les deux « pop » Mixkit étaient des
# notes tenues à 555 et 661 Hz, effet « blague qui fait un bide ») → bruitages synthétisés par son/synthe.py (kick, sub, snap,
# verre, souffle, montée, coupure) + quelques Mixkit sans note (swoosh, glitch, tampon, clic, acclamation).
# Musique (src/beat.mjs) : étouffée pendant l'accroche (on l'entend « depuis la rue »), elle éclate sur « Ouvre Teufy »,
# se coupe net sur « la boîte ferme » et revient avec la bouffe ; elle baisse un peu sous la voix.
import json,subprocess,sys,os
lang=sys.argv[1];TL=json.load(open(f'timeline_{lang}.json'));D=TL[-1]['start']+TL[-1]['dur']+1.3
SS=lambda i:TL[i]['start']
def wt(i,sub,n=0):
    ws=[w for w in TL[i]['words'] if sub in w[0].lower()];return ws[n][1] if len(ws)>n else SS(i)
fe,on=wt(6,'ferme'),wt(6,'on')-.03
ev=[('sub',0,.9),('snap',0,.5)]
ev+=[x for m in ('jamais','sortir','soir') for x in (('kick',wt(0,m),.55),('snap',wt(0,m),.45))]
ev+=[('verre',wt(0,'soir')+.2,.45),('verre',SS(1),.8),('sub',SS(1),1),('acclamation',wt(1,'teufy'),.3)]
ev+=[('souffle',SS(2)-.1,.6),('snap',wt(2,'soir',1),.4),('swoosh',wt(2,'œil'),.5)]
ev+=[('souffle',SS(3)-.05,.7)]+[('kick',wt(3,'boîtes')+k*.14+.3,.35) for k in range(4)]+[('clic',wt(3,'ouvertes')+k*.1,.4) for k in range(4)]+[('glitch',wt(3,'juste'),.3),('kick',wt(3,'toi'),.45)]
ev+=[x for k,m in enumerate(('techno','house','afro','shatta')) for x in (('kick',SS(4) if k==0 else wt(4,m)-.04,.7),('snap',SS(4) if k==0 else wt(4,m)-.04,.5))]+[('glitch',SS(4),.35)]
ev+=[('souffle',SS(5)-.08,.6),('kick',wt(5,'gratuites')-.2,.5),('tampon',wt(5,'gratuites')+.3,.9),('swoosh',wt(5,'bons')-.2,.5),('acclamation',wt(5,'plans'),.25)]
ev+=[('swoosh',SS(6)-.05,.5),('coupure',fe,1)]+[x for m in ('on','trouve','manger','jusqu') for x in (('kick',wt(6,m)-.03,.6),('snap',wt(6,m)-.03,.45))]
ev+=[('clic',wt(6,'jusqu')+k*(wt(6,'cinq')-wt(6,'jusqu'))/4,.5) for k in range(4)]+[('kick',wt(6,'cinq'),.6),('swoosh',wt(6,'heures'),.45)]
ev+=[('souffle',SS(7)-.08,.6)]+[('clic',wt(7,'toulon')+k*.18,.35) for k in range(7)]+[('kick',wt(7,'toute'),.45)]
ev+=[('montee',SS(8)-1.3,.45),('sub',SS(8),1),('snap',SS(8),.5),('clic',wt(8,'abonne')+.2,.6),('acclamation',wt(8,'teufyparty')+.4,.45)]
inputs=[];filt=[];vox=[];bed=[];k=0
for g in TL:
    inputs+=['-i',g['file']];d=int(g['start']*1000);filt.append(f'[{k}]adelay={d}|{d},volume=1.3[v{k}]');vox.append(f'[v{k}]');k+=1
ms=lambda x:int(x*1000)
inputs+=['-i','son/beat.wav'];b=k;k+=1
filt.append(f'[{b}]atrim=0:{D},asplit=3[ba][bb][bc]')
filt.append(f'[ba]atrim=0:{SS(1)},lowpass=f=380,volume=1.6[m1]')
filt.append(f'[bb]atrim={SS(1)}:{fe},asetpts=PTS-STARTPTS,adelay={ms(SS(1))}|{ms(SS(1))}[m2]')
filt.append(f'[bc]atrim={on}:{D},asetpts=PTS-STARTPTS,afade=t=out:st={D-on-1.0}:d=1.0,adelay={ms(on)}|{ms(on)}[m3]')
filt.append('[m1][m2][m3]amix=inputs=3:normalize=0:duration=longest,volume=1.0[m]');bed.append('[m]')
for n,t,vol in ev:
    f=f'son/{n}.wav' if os.path.exists(f'son/{n}.wav') else f'son/{n}.mp3'
    inputs+=['-i',f];d=ms(max(t,0));filt.append(f'[{k}]adelay={d}|{d},volume={vol}[e{k}]');bed.append(f'[e{k}]');k+=1
filt.append(''.join(vox)+f'amix=inputs={len(vox)}:normalize=0:duration=longest,asplit=2[vo1][vo2]')
filt.append(''.join(bed)+f'amix=inputs={len(bed)}:normalize=0:duration=longest[bed]')
filt.append('[bed][vo2]sidechaincompress=threshold=0.03:ratio=3:attack=15:release=250:makeup=1[duck]')
filt.append(f'[vo1][duck]amix=inputs=2:normalize=0:duration=longest,atrim=0:{D},alimiter=limit=0.95[a]')
if os.environ.get('MIX_STEMS'):
    f2=[x.replace(',asplit=2[vo1][vo2]',',asplit=3[vo1][vo2][vo3]') for x in filt[:-1]]+[f'[duck]atrim=0:{D}[dk]',f'[vo3]atrim=0:{D}[vx]','[vo1]anullsink']
    subprocess.run(['ffmpeg','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(f2),'-map','[dk]','stem_fond.wav','-map','[vx]','stem_voix.wav'],check=True)
subprocess.run(['ffmpeg','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(filt),'-map','[a]','-ac','2','-ar','48000','-c:a','aac','-b:a','192k',f'mix_{lang}.m4a'],check=True);print(lang,'mix ok',round(D,2),len(ev),'bruitages')
