// Rendu des séries « motion » (HTML + CSS + GSAP) : une capture d'écran par image, timeline GSAP positionnée à chaque image.
// Usage : node rendu.cjs <dossier-episode> <vitesse> <sortie.mp4> [stills=t1,t2,...]
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
(async()=>{const [dir,fS,out,st]=process.argv.slice(2);const f=parseFloat(fS);const tl=JSON.parse(fs.readFileSync(path.join(dir,'timeline_fr.json')));
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+path.resolve(dir,'index.html'));const END=await p.evaluate(t=>window.init(t),tl);
// Zone sûre TikTok/Reels : bords recadrés, barre du haut, colonne d'icônes à droite, description en bas
const ZONE={x0:70,x1:1010,y0:215,y1:1500,iconX:935,iconY0:850,iconY1:1750};const hors={};
const zone=async t=>{const bx=await p.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){const s=n.textContent.trim();if(!s)continue;const el=n.parentElement;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||parseFloat(cs.fontSize)<20||el.closest('[data-deco]'))continue;
   let o=1,e=el;while(e){o*=parseFloat(getComputedStyle(e).opacity);e=e.parentElement}if(o<.3)continue;const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();if(b.width<2)continue;out.push({s:s.slice(0,30),x0:b.left,x1:b.right,y0:b.top,y1:b.bottom})}return out});
  for(const b of bx){const out=b.x0<ZONE.x0||b.x1>ZONE.x1||b.y0<ZONE.y0||b.y1>ZONE.y1||(b.x1>ZONE.iconX&&b.y1>ZONE.iconY0&&b.y0<ZONE.iconY1);if(out){if(!hors[b.s])hors[b.s]={t:+t.toFixed(1),n:0,box:[b.x0,b.y0,b.x1,b.y1].map(Math.round)};hors[b.s].n++}}};
const shot=async t=>{await p.evaluate(t=>window.seek(t),t);await zone(t);return p.screenshot({type:'jpeg',quality:92})};
if(st&&st.startsWith('stills=')){for(const t of st.slice(7).split(',')){fs.writeFileSync(path.join(dir,`still_${t}.jpg`),await shot(+t))}await b.close();return}
const fps=30,n=Math.ceil(END/f*fps);const ff=spawn('ffmpeg',['-loglevel','error','-y','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','17','-preset','medium',out],{stdio:['pipe','inherit','inherit']});
for(let i=0;i<n;i++){const buf=await shot(i/fps*f);if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r))}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('durée',(END/f).toFixed(2),'s');
const ks=Object.keys(hors).filter(k=>hors[k].n>6); /* les entrées et sorties animées (≤ 6 images, 0,2 s) sont tolérées */console.log(ks.length?`⚠️  ZONE SÛRE : ${ks.length} texte(s) hors de la zone visible sur TikTok/Reels :`:'✅ ZONE SÛRE : tous les textes sont dans la zone visible');
ks.slice(0,15).forEach(k=>console.log(`   - « ${k} » à ${hors[k].t}s (${hors[k].n} images) boîte ${hors[k].box.join(',')}`))})();
