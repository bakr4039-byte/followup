/* المساءلات — بوابة المعلم: عرض المساءلة، كتابة السبب، PDF بصيغة النموذج، وإرسالها واتساب للإدارة. */
(function(){
  'use strict';
  if(!window.ACC||typeof auth==='undefined'||typeof rawDb==='undefined')return;
  const A=window.ACC,esc=A.esc;
  const hm=location.hash.match(/^#acc-([A-Za-z0-9]+)(-pdf)?$/)||[];const target=hm[1]||'';const wantPdf=!!hm[2];
  let list=[],stop=null,uid=null;
  const css=document.createElement('style');css.textContent=`
  .acc-sec{margin:18px 0 22px;display:grid;gap:12px}.acc-sec>h3{margin:0;font-size:18px}
  .acc-item{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px;display:grid;gap:10px}
  .acc-item.need{border:2px solid #c2413a;box-shadow:0 6px 24px rgba(194,65,58,.12)}.acc-item.hl{outline:3px solid #ca9c49;outline-offset:3px}
  .acc-item .top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}.acc-item h4{margin:0;font-size:17px}
  .acc-st{font-size:12.5px;font-weight:600;padding:3px 11px;border-radius:999px;background:#fbefd8;color:#8a5a00}.acc-st.replied{background:#ece6fa;color:#5b3fa8}.acc-st.decided{background:#ddf3e5;color:#1c6e40}
  .acc-item ul{margin:4px 0 0;padding:0;list-style:none}.acc-item textarea{width:100%;min-height:120px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;resize:vertical}
  .acc-box{background:var(--bg);border-radius:12px;padding:10px 14px;white-space:pre-wrap}.acc-item .actions .btn{min-height:42px;padding:8px 14px;font-size:14px}
  .acc-login{background:#fbe1df;color:#8c2a24;border-radius:12px;padding:10px 14px;font-weight:600;margin-bottom:12px}`;
  document.head.appendChild(css);
  const sec=document.createElement('section');sec.className='acc-sec';sec.id='accSec';sec.hidden=true;sec.setAttribute('aria-label','المساءلات');
  const welcome=document.querySelector('#account .welcome');if(welcome)welcome.after(sec);
  if(target){const f=document.getElementById('form');if(f){const n=document.createElement('p');n.className='acc-login';n.textContent=wantPdf?'سجّل الدخول لتحميل نموذج المساءلة PDF.':'لديك مساءلة إدارية — سجّل الدخول لقراءتها وكتابة السبب.';f.before(n)}}
  const toast=t=>{const e=document.getElementById('dataError');if(e){e.textContent=t;setTimeout(()=>{if(e.textContent===t)e.textContent=''},5000)}};
  const fullName=a=>a.teacherFull||(typeof profile!=='undefined'&&profile&&profile.name)||a.teacher;
  function item(a){const st=a.status||'sent';const act=+a.action||0;
    return `<article class="acc-item ${st==='sent'?'need':''} ${a.id===target?'hl':''}" id="acc-${esc(a.id)}"><div class="top"><h4>مساءلة · ${esc(A.dayName(a.date))} ${esc(A.hijri(a.date))}هـ</h4><span class="acc-st ${esc(st)}">${st==='sent'?'مطلوب ردك':st==='replied'?'تم إرسال ردك · قيد المراجعة':'تم اتخاذ القرار'}</span></div>
     <div><b>أرجو بيان سبب ما يلي:</b><ul>${A.subjectText(a).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
     ${st==='sent'?`<label><b>السبب / إجابتك</b><textarea data-reply maxlength="1500" placeholder="اكتب سبب المخالفة هنا…"></textarea></label><div class="actions"><button class="btn primary" data-send>إرسال الرد</button></div>`
       :`<div><b>إجابتك:</b><div class="acc-box">${esc(a.reply||'')}</div></div>`}
     ${st==='decided'?`<div><b>قرار الإدارة:</b><div class="acc-box">${esc(a.decision||'—')}${act?`\nالإجراء: ${esc(A.ACTIONS[act-1])}`:''}</div></div>`:''}
     <div class="actions">${st!=='sent'?'<button class="btn primary" data-wa>إرسال المساءلة PDF واتساب للإدارة</button>':''}<button class="btn" data-pdf>تحميل نموذج المساءلة PDF</button></div></article>`}
  function render(){sec.hidden=!list.length;if(!list.length){sec.innerHTML='';return}const need=list.filter(a=>(a.status||'sent')==='sent').length;
    sec.innerHTML=`<h3>المساءلات${need?` <span class="acc-st">${need} بانتظار ردك</span>`:''}</h3>`+list.map(item).join('');
    if(target){const el=document.getElementById('acc-'+target);if(el&&!render.done){render.done=true;setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'center'}),300);
      // رابط «-pdf» من واتساب الإدارة: نحمّل نموذج المساءلة تلقائيًا مرة واحدة
      if(wantPdf){const a=list.find(x=>x.id===target);if(a)A.pdfFile({...a,teacherFull:fullName(a)}).then(f=>{A.download(f);toast('تم تحميل نموذج المساءلة PDF — إن لم يظهر اضغط «تحميل نموذج المساءلة PDF».')}).catch(()=>{})}}}}
  function waText(a){return [`السلام عليكم ورحمة الله`,`ردّ المعلم ${fullName(a)} على المساءلة بتاريخ ${A.hijri(a.date)}هـ:`,'',a.reply||''].join('\n')}
  sec.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const el=b.closest('.acc-item');const a=list.find(x=>'acc-'+x.id===el.id);if(!a)return;
    if(b.hasAttribute('data-send')){const t=el.querySelector('[data-reply]').value.trim();if(t.length<3){toast('اكتب السبب أولاً.');return}
      if(!confirm('سيتم إرسال ردك للإدارة ولا يمكن تعديله بعد الإرسال. متابعة؟'))return;
      b.disabled=true;b.textContent='جارٍ الإرسال…';
      try{await rawDb.collection(A.COL).doc(a.id).update({reply:t,replyAt:firebase.firestore.FieldValue.serverTimestamp(),replyUid:uid,status:'replied'})}
      catch(err){console.error(err);b.disabled=false;b.textContent='إرسال الرد';toast('تعذّر إرسال الرد، حاول مرة أخرى.')}}
    else if(b.hasAttribute('data-pdf')){b.disabled=true;try{A.download(await A.pdfFile({...a,teacherFull:fullName(a)}))}catch(err){toast('تعذّر إنشاء PDF.')}finally{b.disabled=false}}
    else if(b.hasAttribute('data-wa')){A.sharePdfWa({...a,teacherFull:fullName(a)},A.ADMIN_PHONE,waText(a),b,toast)}});
  function waitProfile(user,tries=0){if(auth.currentUser!==user)return;if(typeof profile!=='undefined'&&profile&&profile.scheduleName){listen(profile.scheduleName);return}if(tries<60)setTimeout(()=>waitProfile(user,tries+1),250)}
  function listen(name){if(stop)stop();stop=rawDb.collection(A.COL).where('teacher','==',name).onSnapshot(snap=>{list=snap.docs.filter(d=>d.data().status!=='deleted').map(d=>({id:d.id,...d.data(),updatedKey:String((d.data().replyAt&&d.data().replyAt.seconds)||'')+String((d.data().decidedAt&&d.data().decidedAt.seconds)||'')})).sort((x,y)=>((y.createdAt&&y.createdAt.seconds)||9e9)-((x.createdAt&&x.createdAt.seconds)||9e9));render()},()=>{list=[];render()})}
  auth.onAuthStateChanged(user=>{if(stop){stop();stop=null}list=[];render();uid=user?user.uid:null;if(user)waitProfile(user)});
})();
