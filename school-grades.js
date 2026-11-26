/* school-grades.js — grades and homework (الدرجات والواجبات) for the manager and teachers.
   The manager works on every class; a teacher works on the classes and subjects they teach (names-only class lists).
   Each assessment or homework is one gradeBooks record; teachers see only their own records. */
(function(root){'use strict';
if(!root.document)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GRADES=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
const TERMS=['الأول','الثاني','الثالث'];
const HW={done:'أنجز',partial:'جزئي',none:'لم يُنجز'};
const signedIn=()=>!!(root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const managerMode=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&signedIn());
const teacherMode=()=>!root.__FUACC&&/\/teacher\.html$/.test(root.location.pathname)&&signedIn()&&$('account')&&!$('account').hidden;
const fs=()=>firebase.firestore();
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const hijri=d=>{if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d||''))return d||'';try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'numeric',year:'numeric'}).format(new Date(d+'T12:00:00Z'));}catch(e){return d;}};
const classLabel=c=>(GRADES[c.grade]||'')+' '+c.grade+'/'+c.section;
const message=err=>err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية هذا الإجراء.':(err&&err.message)||'تعذّر إكمال العملية.';
const pct=(v,m)=>m>0&&v!==''&&v!=null&&isFinite(v)?Math.round(Number(v)*100/m):null;
let host=null,mode='',actor='',me='',classes=[],cls=null,subject='',tab='grade',books=[],book=null,busy=false;
const status=t=>{const s=$('grStatus');if(s)s.textContent=t;};
function ensure(){
  const want=managerMode()?'manager':teacherMode()?'teacher':'';
  if(!want){if(host)host.hidden=true;const b=$('schoolGradesLink');if(b)b.hidden=true;return null;}
  if(!host||!host.isConnected||mode!==want){
    host&&host.remove();host=document.createElement('section');host.className=(want==='manager'?'school-workspace-section':'card')+' gr-page';host.hidden=true;
    host.id=want==='manager'?'schoolSection-grades':'gradesCenter';host.setAttribute('aria-label','الدرجات والواجبات');
    host.innerHTML='<div class="gr-head"><h2>الدرجات والواجبات</h2><p>رصد درجات التقويم وإنجاز الواجبات لكل فصل ومادة، مع كشوف مطبوعة والأوائل.</p>'+
      '<div class="gr-pick"><label>الفصل<select id="grClass"></select></label><label>المادة<input id="grSubject" list="grSubjects" maxlength="100"><datalist id="grSubjects"></datalist></label></div>'+
      '<div class="gr-tabs" role="tablist"><button type="button" role="tab" data-gr-tab="grade">الدرجات</button><button type="button" role="tab" data-gr-tab="homework">الواجبات</button><button type="button" role="tab" data-gr-tab="top">الأوائل</button></div></div>'+
      '<p id="grStatus" role="status"></p><div id="grBody"></div>';
    if(want==='manager')$('schoolWorkspace').append(host);else $('account').append(host);
    mode=want;
    host.addEventListener('click',onClick);
    $('grClass').onchange=()=>{cls=classes.find(c=>c.id===$('grClass').value)||null;fillSubjects();loadBooks();};
    $('grSubject').onchange=()=>{subject=$('grSubject').value.trim();book=null;paint();};
  }
  if(want==='manager'){
    const links=document.querySelector('.school-sidebar-links');
    if(links&&!$('schoolGradesLink')){const b=document.createElement('button');b.type='button';b.id='schoolGradesLink';b.className='school-home-link';b.dataset.workspaceKey='grades';b.textContent='الدرجات والواجبات';
      const after=$('schoolFormsLink')||$('schoolSupervisionLink')||$('schoolHomeLink');if(after&&after.parentNode===links)after.after(b);else links.prepend(b);}
    const b=$('schoolGradesLink');if(b)b.hidden=false;
  }
  return host;
}
async function tick(){
  const h=ensure();if(!h)return;
  const now=firebase.auth().currentUser.uid+'|'+mode;
  if(now===actor)return;
  actor=now;classes=[];cls=null;books=[];book=null;$('grBody').innerHTML='';status('جارٍ التحميل…');
  try{
    const db=fs();
    if(mode==='manager'){
      me='';
      const [reg,onsite]=await Promise.all([db.doc('config/onsite-classes').get(),db.doc('config/subs-onsite-data').get()]);
      const list=Object.values((reg.data()||{}).classes||{}).filter(c=>c.active!==false).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
      const rosters=await Promise.all(list.map(c=>db.doc('config/onsite-students-'+c.id).get()));
      const lessons=(onsite.data()||{}).lessons||[];
      classes=list.map((c,i)=>({id:c.id,label:classLabel(c),students:((rosters[i].data()||{}).students||[]).map(s=>({id:s.id,name:s.name})),
        lessons:lessons.filter(l=>l.classId===c.id).map(l=>({subject:l.subject,teacher:l.scheduleName||l.teacher}))}));
    }else{
      const prof=await db.doc('teacherProfiles/'+firebase.auth().currentUser.uid).get();
      me=(prof.data()||{}).scheduleName||'';
      if(!me)throw Error('حساب المعلم غير مرتبط بالجدول.');
      const snap=await db.collection('classRosters').where('teachers','array-contains',me).get();
      classes=snap.docs.map(d=>d.data()).map(r=>({id:r.classId,label:r.classLabel,students:r.students||[],lessons:(r.lessons||[]).filter(l=>l.teacher===me).map(l=>({subject:l.subject,teacher:l.teacher}))}))
        .sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    }
    if(now!==actor)return;
    h.hidden=mode==='teacher'&&!classes.length;
    $('grClass').innerHTML=classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.label)+'</option>').join('');
    cls=classes[0]||null;fillSubjects();status(classes.length?'':'لم تُنشر قوائم الفصول بعد.');
    await loadBooks();
  }catch(err){if(now===actor){status(message(err));if(mode==='teacher')h.hidden=true;}}
  if(mode==='manager')h.hidden=false;
}
function fillSubjects(){
  const subs=cls?[...new Set(cls.lessons.map(l=>l.subject).filter(Boolean))]:[];
  $('grSubjects').innerHTML=subs.map(s=>'<option value="'+esc(s)+'"></option>').join('');
  if(!subs.includes(subject))subject=subs[0]||'';
  $('grSubject').value=subject;
}
async function loadBooks(){
  books=[];book=null;paint();if(!cls)return;
  const want=cls.id;
  try{
    const q=mode==='manager'?fs().collection('gradeBooks').where('classId','==',cls.id):fs().collection('gradeBooks').where('teacher','==',me);
    const snap=await q.get();
    if(!cls||cls.id!==want)return;
    books=snap.docs.map(d=>Object.assign({id:d.id},d.data())).filter(b=>b.classId===want).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    paint();
  }catch(err){status(message(err));}
}
const teacherFor=()=>{const l=cls&&cls.lessons.find(x=>x.subject===subject);return mode==='teacher'?me:(l?l.teacher:'');};
function paint(){
  for(const b of host.querySelectorAll('[data-gr-tab]'))b.setAttribute('aria-selected',String(b.dataset.grTab===tab));
  const body=$('grBody');if(!body)return;
  if(!cls){body.innerHTML='';return;}
  if(book){body.innerHTML=editor();return;}
  if(tab==='top'){body.innerHTML=topView();return;}
  const list=books.filter(b=>b.kind===tab&&(!subject||b.subject===subject));
  const rows=list.map(b=>{const vals=Object.values(b.scores||{});let sum='';
    if(b.kind==='grade'){const nums=vals.filter(v=>v!==''&&v!=null&&isFinite(v)).map(Number);sum=nums.length?'المتوسط '+(nums.reduce((a,c)=>a+c,0)/nums.length).toFixed(1)+' من '+b.maxScore:'—';}
    else{const done=vals.filter(v=>v==='done').length;sum=vals.length?'الإنجاز '+Math.round(done*100/vals.length)+'%':'—';}
    return '<tr><td>'+esc(b.title)+'</td><td>'+esc(b.subject)+'</td><td>'+esc(hijri(b.date))+'</td><td>'+esc(sum)+'</td><td><button type="button" data-gr-open="'+esc(b.id)+'">فتح</button></td></tr>';}).join('');
  body.innerHTML='<div class="gr-bar"><button type="button" class="gr-primary" data-gr-new>'+(tab==='grade'?'تقويم جديد':'واجب جديد')+'</button>'+
    (tab==='grade'?'<button type="button" data-gr-sheet>كشف درجات المادة</button><button type="button" data-gr-blank>كشف رصد فارغ</button>':'<button type="button" data-gr-hwsheet>كشف إنجاز الواجبات</button>')+'</div>'+
    (rows?'<div class="gr-grid"><table><thead><tr><th>العنوان</th><th>المادة</th><th>التاريخ</th><th>الملخص</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="gr-hint">لا توجد سجلات لهذا الفصل'+(subject?' في مادة '+esc(subject):'')+' بعد.</p>');
}
function editor(){
  const b=book,isGrade=b.kind==='grade';
  const rows=cls.students.map((s,i)=>{const v=b.scores[s.id];
    return '<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td><td>'+(isGrade?'<input type="number" min="0" max="'+esc(b.maxScore)+'" step="0.25" data-gr-score="'+esc(s.id)+'" value="'+esc(v==null?'':v)+'">':
      Object.entries(HW).map(([k,l])=>'<button type="button" class="gr-hw" data-gr-hw="'+esc(s.id)+'" data-gr-val="'+k+'" aria-pressed="'+(v===k)+'">'+l+'</button>').join(''))+'</td></tr>';}).join('');
  return '<button type="button" class="gr-back" data-gr-back>→ العودة</button><div class="gr-fields">'+
    '<label>العنوان<input id="grTitle" maxlength="120" value="'+esc(b.title)+'" placeholder="'+(isGrade?'مثل: اختبار قصير 1':'مثل: حل تمارين الدرس الأول')+'"></label>'+
    (isGrade?'<label>الدرجة العظمى<input id="grMax" type="number" min="1" max="1000" value="'+esc(b.maxScore)+'"></label>':'')+
    '<label>التاريخ<input id="grDate" type="date" value="'+esc(b.date)+'" max="'+today()+'"></label>'+
    '<label>الفصل الدراسي<select id="grTerm">'+TERMS.map(t=>'<option'+(t===b.term?' selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'+
    '<p class="gr-hint">'+esc(cls.label+' · '+b.subject)+(b.teacher?' · '+esc(b.teacher):'')+'</p>'+
    (isGrade?'':'<div class="gr-bar"><button type="button" data-gr-alldone>الكل أنجز</button></div>')+
    '<div class="gr-grid"><table><thead><tr><th>م</th><th>الطالب</th><th>'+(isGrade?'الدرجة':'الإنجاز')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="gr-bar"><button type="button" class="gr-primary" data-gr-save>حفظ</button></div>';
}
function collect(){
  if(!book)return;
  const t=$('grTitle');if(t)book.title=t.value.trim().slice(0,120);
  const m=$('grMax');if(m)book.maxScore=Math.max(0,Math.min(1000,Number(m.value)||0));
  const d=$('grDate');if(d&&d.value)book.date=d.value;
  const term=$('grTerm');if(term)book.term=term.value;
  for(const i of host.querySelectorAll('[data-gr-score]')){const v=i.value.trim();book.scores[i.dataset.grScore]=v===''?'':Math.max(0,Math.min(book.maxScore,Number(v)));}
}
async function save(){
  if(busy||!book)return;collect();
  if(!subject){status('اكتب اسم المادة.');return;}
  if(!book.title){status('اكتب العنوان.');return;}
  if(book.kind==='grade'&&!(book.maxScore>0)){status('اكتب الدرجة العظمى.');return;}
  busy=true;status('جارٍ الحفظ…');
  const db=fs(),uid=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp();
  const scores={};for(const s of cls.students)if(book.scores[s.id]!==undefined&&book.scores[s.id]!=='')scores[s.id]=book.scores[s.id];
  const data={kind:book.kind,classId:cls.id,classLabel:cls.label.slice(0,80),subject:book.subject.slice(0,100),title:book.title,maxScore:book.kind==='grade'?book.maxScore:0,date:book.date,term:book.term,teacher:book.teacher.slice(0,150),scores,updatedBy:uid,updatedAt:ts};
  try{
    if(!book.id){const ref=await db.collection('gradeBooks').add(Object.assign({},data,{revision:1,createdBy:uid,createdAt:ts}));book.id=ref.id;book.revision=1;}
    else{const ref=db.collection('gradeBooks').doc(book.id),expected=book.revision;
      await db.runTransaction(async tx=>{const prev=await tx.get(ref);if(((prev.data()||{}).revision||0)!==expected)throw Error('تغيّر السجل من جلسة أخرى. أعد فتحه.');tx.update(ref,Object.assign({},data,{revision:expected+1}));});
      book.revision=expected+1;}
    const saved=Object.assign({},book,data,{scores});books=[saved].concat(books.filter(b=>b.id!==book.id));book=null;paint();status('تم الحفظ.');
  }catch(err){status(message(err));}
  finally{busy=false;}
}
function gradeBooksFor(sub){return books.filter(b=>b.kind==='grade'&&(!sub||b.subject===sub)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
function ranking(list){
  return cls.students.map(s=>{let got=0,max=0;for(const b of list){const v=b.scores&&b.scores[s.id];if(v!==undefined&&v!==''&&isFinite(v)){got+=Number(v);max+=Number(b.maxScore)||0;}}return {s,got,max,p:max?got*100/max:null};})
    .filter(r=>r.p!==null).sort((a,b)=>b.p-a.p);
}
function topView(){
  const list=gradeBooksFor(mode==='teacher'?subject:'');
  const rows=ranking(list).slice(0,10).map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.s.name)+'</td><td>'+r.got.toFixed(1)+' / '+r.max+'</td><td>'+r.p.toFixed(1)+'%</td></tr>').join('');
  return '<p class="gr-hint">الترتيب حسب نسبة الدرجات المرصودة '+(mode==='teacher'?'في مادة '+esc(subject):'في جميع المواد')+' لـ '+esc(cls.label)+'.</p>'+
    (rows?'<div class="gr-grid"><table><thead><tr><th>الترتيب</th><th>الطالب</th><th>المجموع</th><th>النسبة</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="gr-bar"><button type="button" data-gr-printtop>طباعة الأوائل</button></div>':'<p class="gr-hint">لا توجد درجات مرصودة بعد.</p>');
}
function report(title,subtitle,body,landscape,signatures){
  if(!root.ReportKit){status('أداة الطباعة غير متاحة.');return;}
  if(!root.ReportKit.open({title,subtitle,body,landscape,signatures}))status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');
}
function printSheet(){
  const list=gradeBooksFor(subject);if(!list.length){status('لا توجد تقويمات في هذه المادة.');return;}
  const total=list.reduce((a,b)=>a+(Number(b.maxScore)||0),0);
  const body='<table><thead><tr><th>م</th><th>الطالب</th>'+list.map(b=>'<th>'+esc(b.title)+'<br><small>('+esc(b.maxScore)+')</small></th>').join('')+'<th>المجموع ('+total+')</th><th>النسبة</th></tr></thead><tbody>'+
    cls.students.map((s,i)=>{let got=0,has=false;const cells=list.map(b=>{const v=b.scores&&b.scores[s.id];if(v!==undefined&&v!==''&&isFinite(v)){got+=Number(v);has=true;return '<td>'+esc(v)+'</td>';}return '<td></td>';}).join('');
      return '<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td>'+cells+'<td>'+(has?got.toFixed(1):'')+'</td><td>'+(has&&total?Math.round(got*100/total)+'%':'')+'</td></tr>';}).join('')+'</tbody></table>';
  report('كشف درجات مادة '+subject,cls.label+(list[0].term?' · الفصل '+list[0].term:''),body,list.length>4,['معلم المادة','وكيل الشؤون التعليمية','مدير المدرسة']);
}
function printBlank(){
  const cols=['مشاركة','واجبات','اختبار قصير 1','اختبار قصير 2','مشروع','المجموع'];
  const body='<table><thead><tr><th>م</th><th>الطالب</th>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+cls.students.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td>'+cols.map(()=>'<td></td>').join('')+'</tr>').join('')+'</tbody></table>';
  report('كشف رصد درجات'+(subject?' — '+subject:''),cls.label,body,true,['معلم المادة']);
}
function printHomework(){
  const list=books.filter(b=>b.kind==='homework'&&(!subject||b.subject===subject)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if(!list.length){status('لا توجد واجبات مسجلة.');return;}
  const body='<table><thead><tr><th>م</th><th>الطالب</th>'+list.map(b=>'<th>'+esc(b.title)+'<br><small>'+esc(hijri(b.date))+'</small></th>').join('')+'<th>نسبة الإنجاز</th></tr></thead><tbody>'+
    cls.students.map((s,i)=>{let done=0,n=0;const cells=list.map(b=>{const v=b.scores&&b.scores[s.id];if(v){n++;if(v==='done')done++;}return '<td>'+esc(HW[v]||'')+'</td>';}).join('');return '<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td>'+cells+'<td>'+(n?Math.round(done*100/n)+'%':'')+'</td></tr>';}).join('')+'</tbody></table>';
  report('كشف إنجاز الواجبات'+(subject?' — '+subject:''),cls.label,body,list.length>4,['معلم المادة']);
}
function printTop(){
  const rows=ranking(gradeBooksFor(mode==='teacher'?subject:'')).slice(0,10);
  const body='<table><thead><tr><th>الترتيب</th><th>الطالب</th><th>النسبة</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.s.name)+'</td><td>'+r.p.toFixed(1)+'%</td></tr>').join('')+'</tbody></table>';
  report('الأوائل',cls.label+(mode==='teacher'?' · '+subject:''),body,false,['وكيل الشؤون التعليمية','مدير المدرسة']);
}
function onClick(e){
  const b=e.target.closest('button');if(!b||!host.contains(b))return;const d=b.dataset;
  if(d.grTab){tab=d.grTab;book=null;paint();status('');return;}
  if(b.hasAttribute('data-gr-new')){if(!subject){status('اختر المادة أولًا.');return;}book={id:'',revision:0,kind:tab,subject,title:'',maxScore:tab==='grade'?10:0,date:today(),term:TERMS[0],teacher:teacherFor(),scores:{}};paint();return;}
  if(d.grOpen){const x=books.find(r=>r.id===d.grOpen);if(x){book=Object.assign({},x,{scores:Object.assign({},x.scores||{})});paint();}return;}
  if(b.hasAttribute('data-gr-back')){book=null;paint();return;}
  if(d.grHw){collect();book.scores[d.grHw]=book.scores[d.grHw]===d.grVal?'':d.grVal;paint();return;}
  if(b.hasAttribute('data-gr-alldone')){collect();for(const s of cls.students)book.scores[s.id]='done';paint();return;}
  if(b.hasAttribute('data-gr-save')){save();return;}
  if(b.hasAttribute('data-gr-sheet')){printSheet();return;}
  if(b.hasAttribute('data-gr-blank')){printBlank();return;}
  if(b.hasAttribute('data-gr-hwsheet')){printHomework();return;}
  if(b.hasAttribute('data-gr-printtop'))printTop();
}
const style=document.createElement('style');
style.textContent='.gr-page{direction:rtl}.gr-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.gr-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.gr-head p{margin:0 0 12px;color:#5b6b66}'+
  '.gr-pick,.gr-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px}.gr-pick label,.gr-fields label{display:grid;gap:4px;font-size:14px}'+
  '.gr-page input,.gr-page select{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit}.gr-grid input{width:90px}'+
  '.gr-tabs{display:flex;gap:4px;border-bottom:2px solid #dbe8e4}.gr-tabs button{font:inherit;border:0;border-bottom:3px solid transparent;border-radius:8px 8px 0 0;background:transparent;padding:9px 16px;font-weight:600;color:#4a5e58;margin-bottom:-2px;cursor:pointer}.gr-tabs button[aria-selected=true]{border-bottom-color:#17624d;color:#17624d;background:#eef6f2}'+
  '#grStatus:empty{display:none}#grStatus{font-weight:600;color:#17624d}.gr-hint{color:#5b6b66}.gr-bar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}'+
  '.gr-page button{font:inherit;padding:7px 12px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer;color:inherit}.gr-page .gr-primary{background:#17624d;color:#fff;border-color:#17624d}.gr-back{margin-bottom:8px}'+
  '.gr-grid{overflow:auto;background:#fff;border:1px solid #dae5df;border-radius:12px}.gr-grid table{border-collapse:collapse;width:100%;font-size:14px}.gr-grid th,.gr-grid td{border-bottom:1px solid #e3ece8;padding:7px;text-align:start}.gr-grid thead{background:#e8f2ed}'+
  '.gr-page .gr-hw{min-height:38px;margin-inline-end:4px}.gr-page .gr-hw[aria-pressed=true][data-gr-val=done]{background:#e8f5e9;border-color:#17633a;color:#17633a;font-weight:700}.gr-page .gr-hw[aria-pressed=true][data-gr-val=partial]{background:#fff4dc;border-color:#9a6200;color:#7a4d00;font-weight:700}.gr-page .gr-hw[aria-pressed=true][data-gr-val=none]{background:#faebea;border-color:#9f2727;color:#9f2727;font-weight:700}';
document.head.append(style);
setInterval(tick,1000);
})(window);
