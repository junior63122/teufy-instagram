// Décor 3D de la boîte (three.js), repris de riviera-studio (engine/part_club3d.js), aux couleurs de Teufy.
// club3d(t,{angle,lt,teinte}) rend la scène dans le canvas WebGL #c3d (placé dans la page).
const BEAT=124/60;
function rnd(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
const pulse=t=>Math.pow(Math.max(0,Math.cos((t*BEAT%1)*Math.PI*2)),6);
// (origine) de la boîte (three.js), commun à la série nuit (15/11/2026 : « c'est bien mieux comme ça ») ----------
// clubInside() (2D) dessine ce décor à la place du fond plat dès que three.js est chargé. Caméra : un angle par plan
// (window.PLAN = numéro du plan, window.PLAN_T = temps écoulé dans le plan), avec un léger travelling.
const C3={};
function c3TexDoux(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
function c3Silhouette(i){const c=document.createElement('canvas');c.width=256;c.height=512;const x=c.getContext('2d');x.fillStyle='#07040d';
  x.beginPath();x.arc(128,110,52,0,7);x.fill();x.beginPath();x.moveTo(60,190);x.quadraticCurveTo(128,160,196,190);x.lineTo(210,512);x.lineTo(46,512);x.closePath();x.fill();
  if(i%2){x.save();x.translate(70,200);x.rotate(-2.6);x.fillRect(-15,0,30,170);x.restore();x.save();x.translate(186,200);x.rotate(2.6);x.fillRect(-15,0,30,170);x.restore()}
  if(i%3===0){x.fillStyle='rgba(120,200,255,.9)';x.fillRect(150,40,26,44)}return new THREE.CanvasTexture(c)}
function c3Construire(){const T=THREE;C3.r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,canvas:document.getElementById('c3d')});C3.r.setPixelRatio(1);C3.r.setSize(1080,1920,false);
  C3.r.outputEncoding=T.sRGBEncoding;C3.r.toneMapping=T.ACESFilmicToneMapping;C3.r.toneMappingExposure=.8;
  const sc=C3.scene=new T.Scene();sc.background=new T.Color(0x05030c);sc.fog=new T.FogExp2(0x05020c,.05);
  C3.cam=new T.PerspectiveCamera(55,1080/1920,.1,100);
  sc.add(new T.AmbientLight(0x2a1640,.35));sc.add(new T.HemisphereLight(0x5a2a8a,0x0a0510,.18));
  C3.dalles=[];for(let i=-6;i<6;i++)for(let j=-10;j<6;j++){const mat=new T.MeshStandardMaterial({color:0x0c0c12,roughness:.18,metalness:.7,emissive:0x000000});
    const d=new T.Mesh(new T.PlaneGeometry(.96,.96),mat);d.rotation.x=-Math.PI/2;d.position.set(i+.5,.012,j+.5);sc.add(d);C3.dalles.push({d,i,j})}
  const box=new T.Mesh(new T.BoxGeometry(14,7,32),new T.MeshStandardMaterial({color:0x0b0614,roughness:.95,side:T.BackSide}));box.position.set(0,3.5,-2);sc.add(box);
  C3.leds=[];[-6.9,6.9].forEach(x=>{for(let k=0;k<3;k++){const l=new T.Mesh(new T.BoxGeometry(.05,.06,28),new T.MeshBasicMaterial({color:0xff2bd6}));l.position.set(x,1+k*1.6,-2);sc.add(l);C3.leds.push(l)}});
  const cab=new T.Mesh(new T.BoxGeometry(4,1.2,1.2),new T.MeshStandardMaterial({color:0x0d0a18,roughness:.4,metalness:.5}));cab.position.set(0,.6,-9);sc.add(cab);C3.cab=cab;
  const bord=new T.LineSegments(new T.EdgesGeometry(cab.geometry),new T.LineBasicMaterial({color:0xff2bd6}));bord.position.copy(cab.position);sc.add(bord);
  C3.dj=new T.Mesh(new T.PlaneGeometry(1,1.6),new T.MeshBasicMaterial({map:c3Silhouette(1),transparent:true,alphaTest:.1}));C3.dj.position.set(0,1.6,-9.4);sc.add(C3.dj);
  C3.ecran=new T.Mesh(new T.PlaneGeometry(6,2),new T.MeshBasicMaterial({color:0xffffff}));C3.ecran.position.set(0,3.2,-12.9);sc.add(C3.ecran);
  C3.boule=new T.Mesh(new T.IcosahedronGeometry(.55,2),new T.MeshStandardMaterial({color:0xdddddd,metalness:1,roughness:.12,flatShading:true}));C3.boule.position.set(0,5,-3);sc.add(C3.boule);
  C3.pl=new T.PointLight(0xffffff,4,10);C3.pl.position.set(0,4.2,-2);sc.add(C3.pl);
  const tdx=c3TexDoux();C3.paillettes=[];for(let k=0;k<40;k++){const sp=new T.Sprite(new T.SpriteMaterial({map:tdx,color:0xffffff,transparent:true,blending:T.AdditiveBlending,depthWrite:false,fog:false}));sp.scale.setScalar(.12);sc.add(sp);C3.paillettes.push(sp)}
  C3.spots=[];[0xFF5A3C,0x3DFF8A,0xFF2BD6,0xFFD23F].forEach((col,k)=>{const sp=new T.SpotLight(col,9,26,.32,.6,1.2);sp.position.set(-4.5+k*3,6.6,-5+(k%2)*3);sc.add(sp);sc.add(sp.target);
    const cone=new T.Mesh(new T.ConeGeometry(1.9,7,32,1,true),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.04,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));sc.add(cone);C3.spots.push({sp,cone,k})});
  C3.lasers=[];for(let k=0;k<10;k++){const l=new T.Mesh(new T.BoxGeometry(.045,.045,30),new T.MeshBasicMaterial({color:[0xFF5A3C,0x3DFF8A,0xFF2BD6][k%3],transparent:true,opacity:.85,blending:T.AdditiveBlending,fog:false}));
    l.geometry.translate(0,0,15);l.position.set(0,2.4,-9);sc.add(l);C3.lasers.push(l)}
  C3.fumee=[];for(let k=0;k<70;k++){const s=new T.Sprite(new T.SpriteMaterial({map:tdx,color:0x6a4a9c,transparent:true,opacity:.05,depthWrite:false,blending:T.AdditiveBlending}));
    s.position.set((rnd(k)-.5)*12,.3+rnd(k+3)*2.5,-10+rnd(k+7)*16);s.scale.setScalar(3+rnd(k+9)*3);sc.add(s);C3.fumee.push(s)}
  C3.foule=[];for(let k=0;k<40;k++){const m=new T.Mesh(new T.PlaneGeometry(.9,1.8),new T.MeshBasicMaterial({map:c3Silhouette(k),transparent:true,alphaTest:.1}));
    const x=(rnd(k+11)-.5)*11,z=-8.5+rnd(k+13)*8;if(Math.abs(x)<1.4&&z>-4)continue;m.position.set(x,.9,z);sc.add(m);C3.foule.push({m,k})}}
// Angles de caméra : [position, cible]
const C3_ANGLES=[[[0,2.4,8.5],[0,1.3,-5]],[[-2.2,.7,4.5],[1,2.2,-6]],[[4.6,1.9,2.5],[-1,1.2,-5]],[[.4,1.7,3.5],[0,1.5,-6]],[[-3.5,2.8,6],[1.5,1,-4]],[[1.8,1.2,5.5],[-.5,1.8,-6]]];
function club3d(t,o={}){if(!C3.r)c3Construire();window.PLAN=o.angle||0;window.PLAN_T=o.lt||0;const T=THREE,p=pulse(t),beat=Math.floor(t*BEAT);
  const [pos,cib]=C3_ANGLES[(window.PLAN||0)%C3_ANGLES.length];const lt=window.PLAN_T||0;
  C3.cam.position.set(pos[0]+Math.sin(t*.7)*.15,pos[1]+p*.02,pos[2]-Math.min(lt,4)*.35);C3.cam.lookAt(cib[0],cib[1],cib[2]);C3.cam.rotation.z+=Math.sin(t*.9)*.015;
  const on=o.dj!==false;
  C3.dalles.forEach(({d,i,j})=>{const h=((i*7+j*13+beat*5)%12)/12,lit=((i+j+beat)%3===0);d.material.emissive.setHSL(h,1,lit?.35*(.5+p*.5):.02)});
  C3.leds.forEach((l,k)=>l.material.color.setHSL(((t*.2+k*.15)%1),1,.55));
  C3.ecran.material.color.setHSL((t*.15)%1,1,.12+p*.18);C3.dj.visible=on;
  C3.boule.rotation.y=t*.9;C3.paillettes.forEach((sp,k)=>{const a=k*2.4+t*.9,b=(rnd(k)-.5)*2.6;const r=6+rnd(k+5)*3;sp.position.set(Math.cos(a)*r*Math.cos(b),5+Math.sin(b)*3,-3+Math.sin(a)*r*Math.cos(b));sp.material.opacity=.4+.6*Math.abs(Math.sin(t*6+k))});
  C3.spots.forEach(({sp,cone,k})=>{const tx=Math.sin(t*1.1+k*1.7)*4,tz=-3+Math.cos(t*.9+k)*4;sp.target.position.set(tx,0,tz);sp.intensity=3+p*6;
    const dir=new T.Vector3().subVectors(sp.target.position,sp.position);const len=dir.length();const rad=len*Math.tan(.32)/1.9;cone.scale.set(rad,len/7,rad);cone.position.copy(sp.position).addScaledVector(dir,.5);
    cone.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),dir.normalize())});
  C3.lasers.forEach((l,k)=>{l.rotation.set(-.05+Math.sin(t*1.3+k)*.12,(k-4.5)*.09+Math.sin(t*1.7)*.3,0);l.material.opacity=.4+p*.55});
  C3.fumee.forEach((s,k)=>{s.material.rotation=t*.1+k});
  C3.foule.forEach(({m,k})=>{m.visible=o.foule!==false;m.position.y=.9+Math.abs(Math.sin(t*BEAT*Math.PI+k))*.12;m.lookAt(C3.cam.position.x,m.position.y,C3.cam.position.z)});
  C3.r.render(C3.scene,C3.cam)}
