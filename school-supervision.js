/* school-supervision.js — classroom visits and remedial plans.
   The manager records; the manager and report viewers read. Records never change after saving:
   a visit is final, and a plan's progress is added as follow-up entries. */
(function(root){'use strict';
if(!root.document||root.TeacherPortal||root.EmployeePortal)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GRADES=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
const CRITERIA=[['c1','التخطيط للدرس والتهيئة'],['c2','إدارة الصف وتنظيم بيئة التعلم'],['c3','استراتيجيات التدريس وتنويعها'],['c4','توظيف التقنية ومصادر التعلم'],['c5','التقويم والتغذية الراجعة'],['c6','تفاعل الطلاب ومشاركتهم']];
const SCALE=['','يحتاج إلى دعم','مقبول','جيد','متميز'];
const VISIT_TYPES={principal:'زيارة مدير المدرسة',supervisor:'زيارة مشرف تربوي',peer:'زيارة تبادلية'};
const REASONS={absence:'غياب متكرر',achievement:'ضعف في التحصيل',behavior:'ملاحظات سلوكية'};
const STATES={open:'مفتوحة',progress:'قيد المتابعة',done:'مكتملة'};
const role=()=>root.__FUACC&&root.__FUACC.state?root.__FUACC.state.role:null;
const signedIn=()=>!!(root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const canRead=()=>signedIn()&&(role()===-1||role()===8);
const canWrite=()=>signedIn()&&role()===-1;
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const day=v=>v&&v.toDate?v.toDate().toISOString().slice(0,10):'';
const display=n=>(root.StaffSettings&&root.StaffSettings.displayName&&root.StaffSettings.displayName(n))||n;
const classLabel=c=>(GRADES[c.grade]||'')+' '+c.grade+'/'+c.section;
const options=(list,selected)=>list.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+esc(t)+'</option>').join('');
const average=s=>{const v=CRITERIA.map(([k])=>Number(s&&s[k])||0).filter(Boolean);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;};
const planState=p=>p.updates.length?p.updates[p.updates.length-1].status:'open';
const planDue=p=>planState(p)!=='done'&&!!p.reviewDate&&p.reviewDate<=today();
let host=null,data=null,loading=null,tab='visits',busy=false,actor='',visitFilter='';
const status=t=>{const s=$('svStatus');if(s)s.textContent=t;};
const message=err=>err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية هذا الإجراء.':(err&&err.message)||'تعذّر إكمال العملية.';
function ensure(){
  const ws=$('schoolWorkspace');if(!ws)return null;
  if(!host||!host.isConnected){
    host=document.createElement('section');host.id='schoolSection-supervision';host.className='school-workspace-section sv-page';host.hidden=true;
    host.setAttribute('aria-label','الزيارات الصفية والخطط العلاجية');
    host.innerHTML='<div class="sv-head"><h2>الزيارات الصفية والخطط العلاجية</h2><p>توثيق زيارات المعلمين ومتابعة خطط دعم الطلاب. لا تُعدَّل السجلات بعد حفظها، وتُضاف متابعات الخطة كسجلات جديدة.</p>'+
      '<div class="sv-tabs" role="tablist"><button type="button" role="tab" data-sv-tab="visits">الزيارات الصفية</button><button type="button" role="tab" data-sv-tab="plans">الخطط العلاجية</button></div></div>'+
      '<p id="svStatus" role="status"></p><div id="svBody"></div>';
    ws.append(host);
    host.addEventListener('click',onClick);host.addEventListener('submit',onSubmit);host.addEventListener('change',onChange);
  }
  const links=document.querySelector('.school-sidebar-links');
  if(links&&!$('schoolSupervisionLink')){
    const b=document.createElement('button');b.type='button';b.id='schoolSupervisionLink';b.className='school-home-link';b.dataset.workspaceKey='supervision';b.textContent='الزيارات والخطط العلاجية';b.hidden=true;
    const after=$('schoolProfilesLink')||$('schoolHomeLink');if(after&&after.parentNode===links)after.after(b);else links.prepend(b);
    b.addEventListener('click',prime);
  }
  return host;
}
function tick(){
  const h=ensure();if(!h)return;
  const show=canRead(),b=$('schoolSupervisionLink');
  if(b&&b.hidden===show)b.hidden=!show;
  if(h.hidden===show)h.hidden=!show;
  const now=signedIn()?firebase.auth().currentUser.uid+'|'+role():'';
  if(now!==actor){actor=now;data=null;const body=$('svBody');if(body)body.innerHTML='';status('');}
  if(show&&!data&&h.offsetParent!==null)prime();
}
function prime(){if(!data&&!loading&&canRead())loading=load().finally(()=>{loading=null;});}
async function load(){
  const db=firebase.firestore(),who=actor;
  status('جارٍ تحميل الزيارات والخطط…');
  try{
    const reads=[db.collection('classVisits').get(),db.collection('remedialPlans').get()];
    if(canWrite())reads.push(db.doc('config/onsite-classes').get(),db.doc('config/subs-onsite-data').get());
    const [visits,plans,reg,onsite]=await Promise.all(reads);
    let classes=[],students=[],lessons=[];
    if(reg){
      classes=Object.values((reg.data()||{}).classes||{}).filter(c=>c.active!==false).map(c=>({id:c.id,grade:Number(c.grade),section:Number(c.section)}))
        .sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
      classes.forEach(c=>{c.label=classLabel(c);});
      const rosters=await Promise.all(classes.map(c=>db.doc('config/onsite-students-'+c.id).get()));
      classes.forEach((c,i)=>{for(const s of (rosters[i].data()||{}).students||[])students.push({id:s.id,name:String(s.name||''),classId:c.id});});
      lessons=((onsite&&onsite.data())||{}).lessons||[];
    }
    const planList=plans.docs.map(d=>Object.assign({id:d.id},d.data()));
    const updates=await Promise.all(planList.map(p=>db.collection('remedialPlans').doc(p.id).collection('updates').get()));
    planList.forEach((p,i)=>{p.updates=updates[i].docs.map(d=>d.data()).sort((a,b)=>day(a.createdAt).localeCompare(day(b.createdAt)));});
    if(who!==actor)return;
    const names=lessons.map(l=>l.scheduleName||l.teacher).concat(((root.__FUACC&&root.__FUACC.S)||[]).map(r=>r.teacher)).filter(Boolean);
    data={classes,students,lessons,byClass:new Map(classes.map(c=>[c.id,c])),
      teachers:[...new Set(names)].sort((a,b)=>display(a).localeCompare(display(b),'ar')),
      visits:visits.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>String(b.date).localeCompare(String(a.date))),
      plans:planList.sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)))};
    status('');paint();
  }catch(err){if(who===actor)status(message(err));}
}
function paint(){
  for(const b of host.querySelectorAll('[data-sv-tab]'))b.setAttribute('aria-selected',String(b.dataset.svTab===tab));
  if(data)$('svBody').innerHTML=tab==='visits'?visitsView():plansView();
}
function visitList(){
  const list=data.visits.filter(v=>!visitFilter||v.teacher===visitFilter);
  const visited=[...new Set(data.visits.map(v=>v.teacher))].sort((a,b)=>display(a).localeCompare(display(b),'ar'));
  const rows=list.map(v=>'<tr><td>'+esc(v.date)+'</td><td>'+esc(display(v.teacher))+'</td><td>'+esc(v.classLabel)+'</td><td>'+esc(v.subject)+'</td><td>'+esc(VISIT_TYPES[v.visitType]||v.visitType)+'</td><td>'+average(v.scores).toFixed(1)+' / 4</td><td><button type="button" data-sv-print-visit="'+esc(v.id)+'">طباعة</button></td></tr>').join('');
  return '<div class="sv-bar"><h3>سجل الزيارات <small>'+list.length+'</small></h3><label>تصفية حسب المعلم<select id="svVisitFilter"><option value="">كل المعلمين</option>'+options(visited.map(t=>[t,display(t)]),visitFilter)+'</select></label></div>'+
    (data.teachers.length?'<p class="sv-hint">تمت زيارة '+visited.length+' من '+data.teachers.length+' معلمًا.</p>':'')+
    (rows?'<div class="sv-grid"><table><thead><tr><th>التاريخ</th><th>المعلم</th><th>الفصل</th><th>المادة</th><th>النوع</th><th>المتوسط</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="sv-hint">لا توجد زيارات مسجّلة.</p>');
}
function visitsView(){
  const form=canWrite()?'<details class="sv-box" open><summary>تسجيل زيارة صفية جديدة</summary><form id="svVisitForm" class="sv-form">'+
    '<label>المعلم<select name="teacher" required><option value="">اختر المعلم</option>'+options(data.teachers.map(t=>[t,display(t)]))+'</select></label>'+
    '<label>الفصل<select name="classId" required><option value="">اختر الفصل</option>'+options(data.classes.map(c=>[c.id,c.label]))+'</select></label>'+
    '<label>المادة<input name="subject" required maxlength="100"></label>'+
    '<label>تاريخ الزيارة<input type="date" name="date" required value="'+today()+'" max="'+today()+'"></label>'+
    '<label>نوع الزيارة<select name="visitType">'+options(Object.entries(VISIT_TYPES))+'</select></label>'+
    '<label>الزائر<input name="visitor" required maxlength="150" value="مدير المدرسة"></label>'+
    '<fieldset class="sv-scores sv-wide"><legend>معايير الأداء (1 يحتاج إلى دعم · 4 متميز)</legend>'+CRITERIA.map(([k,t])=>'<label>'+esc(t)+'<select name="'+k+'">'+options([4,3,2,1].map(n=>[n,n+' · '+SCALE[n]]),3)+'</select></label>').join('')+'</fieldset>'+
    '<label class="sv-wide">نقاط القوة<textarea name="strengths" maxlength="600" rows="2"></textarea></label>'+
    '<label class="sv-wide">فرص التحسين<textarea name="improvements" maxlength="600" rows="2"></textarea></label>'+
    '<label class="sv-wide">التوصيات<textarea name="recommendations" maxlength="600" rows="2"></textarea></label>'+
    '<div class="sv-wide"><button type="submit" class="sv-primary">حفظ الزيارة</button></div></form></details>':'';
  return form+'<div id="svVisitList">'+visitList()+'</div>';
}
function plansView(){
  const form=canWrite()?'<details class="sv-box" open><summary>خطة علاجية جديدة</summary><form id="svPlanForm" class="sv-form">'+
    '<label>الفصل<select name="classId" required><option value="">اختر الفصل</option>'+options(data.classes.map(c=>[c.id,c.label]))+'</select></label>'+
    '<label>الطالب<select name="studentId" required><option value="">اختر الفصل أولًا</option></select></label>'+
    '<label>سبب الخطة<select name="reason">'+options(Object.entries(REASONS))+'</select></label>'+
    '<label>المسؤول عن المتابعة<input name="owner" required maxlength="150" placeholder="مثل: الموجه الطلابي"></label>'+
    '<label>تاريخ البدء<input type="date" name="startDate" required value="'+today()+'"></label>'+
    '<label>تاريخ المراجعة<input type="date" name="reviewDate" required></label>'+
    '<label class="sv-wide">الأهداف<textarea name="goals" required maxlength="600" rows="2"></textarea></label>'+
    '<label class="sv-wide">الإجراءات والأنشطة<textarea name="actions" required maxlength="600" rows="2"></textarea></label>'+
    '<div class="sv-wide"><button type="submit" class="sv-primary">حفظ الخطة</button></div></form></details>':'';
  const cards=data.plans.map(p=>{const st=planState(p),due=planDue(p);return '<article class="sv-plan'+(due?' sv-due':'')+'"><header><b>'+esc(p.studentName)+'</b><span>'+esc(p.classLabel+' · '+(REASONS[p.reason]||p.reason))+'</span><span class="sv-state sv-'+esc(st)+'">'+esc(STATES[st]||st)+'</span></header>'+
    '<p><b>الأهداف:</b> '+esc(p.goals)+'</p><p><b>الإجراءات:</b> '+esc(p.actions)+'</p>'+
    '<p class="sv-hint">المسؤول: '+esc(p.owner)+' · البدء '+esc(p.startDate)+' · المراجعة '+esc(p.reviewDate)+(due?' · <b class="sv-alert">حان موعد المراجعة</b>':'')+'</p>'+
    (p.updates.length?'<ul class="sv-ul">'+p.updates.map(u=>'<li>'+esc(day(u.createdAt)+' · '+(STATES[u.status]||u.status)+' — '+u.note)+'</li>').join('')+'</ul>':'')+
    '<div class="sv-actions">'+(canWrite()&&st!=='done'?'<button type="button" data-sv-follow="'+esc(p.id)+'">إضافة متابعة</button>':'')+'<button type="button" data-sv-print-plan="'+esc(p.id)+'">طباعة</button></div></article>';}).join('');
  const open=data.plans.filter(p=>planState(p)!=='done').length,due=data.plans.filter(planDue).length;
  return form+'<div class="sv-bar"><h3>الخطط <small>'+data.plans.length+' · مفتوحة '+open+(due?' · تحتاج مراجعة '+due:'')+'</small></h3></div>'+(cards||'<p class="sv-hint">لا توجد خطط علاجية.</p>');
}
function onChange(e){
  const t=e.target;if(!data)return;
  if(t.id==='svVisitFilter'){visitFilter=t.value;$('svVisitList').innerHTML=visitList();return;}
  const f=t.form;if(!f)return;
  if(f.id==='svVisitForm'&&(t.name==='teacher'||t.name==='classId')){
    const l=data.lessons.find(x=>(x.scheduleName||x.teacher)===f.elements.teacher.value&&x.classId===f.elements.classId.value);
    if(l&&!f.elements.subject.value)f.elements.subject.value=l.subject||'';
  }
  if(f.id==='svPlanForm'&&t.name==='classId')f.elements.studentId.innerHTML='<option value="">اختر الطالب</option>'+options(data.students.filter(s=>s.classId===t.value).sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(s=>[s.id,s.name]));
}
function onClick(e){
  const b=e.target.closest('button');if(!b||!host.contains(b))return;
  if(b.dataset.svTab){tab=b.dataset.svTab;paint();return;}
  if(!data)return;
  if(b.dataset.svPrintVisit){printVisit(data.visits.find(v=>v.id===b.dataset.svPrintVisit));return;}
  if(b.dataset.svPrintPlan){printPlan(data.plans.find(p=>p.id===b.dataset.svPrintPlan));return;}
  if(b.dataset.svFollow){followForm(b);return;}
  if(b.hasAttribute('data-sv-cancel'))b.closest('form').remove();
}
function followForm(b){
  const card=b.closest('.sv-plan');if(!canWrite()||card.querySelector('.sv-follow'))return;
  const f=document.createElement('form');f.className='sv-follow sv-form';f.dataset.plan=b.dataset.svFollow;
  f.innerHTML='<label>الحالة<select name="status">'+options([['progress',STATES.progress],['done',STATES.done]])+'</select></label>'+
    '<label class="sv-wide">ملاحظة المتابعة<textarea name="note" required maxlength="600" rows="2"></textarea></label>'+
    '<div class="sv-wide"><button type="submit" class="sv-primary">حفظ المتابعة</button> <button type="button" data-sv-cancel>إلغاء</button></div>';
  card.append(f);f.elements.note.focus();
}
async function onSubmit(e){
  const f=e.target;if(!f.matches('#svVisitForm,#svPlanForm,.sv-follow'))return;
  e.preventDefault();if(busy||!canWrite()||!data)return;
  const db=firebase.firestore(),me=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp(),el=f.elements,val=n=>String(el[n].value||'').trim();
  const controls=[...f.querySelectorAll('button,input,select,textarea')];
  busy=true;controls.forEach(c=>{c.disabled=true;});
  try{
    if(f.id==='svVisitForm'){
      const c=data.byClass.get(val('classId'));
      if(!c||!val('teacher'))throw Error('اختر المعلم والفصل.');
      if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(val('date'))||val('date')>today())throw Error('اختر تاريخ زيارة صحيحًا.');
      const scores={};for(const [k] of CRITERIA)scores[k]=Number(val(k));
      const v={teacher:val('teacher').slice(0,150),classId:c.id,classLabel:c.label,subject:val('subject').slice(0,100),date:val('date'),visitType:val('visitType'),visitor:val('visitor').slice(0,150),
        scores,strengths:val('strengths').slice(0,600),improvements:val('improvements').slice(0,600),recommendations:val('recommendations').slice(0,600),createdBy:me,createdAt:ts};
      const ref=await db.collection('classVisits').add(v);
      data.visits.unshift(Object.assign({},v,{id:ref.id}));data.visits.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      paint();status('تم حفظ الزيارة الصفية.');
    }else if(f.id==='svPlanForm'){
      const c=data.byClass.get(val('classId')),s=data.students.find(x=>x.id===val('studentId'));
      if(!c||!s)throw Error('اختر الفصل والطالب.');
      if(!val('reviewDate')||val('reviewDate')<val('startDate'))throw Error('تاريخ المراجعة يجب أن يكون بعد تاريخ البدء.');
      const p={studentId:s.id,studentName:s.name.slice(0,150),classId:c.id,classLabel:c.label,reason:val('reason'),goals:val('goals').slice(0,600),actions:val('actions').slice(0,600),
        owner:val('owner').slice(0,150),startDate:val('startDate'),reviewDate:val('reviewDate'),createdBy:me,createdAt:ts};
      const ref=await db.collection('remedialPlans').add(p);
      data.plans.unshift(Object.assign({},p,{id:ref.id,updates:[]}));
      paint();status('تم حفظ الخطة العلاجية.');
    }else{
      const plan=data.plans.find(p=>p.id===f.dataset.plan);if(!plan)throw Error('الخطة غير موجودة.');
      const u={note:val('note').slice(0,600),status:val('status'),createdBy:me,createdAt:ts};
      if(!u.note)throw Error('اكتب ملاحظة المتابعة.');
      await db.collection('remedialPlans').doc(plan.id).collection('updates').add(u);
      plan.updates.push(Object.assign({},u,{createdAt:{toDate:()=>new Date()}}));
      paint();status('تمت إضافة المتابعة.');
    }
  }catch(err){status(message(err));controls.forEach(c=>{c.disabled=false;});}
  finally{busy=false;}
}
function report(title,subtitle,body,signatures){
  if(!root.ReportKit){status('أداة الطباعة غير متاحة.');return;}
  if(!root.ReportKit.open({title,subtitle,body,signatures}))status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');
}
const facts=list=>'<table><tbody>'+list.map(([a,b])=>'<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('')+'</tbody></table>';
function printVisit(v){
  if(!v)return;
  const body=facts([['المعلم',display(v.teacher)],['الفصل',v.classLabel],['المادة',v.subject],['تاريخ الزيارة',v.date],['نوع الزيارة',VISIT_TYPES[v.visitType]||v.visitType],['الزائر',v.visitor]])+
    '<h3>معايير الأداء</h3><table><thead><tr><th>المعيار</th><th>الدرجة</th><th>التقدير</th></tr></thead><tbody>'+
    CRITERIA.map(([k,t])=>'<tr><td>'+esc(t)+'</td><td>'+esc(v.scores&&v.scores[k])+' / 4</td><td>'+esc(SCALE[v.scores&&v.scores[k]]||'')+'</td></tr>').join('')+
    '<tr><th>المتوسط</th><th>'+average(v.scores).toFixed(1)+' / 4</th><th></th></tr></tbody></table>'+
    [['نقاط القوة',v.strengths],['فرص التحسين',v.improvements],['التوصيات',v.recommendations]].map(([a,b])=>'<h3>'+esc(a)+'</h3><p>'+esc(b||'—')+'</p>').join('');
  report('نموذج زيارة صفية',display(v.teacher)+' · '+v.date,body,['المعلم','الزائر','مدير المدرسة']);
}
function printPlan(p){
  if(!p)return;
  const body=facts([['الطالب',p.studentName],['الفصل',p.classLabel],['سبب الخطة',REASONS[p.reason]||p.reason],['المسؤول عن المتابعة',p.owner],['تاريخ البدء',p.startDate],['تاريخ المراجعة',p.reviewDate],['الحالة',STATES[planState(p)]||planState(p)]])+
    '<h3>الأهداف</h3><p>'+esc(p.goals)+'</p><h3>الإجراءات والأنشطة</h3><p>'+esc(p.actions)+'</p>'+
    '<h3>سجل المتابعة</h3>'+(p.updates.length?'<table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الملاحظة</th></tr></thead><tbody>'+p.updates.map(u=>'<tr><td>'+esc(day(u.createdAt))+'</td><td>'+esc(STATES[u.status]||u.status)+'</td><td>'+esc(u.note)+'</td></tr>').join('')+'</tbody></table>':'<p>لا توجد متابعات بعد.</p>');
  report('خطة علاجية',p.studentName+' · '+p.classLabel,body,['المسؤول عن المتابعة','ولي أمر الطالب','مدير المدرسة']);
}
const style=document.createElement('style');
style.textContent='.sv-page{direction:rtl}.sv-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.sv-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.sv-head p{margin:0 0 12px;color:#5b6b66}'+
  '.sv-tabs{display:flex;gap:4px;border-bottom:2px solid #dbe8e4}.sv-tabs button{font:inherit;border:0;border-bottom:3px solid transparent;border-radius:8px 8px 0 0;background:transparent;padding:9px 16px;font-weight:600;color:#4a5e58;margin-bottom:-2px;cursor:pointer}.sv-tabs button[aria-selected=true]{border-bottom-color:#17624d;color:#17624d;background:#eef6f2}'+
  '#svStatus:empty{display:none}#svStatus{font-weight:600;color:#17624d}.sv-hint{color:#5b6b66}.sv-alert{color:#9f2727}'+
  '.sv-box{background:#fff;border:1px solid #dae5df;border-radius:16px;padding:14px 18px;margin-bottom:14px}.sv-box summary{cursor:pointer;font-weight:700;color:#123e36}'+
  '.sv-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}.sv-form label{display:grid;gap:4px;font-size:14px}.sv-wide{grid-column:1/-1}'+
  '.sv-form input,.sv-form select,.sv-form textarea,.sv-bar select{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit;width:100%;box-sizing:border-box}'+
  '.sv-scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;border:1px solid #dae5df;border-radius:12px;padding:10px 12px;margin:0}.sv-scores legend{font-weight:600;padding:0 6px}'+
  '.sv-page button{font:inherit;padding:7px 12px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer}.sv-page .sv-primary{background:#17624d;color:#fff;border-color:#17624d}.sv-page button:disabled{opacity:.55}'+
  '.sv-bar{display:flex;justify-content:space-between;align-items:end;gap:10px;flex-wrap:wrap;margin:14px 0 6px}.sv-bar h3{margin:0;color:#123e36}.sv-bar h3 small{color:#5b6b66;font-weight:400;font-size:13px}.sv-bar label{display:grid;gap:4px;font-size:13px;min-width:220px}'+
  '.sv-grid{overflow:auto;background:#fff;border:1px solid #dae5df;border-radius:12px}.sv-grid table{border-collapse:collapse;width:100%;font-size:14px}.sv-grid th,.sv-grid td{border-bottom:1px solid #e3ece8;padding:8px;text-align:start}.sv-grid thead{background:#e8f2ed}'+
  '.sv-plan{background:#fff;border:1px solid #dae5df;border-radius:14px;padding:14px 16px;margin-bottom:10px}.sv-plan.sv-due{border-color:#e0b4b4}.sv-plan header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sv-plan header span{color:#5b6b66}.sv-plan p{margin:6px 0}'+
  '.sv-state{margin-inline-start:auto;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#eef2f1}.sv-state.sv-open{background:#fff4dc;color:#7a4d00}.sv-state.sv-progress{background:#e6f0ff;color:#1d4f91}.sv-state.sv-done{background:#e8f5e9;color:#17633a}'+
  '.sv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.sv-ul{margin:6px 0;padding-inline-start:20px;line-height:1.8}.sv-follow{border-top:1px dashed #a5c5ba;padding-top:10px}';
document.head.append(style);
if(root.SchoolTick)root.SchoolTick.add(tick);else setInterval(tick,1000);tick();
})(window);
