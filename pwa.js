/* pwa.js — registers the app service worker and offers "install on your phone" once (Android and iPhone). */
(function(root){'use strict';
if(!root.document||!('serviceWorker' in navigator))return;
const KEY='pwaHintDismissed';
root.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{})});
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
