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
    {k:'exam',t:'مخالفات الاختبارات وتقييم التحصيل الدراسي',items:['عدم تنفيذ اختبارات الفترة','عدم تنفيذ التقويم المستمر','عدم تنفيذ المشاريع والأبحاث المطلوبة','التأخر في تسليم الدرجات','تأخر الملاحظ في دخول اللجنة','عدم شرح التعليمات للطلاب','عدم مطابقة أرقام الجلوس','جلوس الملاحظ داخل اللجنة','عدم ضبط اللجنة','عدم المراجعة الدقيقة للأسماء وأرقام الجلوس','عدم الدقة في التصحيح والمطابقة والمراجعة','عدم الدقة أو الخطأ في وضع أسئلة الاختبارات']}
  ];
  const TIMES=['المناوبة الصباحية','الحصة الأولى','الحصة الثانية','فسحة ( أول وثاني ثانوي )','الحصة الثالثة','فسحة ( ثالث ثانوي )','الحصة الرابعة','الحصة الخامسة','الحصة السادسة','إشراف الصلاة','الحصة السابعة','المناوبة المسائية','أخرى'];
  const MONITORS=['المدير / حسن بن محمد العمري','الوكيل / عادل عبد الرحيم','الوكيل / حسين القحطاني','الوكيل / عبد المجيد العمري','الأستاذ / محمد الأحمري','الأستاذ / على نعمان','الأستاذ / بكر الدوخي','الأستاذ / إبراهيم المشرقي','الأستاذ / محمود هلال','الأستاذ / محمد جوده','الأستاذ / السيد عبد المجيد'];
  const ACTIONS=['التنبيه','لفت نظر','إنـــــذار','الحسم من الراتب','الحفظ','إنذار بالفصل'];
  const STATUS={sent:'بانتظار رد المعلم',replied:'ردّ المعلم · بانتظار القرار',decided:'مكتملة',deleted:'محذوفة'};
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
  .accp .ac-copy{margin-top:auto;font-size:13px;font-weight:600;border-top:1.5px solid #000;padding-top:4px}.accp .ac-copy div{display:flex;justify-content:space-around;margin-top:6px}`;
  function formHTML(a,opt={}){const header=opt.headerSrc||new URL('acc-header.jpg',document.baseURI).href;
    const h=d=>d?`<span dir="rtl">${hijri(d)} هـ</span>`:'&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/ 1448 هـ';
    const act=+a.action||0;const box=i=>`<span class="ac-bx">${act===i?'✓':''}</span>`;
    const amount=act===4?`( ${esc(a.amount||'……')} ) ريال مع عقوبة ${esc(a.penalty||'………')}`:'(………) ريال مع عقوبة ………';
    return `<div class="accp"><div class="ac-frame">
      <div class="ac-head"><img src="${esc(header)}" alt="" crossorigin="anonymous"></div>
      <div class="ac-ttl"><span></span><h1>مساءلة</h1><span class="ac-code">رمز النموذج : ( و.م.ع.ن – 02 – 08 )</span></div>
      <div class="ac-to"><span>المكرم / المعلم : <b style="color:#0b2a6b">${esc(a.teacherFull||a.teacher)}</b></span><span>سلمه الله</span></div>
      <div class="ac-h">أرجو بيان سبب ما يلي : -</div>${lines(subjectText(a),5,6)}
      <div class="ac-sig"><span>مدير المدرسة / ${PRINCIPAL}</span><span>التوقيع /</span><span>بتاريخ : <b>${h(isoOf(a.createdAt)||a.date)}</b></span></div>
      <div class="ac-sec"><div class="ac-h">* إجابة المعلم : -</div>${lines(a.reply||'',4,6)}
      <div class="ac-sig"><span>اسم المعلم : <b>${esc(a.teacherFull||a.teacher)}</b></span><span>التوقيع / ${a.reply?'<b>تم الرد إلكترونيًا</b>':''}</span><span>بتاريخ : <b>${a.reply?h(isoOf(a.replyAt)):h('')}</b></span></div></div>
      <div class="ac-sec"><div class="ac-h">قرار المسؤول المباشر : -</div>${lines(a.decision||'',4,5)}
      <div class="ac-sig"><span>مدير المدرسة / ${PRINCIPAL}</span><span>التوقيع /</span><span>بتاريخ : <b>${a.decision?h(isoOf(a.decidedAt)):h('')}</b></span></div></div>
      <div class="ac-sec"><div class="ac-h">الإجراءات الإدارية المتخذة بحق المعلم .</div>
      <div class="ac-acts"><span>${box(1)} 1- التنبيه</span><span>${box(2)} 2- لفت نظر</span><span>${box(3)} 3- إنـــــذار</span><span style="grid-column:span 2">${box(4)} 4- الحسم من الراتب مبلغ ${amount}</span><span>${box(5)} 5- الحفظ</span><span>${box(6)} 6- إنذار بالفصل</span></div></div>
      <div class="ac-sec"><div style="font-size:15px;font-weight:600">قرار المشرف العام للمدارس بشأنه :</div><div class="ac-ln">&nbsp;</div>
      <div class="ac-sig" style="justify-content:space-around"><span>المشرف العام : ${GENERAL}</span><span>التوقيع</span></div></div>
      <div class="ac-copy">نسخة :<div><span>- لمكتب سعادة المشرف العام</span><span>- لسعادة مدير القسم</span><span>الختم الرسمي</span></div></div>
    </div></div>`}

  function host(){let el=document.getElementById('accPdfHost');if(!el){el=document.createElement('div');el.id='accPdfHost';el.setAttribute('aria-hidden','true');el.style.cssText='position:fixed;top:0;left:-10000px;width:'+W+'px;pointer-events:none;z-index:-1';document.body.appendChild(el)}return el}
  async function pdfBlob(a){if(!root.html2canvas||!root.jspdf)throw Error('pdf-lib');const el=host();
    try{await document.fonts.ready}catch(e){}
    el.innerHTML=`<style>${CSS}</style>${formHTML(a)}`;
    const img=el.querySelector('img');if(img&&!img.complete)await new Promise(r=>{img.onload=img.onerror=r});
    try{const canvas=await root.html2canvas(el.querySelector('.accp'),{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true});
      const pdf=new root.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});pdf.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',0,0,210,297);return pdf.output('blob')}
    finally{el.innerHTML=''}}
  const fileName=a=>('مساءلة-'+(a.teacher||'')+'-'+hijri(a.date).replace(/\//g,'-')).replace(/\s+/g,'-')+'.pdf';
  async function pdfFile(a){return new File([await pdfBlob(a)],fileName(a),{type:'application/pdf'})}
  function download(file){const u=URL.createObjectURL(file);const x=document.createElement('a');x.href=u;x.download=file.name;document.body.appendChild(x);x.click();setTimeout(()=>{x.remove();URL.revokeObjectURL(u)},4000)}
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
  root.ACC={ADMIN_PHONE,COL:ACC_COL,CATS,TIMES,MONITORS,ACTIONS,STATUS,hijri,dayName,riyadhISO,isoOf,normPhone,subjectText,formHTML,CSS,pdfBlob,pdfFile,download,waUrl,sharePdfWa,esc};
})(window);
