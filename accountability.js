/* نموذج المساءلة (و.م.ع.ن – 02 – 08): قائمة المخالفات + رسم النموذج + PDF + واتساب.
   مشترك بين صفحة الإدارة (index.html) وصفحة المعلم (teacher.html). */
(function(root){
  'use strict';
  const ACC_COL='accountability';
  // قائمة المخالفات مطابقة لنموذج «رصد المخالفات الإلكترونية للمعلمين بالقسم الثانوي 1448هـ»
  const CATS=[
    {k:'duty',t:'مخالفات الدوام الرسمي',items:['الغياب عن الدوام','الغياب عن الحصة','الغياب عن المناوبة أو الإشراف','الغياب عن الاجتماعات الرسمية','الغياب عن البرامج التدريبية واللقاءات التربوية','التأخر عن الدوام','التأخر عن الحصة','التأخر عن حضور الاجتماعات أو التدريب','تأخر المعلم عن الدوام الرسمي أيام الاختبارات','التأخر عن المناوبة والإشراف','الخروج من الفصل','تبديل الحصة بدون إذن','عدم القيام بواجبات المناوبة أو الإشراف','الخروج من المدرسة أثناء الدوام بدون إذن','البصمة ثم الخروج من المدرسة مبكرا دون إذن','التواجد دون مبرر في غير مكان عمله','الخروج بدون بصمة نهاية الدوام','خروج الطلاب بدون بطاقة']},
    {k:'ethic',t:'مخالفات أخلاقيات وسلوكيات المهنة',items:['عدم متابعة قروب المدرسة الرسمي','عدم الالتزام بالزي ( يمنع التشيرت )','عدم إعداد البرنامج الإذاعي','التأخر في تفعيل النشاط المدرسي','تدخل الموظف دون وجه حق في أي عمل دون اختصاصه','إهمال في استخدام أدوات وأجهزة المدرسة','رفض التوقيع على المساءلات أو التعاميم']},
    {k:'class',t:'مخالفات التخطيط والأعمال الصفية',items:['عدم التحضير الالكتروني','عدم تنزيل أعمال المنصة ( الواجبات – المرفقات – أوراق العمل ...)','عدم متابعة تسليمات الطلاب للواجبات أو الاختبارات الالكترونية','عدم الالتزام بإخراج الطلاب إلى المعامل','عدم تفعيل الحصة','عدم ضبط الفصل','نوم بعض الطلاب أثناء الحصة','الجلوس في الحصة','إخراج الطلاب دون بطاقة','عدم تسليم سجل المتابعة والسلوك والاستراتيجيات في الموعد','عدم تطبيق استراتيجية التدريس','إخراج الطالب بكتبه دون إذن الوكيل','عدم تنفيذ الحصة النموذجية','التأخر في تطبيق خطة المنهج','عدم التأكد من خروج جميع الطلاب نهاية الدوام وإطفاء الأنوار والبروجكتور','استخدام المعلم للجوال في الفصل دون الحاجة لذلك','كثرة استخدام الطلاب للجوالات دون الحاجة لذلك']},
    {k:'exam',t:'مخالفات الاختبارات وتقييم التحصيل الدراسي',items:['عدم تنفيذ اختبارات الفترة','عدم تنفيذ التقويم المستمر','عدم تنفيذ المشاريع والأبحاث المطلوبة','التأخر في تسليم الدرجات','تأخر الملاحظ في دخول اللجنة','عدم شرح التعليمات للطلاب','عدم مطابقة أرقام الجلوس','جلوس الملاحظ داخل اللجنة','عدم ضبط اللجنة','عدم المراجعة الدقيقة للأسماء وأرقام الجلوس','عدم الدقة في التصحيح والمطابقة والمراجعة','عدم الدقة أو الخطأ في وضع أسئلة الاختبارات']},
    {k:'remote',t:'مخالفات عن بعد',items:['التأخر في إرسال رابط الحصة الافتراضية عن الموعد المحدد','التأخر عن الحصة الافتراضية']}
  ];
  const TIMES=['المناوبة الصباحية','الحصة الأولى','الحصة الثانية','فسحة ( أول وثاني ثانوي )','الحصة الثالثة','فسحة ( ثالث ثانوي )','الحصة الرابعة','الحصة الخامسة','الحصة السادسة','إشراف الصلاة','الحصة السابعة','المناوبة المسائية','أخرى'];
  const MONITORS=['المدير / حسن بن محمد العمري','الوكيل / عادل عبد الرحيم','الوكيل / حسين القحطاني','الوكيل / عبد المجيد العمري','الأستاذ / محمد الأحمري','الأستاذ / على نعمان','الأستاذ / بكر الدوخي','الأستاذ / إبراهيم المشرقي','الأستاذ / محمود هلال','الأستاذ / محمد جوده','الأستاذ / السيد عبد المجيد'];
  const ACTIONS=['التنبيه','لفت نظر','إنـــــذار','الحسم من الراتب','الحفظ','إنذار بالفصل'];
  const ABSENCE_ACTIONS=['احتساب إجازة مرضية بعد التحقق من التقرير','قبول العذر واحتسابه من رصيد الإجازة الاضطرارية','اعتماد الحسم لعدم قبول العذر','دورة تدريبية','تكليف','أخرى'];
  const isAbsence=a=>a.kind==='absence';
  const SIGNED_REPLY='\n\n[إقرار وتوقيع إلكتروني]';
  const replyText=a=>isAbsence(a)&&a.reply?.endsWith(SIGNED_REPLY)?a.reply.slice(0,-SIGNED_REPLY.length):a.reply||'';
  const hasReplySignature=a=>isAbsence(a)&&!!a.replyUid&&a.reply?.endsWith(SIGNED_REPLY);
  const MANAGER_PENDING='managerReply';
  const waitingManager=a=>isAbsence(a)&&!a.archivedAt&&a.status==='replied'&&!!a.reply&&!a.managerResponse&&!managerReply(a);
  const statusFor=a=>waitingManager(a)?MANAGER_PENDING:a.status||'sent';
  const replySigner=a=>a.replyUid&&isAbsence(a)&&a.replySigner===PRINCIPAL?PRINCIPAL:hasReplySignature(a)?a.teacherFull||a.teacher:'';
  const managerReply=a=>!!a.replySigner&&replySigner(a)===PRINCIPAL;
  const actionsFor=a=>isAbsence(a)?ABSENCE_ACTIONS:ACTIONS;
  const STATUS={managerReply:'بانتظار إفادة وتوقيع المدير',sent:'بانتظار رد المعلم',replied:'ردّ المعلم · بانتظار القرار',decided:'مكتملة',deleted:'محذوفة'};
  const PRINCIPAL='حسن بن محمد العمري',GENERAL='أ / خالد عبدالله الصالح';
  const DAYN=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const HF=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
  function hijri(iso){if(!iso)return '';const o={};HF.formatToParts(new Date(String(iso).slice(0,10)+'T12:00:00Z')).forEach(x=>o[x.type]=x.value);return `${o.year}/${o.month}/${o.day}`}
  const dayName=iso=>iso?DAYN[new Date(String(iso).slice(0,10)+'T12:00:00Z').getUTCDay()]:'';
  const riyadhISO=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const isoOf=v=>{if(!v)return '';const d=typeof v.toDate==='function'?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
  function normPhone(v){let d=String(v||'').replace(/[^\d]/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('05')&&d.length===10)d='966'+d.slice(1);else if(d.startsWith('5')&&d.length===9)d='966'+d;return d.length>=10&&d.length<=15?d:''}

  // نص «أرجو بيان سبب ما يلي»
  function subjectText(a){
    const items=(a.items||[]).concat(a.other?[a.other]:[]);
    const L=items.map((x,i)=>(items.length>1?(i+1)+'- ':'')+x);
    if(a.details)L.push(a.details);return L}

  // ---------- رسم النموذج ----------
  const W=794,H=1123,FONT='"IBM Plex Sans Arabic",Tahoma,sans-serif';
  let measureCtx=null;
  function wrap(text,width,px){if(!measureCtx)measureCtx=document.createElement('canvas').getContext('2d');measureCtx.font=`600 ${px}px ${FONT}`;const out=[];
    String(text||'').split(/\n/).forEach(par=>{const words=par.trim().split(/\s+/).filter(Boolean);if(!words.length)return;let line='';words.forEach(w=>{const t=line?line+' '+w:w;if(measureCtx.measureText(t).width>width&&line){out.push(line);line=w}else line=t});if(line)out.push(line)});return out}
  function lines(paragraphs,min,max){const ls=[];(Array.isArray(paragraphs)?paragraphs:[paragraphs]).forEach(p=>ls.push(...wrap(p,W-120,15)));while(ls.length<min)ls.push('');const shown=ls.slice(0,max);if(ls.length>max)shown[max-1]+=' …';return shown.map(t=>`<div class="ac-ln">${esc(t)||'&nbsp;'}</div>`).join('')}
  const CSS=`.accp{line-height:1.45;text-align:right;letter-spacing:0;width:${W}px;height:${H}px;background:#fff;color:#000;font-family:${FONT};direction:rtl;padding:26px 30px;box-sizing:border-box;position:relative}
  .accp *{box-sizing:border-box}.accp .ac-frame>*,.accp .ac-sec>*{flex-shrink:0}.accp .ac-sec{display:block;gap:0}.accp .ac-frame{border:2px solid #000;height:100%;padding:8px 14px;display:flex;flex-direction:column}
  .accp .ac-head img{width:100%;display:block}.accp .ac-ttl{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;border-top:2px solid #000;padding-top:4px;margin-top:2px}
  .accp .ac-ttl h1{font-size:26px;margin:0;font-weight:700;text-decoration:underline}.accp .ac-code{font-size:12px;font-weight:600;text-align:left}
  .accp .ac-to{display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin:6px 0 2px}
  .accp .ac-h{font-size:15px;font-weight:700;text-decoration:underline;margin:4px 0 0}.accp .ac-ln{border-bottom:1.5px dotted #333;height:29px;line-height:32px;font-size:15px;font-weight:600;padding:0 6px;white-space:nowrap;overflow:hidden;color:#0b2a6b}
  .accp .ac-sig{display:flex;justify-content:space-between;font-size:15px;font-weight:600;margin:8px 0 6px;gap:10px;padding:0 4px 0 10px}.accp .ac-sig b{color:#0b2a6b}
  .accp .ac-sec{border-top:1.5px solid #000;padding-top:4px;margin-top:4px}
  .accp .ac-acts{display:grid;grid-template-columns:repeat(3,1fr);font-size:14px;font-weight:600;gap:4px 10px;margin:6px 0}
  .accp .ac-acts span{display:flex;align-items:center;gap:6px}.accp .ac-bx{display:inline-block;width:14px;height:14px;border:1.5px solid #000;text-align:center;line-height:11px;font-size:13px;color:#0b2a6b;font-weight:700}
  .accp.ab-paper{padding:0;font-family:Arial,sans-serif}
  .ab-paper>img{display:block;position:absolute;inset:0;width:100%;height:100%}
  .ab-paper>.ab-value{position:absolute;line-height:1.08;overflow-wrap:anywhere}
  .accp .ab-identity{display:flex;justify-content:center;gap:8px 22px;flex-wrap:wrap;margin:0 0 9px;font-size:14px}
  .accp .ac-copy{margin-top:auto;font-size:13px;font-weight:600;border-top:1.5px solid #000;padding-top:4px}.accp .ac-copy div{display:flex;justify-content:space-around;margin-top:6px}`;
  function absenceHTML(a){
    const name=a.teacherFull||a.teacher||'';
    const template=new URL('assets/absence-accountability-template.png',document.baseURI).href;
    // Coordinates refer to the 884px-wide reference page before scaling to A4.
    const scale=W/884;
    const field=(value,x,y,width,{size=14,align='center',dir='rtl',bold=false,blank=false}={})=>value?`
      <span class="ab-value" dir="${dir}" style="left:${x*scale}px;top:${y*scale}px;width:${width*scale}px;font-size:${size*scale}px;text-align:${align};font-weight:${bold?700:400};${blank?'background:#fff':''}">${esc(value)}</span>`:'';
    const gregorian=iso=>iso?String(iso).slice(0,10).split('-').reverse().join('/'):'';
    const hijriDate=iso=>iso?hijri(iso).split('/').map(part=>part.padStart(2,'0')).join('/'):'';
    const requestDate=isoOf(a.createdAt)||a.date;
    const reply=replyText(a);
    const decisionDate=isoOf(a.decidedAt);
    const choices=[[797,729],[797,754],[797,779],[797,805],[625,805],[453,805]];
    const selected=choices[Number(a.action)-1];
    let replySize=14;
    let replyLines=reply?wrap(reply,748*scale,replySize*scale):[];
    while(replyLines.length>3&&replySize>7){
      replySize--;
      replyLines=wrap(reply,748*scale,replySize*scale);
    }
    const replyStep=replyLines.length>3?Math.min(16,72/replyLines.length):25;
    if(replyLines.length>3)replySize=Math.min(replySize,replyStep*.9);
    return `<div class="accp ab-paper">
      <img src="${esc(template)}" alt="نموذج مساءلة غياب" crossorigin="anonymous">
      ${field(a.absenceCivilId,225,199,239,{dir:'ltr'})}
      ${field(name,621,253,230)}
      ${field(a.absenceSpecialty,516,253,103)}
      ${field(a.absenceJob,411,253,103)}
      ${field(a.absenceJobNumber,305,253,104,{dir:'ltr'})}
      ${field(gregorian(a.date),204,253,99,{dir:'ltr'})}
      ${field(hijriDate(a.date),103,253,99,{dir:'ltr'})}
      ${field(dayName(a.date),36,253,65)}
      ${field(name,355,303,412,{align:'right'})}
      ${field(a.monitor?.split(' / ').at(-1)||PRINCIPAL,389,410,298,{align:'right',bold:true})}
      ${field(gregorian(requestDate),68,411,70,{size:13,dir:'ltr'})}
      ${replyLines.map((line,i)=>field(line,65,566+i*replyStep,748,{size:replySize,align:'right'})).join('')}
      ${field(reply?name:'',476,672,249,{align:'right',blank:true})}
      ${field(replySigner(a),327,657,136,{size:12})}
      ${field(a.replyAt?hijriDate(isoOf(a.replyAt)):'',146,672,126,{dir:'ltr',blank:true})}
      ${selected?field('✓',selected[0],selected[1],26,{size:19,bold:true}):''}
      ${Number(a.action)===6?field(a.decision,185,805,231,{size:12,align:'right',blank:true}):''}
      ${field(a.managerSignedBy,205,844,120,{size:12,align:'right'})}
      ${field(gregorian(decisionDate||isoOf(a.managerSignedAt)),68,845,70,{size:13,dir:'ltr'})}
    </div>`;
  }
  function formHTML(a,opt={}){const header=opt.headerSrc||new URL('acc-header.jpg',document.baseURI).href;
    if(isAbsence(a))return absenceHTML(a);
    const h=d=>d?`<span dir="rtl">${hijri(d)} هـ</span>`:'&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/ 1448 هـ';
    const act=+a.action||0;const box=i=>`<span class="ac-bx">${act===i?'✓':''}</span>`;
    const amount=act===4?`( ${esc(a.amount||'……')} ) ريال مع عقوبة ${esc(a.penalty||'………')}`:'(………) ريال مع عقوبة ………';
    return `<div class="accp"><div class="ac-frame">
      <div class="ac-head"><img src="${esc(header)}" alt="" crossorigin="anonymous"></div>
      <div class="ac-ttl"><span></span><h1>مساءلة</h1><span class="ac-code">رمز النموذج : ( و.م.ع.ن – 02 – 08 )</span></div>
      <div class="ac-to"><span>المكرم / المعلم : <b style="color:#0b2a6b">${esc(a.teacherFull||a.teacher)}</b></span><span>سلمه الله</span></div>
           ${a.personnelSpecialty||a.personnelCivilId?`<div class="ab-identity">${a.personnelSpecialty?`<span>التخصص <b>${esc(a.personnelSpecialty)}</b></span>`:''}${a.personnelCivilId?`<span>السجل المدني <bdi>${esc(a.personnelCivilId)}</bdi></span>`:''}</div>`:''}
      <div class="ac-h">أرجو بيان سبب ما يلي : -</div>${lines(subjectText(a),5,6)}
      <div class="ac-sig"><span>مدير المدرسة / ${PRINCIPAL}</span><span>التوقيع /</span><span>بتاريخ : <b>${h(isoOf(a.createdAt)||a.date)}</b></span></div>
      <div class="ac-sec"><div class="ac-h">* إجابة المعلم : -</div>${lines(a.reply||'',4,6)}
      <div class="ac-sig"><span>اسم المعلم : <b>${esc(a.teacherFull||a.teacher)}</b></span><span>التوقيع / ${a.reply?'<b>تم الرد إلكترونيًا</b>':''}</span><span>بتاريخ : <b>${a.reply?h(isoOf(a.replyAt)):h('')}</b></span></div></div>
      <div class="ac-sec"><div class="ac-h">قرار المسؤول المباشر : -</div>${lines(a.decision||'',4,5)}
      <div class="ac-sig"><span>مدير المدرسة / ${PRINCIPAL}</span><span>التوقيع /</span><span>بتاريخ : <b>${a.decision?h(isoOf(a.decidedAt)):h('')}</b></span></div></div>
      <div class="ac-sec"><div class="ac-h">الإجراءات الإدارية المتخذة بحق المعلم .</div>
      <div class="ac-acts"><span>${box(1)} 1- التنبيه</span><span>${box(2)} 2- لفت نظر</span><span>${box(3)} 3- إنـــــذار</span><span style="grid-column:span 2">${box(4)} 4- الحسم من الراتب مبلغ ${amount}</span><span>${box(5)} 5- الحفظ</span><span>${box(6)} 6- إنذار بالفصل</span></div></div>
      <div class="ac-sec"><div style="font-size:15px;font-weight:600">قرار المشرف العام للمدارس بشأنه :</div>${lines(a.generalDecision||'',1,2)}
      <div class="ac-sig" style="justify-content:space-around"><span>المشرف العام : ${GENERAL}</span><span>التوقيع</span></div></div>
      <div class="ac-copy">نسخة :<div><span>- لمكتب سعادة المشرف العام</span><span>- لسعادة مدير القسم</span><span>الختم الرسمي</span></div></div>
    </div></div>`}

  function host(){let el=document.getElementById('accPdfHost');if(!el){el=document.createElement('div');el.id='accPdfHost';el.setAttribute('aria-hidden','true');el.style.cssText='position:fixed;top:0;left:-10000px;width:'+W+'px;pointer-events:none;z-index:-1';document.body.appendChild(el)}return el}
  async function pdfBlob(a){if(!root.html2canvas||!root.jspdf)throw Error('pdf-lib');const el=host();
    try{await document.fonts.ready}catch(e){}
    el.innerHTML=`<style>${CSS}</style>${formHTML(a)}`;
    const img=el.querySelector('img');if(img&&!img.complete)await new Promise(r=>{img.onload=img.onerror=r});
    try{if(isAbsence(a)&&img?.naturalWidth===0)throw Error('absence-template-unavailable');
      const pdf=new root.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
      const capture=async node=>{const canvas=await root.html2canvas(node,{scale:1.5,backgroundColor:'#ffffff',logging:false,useCORS:true});if(canvas.width!==undefined&&(!canvas.width||!canvas.height))throw Error('pdf-empty-canvas');if(canvas.getContext){const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ink=false;for(let i=0;i<pixels.length;i+=388){if(pixels[i+3]>0&&(pixels[i]<240||pixels[i+1]<240||pixels[i+2]<240)){ink=true;break}}if(!ink)throw Error('pdf-empty-canvas');}pdf.addImage(canvas.toDataURL('image/jpeg',.72),'JPEG',0,0,210,297)};
      await capture(el.querySelector('.accp'));
      return pdf.output('blob')}
    finally{el.innerHTML=''}}

  const fileName=a=>((isAbsence(a)?'مساءلة-غياب-':'مساءلة-')+(a.teacher||'')+'-'+(a.date||'')+'-'+(a.id||'')).replace(/\s+/g,'-')+'.pdf';
  let pdfQueue=Promise.resolve();
  // Files marked نموذج- use the corrected one-page renderer. Earlier saved PDFs remain untouched;
  // their display copy is rebuilt from the immutable record to match the official preview.
  async function renderPdfFile(a){if(a.archivePdf&&a.archiveFileName&&a.archiveFileName.startsWith('نموذج-')){const bytes=Uint8Array.from(atob(a.archivePdf),c=>c.charCodeAt(0));return new File([bytes],a.archiveFileName||fileName(a),{type:'application/pdf'})}return new File([await pdfBlob(a)],fileName(a),{type:'application/pdf'})}
  function pdfFile(a){const job=pdfQueue.then(()=>renderPdfFile(a));pdfQueue=job.catch(()=>{});return job}
  function download(file){const u=URL.createObjectURL(file);const x=document.createElement('a');x.href=u;x.download=file.name;document.body.appendChild(x);x.click();setTimeout(()=>{x.remove();URL.revokeObjectURL(u)},120000)}
  const canShare=f=>{try{return !!navigator.share&&!!navigator.canShare&&navigator.canShare({files:[f]})}catch(e){return false}};
  const waUrl=(phone,text)=>{const p=normPhone(phone);return 'https://wa.me/'+(p||'')+'?text='+encodeURIComponent(text)};

  /* زر PDF واتساب: الضغطة الأولى تجهّز الملف، وفي الجوال تفتح المشاركة (اختر واتساب ثم المستلم).
     في الكمبيوتر: يُحمَّل الملف ويُفتح واتساب برسالة للمستلم لإرفاق الملف. */
  const cache=new Map();
  async function sharePdfWa(a,phone,text,btn,notify){const key=a.id+'|'+(a.updatedKey||'');let f=cache.get(key);
    // عند وجود رقم: نفتح محادثة واتساب مع صاحب الرقم مباشرة (النافذة تُفتح فورًا حتى لا يحجبها المتصفح) ونحمّل الملف لإرفاقه
    const ph=normPhone(phone);
    if(ph){const win=root.open('about:blank','_blank');
      if(!f){const label=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent='جارٍ تجهيز PDF…'}
        try{f=await pdfFile(a);cache.set(key,f)}catch(e){if(win)win.close();if(btn){btn.disabled=false;btn.textContent=label}notify&&notify('تعذّر إنشاء ملف PDF، أعد تحميل الصفحة');return}
        if(btn){btn.disabled=false;btn.textContent=label}}
      download(f);const url=waUrl(ph,text);if(win)win.location.href=url;else root.location.href=url;
      notify&&notify('تم تحميل PDF — أرفقه في محادثة الواتساب التي فُتحت');return}
    if(!f){const label=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent='جارٍ تجهيز PDF…'}
      try{f=await pdfFile(a);cache.set(key,f)}catch(e){if(btn){btn.disabled=false;btn.textContent=label}notify&&notify('تعذّر إنشاء ملف PDF، أعد تحميل الصفحة');return}
      if(btn){btn.disabled=false;btn.textContent=label}
      if(canShare(f)){try{await navigator.share({files:[f]});return}catch(e){if(e&&e.name==='AbortError')return;if(btn){btn.textContent='📎 اضغط مرة أخرى لإرسال PDF';}return}}}
    else if(canShare(f)){try{await navigator.share({files:[f]})}catch(e){}return}
    download(f);root.open(waUrl(phone,text),'_blank','noopener');notify&&notify('تم تحميل PDF — أرفقه في محادثة الواتساب التي فُتحت')}

  const ADMIN_PHONE='966562518196'; // واتساب الإدارة الثابت لاستقبال ردود المعلمين
  async function archiveData(a){
    const archiveClosedDate=riyadhISO(),archiveActor=a.archiveActor||'';
    const f=await pdfFile({...a,archivePdf:null,archiveClosing:true,archiveClosedDate,archiveActor});
    if(f.size>680000)throw Error('archive-too-large');
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(f)});
    return {archivePdf:base64,archiveFileName:'نموذج-'+f.name,archiveVersion:1,archiveClosedDate,archiveActor};
  }
  async function viewPdf(a){
    const overlay=document.createElement('section');overlay.className='acc-pdf-viewer';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','عرض المساءلة PDF');
    overlay.style.cssText='position:fixed;inset:0;z-index:1000;background:#eef2f6;flex-direction:column;direction:rtl';overlay.style.setProperty('display','flex','important');
    overlay.innerHTML=`<div style="display:flex;gap:12px;align-items:center;padding:14px;background:#fff;flex-wrap:wrap"><strong>نسخة المساءلة · PDF</strong><a data-download hidden style="padding:10px">تحميل PDF</a><a data-open hidden target="_blank" rel="noopener" style="padding:10px">فتح في تبويب جديد</a><button data-close style="margin-inline-start:auto;padding:10px">إغلاق العرض</button></div><p data-loading style="padding:18px">جارٍ تجهيز الملف…</p><div data-paper style="overflow:auto;flex:1;min-height:0;padding:12px"><div style="width:max-content;margin:auto"><style>${CSS}</style>${formHTML(a)}</div></div>`;
    document.body.appendChild(overlay);let url=null,closed=false;const close=()=>{closed=true;overlay.remove();document.removeEventListener('keydown',onKey);if(url)URL.revokeObjectURL(url)};const onKey=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();close()}};
    overlay.querySelector('[data-close]').onclick=close;document.addEventListener('keydown',onKey);overlay.querySelector('[data-close]').focus();
    try{const file=await pdfFile(a);if(closed)return;url=URL.createObjectURL(file);
      const downloadLink=overlay.querySelector('[data-download]');downloadLink.href=url;downloadLink.download=file.name;downloadLink.hidden=false;
      const openLink=overlay.querySelector('[data-open]');openLink.href=url;openLink.hidden=false;
      if(isAbsence(a)&&a.archivePdf&&a.archiveFileName?.startsWith('نموذج-')){
        const frame=document.createElement('iframe');
        frame.title='مساءلة الغياب المؤرشفة';
        frame.src=url;
        frame.style.cssText='width:100%;height:100%;min-height:65vh;border:0';
        overlay.querySelector('[data-paper]').replaceChildren(frame);
      }
      overlay.querySelector('[data-loading]').textContent='النموذج المعروض مطابق لملف PDF · ورقة واحدة. استخدم «تحميل PDF» لحفظه.';
    }catch(error){close();throw error}
  }
  // Firestore does not guarantee map key order across snapshot sources.
  function sameRecord(a,b){
    const canonical=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  }
  root.ACC={sameRecord,archiveData,viewPdf,ADMIN_PHONE,COL:ACC_COL,CATS,TIMES,MONITORS,ACTIONS,actionsFor,isAbsence,replyText,hasReplySignature,replySigner,managerReply,waitingManager,statusFor,MANAGER_PENDING,PRINCIPAL,STATUS,hijri,dayName,riyadhISO,isoOf,normPhone,subjectText,formHTML,CSS,pdfBlob,pdfFile,download,waUrl,sharePdfWa,esc};
})(window);
