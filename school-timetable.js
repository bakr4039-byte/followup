/* school-timetable.js — the school timetable in two types (عن بُعد / حضوري) and the teacher-link check.
   A teacher is linked to a lesson by name: the account's scheduleName must equal the name in the timetable.
   Manager only. Reads the remote plan already on the page, the uploaded onsite plan and teacher accounts; writes nothing. */
(function(root){'use strict';
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const PERIODS=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة'];
const REMOTE_CLASSES={c1:'الأول الثانوي',c2:'الثاني الثانوي',c3:'الثالث الثانوي',ba:'المسار · إدارة الأعمال',cs:'المسار · الحاسب والهندسة'};
const GRADES=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
const TYPES={remote:'عن بُعد',onsite:'حضوري'};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function norm(n){return String(n||'').normalize('NFKC').replace(/[ً-ٰٟـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,'')}
function remoteSessions(S){return (S||[]).map(s=>({id:s.id,type:'remote',day:s.day,period:s.slot+1,classIds:[s.cls],subject:s.subj,teacher:s.teacher}))}
function onsiteSessions(data){return ((data&&data.lessons)||[]).map(l=>({id:l.classId+'-d'+l.day+'-p'+l.period,type:'onsite',day:l.day,period:l.period,classIds:[l.classId],subject:l.subject,teacher:l.scheduleName||l.teacher}))}
function classLabel(type,id,data){if(type==='remote')return REMOTE_CLASSES[id]||id;const c=data&&data.classes&&data.classes.find(x=>x.id===id);return c&&GRADES[c.grade]?GRADES[c.grade]+' · شعبة '+c.section:(c&&c.label)||id}
const ORDER={missing:0,near:1,inactive:2,linked:3};
function teacherLinks(sessions,profiles){
  const names=new Map();
  for(const s of sessions){if(!s.teacher)continue;const r=names.get(s.teacher)||{name:s.teacher,remote:0,onsite:0};r[s.type]++;names.set(s.teacher,r)}
  const exact=new Map(),loose=new Map();
  for(const p of profiles||[]){if(!p.scheduleName)continue;exact.set(p.scheduleName,p);loose.set(norm(p.scheduleName),p)}
  return [...names.values()].map(r=>{const p=exact.get(r.name),q=p?null:loose.get(norm(r.name));
    return {...r,status:p?(p.active===false?'inactive':'linked'):q?'near':'missing',account:p?p.scheduleName:q?q.scheduleName:''}})
    .sort((a,b)=>ORDER[a.status]-ORDER[b.status]||a.name.localeCompare(b.name,'ar'));
}
const REMOTE_TIMES=[['7:00','7:40'],['7:40','8:20'],['8:20','9:00'],['9:15','9:55'],['9:55','10:35'],['10:35','11:15'],['11:15','11:55']];
// Onsite bell schedule approved by the school (1448): grades 1-2 and grade 3 differ only in period 3 and the first break.
const ONSITE_TIMES={
  1:[['7:00','7:50'],['7:50','8:40'],['9:05','9:55'],['9:55','10:45'],['10:45','11:35'],['11:35','12:20'],['12:30','1:00']],
  3:[['7:00','7:50'],['7:50','8:40'],['8:40','9:30'],['9:55','10:45'],['10:45','11:35'],['11:35','12:20'],['12:30','1:00']]
};
ONSITE_TIMES[2]=ONSITE_TIMES[1];
const ONSITE_BREAKS={1:'الطابور 6:45 – 7:00 · الفسحة الأولى 8:40 – 9:05 · الفسحة الثانية (الصلاة) 12:20 – 12:30',3:'الطابور 6:45 – 7:00 · الفسحة الأولى 9:30 – 9:55 · الفسحة الثانية (الصلاة) 12:20 – 12:30'};
ONSITE_BREAKS[2]=ONSITE_BREAKS[1];
function gradeOf(classId){const m=/^g([123])-/.exec(classId||'');return m?Number(m[1]):0}
function periodTime(type,period,classId){const t=type==='remote'?REMOTE_TIMES[period-1]:(ONSITE_TIMES[gradeOf(classId)]||[])[period-1];return t?t[0]+' – '+t[1]:''}
const api={remoteSessions,onsiteSessions,teacherLinks,classLabel,norm,periodTime,gradeOf};root.SchoolTimetable=api;if(typeof module==='object')module.exports=api;
if(!root.document||!root.__FUACC)return;
const F=root.__FUACC,$=id=>document.getElementById(id);
let section=null,btn=null,tab='remote',classSel='',teacherSel='',onsite=null,profiles=null,loading=false,error='',queued=false;
function isAdmin(){return !!(F.state&&F.state.role===-1&&root.firebase&&firebase.auth().currentUser)}
function ensure(){
  const ws=$('schoolWorkspace'),links=document.querySelector('#schoolGroup-day .school-nav-links');
  if(!ws||!links)return false;
  if(!section||!section.isConnected){
    section=document.createElement('details');section.className='school-workspace-section';section.id='schoolSection-timetable';section.hidden=true;
    section.innerHTML='<summary><span class="school-workspace-title">الجدول المدرسي</span><small>جدولان: عن بُعد وحضوري، وربط المعلمين بحساباتهم</small></summary><div class="school-workspace-body"><div class="tt"></div></div>';
    ws.append(section);section.addEventListener('click',onClick);section.addEventListener('change',onChange);
  }
  if(!btn||!btn.isConnected){btn=document.createElement('button');btn.type='button';btn.id='vTimetable';btn.dataset.workspaceKey='timetable';btn.textContent='الجدول المدرسي';btn.addEventListener('click',()=>load(false));links.prepend(btn)}
  return true;
}
async function load(force){
  if(!isAdmin()||loading)return;
  if(onsite&&profiles&&!force){render();return}
  loading=true;render();
  try{const db=firebase.firestore();const [o,p]=await Promise.all([db.doc('config/subs-onsite-data').get(),db.collection('teacherProfiles').get()]);
    onsite=o.exists?o.data():{classes:[],lessons:[]};profiles=p.docs.map(d=>({uid:d.id,...d.data()}));error=''}
  catch(e){error='تعذّر تحميل الجدول الحضوري أو حسابات المعلمين. حدّث الصفحة وحاول مجددًا.'}
  finally{loading=false;render()}
}
function times(type,i,classId){return periodTime(type,i+1,classId)}
// Onsite day layout with assembly, breaks and prayer in place, per grade (approved bell schedule).
const ONSITE_LAYOUT={
  1:[{b:'الطابور',t:'6:45 – 7:00',k:'line'},1,2,{b:'الفسحة الأولى',t:'8:40 – 9:05',k:'break'},3,4,5,6,{b:'الفسحة الثانية · الصلاة',t:'12:20 – 12:30',k:'prayer'},7],
  3:[{b:'الطابور',t:'6:45 – 7:00',k:'line'},1,2,3,{b:'الفسحة الأولى',t:'9:30 – 9:55',k:'break'},4,5,6,{b:'الفسحة الثانية · الصلاة',t:'12:20 – 12:30',k:'prayer'},7]
};
ONSITE_LAYOUT[2]=ONSITE_LAYOUT[1];
function gridHtml(type,sessions,data){
  const headClass=teacherSel?'':classSel;
  const layout=(type==='onsite'&&headClass&&ONSITE_LAYOUT[gradeOf(headClass)])||[1,2,3,4,5,6,7];
  const head='<thead><tr><th>اليوم</th>'+layout.map(c=>{
    if(typeof c==='object')return '<th class="tt-break tt-'+c.k+'">'+c.b+'<small>'+c.t+'</small></th>';
    const t=(type==='remote'||headClass)?times(type,c-1,headClass):'';return '<th>'+PERIODS[c-1]+(t?'<small>'+t+'</small>':'')+'</th>'}).join('')+'</tr></thead>';
  const body=DAYS.map((d,di)=>'<tr><th>'+d+'</th>'+layout.map(c=>{
    if(typeof c==='object')return di===0?'<td class="tt-break tt-'+c.k+'" rowspan="'+DAYS.length+'"><span>'+c.b+'</span></td>':'';
    const here=sessions.filter(s=>s.day===di&&s.period===c);
    return '<td class="tt-cell">'+(here.length?here.map(s=>'<b>'+esc(s.subject)+'</b><small>'+esc(teacherSel?s.classIds.map(id=>classLabel(type,id,data)).join('، '):s.teacher)+'</small>'+(teacherSel&&type==='onsite'?'<small>'+esc(periodTime(type,s.period,s.classIds[0]))+'</small>':'')).join('<hr>'):'<span class="tt-empty">—</span>')+'</td>'}).join('')+'</tr>').join('');
  return '<table class="tt-grid">'+head+'<tbody>'+body+'</tbody></table>';
}
function render(){
  if(!section)return;const box=section.querySelector('.tt');if(!box)return;
  const remote=remoteSessions(F.S),ons=onsiteSessions(onsite);
  let html='<div class="tt-tabs" role="tablist">'+[['remote','جدول عن بُعد'],['onsite','جدول حضوري'],['links','ربط المعلمين']].map(([k,t])=>'<button type="button" role="tab" data-tab="'+k+'" aria-pressed="'+(tab===k)+'">'+t+'</button>').join('')+'</div>';
  if(error)html+='<p class="tt-note">'+esc(error)+'</p>';
  if(tab==='links'){
    if(!profiles){html+='<p class="tt-note">'+(loading?'جارٍ تحميل حسابات المعلمين…':'اضغط «تحديث» لتحميل الحسابات.')+'</p>';box.innerHTML=html;return}
    const rows=teacherLinks(remote.concat(ons),profiles),linked=rows.filter(r=>r.status==='linked').length;
    const label={linked:'مرتبط',near:'اسم مشابه — يحتاج توحيد',missing:'لا يوجد حساب',inactive:'الحساب موقوف'};
    html+='<p class="tt-sum">'+linked+' من '+rows.length+' معلمًا مرتبط بحسابه. الربط يكون بتطابق الاسم في الجدول مع اسم الحساب حرفيًا، وبدونه لا يرى المعلم حصصه ولا تصله تنبيهاتها.</p><div class="tt-actions-row"><button type="button" data-reload>تحديث</button></div>'+
      '<div class="tt-wrap"><table class="tt-grid tt-links"><thead><tr><th>الاسم في الجدول</th><th>حصص عن بُعد</th><th>حصص حضورية</th><th>الحالة</th><th>اسم الحساب</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><th>'+esc(r.name)+'</th><td>'+r.remote+'</td><td>'+r.onsite+'</td><td><span class="tt-badge '+r.status+'">'+label[r.status]+'</span></td><td>'+esc(r.account||'—')+'</td></tr>').join('')+'</tbody></table></div>';
    box.innerHTML=html;return;
  }
  const type=tab,sessions=type==='remote'?remote:ons,data=type==='remote'?null:onsite;
  if(type==='onsite'&&!onsite){html+='<p class="tt-note">'+(loading?'جارٍ تحميل الجدول الحضوري…':'اضغط «تحديث» لتحميل الجدول الحضوري.')+'</p><div class="tt-actions-row"><button type="button" data-reload>تحديث</button></div>';box.innerHTML=html;return}
  const classes=[...new Set(sessions.flatMap(s=>s.classIds))].sort((a,b)=>type==='remote'?Object.keys(REMOTE_CLASSES).indexOf(a)-Object.keys(REMOTE_CLASSES).indexOf(b):a.localeCompare(b,'en',{numeric:true}));
  const teachers=[...new Set(sessions.map(s=>s.teacher).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  if(teacherSel&&!teachers.includes(teacherSel))teacherSel='';
  if(!classes.includes(classSel))classSel=classes[0]||'';
  const shown=teacherSel?sessions.filter(s=>s.teacher===teacherSel):sessions.filter(s=>s.classIds.includes(classSel));
  html+='<div class="tt-bar"><label>الفصل<select data-f="class"'+(teacherSel?' disabled':'')+'>'+classes.map(id=>'<option value="'+esc(id)+'"'+(id===classSel?' selected':'')+'>'+esc(classLabel(type,id,data))+'</option>').join('')+'</select></label>'+
    '<label>أو المعلم<select data-f="teacher"><option value="">— حسب الفصل —</option>'+teachers.map(t=>'<option'+(t===teacherSel?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'+
    '<div class="tt-actions"><button type="button" data-print>طباعة</button><button type="button" data-reload>تحديث</button></div></div>';
  html+='<p class="tt-sum">جدول '+TYPES[type]+' · '+(teacherSel?esc(teacherSel):esc(classLabel(type,classSel,data)))+' · '+shown.length+' حصة أسبوعيًا · مجموع الجدول: '+sessions.length+' حصة، '+classes.length+' فصل، '+teachers.length+' معلم'+'</p>'+(type==='onsite'&&teacherSel?'<p class="tt-note">الطابور 6:45 – 7:00 · الفسحة الأولى: الأول والثاني 8:40 – 9:05، الثالث 9:30 – 9:55 · الصلاة 12:20 – 12:30</p>':'');
  html+=sessions.length?'<div class="tt-wrap">'+gridHtml(type,shown,data)+'</div>':'<p class="tt-note">لا توجد حصص في هذا الجدول بعد.</p>';
  box.innerHTML=html;
}
function onClick(e){
  const t=e.target.closest('[data-tab],[data-reload],[data-print]');if(!t)return;
  if(t.dataset.tab){tab=t.dataset.tab;teacherSel='';if(tab!=='remote'&&(!onsite||!profiles))load(false);else render();return}
  if(t.hasAttribute('data-reload')){load(true);return}
  if(t.hasAttribute('data-print')&&root.ReportKit){const grid=section.querySelector('.tt-wrap');const title='الجدول المدرسي · '+TYPES[tab];const sub=teacherSel||classLabel(tab,classSel,tab==='remote'?null:onsite);root.ReportKit.open({title,subtitle:sub,body:grid?grid.innerHTML:'',landscape:true,signatures:['وكيل الشؤون التعليمية','مدير المدرسة']})}
}
function onChange(e){const s=e.target.closest('select[data-f]');if(!s)return;if(s.dataset.f==='class'){classSel=s.value;teacherSel=''}else teacherSel=s.value;render()}
function paint(){queued=false;if(!ensure())return;const show=isAdmin();if(btn.hidden===show)btn.hidden=!show;if(section.hidden===show)section.hidden=!show;if(show&&!section.querySelector('.tt').childElementCount)render()}
function schedule(){if(!queued){queued=true;queueMicrotask(paint)}}
new MutationObserver(muts=>{if(section&&muts.every(m=>section.contains(m.target)))return;schedule()}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
schedule();
})(typeof window==='undefined'?globalThis:window);
