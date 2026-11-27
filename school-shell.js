/* school-shell.js — shared look of buttons and quick access, from the team meeting:
   - badges on sidebar buttons: overdue radio days (manager) and "awaiting your signature" counts shown in a section;
   - one colour code for buttons across sections: danger (stop/cancel/delete) in red, tools (print/export/share) with an icon, WhatsApp in green;
   - a bottom bar on phones for teachers and employees with their most used sections and the notifications bell.
   Display only: nothing here writes data. */
(function(root){'use strict';
if(!root.document||new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id),personal=!!root.TeacherPortal||!!root.EmployeePortal;
const css=document.createElement('style');
css.textContent=
'.school-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;margin-inline-start:auto;border-radius:999px;background:#c62828;color:#fff;font-size:11px;font-weight:700;line-height:1}'+
'.school-sidebar .school-nav-links button .school-badge{order:9}'+
'#schoolWorkspace button.btn-danger-soft,.school-sidebar-page .wrap button.btn-danger-soft{border-color:#e3a6a6!important;color:#9f2727!important;background:#fff6f6!important}'+
'#schoolWorkspace button.btn-tool:before,.school-sidebar-page .wrap button.btn-tool:before{display:inline-block;margin-inline-end:6px}'+
'button.btn-tool.tool-print:before{content:"🖨"}button.btn-tool.tool-export:before{content:"⬇"}button.btn-tool.tool-share:before{content:"✆"}'+
'#schoolWorkspace a.btn-wa,.school-sidebar-page .wrap a.btn-wa{display:inline-block;background:#25D366;color:#073b1c!important;border-radius:9px;padding:4px 10px;font-weight:600;text-decoration:none}'+
'.school-bottom-bar{display:none}'+
'@media(max-width:760px){.school-bottom-bar{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;position:fixed;inset-inline:0;bottom:0;z-index:90;background:#123e36;border-top:1px solid #0b2a24;padding:6px 6px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -4px 18px #0003}'+
'.school-bottom-bar button{font:inherit;font-size:12px;color:#d9ebe3;background:none;border:0;border-radius:10px;padding:8px 4px;min-height:48px;cursor:pointer;position:relative}'+
'.school-bottom-bar button[aria-current=true]{background:#ffffff1a;color:#fff;font-weight:700}.school-bottom-bar .school-badge{position:absolute;top:4px;inset-inline-end:10px;margin:0}'+
'body.school-has-bottom-bar{padding-bottom:76px}body.school-has-bottom-bar .school-sidebar-toggle{display:none!important}}';
document.head.append(css);
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
function badge(button,count){
  if(!button)return;let b=button.querySelector(':scope>.school-badge');
  if(!count){if(b)b.remove();return}
  if(!b){b=document.createElement('span');b.className='school-badge';button.append(b)}
  const t=count>99?'99+':String(count);if(b.textContent!==t)b.textContent=t;
  const label='('+count+' بانتظار)';if(button.getAttribute('aria-description')!==label)button.setAttribute('aria-description',label);
}
// Overdue radio days, read at most every 5 minutes (manager only).
let radioOverdue=0,radioAt=0;
async function refreshRadio(){
  const manager=root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&root.firebase&&firebase.apps.length&&firebase.auth().currentUser;
  if(!manager||Date.now()-radioAt<300000)return;radioAt=Date.now();
  try{const s=await firebase.firestore().collection('radioPrograms').where('status','==','planned').get();const t=today();radioOverdue=s.docs.filter(d=>String(d.data().date||'')<t).length;}catch(err){radioOverdue=0}
}
// "بانتظار توقيعك الآن (N)" style counts already shown inside a section.
function pendingIn(section){
  if(!section)return 0;const m=/بانتظار توقيعك[^()]*\((\d+)\)/.exec(section.textContent||'');return m?+m[1]:0;
}
function paintBadges(){
  badge($('schoolRadioLink'),radioOverdue);
  const links=document.querySelector('.school-sidebar-links,#schoolWorkspaceNav');if(!links)return;
  for(const [key,ids] of [['assignments',['vAssignments']],['signatures',['vSignatures']]]){
    const n=pendingIn($('schoolSection-'+key));
    const btns=ids.map($).filter(Boolean).concat([...document.querySelectorAll('#schoolWorkspaceNav [data-workspace-key="'+key+'"]')]);
    for(const b of btns)badge(b,n);
  }
}
// One colour code for buttons, decided from their words.
const DANGER=/^(إيقاف|إلغاء|حذف|مسح|استبعاد|رفض)/,PRINT=/طباعة|PDF/,EXPORT=/تنزيل|تصدير|CSV|Excel/i,SHARE=/مشاركة/;
function tagButtons(){
  const scope=document.querySelector('.school-sidebar-page>.wrap,.school-sidebar-page>.shell')||document.body;
  for(const b of scope.querySelectorAll('button:not([data-shell-tagged])')){
    const t=(b.textContent||'').trim();b.dataset.shellTagged='1';
    if(DANGER.test(t))b.classList.add('btn-danger-soft');
    else if(PRINT.test(t))b.classList.add('btn-tool','tool-print');
    else if(EXPORT.test(t))b.classList.add('btn-tool','tool-export');
    else if(SHARE.test(t))b.classList.add('btn-tool','tool-share');
  }
  for(const a of scope.querySelectorAll('a[href^="https://wa.me/"]:not(.btn-wa)'))a.classList.add('btn-wa');
}
// Bottom bar on phones for teachers and employees.
let bar=null;
function paintBar(){
  if(!personal)return;const nav=$('schoolWorkspaceNav'),account=$('account');
  if(!nav||!account||account.hidden){if(bar)bar.hidden=true;document.body.classList.remove('school-has-bottom-bar');return}
  const sources=[...nav.querySelectorAll('button[data-workspace-key]')].filter(b=>!b.hidden).slice(0,3);
  const bell=$('notifyBell');
  if(!bar){bar=document.createElement('nav');bar.className='school-bottom-bar';bar.setAttribute('aria-label','الوصول السريع');document.body.append(bar);
    bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const target=b.dataset.bell?$('notifyBell'):nav.querySelector('button[data-workspace-key="'+b.dataset.key+'"]');if(target)target.click();});}
  const want=sources.map(s=>s.dataset.workspaceKey+'|'+s.textContent.replace(/\d+|99\+/g,'').trim()).join(',')+(bell?',bell':'');
  if(bar.dataset.sig!==want){bar.dataset.sig=want;bar.innerHTML=sources.map(s=>'<button type="button" data-key="'+s.dataset.workspaceKey+'">'+s.textContent.replace(/\d+|99\+/g,'').trim().replace(/[<>&]/g,'')+'</button>').join('')+(bell?'<button type="button" data-bell="1">الإشعارات</button>':'')}
  for(const b of bar.querySelectorAll('button[data-key]')){const src=nav.querySelector('button[data-workspace-key="'+b.dataset.key+'"]');const n=src&&src.querySelector('.school-badge');badge(b,n?+n.textContent.replace('+',''):0);const cur=String(!!(src&&(src.dataset.sidebarActive==='true'||src.getAttribute('aria-pressed')==='true')));if(b.getAttribute('aria-current')!==cur)b.setAttribute('aria-current',cur)}
  if(bar.hidden)bar.hidden=false;document.body.classList.add('school-has-bottom-bar');
}
function tick(){refreshRadio().then(paintBadges);paintBadges();tagButtons();paintBar();}
if(root.SchoolTick)root.SchoolTick.add(tick);else setInterval(tick,1500);
})(window);
