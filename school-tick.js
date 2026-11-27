/* school-tick.js — one shared scheduler for the school modules, instead of a 1-second timer in each.
   Registered checks run when the page structure changes (batched, at most every 150 ms), when sign-in
   changes, when the tab becomes visible again, and every 5 seconds as a fallback. Paused while hidden.
   Modules use it when present: if(root.SchoolTick)root.SchoolTick.add(tick);else setInterval(tick,1000); */
(function(root){'use strict';
if(!root.document||root.SchoolTick)return;
const tasks=new Set();let timer=0,last=0,started=false;
function run(){
  timer=0;if(document.hidden)return;last=Date.now();
  for(const task of tasks){try{const r=task();if(r&&typeof r.catch==='function')r.catch(err=>console.warn('SchoolTick task failed:',err));}catch(err){console.warn('SchoolTick task failed:',err);}}
}
function queue(){if(timer)return;timer=setTimeout(run,Math.max(0,150-(Date.now()-last)));}
function hookAuth(){
  if(!(root.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth))return false;
  firebase.auth().onAuthStateChanged(()=>queue());return true;
}
function start(){
  if(started)return;started=true;
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
  setInterval(queue,5000);
  if(!hookAuth()){const wait=setInterval(()=>{if(hookAuth())clearInterval(wait);},500);setTimeout(()=>clearInterval(wait),60000);}
}
root.SchoolTick={add(task){tasks.add(task);start();queue();return ()=>tasks.delete(task);},size:()=>tasks.size};
})(window);
