/* school-audit.js — manager tools: activity log, recycle bin and reports center.
   Activity log: recent changes across the platform's modules, built from each record's updatedBy/updatedAt stamps.
   Recycle bin: items that were stopped, cancelled or cleared (the platform never hard-deletes), with restore where safe.
   Reports center: one catalog of every printable report, opening the section that produces it. */
(function(root){'use strict';
if(!root.document)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const managerMode=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const fs=()=>firebase.firestore();
const SOURCES=[
  ['announcements','الإعلانات'],['radioPrograms','الإذاعة المدرسية'],['formRecords','النماذج الرسمية'],['classVisits','الزيارات الصفية'],
  ['remedialPlans','الخطط العلاجية'],['absenceActions','إجراءات الغياب'],['classRosters','قوائم الأسماء للمعلمين'],['formAccess','صلاحيات النماذج']];
const LABEL_KEYS=['title','formTitle','theme','studentName','student','name','teacher','classLabel','code','classId'];
const REPORTS=[
  {group:'الحضور والغياب',items:[['vStudentAttendance','حضور الطلاب وغيابهم','كشوف الغياب اليومية والأسبوعية، الغياب المتكرر، وإجراءات الغياب'],['vReport','تقرير متابعة الحصص','نسب الرصد والحضور في الحصص عن بُعد لكل معلم وفصل'],['vBoard','لوحة المؤشرات','مؤشرات الأسبوع وترتيب الفصول والمعلمين']]},
  {group:'المعلمون والمتابعة',items:[['vAcc','المساءلة','سجلات المساءلة وخطابات التنبيه ومحاضرها'],['schoolSupervisionLink','الزيارات الصفية والخطط العلاجية','تقارير الزيارات الصفية ومتابعة الخطط العلاجية'],['vSubs','حصص الانتظار','توزيع الانتظار والتغطية'],['vSchoolDuty','المناوبة والإشراف','جداول المناوبة والإشراف اليومي']]},
  {group:'الجداول',items:[['vTimetable','الجدول المدرسي','جداول الفصول والمعلمين'],['vSchoolSchedule','الجدول الحضوري','جدول الأيام الحضورية']]},
  {group:'الطلاب والنشاط',items:[['schoolProfilesLink','ملفات الطلاب والفصول','ملف الطالب والفصل والمعلم في صفحة واحدة'],['schoolRadioLink','الإذاعة المدرسية','خطة الإذاعة وبرنامج كل يوم'],['schoolFamilyLink','أولياء الأمور','كشف جهات التواصل والأرقام الناقصة']]},
  {group:'النماذج والتوقيعات',items:[['schoolFormsLink','النماذج الرسمية','طباعة النماذج المعتمدة لكل جهة'],['vSignatures','التوقيعات','حالة توقيع المستندات والإقرارات'],['vAssignments','التكليفات','التكليفات وحالة استلامها']]}];
let audit=null,reports=null,actor='',tab='log',events=[],bin=[],names={},filter={src:'',days:'7',who:''},busy=false;
const status=t=>{const s=$('auStatus');if(s)s.textContent=t;};
const message=err=>err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية هذا الإجراء.':(err&&err.message)||'تعذّر إكمال العملية.';
const toDate=v=>v&&typeof v.toDate==='function'?v.toDate():typeof v==='string'||typeof v==='number'?new Date(v):null;
const when=d=>d&&!isNaN(d)?new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{timeZone:'Asia/Riyadh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d):'—';
const labelOf=d=>{for(const k of LABEL_KEYS)if(d[k]&&typeof d[k]==='string')return d[k];return '';};
function section(key,id,text,aria){
  const ws=$('schoolWorkspace');if(!ws)return null;
  let h=$('schoolSection-'+key);
  if(!h){h=document.createElement('section');h.id='schoolSection-'+key;h.className='school-workspace-section au-page';h.hidden=true;h.setAttribute('aria-label',aria);ws.append(h);}
  const links=document.querySelector('.school-sidebar-links');
  if(links&&!$(id)){const b=document.createElement('button');b.type='button';b.id=id;b.className='school-home-link';b.dataset.workspaceKey=key;b.textContent=text;links.append(b);}
  return h;
}
function ensure(){
  const a=section('audit','schoolAuditLink','سجل العمليات وسلة المحذوفات','سجل العمليات وسلة المحذوفات');
  const r=section('reports','schoolReportsLink','مركز التقارير','مركز التقارير');
  if(a&&a!==audit){audit=a;a.innerHTML='<div class="au-head"><h2>سجل العمليات وسلة المحذوفات</h2><p>من عدّل ماذا ومتى في أقسام المنصة، والعناصر الموقوفة أو الملغاة أو الممسوحة مع إمكانية استعادتها.</p><div class="au-tabs" role="tablist"><button type="button" role="tab" data-au-tab="log">سجل العمليات</button><button type="button" role="tab" data-au-tab="bin">سلة المحذوفات</button></div></div><p id="auStatus" role="status"></p><div id="auBody"></div>';a.addEventListener('click',onClick);a.addEventListener('change',onChange);}
  if(r&&r!==reports){reports=r;r.addEventListener('click',onReportClick);r.addEventListener('change',onReportChange);}
  return a&&r;
}
async function tick(){
  if(!ensure())return;
  const show=managerMode();
  for(const [h,id] of [[audit,'schoolAuditLink'],[reports,'schoolReportsLink']]){const b=$(id);if(b&&b.hidden===show)b.hidden=!show;if(h.hidden===show)h.hidden=!show;}
  if(!show){actor='';return;}
  const now=firebase.auth().currentUser.uid;if(now===actor)return;actor=now;
  paintReports();await load();
}
async function load(){
  status('جارٍ تحميل السجل…');
  const db=fs(),now=actor;
  const got=await Promise.all(SOURCES.map(async([col,label])=>{
    try{const s=await db.collection(col).orderBy('updatedAt','desc').limit(40).get();return s.docs.map(d=>({col,label,id:d.id,data:d.data()}));}
    catch(err){return [];}
  }));
  if(now!==actor)return;
  events=got.flat().map(e=>({col:e.col,label:e.label,id:e.id,what:labelOf(e.data)||e.id,by:e.data.updatedBy||e.data.createdBy||'',at:toDate(e.data.updatedAt),created:+(toDate(e.data.createdAt)||0)===+(toDate(e.data.updatedAt)||1),data:e.data})).filter(e=>e.at&&!isNaN(e.at)).sort((a,b)=>b.at-a.at);
  bin=[];
  for(const e of got.flat()){
    if(e.col==='announcements'&&e.data.active===false)bin.push({kind:'announcement',id:e.id,src:'الإعلانات',what:e.data.title,state:'موقوف',by:e.data.updatedBy,at:toDate(e.data.updatedAt),restore:true});
    if(e.col==='radioPrograms'&&e.data.status==='cancelled')bin.push({kind:'radio',id:e.id,src:'الإذاعة المدرسية',what:(e.data.date||'')+' — '+(e.data.classLabel||''),state:'ملغى',by:e.data.updatedBy,at:toDate(e.data.updatedAt),restore:true});
  }
  const week=root.__FUACC.state.week;
  if(typeof week==='string'&&week){try{const s=await db.collection('recordWeeks/'+week+'/logs').where('cleared','==',true).limit(60).get();for(const d of s.docs){const x=d.data();bin.push({kind:'log',id:d.id,src:'رصد الحصص (الأسبوع الحالي)',what:[x.teacher,x.day,x.entry].filter(Boolean).join(' — ')||d.id,state:'ممسوح',by:x.clearedBy,at:toDate(x.clearedAt),restore:false});}}catch(err){}}
  bin.sort((a,b)=>(b.at||0)-(a.at||0));
  await resolveNames([...new Set(events.map(e=>e.by).concat(bin.map(b=>b.by)).filter(Boolean))]);
  if(now!==actor)return;
  status('');paint();
}
async function resolveNames(uids){
  const db=fs();
  await Promise.all(uids.filter(u=>!(u in names)).slice(0,80).map(async u=>{
    names[u]='';
    for(const col of ['staffAccess','teacherProfiles','employeeProfiles']){
      try{const d=await db.doc(col+'/'+u).get();const x=d.exists?d.data():null;const n=x&&(x.name||x.displayName||x.fullName||x.teacherName);if(n){names[u]=String(n);return;}}catch(err){}
    }
  }));
}
const who=u=>u?(names[u]||(u===actor?'أنت (المدير)':'مستخدم '+u.slice(0,6))):'—';
function paint(){
  for(const b of audit.querySelectorAll('[data-au-tab]'))b.setAttribute('aria-selected',String(b.dataset.auTab===tab));
  $('auBody').innerHTML=tab==='log'?logView():binView();
}
function visible(){
  const since=filter.days?Date.now()-(+filter.days)*864e5:0;
  return events.filter(e=>(!filter.src||e.col===filter.src)&&(!filter.who||e.by===filter.who)&&(+e.at>=since));
}
function logView(){
  const users=[...new Set(events.map(e=>e.by).filter(Boolean))];
  const list=visible();
  const bar='<div class="au-bar"><label>القسم<select id="auSrc"><option value="">كل الأقسام</option>'+SOURCES.map(([c,l])=>'<option value="'+c+'"'+(c===filter.src?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    '<label>المستخدم<select id="auWho"><option value="">الجميع</option>'+users.map(u=>'<option value="'+esc(u)+'"'+(u===filter.who?' selected':'')+'>'+esc(who(u))+'</option>').join('')+'</select></label>'+
    '<label>المدة<select id="auDays">'+[['1','اليوم'],['7','آخر 7 أيام'],['30','آخر 30 يومًا'],['','الكل']].map(([v,l])=>'<option value="'+v+'"'+(v===filter.days?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    '<button type="button" data-au-reload>تحديث</button><button type="button" data-au-print>طباعة السجل</button><button type="button" data-au-csv>تصدير CSV</button>'+($('securityAuditBtn')?'<button type="button" data-au-security>سجل الأمان والدخول</button>':'')+'</div>';
  const rows=list.slice(0,300).map(e=>'<tr><td>'+esc(when(e.at))+'</td><td>'+esc(who(e.by))+'</td><td>'+esc(e.label)+'</td><td>'+(e.created?'إنشاء':'تعديل')+'</td><td>'+esc(e.what)+'</td></tr>').join('');
  return bar+'<p class="au-hint">'+list.length+' عملية. يعرض السجل آخر 40 تعديلًا من كل قسم، مأخوذة من ختم «آخر تعديل» المحفوظ مع كل سجل، ويُسجَّل بوقت الخادم.</p>'+
    (rows?'<div class="au-grid"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>القسم</th><th>العملية</th><th>العنصر</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="au-hint">لا توجد عمليات في هذه المدة.</p>');
}
function binView(){
  const rows=bin.map((b,i)=>'<tr><td>'+esc(b.src)+'</td><td>'+esc(b.what)+'</td><td>'+esc(b.state)+'</td><td>'+esc(who(b.by))+'<br><small>'+esc(when(b.at))+'</small></td><td>'+(b.restore?'<button type="button" data-au-restore="'+i+'">استعادة</button>':'<small>يُستعاد بإعادة الرصد من شاشة الحصة</small>')+'</td></tr>').join('');
  return '<p class="au-hint">المنصة لا تحذف السجلات نهائيًا: الإعلان يُوقف، ويوم الإذاعة يُلغى، والرصد يُمسح مع الاحتفاظ بمن مسحه ومتى. هنا تجد هذه العناصر وتستعيد ما يمكن استعادته.</p>'+
    (rows?'<div class="au-grid"><table><thead><tr><th>القسم</th><th>العنصر</th><th>الحالة</th><th>بواسطة</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="au-hint">سلة المحذوفات فارغة.</p>');
}
function onChange(e){const t=e.target;if(t.id==='auSrc')filter.src=t.value;else if(t.id==='auWho')filter.who=t.value;else if(t.id==='auDays')filter.days=t.value;else return;paint();}
function csvCell(v){const s=String(v==null?'':v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
async function onClick(e){
  const b=e.target.closest('button');if(!b||!audit.contains(b))return;const d=b.dataset;
  if(d.auTab){tab=d.auTab;paint();status('');return;}
  if(b.hasAttribute('data-au-reload')){load();return;}
  if(b.hasAttribute('data-au-security')){const s=$('securityAuditBtn');if(s)s.click();return;}
  if(b.hasAttribute('data-au-print')){if(!root.ReportKit)return status('أداة الطباعة غير متاحة.');const list=visible();root.ReportKit.open({title:'سجل العمليات',subtitle:list.length+' عملية',body:'<table><thead><tr><th>الوقت</th><th>المستخدم</th><th>القسم</th><th>العملية</th><th>العنصر</th></tr></thead><tbody>'+list.map(x=>'<tr><td>'+esc(when(x.at))+'</td><td>'+esc(who(x.by))+'</td><td>'+esc(x.label)+'</td><td>'+(x.created?'إنشاء':'تعديل')+'</td><td>'+esc(x.what)+'</td></tr>').join('')+'</tbody></table>',signatures:false})||status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');return;}
  if(b.hasAttribute('data-au-csv')){const lines=[['الوقت','المستخدم','القسم','العملية','العنصر']].concat(visible().map(x=>[x.at.toISOString(),who(x.by),x.label,x.created?'إنشاء':'تعديل',x.what])).map(r=>r.map(csvCell).join(','));const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='activity-log.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(d.auRestore!=null){restore(bin[+d.auRestore]);}
}
async function restore(item){
  if(!item||!item.restore||busy||!managerMode())return;busy=true;status('جارٍ الاستعادة…');
  const uid=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp();
  try{
    if(item.kind==='announcement')await fs().collection('announcements').doc(item.id).update({active:true,updatedBy:uid,updatedAt:ts});
    if(item.kind==='radio')await fs().collection('radioPrograms').doc(item.id).update({status:'planned',updatedBy:uid,updatedAt:ts});
    bin=bin.filter(x=>x!==item);paint();status('استُعيد العنصر: '+item.what);
  }catch(err){status(message(err));}finally{busy=false;}
}
// Weekly principal summary: one printable page per school week (Sunday to Thursday).
const riyadhToday=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const sundayOf=d=>{const x=new Date(d+'T12:00:00Z');return addDays(d,-x.getUTCDay());};
const hijriDay=d=>{try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00Z'));}catch(e){return d;}};
let weeklyStart='',weeklyRows=null,weeklyBusy=false;
async function weeklySummary(start){
  const end=addDays(start,4),db=fs(),since=new Date(start+'T00:00:00+03:00'),until=new Date(addDays(start,7)+'T00:00:00+03:00');
  const safe=async f=>{try{return await f();}catch(err){return null;}};
  const [logs,att,acts,radio,ann]=await Promise.all([
    safe(()=>db.collection('recordWeeks/'+start+'/logs').get()),
    safe(()=>db.collection('studentAttendance').where('date','>=',start).where('date','<=',end).get()),
    safe(()=>db.collection('absenceActions').where('createdAt','>=',since).where('createdAt','<',until).get()),
    safe(()=>db.collection('radioPrograms').where('date','>=',start).where('date','<=',end).get()),
    safe(()=>db.collection('announcements').get())]);
  const rows=[],na='تعذّر التحميل';
  const S=(root.__FUACC&&root.__FUACC.S)||[];
  if(logs){const live=logs.docs.map(d=>d.data()).filter(x=>!x.cleared);const p=live.reduce((n,x)=>n+(+x.present||0),0),a=live.reduce((n,x)=>n+(+x.absent||0),0);
    rows.push(['متابعة الحصص عن بُعد',live.length+(S.length?' من '+S.length+' حصة':'')+' مرصودة',live.length?'':'لا رصد في هذا الأسبوع (قد يكون حضوريًا أو إجازة)']);
    rows.push(['حضور الطلاب في الحصص عن بُعد',(p+a)?Math.round(p*100/(p+a))+'%':'—',(p+a)?p+' حضور، '+a+' غياب':'']);
  }else rows.push(['متابعة الحصص عن بُعد',na,'']);
  rows.push(['سجلات حضور الطلاب المرصودة',att?att.size+' حصة':na,att?new Set(att.docs.map(d=>d.data().classId)).size+' فصل':'']);
  rows.push(['إجراءات الغياب المسجلة',acts?acts.size+' إجراء':na,'']);
  if(radio){const r=radio.docs.map(d=>d.data());rows.push(['الإذاعة المدرسية',r.filter(x=>x.status==='done').length+' نُفّذ من '+r.filter(x=>x.status!=='cancelled').length,r.filter(x=>x.status==='planned'&&x.date<riyadhToday()).length?r.filter(x=>x.status==='planned'&&x.date<riyadhToday()).length+' يوم لم يُسجّل تنفيذه':'']);}else rows.push(['الإذاعة المدرسية',na,'']);
  if(ann){const a=ann.docs.map(d=>d.data()).filter(x=>x.active!==false&&(!x.start||x.start<=end)&&(!x.end||x.end>=start));rows.push(['الإعلانات الظاهرة',a.length+' إعلان',a.filter(x=>x.audience==='screen').length+' على شاشة العرض']);}
  const inWeek=e=>+e.at>=+since&&+e.at<+until;
  for(const [col,label] of SOURCES){if(['announcements','radioPrograms','formAccess','classRosters'].includes(col))continue;const list=events.filter(e=>e.col===col&&inWeek(e));rows.push([label,list.length+' عملية',list.filter(e=>e.created).length+' جديد، '+list.filter(e=>!e.created).length+' تعديل']);}
  return rows;
}
async function paintWeekly(){
  const box=$('auWeekly');if(!box)return;
  const cur=sundayOf(riyadhToday()),weeks=Array.from({length:8},(_,i)=>addDays(cur,-7*i));
  if(!weeklyStart)weeklyStart=cur;
  box.innerHTML='<h3 class="au-group">الملخص الأسبوعي للمدير</h3><div class="au-bar"><label>الأسبوع<select id="auWeek">'+weeks.map(w=>'<option value="'+w+'"'+(w===weeklyStart?' selected':'')+'>'+esc(hijriDay(w))+' ('+w+')</option>').join('')+'</select></label><button type="button" data-au-weekly-print'+(weeklyRows?'':' disabled')+'>طباعة الملخص</button></div><div id="auWeeklyBody"><p class="au-hint">جارٍ التجميع…</p></div>';
  if(weeklyBusy)return;weeklyBusy=true;const start=weeklyStart;
  try{const rows=await weeklySummary(start);if(start!==weeklyStart)return;weeklyRows=rows;
    $('auWeeklyBody').innerHTML='<div class="au-grid"><table><thead><tr><th>البند</th><th>الأسبوع</th><th>ملاحظة</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td><b>'+esc(r[1])+'</b></td><td>'+esc(r[2])+'</td></tr>').join('')+'</tbody></table></div><p class="au-hint">أعداد العمليات في الأقسام مأخوذة من آخر 40 تعديلًا لكل قسم.</p>';
    const p=box.querySelector('[data-au-weekly-print]');if(p)p.disabled=false;
  }finally{weeklyBusy=false;}
}
function onReportChange(e){if(e.target.id==='auWeek'){weeklyStart=e.target.value;weeklyRows=null;paintWeekly();}}
function paintReports(){
  const groups=REPORTS.map(g=>({group:g.group,items:g.items.filter(([id])=>$(id))})).filter(g=>g.items.length);
  reports.innerHTML='<div class="au-head"><h2>مركز التقارير</h2><p>كل التقارير القابلة للطباعة في المنصة في مكان واحد. اختر التقرير لينتقل بك إلى القسم الذي يُصدره.</p></div>'+
    groups.map(g=>'<h3 class="au-group">'+esc(g.group)+'</h3><div class="au-cards">'+g.items.map(([id,t,n])=>'<button type="button" class="au-card" data-au-go="'+esc(id)+'"><b>'+esc(t)+'</b><span>'+esc(n)+'</span></button>').join('')+'</div>').join('')+
    '<h3 class="au-group">ملخص المنصة</h3><div class="au-cards"><button type="button" class="au-card" data-au-weekly><b>الملخص الأسبوعي للمدير</b><span>صفحة واحدة لكل أسبوع: الرصد والحضور والغياب والإذاعة والإعلانات والعمليات، للطباعة</span></button><button type="button" class="au-card" data-au-summary><b>تقرير ملخص الأقسام</b><span>عدد السجلات والعمليات في كل قسم خلال آخر 30 يومًا، للطباعة</span></button></div>'+'<div id="auWeekly"></div>';
}
function onReportClick(e){
  const b=e.target.closest('button');if(!b||!reports.contains(b))return;
  if(b.dataset.auGo){const t=$(b.dataset.auGo);if(t){t.click();root.scrollTo({top:0,behavior:'smooth'});}return;}
  if(b.hasAttribute('data-au-weekly')){paintWeekly();const w=$('auWeekly');if(w)w.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(b.hasAttribute('data-au-weekly-print')){if(!root.ReportKit||!weeklyRows)return;root.ReportKit.open({title:'الملخص الأسبوعي لمدير المدرسة',subtitle:'أسبوع '+hijriDay(weeklyStart),body:'<table><thead><tr><th>البند</th><th>الأسبوع</th><th>ملاحظة</th></tr></thead><tbody>'+weeklyRows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>').join('')+'</tbody></table><p>ملاحظات المدير:</p><p style="min-height:80px;border:1px solid #999"></p>',signatures:['مدير المدرسة']});return;}
  if(b.hasAttribute('data-au-summary')){
    if(!root.ReportKit)return;const since=Date.now()-30*864e5;
    const rows=SOURCES.map(([c,l])=>{const mine=events.filter(x=>x.col===c&&+x.at>=since);return '<tr><td>'+esc(l)+'</td><td>'+mine.filter(x=>x.created).length+'</td><td>'+mine.filter(x=>!x.created).length+'</td><td>'+new Set(mine.map(x=>x.by)).size+'</td></tr>';}).join('');
    root.ReportKit.open({title:'تقرير ملخص أقسام المنصة',subtitle:'آخر 30 يومًا',body:'<table><thead><tr><th>القسم</th><th>إنشاء</th><th>تعديل</th><th>عدد المستخدمين</th></tr></thead><tbody>'+rows+'</tbody></table><p>سلة المحذوفات: '+bin.length+' عنصرًا.</p>',signatures:['مدير المدرسة']});
  }
}
const style=document.createElement('style');
style.textContent='.au-page{direction:rtl}.au-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.au-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.au-head p{margin:0 0 12px;color:#5b6b66}'+
  '.au-tabs{display:flex;gap:4px;border-bottom:2px solid #dbe8e4}.au-tabs button{font:inherit;border:0;border-bottom:3px solid transparent;border-radius:8px 8px 0 0;background:transparent;padding:9px 16px;font-weight:600;color:#4a5e58;margin-bottom:-2px;cursor:pointer}.au-tabs button[aria-selected=true]{border-bottom-color:#17624d;color:#17624d;background:#eef6f2}'+
  '#auStatus:empty{display:none}#auStatus{font-weight:600;color:#17624d}.au-hint{color:#5b6b66;font-size:14px}.au-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px}.au-bar label{display:grid;gap:4px;font-size:14px}'+
  '.au-page select{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit}.au-page button{font:inherit;padding:7px 12px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer;color:inherit}'+
  '.au-grid{overflow:auto;background:#fff;border:1px solid #dae5df;border-radius:12px}.au-grid table{border-collapse:collapse;width:100%;font-size:14px}.au-grid th,.au-grid td{border-bottom:1px solid #e3ece8;padding:7px;text-align:start;vertical-align:top}.au-grid thead{background:#e8f2ed}'+
  '.au-group{margin:18px 0 8px;color:#123e36}.au-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.au-page .au-card{display:grid;gap:6px;text-align:start;padding:14px 16px;border-radius:14px;border:1px solid #dae5df;background:#fff}.au-card:hover,.au-card:focus-visible{border-color:#17624d;background:#f4faf7}.au-card b{color:#123e36}.au-card span{font-size:13px;color:#5b6b66}';
document.head.append(style);
setInterval(tick,1000);
})(window);
