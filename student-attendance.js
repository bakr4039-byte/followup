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
  const titleWords=value=>normalize(digits(value)).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function titleSlot(title){
    const text=titleWords(title).replace(/اال(?=(?:اولي|ثاني|ثالث|رابع|خامس|سادس|سابع))/g,'ال');
    const match=/(?:^|\s)الحص[هة]\s+((?:ال)?(?:اولي|ثاني[ةه]|ثالث[ةه]|رابع[ةه]|خامس[ةه]|سادس[ةه]|سابع[ةه])|[1-7])(?=\s|$)/.exec(text);
    if(!match)return {period:0,subject:''};
    const ordinal=match[1].replace(/^ال/,'').replace(/ه$/,'ة');
    const period=Number(ordinal)||['اولي','ثانية','ثالثة','رابعة','خامسة','سادسة','سابعة'].indexOf(ordinal)+1;
    const prefix=text.slice(0,match.index).trim();
    return {period,subject:!prefix||/^x$/i.test(prefix)?text.slice(match.index+match[0].length).trim():''};
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
      const state=['حاضر','متاخر'].includes(normalize(status))?'present':normalize(status)==='غائب'?'absent':'';
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
  function studentTotals(records){
    const students=new Map();
    for(const record of [...records].sort((a,b)=>String(a.date).localeCompare(String(b.date)))){
      for(const row of record.students){
        if(!Object.hasOwn(labels,row.status))continue;
        if(!students.has(row.id))students.set(row.id,{name:row.name,classes:new Set(),present:0,absent:0,unmarked:0});
        const total=students.get(row.id);
        total.name=row.name;total.classes.add(record.classLabel);total[row.status]++;
      }
    }
    return [...students.values()].sort((a,b)=>b.absent-a.absent||a.name.localeCompare(b.name,'ar'));
  }
  function lessonTotals(records,key){
    const groups=new Map();
    for(const record of records){
      const name=String(record[key]||'غير محدد').trim();
      if(!groups.has(name))groups.set(name,{name,lessons:0,present:0,absent:0,unmarked:0});
      const group=groups.get(name);
      group.lessons++;
      for(const row of record.students)if(Object.hasOwn(labels,row.status))group[row.status]++;
    }
    return [...groups.values()].sort((a,b)=>b.absent-a.absent||a.name.localeCompare(b.name,'ar'));
  }
  function dailyAttendance(records,rosters,dates,expectedPeriods){
    const days=new Map();
    for(const date of dates){
      for(const [classId,roster] of rosters){
        const expected=expectedPeriods(classId,date);
        if(!expected.length)continue;
        const lessons=records.filter(record=>record.date===date&&record.classId===classId);
        const students=new Map(roster.map(student=>[student.id,student]));
        for(const lesson of lessons)for(const student of lesson.students)if(!students.has(student.id))students.set(student.id,student);
        for(const student of students.values()){
          const marks=new Map();
          for(const lesson of lessons){
            const mark=lesson.students.find(row=>row.id===student.id);
            if(mark&&expected.includes(lesson.period))marks.set(lesson.period,mark.status);
          }
          const present=[...marks.values()].includes('present');
          const complete=expected.every(period=>marks.get(period)==='absent');
          const status=present?'present':complete?'absent':'unmarked';
          const key=date+'|'+student.id,row={...student,date,classId,status,absentLessons:[...marks.values()].filter(mark=>mark==='absent').length,presentLessons:[...marks.values()].filter(mark=>mark==='present').length,marked:[...marks.values()].filter(mark=>mark==='present'||mark==='absent').length,expected:expected.length};
          const previous=days.get(key);
          if(!previous||row.status==='present'&&previous.status!=='present'||row.marked>previous.marked&&previous.status!=='present')days.set(key,row);
        }
      }
    }
    return [...days.values()];
  }
  function attendanceDays(rows){
    const students=new Map();
    for(const row of rows){
      const key=row.id;
      if(!students.has(key))students.set(key,{id:key,name:row.name,classes:new Set(),present:0,absent:0,unmarked:0});
      const total=students.get(key);total.classes.add(row.classId);total[row.status]++;
    }
    return [...students.values()].sort((a,b)=>b.absent-a.absent||a.name.localeCompare(b.name,'ar'));
  }
  function teacherRanking(records){
    const groups=new Map();
    for(const record of records){
      const grade=Number(/^g([123])-/.exec(record.classId)?.[1]||0),teacher=String(record.teacher||'غير محدد'),key=grade+'|'+teacher;
      if(!groups.has(key))groups.set(key,{grade,teacher,lessons:0,present:0,absent:0,unmarked:0});
      const group=groups.get(key);group.lessons++;
      for(const student of record.students)if(Object.hasOwn(labels,student.status))group[student.status]++;
    }
    return [...groups.values()].map(row=>({...row,rate:row.present+row.absent?row.present/(row.present+row.absent):null}))
      .sort((a,b)=>a.grade-b.grade||(b.rate??-1)-(a.rate??-1)||b.present-a.present||a.teacher.localeCompare(b.teacher,'ar'));
  }
  function rosterPlan(classMap,previous,source,makeId){
    const old=Object.entries(previous).flatMap(([classId,data])=>(data.students||[]).map(student=>({classId,student})));
    const byIdentity=new Map(),byName=new Map(),incomingNames=new Map(),incomingAliases=new Map(),seen=new Set(),claimed=new Set();
    const index=(map,key,entry)=>{if(key)map.set(key,map.has(key)?null:entry);};
    for(const entry of old){
      index(byIdentity,String(entry.student.civilId||''),entry);
      index(byName,normalize(entry.student.name),entry);
    }
    for(const row of source){
      index(incomingNames,normalize(row.name),row);
      index(incomingAliases,normalize(row.priorName),row);
    }
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
      const alias=normalize(row.priorName);
      const matched=(id&&byIdentity.get(id))||(alias&&incomingAliases.get(alias)&&byName.get(alias))||
        (incomingNames.get(key)&&byName.get(key));
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
  if(typeof module!=='undefined')module.exports={reportClass,matchReport,guardianLink,remoteSessions,rosterPlan,studentTotals,lessonTotals,titleSlot,dailyAttendance,attendanceDays,teacherRanking};
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
  const TABS=[['record','رصد الحصص'],['reports','التقارير'],['absence','الغياب والإشعارات'],['import','الاستيراد']];
  let tab='record';
  const button=document.createElement('button');
  button.type='button';button.id='vStudentAttendance';button.className='btn ghost';
  button.textContent='سجل حضور الطلاب';button.hidden=true;
  button.dataset.workspaceKey='native';
  (app?document.querySelector('#schoolGroup-followup .school-nav-links')||document.querySelector('.views'):$('account'))?.prepend(button);
  const view=document.createElement('section');
  view.id='studentAttendance';view.hidden=true;view.setAttribute('aria-labelledby','saTitle');
  view.innerHTML='<header><h2 id="saTitle" tabindex="-1">سجل حضور الطلاب</h2><button type="button" id="saClose">العودة</button></header>'+
    '<nav class="sa-tabs" role="tablist" aria-label="أقسام سجل حضور الطلاب">'+TABS.map(([key,label])=>'<button type="button" role="tab" id="saTab-'+key+'" data-sa-tab="'+key+'" aria-selected="'+(key===tab)+'">'+label+'</button>').join('')+'</nav>'+
    '<form id="saFilters"><div class="sa-presets" role="group" aria-label="فترات جاهزة"><button type="button" data-sa-range="today">اليوم</button><button type="button" data-sa-range="week">هذا الأسبوع</button><button type="button" data-sa-range="month">هذا الشهر</button></div><label>من تاريخ<input type="date" id="saFrom" required></label>'+
    '<label>إلى تاريخ<input type="date" id="saTo" required></label>'+
    '<label>الصف<select id="saGrade"><option value="">كل الصفوف</option>'+grades.slice(1).map((grade,i)=>'<option value="'+(i+1)+'">'+grade+' بالكامل</option>').join('')+'</select></label>'+
    '<label>الشعبة<select id="saClass"><option value="">كل الشعب</option></select></label>'+
    '<label>الحصة<select id="saPeriod"><option value="">جميع الحصص</option>'+periods.map((period,i)=>'<option value="'+(i+1)+'">'+period+'</option>').join('')+'</select></label>'+
    '<label>المعلم<select id="saTeacher"><option value="">الجميع</option></select></label>'+
    '<label id="saKindField">التقرير<select id="saReportKind"><option value="all">جميع التقارير</option><option value="students">أيام حضور وغياب الطلاب</option><option value="daily">الحضور والغياب اليومي</option><option value="teachers">أعلى المعلمين حضورًا للطلاب</option></select></label>'+
    '<button type="submit">عرض السجل</button></form>'+
    '<p id="saStatus" role="status"></p><div id="saCards" class="sa-cards" aria-live="polite"></div><div id="saQuick" class="sa-actions" hidden></div><section id="saReports"></section><div id="saResults"></div><section id="saBody"></section>';
  let navigation;
  if(app){
    $('boardView').after(view);
    navigation=app.registerAttendance(button.id,view.id);
  }else $('account')?.append(view);
  const style=document.createElement('style');
  style.textContent=`
    #studentAttendance{direction:rtl;min-width:0;padding:clamp(12px,2vw,24px);border:1px solid #b8d6ce;border-radius:16px;color:#173f36;background:#fff}
    #studentAttendance header,#saFilters,#studentAttendance .sa-actions{display:flex;align-items:end;gap:10px;flex-wrap:wrap}
    #studentAttendance header{justify-content:space-between;margin-bottom:16px}
    #studentAttendance h2,#studentAttendance h3{margin:0}
    #studentAttendance h3{margin-top:12px}
    #studentAttendance label{display:grid;gap:4px}
    #studentAttendance button,#studentAttendance input,#studentAttendance select{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit}
    #studentAttendance button{cursor:pointer}
    #studentAttendance input[type=file]{max-width:100%}
    #studentAttendance .sa-grid{overflow:auto;margin-block:12px}
    #studentAttendance table{width:100%;min-width:0;border-collapse:collapse;white-space:nowrap}
    #studentAttendance .sa-period-metrics{font-size:12px;line-height:1.45}
    #studentAttendance .sa-period-metrics small,#studentAttendance th small{display:block;color:#60716b;font-weight:400}
    #studentAttendance th small{direction:ltr}
    #studentAttendance th,#studentAttendance td{padding:7px;border:1px solid #a9bcb6;text-align:center}
    #studentAttendance thead{background:#e8f2ed}
    #studentAttendance .sa-total{background:#edf5f0;font-weight:700}
    #studentAttendance .sa-present{background:#e8f5e9;color:#17633a}
    #studentAttendance .sa-absent{background:#faebea;color:#9f2727}
    #studentAttendance .sa-unmarked{color:#60716b}
    #studentAttendance .sa-cell{display:inline-block;min-width:36px;padding:5px 7px}
    #studentAttendance .sa-student-name{text-align:start}
    #studentAttendance details{padding:10px;border:1px solid #dbe8e4;border-radius:8px;margin-block:8px}
    #studentAttendance summary{cursor:pointer}
    #studentAttendance button:disabled{opacity:.55}
    #studentAttendance #saSave,#saFilters button[type=submit]{background:#17624d;color:#fff}
    #saStatus:empty{display:none}
#studentAttendance [hidden]{display:none!important}
#studentAttendance .sa-tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:2px solid #dbe8e4;margin-bottom:14px}
#studentAttendance .sa-tabs button{border:0;border-bottom:3px solid transparent;border-radius:8px 8px 0 0;background:transparent;padding:9px 16px;font-weight:600;color:#4a5e58;margin-bottom:-2px}
#studentAttendance .sa-tabs button[aria-selected=true]{border-bottom-color:#17624d;color:#17624d;background:#eef6f2}
#studentAttendance .sa-presets{display:flex;gap:6px;flex-wrap:wrap;flex-basis:100%}
#studentAttendance .sa-presets button{padding:5px 14px;border-radius:999px;font-size:13px;background:#f2f7f5}
#studentAttendance .sa-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:4px 0 16px}
#studentAttendance .sa-cards:empty{display:none}
#studentAttendance .sa-cards-title{grid-column:1/-1;margin:0;font-weight:600;color:#4a5e58}
#studentAttendance .sa-card{display:grid;gap:2px;text-align:start;padding:12px 14px;border:1px solid #dbe8e4;border-radius:12px;background:#f7fbf9}
#studentAttendance .sa-card b{font-size:24px;line-height:1.15}
#studentAttendance .sa-card span{font-size:13px;color:#4a5e58}
#studentAttendance .sa-card.ok b{color:#17633a}
#studentAttendance .sa-card.bad b{color:#9f2727}
#studentAttendance .sa-card.warn b{color:#9a6200}
#studentAttendance #saQuick{padding:12px;border:1px dashed #a5c5ba;border-radius:12px;background:#f7fbf9;margin-bottom:12px}
#studentAttendance .sa-level{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
#studentAttendance .sa-level.l1{background:#fff4dc;color:#7a4d00}
#studentAttendance .sa-level.l2{background:#ffe6d5;color:#8a3b00}
#studentAttendance .sa-level.l3{background:#faebea;color:#9f2727}
  @media print{#studentAttendance .sa-tabs,#saCards,#saQuick,#saFilters,#saClose,#saStatus,#saStudentEditor,#studentAttendance button,#studentAttendance .sa-actions{display:none!important}#studentAttendance .sa-grid{overflow:visible}}
  `;
  document.head.append(style);
  if(app){mountRosterSync();mountBatchAttendance();}
  let classes=[],context=null,sequence=0,busy=false,draft=null,activeSheet=null;
  const status=text=>{$('saStatus').textContent=text;};
  const message=err=>err?.code==='permission-denied'?'حسابك لا يملك صلاحية الوصول إلى هذا السجل.':err?.message||'تعذّر تحميل سجل الحضور.';
  const setBusy=value=>{busy=value;for(const control of view.querySelectorAll('input,select,button:not(#saClose)'))control.disabled=value;};
  const clear=()=>{sequence++;draft=null;activeSheet=null;$('saReports').textContent='';$('saResults').textContent='';$('saCards').textContent='';$('saBody').textContent='';status('');};
  const counts=rows=>rows.reduce((n,r)=>{if(Object.hasOwn(n,r.status))n[r.status]++;return n;},{present:0,absent:0,unmarked:0});
  const summary=rows=>{const n=counts(rows);return 'الحضور '+n.present+' · الغياب '+n.absent+' · غير مرصود '+n.unmarked;};
  const close=()=>{
    clear();context=null;view.hidden=true;button.setAttribute('aria-pressed','false');
    navigation?.close();
  };
  $('saClose').onclick=close;
  function applyTab(next){
    if(next)tab=next;
    if(tab==='import'&&!manager())tab='record';
    for(const item of view.querySelectorAll('[data-sa-tab]')){
      const on=item.dataset.saTab===tab;
      item.setAttribute('aria-selected',String(on));item.tabIndex=on?0:-1;
      item.hidden=item.dataset.saTab==='import'&&!manager();
    }
    $('saFilters').hidden=tab==='import';
    $('saKindField').hidden=tab!=='reports';
    $('saReports').hidden=tab==='record'||tab==='import';
    $('saResults').hidden=tab!=='record';
    $('saBody').hidden=tab!=='record';
    $('saQuick').hidden=tab!=='record'||!context?.edit;
    const batch=$('saBatchBox');if(batch)batch.hidden=tab!=='import'||!manager();
    if(activeSheet&&(tab==='reports'||tab==='absence'))paintReports();
  }
  const tabList=view.querySelector('.sa-tabs');
  tabList.onclick=event=>{const item=event.target.closest('[data-sa-tab]');if(item&&!busy)applyTab(item.dataset.saTab);};
  tabList.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const list=[...tabList.querySelectorAll('[data-sa-tab]:not([hidden])')],index=list.indexOf(document.activeElement);
    if(index<0)return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowLeft'?1:-1)+list.length)%list.length;
    list[next].focus();applyTab(list[next].dataset.saTab);
  };
  $('saCards').onclick=event=>{const item=event.target.closest('[data-sa-goto]');if(item&&!busy)applyTab(item.dataset.saGoto);};
  view.querySelector('.sa-presets').onclick=event=>{
    const item=event.target.closest('[data-sa-range]');
    if(!item||busy||!context)return;
    const end=today(),start=new Date(end+'T00:00:00Z');
    if(item.dataset.saRange==='week')start.setUTCDate(start.getUTCDate()-start.getUTCDay());
    else if(item.dataset.saRange==='month')start.setUTCDate(1);
    $('saFrom').value=start.toISOString().slice(0,10);$('saTo').value=end;
    load();
  };
  function paintQuick(){
    const host=$('saQuick');
    host.innerHTML='<label>رصد حصة اليوم · الشعبة<select id="saQuickClass">'+classes.map(c=>'<option value="'+escape(c.id)+'">'+escape(classLabel(c))+'</option>').join('')+'</select></label>'+
      '<label>الحصة<select id="saQuickPeriod">'+periods.map((period,i)=>'<option value="'+(i+1)+'">'+period+'</option>').join('')+'</select></label>'+
      '<button type="button" id="saQuickOpen">فتح رصد الحصة</button>';
    $('saQuickOpen').onclick=()=>{if(!busy&&$('saQuickClass').value)openLesson(today(),$('saQuickClass').value,Number($('saQuickPeriod').value),'');};
  }
  if(app){
    let actor='';
    setInterval(()=>{
      const user=auth.currentUser,next=(user?.uid||'')+'|'+app.state.role;
      const hidden=!user||!(manager()||app.state.role===8);
      if(button.hidden!==hidden)button.hidden=hidden;
      if(actor&&actor!==next&&context)close();
      actor=next;
    },500);
  }else auth.onAuthStateChanged(user=>{close();button.hidden=!user;});
  const gradeOf=id=>Number(String(id).match(/^g([123])-/)?.[1]||0);
  const classOrder=(a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true});
  function refreshClasses(items){
    const control=$('saClass'),previous=control.value,grade=Number($('saGrade').value);
    control.innerHTML='<option value="">كل الشعب</option>'+items.filter(c=>!grade||c.grade===grade).map(c=>'<option value="'+escape(c.id)+'">'+escape(classLabel(c))+'</option>').join('');
    if([...control.options].some(option=>option.value===previous))control.value=previous;
  }
  button.onclick=async()=>{
    if(!auth.currentUser||button.hidden||busy)return;
    const uid=auth.currentUser.uid;
    if(navigation)navigation.open();else view.hidden=false;
    view.scrollIntoView({block:'start'});
    $('saTitle').focus({preventScroll:true});
    if(context?.uid===uid)return;
    clear();
    const token=sequence;
    context={uid,edit:manager(),teacher:''};
    applyTab();
    for(const id of ['saFrom','saTo']){$(id).value=today();$(id).max=today();}
    setBusy(true);
    try{
      if(context.edit){
        const snap=await db.doc('config/onsite-classes').get();
        if(token!==sequence)return;
        classes=Object.values(snap.data()?.classes||{}).filter(c=>c.active!==false).sort(classOrder);
        refreshClasses(classes);
        paintQuick();applyTab();
      }else if(isTeacher){
        const snap=await db.doc('teacherProfiles/'+uid).get();
        if(token!==sequence)return;
        if(!snap.data()?.scheduleName)throw Error('حساب المعلم غير مرتبط بالجدول.');
        context.teacher=snap.data().scheduleName;
      }
      await load();
    }catch(err){if(token===sequence){status(message(err));context=null;}}
    finally{setBusy(false);}
  };
  $('saGrade').onchange=()=>refreshClasses(classes);
  $('saTeacher').onchange=()=>{if(!busy)load();};
  $('saReportKind').onchange=()=>{if(activeSheet)paintReports();};
  $('saFilters').onsubmit=event=>{event.preventDefault();if(!busy)load();};
  function schoolDates(from,to){
    const dates=[];
    const cursor=new Date(from+'T00:00:00Z');
    if(!Number.isFinite(cursor.getTime())||from>to)return dates;
    for(let day=cursor.toISOString().slice(0,10);day<=to;day=cursor.toISOString().slice(0,10)){
      if(cursor.getUTCDay()<=4)dates.push(day);
      cursor.setUTCDate(cursor.getUTCDate()+1);
    }
    return dates;
  }
  async function weekModeMap(){
    if(!root.WeekModes)return {};
    try{
      const result=await db.collection('weekModes').get(),map={};
      result.docs.forEach(doc=>{map[doc.id]=doc.data();});
      return map;
    }catch{return {};}
  }
  function dayModeOf(map,date){
    if(!root.WeekModes)return 'remote';
    const day=new Date(date+'T00:00:00Z'),weekday=day.getUTCDay();
    day.setUTCDate(day.getUTCDate()-weekday);
    return root.WeekModes.dayMode(map,day.toISOString().slice(0,10),weekday);
  }
  const modeNames={holiday:'إجازة',onsite:'حضوري'};
  async function recordsForRange(from,to,teacher){
    const collection=db.collection('studentAttendance');
    if(!teacher){
      const result=await collection.where('date','>=',from).where('date','<=',to).get();
      return result.docs.map(doc=>doc.data());
    }
    const dates=schoolDates(from,to),records=[];
    for(let i=0;i<dates.length;i+=7){
      const pages=await Promise.all(dates.slice(i,i+7).map(date=>collection.where('teacher','==',teacher).where('date','==',date).get()));
      for(const page of pages)for(const doc of page.docs)records.push(doc.data());
    }
    return records;
  }
  const scheduleSlots=navigation?.slots||(typeof SLOTS!=='undefined'?SLOTS:[]);
  const scheduleColumns=(scheduleSlots.length?scheduleSlots:periods.map(period=>[period])).map(([name,start,end],index)=>({
    period:index+1,label:'الحصة '+name,time:start&&end?start+' – '+end:''
  }));
  function periodMetrics(record){
    if(!record)return null;
    const values=counts(record.students),total=record.students.length;
    const slots=navigation?.slots||(typeof SLOTS!=='undefined'?SLOTS:[]);
    const cutoff=slots[record.period-1]?.[1];
    const minutes=time=>{const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time||'');return match?Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0):null;};
    const start=minutes(cutoff);
    const entries=record.students.filter(row=>row.status==='present').map(row=>minutes(/(?:^|[ T])(\d{1,2}:\d{2}(?::\d{2})?)/.exec(row.entry||'')?.[1]));
    const late=start!==null&&entries.every(entry=>entry!==null)?entries.filter(entry=>entry>start).length:null;
    return {...values,total,late};
  }
  function combineMetrics(values){
    const active=values.filter(Boolean);
    if(!active.length)return null;
    return active.reduce((total,item)=>({
      present:total.present+item.present,absent:total.absent+item.absent,total:total.total+item.total,
      late:total.late===null||item.late===null?null:total.late+item.late
    }),{present:0,absent:0,total:0,late:0});
  }
  function scheduleTable(title,items,records,columns){
    const metrics=new Map();
    for(const record of records){
      const key=record.classId+'|'+record.period;
      metrics.set(key,combineMetrics([metrics.get(key),periodMetrics(record)]));
    }
    const valuesFor=c=>columns.map(col=>metrics.get(c.id+'|'+col.period));
    const metricCell=value=>value?'<td class="sa-period-metrics"><b>ح '+value.present+' · غ '+value.absent+'</b>'+
      '<small>'+(value.total?Math.round(value.present*100/value.total)+'%':'—')+(value.late==null?'':' · ت '+value.late)+'</small></td>':'<td>—</td>';
    const row=(label,count,values,total=false)=>'<tr'+(total?' class="sa-total"':'')+'><th scope="row">'+escape(label)+'</th><td>'+count+'</td>'+
      values.map(metricCell).join('')+metricCell(combineMetrics(values))+'</tr>';
    const body=grades.slice(1).map((label,i)=>{
      const group=items.filter(c=>c.grade===i+1);
      if(!group.length)return '';
      const rows=group.map(c=>row(c.label,c.count,valuesFor(c))).join('');
      if(group.length===1)return rows;
      const subtotals=columns.map((_,position)=>combineMetrics(group.map(c=>valuesFor(c)[position])));
      return rows+row(label,group.reduce((sum,c)=>sum+c.count,0),subtotals,true);
    }).join('');
    const heading=columns.map(col=>'<th scope="col">'+escape(col.label)+(col.time?'<small>'+escape(col.time)+'</small>':'')+'</th>').join('');
    return '<div class="sa-grid"><table aria-label="ملخص حضور الفصول"><caption>'+escape(title)+'</caption><thead>'+
      '<tr><th scope="col">الفصل</th><th scope="col">عدد الطلاب</th>'+heading+'<th scope="col">المجموع</th></tr>'+
      '</thead><tbody>'+body+'</tbody></table></div>';
  }
  function classSheet(c,records,date,columns){
    const matrix=new Map(c.roster.map(student=>[student.id,{name:student.name,status:new Map()}]));
    for(const record of records){
      for(const student of record.students){
        if(!matrix.has(student.id))matrix.set(student.id,{name:student.name,status:new Map()});
        matrix.get(student.id).status.set(record.period,student.status);
      }
    }
    const edit=(period,label,student='')=>'<button type="button" data-sa-class="'+escape(c.id)+'" data-sa-period="'+period+'" data-sa-date="'+date+'" data-sa-student="'+escape(student)+'">'+escape(label)+'</button>';
    const columnsHead=columns.map(col=>'<th scope="col">'+(context.edit?edit(col.period,col.label):escape(col.label))+'</th>').join('');
    const rows=[...matrix].map(([id,student])=>'<tr><th class="sa-student-name" scope="row">'+escape(student.name)+'</th>'+
      columns.map(col=>{
        const key=student.status.get(col.period)||'unmarked';
        const label=labels[key]||labels.unmarked;
        return '<td class="sa-'+escape(key)+'">'+(context.edit?edit(col.period,label,id):'<span class="sa-cell">'+escape(label)+'</span>')+'</td>';
      }).join('')+'</tr>').join('');
    return '<details'+($('saClass').value||$('saGrade').value?' open':'')+'><summary>'+escape(c.label)+' · '+matrix.size+' طالبًا</summary>'+
      (rows?'<div class="sa-grid"><table><thead><tr><th scope="col">اسم الطالب</th>'+columnsHead+'</tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>لا توجد أسماء طلاب لهذه الشعبة.</p>')+'</details>';
  }
  function dailyClasses(book,date,items,columns){
    const daily=book.records.filter(record=>record.date===date);
    return items.filter(c=>context.edit||daily.some(record=>record.classId===c.id))
      .map(c=>classSheet(c,daily.filter(record=>record.classId===c.id),date,columns)).join('')||
      '<p>لا توجد سجلات مطابقة لهذا التاريخ.</p>';
  }
  function paintSheet(keepEditor=false){
    const book=activeSheet;if(!book)return;
    paintReports();
    if(!keepEditor){$('saBody').textContent='';draft=null;}
    const opened=new Set([...$('saSheet').querySelectorAll('details[data-sa-day][open]')].map(row=>row.dataset.saDay));
    const byClass=new Map();
    for(const record of book.records){
      if(!byClass.has(record.classId))byClass.set(record.classId,[]);
      byClass.get(record.classId).push(record);
    }
    const items=book.items.filter(c=>context.edit||byClass.has(c.id)).map(c=>{
      const records=byClass.get(c.id)||[];
      const roster=book.rosters.get(c.id)||[];
      const students=new Set([...roster.map(s=>s.id),...records.flatMap(r=>r.students.map(s=>s.id))]);
      return {...c,roster,count:students.size};
    });
    const columns=book.period?scheduleColumns.filter(col=>col.period===book.period):scheduleColumns;
    const title='من '+book.from+' إلى '+book.to;
    const names=book.dates.length===1?dailyClasses(book,book.dates[0],items,columns):
      book.dates.filter(date=>context.edit||book.records.some(record=>record.date===date)).map(date=>
        '<details data-sa-day="'+date+'"'+(opened.has(date)?' open':'')+'><summary>'+date+'</summary><div></div></details>').join('');
    $('saSheet').innerHTML=items.length?'<h3>إجمالي الفصول للفترة</h3>'+
      '<p>ح: حاضر · غ: غائب · ت: متأخر. الأعداد تجمع حالات الطلاب في الحصص المرصودة.</p>'+
      scheduleTable(title,items,book.records,columns)+'<h3>سجل الطلاب بالأسماء</h3>'+
      (context.edit?'<p>افتح الحصة داخل الشعبة لتسجيل الحضور أو استيراد كشف فيوكلاس.</p>':'')+
      names:'<p>لا توجد سجلات مطابقة في الفترة المحددة.</p>';
    for(const day of $('saSheet').querySelectorAll('details[data-sa-day]')){
      const fill=()=>{
        const content=day.lastElementChild;
        if(day.open&&!content.hasChildNodes())content.innerHTML=dailyClasses(book,day.dataset.saDay,items,columns);
      };
      day.addEventListener('toggle',fill);
      fill();
    }
    const records=studentTotals(book.records);
    $('saPeriodTotals').innerHTML=records.length?'<details><summary>إجمالي حضور الطلاب وغيابهم للفترة المحددة</summary><div class="sa-grid"><table>'+
      '<thead><tr><th>اسم الطالب</th><th>الفصل</th><th>حاضر</th><th>غائب</th><th>غير مرصود</th></tr></thead><tbody>'+
      records.map(row=>'<tr><th class="sa-student-name" scope="row">'+escape(row.name)+'</th><td>'+escape([...row.classes].join('، '))+'</td><td>'+row.present+'</td><td>'+row.absent+'</td><td>'+row.unmarked+'</td></tr>').join('')+
      '</tbody></table></div></details>'+rollup(book.records,'subject','المادة')+rollup(book.records,'teacher','المعلم'):'';
  }
  function paintReports(){
    const book=activeSheet,host=$('saReports');if(!book||!host)return;
    const rosterMap=new Map(book.rosters);
    for(const c of book.items)if(!rosterMap.has(c.id))rosterMap.set(c.id,[]);
    const expected=(classId,date)=>{
      const grade=gradeOf(classId),section=Number(classId.split('-s')[1]);
      const group=grade===3?(section===10?'ba':section===9?'cs':'c3'):'c'+grade;
      const day=new Date(date+'T00:00:00Z').getUTCDay();
      const sessions=(app?.S||[]).filter(row=>row.day===day&&row.cls===group);
      const onsiteDay=book.modes&&book.onsiteLessons?.length&&dayModeOf(book.modes,date)==='onsite';
      const periods=onsiteDay?book.onsiteLessons.filter(l=>l.classId===classId&&Number(l.day)===day).map(l=>Number(l.period)):sessions.map(row=>row.slot+1);
      if(!app?.S?.length)periods.push(...scheduleColumns.map(column=>column.period));
      // Include saved lessons when their schedule changed after attendance was recorded.
      for(const record of book.dailyRecords||book.records)if(record.classId===classId&&record.date===date&&!periods.includes(record.period))periods.push(record.period);
      return [...new Set(periods)];
    };
    const days=dailyAttendance(book.dailyRecords||book.records,rosterMap,book.dates,expected),totals=attendanceDays(days);
    const kind=tab==='absence'?'absence':$('saReportKind').value;
    const cardDay=book.dates.includes(book.to)?book.to:book.dates[book.dates.length-1],dayRows=days.filter(row=>row.date===cardDay);
    const toMode=book.skipped?.get(book.to);
    const lessonsDay=(book.dailyRecords||book.records).filter(record=>record.date===cardDay).length;
    const card=(count,label,tone,target)=>'<button type="button" class="sa-card '+tone+'" data-sa-goto="'+target+'"><b>'+count+'</b><span>'+escape(label)+'</span></button>';
    $('saCards').innerHTML='<p class="sa-cards-title">'+(toMode?'يوم '+escape(book.to)+' '+escape(modeNames[toMode]||toMode)+' ولا يُحتسب في رصد الحضور عن بُعد · ملخص آخر يوم دراسي '+escape(cardDay):'ملخص يوم '+escape(cardDay))+(book.skipped?.size?' · استُبعد من الفترة '+book.skipped.size+(book.skipped.size>=3&&book.skipped.size<=10?' أيام':' يومًا')+' (إجازة أو حضوري)':'')+'</p>'+
      card(dayRows.length,'طالبًا مطلوب رصدهم','','record')+
      card(dayRows.filter(row=>row.status==='present').length,'حاضرون','ok','record')+
      card(dayRows.filter(row=>row.status==='absent').length,'غائبون اليوم كاملًا','bad','absence')+
      card(dayRows.filter(row=>row.status!=='absent'&&row.absentLessons>0).length,'غياب جزئي عن حصص','warn','absence')+
      card(dayRows.filter(row=>row.status==='unmarked').length,'غير مكتمل الرصد','warn','record')+
      card(lessonsDay,'حصة مرصودة','','record');
    const className=id=>book.items.find(c=>c.id===id)?.label||id;
    const table=(head,body)=>'<div class="sa-grid"><table><thead><tr>'+head.map(x=>'<th>'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
    const cells=values=>'<tr>'+values.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>';
    const students=table(['الطالب','الفصل','أيام الحضور','أيام الغياب الكامل','أيام غير مكتملة الرصد'],totals.map(row=>cells([row.name,[...row.classes].map(className).join('، '),row.present,row.absent,row.unmarked])).join(''));
    const dailyRows=book.dates.map(date=>{const rows=days.filter(row=>row.date===date);return cells([date,rows.length,rows.filter(row=>row.status==='present').length,rows.filter(row=>row.status==='absent').length,rows.filter(row=>row.status==='unmarked').length]);}).join('');
    const daily=table(['التاريخ','عدد الطلاب','حاضر خلال اليوم','غائب اليوم كاملًا','غير مكتمل الرصد'],dailyRows);
    const ranking=table(['الصف','المعلم','الحصص المرصودة','حالات الحضور','حالات الغياب','غير مرصود','نسبة الحضور'],teacherRanking(book.records).map(row=>cells([grades[row.grade]||'—',root.StaffSettings?.displayName(row.teacher)||row.teacher,row.lessons,row.present,row.absent,row.unmarked,row.rate===null?'—':(row.rate*100).toFixed(1)+'%'])).join(''));
    const reportDate=cardDay;
    const level=count=>count>=20?['l3','20 يومًا فأكثر: إحالة إلى لجنة التوجيه والإرشاد']:count>=10?['l2','10 أيام: إنذار واستدعاء ولي الأمر']:count>=5?['l1','5 أيام: تنبيه أول والتواصل مع ولي الأمر']:null;
    const escalated=totals.filter(row=>level(row.absent));
    const escalation='<h3>متابعة الغياب المتراكم للفترة</h3><p>تُحسب أيام الغياب الكامل خلال الفترة المختارة. اختر «هذا الشهر» أو فترة أطول لمتابعة التراكم.</p>'+
      (escalated.length?table(['الطالب','الفصل','أيام الغياب الكامل','الإجراء المقترح'],escalated.map(row=>{const [tone,text]=level(row.absent);return '<tr><td>'+escape(row.name)+'</td><td>'+escape([...row.classes].map(className).join('، '))+'</td><td>'+row.absent+'</td><td><span class="sa-level '+tone+'">'+escape(text)+'</span></td></tr>';}).join('')):'<p>لا يوجد طلاب بلغوا 5 أيام غياب كامل في الفترة المختارة.</p>');
    const todayRows=days.filter(row=>row.date===reportDate&&row.absentLessons>0);
    const absent=table(['الطالب','الفصل','حصص الغياب','حالة اليوم','إشعار ولي الأمر'],todayRows.map(row=>{
      const text='ولي أمر الطالب '+row.name+'، السلام عليكم ورحمة الله. نحيطكم برصد غياب الطالب عن '+row.absentLessons+' حصة بتاريخ '+reportDate+' في ثانوية الصحافة الأهلية. نأمل التواصل مع المدرسة وبيان العذر. شكرًا لتعاونكم.';
      const link=guardianLink(row.guardianPhone||'',text);
      return '<tr><td>'+escape(row.name)+'</td><td>'+escape(className(row.classId))+'</td><td>'+row.absentLessons+' / '+row.expected+'</td><td>'+escape(row.status==='absent'?'غائب اليوم كاملًا':row.status==='present'?'حضر بعض الحصص':'بانتظار اكتمال الرصد')+'</td><td>'+(link?'<a target="_blank" rel="noopener noreferrer" href="'+escape(link)+'">إرسال رسالة واتساب لولي الأمر</a>':'جوال ولي الأمر غير مسجّل')+'</td></tr>';
    }).join(''));
    host.innerHTML='<h3>تقارير الطلاب للفترة '+escape(book.from)+' إلى '+escape(book.to)+'</h3><p>يحسب حضور اليوم من حضور حصة واحدة على الأقل، ويحسب غياب اليوم الكامل بعد رصد كل الحصص المطلوبة بالغياب. المتأخرون ضمن الحضور. الأيام غير المكتملة تحتاج استكمال الرصد. إحصاءات الأيام تشمل جميع حصص الطالب، وفلاتر المعلم والحصة تطبق على ترتيب المعلمين وسجل الحصص.</p><div class="sa-actions"><button type="button" id="saReportPrint">طباعة التقارير / حفظ PDF</button><button type="button" id="saReportExport">تنزيل التقارير Excel (CSV)</button></div>'+
      ((kind==='all'||kind==='students')?'<h3>سجل أيام حضور وغياب كل طالب</h3>'+students:'')+
      (kind==='absence'?'<h3>غياب يوم '+escape(reportDate)+'</h3><p>طلاب رُصد لهم غياب في حصة واحدة على الأقل: '+todayRows.length+' · غياب اليوم الكامل: '+todayRows.filter(row=>row.status==='absent').length+'</p>'+absent+escalation:'')+
      ((kind==='all'||kind==='daily')?'<h3>تقرير الحضور والغياب اليومي</h3>'+daily:'')+
      ((kind==='all'||kind==='teachers')?'<h3>أعلى المعلمين حضورًا للطلاب لكل صف</h3><p>الترتيب حسب نسبة الحضور من الحالات المرصودة في الحصص، وتطبق فلاتر الصف والشعبة والحصة والمعلم.</p>'+ranking:'');
    for(const heading of host.querySelectorAll('h3')){
      const next=heading.nextElementSibling;
      const grid=next?.matches('.sa-grid')?next:next?.nextElementSibling;
      if(!grid?.matches('.sa-grid'))continue;
      const share=document.createElement('button');
      share.type='button';
      share.textContent='مشاركة التقرير عبر واتساب';
      share.onclick=()=>{
        const rows=[...grid.querySelectorAll('tr')].map(row=>[...row.cells].map(cell=>cell.querySelector('a')?'':cell.textContent.trim()).filter(Boolean).join(' | '));
        const report=[heading.textContent,book.from+' إلى '+book.to,...rows].join('\n');
        if(encodeURIComponent(report).length>3500){
          const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));
          const link=document.createElement('a');
          link.href=url;link.download=heading.textContent+'.txt';link.click();
          setTimeout(()=>URL.revokeObjectURL(url),1000);
          root.open('https://wa.me/?text='+encodeURIComponent(heading.textContent+' — '+book.from+' إلى '+book.to),'_blank','noopener');
          status('نُزّل التقرير كاملًا. أرفق الملف في محادثة واتساب.');
          return;
        }
        root.open('https://wa.me/?text='+encodeURIComponent(report),'_blank','noopener');
      };
      heading.insertAdjacentElement('afterend',share);
    }
    $('saReportPrint').onclick=()=>{
      if(root.ReportKit){if(!root.ReportKit.open({title:'تقارير حضور الطلاب',subtitle:'من '+book.from+' إلى '+book.to,body:host.innerHTML,landscape:true}))status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');return;}
      const printWindow=root.open('','_blank');
      if(!printWindow){status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');return;}
      printWindow.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقارير حضور الطلاب</title><style>body{font:14px Tahoma,Arial;direction:rtl;padding:20px}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #999;padding:7px;text-align:right}th{background:#e8f2ed}h3{margin-top:24px}button,.sa-actions,a{display:none}@page{size:A4 landscape;margin:12mm}</style></head><body>'+host.innerHTML+'</body></html>');
      printWindow.document.close();printWindow.focus();printWindow.print();
    };
    $('saReportExport').onclick=()=>{
      const rows=[...host.querySelectorAll('h3,table tr')].map(el=>el.tagName==='H3'?[el.textContent]:[...el.children].map(cell=>cell.textContent));
      const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value).replace(/^[=+@-]/,"'\$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const link=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      link.href=url;link.download='تقارير-حضور-الطلاب-'+book.from+'-'+book.to+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  function rollup(records,key,label){
    return '<details><summary>ملخص حضور وغياب الطلاب حسب '+label+'</summary><div class="sa-grid"><table>'+
      '<thead><tr><th>'+label+'</th><th>سجلات الحصص</th><th>حاضر</th><th>غائب</th><th>غير مرصود</th><th>نسبة الحضور من الحالات المرصودة</th></tr></thead><tbody>'+
      lessonTotals(records,key).map(row=>{
        const name=key==='teacher'?(root.StaffSettings?.displayName(row.name)||row.name):row.name;
        const marked=row.present+row.absent;
        return '<tr><th scope="row">'+escape(name)+'</th><td>'+row.lessons+'</td><td>'+row.present+'</td><td>'+row.absent+'</td><td>'+row.unmarked+'</td><td>'+
          (marked?Math.round(row.present*100/marked)+'%':'—')+'</td></tr>';
      }).join('')+'</tbody></table></div></details>';
  }
  $('saResults').onclick=event=>{
    const control=event.target.closest('[data-sa-class]');
    if(!control||!context?.edit||busy)return;
    openLesson(control.dataset.saDate,control.dataset.saClass,Number(control.dataset.saPeriod),control.dataset.saStudent);
  };
  async function load(){
    if(!context||context.uid!==auth.currentUser?.uid)return;
    const from=$('saFrom').value,to=$('saTo').value;
    if(!from||!to||from>to||to>today()){status('اختر فترة صحيحة حتى تاريخ اليوم.');return;}
    const period=Number($('saPeriod').value),grade=Number($('saGrade').value),classId=$('saClass').value;
    clear();
    const token=sequence,actor=context;
    const dateList=schoolDates(from,to);
    if(!dateList.length){status('لا توجد أيام دراسية في الفترة المحددة.');return;}
    setBusy(true);status('جارٍ تحميل السجل…');
    try{
      const [records,modes]=await Promise.all([recordsForRange(from,to,actor.teacher),weekModeMap()]);
      // Count only remote school days; holiday and onsite days stay only when lessons were recorded on them.
      const skipped=new Map();
      for(const date of [...dateList]){
        const mode=dayModeOf(modes,date);
        if(mode!=='remote'&&!records.some(record=>record.date===date)){skipped.set(date,mode);dateList.splice(dateList.indexOf(date),1);}
      }
      if(token!==sequence)return;
      let onsiteLessons=[];
      if(dateList.some(date=>dayModeOf(modes,date)==='onsite')){
        try{onsiteLessons=(await db.doc('config/subs-onsite-data').get()).data()?.lessons||[];}catch{onsiteLessons=[];}
        if(token!==sequence)return;
      }
      if(!dateList.length){status('الفترة المحددة لا تحتوي أيام تعليم عن بُعد (إجازة أو حضوري)، فلا يوجد رصد لعرضه.');return;}
      if(token!==sequence)return;
      if(!actor.edit){
        classes=[...new Map(records.map(record=>[record.classId,{id:record.classId,grade:gradeOf(record.classId),section:Number(record.classId.split('-s')[1])}])).values()].sort(classOrder);
        refreshClasses(classes);
      }
      const items=classes.filter(c=>(!grade||c.grade===grade)&&(!classId||c.id===classId))
        .map(c=>({...c,label:grades[c.grade]+' '+c.grade+String(c.section).padStart(2,'0')}));
      let teacher=$('saTeacher').value;
      const teachers=[...new Set(records.map(record=>record.teacher))].sort((a,b)=>a.localeCompare(b,'ar'));
      $('saTeacher').innerHTML='<option value="">الجميع</option>'+teachers.map(name=>'<option value="'+escape(name)+'">'+escape(root.StaffSettings?.displayName(name)||name)+'</option>').join('');
      if(!teachers.includes(teacher))teacher='';
      $('saTeacher').value=teacher;
      const selected=records.filter(record=>(!period||record.period===period)&&(!grade||gradeOf(record.classId)===grade)&&(!classId||record.classId===classId)&&(!teacher||record.teacher===teacher));
      const rosters=new Map();
      if(actor.edit){
        const snapshots=await Promise.all(items.map(c=>db.doc('config/onsite-students-'+c.id).get()));
        items.forEach((c,index)=>rosters.set(c.id,(snapshots[index].data()?.students||[]).map(s=>({id:s.id,name:s.name,guardianPhone:s.guardianPhone||''}))));
      }
      if(token!==sequence)return;
      const dailyRecords=records.filter(record=>(!grade||gradeOf(record.classId)===grade)&&(!classId||record.classId===classId));
      activeSheet={records:selected,dailyRecords,items,rosters,period,teacher,from,to,dates:dateList,skipped,modes,onsiteLessons};
      $('saResults').innerHTML='<div id="saSheet"></div><div id="saPeriodTotals"></div>';
      paintSheet();
      status('');
    }catch(err){if(token===sequence)status(message(err));}
    finally{setBusy(false);}
  }
  async function openLesson(date,classId,period,studentId){
    if(!context?.edit||!manager())return;
    const c=classes.find(item=>item.id===classId);
    if(!c||!period)return;
    const token=++sequence;
    draft=null;$('saBody').textContent='';
    setBusy(true);status('جارٍ تحميل سجل الحصة…');
    try{
      const ref=db.doc('studentAttendance/'+date+'_'+c.id+'_p'+period);
      const sunday=new Date(date+'T00:00:00Z');
      sunday.setUTCDate(sunday.getUTCDate()-sunday.getUTCDay());
      const week=sunday.toISOString().slice(0,10);
      const [roster,previous,subs]=await Promise.all([db.doc('config/onsite-students-'+c.id).get(),ref.get(),db.doc('config/subs-'+week).get()]);
      if(token!==sequence)return;
      const old=previous.data()||{},ready=new Map((old.students||[]).map(row=>[row.id,row]));
      const phones=new Map();
      for(const student of roster.data()?.students||[]){
        phones.set(student.id,student.guardianPhone||'');
        if(!ready.has(student.id))ready.set(student.id,{id:student.id,name:student.name,status:'unmarked',entry:''});
      }
      const mode=dayModeOf(await weekModeMap(),date);
      if(token!==sequence)return;
      if(mode==='holiday')throw Error('هذا اليوم إجازة حسب إعداد الأسبوع، فلا يوجد رصد.');
      let sessions;
      if(mode==='onsite'){
        // Onsite days use the onsite timetable (config/subs-onsite-data).
        const onsite=(await db.doc('config/subs-onsite-data').get()).data()?.lessons||[];
        if(token!==sequence)return;
        const weekday=new Date(date+'T00:00:00Z').getUTCDay();
        sessions=onsite.filter(l=>l.classId===c.id&&Number(l.day)===weekday&&Number(l.period)===period)
          .map((l,i)=>({id:'onsite-'+c.id+'-d'+weekday+'-p'+period+'-'+i,cls:'onsite',subj:String(l.subject||''),teacher:String(l.scheduleName||l.teacher||'')}))
          .filter(l=>l.subj&&l.teacher);
      }else sessions=remoteSessions(app.S,date,c.grade,period,subs.data()?.map);
      if(!sessions.length)throw Error(mode==='onsite'?'لا توجد حصة لهذه الشعبة في الجدول الحضوري في هذا اليوم والحصة.':'لا توجد حصة مطابقة في جدول المنصة عن بُعد لهذا اليوم والفصل.');
      draft={ref,date,c,period,phones,sessions,mode,students:[...ready.values()],teacher:old.teacher||'',subject:old.subject||'',revision:old.revision||0};
      renderEditor();
      $('saBody').scrollIntoView({block:'start'});
      status(draft.students.length?'':'لا توجد أسماء طلاب لهذه الشعبة.');
      const studentIndex=draft.students.findIndex(student=>student.id===studentId);
      if(studentIndex>=0){
        setBusy(false);
        $('saStudents').querySelector('[data-sa-index="'+studentIndex+'"]')?.focus();
      }
    }catch(err){if(token===sequence)status(message(err));}
    finally{setBusy(false);}
  }
  function renderEditor(){
    const current=draft;
    const groups={onsite:'حضوري',c1:'الأول الثانوي',c2:'الثاني الثانوي',c3:'الثالث الثانوي',ba:'إدارة الأعمال',cs:'الحاسب والهندسة'};
    const fromRecord=current.sessions.find(lesson=>lesson.teacher===current.teacher&&lesson.subj===current.subject);
    const selected=fromRecord?.id||(current.sessions.length===1?current.sessions[0].id:'');
    $('saBody').innerHTML='<section id="saStudentEditor"><div class="sa-actions"><h3>'+escape(classLabel(current.c)+' · '+current.date+' · الحصة '+periods[current.period-1])+'</h3><button id="saBackToSheet" type="button">العودة إلى سجل الطلاب</button></div>'+
      '<form id="saEdit"><label>الحصة حسب '+(current.mode==='onsite'?'الجدول الحضوري':'جدول عن بُعد')+'<select id="saSession" required><option value="">اختر الحصة أو المسار</option>'+
      current.sessions.map(lesson=>'<option '+(lesson.id===selected?'selected ':'')+'value="'+escape(lesson.id)+'">'+escape(groups[lesson.cls]+' · '+lesson.subj+' · '+(root.StaffSettings?.displayName(lesson.teacher)||lesson.teacher))+'</option>').join('')+
      '</select></label>'+
      '<div class="sa-actions"><label>كشف الحضور من فيوكلاس<input type="file" accept=".xlsx,.xls,.csv" id="saReport"></label><button type="button" id="saPreview">معاينة كشف الحضور</button></div>'+
      '<div id="saReportPreview"></div><p id="saTotals">'+escape(summary(current.students))+'</p><table><thead><tr><th>الطالب</th><th>الحالة</th><th>وقت الحضور</th></tr></thead><tbody id="saStudents"></tbody></table>'+
      '<div class="sa-actions"><button id="saSave" type="submit">حفظ الحضور والغياب</button><button id="saNotice" type="button">تجهيز إشعارات الغياب</button></div></form><div id="saNotices"></div></section>';
    $('saBackToSheet').onclick=()=>{
      $('saBody').textContent='';draft=null;status('');
      $('saResults').scrollIntoView({block:'start'});
    };
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
      const record={date:current.date,classId:current.c.id,classLabel:classLabel(current.c),period:current.period,
        teacher,subject,students:current.students.map(row=>({...row})),revision:current.revision+1};
      setBusy(true);
      try{
        await db.runTransaction(async tx=>{
          const previous=await tx.get(current.ref);
          if((previous.data()?.revision||0)!==current.revision)throw Error('تغيّر السجل في جلسة أخرى. أعد عرضه قبل الحفظ.');
          tx.set(current.ref,{...record,updatedBy:uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        });
        if(draft===current){
          current.revision=record.revision;current.teacher=teacher;current.subject=subject;current.dirty=false;
          if(activeSheet){
            activeSheet.records=activeSheet.records.filter(row=>row.date!==record.date||row.classId!==record.classId||row.period!==record.period);
            activeSheet.records.push(record);
            activeSheet.dailyRecords=(activeSheet.dailyRecords||[]).filter(row=>row.date!==record.date||row.classId!==record.classId||row.period!==record.period);
            activeSheet.dailyRecords.push(record);
            paintSheet(true);
          }
          status('تم حفظ الحضور والغياب.');
        }
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
  function mountBatchAttendance(){
    const box=document.createElement('details');
    box.hidden=true;box.id='saBatchBox';box.open=true;
    box.innerHTML='<summary>استيراد دفعة كشوف فيوكلاس</summary><p>لتحديث قوائم الطلاب وأرقام أولياء الأمور: <button type="button" id="saRosterOpen">مطابقة قوائم فيوكلاس</button></p><label>كشوف الحصص<textarea id="saBatchInput" rows="4" dir="ltr"></textarea></label>'+
      '<div class="sa-actions"><button type="button" id="saBatchPreview">مطابقة الكشوف</button><button type="button" id="saBatchSave" hidden>حفظ الرصد المطابق</button></div><p id="saBatchStatus" role="status"></p>';
    $('saFilters').after(box);
    $('saRosterOpen').onclick=()=>{const dialog=document.getElementById('viewClassRosterSync');if(dialog&&manager()&&!dialog.open)dialog.showModal();};
    setInterval(()=>{const hidden=!manager()||tab!=='import';if(box.hidden!==hidden)box.hidden=hidden;},500);
    const input=box.querySelector('textarea'),preview=$('saBatchPreview'),save=$('saBatchSave'),output=$('saBatchStatus');
    let matched=[],working=false;
    const reset=()=>{save.hidden=true;matched=[];output.textContent='';};
    input.oninput=reset;
    const lock=value=>{working=value;input.disabled=preview.disabled=save.disabled=value;};
    const words=titleWords;
    const squash=value=>words(value).replace(/\s+/g,'');
    const aliases={
      'محمود عبود':['محمود محمد الرفاعي','محمود الرفاعي'],
      'أحمد حفني':['احمد الدوله','احمد الدولة'],
      'موسى العطو':['موسى الحمد','موسى حمد العطو'],
      'تامر شعيشع':['تامر محمد محمد السيد']
    };
    const subjectAliases={'لفظي':['قدرات لفظية','القدرات اللفظية'],'كمي':['قدرات كمية','القدرات الكمية'],'كفايات':['الكفايات اللغوية'],'انجليزي':['اللغة الإنجليزية'],'علم أرض':['علوم الأرض والفضاء','علوم الارض والفضاء'],'تحصيلي فيزياء':['فيزياء تحصيلي'],'تحصيلي كيمياء':['كيمياء تحصيلي'],'تحصيلي أحياء':['أحياء تحصيلي'],'تحصيلي رياضيات':['رياضيات تحصيلي']};
    function evidence(title,subjectOnly,lesson){
      const raw=squash(title);
      const teacher=lesson.teacher;
      const people=[teacher,root.StaffSettings?.displayName(teacher),...(aliases[teacher]||[])].filter(Boolean);
      const teacherHit=people.some(name=>{
        const tokens=words(name).split(' ').filter(word=>word.length>1);
        return tokens.length>=2&&(raw.includes(tokens.join(''))||tokens.every(word=>words(title).split(' ').includes(word)));
      });
      const subjects=[lesson.subj,...(subjectAliases[lesson.subj]||[])];
      if(teacherHit)return subjects.some(subject=>squash(subject).length>=2&&raw.includes(squash(subject)));
      const courseKey=value=>words(value).replace(/\s+[1-3]$/,'').split(' ').map(word=>word.replace(/^ال/,'')).join('');
      return Boolean(subjectOnly)&&subjects.some(subject=>courseKey(subjectOnly)===courseKey(subject));
    }
    preview.onclick=async()=>{
      if(working||!manager())return;
      reset();lock(true);
      try{
        const source=JSON.parse(input.value);
        if(!Array.isArray(source)||!source.length||source.length>1000)throw Error('أدخل دفعة صالحة من كشوف الحصص.');
        const registry=(await db.doc('config/onsite-classes').get()).data()?.classes||{};
        const rosters=new Map(),weeks=new Map(),pending=new Map(),conflicts=new Set();
        let review=0,missing=0;
        for(const [date,,title,rows] of source){
          if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today()||!Array.isArray(rows)||typeof title!=='string'){review++;continue;}
          const {period,subject}=titleSlot(title);
          const day=new Date(date+'T00:00:00Z');
          if(!period||!Number.isFinite(day.getTime())||day.getUTCDay()>4){review++;continue;}
          day.setUTCDate(day.getUTCDate()-day.getUTCDay());
          const week=day.toISOString().slice(0,10);
          if(!weeks.has(week))weeks.set(week,(await db.doc('config/subs-'+week).get()).data()?.map||{});
          const groups=new Map();
          for(const row of rows){
            const classId=reportClass(row[3]);
            if(!classId)continue;
            if(!groups.has(classId))groups.set(classId,[]);
            groups.get(classId).push([row[0],row[3],row[5],row[4]]);
          }
          if(!groups.size){review++;continue;}
          for(const [id,entries] of groups){
            const c=registry[id];
            if(!c){review++;continue;}
            const sessions=remoteSessions(app.S,date,c.grade,period,weeks.get(week)).filter(lesson=>evidence(title,subject,lesson));
            if(sessions.length!==1){review++;continue;}
            if(!rosters.has(id))rosters.set(id,(await db.doc('config/onsite-students-'+id).get()).data()?.students||[]);
            const roster=rosters.get(id).map(student=>({id:student.id,name:student.name,status:'unmarked',entry:''}));
            let result;
            try{result=matchReport([['اسم الطالب','الفصل','الحالة','وقت الحضور'],...entries],id,roster,date);}
            catch{review++;continue;}
            missing+=result.unresolved.length;
            if(!result.matched.size){review++;continue;}
            const key=date+'_'+id+'_p'+period;
            const lesson=sessions[0];
            const previous=pending.get(key);
            if(previous||conflicts.has(key)){
              const duplicate=previous?.teacher===lesson.teacher&&previous.subject===lesson.subj&&
                previous.marks.size===result.matched.size&&[...result.matched].every(([studentId,mark])=>{
                  const prior=previous.marks.get(studentId);
                  return prior?.status===mark.status&&prior.entry===mark.entry;
                });
              if(!duplicate){pending.delete(key);conflicts.add(key);review++;}
              continue;
            }
            pending.set(key,{key,date,classId:id,classLabel:classLabel(c),period,teacher:lesson.teacher,subject:lesson.subj,roster,marks:result.matched});
          }
        }
        matched=[...pending.values()];
        output.textContent='المطابق: '+matched.length+' سجل شعبة وحصة. تحتاج مراجعة: '+review+'. أسماء غير مطابقة: '+missing+'.';
        save.hidden=!matched.length;
      }catch(err){output.textContent=message(err);}
      finally{lock(false);}
    };
    save.onclick=async()=>{
      if(working||!manager()||!matched.length)return;
      lock(true);
      const uid=auth.currentUser.uid;
      let saved=0,unchanged=0,failed=0,protectedMarks=0;
      try{
        async function persist(item){
          if(!manager()||auth.currentUser?.uid!==uid)return;
          const ref=db.doc('studentAttendance/'+item.key);
          try{
            const result=await db.runTransaction(async tx=>{
              const old=(await tx.get(ref)).data()||{};
              if(old.revision&&(old.teacher!==item.teacher||old.subject!==item.subject))return {conflicts:1};
              const list=new Map((old.students||[]).map(s=>[s.id,s]));
              let changed=false,conflicts=0;
              for(const row of item.roster){
                const mark=item.marks.get(row.id);
                if(!list.has(row.id))list.set(row.id,{...row});
                if(!mark)continue;
                const current=list.get(row.id);
                if(current.status!=='unmarked'&&current.status!==mark.status){conflicts++;continue;}
                const entry=current.entry||mark.entry;
                if(current.status===mark.status&&current.entry===entry)continue;
                list.set(row.id,{...current,status:mark.status,entry});
                changed=true;
              }
              if(!changed)return {conflicts};
              tx.set(ref,{date:item.date,classId:item.classId,classLabel:item.classLabel,period:item.period,
                teacher:item.teacher,subject:item.subject,students:[...list.values()],revision:(old.revision||0)+1,
                updatedBy:uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
              return {saved:true,conflicts};
            });
            if(result.saved)saved++;else unchanged++;
            protectedMarks+=result.conflicts;
          }catch{failed++;}
          output.textContent='حُفظ '+saved+' · دون تغيير '+unchanged+' · تعذّر '+failed+' · تعارضات محفوظة '+protectedMarks;
        }
        for(let i=0;i<matched.length;i+=10){
          if(!manager()||auth.currentUser?.uid!==uid)break;
          await Promise.all(matched.slice(i,i+10).map(persist));
        }
        save.hidden=true;
      }finally{lock(false);}
    };
  }
  function mountRosterSync(){
    const sync=document.createElement('button');
    sync.type='button';sync.className='btn ghost';sync.hidden=true;
    sync.textContent='مطابقة قوائم فيوكلاس';
    (document.querySelector('#schoolGroup-people .school-nav-links')||document.querySelector('.views'))?.append(sync);
    const panel=document.createElement('dialog');
    panel.id='viewClassRosterSync';
    panel.style.cssText='direction:rtl;width:min(750px,calc(100vw - 30px));max-height:85vh;border-radius:14px;padding:20px';
    panel.innerHTML='<h2>مطابقة قوائم فيوكلاس</h2><p>الصق الأعمدة بالترتيب: الاسم، رمز الشعبة، السجل المدني، جوال ولي الأمر. يمكنك إضافة الاسم السابق في العمود الخامس للمطابقة.</p>'+
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
    const stable=(value)=>{
      if(Array.isArray(value))return value.map(stable);
      if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
      return value;
    };
    async function compute(get,source){
      const registry=(await get(classesRef)).data()?.classes||{};
      const ids=[...new Set([...Object.keys(registry),...source.map(row=>reportClass(row.section))])];
      if(ids.some(id=>!id)||ids.length>100)throw Error('راجع رموز الشعب في الكشف.');
      const docs=await Promise.all(ids.map(id=>get(ref(id))));
      const old=Object.fromEntries(ids.map((id,i)=>[id,docs[i].data()||{}]));
      const fingerprint=JSON.stringify(stable([registry,old]));
      return {old,fingerprint,...rosterPlan(registry,old,source,()=>crypto.randomUUID())};
    }
    const lock=value=>{doing=value;input.disabled=preview.disabled=save.disabled=value;};
    preview.onclick=async()=>{
      if(!manager()||doing)return;
      clear();lock(true);
      try{
        const source=input.value.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
          const [name='',section='',civilId='',guardianPhone='',priorName='']=line.split('\t').map(value=>value.trim());
          return {name,section,civilId,guardianPhone,priorName};
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
