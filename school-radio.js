/* school-radio.js — school morning radio (الإذاعة المدرسية) for the manager.
   Plan: one program per school day, rotated across classes, with a supervising teacher, theme and segments.
   Each program records the participating students per segment, execution status, rating and notes;
   prints the term plan and the daily program, and can publish the day's program to the display screen. */
(function(root){'use strict';
if(!root.document)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GRADES=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
const PARTS=['التقديم','القرآن الكريم','الحديث الشريف','كلمة الصباح','هل تعلم','فقرة المناسبة','الختام'];
const STATUS={planned:'مخطط',done:'نُفّذ',cancelled:'أُلغي'};
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const managerMode=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const fs=()=>firebase.firestore();
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const isDate=d=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d||'');
const hijri=d=>{if(!isDate(d))return d||'';try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00Z'));}catch(e){return d;}};
const dow=d=>new Date(d+'T12:00:00Z').getUTCDay();
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const message=err=>err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية هذا الإجراء.':(err&&err.message)||'تعذّر إكمال العملية.';
let host=null,actor='',tab='plan',classes=[],teachers=[],items=[],open='',draft=[],busy=false;
const status=t=>{const s=$('raStatus');if(s)s.textContent=t;};
const clsLabel=id=>{const c=classes.find(x=>x.id===id);return c?c.label:id||'';};
function ensure(){
  const ws=$('schoolWorkspace');if(!ws)return null;
  if(!host||!host.isConnected){
    host=document.createElement('section');host.id='schoolSection-radio';host.className='school-workspace-section ra-page';host.hidden=true;host.setAttribute('aria-label','الإذاعة المدرسية');
    host.innerHTML='<div class="ra-head"><h2>الإذاعة المدرسية</h2><p>خطة الإذاعة الصباحية: توزيع الأيام على الفصول، الفقرات والطلاب المشاركون، التنفيذ والتقييم.</p>'+
      '<div class="ra-tabs" role="tablist"><button type="button" role="tab" data-ra-tab="plan">الخطة</button><button type="button" role="tab" data-ra-tab="auto">توزيع تلقائي</button><button type="button" role="tab" data-ra-tab="stats">المتابعة</button></div></div><p id="raStatus" role="status"></p><div id="raBody"></div>';
    ws.append(host);host.addEventListener('click',onClick);host.addEventListener('submit',onSubmit);host.addEventListener('change',onChange);
  }
  const links=document.querySelector('.school-sidebar-links');
  if(links&&!$('schoolRadioLink')){const b=document.createElement('button');b.type='button';b.id='schoolRadioLink';b.className='school-home-link';b.dataset.workspaceKey='radio';b.textContent='الإذاعة المدرسية';
    const after=$('schoolFamilyLink')||$('schoolFormsLink')||$('schoolHomeLink');if(after&&after.parentNode===links)after.after(b);else links.append(b);}
  return host;
}
async function tick(){
  const h=ensure();if(!h)return;
  const show=managerMode(),b=$('schoolRadioLink');
  if(b&&b.hidden===show)b.hidden=!show;if(h.hidden===show)h.hidden=!show;
  if(!show){actor='';return;}
  const now=firebase.auth().currentUser.uid;if(now===actor)return;actor=now;
  status('جارٍ التحميل…');
  try{
    const db=fs();
    const [reg,progs]=await Promise.all([db.doc('config/onsite-classes').get(),db.collection('radioPrograms').get()]);
    if(now!==actor)return;
    classes=Object.values((reg.data()||{}).classes||{}).filter(c=>c.active!==false).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true})).map(c=>({id:c.id,label:(GRADES[c.grade]||'')+' '+c.grade+'/'+c.section,students:null}));
    teachers=[...new Set(((root.__FUACC&&root.__FUACC.S)||[]).map(r=>r.teacher).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    items=progs.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    status('');paint();
  }catch(err){status(message(err));}
}
async function roster(id){
  const c=classes.find(x=>x.id===id);if(!c)return [];
  if(!c.students){const s=await fs().doc('config/onsite-students-'+id).get();c.students=((s.data()||{}).students||[]).map(x=>x.name).filter(Boolean);}
  return c.students;
}
function paint(){
  for(const b of host.querySelectorAll('[data-ra-tab]'))b.setAttribute('aria-selected',String(b.dataset.raTab===tab));
  $('raBody').innerHTML=tab==='plan'?planView():tab==='auto'?autoView():statsView();
}
const opt=(list,sel,blank)=>(blank?'<option value="">'+blank+'</option>':'')+list.map(([v,l])=>'<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(l)+'</option>').join('');
const classOpts=sel=>opt(classes.map(c=>[c.id,c.label]),sel,'اختر الفصل');
const teacherOpts=sel=>opt(teachers.map(t=>[t,t]),sel,'اختر المعلم المشرف');
function planView(){
  const t=today(),next=items.find(a=>a.date>=t&&a.status!=='cancelled');
  const form='<form id="raNew" class="ra-form"><label>التاريخ<input type="date" name="date" required value="'+t+'"></label><label>الفصل<select name="classId" required>'+classOpts('')+'</select></label>'+
    '<label>المعلم المشرف<select name="supervisor">'+teacherOpts('')+'</select></label><label>موضوع الإذاعة<input name="theme" maxlength="120" placeholder="مثال: اليوم الوطني"></label><div class="ra-wide"><button type="submit" class="ra-primary">إضافة يوم إذاعة</button> <button type="button" data-ra-print-plan>طباعة الخطة</button></div></form>';
  const rows=items.map(a=>'<tr'+(a.id===open?' class="ra-open"':'')+'><td>'+esc(DAYS[dow(a.date)]||'')+'<br><small>'+esc(hijri(a.date))+'</small></td><td>'+esc(a.classLabel||clsLabel(a.classId))+'</td><td>'+esc(a.theme||'—')+'</td><td>'+esc(a.supervisor||'—')+'</td><td><span class="ra-st ra-'+esc(a.status)+'">'+esc(STATUS[a.status]||a.status)+'</span>'+(a.rating?' '+'★'.repeat(a.rating):'')+'</td>'+
    '<td class="ra-act"><button type="button" data-ra-open="'+esc(a.id)+'">'+(a.id===open?'إغلاق':'الفقرات والتنفيذ')+'</button><button type="button" data-ra-print="'+esc(a.id)+'">طباعة</button><button type="button" data-ra-screen="'+esc(a.id)+'">إعلان على الشاشة</button></td></tr>'+(a.id===open?'<tr><td colspan="6">'+editor(a)+'</td></tr>':'')).join('');
  return (next?'<p class="ra-next">الإذاعة القادمة: <b>'+esc(DAYS[dow(next.date)])+' '+esc(hijri(next.date))+'</b> — '+esc(next.classLabel||clsLabel(next.classId))+(next.theme?' — '+esc(next.theme):'')+'</p>':'')+form+
    (rows?'<div class="ra-grid"><table><thead><tr><th>اليوم</th><th>الفصل</th><th>الموضوع</th><th>المشرف</th><th>الحالة</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="ra-hint">لا توجد أيام إذاعة بعد. أضف يومًا أو استخدم التوزيع التلقائي.</p>');
}
function editor(a){
  const c=classes.find(x=>x.id===a.classId),names=(c&&c.students)||[];
  const list='<datalist id="raNames">'+names.map(n=>'<option value="'+esc(n)+'">').join('')+'</datalist>';
  const segs=draft.map((s,i)=>'<tr><td><input data-ra-part="'+i+'" value="'+esc(s.part)+'" maxlength="60"></td><td><input data-ra-student="'+i+'" value="'+esc(s.student)+'" list="raNames" maxlength="80" placeholder="اسم الطالب"></td><td><button type="button" data-ra-del="'+i+'" aria-label="حذف الفقرة">✕</button></td></tr>').join('');
  return '<form id="raEdit" class="ra-edit" data-id="'+esc(a.id)+'">'+list+'<div class="ra-form"><label>الموضوع<input name="theme" maxlength="120" value="'+esc(a.theme||'')+'"></label><label>المعلم المشرف<select name="supervisor">'+teacherOpts(a.supervisor||'')+'</select></label>'+
    '<label>الحالة<select name="status">'+opt(Object.entries(STATUS),a.status)+'</select></label><label>التقييم<select name="rating">'+opt([['0','بدون'],['1','★'],['2','★★'],['3','★★★'],['4','★★★★'],['5','★★★★★']],String(a.rating||0))+'</select></label></div>'+
    '<table class="ra-segs"><thead><tr><th>الفقرة</th><th>الطالب المشارك</th><th></th></tr></thead><tbody>'+segs+'</tbody></table><button type="button" data-ra-add>إضافة فقرة</button>'+
    '<label class="ra-wide">ملاحظات<textarea name="notes" rows="2" maxlength="600">'+esc(a.notes||'')+'</textarea></label><button type="submit" class="ra-primary">حفظ</button></form>';
}
function autoView(){
  const t=today();
  return '<form id="raAuto" class="ra-form"><label>من<input type="date" name="from" required value="'+t+'"></label><label>إلى<input type="date" name="to" required value="'+addDays(t,28)+'"></label>'+
    '<label>يبدأ بالفصل<select name="first">'+classOpts(classes[0]&&classes[0].id)+'</select></label><fieldset class="ra-wide"><legend>أيام الإذاعة</legend>'+[0,1,2,3,4].map(d=>'<label class="ra-chk"><input type="checkbox" name="days" value="'+d+'" checked>'+DAYS[d]+'</label>').join('')+'</fieldset>'+
    '<p class="ra-hint ra-wide">يوزَّع كل يوم على فصل بالتناوب، وتُتخطّى الأيام التي فيها إذاعة مسجلة مسبقًا. راجع الأيام قبل الحفظ واحذف أيام الإجازات.</p><div class="ra-wide"><button type="submit" class="ra-primary">معاينة التوزيع</button></div></form><div id="raPreview"></div>';
}
function statsView(){
  const done=items.filter(a=>a.status==='done'),t=today();
  const per=classes.map(c=>{const mine=items.filter(a=>a.classId===c.id&&a.status!=='cancelled');return {c,total:mine.length,done:mine.filter(a=>a.status==='done').length,next:(mine.find(a=>a.date>=t)||{}).date};});
  const late=items.filter(a=>a.status==='planned'&&a.date<t);
  const avg=done.filter(a=>a.rating).reduce((s,a,_,l)=>s+a.rating/l.length,0);
  return '<div class="ra-kpis"><div><b>'+items.filter(a=>a.status!=='cancelled').length+'</b><span>يوم إذاعة في الخطة</span></div><div><b>'+done.length+'</b><span>نُفّذ</span></div><div class="ra-bad"><b>'+late.length+'</b><span>مضى تاريخه ولم يُسجّل تنفيذه</span></div><div><b>'+(avg?avg.toFixed(1):'—')+'</b><span>متوسط التقييم</span></div></div>'+
    '<div class="ra-grid"><table><thead><tr><th>الفصل</th><th>أيامه في الخطة</th><th>نُفّذ</th><th>إذاعته القادمة</th></tr></thead><tbody>'+per.map(p=>'<tr><td>'+esc(p.c.label)+'</td><td>'+p.total+'</td><td>'+p.done+'</td><td>'+(p.next?esc(hijri(p.next)):'—')+'</td></tr>').join('')+'</tbody></table></div>'+
    (late.length?'<h3>بحاجة لتسجيل التنفيذ</h3><ul>'+late.map(a=>'<li>'+esc(hijri(a.date))+' — '+esc(a.classLabel||clsLabel(a.classId))+'</li>').join('')+'</ul>':'');
}
function report(title,body,signatures){if(!root.ReportKit){status('أداة الطباعة غير متاحة.');return;}if(!root.ReportKit.open({title,subtitle:'ثانوية الصحافة الأهلية',body,signatures}))status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');}
let preview=[];
function onChange(e){const i=e.target.dataset;if(i.raPart!=null)draft[+i.raPart].part=e.target.value;if(i.raStudent!=null)draft[+i.raStudent].student=e.target.value;}
async function onClick(e){
  const b=e.target.closest('button');if(!b||!host.contains(b))return;const d=b.dataset;
  if(d.raTab){tab=d.raTab;open='';paint();status('');return;}
  if(d.raOpen){if(open===d.raOpen){open='';paint();return;}const a=items.find(x=>x.id===d.raOpen);open=a.id;draft=(a.segments&&a.segments.length?a.segments:PARTS.map(p=>({part:p,student:''}))).map(s=>({part:s.part,student:s.student||''}));try{await roster(a.classId);}catch(err){}paint();return;}
  if(b.hasAttribute('data-ra-add')){if(draft.length<15){draft.push({part:'',student:''});paint();}return;}
  if(d.raDel!=null){draft.splice(+d.raDel,1);paint();return;}
  if(d.raPrint){const a=items.find(x=>x.id===d.raPrint);const segs=(a.segments&&a.segments.length?a.segments:PARTS.map(p=>({part:p,student:''})));
    report('برنامج الإذاعة المدرسية — '+DAYS[dow(a.date)]+' '+hijri(a.date),'<p><b>الفصل:</b> '+esc(a.classLabel||clsLabel(a.classId))+' &nbsp; <b>الموضوع:</b> '+esc(a.theme||'—')+' &nbsp; <b>المعلم المشرف:</b> '+esc(a.supervisor||'—')+'</p><table><thead><tr><th>م</th><th>الفقرة</th><th>الطالب</th></tr></thead><tbody>'+segs.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(s.part)+'</td><td>'+esc(s.student||'')+'</td></tr>').join('')+'</tbody></table>',['المعلم المشرف','رائد النشاط','مدير المدرسة']);return;}
  if(b.hasAttribute('data-ra-print-plan')){const list=items.filter(a=>a.status!=='cancelled');report('خطة الإذاعة المدرسية','<table><thead><tr><th>م</th><th>اليوم</th><th>التاريخ</th><th>الفصل</th><th>الموضوع</th><th>المشرف</th><th>التنفيذ</th></tr></thead><tbody>'+list.map((a,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(DAYS[dow(a.date)])+'</td><td>'+esc(hijri(a.date))+'</td><td>'+esc(a.classLabel||clsLabel(a.classId))+'</td><td>'+esc(a.theme||'')+'</td><td>'+esc(a.supervisor||'')+'</td><td>'+esc(STATUS[a.status]||'')+'</td></tr>').join('')+'</tbody></table>',['رائد النشاط','مدير المدرسة']);return;}
  if(d.raScreen){screenAnnounce(items.find(x=>x.id===d.raScreen));return;}
  if(b.hasAttribute('data-ra-save-auto')){saveAuto();return;}
  if(d.raSkip!=null){preview.splice(+d.raSkip,1);paintPreview();return;}
}
async function screenAnnounce(a){
  if(busy||!a)return;busy=true;status('جارٍ النشر على الشاشة…');
  const segs=(a.segments||[]).filter(s=>s.student).map(s=>s.part+': '+s.student).join('\n');
  const uid=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp();
  try{await fs().collection('announcements').add({title:('الإذاعة المدرسية اليوم'+(a.theme?' — '+a.theme:'')).slice(0,120),body:(('يقدّمها طلاب '+(a.classLabel||clsLabel(a.classId)))+(segs?'\n'+segs:'')).slice(0,1000),audience:'screen',start:a.date,end:a.date,active:true,createdBy:uid,createdAt:ts,updatedBy:uid,updatedAt:ts});status('نُشر إعلان الإذاعة على شاشة العرض ليوم '+hijri(a.date)+'.');}
  catch(err){status(message(err));}finally{busy=false;}
}
function clean(v,n){return String(v||'').trim().slice(0,n);}
async function onSubmit(e){
  const f=e.target,el=f.elements;e.preventDefault();if(busy||!managerMode())return;
  const uid=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp();
  if(f.id==='raNew'){
    const date=el.date.value,classId=el.classId.value;if(!isDate(date)||!classId){status('اختر التاريخ والفصل.');return;}
    if(items.some(a=>a.date===date&&a.status!=='cancelled')){status('يوجد يوم إذاعة مسجل في هذا التاريخ.');return;}
    const a={date,classId,classLabel:clsLabel(classId),supervisor:clean(el.supervisor.value,80),theme:clean(el.theme.value,120),segments:PARTS.map(p=>({part:p,student:''})),status:'planned',rating:0,notes:'',createdBy:uid,createdAt:ts,updatedBy:uid,updatedAt:ts};
    busy=true;try{const ref=await fs().collection('radioPrograms').add(a);items.push(Object.assign({id:ref.id},a));items.sort((x,y)=>x.date.localeCompare(y.date));paint();status('أُضيف يوم الإذاعة.');}catch(err){status(message(err));}finally{busy=false;}
    return;
  }
  if(f.id==='raEdit'){
    const a=items.find(x=>x.id===f.dataset.id);if(!a)return;
    const segs=draft.map(s=>({part:clean(s.part,60),student:clean(s.student,80)})).filter(s=>s.part).slice(0,15);
    const u={theme:clean(el.theme.value,120),supervisor:clean(el.supervisor.value,80),status:el.status.value,rating:+el.rating.value||0,notes:clean(el.notes.value,600),segments:segs,updatedBy:uid,updatedAt:ts};
    busy=true;try{await fs().collection('radioPrograms').doc(a.id).update(u);Object.assign(a,u);open='';paint();status('حُفظ برنامج الإذاعة.');}catch(err){status(message(err));}finally{busy=false;}
    return;
  }
  if(f.id==='raAuto'){
    const from=el.from.value,to=el.to.value,days=[...f.querySelectorAll('input[name=days]:checked')].map(x=>+x.value);
    if(!isDate(from)||!isDate(to)||to<from){status('تحقق من التاريخين.');return;}
    if(!classes.length||!days.length){status('لا توجد فصول أو أيام مختارة.');return;}
    let ci=Math.max(0,classes.findIndex(c=>c.id===el.first.value));preview=[];
    for(let d=from;d<=to&&preview.length<120;d=addDays(d,1)){if(!days.includes(dow(d))||items.some(a=>a.date===d&&a.status!=='cancelled'))continue;const c=classes[ci%classes.length];ci++;preview.push({date:d,classId:c.id,classLabel:c.label});}
    paintPreview();
  }
}
function paintPreview(){
  const box=$('raPreview');if(!box)return;
  box.innerHTML=preview.length?'<div class="ra-grid"><table><thead><tr><th>اليوم</th><th>التاريخ</th><th>الفصل</th><th></th></tr></thead><tbody>'+preview.map((p,i)=>'<tr><td>'+esc(DAYS[dow(p.date)])+'</td><td>'+esc(hijri(p.date))+'</td><td>'+esc(p.classLabel)+'</td><td><button type="button" data-ra-skip="'+i+'">استبعاد</button></td></tr>').join('')+'</tbody></table></div><button type="button" class="ra-primary" data-ra-save-auto>حفظ '+preview.length+' يومًا في الخطة</button>':'<p class="ra-hint">لا توجد أيام متاحة في هذه المدة.</p>';
}
async function saveAuto(){
  if(busy||!preview.length||!managerMode())return;busy=true;status('جارٍ الحفظ…');
  const uid=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp(),db=fs(),batch=db.batch(),added=[];
  for(const p of preview){const ref=db.collection('radioPrograms').doc();const a={date:p.date,classId:p.classId,classLabel:p.classLabel,supervisor:'',theme:'',segments:PARTS.map(x=>({part:x,student:''})),status:'planned',rating:0,notes:'',createdBy:uid,createdAt:ts,updatedBy:uid,updatedAt:ts};batch.set(ref,a);added.push(Object.assign({id:ref.id},a));}
  try{await batch.commit();items=items.concat(added).sort((x,y)=>x.date.localeCompare(y.date));preview=[];tab='plan';paint();status('حُفظت '+added.length+' أيام في خطة الإذاعة.');}catch(err){status(message(err));}finally{busy=false;}
}
const style=document.createElement('style');
style.textContent='.ra-page{direction:rtl}.ra-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.ra-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.ra-head p{margin:0 0 12px;color:#5b6b66}'+
  '.ra-tabs{display:flex;gap:4px;border-bottom:2px solid #dbe8e4;flex-wrap:wrap}.ra-tabs button{font:inherit;border:0;border-bottom:3px solid transparent;border-radius:8px 8px 0 0;background:transparent;padding:9px 16px;font-weight:600;color:#4a5e58;margin-bottom:-2px;cursor:pointer}.ra-tabs button[aria-selected=true]{border-bottom-color:#17624d;color:#17624d;background:#eef6f2}'+
  '#raStatus:empty{display:none}#raStatus{font-weight:600;color:#17624d}.ra-hint{color:#5b6b66}.ra-next{background:#eef6f2;border:1px solid #cfe3da;border-radius:12px;padding:10px 14px}'+
  '.ra-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;background:#fff;border:1px solid #dae5df;border-radius:14px;padding:14px;margin-bottom:12px}.ra-form label,.ra-wide{display:grid;gap:4px;font-size:14px}.ra-wide{grid-column:1/-1}.ra-chk{display:inline-flex!important;gap:4px;margin-inline-end:14px}'+
  '.ra-page input,.ra-page select,.ra-page textarea{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit}.ra-page button{font:inherit;padding:6px 11px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer;color:inherit}.ra-page .ra-primary{background:#17624d;color:#fff;border-color:#17624d}'+
  '.ra-grid{overflow:auto;background:#fff;border:1px solid #dae5df;border-radius:12px;margin-bottom:12px}.ra-grid table,.ra-segs{border-collapse:collapse;width:100%;font-size:14px}.ra-grid th,.ra-grid td,.ra-segs td,.ra-segs th{border-bottom:1px solid #e3ece8;padding:7px;text-align:start;vertical-align:top}.ra-grid thead{background:#e8f2ed}'+
  '.ra-act{display:flex;gap:4px;flex-wrap:wrap}.ra-open{background:#f4faf7}.ra-edit{display:grid;gap:10px}.ra-segs input{width:100%}.ra-st{font-weight:600}.ra-done{color:#17633a}.ra-planned{color:#7a4d00}.ra-cancelled{color:#9f2727}'+
  '.ra-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px}.ra-kpis div{background:#fff;border:1px solid #dae5df;border-radius:12px;padding:10px 12px}.ra-kpis b{display:block;font-size:22px}.ra-kpis span{font-size:13px;color:#4a5e58}.ra-bad b{color:#9f2727}';
document.head.append(style);
setInterval(tick,1000);
})(window);
