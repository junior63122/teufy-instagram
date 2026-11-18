# Mixage du spot n°3 « Défi gratuit » : techno 132 BPM, trotteuse du chrono (une tic par seconde réelle), tapotements,
# tampon GRATUIT, gros coup quand le chrono s’arrête ; bruitages synthétisés (son/synthe.py) sauf tampon, clic, swoosh, acclamation.
import json,subprocess,sys,os
lang=sys.argv[1];TL=json.load(open(f'timeline_{lang}.json'));D=TL[-1]['start']+TL[-1]['dur']+1.3
SS=lambda i:TL[i]['start']
def wt(i,sub,n=0):
    ws=[w for w in TL[i]['words'] if sub in w[0].lower()];return ws[n][1] if len(ws)>n else SS(i)
ms=lambda x:int(x*1000)
c0,c1=wt(1,'chrono'),SS(6)
ev=[('sub',0,.8),('snap',0,.5),('kick',wt(0,'gratuite'),.4),('kick',wt(0,'dix'),.8),('snap',wt(0,'dix'),.5)]
ev+=[('kick',c0,.8),('snap',c0,.5)]+[('tic',c0+k,.55) for k in range(int(c1-c0)+1)]
ev+=[('souffle',SS(2)-.1,.6),('kick',wt(2,'teufy'),.5),('swoosh',wt(3,'vas'),.5),('tap',wt(3,'gratuit'),.9),('clic',wt(3,'gratuit'),.4)]
ev+=[('tap',wt(4,'tu'),.9),('clic',wt(4,'tu'),.35),('tap',wt(4,'ville'),.9),('clic',wt(4,'ville'),.4)]
ev+=[('swoosh',wt(5,'voilà'),.4),('tampon',wt(5,'entrée')+.16,.9),('kick',wt(5,'entrée')+.16,.5)]
ev+=[('sub',c1,1),('snap',c1,.6),('kick',wt(6,'trop')+.18,.8),('tampon',wt(6,'trop')+.18,.6),('acclamation',wt(6,'facile'),.35)]
ev+=[('souffle',SS(7)-.08,.5),('kick',SS(7),.5),('clic',wt(7,'teufyparty')+.8,.6)]
inputs=[];filt=[];vox=[];bed=[];k=0
for g in TL:
    inputs+=['-i',g['file']];d=ms(g['start']);filt.append(f'[{k}]adelay={d}|{d},volume=1.1[v{k}]');vox.append(f'[v{k}]');k+=1
inputs+=['-i','son/beat.wav'];b=k;k+=1;o=SS(6)+.45
filt.append(f'[{b}]atrim=0:{D},asplit=2[ba][bb]')
filt.append(f'[ba]atrim=0:{SS(6)},afade=t=out:st={SS(6)-.05}:d=0.05[m1]')
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
