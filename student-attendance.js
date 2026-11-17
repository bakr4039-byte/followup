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
  if(typeof module!=='undefined')module.exports={reportClass,matchReport,guardianLink,remoteSessions,rosterPlan,studentTotals,lessonTotals};
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
  button.dataset.workspaceKey='native';
  (app?document.querySelector('#schoolGroup-followup .school-nav-links')||document.querySelector('.views'):$('account'))?.prepend(button);
  const view=document.createElement('section');
  view.id='studentAttendance';view.hidden=true;view.setAttribute('aria-labelledby','saTitle');
  view.innerHTML='<header><h2 id="saTitle" tabindex="-1">سجل حضور الطلاب</h2><button type="button" id="saClose">العودة</button></header>'+
    '<form id="saFilters"><label>الفترة<select id="saDateMode"><option value="today">اليوم</option><option value="range">من تاريخ إلى تاريخ</option></select></label>'+
    '<label id="saFromLabel" hidden>من تاريخ<input type="date" id="saFrom"></label><label id="saToLabel" hidden>إلى تاريخ<input type="date" id="saTo"></label>'+
    '<label>الصف<select id="saGrade"><option value="">كل الصفوف</option>'+grades.slice(1).map((grade,i)=>'<option value="'+(i+1)+'">'+grade+' بالكامل</option>').join('')+'</select></label>'+
    '<label>الشعبة<select id="saClass"><option value="">كل الشعب</option></select></label>'+
    '<label>الحصة<select id="saPeriod"><option value="">جميع الحصص</option>'+periods.map((period,i)=>'<option value="'+(i+1)+'">'+period+'</option>').join('')+'</select></label>'+
    '<button type="submit">عرض السجل</button></form>'+
    '<p id="saStatus" role="status"></p><div id="saResults"></div><section id="saBody"></section>';
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
    @media print{#saFilters,#saClose,#saStatus,#saStudentEditor,#studentAttendance button{display:none!important}#studentAttendance .sa-grid{overflow:visible}}
  `;
  document.head.append(style);
  if(app)mountRosterSync();
  let classes=[],context=null,sequence=0,busy=false,draft=null,activeSheet=null;
  const status=text=>{$('saStatus').textContent=text;};
  const message=err=>err?.code==='permission-denied'?'حسابك لا يملك صلاحية الوصول إلى هذا السجل.':err?.message||'تعذّر تحميل سجل الحضور.';
  const setBusy=value=>{busy=value;for(const control of view.querySelectorAll('input,select,button:not(#saClose)'))control.disabled=value;};
  const clear=()=>{sequence++;draft=null;activeSheet=null;$('saResults').textContent='';$('saBody').textContent='';status('');};
  const counts=rows=>rows.reduce((n,r)=>{if(Object.hasOwn(n,r.status))n[r.status]++;return n;},{present:0,absent:0,unmarked:0});
  const summary=rows=>{const n=counts(rows);return 'الحضور '+n.present+' · الغياب '+n.absent+' · غير مرصود '+n.unmarked;};
  const close=()=>{
    clear();context=null;view.hidden=true;button.setAttribute('aria-pressed','false');
    navigation?.close();
  };
  $('saClose').onclick=close;
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
    for(const id of ['saFrom','saTo']){$(id).value=today();$(id).max=today();}
    setBusy(true);
    try{
      if(context.edit){
        const snap=await db.doc('config/onsite-classes').get();
        if(token!==sequence)return;
        classes=Object.values(snap.data()?.classes||{}).filter(c=>c.active!==false).sort(classOrder);
        refreshClasses(classes);
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
  $('saDateMode').onchange=()=>{
    const range=$('saDateMode').value==='range';
    for(const id of ['saFrom','saTo']){$(id+'Label').hidden=!range;$(id).required=range;}
  };
  $('saGrade').onchange=()=>refreshClasses(classes);
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
  function paintSheet(keepEditor=false){
    const book=activeSheet;if(!book)return;
    const date=$('saSheetDate').value;
    if(!keepEditor){$('saBody').textContent='';draft=null;}
    const wholeRange=date==='range';
    const all=wholeRange?book.records:book.records.filter(record=>record.date===date);
    const byClass=new Map();
    for(const record of all){if(!byClass.has(record.classId))byClass.set(record.classId,[]);byClass.get(record.classId).push(record);}
    const items=book.items.filter(c=>context.edit||byClass.has(c.id)).map(c=>{
      const records=byClass.get(c.id)||[];
      const roster=book.rosters.get(c.id)||[];
      const students=new Set([...roster.map(s=>s.id),...records.flatMap(r=>r.students.map(s=>s.id))]);
      return {...c,roster,count:students.size};
    });
    const columns=book.period?scheduleColumns.filter(col=>col.period===book.period):scheduleColumns;
    const title=wholeRange?'من '+book.from+' إلى '+book.to:date;
    $('saSheet').innerHTML=items.length?'<h3>'+ (wholeRange?'إجمالي الفصول للفترة':'ملخص الفصول')+'</h3>'+
      '<p>ح: حاضر · غ: غائب · ت: متأخر. الأعداد تجمع حالات الطلاب في الحصص المرصودة.</p>'+
      scheduleTable(title,items,all,columns)+
      (wholeRange?(context.edit?'<p>اختر يومًا من القائمة لفتح سجل الأسماء ورصد الحصة.</p>':''):
        '<h3>سجل الطلاب بالأسماء</h3>'+
        (context.edit?'<p>اضغط عنوان الحصة داخل الشعبة لتسجيل الحضور أو استيراد كشف فيوكلاس.</p>':'')+
        items.map(c=>classSheet(c,byClass.get(c.id)||[],date,columns)).join('')):'<p>لا توجد سجلات مطابقة للعرض المحدد.</p>';
    const records=studentTotals(book.records);
    $('saPeriodTotals').innerHTML=records.length?'<details><summary>إجمالي حضور الطلاب وغيابهم للفترة المحددة</summary><div class="sa-grid"><table>'+
      '<thead><tr><th>اسم الطالب</th><th>الفصل</th><th>حاضر</th><th>غائب</th><th>غير مرصود</th></tr></thead><tbody>'+
      records.map(row=>'<tr><th class="sa-student-name" scope="row">'+escape(row.name)+'</th><td>'+escape([...row.classes].join('، '))+'</td><td>'+row.present+'</td><td>'+row.absent+'</td><td>'+row.unmarked+'</td></tr>').join('')+
      '</tbody></table></div></details>'+rollup(book.records,'subject','المادة')+rollup(book.records,'teacher','المعلم'):'';
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
    const mode=$('saDateMode').value,from=mode==='today'?today():$('saFrom').value,to=mode==='today'?today():$('saTo').value;
    if(!from||!to||from>to||to>today()){status('اختر فترة صحيحة حتى تاريخ اليوم.');return;}
    const period=Number($('saPeriod').value),grade=Number($('saGrade').value),classId=$('saClass').value;
    clear();
    const token=sequence,actor=context;
    const dateList=schoolDates(from,to);
    if(!dateList.length){status('لا توجد أيام دراسية في الفترة المحددة.');return;}
    setBusy(true);status('جارٍ تحميل السجل…');
    try{
      const records=await recordsForRange(from,to,actor.teacher);
      if(token!==sequence)return;
      if(!actor.edit){
        classes=[...new Map(records.map(record=>[record.classId,{id:record.classId,grade:gradeOf(record.classId),section:Number(record.classId.split('-s')[1])}])).values()].sort(classOrder);
        refreshClasses(classes);
      }
      const items=classes.filter(c=>(!grade||c.grade===grade)&&(!classId||c.id===classId))
        .map(c=>({...c,label:grades[c.grade]+' '+c.grade+String(c.section).padStart(2,'0')}));
      const selected=records.filter(record=>(!period||record.period===period)&&(!grade||gradeOf(record.classId)===grade)&&(!classId||record.classId===classId));
      const rosters=new Map();
      if(actor.edit){
        const snapshots=await Promise.all(items.map(c=>db.doc('config/onsite-students-'+c.id).get()));
        items.forEach((c,index)=>rosters.set(c.id,(snapshots[index].data()?.students||[]).map(s=>({id:s.id,name:s.name}))));
      }
      if(token!==sequence)return;
      activeSheet={records:selected,items,rosters,period,from,to};
      $('saResults').innerHTML='<div class="sa-actions" style="margin-top:12px"><label>عرض السجل<select id="saSheetDate">'+(from!==to?'<option value="range">إجمالي الفترة</option>':'')+dateList.map(date=>'<option>'+date+'</option>').join('')+'</select></label></div><div id="saSheet"></div><div id="saPeriodTotals"></div>';
      const datesWithRecords=[...new Set(selected.map(r=>r.date))].filter(date=>dateList.includes(date)).sort();
      $('saSheetDate').value=from!==to?'range':datesWithRecords.at(-1)||dateList.at(-1);
      $('saSheetDate').onchange=()=>paintSheet();
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
      const sessions=remoteSessions(app.S,date,c.grade,period,subs.data()?.map);
      if(!sessions.length)throw Error('لا توجد حصة مطابقة في جدول المنصة عن بُعد لهذا اليوم والفصل.');
      draft={ref,date,c,period,phones,sessions,students:[...ready.values()],teacher:old.teacher||'',subject:old.subject||'',revision:old.revision||0};
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
    const groups={c1:'الأول الثانوي',c2:'الثاني الثانوي',c3:'الثالث الثانوي',ba:'إدارة الأعمال',cs:'الحاسب والهندسة'};
    const fromRecord=current.sessions.find(lesson=>lesson.teacher===current.teacher&&lesson.subj===current.subject);
    const selected=fromRecord?.id||(current.sessions.length===1?current.sessions[0].id:'');
    $('saBody').innerHTML='<section id="saStudentEditor"><div class="sa-actions"><h3>'+escape(classLabel(current.c)+' · '+current.date+' · الحصة '+periods[current.period-1])+'</h3><button id="saBackToSheet" type="button">العودة إلى سجل الطلاب</button></div>'+
      '<form id="saEdit"><label>الحصة حسب جدول عن بُعد<select id="saSession" required><option value="">اختر الحصة أو المسار</option>'+
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
