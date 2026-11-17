(function(root){
  'use strict';
  const labels={present:'حاضر',absent:'غائب',unmarked:'غير مرصود'};
  const normalize=value=>String(value??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').trim().replace(/\s+/g,' ');
  const digits=value=>String(value??'').replace(/[٠-٩۰-۹]/g,n=>String(n.charCodeAt(0)-(n<='٩'?1632:1776)));
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const grades=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
  function reportClass(value){
    const code=digits(value).trim();
    const id=/^([123])(\d{2})$/.exec(code);
    if(id&&Number(id[2])>0)return 'g'+id[1]+'-s'+Number(id[2]);
    const short=/^([123])\s*[ث/]\s*([1-9]\d?)$/.exec(code);
    if(short)return 'g'+short[1]+'-s'+short[2];
    const full=/^(.*?)[\s–-]+([123])(\d{2})$/.exec(code);
    if(!full||normalize(full[1])!==normalize(grades[Number(full[2])])||Number(full[3])===0)return '';
    return 'g'+full[2]+'-s'+Number(full[3]);
  }
  function remoteSessions(schedule,date,grade,period,substitutes={}){
    const sunday=new Date(date+'T00:00:00Z');
    const day=sunday.getUTCDay();
    if(!Number.isFinite(day)||day>4)return [];
    const groups=grade===3?['c3','ba','cs']:['c'+grade];
    return schedule.filter(row=>row.day===day&&row.slot===period-1&&groups.includes(row.cls))
      .map(row=>({...row,teacher:substitutes[row.id]?.t||row.orig||row.teacher}));
  }
  function matchReport(sheet,classId,students,date){
    const expected=['اسم الطالب','الفصل','الحالة','وقت الحضور'].map(normalize);
    const headerIndex=sheet.findIndex(row=>expected.slice(0,3).every(key=>row.some(cell=>normalize(cell)===key)));
    if(headerIndex<0)throw Error('اختر كشف حضور الحصة من فيوكلاس، وفيه أعمدة اسم الطالب والفصل والحالة.');
    const indexes=expected.map(key=>sheet[headerIndex].findIndex(cell=>normalize(cell)===key));
    const names=new Map();
    for(const student of students){
      const key=normalize(student.name);
      names.set(key,names.has(key)?null:student.id);
    }
    const matched=new Map(), unresolved=new Set(), conflicts=new Set();
    let inClass=0, rejectedDates=0;
    for(const row of sheet.slice(headerIndex+1)){
      const [name,section,status,entry]=indexes.map(index=>String(row[index]??'').trim());
      if(!name||reportClass(section)!==classId)continue;
      inClass++;
      const key=normalize(name), id=names.get(key);
      const state=normalize(status)==='حاضر'?'present':normalize(status)==='غائب'?'absent':'';
      if(!id||!state){unresolved.add(name);continue;}
      const time=digits(entry), day=/^\d{4}-\d{2}-\d{2}/.exec(time)?.[0];
      if(day&&day!==date){rejectedDates++;continue;}
      if(conflicts.has(id))continue;
      if(matched.has(id)&&matched.get(id).status!==state){
        matched.delete(id);conflicts.add(id);unresolved.add(name);continue;
      }
      matched.set(id,{status:state,entry:state==='present'?time.slice(0,40):''});
    }
    if(!inClass)throw Error('الكشف لا يحتوي على الشعبة المختارة.');
    if(rejectedDates)throw Error('يتضمن الكشف وقت حضور بتاريخ مختلف عن تاريخ الحصة المختارة.');
    return {matched,unresolved:[...unresolved]};
  }
  function guardianLink(phone,message){
    const plain=digits(phone).replace(/[\s()+-]/g,'');
    const international=/^05\d{8}$/.test(plain)?'966'+plain.slice(1):plain;
    return /^9665\d{8}$/.test(international)?'https://wa.me/'+international+'?text='+encodeURIComponent(message):'';
  }
  function rosterPlan(classMap,previous,source,makeId){
    const old=Object.entries(previous).flatMap(([classId,data])=>(data.students||[]).map(student=>({classId,student})));
    const byIdentity=new Map(),byName=new Map(),incomingNames=new Map(),seen=new Set(),claimed=new Set();
    const index=(map,key,entry)=>{if(key)map.set(key,map.has(key)?null:entry);};
    for(const entry of old){
      index(byIdentity,String(entry.student.civilId||''),entry);
      index(byName,normalize(entry.student.name),entry);
    }
    for(const row of source)index(incomingNames,normalize(row.name),row);
    const classIds=new Set(Object.keys(classMap));
    const classes={...classMap},students={},stats={created:0,moved:0,renamed:0,archived:0,ids:0,phones:0};
    for(const row of source){
      const key=normalize(row.name),id=digits(row.civilId).trim(),classId=reportClass(row.section);
      if(!key||row.name.length>150||!classId||id&&!/^\d{10}$/.test(id)||row.guardianPhone&&!guardianLink(row.guardianPhone,''))throw Error('أحد السجلات يحتوي اسمًا أو شعبة أو رقمًا غير صالح.');
      const unique=id||classId+'|'+key;
      if(seen.has(unique))throw Error('بيانات المصدر تتضمن سجلاً مكررًا. راجع الملف قبل الاعتماد.');
      seen.add(unique);
      classIds.add(classId);
      if(!classes[classId]){
        const [,grade,section]=/^g([123])-s(\d+)$/.exec(classId);
        classes[classId]={id:classId,grade:Number(grade),section:Number(section),label:grade+'/'+section,active:true};
      }
      const matched=(id&&byIdentity.get(id))||(incomingNames.get(key)&&byName.get(key));
      const entry=matched&&!claimed.has(matched.student.id)?matched:null;
      if(entry){
        claimed.add(entry.student.id);
        if(entry.classId!==classId)stats.moved++;
        if(entry.student.name!==row.name)stats.renamed++;
      }else stats.created++;
      const student={...entry?.student,id:entry?.student.id||makeId(),name:row.name};
      if(id)student.civilId=id;
      if(row.guardianPhone)student.guardianPhone=row.guardianPhone;
      if(student.civilId)stats.ids++;
      if(student.guardianPhone)stats.phones++;
      (students[classId]||=[]).push(student);
    }
    const archived={};
    for(const {classId,student} of old){
      if(claimed.has(student.id))continue;
      (archived[classId]||=[]).push(student);
      stats.archived++;
    }
    return {classes,classIds:[...classIds],students,archived,stats};
  }
  if(typeof module!=='undefined')module.exports={reportClass,matchReport,guardianLink,remoteSessions,rosterPlan};
  if(!root.document||!root.firebase?.apps.length)return;

  const db=firebase.firestore(),auth=firebase.auth(),app=root.__FUACC;
  const isTeacher=!app&&location.pathname.endsWith('/teacher.html');
  if(!app&&!isTeacher)return;
  const manager=()=>Boolean(app?.state.role===-1&&auth.currentUser);
  const $=id=>document.getElementById(id);
  const today=()=>{
    const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');
  };
  const classLabel=c=>grades[c.grade]+' · '+c.grade+'/'+c.section;
  const periods=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة'];
  const button=document.createElement('button');
  button.type='button';button.id='vStudentAttendance';button.className='btn ghost';
  button.textContent='سجل حضور الطلاب';button.hidden=true;
  (app?document.querySelector('#schoolGroup-followup .school-nav-links')||document.querySelector('.views'):$('account'))?.prepend(button);
  const dialog=document.createElement('dialog');
  dialog.id='studentAttendance';dialog.setAttribute('aria-labelledby','saTitle');
  dialog.innerHTML='<header><h2 id="saTitle">سجل حضور الطلاب</h2><button type="button" id="saClose">إغلاق</button></header>'+
    '<form id="saFilters"><label>التاريخ<input type="date" id="saDate" required></label><div id="saManagerFilters"></div><button>عرض سجل الحصة</button><button id="saDaySummary" type="button">ملخص اليوم</button></form>'+
    '<p id="saStatus" role="status"></p><section id="saBody"></section>';
  document.body.append(dialog);
  const style=document.createElement('style');
  style.textContent='#studentAttendance{direction:rtl;width:min(880px,calc(100vw - 28px));max-height:85vh;border:1px solid #b8d6ce;border-radius:16px;padding:20px;color:#173f36;background:#fff}#studentAttendance::backdrop{background:#173f3666}#studentAttendance header,#saFilters,#saManagerFilters,#studentAttendance .sa-actions{display:flex;align-items:end;gap:10px;flex-wrap:wrap}#studentAttendance header{justify-content:space-between}#studentAttendance h2{margin:0}#studentAttendance label{display:grid;gap:4px}#studentAttendance button,#studentAttendance input,#studentAttendance select{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit}#studentAttendance table{width:100%;border-collapse:collapse;margin-block:12px}#studentAttendance th,#studentAttendance td{padding:8px;border-bottom:1px solid #dbe8e4;text-align:start}#studentAttendance details{padding:10px;border:1px solid #dbe8e4;border-radius:8px;margin-block:8px}#studentAttendance button:disabled{opacity:.55}#studentAttendance #saSave{background:#17624d;color:#fff}';
  document.head.append(style);
  if(app)mountRosterSync();
  let classes=[], context=null, sequence=0, busy=false, draft=null;
  const status=message=>{$('saStatus').textContent=message;};
  const message=err=>err?.code==='permission-denied'?'حسابك لا يملك صلاحية الوصول إلى هذا السجل.':err?.message||'تعذّر تحميل سجل الحضور.';
  const setBusy=value=>{busy=value;for(const control of dialog.querySelectorAll('input,select,button:not(#saClose)'))control.disabled=value;};
  const clear=()=>{sequence++;draft=null;$('saBody').textContent='';status('');};
  const counts=rows=>rows.reduce((n,r)=>{n[r.status]++;return n;},{present:0,absent:0,unmarked:0});
  const summary=rows=>{const n=counts(rows);return 'الحضور '+n.present+' · الغياب '+n.absent+' · غير مرصود '+n.unmarked;};
  $('saClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{clear();context=null;});
  if(app){
    let uid='';
    setInterval(()=>{
      const user=auth.currentUser,next=user?.uid||'';
      button.hidden=!user||!(manager()||app.state.role===8);
      const actor=next+'|'+Boolean(manager())+'|'+app.state.role;
      if(uid!==actor&&dialog.open)dialog.close();
      uid=actor;
    },500);
  }else{
    auth.onAuthStateChanged(user=>{if(dialog.open)dialog.close();button.hidden=!user;});
  }
  button.onclick=async()=>{
    if(!auth.currentUser||busy)return;
    clear();
    const uid=auth.currentUser.uid,token=sequence;
    context={uid,edit:manager(),teacher:''};
    const date=$('saDate');
    date.value=today();date.max=today();
    const filters=$('saManagerFilters');
    filters.textContent='';
    dialog.showModal();
    setBusy(true);
    try{
      if(context.edit){
        const snap=await db.doc('config/onsite-classes').get();
        if(token!==sequence)return;
        classes=Object.values(snap.data()?.classes||{}).filter(c=>c.active!==false).sort((a,b)=>a.grade-b.grade||a.section-b.section);
        if(!classes.length)throw Error('أضف الفصول أولًا من إعدادات المدرسة.');
        filters.innerHTML='<label>الفصل<select id="saClass">'+classes.map(c=>'<option value="'+escape(c.id)+'">'+escape(classLabel(c))+'</option>').join('')+'</select></label>'+
          '<label>الحصة<select id="saPeriod">'+periods.map((period,index)=>'<option value="'+(index+1)+'">'+period+'</option>').join('')+'</select></label>';
      }else if(isTeacher){
        const snap=await db.doc('teacherProfiles/'+uid).get();
        if(token!==sequence)return;
        if(!snap.data()?.scheduleName)throw Error('حساب المعلم غير مرتبط بالجدول.');
        context.teacher=snap.data().scheduleName;
      }
      await load();
    }catch(err){if(token===sequence)status(message(err));}
    finally{setBusy(false);}
  };
  $('saFilters').addEventListener('change',clear);
  $('saFilters').onsubmit=event=>{event.preventDefault();load();};
  function recordsForDay(date){
    let query=db.collection('studentAttendance').where('date','==',date);
    if(context.teacher)query=query.where('teacher','==',context.teacher);
    return query.get().then(snap=>snap.docs.map(doc=>doc.data()).sort((a,b)=>a.period-b.period||a.classId.localeCompare(b.classId)));
  }
  function renderSummary(records){
    if(!records.length){$('saBody').textContent='لا توجد حصص مرصودة في هذا التاريخ.';return;}
    const byClass=new Map();
    for(const record of records){
      if(!byClass.has(record.classId))byClass.set(record.classId,{label:record.classLabel,periods:new Map()});
      byClass.get(record.classId).periods.set(record.period,counts(record.students));
    }
    const columns=periods.map((period,index)=>({label:period,number:index+1}));
    const cell=value=>{
      if(!value)return '<td>—</td>';
      const total=value.present+value.absent+value.unmarked;
      const percent=total?Math.round(value.present*100/total)+'%':'—';
      return '<td>'+value.present+' ح · '+value.absent+' غ<br><small>'+value.unmarked+' غير مرصود · '+percent+'</small></td>';
    };
    $('saBody').innerHTML='<h3>ملخص اليوم حسب الفصول</h3><p>ح = حاضر · غ = غائب. النسبة من إجمالي الأسماء في سجل الحصة.</p>'+
      '<div style="overflow:auto"><table style="min-width:760px"><thead><tr><th>الفصل</th>'+columns.map(c=>'<th>'+c.label+'</th>').join('')+
      '</tr></thead><tbody>'+[...byClass.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([,c])=>
        '<tr><th>'+escape(c.label)+'</th>'+columns.map(column=>cell(c.periods.get(column.number))).join('')+'</tr>').join('')+
      '</tbody></table></div><div id="saDayDetails"></div>';
    renderReadOnly(records,$('saDayDetails'));
  }
  $('saDaySummary').onclick=async()=>{
    if(!context||context.uid!==auth.currentUser?.uid||busy)return;
    const date=$('saDate').value;
    if(!date||date>today())return;
    clear();
    const token=sequence;
    setBusy(true);status('جارٍ تحميل ملخص اليوم…');
    try{
      const records=await recordsForDay(date);
      if(token===sequence){renderSummary(records);status('');}
    }catch(err){if(token===sequence)status(message(err));}
    finally{setBusy(false);}
  };
  function renderReadOnly(records,target=$('saBody')){
    target.innerHTML=records.length?records.map(record=>'<details><summary>'+escape(record.classLabel)+' · الحصة '+escape(periods[record.period-1])+' · '+escape(record.subject)+' · '+escape(record.teacher)+'</summary><p>'+escape(summary(record.students))+'</p>'+
      '<table><thead><tr><th>الطالب</th><th>الحالة</th><th>وقت الحضور</th></tr></thead><tbody>'+record.students.map(row=>'<tr><td>'+escape(row.name)+'</td><td>'+escape(labels[row.status])+'</td><td>'+escape(row.entry||'—')+'</td></tr>').join('')+'</tbody></table></details>').join(''):'<p>لا توجد حصص مرصودة في هذا التاريخ.</p>';
  }
  async function load(){
    if(!context||context.uid!==auth.currentUser?.uid)return;
    const date=$('saDate').value;
    if(!date||date>today())return;
    clear();
    const token=sequence,edit=context.edit;
    setBusy(true);status('جارٍ تحميل السجل…');
    try{
      if(!edit){
        const records=await recordsForDay(date);
        if(token===sequence){renderReadOnly(records);status('');}
        return;
      }
      const c=classes.find(item=>item.id===$('saClass')?.value),period=Number($('saPeriod')?.value);
      if(!c||!period)throw Error('اختر الفصل والحصة.');
      const ref=db.doc('studentAttendance/'+date+'_'+c.id+'_p'+period);
      const sunday=new Date(date+'T00:00:00Z');
      sunday.setUTCDate(sunday.getUTCDate()-sunday.getUTCDay());
      const week=sunday.toISOString().slice(0,10);
      const [roster,previous,subs]=await Promise.all([db.doc('config/onsite-students-'+c.id).get(),ref.get(),db.doc('config/subs-'+week).get()]);
      if(token!==sequence)return;
      const old=previous.data()||{}, ready=new Map((old.students||[]).map(row=>[row.id,row]));
      const phones=new Map();
      for(const student of roster.data()?.students||[]){
        phones.set(student.id,student.guardianPhone||'');
        if(!ready.has(student.id))ready.set(student.id,{id:student.id,name:student.name,status:'unmarked',entry:''});
      }
      const sessions=remoteSessions(app.S,date,c.grade,period,subs.data()?.map);
      if(!sessions.length)throw Error('لا توجد حصة مطابقة في جدول المنصة عن بُعد لهذا اليوم والفصل.');
      draft={ref,date,c,period,phones,sessions,students:[...ready.values()],teacher:old.teacher||'',subject:old.subject||'',revision:old.revision||0};
      renderEditor();
      status(draft.students.length?'':'لا توجد أسماء طلاب لهذا الفصل.');
    }catch(err){if(token===sequence)status(message(err));}
    finally{setBusy(false);}
  }
  function renderEditor(){
    const current=draft;
    const groups={c1:'الأول الثانوي',c2:'الثاني الثانوي',c3:'الثالث الثانوي',ba:'إدارة الأعمال',cs:'الحاسب والهندسة'};
    const fromRecord=current.sessions.find(lesson=>lesson.teacher===current.teacher&&lesson.subj===current.subject);
    const selected=fromRecord?.id||(current.sessions.length===1?current.sessions[0].id:'');
    $('saBody').innerHTML='<form id="saEdit"><label>الحصة حسب جدول عن بُعد<select id="saSession" required><option value="">اختر الحصة أو المسار</option>'+
      current.sessions.map(lesson=>'<option '+(lesson.id===selected?'selected ':'')+'value="'+escape(lesson.id)+'">'+escape(groups[lesson.cls]+' · '+lesson.subj+' · '+(root.StaffSettings?.displayName(lesson.teacher)||lesson.teacher))+'</option>').join('')+
      '</select></label>'+
      '<div class="sa-actions"><label>كشف الحضور من فيوكلاس<input type="file" accept=".xlsx,.xls,.csv" id="saReport"></label><button type="button" id="saPreview">معاينة كشف الحضور</button></div>'+
      '<div id="saReportPreview"></div><p id="saTotals">'+escape(summary(current.students))+'</p><table><thead><tr><th>الطالب</th><th>الحالة</th><th>وقت الحضور</th></tr></thead><tbody id="saStudents"></tbody></table>'+
      '<div class="sa-actions"><button id="saSave" type="submit">حفظ الحضور والغياب</button><button id="saNotice" type="button">تجهيز إشعارات الغياب</button></div></form><div id="saNotices"></div>';
    const students=$('saStudents');
    function paintRows(){
      students.innerHTML=current.students.map((row,index)=>'<tr><td>'+escape(row.name)+'</td><td><select aria-label="حالة '+escape(row.name)+'" data-sa-index="'+index+'">'+
        Object.entries(labels).map(([key,label])=>'<option value="'+key+'"'+(row.status===key?' selected':'')+'>'+label+'</option>').join('')+'</select></td><td>'+escape(row.entry||'—')+'</td></tr>').join('');
      $('saTotals').textContent=summary(current.students);
    }
    function dirty(){current.dirty=true;$('saNotices').textContent='';}
    students.onchange=event=>{
      const index=event.target.dataset.saIndex;if(index===undefined)return;
      const row=current.students[Number(index)];
      row.status=event.target.value;if(row.status!=='present')row.entry='';
      dirty();paintRows();
    };
    $('saSession').onchange=dirty;
    $('saReport').onchange=()=>{$('saReportPreview').textContent='';};
    $('saPreview').onclick=async()=>{
      const file=$('saReport').files[0];
      if(!file||file.size>5*1024*1024){status('اختر كشفًا بحجم لا يتجاوز 5 ميغابايت.');return;}
      $('saReportPreview').textContent='';
      setBusy(true);
      try{
        const xlsx=await root.loadXLSX();
        const bytes=/\.csv$/i.test(file.name)?await file.text():await file.arrayBuffer();
        const book=xlsx.read(bytes,{type:typeof bytes==='string'?'string':'array',sheetRows:10001});
        const rows=xlsx.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,raw:false});
        if(rows.length>=10001)throw Error('الكشف يتجاوز الحد الأقصى لعدد الصفوف.');
        const {matched,unresolved}=matchReport(rows,current.c.id,current.students,current.date);
        if(draft!==current)return;
        const entries=[...matched.values()];
        $('saReportPreview').innerHTML='<p>المطابقون '+entries.length+' · '+escape(summary(entries))+' · تحتاج مراجعة '+unresolved.length+'</p>'+
          (unresolved.length?'<details><summary>الأسماء التي تحتاج مراجعة</summary><ul>'+unresolved.map(name=>'<li>'+escape(name)+'</li>').join('')+'</ul></details>':'')+
          (entries.length?'<button id="saApply" type="button">تطبيق المطابقات على السجل</button>':'');
        if(entries.length)$('saApply').onclick=()=>{
          for(const row of current.students)if(matched.has(row.id))Object.assign(row,matched.get(row.id));
          dirty();paintRows();$('saReportPreview').textContent='طُبّقت المطابقات. راجع الحالات ثم احفظ.';
        };
        status('');
      }catch(err){if(draft===current)status(message(err));}
      finally{setBusy(false);}
    };
    $('saEdit').onsubmit=async event=>{
      event.preventDefault();
      if(!manager()||busy||draft!==current||!current.students.length)return;
      const lesson=current.sessions.find(item=>item.id===$('saSession').value),uid=auth.currentUser.uid;
      if(!lesson)return;
      const teacher=lesson.teacher,subject=lesson.subj;
      setBusy(true);
      try{
        await db.runTransaction(async tx=>{
          const previous=await tx.get(current.ref);
          if((previous.data()?.revision||0)!==current.revision)throw Error('تغيّر السجل في جلسة أخرى. أعد عرضه قبل الحفظ.');
          tx.set(current.ref,{date:current.date,classId:current.c.id,classLabel:classLabel(current.c),period:current.period,
            teacher,subject,students:current.students,revision:current.revision+1,updatedBy:uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        });
        if(draft===current){current.revision++;current.teacher=teacher;current.subject=subject;current.dirty=false;status('تم حفظ الحضور والغياب.');}
      }catch(err){if(draft===current)status(message(err));}
      finally{setBusy(false);}
    };
    $('saNotice').onclick=()=>{
      if(!manager()||current.dirty||!current.revision){status('احفظ السجل أولًا قبل تجهيز الإشعارات.');return;}
      const absent=current.students.filter(row=>row.status==='absent');
      $('saNotices').innerHTML='<h3>إشعارات واتساب للغائبين</h3>'+
        (absent.length?'<ul>'+absent.map(row=>{
          const body='ولي أمر الطالب '+row.name+'، السلام عليكم. رُصد غياب الطالب عن الحصة '+periods[current.period-1]+' ('+current.subject+') بتاريخ '+current.date+'. نأمل متابعة حضوره. إدارة ثانوية الصحافة الأهلية.';
          const link=guardianLink(current.phones.get(row.id),body);
          return '<li>'+escape(row.name)+' · '+(link?'<a target="_blank" rel="noopener noreferrer" href="'+escape(link)+'">فتح رسالة واتساب</a>':'جوال ولي الأمر غير مسجّل')+'</li>';
        }).join('')+'</ul>':'<p>لا يوجد طلاب غائبون في الحصة.</p>');
    };
    paintRows();
  }
  function mountRosterSync(){
    const sync=document.createElement('button');
    sync.type='button';sync.className='btn ghost';sync.hidden=true;
    sync.textContent='مطابقة قوائم فيوكلاس';
    (document.querySelector('#schoolGroup-people .school-nav-links')||document.querySelector('.views'))?.append(sync);
    const panel=document.createElement('dialog');
    panel.id='viewClassRosterSync';
    panel.style.cssText='direction:rtl;width:min(750px,calc(100vw - 30px));max-height:85vh;border-radius:14px;padding:20px';
    panel.innerHTML='<h2>مطابقة قوائم فيوكلاس</h2><p>الصق الأعمدة بالترتيب: الاسم، رمز الشعبة، السجل المدني، جوال ولي الأمر. اترك الخانات غير المتاحة فارغة.</p>'+
      '<textarea aria-label="قائمة طلاب فيوكلاس" rows="6" style="width:100%"></textarea><p role="status"></p>'+
      '<button type="button" data-vc-preview>معاينة المطابقة</button> <button type="button" data-vc-save hidden>اعتماد المطابقة</button> <button type="button" data-vc-close>إغلاق</button>';
    document.body.append(panel);
    const input=panel.querySelector('textarea'),status=panel.querySelector('[role=status]');
    const preview=panel.querySelector('[data-vc-preview]'),save=panel.querySelector('[data-vc-save]');
    const classesRef=db.doc('config/onsite-classes'),ref=id=>db.doc('config/onsite-students-'+id);
    let prepared=null,doing=false;
    setInterval(()=>{
      sync.hidden=!manager();
      if(!manager()&&panel.open)panel.close();
    },500);
    sync.onclick=()=>{if(manager()&&!doing)panel.showModal();};
    panel.querySelector('[data-vc-close]').onclick=()=>{if(!doing)panel.close();};
    panel.addEventListener('cancel',event=>{if(doing)event.preventDefault();});
    const clear=()=>{prepared=null;save.hidden=true;status.textContent='';};
    input.oninput=clear;
    panel.addEventListener('close',()=>{input.value='';clear();});
    async function compute(get,source){
      const registry=(await get(classesRef)).data()?.classes||{};
      const ids=[...new Set([...Object.keys(registry),...source.map(row=>reportClass(row.section))])];
      if(ids.some(id=>!id)||ids.length>100)throw Error('راجع رموز الشعب في الكشف.');
      const docs=await Promise.all(ids.map(id=>get(ref(id))));
      const old=Object.fromEntries(ids.map((id,i)=>[id,docs[i].data()||{}]));
      const fingerprint=JSON.stringify([registry,old]);
      return {old,fingerprint,...rosterPlan(registry,old,source,()=>crypto.randomUUID())};
    }
    const lock=value=>{doing=value;input.disabled=preview.disabled=save.disabled=value;};
    preview.onclick=async()=>{
      if(!manager()||doing)return;
      clear();lock(true);
      try{
        const source=input.value.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
          const [name='',section='',civilId='',guardianPhone='']=line.split('\t').map(value=>value.trim());
          return {name,section,civilId,guardianPhone};
        });
        if(!source.length||source.length>1500)throw Error('أدخل كشف فيوكلاس الكامل.');
        const plan=await compute(ref=>ref.get(),source);
        if(!panel.open||!manager())return;
        const count=Object.keys(plan.students).length,s=plan.stats;
        prepared={source,fingerprint:plan.fingerprint};
        status.textContent=source.length+' طالبًا في '+count+' شعبة. جديد '+s.created+'، منتقل '+s.moved+'، اسم محدّث '+s.renamed+'، سيُحفظ في الأرشيف '+s.archived+'، سجل مدني '+s.ids+'، جوال ولي أمر '+s.phones+'.';
        save.hidden=false;
      }catch(error){if(panel.open)status.textContent=error.message;}
      finally{lock(false);}
    };
    save.onclick=async()=>{
      if(!prepared||doing||!manager())return;
      const {source,fingerprint}=prepared,uid=auth.currentUser.uid;
      lock(true);
      try{
        await db.runTransaction(async tx=>{
          const plan=await compute(ref=>tx.get(ref),source);
          if(plan.fingerprint!==fingerprint)throw Error('تغيرت البيانات بعد المعاينة. أعد المعاينة.');
          const stamp=firebase.firestore.FieldValue.serverTimestamp();
          const changes={updatedBy:uid,updatedAt:stamp};
          tx.set(classesRef,{classes:plan.classes,...changes},{merge:true});
          for(const classId of plan.classIds){
            const additions=plan.archived[classId]||[];
            const archivedStudents=[...(plan.old[classId]?.archivedStudents||[]),...additions];
            const students=plan.students[classId]||[];
            if(!students.length&&!plan.old[classId]?.students?.length)continue;
            tx.set(ref(classId),{classId,students,archivedStudents,...changes},{merge:true});
          }
        });
        input.value='';clear();
        status.textContent='تمت مطابقة '+source.length+' طالبًا وحفظ بياناتهم.';
      }catch(error){status.textContent=error.message;}
      finally{lock(false);}
    };
  }
})(typeof window==='undefined'?globalThis:window);
