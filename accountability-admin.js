/* المساءلات — صفحة الإدارة (المدير فقط). يعتمد على accountability.js ومتغيرات الصفحة: state, S, $, toast. */
(function(){
  'use strict';
  const F=window.__FUACC;if(!window.ACC||!F)return;
  const state=F.state,S=F.S,toast=F.toast;
  const A=window.ACC,esc=A.esc;
  // الأسماء الكاملة كما في نموذج رصد المخالفات (تُقترح تلقائيًا عند اختيار المعلم)
  const FULL=['وليد احمد حمود حامد الحداد','تركي إبراهيم شقير','مولي الطيب مولي الطيب','موسي حمد العطو','محمود محمد حمادة عبود','محمد محمود احمد زيد','محمد عبد الرحمن عبدالرحيم احمد','محمد صادق أحمد الشيمي','محمد ذواب فلاج العضيله المطيري','محمد السيد السيد الطاووس','محمد الحصري','مجاهد عبده مصلح الهجوة','ماهر راكان حميد أباظة','فيصل بشير محمد غريب','عبدالمجيد صالح محمد العمري','عبدالحكيم احمد محمد قاسم','عبدالتواب خليفة محمد احمد','عبد العزيز محمد عبد العزيز الشهري','عبد الرحمن احمد مصلع جذمي','عامر مجممي','عادل محمد محمد قايد','سعد عبد الله عايض القرني','حسين سعد حسين القحطاني','حسان طه صالح محمد','تامر محمد محمد السيد','ايهاب ابراهيم الشافعي','الصادق ابراهيم عبداللطيف عبدالله','احمد حمدي عبدالسلام طلبة','أحمد نجيب عبد السلام فهمي','أحمد عبد الحافظ','أحمد سمير منصور سعد','خالد محمد الشتوي','محمد سفر عايض الاحمري','على نعمان','محمد فكري','بكر الدوخي','صابر محمد','أحمد حفني'];
  const norm=s=>String(s||'').replace(/[أإآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,'').replace(/^عبد/,'عبد');
  function fullOf(short){const parts=String(short).split(/\s+/).map(norm).filter(Boolean);const hit=FULL.find(f=>{const n=norm(f);return parts.every(p=>n.includes(p))});return hit||short}
  const teachers=()=>[...new Set(S.map(s=>s.teacher))].sort((a,b)=>a.localeCompare(b,'ar'));
  const fs=()=>firebase.firestore();
  const LS='acc-reply-phone';
  const lsGet=k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const portal=id=>new URL('teacher.html#acc-'+id,location.href).href;
  let list=[],stop=null,tab='new';

  // ---------- markup ----------
  const css=document.createElement('style');css.textContent=`
  .acc-tabs{display:flex;gap:6px}.acc-tabs button{flex:1;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:8px;font-weight:600}.acc-tabs button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft)}
  .acc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:620px){.acc-grid{grid-template-columns:1fr}}
  .acc-grid select,.acc-grid input,.acc-in{width:100%;border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:9px 10px;color:var(--ink)}
  .acc-cat{border:1px solid var(--line);border-radius:12px;padding:0 12px}.acc-cat summary{cursor:pointer;padding:10px 0;font-weight:600}.acc-cat summary small{color:var(--accent);font-weight:600;margin-inline-start:6px}
  .acc-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:4px 12px;padding-bottom:12px}.acc-items label{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.6}
  .acc-card{border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;gap:8px;background:var(--surface)}
  .acc-card .top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}.acc-card h4{margin:0;font-size:15.5px}
  .acc-st{font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px}.acc-st.sent{background:var(--warn-soft);color:var(--warn)}.acc-st.replied{background:var(--tech-soft);color:var(--tech)}.acc-st.decided{background:var(--ok-soft);color:var(--ok)}
  .acc-card .muted{color:var(--muted);font-size:13px}.acc-reply{background:var(--surface-2);border-radius:10px;padding:8px 12px;white-space:pre-wrap;font-size:14px}
  .acc-acts{display:flex;flex-wrap:wrap;gap:6px}.acc-acts .btn{padding:7px 12px;font-size:13px}
  .acc-dec{display:grid;gap:8px;border-top:1px dashed var(--line);padding-top:8px}.acc-radios{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13.5px}.acc-radios label{display:flex;gap:5px;align-items:center}
  .acc-prev{overflow:auto;border:1px solid var(--line);border-radius:12px;background:#fff;max-height:70vh}.acc-prev .accp{transform:scale(.62);transform-origin:top right;margin-bottom:-420px}`;
  document.head.appendChild(css);
  const btn=document.createElement('button');btn.id='vAcc';btn.setAttribute('aria-pressed','false');btn.hidden=true;btn.textContent='المساءلات';
  const anchor=document.getElementById('vSubs');if(anchor)anchor.after(btn);
  const wrap=document.createElement('div');wrap.innerHTML=`<div class="scrim" id="acScrim" hidden></div>
  <aside class="drawer wide" id="acDrawer" hidden role="dialog" aria-modal="true" aria-labelledby="acTitle">
   <div class="drawer-head"><div class="row"><h2 id="acTitle">المساءلات</h2><button class="iconbtn" id="acClose">إغلاق</button></div>
    <p>اختر المعلم والمخالفة ثم احفظ — تُرسل للمعلم رسالة واتساب برابط حسابه ليكتب السبب، ويصلك رده هنا لتكمل القرار والإجراء.</p>
    <div class="acc-tabs"><button data-acctab="new" aria-pressed="true">مساءلة جديدة</button><button data-acctab="log" aria-pressed="false">السجل <span id="acCount"></span></button></div></div>
   <div class="drawer-body" id="acNew">
    <div class="acc-grid">
     <div class="field"><label for="acT">المعلم</label><select id="acT"></select></div>
     <div class="field"><label for="acFull">الاسم في النموذج</label><input id="acFull" class="acc-in"></div>
     <div class="field"><label for="acDate">تاريخ المخالفة <small id="acHijri" style="color:var(--muted)"></small></label><input id="acDate" type="date"></div>
     <div class="field"><label for="acTime">الوقت</label><select id="acTime"></select></div>
     <div class="field"><label for="acMon">قام برصد المخالفة</label><select id="acMon"></select></div>
     <div class="field"><label for="acPhone">واتساب الإدارة لاستقبال رد المعلم</label><input id="acPhone" inputmode="tel" placeholder="05xxxxxxxx"></div>
    </div>
    <div class="field"><label>المخالفات <small style="color:var(--muted)">(اختر واحدة أو أكثر)</small></label><div id="acCats" style="display:grid;gap:8px"></div></div>
    <div class="field"><label for="acOther">مخالفة أخرى (اختياري)</label><input id="acOther" class="acc-in" maxlength="200"></div>
    <div class="field"><label for="acDetails">تفاصيل إضافية تظهر في النموذج (اختياري)</label><textarea id="acDetails" maxlength="600"></textarea></div>
    <div class="acc-acts"><button class="btn" id="acSave">حفظ وإرسال واتساب للمعلم</button><button class="btn ghost" id="acPreview">معاينة النموذج</button></div>
    <div class="acc-prev" id="acPrev" hidden></div>
   </div>
   <div class="drawer-body" id="acLog" hidden><div class="acc-grid"><input id="acSearch" placeholder="بحث باسم المعلم"><select id="acFilter"><option value="">كل الحالات</option><option value="sent">بانتظار رد المعلم</option><option value="replied">بانتظار القرار</option><option value="decided">مكتملة</option></select></div><div id="acList" style="display:grid;gap:10px"></div></div>
   <div class="drawer-foot"><span class="note" id="acMsg"></span></div>
  </aside>`;
  document.body.append(...wrap.children);
  const $a=id=>document.getElementById(id);

  // ---------- form ----------
  function paintForm(){const sel=$a('acT');const cur=sel.value;sel.innerHTML='<option value="">— اختر المعلم —</option>'+teachers().map(t=>`<option>${esc(t)}</option>`).join('');sel.value=cur;
    if(!$a('acTime').options.length){$a('acTime').innerHTML=A.TIMES.map(t=>`<option>${esc(t)}</option>`).join('');$a('acMon').innerHTML=A.MONITORS.map(t=>`<option>${esc(t)}</option>`).join('');
      $a('acCats').innerHTML=A.CATS.map((c,ci)=>`<details class="acc-cat" ${ci===0?'open':''}><summary>${esc(c.t)}<small data-cnt="${ci}"></small></summary><div class="acc-items">${c.items.map((x,i)=>`<label><input type="checkbox" data-acc="${ci}-${i}">${esc(x)}</label>`).join('')}</div></details>`).join('')}
    if(!$a('acDate').value)$a('acDate').value=A.riyadhISO();$a('acPhone').value=$a('acPhone').value||lsGet(LS);paintHijri()}
  function paintHijri(){const d=$a('acDate').value;$a('acHijri').textContent=d?`· ${A.dayName(d)} ${A.hijri(d)}هـ`:''}
  function picked(){return [...$a('acCats').querySelectorAll('input[data-acc]:checked')].map(x=>{const[ci,i]=x.dataset.acc.split('-').map(Number);return A.CATS[ci].items[i]})}
  function draft(){return {teacher:$a('acT').value,teacherFull:$a('acFull').value.trim()||$a('acT').value,date:$a('acDate').value,time:$a('acTime').value,monitor:$a('acMon').value,items:picked(),other:$a('acOther').value.trim(),details:$a('acDetails').value.trim(),replyPhone:A.normPhone($a('acPhone').value)}}
  $a('acT').onchange=()=>{$a('acFull').value=$a('acT').value?fullOf($a('acT').value):''};
  $a('acDate').oninput=paintHijri;
  $a('acCats').addEventListener('change',()=>A.CATS.forEach((c,ci)=>{const n=$a('acCats').querySelectorAll(`input[data-acc^="${ci}-"]:checked`).length;const el=$a('acCats').querySelector(`[data-cnt="${ci}"]`);if(el)el.textContent=n?`(${n})`:''}));
  $a('acPreview').onclick=()=>{const p=$a('acPrev');if(!p.hidden){p.hidden=true;return}p.innerHTML=`<style>${A.CSS}</style>`+A.formHTML(draft());p.hidden=false};
  function teacherMsg(a,id){const ph=state.phones&&state.phones[a.teacher];return {phone:ph,text:[`السلام عليكم ورحمة الله، أ. ${a.teacher}`,'ثانوية الصحافة الأهلية – القسم الثانوي',`صدرت لكم مساءلة إدارية بتاريخ ${A.hijri(a.date)}هـ بخصوص:`,...A.subjectText(a).map(x=>'• '+x),'','نأمل الدخول إلى حسابكم في المنصة وكتابة السبب وإرساله:',portal(id)].join('\n')}}
  $a('acSave').onclick=async()=>{const d=draft();const msg=$a('acMsg');
    if(!d.teacher){msg.textContent='اختر المعلم أولاً.';return}if(!d.items.length&&!d.other){msg.textContent='اختر مخالفة واحدة على الأقل أو اكتب مخالفة أخرى.';return}if(!d.date){msg.textContent='حدد تاريخ المخالفة.';return}
    if(d.replyPhone)lsSet(LS,d.replyPhone);
    // نفتح نافذة الواتساب فورًا (قبل انتظار الحفظ) حتى لا يحجبها المتصفح
    const ph=A.normPhone(state.phones&&state.phones[d.teacher]);const win=ph?window.open('about:blank','_blank'):null;
    $a('acSave').disabled=true;msg.textContent='جارٍ الحفظ…';
    try{const ref=fs().collection(A.COL).doc();await ref.set({...d,status:'sent',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:state.uid||(firebase.auth().currentUser||{}).uid||''});
      const m=teacherMsg(d,ref.id);if(win){win.location.href=A.waUrl(m.phone,m.text)}
      msg.textContent=ph?'تم حفظ المساءلة وفتح الواتساب للمعلم.':'تم حفظ المساءلة. لا يوجد رقم جوال لهذا المعلم — أضفه من «تقارير المعلمين» ثم أرسل من السجل.';
      toast('تم حفظ المساءلة');$a('acCats').querySelectorAll('input:checked').forEach(x=>x.checked=false);$a('acCats').dispatchEvent(new Event('change'));$a('acOther').value='';$a('acDetails').value='';$a('acPrev').hidden=true;setTab('log')}
    catch(e){if(win)win.close();console.error(e);msg.textContent=e&&e.code==='permission-denied'?'لا توجد صلاحية — انشر قواعد الأمان المحدّثة في Firebase (الإعدادات ← القواعد).':'تعذّر الحفظ، حاول مرة أخرى.'}
    finally{$a('acSave').disabled=false}};

  // ---------- log ----------
  const when=a=>a.createdAt&&a.createdAt.toDate?a.createdAt.toDate().getTime():0;
  function card(a){const st=a.status||'sent';const ph=A.normPhone(state.phones&&state.phones[a.teacher]);const act=+a.action||0;
    return `<article class="acc-card" data-id="${esc(a.id)}"><div class="top"><h4>${esc(a.teacher)}</h4><span class="acc-st ${esc(st)}">${esc(A.STATUS[st]||st)}</span></div>
     <div class="muted">${esc(A.dayName(a.date))} ${esc(A.hijri(a.date))}هـ · ${esc(a.time||'')} · رصدها: ${esc(a.monitor||'—')}</div>
     <div>${A.subjectText(a).map(x=>esc(x)).join('<br>')}</div>
     ${a.reply?`<div><b style="font-size:13px">رد المعلم (${esc(A.hijri(A.isoOf(a.replyAt)))}هـ):</b><div class="acc-reply">${esc(a.reply)}</div></div>`:''}
     ${st!=='sent'?`<div class="acc-dec"><label class="field"><span style="font-size:13px;font-weight:600">قرار المسؤول المباشر</span><textarea class="acc-in" data-dec maxlength="600">${esc(a.decision||'')}</textarea></label>
       <div class="acc-radios">${A.ACTIONS.map((t,i)=>`<label><input type="radio" name="act-${esc(a.id)}" value="${i+1}" ${act===i+1?'checked':''}>${i+1}- ${esc(t)}</label>`).join('')}</div>
       <div class="acc-grid"><input class="acc-in" data-amount placeholder="مبلغ الحسم (للبند 4)" value="${esc(a.amount||'')}"><input class="acc-in" data-penalty placeholder="مع عقوبة (للبند 4)" value="${esc(a.penalty||'')}"></div>
       <div class="acc-acts"><button class="btn" data-acc-dec>حفظ القرار</button></div></div>`:''}
     <div class="acc-acts">${ph?`<button class="btn ghost" data-acc-wa>واتساب للمعلم (رابط الرد)</button>`:'<span class="muted">لا يوجد رقم جوال للمعلم</span>'}<button class="btn ghost" data-acc-pdfwa>إرسال النموذج PDF واتساب</button><button class="btn ghost" data-acc-pdf>تحميل PDF</button><button class="btn ghost" data-acc-view>معاينة</button></div>
     <div class="acc-prev" data-prev hidden></div></article>`}
  function paintList(){const q=$a('acSearch').value.trim(),f=$a('acFilter').value;const rows=list.filter(a=>(!q||String(a.teacher).includes(q))&&(!f||(a.status||'sent')===f));
    const waiting=list.filter(a=>a.status==='replied').length;$a('acCount').textContent=waiting?`(${waiting} بانتظار القرار)`:list.length?`(${list.length})`:'';
    $a('acList').innerHTML=rows.map(card).join('')||'<p class="muted">لا توجد مساءلات.</p>'}
  $a('acSearch').oninput=paintList;$a('acFilter').onchange=paintList;
  function listen(){if(stop)return;stop=fs().collection(A.COL).orderBy('createdAt','desc').limit(300).onSnapshot(snap=>{list=snap.docs.map(d=>({id:d.id,...d.data(),updatedKey:String((d.data().replyAt&&d.data().replyAt.seconds)||'')+(d.data().decidedAt&&d.data().decidedAt.seconds||'')}));paintList()},e=>{$a('acMsg').textContent=e&&e.code==='permission-denied'?'لا توجد صلاحية لقراءة المساءلات — انشر قواعد الأمان المحدّثة في Firebase.':'تعذّر تحميل المساءلات.'})}
  $a('acList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const el=b.closest('[data-id]');const a=list.find(x=>x.id===el.dataset.id);if(!a)return;
    if(b.hasAttribute('data-acc-wa')){const m=teacherMsg(a,a.id);window.open(A.waUrl(m.phone,m.text),'_blank','noopener')}
    else if(b.hasAttribute('data-acc-pdf')){b.disabled=true;try{A.download(await A.pdfFile(a))}catch(err){toast('تعذّر إنشاء PDF')}finally{b.disabled=false}}
    else if(b.hasAttribute('data-acc-pdfwa')){const text=`السلام عليكم ورحمة الله، أ. ${a.teacher}\nمرفق نموذج المساءلة${a.status==='decided'?' متضمنًا القرار والإجراء المتخذ':''}.`;A.sharePdfWa(a,state.phones&&state.phones[a.teacher],text,b,toast)}
    else if(b.hasAttribute('data-acc-view')){const p=el.querySelector('[data-prev]');if(!p.hidden){p.hidden=true;return}p.innerHTML=`<style>${A.CSS}</style>`+A.formHTML(a);p.hidden=false}
    else if(b.hasAttribute('data-acc-dec')){const dec=el.querySelector('[data-dec]').value.trim();const r=el.querySelector('input[type=radio]:checked');if(!dec&&!r){toast('اكتب القرار أو اختر الإجراء');return}
      b.disabled=true;try{await fs().collection(A.COL).doc(a.id).update({decision:dec,action:r?+r.value:0,amount:el.querySelector('[data-amount]').value.trim(),penalty:el.querySelector('[data-penalty]').value.trim(),status:'decided',decidedAt:firebase.firestore.FieldValue.serverTimestamp(),decidedBy:(firebase.auth().currentUser||{}).uid||''});toast('تم حفظ القرار')}catch(err){toast('تعذّر حفظ القرار')}finally{b.disabled=false}}});

  // ---------- drawer ----------
  function setTab(t){tab=t;document.querySelectorAll('[data-acctab]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.acctab===t)));$a('acNew').hidden=t!=='new';$a('acLog').hidden=t!=='log';if(t==='log')paintList()}
  document.querySelectorAll('[data-acctab]').forEach(x=>x.onclick=()=>setTab(x.dataset.acctab));
  function openAcc(){if(state.role!==-1)return;paintForm();listen();$a('acMsg').textContent='';$a('acScrim').hidden=false;$a('acDrawer').hidden=false;$a('acClose').focus({preventScroll:true})}
  function closeAcc(){$a('acScrim').hidden=true;$a('acDrawer').hidden=true}
  btn.onclick=openAcc;$a('acClose').onclick=closeAcc;$a('acScrim').onclick=closeAcc;
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAcc()});
  // إظهار الزر للمدير فقط + إيقاف الاستماع عند تغيّر الحساب
  setInterval(()=>{let signed=false;try{signed=!!(firebase.apps.length&&firebase.auth().currentUser)}catch(e){}const show=state.role===-1&&signed;if(btn.hidden===show)btn.hidden=!show;if(!show&&stop){stop();stop=null;list=[];closeAcc()}},800);
})();
