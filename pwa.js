/* pwa.js — registers the app service worker, offers "install on your phone" once (Android and iPhone),
   and keeps an open or installed app up to date: when it comes back to the screen (and every 5 minutes)
   it checks the latest published version and offers a one-tap refresh. */
(function(root){'use strict';
if(!root.document||!('serviceWorker' in navigator))return;
const KEY='pwaHintDismissed';
root.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{})});
// --- Updates: compare the latest commit on main with the one seen when this page opened. ---
const LATEST='https://api.github.com/repos/bakr4039-byte/followup/commits/main';
let seen=null,offered=false,lastCheck=0;
async function latest(){try{const r=await fetch(LATEST,{headers:{Accept:'application/vnd.github.sha'},cache:'no-store'});return r.ok?(await r.text()).trim():null}catch(e){return null}}
function showUpdate(){
  if(!document.body||document.getElementById('pwaUpdate'))return;
  const b=document.createElement('div');b.id='pwaUpdate';b.className='pwa-hint';b.setAttribute('role','status');
  b.innerHTML='<img src="assets/icon-192.png" alt=""><p>يتوفر تحديث جديد للمنصة.</p><div><button type="button" class="pwa-go">تحديث الآن</button></div>';
  b.querySelector('.pwa-go').onclick=()=>location.reload();
  document.body.append(b);
}
async function check(){
  if(offered||document.hidden||Date.now()-lastCheck<60000)return;
  lastCheck=Date.now();
  const sha=await latest();if(!sha)return;
  if(seen===null){seen=sha;return}
  navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{});
  // GitHub Pages publishes about a minute after a merge: wait before offering the refresh.
  if(sha!==seen){offered=true;setTimeout(showUpdate,90000)}
}
root.addEventListener('load',check);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
setInterval(check,5*60*1000);
const standalone=root.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(standalone){document.documentElement.classList.add('is-app');return}
let deferred=null;
function dismissed(){try{return localStorage.getItem(KEY)==='1'}catch(e){return false}}
function close(remember){const b=document.getElementById('pwaHint');if(b)b.remove();if(remember){try{localStorage.setItem(KEY,'1')}catch(e){}}}
function banner(text,label,action){
  if(dismissed()||document.getElementById('pwaHint')||!document.body)return;
  const b=document.createElement('div');b.id='pwaHint';b.className='pwa-hint';b.setAttribute('role','dialog');b.setAttribute('aria-label','تثبيت المنصة');
  b.innerHTML='<img src="assets/icon-192.png" alt=""><p></p><div><button type="button" class="pwa-go"></button><button type="button" class="pwa-close" aria-label="إغلاق">×</button></div>';
  b.querySelector('p').textContent=text;
  const go=b.querySelector('.pwa-go');if(action){go.textContent=label;go.onclick=action}else go.remove();
  b.querySelector('.pwa-close').onclick=()=>close(true);
  document.body.append(b);
}
root.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;
  banner('ثبّت المنصة على جوالك لتفتحها من الشاشة الرئيسية مثل التطبيق.','تثبيت',async()=>{const p=deferred;deferred=null;close(false);if(p){p.prompt();try{await p.userChoice}catch(err){}}});
});
root.addEventListener('appinstalled',()=>close(true));
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
if(ios)root.addEventListener('load',()=>setTimeout(()=>banner('لتثبيت المنصة على الآيفون: اضغط زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».'),2500));
})(window);
