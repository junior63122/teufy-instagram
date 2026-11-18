# Mixage du spot n°2 « Manger tard » : musique étouffée sur l'écran verrouillé (on sort de la boîte), pleine quand on
# ouvre le site ; « ding » des notifications, tapotements, chocs sur les plats ; bruitages synthétisés (son/synthe.py).
import json,subprocess,sys,os
lang=sys.argv[1];TL=json.load(open(f'timeline_{lang}.json'));D=TL[-1]['start']+TL[-1]['dur']+1.3
SS=lambda i:TL[i]['start']
def wt(i,sub,n=0):
    ws=[w for w in TL[i]['words'] if sub in w[0].lower()];return ws[n][1] if len(ws)>n else SS(i)
ms=lambda x:int(x*1000)
ev=[('sub',0,.7),('snap',wt(0,'quatre'),.5),('kick',wt(0,'quatre'),.5)]
ev+=[('ding',wt(0,'heures'),.55),('ding',wt(0,'ferme'),.55),('ding',SS(1),.55),('kick',wt(1,'dalle'),.8),('snap',wt(1,'dalle'),.5)]
ev+=[x for w in ('kebab','pizza','burger') for x in (('kick',wt(2,w)-.03,.75),('snap',wt(2,w)-.03,.5))]
ev+=[('souffle',SS(3)-.08,.6),('swoosh',SS(3),.4)]+[('tap',wt(3,w),.9) for w in ('choisis','jusqu','quelle','heure')]+[('clic',wt(3,w),.35) for w in ('choisis','jusqu','quelle','heure')]+[('kick',wt(3,'ouvert'),.45)]
ev+=[('tap',wt(4,'trouves'),.9),('clic',wt(4,'trouves'),.4),('kick',wt(4,'proche'),.5)]
ev+=[('souffle',SS(5)-.08,.6)]+[('clic',wt(5,'toulon')+k*.06,.18) for k in range(17)]+[('kick',wt(5,'réglé'),.5)]
ev+=[('montee',SS(6)-1.3,.4),('sub',SS(6),.9),('snap',SS(6),.45),('clic',wt(6,'teufyparty')+.8,.6),('acclamation',wt(6,'teufyparty')+.9,.35)]
inputs=[];filt=[];vox=[];bed=[];k=0
for g in TL:
    inputs+=['-i',g['file']];d=ms(g['start']);filt.append(f'[{k}]adelay={d}|{d},volume=1.6[v{k}]');vox.append(f'[v{k}]');k+=1
inputs+=['-i','son/beat.wav'];b=k;k+=1;o=SS(3)
filt.append(f'[{b}]atrim=0:{D},asplit=2[ba][bb]')
filt.append(f'[ba]atrim=0:{o},lowpass=f=420,volume=1.5[m1]')
filt.append(f'[bb]atrim={o}:{D},asetpts=PTS-STARTPTS,afade=t=out:st={D-o-1.0}:d=1.0,adelay={ms(o)}|{ms(o)}[m2]')
filt.append('[m1][m2]amix=inputs=2:normalize=0:duration=longest[m]');bed.append('[m]')
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
