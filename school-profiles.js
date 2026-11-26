/* school-profiles.js — unified search and linked profiles for students, classes and teachers (manager only).
   Reads class rosters, the onsite and remote timetables, this month's student attendance and absence actions. It writes nothing. */
(function(root){'use strict';
if(!root.document||root.TeacherPortal||root.EmployeePortal)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v==null?'':v).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim().replace(/\s+/g,' ').toLowerCase();
const GRADES=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const GROUPS={c1:'الأول الثانوي',c2:'الثاني الثانوي',c3:'الثالث الثانوي',ba:'إدارة الأعمال',cs:'الحاسب والهندسة'};
const ACTIONS={call:'اتصال بولي الأمر',pledge:'تعهد من الطالب',summon:'استدعاء ولي الأمر',referral:'إحالة إلى لجنة التوجيه',note:'ملاحظة متابعة'};
const isManager=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const classLabel=c=>(GRADES[c.grade]||'')+' '+c.grade+'/'+c.section;
const masked=v=>{const s=String(v||'');return s.length>4?'••••••'+s.slice(-4):s;};
const waLink=p=>{const d=String(p||'').replace(/[^0-9]/g,'');const n=/^05[0-9]{8}$/.test(d)?'966'+d.slice(1):d;return /^9665[0-9]{8}$/.test(n)?'https://wa.me/'+n:'';};
const display=n=>(root.StaffSettings&&root.StaffSettings.displayName&&root.StaffSettings.displayName(n))||n;
const groupOf=c=>c.grade===3?(c.section===10?'ba':c.section===9?'cs':'c3'):'c'+c.grade;
const item=(type,id,title,sub)=>'<button type="button" class="sp-item" data-sp="'+type+'" data-id="'+esc(id)+'"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></button>';
const link=(type,id,text)=>'<button type="button" class="sp-link" data-sp="'+type+'" data-id="'+esc(id)+'">'+esc(text)+'</button>';
const kpi=(n,label,tone)=>'<div class="sp-kpi '+(tone||'')+'"><b>'+esc(n)+'</b><span>'+esc(label)+'</span></div>';
const back='<button type="button" class="sp-back" data-sp="back">→ العودة إلى نتائج البحث</button>';
const rate=(p,a)=>p+a?Math.round(p*100/(p+a))+'%':'—';
let host=null,data=null,loading=null,month=null,seq=0,timer=null;
const status=t=>{const s=$('spStatus');if(s)s.textContent=t;};
function ensure(){
  const ws=$('schoolWorkspace');if(!ws)return null;
  if(!host||!host.isConnected){
    host=document.createElement('section');host.id='schoolSection-profiles';host.className='school-workspace-section sp-page';host.hidden=true;
    host.setAttribute('aria-label','البحث والملفات');
    host.innerHTML='<div class="sp-head"><h2>البحث والملفات</h2><p>ابحث عن طالب أو فصل أو معلم، وانتقل بين ملفاتهم المترابطة.</p>'+
      '<input type="search" id="spQuery" placeholder="اكتب اسم طالب أو معلم أو فصل (مثل 2/3)" autocomplete="off" aria-label="بحث موحّد"></div>'+
      '<p id="spStatus" role="status"></p><div id="spResults" aria-live="polite"></div><div id="spProfile"></div>';
    ws.append(host);
    $('spQuery').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,200);});
    host.addEventListener('click',onClick);
  }
  const links=document.querySelector('.school-sidebar-links');
  if(links&&!$('schoolProfilesLink')){
    const b=document.createElement('button');b.type='button';b.id='schoolProfilesLink';b.className='school-home-link';b.dataset.workspaceKey='profiles';b.textContent='البحث والملفات';b.hidden=true;
    const home=$('schoolHomeLink');if(home&&home.parentNode===links)home.after(b);else links.prepend(b);
    b.addEventListener('click',()=>{prime();setTimeout(()=>{const q=$('spQuery');if(q)q.focus();},60);});
  }
  return host;
}
function reset(){data=null;month=null;seq++;const r=$('spResults'),p=$('spProfile');if(r){r.innerHTML='';r.hidden=false;}if(p)p.innerHTML='';}
function tick(){
  const h=ensure();if(!h)return;
  const show=isManager(),b=$('schoolProfilesLink');
  if(b&&b.hidden===show)b.hidden=!show;
  if(h.hidden===show)h.hidden=!show;
  if(!show){if(data)reset();return;}
  if(data&&data.uid!==firebase.auth().currentUser.uid)reset();
  if(!data&&h.offsetParent!==null)prime();
}
function prime(){if(!data&&!loading&&isManager())loading=load().finally(()=>{loading=null;});}
async function load(){
  const db=firebase.firestore(),uid=firebase.auth().currentUser.uid;
  status('جارٍ تحميل بيانات الطلاب والفصول والمعلمين…');
  try{
    const [reg,onsite]=await Promise.all([db.doc('config/onsite-classes').get(),db.doc('config/subs-onsite-data').get()]);
    const classes=Object.values((reg.data()||{}).classes||{}).filter(c=>c.active!==false).map(c=>({id:c.id,grade:Number(c.grade),section:Number(c.section)}))
      .sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    const rosters=await Promise.all(classes.map(c=>db.doc('config/onsite-students-'+c.id).get()));
    const students=[];
    classes.forEach((c,i)=>{
      const list=(rosters[i].data()||{}).students||[];
      c.label=classLabel(c);c.count=list.length;
      for(const s of list)students.push({id:s.id,name:String(s.name||''),civilId:s.civilId||'',guardianPhone:s.guardianPhone||'',classId:c.id});
    });
    const teachers=new Map();
    const teacher=name=>{const key=norm(name);if(!teachers.has(key))teachers.set(key,{key,name:String(name),onsite:[],remote:[]});return teachers.get(key);};
    for(const l of (onsite.data()||{}).lessons||[]){const name=l.scheduleName||l.teacher;if(name)teacher(name).onsite.push({classId:l.classId,day:Number(l.day),period:Number(l.period),subject:String(l.subject||'')});}
    for(const r of (root.__FUACC&&root.__FUACC.S)||[])if(r.teacher)teacher(r.teacher).remote.push({cls:r.cls,day:r.day,slot:r.slot,subject:String(r.subj||'')});
    if(!isManager()||firebase.auth().currentUser.uid!==uid)return;
    data={uid,classes,students,teachers,byClass:new Map(classes.map(c=>[c.id,c]))};
    status('');search();
  }catch(err){status(err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية عرض الملفات.':'تعذّر تحميل البيانات. حدّث الصفحة وحاول مجددًا.');}
}
const subjectsOf=t=>[...new Set(t.onsite.concat(t.remote).map(x=>x.subject).filter(Boolean))];
function classTeachers(c){
  const out=[];
  for(const t of data.teachers.values()){
    const subs=new Set(t.onsite.filter(l=>l.classId===c.id).map(l=>l.subject).concat(t.remote.filter(r=>r.cls===groupOf(c)).map(r=>r.subject)).filter(Boolean));
    if(subs.size)out.push({key:t.key,name:t.name,subjects:[...subs]});
  }
  return out.sort((a,b)=>display(a.name).localeCompare(display(b.name),'ar'));
}
function search(){
  const out=$('spResults');if(!data||!out)return;
  out.hidden=false;$('spProfile').innerHTML='';
  const q=norm($('spQuery').value);
  if(q.length<2){out.innerHTML='<p class="sp-hint">'+data.students.length+' طالبًا في '+data.classes.length+' فصلًا · '+data.teachers.size+' معلمًا. اكتب حرفين على الأقل للبحث.</p><section class="sp-group"><h3>الفصول</h3><div class="sp-list">'+data.classes.map(c=>item('class',c.id,c.label,c.count+' طالبًا')).join('')+'</div></section>';return;}
  const code=q.replace(/[^0-9/]/g,'');
  const cls=data.classes.filter(c=>norm(c.label).includes(q)||code&&(code===c.grade+'/'+c.section||code===c.grade+String(c.section).padStart(2,'0')));
  const st=data.students.filter(s=>norm(s.name).includes(q)).slice(0,40);
  const te=[...data.teachers.values()].filter(t=>norm(t.name).includes(q)||norm(display(t.name)).includes(q)).slice(0,20);
  const group=(title,items,fn)=>items.length?'<section class="sp-group"><h3>'+title+' <small>'+items.length+'</small></h3><div class="sp-list">'+items.map(fn).join('')+'</div></section>':'';
  out.innerHTML=(group('الفصول',cls,c=>item('class',c.id,c.label,c.count+' طالبًا'))+
    group('الطلاب',st,s=>item('student',s.id,s.name,(data.byClass.get(s.classId)||{}).label||''))+
    group('المعلمون',te,t=>item('teacher',t.key,display(t.name),subjectsOf(t).join('، '))))||'<p class="sp-hint">لا توجد نتائج مطابقة.</p>';
}
function onClick(e){
  const b=e.target.closest('[data-sp]');if(!b)return;
  if(b.dataset.sp==='back'){seq++;$('spProfile').innerHTML='';$('spResults').hidden=false;$('spQuery').focus();return;}
  open(b.dataset.sp,b.dataset.id);
}
async function monthRecords(){
  const to=today(),from=to.slice(0,8)+'01';
  if(month&&month.from===from&&month.to===to&&Date.now()-month.at<120000)return month.records;
  const snap=await firebase.firestore().collection('studentAttendance').where('date','>=',from).where('date','<=',to).get();
  month={from,to,at:Date.now(),records:snap.docs.map(d=>d.data())};
  return month.records;
}
async function open(type,id){
  if(!data)return;
  const token=++seq,box=$('spProfile');
  $('spResults').hidden=true;box.innerHTML='<p class="sp-hint">جارٍ تحميل الملف…</p>';
  try{
    const recs=await monthRecords();
    const html=type==='student'?await studentView(id,recs):type==='class'?classView(id,recs):teacherView(id,recs);
    if(token!==seq)return;
    box.innerHTML=html;host.scrollIntoView({block:'start'});
  }catch(err){if(token===seq)box.innerHTML=back+'<p class="sp-hint">'+(err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية عرض هذا الملف.':'تعذّر تحميل الملف.')+'</p>';}
}
async function studentView(id,recs){
  const s=data.students.find(x=>x.id===id);if(!s)return back+'<p class="sp-hint">الطالب غير موجود.</p>';
  const c=data.byClass.get(s.classId);
  const days=new Map();let lessonsAbsent=0,lessonsPresent=0;
  for(const r of recs){
    if(r.classId!==s.classId)continue;
    const m=(r.students||[]).find(x=>x.id===id);if(!m||(m.status!=='present'&&m.status!=='absent'))continue;
    const d=days.get(r.date)||{p:0,a:0};if(m.status==='present'){d.p++;lessonsPresent++;}else{d.a++;lessonsAbsent++;}days.set(r.date,d);
  }
  const full=[...days].filter(([,d])=>d.a&&!d.p).map(([k])=>k).sort(),present=[...days.values()].filter(d=>d.p).length;
  let actions=[];
  try{const snap=await firebase.firestore().collection('absenceActions').where('studentId','==',id).get();
    actions=snap.docs.map(d=>{const a=d.data();return {...a,day:a.createdAt&&a.createdAt.toDate?a.createdAt.toDate().toISOString().slice(0,10):''};}).sort((a,b)=>String(a.day).localeCompare(String(b.day)));}catch(e){}
  const wa=waLink(s.guardianPhone);
  return back+'<article class="sp-card"><header><span class="sp-type">ملف طالب</span><h2>'+esc(s.name)+'</h2><p>'+(c?link('class',c.id,c.label):esc(s.classId))+'</p></header>'+
    '<dl class="sp-facts"><div><dt>السجل المدني</dt><dd>'+esc(masked(s.civilId)||'—')+'</dd></div><div><dt>جوال ولي الأمر</dt><dd>'+(s.guardianPhone?esc(s.guardianPhone)+(wa?' · <a href="'+esc(wa)+'" target="_blank" rel="noopener noreferrer">واتساب</a>':''):'غير مسجّل')+'</dd></div></dl>'+
    '<h3>حضور هذا الشهر <small>(من الحصص المرصودة)</small></h3><div class="sp-kpis">'+kpi(present,'أيام حضور','ok')+kpi(full.length,'أيام غياب كامل','bad')+kpi(lessonsAbsent,'حصص غياب','warn')+kpi(lessonsPresent,'حصص حضور','')+'</div>'+
    (full.length?'<p>أيام الغياب الكامل: '+full.map(esc).join('، ')+'</p>':'')+
    '<h3>إجراءات متابعة الغياب</h3>'+(actions.length?'<ul class="sp-ul">'+actions.map(a=>'<li>'+esc((ACTIONS[a.action]||a.action)+' · مستوى '+a.level+' يومًا'+(a.day?' · '+a.day:'')+(a.note?' — '+a.note:''))+'</li>').join('')+'</ul>':'<p class="sp-hint">لا توجد إجراءات مسجّلة.</p>')+
    (c?'<h3>معلمو الفصل</h3><div class="sp-list">'+classTeachers(c).map(t=>item('teacher',t.key,display(t.name),t.subjects.join('، '))).join('')+'</div>':'')+'</article>';
}
function grid(classId){
  const cells=new Map();
  for(const t of data.teachers.values())for(const l of t.onsite)if(l.classId===classId){const k=l.day+'|'+l.period;(cells.get(k)||cells.set(k,[]).get(k)).push({subject:l.subject,name:display(t.name),key:t.key});}
  if(!cells.size)return '<p class="sp-hint">لا يوجد جدول حضوري لهذا الفصل.</p>';
  let html='<div class="sp-grid"><table><thead><tr><th>اليوم</th>';for(let p=1;p<=7;p++)html+='<th>'+p+'</th>';html+='</tr></thead><tbody>';
  DAYS.forEach((day,d)=>{html+='<tr><th>'+day+'</th>';for(let p=1;p<=7;p++){const list=cells.get(d+'|'+p)||[];html+='<td>'+list.map(x=>esc(x.subject)+'<small>'+link('teacher',x.key,x.name.split(' ').slice(0,2).join(' '))+'</small>').join('')+'</td>';}html+='</tr>';});
  return html+'</tbody></table></div>';
}
function classView(id,recs){
  const c=data.byClass.get(id);if(!c)return back+'<p class="sp-hint">الفصل غير موجود.</p>';
  const st=data.students.filter(s=>s.classId===id).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const rs=recs.filter(r=>r.classId===id),abs=new Map();let p=0,a=0;
  for(const r of rs)for(const m of r.students||[]){if(m.status==='present')p++;else if(m.status==='absent'){a++;abs.set(m.id,(abs.get(m.id)||0)+1);}}
  return back+'<article class="sp-card"><header><span class="sp-type">ملف فصل</span><h2>'+esc(c.label)+'</h2></header>'+
    '<div class="sp-kpis">'+kpi(st.length,'طالبًا','')+kpi(rs.length,'حصة مرصودة هذا الشهر','')+kpi(rate(p,a),'نسبة الحضور','ok')+kpi(a,'حالات غياب عن حصص','bad')+'</div>'+
    '<h3>الجدول الحضوري</h3>'+grid(id)+
    '<h3>معلمو الفصل</h3><div class="sp-list">'+classTeachers(c).map(t=>item('teacher',t.key,display(t.name),t.subjects.join('، '))).join('')+'</div>'+
    '<h3>الطلاب</h3><div class="sp-list">'+st.map(s=>item('student',s.id,s.name,abs.get(s.id)?'غياب '+abs.get(s.id)+' حصة هذا الشهر':'لا غياب مرصود هذا الشهر')).join('')+'</div></article>';
}
function teacherView(key,recs){
  const t=data.teachers.get(key);if(!t)return back+'<p class="sp-hint">المعلم غير موجود.</p>';
  const mine=recs.filter(r=>norm(r.teacher)===key);let p=0,a=0;
  for(const r of mine)for(const m of r.students||[]){if(m.status==='present')p++;else if(m.status==='absent')a++;}
  const classIds=[...new Set(t.onsite.map(l=>l.classId))].sort((x,y)=>x.localeCompare(y,undefined,{numeric:true}));
  const remote=[...new Set(t.remote.map(r=>r.cls))].map(g=>GROUPS[g]||g);
  const week=DAYS.map((day,d)=>{const list=t.onsite.filter(l=>l.day===d).sort((x,y)=>x.period-y.period);return list.length?'<li><b>'+day+':</b> '+list.map(l=>esc('ح'+l.period+' ')+link('class',l.classId,((data.byClass.get(l.classId)||{}).label||l.classId).replace(/^.* /,''))+esc(' '+l.subject)).join('، ')+'</li>':'';}).join('');
  return back+'<article class="sp-card"><header><span class="sp-type">ملف معلم</span><h2>'+esc(display(t.name))+'</h2><p>'+esc(subjectsOf(t).join('، ')||'—')+'</p></header>'+
    '<div class="sp-kpis">'+kpi(t.onsite.length,'حصة حضورية أسبوعيًا','')+kpi(t.remote.length,'حصة عن بُعد أسبوعيًا','')+kpi(mine.length,'حصة رُصد فيها حضور الطلاب هذا الشهر','')+kpi(rate(p,a),'نسبة حضور الطلاب في حصصه','ok')+'</div>'+
    (classIds.length?'<h3>فصوله الحضورية</h3><div class="sp-list">'+classIds.map(id=>{const c=data.byClass.get(id);const subs=[...new Set(t.onsite.filter(l=>l.classId===id).map(l=>l.subject))];return item('class',id,c?c.label:id,subs.join('، '));}).join('')+'</div>':'')+
    (remote.length?'<h3>مجموعاته عن بُعد</h3><p>'+esc(remote.join('، '))+'</p>':'')+
    (week?'<h3>جدوله الحضوري الأسبوعي</h3><ul class="sp-ul">'+week+'</ul>':'')+'</article>';
}
const style=document.createElement('style');
style.textContent='.sp-page{direction:rtl}.sp-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.sp-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.sp-head p{margin:0 0 12px;color:#5b6b66}#spQuery{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:12px 14px;border:1px solid #a5c5ba;border-radius:12px}#spStatus:empty{display:none}.sp-hint{color:#5b6b66}.sp-group h3{margin:16px 0 8px;font-size:16px;color:#123e36}.sp-group h3 small,.sp-card h3 small{color:#5b6b66;font-weight:400;font-size:13px}.sp-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.sp-item{display:grid;gap:2px;text-align:start;font:inherit;padding:10px 12px;border:1px solid #dae5df;border-radius:12px;background:#fff;cursor:pointer;color:inherit}.sp-item:hover,.sp-item:focus-visible{border-color:#17624d;background:#f2f8f5}.sp-item small{color:#5b6b66}.sp-card{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px}.sp-card header h2{margin:6px 0 2px;font-size:24px;color:#123e36}.sp-card header p{margin:0;color:#5b6b66}.sp-type{display:inline-block;font-size:12px;font-weight:600;color:#17624d;background:#e8f2ed;border-radius:999px;padding:2px 10px}.sp-card h3{margin:20px 0 8px;font-size:16px;color:#123e36}.sp-facts{display:flex;flex-wrap:wrap;gap:10px 28px;margin:14px 0 0}.sp-facts dt{font-size:12px;color:#5b6b66}.sp-facts dd{margin:0;font-weight:600}.sp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.sp-kpi{padding:10px 12px;border:1px solid #dae5df;border-radius:12px;background:#f7fbf9}.sp-kpi b{display:block;font-size:22px}.sp-kpi span{font-size:13px;color:#4a5e58}.sp-kpi.ok b{color:#17633a}.sp-kpi.bad b{color:#9f2727}.sp-kpi.warn b{color:#9a6200}.sp-link{font:inherit;border:0;background:none;color:#17624d;text-decoration:underline;cursor:pointer;padding:0}.sp-back{font:inherit;margin-bottom:10px;padding:6px 12px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer}.sp-grid{overflow:auto}.sp-grid table{border-collapse:collapse;width:100%;font-size:13px}.sp-grid th,.sp-grid td{border:1px solid #dae5df;padding:6px;text-align:center;vertical-align:top}.sp-grid thead{background:#e8f2ed}.sp-grid td small{display:block}.sp-ul{margin:0;padding-inline-start:20px;line-height:1.9}';
document.head.append(style);
setInterval(tick,1000);tick();
})(window);
