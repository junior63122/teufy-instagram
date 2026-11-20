const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function ouvrir(code,garder){const f=document.getElementById('verrou');if(!f)return;try{
const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveKey']);
const cle=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(f.dataset.sel),iterations:210000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['decrypt']);
const t=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(f.dataset.iv)},cle,b64(f.dataset.d));
document.getElementById('contenu').innerHTML=new TextDecoder().decode(t);if(garder)try{localStorage.setItem('tiktok:code',code)}catch{}activer();
}catch{try{localStorage.removeItem('tiktok:code')}catch{}const e=document.getElementById('err');if(e)e.textContent=garder?'Code incorrect.':''}}
document.addEventListener('submit',ev=>{if(ev.target.id==='verrou'){ev.preventDefault();ouvrir(document.getElementById('code').value,true)}});
try{const c=localStorage.getItem('tiktok:code');if(c)ouvrir(c,false)}catch{}
function activer(){
document.querySelectorAll('[data-copie]').forEach(b=>b.onclick=async()=>{const t=b.closest('.v').querySelector('textarea');try{await navigator.clipboard.writeText(t.value)}catch{t.select();document.execCommand('copy')}b.textContent='Copiée';setTimeout(()=>b.textContent='Copier la légende',1500)});
document.querySelectorAll('.v').forEach(v=>{const c=v.querySelector('.fait input'),k='tiktok:'+v.dataset.cle;try{c.checked=localStorage.getItem(k)==='1'}catch{}v.classList.toggle('ok',c.checked);c.onchange=()=>{try{localStorage.setItem(k,c.checked?'1':'0')}catch{}v.classList.toggle('ok',c.checked)}});}
if(!document.getElementById('verrou'))activer();
