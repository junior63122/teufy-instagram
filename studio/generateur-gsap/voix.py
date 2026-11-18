import json,urllib.request,base64,subprocess,sys,os,numpy as np
lang=sys.argv[1];base=lang.split('_')[0]
NARR={'fr':('3Tp5mYhT9wrfnry9pzvV',.38,.5,1.12),'en':('TX3LPaxmHKxFdv7VOQHJ',.38,.5,1.08)}
V={'narr':NARR[base],'leo':('GPAQQPp9dazaB2bl4zg9',.3,.65,1.08),'kevin':('jsScnYkNNda9Q1NES5nn',.3,.7,1.1),'patron':('IHngRooVccHyPqB4uQkG',.3,.7,1.15),'videur':('IHngRooVccHyPqB4uQkG',.45,.5,1.0),'narrU':(NARR[base][0],.22,.85,1.12),'leoCri':('GPAQQPp9dazaB2bl4zg9',.15,1.0,1.15),'ines':('FvmvwvObRqIHojkEGh5N',.35,.6,1.05)}
segs=json.load(open(f'script_{lang}.json'));out=[];t=0.0;os.makedirs(f'seg_{lang}',exist_ok=True)
for i,(spk,text) in enumerate(segs):
    vid,stab,style,speed=V[spk]
    body={"text":text,"model_id":"eleven_multilingual_v2","language_code":base,"voice_settings":{"stability":stab,"similarity_boost":0.8,"style":style,"use_speaker_boost":True,"speed":speed}}
    req=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/with-timestamps",data=json.dumps(body).encode(),headers={"xi-api-key":"dummy","Content-Type":"application/json"})
    r=json.load(urllib.request.urlopen(req,timeout=300))
    f=f'seg_{lang}/{i:02d}.mp3';open(f,'wb').write(base64.b64decode(r['audio_base64']))
    a=r['alignment'];words=[];cur='';s=None
    for c,t0,t1 in zip(a['characters'],a['character_start_times_seconds'],a['character_end_times_seconds']):
        if c.isspace():
            if cur:words.append([cur,s,pe]);cur=''
        else:
            if not cur:s=t0
            cur+=c;pe=t1
    if cur:words.append([cur,s,pe])
    # --- Resserrage : tout silence entre deux mots > MAXGAP est raccourci (règle CARNET : pas de trou dans la voix)
    SR=44100;MAXGAP=0.25
    raw=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True).stdout
    y=np.frombuffer(raw,dtype=np.int16).copy();cutlist=[]
    for k in range(len(words)-1):
        g0,g1=words[k][2],words[k+1][1]
        if g1-g0>MAXGAP:cutlist.append((g0+MAXGAP/2,g1-MAXGAP/2))
    if cutlist:
        keep=[];prev=0.0;shift=[]
        for c0,c1 in cutlist:keep.append(y[int(prev*SR):int(c0*SR)]);shift.append((c1,c1-c0));prev=c1
        keep.append(y[int(prev*SR):]);y=np.concatenate(keep)
        def adj(tm):return tm-sum(dl for c1,dl in shift if tm>=c1-1e-6)
        words=[[w,adj(s0),adj(e0)] for w,s0,e0 in words]
        subprocess.run(['ffmpeg','-loglevel','error','-y','-f','s16le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','192k',f],input=y.tobytes(),check=True)
    pcm=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    x=np.frombuffer(pcm,dtype=np.int16).astype(np.float32)/32768;hop=16000//30
    env=[float(np.sqrt(np.mean(x[k:k+hop]**2))) for k in range(0,len(x),hop)]
    last=max([k for k,e in enumerate(env) if e>0.01] or [len(env)-1]);dur=min(len(x)/16000,(last+3)/30)
    t+=0 if i==0 else 0.04  # répliques enchaînées (CARNET : pas de blanc)
    out.append({'i':i,'spk':spk,'text':text,'file':f,'start':round(t,3),'dur':round(dur,3),'words':[[w,round(t+a_,3),round(t+b_,3)] for w,a_,b_ in words],'env':[round(e,4) for e in env]})
    print(lang,i,spk,round(t,2),round(dur,2));t+=dur
json.dump(out,open(f'timeline_{lang}.json','w'),ensure_ascii=False);print('total',round(t,2))
for i in [0,4]: print([(w[0],w[1]) for w in out[i]['words']])
