# Bruitages de la promo v3, synthétisés (aucun droit, rien de « comique ») : python3 son/synthe.py
import numpy as np,wave,os
SR=44100;D=os.path.dirname(os.path.abspath(__file__));R=np.random.default_rng(7)
def ecrire(n,y):
    y=np.tanh(y*1.2);y=y/np.max(np.abs(y))*.95;s=(y*32767).astype(np.int16)
    with wave.open(f'{D}/{n}.wav','wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(s.tobytes())
def t_(d):return np.arange(int(SR*d))/SR
def hp(x):return np.diff(x,prepend=0)
def lp(x,k):
    y=np.zeros_like(x);acc=0.
    kk=np.broadcast_to(k,x.shape)
    for i in range(len(x)):acc+=kk[i]*(x[i]-acc);y[i]=acc
    return y
# kick : coup de grosse caisse
t=t_(.55);f=48+130*np.exp(-t*32);ph=2*np.pi*np.cumsum(f)/SR;ecrire('kick',np.sin(ph)*np.exp(-t*7)+.3*R.standard_normal(len(t))*np.exp(-t*300))
# sub : basse 808 qui fait trembler (début et arrivée du logo)
t=t_(1.3);f=40+70*np.exp(-t*9);ph=2*np.pi*np.cumsum(f)/SR;ecrire('sub',np.sin(ph)*np.exp(-t*2.2)*1.6)
# snap : claquement sec pour les coupes
t=t_(.14);ecrire('snap',hp(hp(R.standard_normal(len(t))))*np.exp(-t*45))
# verre : la vitre qui éclate
t=t_(1.1);y=hp(R.standard_normal(len(t)))*np.exp(-t*14)*.8
for k in range(16):fr=2400+R.random()*6000;y+=np.sin(2*np.pi*fr*t+R.random()*6)*np.exp(-t*(8+R.random()*20))*.12
for k in range(14):
    t0=.08+R.random()*.7;i=int(t0*SR);n=int(.04*SR);fr=3000+R.random()*5000;tt=np.arange(n)/SR;y[i:i+n]+=np.sin(2*np.pi*fr*tt)*np.exp(-tt*120)*.35
ecrire('verre',y)
# souffle : whoosh (bruit filtré qui s'ouvre puis se ferme)
t=t_(.45);env=np.sin(np.pi*t/.45)**2;k=.02+.35*env;ecrire('souffle',lp(R.standard_normal(len(t)),k)*env)
# montée avant l'appel à l'action
t=t_(1.3);env=(t/1.3)**2;ph=2*np.pi*np.cumsum(220+900*(t/1.3)**2)/SR;ecrire('montee',(lp(R.standard_normal(len(t)),.05+.5*t/1.3)*.8+.25*np.sin(ph))*env)
# coupure : le courant saute (la boîte ferme)
t=t_(.7);f=90*np.exp(-t*5)+15;ph=2*np.pi*np.cumsum(f)/SR;y=np.sin(ph)*np.exp(-t*3);y[:300]+=R.standard_normal(300)*np.exp(-np.arange(300)/40)*2;ecrire('coupure',y)
print('ok')
# ding : notification de téléphone (deux notes aiguës très courtes, rien de comique)
t=t_(.35);y=np.sin(2*np.pi*1568*t)*np.exp(-t*18)*(t<.12)+np.sin(2*np.pi*2093*np.maximum(t-.09,0))*np.exp(-np.maximum(t-.09,0)*14)*(t>=.09);ecrire('ding',y*.7)
# tap : doigt sur l'écran
t=t_(.06);ecrire('tap',lp(R.standard_normal(len(t)),.4)*np.exp(-t*120))
