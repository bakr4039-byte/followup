/* المساءلات — بوابة المعلم: عرض المساءلة، كتابة السبب، PDF بصيغة النموذج، وإرسالها واتساب للإدارة. */
(function(){
  'use strict';
  if(!window.ACC||typeof auth==='undefined'||typeof rawDb==='undefined')return;
  const A=window.ACC,esc=A.esc;
  const hm=location.hash.match(/^#acc-([A-Za-z0-9]+)(-pdf)?$/)||[];const target=hm[1]||'';const wantPdf=!!hm[2];
  let list=[],stop=null,uid=null,query='',month='',statusFilter='';
  const css=document.createElement('style');css.textContent=`
  .acc-history-group{display:grid;gap:12px;margin-top:14px}.acc-history-group>h4{margin:0;padding-bottom:9px;border-bottom:1px solid #d7e5df;color:#21594a}.acc-sec{margin:18px 0 22px;display:grid;gap:12px}.acc-sec>h3{margin:0;font-size:18px}
  .acc-item{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px;display:grid;gap:10px}
  .acc-item.need{border:2px solid #c2413a;box-shadow:0 6px 24px rgba(194,65,58,.12)}.acc-item.hl{outline:3px solid #ca9c49;outline-offset:3px}
  .acc-item .top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}.acc-item h4{margin:0;font-size:17px}
  .acc-st{font-size:12.5px;font-weight:600;padding:3px 11px;border-radius:999px;background:#fbefd8;color:#8a5a00}.acc-st.replied{background:#ece6fa;color:#5b3fa8}.acc-st.decided{background:#ddf3e5;color:#1c6e40}
  .acc-item ul{margin:4px 0 0;padding:0;list-style:none}.acc-item textarea{width:100%;min-height:120px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;resize:vertical}
  .acc-box{background:var(--bg);border-radius:12px;padding:10px 14px;white-space:pre-wrap}.acc-item .actions .btn{min-height:42px;padding:8px 14px;font-size:14px}
  .acc-sign{margin:0;padding:12px;border:1px solid var(--line);border-radius:12px}
  .acc-sign canvas{display:block;width:min(100%,540px);aspect-ratio:4/1;background:#fff;border:1px solid #9aada6;border-radius:8px;touch-action:none;cursor:crosshair}
  .acc-sign .actions{margin-top:8px}.acc-sign img{max-width:220px;max-height:80px;object-fit:contain}.acc-sign [role=status]{color:#8c2a24}
  .acc-login{background:#fbe1df;color:#8c2a24;border-radius:12px;padding:10px 14px;font-weight:600;margin-bottom:12px}`;
  document.head.appendChild(css);
  const sec=document.createElement('section');sec.className='acc-sec';sec.id='accSec';sec.hidden=true;sec.setAttribute('aria-label','المساءلات');
  const welcome=document.querySelector('#account .welcome');if(welcome)welcome.after(sec);
  if(target){const f=document.getElementById('form');if(f){const n=document.createElement('p');n.className='acc-login';n.textContent=wantPdf?'سجّل الدخول لتحميل نموذج المساءلة PDF.':'لديك مساءلة. سجّل الدخول للاطلاع عليها.';f.before(n)}}
  const toast=t=>{const e=document.getElementById('dataError');if(e){e.textContent=t;setTimeout(()=>{if(e.textContent===t)e.textContent=''},5000)}};
  const fullName=a=>a.teacherFull||(typeof profile!=='undefined'&&profile&&profile.name)||a.teacher;
  const signatureFields=`<fieldset class="acc-sign"><legend>توقيع المعلم</legend>
    <p>ارسم توقيعك بإصبعك أو بالفأرة، أو ارفع صورة لتوقيعك.</p>
    <canvas width="900" height="225" aria-label="لوحة رسم التوقيع"></canvas>
    <div class="actions"><button class="btn" type="button" data-clear-signature>مسح التوقيع</button>
    <label>رفع صورة التوقيع <input type="file" accept="image/png,image/jpeg,image/webp"></label></div>
    <img hidden alt="معاينة التوقيع"><div role="status"></div></fieldset>`;
  const signatureDrafts=new Map();
  function bindSignature(el){
    const canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d');
    const fileInput=el.querySelector('input'),preview=el.querySelector('img'),status=el.querySelector('[role=status]');
    const recordId=el.closest('.acc-item').id;
    let pointer=null,revision=0;
    ctx.strokeStyle='#132f4b';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
    function show(image){
      if(image){signatureDrafts.set(recordId,image);preview.src=image}
      else{signatureDrafts.delete(recordId);preview.removeAttribute('src')}
      preview.hidden=!image;
    }
    function normalize(source){
      return window.AssignmentSigning.normalizeSignature(source);
    }
    function point(e){
      const bounds=canvas.getBoundingClientRect();
      return [(e.clientX-bounds.left)*canvas.width/bounds.width,(e.clientY-bounds.top)*canvas.height/bounds.height];
    }
    show(signatureDrafts.get(recordId));
    canvas.onpointerdown=e=>{
      if(pointer!==null||e.button!==0)return;
      revision++;pointer=e.pointerId;canvas.setPointerCapture(pointer);
      if(fileInput.value)ctx.clearRect(0,0,canvas.width,canvas.height);
      fileInput.value='';show('');status.textContent='';
      ctx.beginPath();ctx.moveTo(...point(e));
    };
    canvas.onpointermove=e=>{
      if(pointer!==e.pointerId)return;
      ctx.lineTo(...point(e));ctx.stroke();
    };
    canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{
      if(pointer!==e.pointerId)return;
      pointer=null;
      try{show(normalize(canvas));status.textContent=''}
      catch(err){status.textContent=err.message}
    };
    el.querySelector('[data-clear-signature]').onclick=()=>{
      revision++;pointer=null;ctx.clearRect(0,0,canvas.width,canvas.height);
      fileInput.value='';show('');status.textContent='';
    };
    fileInput.onchange=async()=>{
      const file=fileInput.files[0];if(!file)return;
      const attempt=++revision;
      pointer=null;show('');ctx.clearRect(0,0,canvas.width,canvas.height);
      status.textContent='جارٍ تجهيز الصورة…';
      try{
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)
          throw Error('اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 5 ميجابايت.');
        const bitmap=await createImageBitmap(file);
        try{
          if(attempt!==revision||!el.isConnected)return;
          if(bitmap.width*bitmap.height>24000000)throw Error('أبعاد الصورة كبيرة جدًا.');
          const source=document.createElement('canvas');
          const ratio=Math.min(1,1200/bitmap.width,400/bitmap.height);
          source.width=Math.max(1,Math.round(bitmap.width*ratio));
          source.height=Math.max(1,Math.round(bitmap.height*ratio));
          source.getContext('2d').drawImage(bitmap,0,0,source.width,source.height);
          show(normalize(source));status.textContent='';
        }finally{bitmap.close()}
      }catch(err){
        if(attempt!==revision||!el.isConnected)return;
        fileInput.value='';status.textContent=err.message||'تعذر قراءة الصورة.';
      }
    };
  }
  function item(a){const st=A.statusFor(a);const act=+a.action||0;const absence=A.isAbsence(a);
    return `<article class="acc-item ${st==='sent'&&!a.archivedAt?'need':''} ${a.id===target?'hl':''}" id="acc-${esc(a.id)}"><div class="top"><h4>${absence?'مساءلة غياب':'مساءلة'} · ${esc(A.dayName(a.date))} ${esc(A.hijri(a.date))}هـ</h4><span class="acc-st ${esc(st)}">${a.archivedAt?'مغلقة ومؤرشفة':st==='sent'?'مطلوب ردك':A.waitingManager(a)?'بانتظار إفادة المدير':st==='replied'?(A.managerReply(a)?'سجّل المدير الإفادة · بانتظار القرار':'تم إرسال ردك · قيد المراجعة'):'تم اتخاذ القرار'}</span></div>
     <div class="acc-box">رقم المساءلة: ${esc(a.id)} · تاريخ الواقعة: ${esc(a.date||'—')} · تاريخ الإغلاق: ${esc(A.isoOf(a.archivedAt)||'لم تغلق بعد')}${!absence&&a.replyDue?' · آخر موعد للإفادة: '+esc(a.replyDue):''}</div><div><b>أرجو بيان سبب ما يلي:</b><ul>${A.subjectText(a).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
     ${st==='sent'&&!a.archivedAt?`<label><b>السبب / إجابتك</b><textarea data-reply maxlength="1500" placeholder="اكتب سبب المخالفة هنا…"></textarea></label>${absence?signatureFields:''}<div class="actions"><button class="btn primary" data-send>إرسال الرد</button></div>`
       :a.reply?`<div><b>${A.managerReply(a)?'إفادة مدير المدرسة':'إجابتك'}</b><div class="acc-box">${esc(A.replyText(a))}</div>${A.replySigner(a)?'<div>التوقيع الإلكتروني: <b>'+esc(A.replySigner(a))+'</b></div>':''}${A.teacherSignatureHTML(a)}</div>`:''}
     ${st==='decided'?`<div><b>قرار الإدارة:</b><div class="acc-box">${esc(a.decision||'—')}${act?`\nالإجراء: ${esc(A.actionsFor(a)[act-1])}`:''}</div></div>`:''}
     <div class="actions">${A.attachmentButton(a,true)}${a.archivedAt?'<button class="btn" data-view>عرض PDF النهائي</button>':''}${!absence&&st!=='sent'?'<button class="btn primary" data-wa>إرسال المساءلة PDF واتساب للإدارة</button>':''}<button class="btn" data-pdf>تحميل نموذج المساءلة PDF</button></div></article>`}
  function render(){window.ActionReminders?.set('accountability',uid?list.filter(a=>!a.archivedAt&&A.statusFor(a)==='sent').map(a=>({label:'رد على '+(A.isAbsence(a)?'مساءلة غياب':'مساءلة')+' · '+(a.date||'')+' · '+A.subjectText(a).join('، '),open:()=>{query='';month='';statusFilter='';render();document.getElementById('acc-'+a.id)?.scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('acc-'+a.id)?.querySelector('[data-reply]')?.focus({preventScroll:true});}})):[]);sec.hidden=!uid;if(!uid){sec.innerHTML='';return}const need=list.filter(a=>!a.archivedAt&&A.statusFor(a)==='sent').length;
    const rows=list.filter(a=>(!query||[a.id,...A.subjectText(a)].join(' ').includes(query))&&(!month||(a.date||'').startsWith(month))&&(!statusFilter||(statusFilter==='archived'?!!a.archivedAt:!a.archivedAt)));
    sec.innerHTML=`<h3>سجل المساءلات</h3><div class="acc-box">المفتوحة: ${list.filter(a=>!a.archivedAt).length} · المغلقة والمؤرشفة: ${list.filter(a=>a.archivedAt).length} · بانتظار ردك: ${need}</div><div class="actions"><input id="accQuery" aria-label="بحث بالرقم أو الموضوع" placeholder="بحث بالرقم أو الموضوع" value="${esc(query)}"><input id="accMonth" type="month" aria-label="السنة والشهر" value="${esc(month)}"><select id="accStatus" aria-label="حالة المساءلة"><option value="">كل المساءلات</option><option value="active">المفتوحة</option><option value="archived">المغلقة والمؤرشفة</option></select></div>`+(()=>{const q=RecordWorkflow.accountabilityGroups(rows);return [['action','بانتظار ردك'],['pending','قيد المعالجة والقرار'],['archived','المغلقة والمحفوظة']].map(([key,label])=>q[key].length?'<section class="acc-history-group"><h4>'+label+' ('+q[key].length+')</h4>'+q[key].map(item).join('')+'</section>':'').join('')||'<p>لا توجد مساءلات مطابقة.</p>'})();
    sec.querySelectorAll('.acc-sign').forEach(bindSignature);
    document.getElementById('accStatus').value=statusFilter;
    document.getElementById('accQuery').onchange=e=>{query=e.target.value.trim();render()};document.getElementById('accMonth').onchange=e=>{month=e.target.value;render()};document.getElementById('accStatus').onchange=e=>{statusFilter=e.target.value;render()};
    if(target){const el=document.getElementById('acc-'+target);if(el&&!render.done){render.done=true;setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'center'}),300);
      // رابط «-pdf» من واتساب الإدارة: نحمّل نموذج المساءلة تلقائيًا مرة واحدة
      if(wantPdf){const a=list.find(x=>x.id===target);if(a)A.pdfFile({...a,teacherFull:fullName(a)}).then(f=>{A.download(f);toast('تم تحميل نموذج المساءلة PDF — إن لم يظهر اضغط «تحميل نموذج المساءلة PDF».')}).catch(()=>{})}}}}
  function waText(a){return [`السلام عليكم ورحمة الله`,`ردّ المعلم ${fullName(a)} على المساءلة بتاريخ ${A.hijri(a.date)}هـ:`,'',A.replyText(a)].join('\n')}
  sec.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const el=b.closest('.acc-item');if(!el)return;const a=list.find(x=>'acc-'+x.id===el.id);if(!a)return;
    if(b.hasAttribute('data-view')){try{await A.viewPdf(a)}catch(err){toast('تعذر عرض PDF')}}
    else if(b.hasAttribute('data-send')){if(a.archivedAt||A.statusFor(a)!=='sent')return;const t=el.querySelector('[data-reply]').value.trim();if(t.length<3){toast('اكتب السبب أولاً.');return}
      const signature=signatureDrafts.get(el.id);
      if(A.isAbsence(a)&&!signature){el.querySelector('.acc-sign [role=status]').textContent='ارسم توقيعك أو ارفع صورته قبل إرسال الرد.';return}
      if(!await (typeof UIKit!=='undefined'?UIKit:{confirm:async m=>confirm(m)}).confirm('سيتم إرسال ردك للإدارة ولا يمكن تعديله بعد الإرسال. متابعة؟'))return;
      b.disabled=true;b.textContent='جارٍ الإرسال…';
      try{await rawDb.collection(A.COL).doc(a.id).update({reply:t,replyAt:firebase.firestore.FieldValue.serverTimestamp(),replyUid:uid,...(auth.currentUser?.managerAccess?{replyActorUid:auth.currentUser.actorUid}:{}),status:'replied',...(A.isAbsence(a)?{replySignatureImage:signature}:{})});signatureDrafts.delete(el.id)}
      catch(err){console.error(err);b.disabled=false;b.textContent='إرسال الرد';toast('تعذّر إرسال الرد، حاول مرة أخرى.')}}
    else if(b.hasAttribute('data-pdf')){b.disabled=true;try{A.download(await A.pdfFile({...a,teacherFull:fullName(a)}))}catch(err){toast('تعذّر إنشاء PDF.')}finally{b.disabled=false}}
    else if(b.hasAttribute('data-wa')){A.sharePdfWa({...a,teacherFull:fullName(a)},A.ADMIN_PHONE,waText(a),b,toast)}});
  function waitProfile(user,tries=0){if(auth.currentUser!==user)return;if(typeof profile!=='undefined'&&profile&&profile.scheduleName){listen(profile.scheduleName);return}if(tries<60)setTimeout(()=>waitProfile(user,tries+1),250)}
  function listen(name){if(stop)stop();stop=rawDb.collection(A.COL).where('teacher','==',name).onSnapshot(snap=>{list=snap.docs.filter(d=>d.data().status!=='deleted').map(d=>({id:d.id,...d.data(),updatedKey:String((d.data().replyAt&&d.data().replyAt.seconds)||'')+String((d.data().decidedAt&&d.data().decidedAt.seconds)||'')})).sort((x,y)=>(y.date||'').localeCompare(x.date||'')||((y.createdAt&&y.createdAt.seconds)||9e9)-((x.createdAt&&x.createdAt.seconds)||9e9));render()},()=>{toast('تعذر تحميل سجل المساءلات؛ أعد المحاولة.');list=[];render()})}
  auth.onAuthStateChanged(user=>{if(stop){stop();stop=null}list=[];signatureDrafts.clear();render();uid=user?user.uid:null;query='';month='';statusFilter='';render();if(user)waitProfile(user)});
})();
