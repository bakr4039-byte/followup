/* school-family.js — parents' contacts and school announcements.
   Manager: parents' contact directory per class (WhatsApp links, missing numbers) and announcements
   for teachers, employees and the school display screen (screen.html).
   Teacher and employee pages: shows the active announcements addressed to them. */
(function(root){'use strict';
if(!root.document)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GRADES=['','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
const AUDIENCE={all:'جميع المنسوبين',teachers:'المعلمون',employees:'الإداريون',screen:'شاشة العرض المدرسية'};
const signedIn=()=>!!(root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const managerMode=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&signedIn());
const personalMode=()=>!root.__FUACC&&signedIn()&&$('account')&&!$('account').hidden&&(root.EmployeePortal||/teacher\.html$/.test(root.location.pathname));
const fs=()=>firebase.firestore();
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const hijri=d=>{if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d||''))return d||'';try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00Z'));}catch(e){return d;}};
const waLink=(phone,text)=>{const d=String(phone||'').replace(/[^0-9]/g,'');const n=/^05[0-9]{8}$/.test(d)?'966'+d.slice(1):d;return /^9665[0-9]{8}$/.test(n)?'https://wa.me/'+n+(text?'?text='+encodeURIComponent(text):''):'';};
const live=a=>a.active!==false&&(!a.start||a.start<=today())&&(!a.end||a.end>=today());
const message=err=>err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية هذا الإجراء.':(err&&err.message)||'تعذّر إكمال العملية.';
let host=null,actor='',tab='parents',classes=[],cls='',items=[],busy=false,banner=null,bannerActor='',draftMsg='';
const status=t=>{const s=$('faStatus');if(s)s.textContent=t;};
function ensure(){
  const ws=$('schoolWorkspace');if(!ws)return null;
  if(!host||!host.isConnected){
    host=document.createElement('section');host.id='schoolSection-family';host.className='school-workspace-section fa-page';host.hidden=true;host.setAttribute('aria-label','أولياء الأمور والتواصل');
    host.innerHTML='<div class="fa-head"><h2>أولياء الأمور والتواصل</h2><p>جهات تواصل أولياء الأمور لكل فصل، والإعلانات المدرسية وشاشة العرض.</p>'+
      '<div class="fa-tabs" role="tablist"><button type="button" role="tab" data-fa-tab="parents">أولياء الأمور</button><button type="button" role="tab" data-fa-tab="news">الإعلانات وشاشة العرض</button></div></div><p id="faStatus" role="status"></p><div id="faBody"></div>';
    ws.append(host);host.addEventListener('click',onClick);host.addEventListener('change',onChange);host.addEventListener('submit',onSubmit);
  }
  const links=document.querySelector('.school-sidebar-links');
  if(links&&!$('schoolFamilyLink')){const b=document.createElement('button');b.type='button';b.id='schoolFamilyLink';b.className='school-home-link';b.dataset.workspaceKey='family';b.textContent='أولياء الأمور والإعلانات';
    const after=$('schoolFormsLink')||$('schoolSupervisionLink')||$('schoolHomeLink');if(after&&after.parentNode===links)after.after(b);else links.prepend(b);}
  return host;
}
async function tick(){
  if(personalMode()){showBanner();return;}
  const h=ensure();if(!h)return;
  const show=managerMode(),b=$('schoolFamilyLink');
  if(b&&b.hidden===show)b.hidden=!show;if(h.hidden===show)h.hidden=!show;
  if(!show){actor='';return;}
  const now=firebase.auth().currentUser.uid;if(now===actor)return;actor=now;
  status('جارٍ التحميل…');
  try{
    const db=fs();
    const [reg,news]=await Promise.all([db.doc('config/onsite-classes').get(),db.collection('announcements').get()]);
    const list=Object.values((reg.data()||{}).classes||{}).filter(c=>c.active!==false).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    const rosters=await Promise.all(list.map(c=>db.doc('config/onsite-students-'+c.id).get()));
    if(now!==actor)return;
    classes=list.map((c,i)=>({id:c.id,label:(GRADES[c.grade]||'')+' '+c.grade+'/'+c.section,students:((rosters[i].data()||{}).students||[]).map(s=>({name:s.name,phone:s.guardianPhone||''}))}));
    cls=cls||(classes[0]&&classes[0].id)||'';
    items=news.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));
    status('');paint();
  }catch(err){status(message(err));}
}
function paint(){
  for(const b of host.querySelectorAll('[data-fa-tab]'))b.setAttribute('aria-selected',String(b.dataset.faTab===tab));
  $('faBody').innerHTML=tab==='parents'?parentsView():newsView();
}
function parentsView(){
  const c=classes.find(x=>x.id===cls);
  const total=classes.reduce((n,x)=>n+x.students.length,0),withPhone=classes.reduce((n,x)=>n+x.students.filter(s=>waLink(s.phone)).length,0);
  const head='<div class="fa-kpis"><div><b>'+total+'</b><span>طالبًا</span></div><div><b>'+withPhone+'</b><span>لديهم جوال ولي أمر صالح</span></div><div class="fa-bad"><b>'+(total-withPhone)+'</b><span>بدون جوال صالح</span></div></div>'+
    '<div class="fa-bar"><label>الفصل<select id="faClass">'+classes.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===cls?' selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select></label><button type="button" data-fa-print>طباعة كشف جهات التواصل</button><button type="button" data-fa-missing>كشف الأرقام الناقصة (كل الفصول)</button></div>';
  if(!c)return head+'<p class="fa-hint">لا توجد فصول.</p>';
  const rows=c.students.map((s,i)=>{const link=waLink(s.phone,draftMsg?draftMsg.split('{الطالب}').join(s.name):'');return '<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td><td dir="ltr">'+esc(s.phone||'—')+'</td><td>'+(link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">واتساب</a>':'<span class="fa-missing">غير مسجّل</span>')+'</td></tr>';}).join('');
  return head+'<label class="fa-wide">رسالة لأولياء أمور الفصل (اكتب {الطالب} لإدراج اسم الطالب)<textarea id="faMsg" rows="2" maxlength="700">'+esc(draftMsg)+'</textarea></label><button type="button" data-fa-apply>تجهيز الرسائل في الروابط</button>'+
    '<p class="fa-hint">يفتح كل رابط محادثة واتساب مع ولي الأمر والرسالة جاهزة، والإرسال يتم من واتساب بضغطة. الأرقام تُحدّث من مطابقة قوائم فيوكلاس.</p>'+
    '<div class="fa-grid"><table><thead><tr><th>م</th><th>الطالب</th><th>جوال ولي الأمر</th><th>التواصل</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function newsView(){
  const rows=items.map(a=>'<tr><td><b>'+esc(a.title)+'</b><br><small>'+esc(String(a.body||'').slice(0,140))+'</small></td><td>'+esc(AUDIENCE[a.audience]||a.audience)+'</td><td>'+esc(hijri(a.start))+(a.end?' ← '+esc(hijri(a.end)):'')+'</td><td>'+(live(a)?'<span class="fa-on">ظاهر</span>':'<span class="fa-off">'+(a.active===false?'موقوف':'خارج المدة')+'</span>')+'</td><td><button type="button" data-fa-toggle="'+esc(a.id)+'">'+(a.active===false?'تشغيل':'إيقاف')+'</button></td></tr>').join('');
  return '<form id="faNews" class="fa-form"><label>العنوان<input name="title" required maxlength="120"></label><label>الجمهور<select name="audience">'+Object.entries(AUDIENCE).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label>'+
    '<label>يبدأ في<input type="date" name="start" required value="'+today()+'"></label><label>ينتهي في<input type="date" name="end"></label><label class="fa-wide">نص الإعلان<textarea name="body" rows="3" maxlength="1000" required></textarea></label>'+
    '<div class="fa-wide"><button type="submit" class="fa-primary">نشر الإعلان</button> <a href="screen.html" target="_blank" rel="noopener">فتح شاشة العرض ↗</a></div></form>'+
    (rows?'<div class="fa-grid"><table><thead><tr><th>الإعلان</th><th>الجمهور</th><th>المدة</th><th>الحالة</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="fa-hint">لا توجد إعلانات بعد.</p>');
}
function onChange(e){if(e.target.id==='faClass'){cls=e.target.value;paint();}}
function report(title,body){if(!root.ReportKit){status('أداة الطباعة غير متاحة.');return;}if(!root.ReportKit.open({title,subtitle:hijri(today()),body,signatures:['وكيل شؤون الطلاب','مدير المدرسة']}))status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');}
function onClick(e){
  const b=e.target.closest('button');if(!b||!host.contains(b))return;const d=b.dataset;
  if(d.faTab){tab=d.faTab;paint();status('');return;}
  if(b.hasAttribute('data-fa-apply')){draftMsg=($('faMsg')&&$('faMsg').value.trim())||'';paint();status(draftMsg?'جُهّزت الرسائل في روابط واتساب.':'اكتب نص الرسالة أولًا.');return;}
  if(b.hasAttribute('data-fa-print')){const c=classes.find(x=>x.id===cls);if(!c)return;report('كشف جهات تواصل أولياء الأمور — '+c.label,'<table><thead><tr><th>م</th><th>الطالب</th><th>جوال ولي الأمر</th></tr></thead><tbody>'+c.students.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.phone||'')+'</td></tr>').join('')+'</tbody></table>');return;}
  if(b.hasAttribute('data-fa-missing')){const rows=[];for(const c of classes)for(const s of c.students)if(!waLink(s.phone))rows.push('<tr><td>'+esc(c.label)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.phone||'غير مسجّل')+'</td></tr>');report('طلاب بدون جوال ولي أمر صالح',rows.length?'<table><thead><tr><th>الفصل</th><th>الطالب</th><th>الرقم المسجل</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<p>لجميع الطلاب أرقام صالحة.</p>');return;}
  if(d.faToggle){toggle(d.faToggle);}
}
async function onSubmit(e){
  if(e.target.id!=='faNews')return;e.preventDefault();if(busy||!managerMode())return;
  const f=e.target,el=f.elements,v=n=>String(el[n].value||'').trim();
  if(v('end')&&v('end')<v('start')){status('تاريخ النهاية قبل تاريخ البداية.');return;}
  busy=true;status('جارٍ النشر…');
  const uid=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp();
  const a={title:v('title').slice(0,120),body:v('body').slice(0,1000),audience:v('audience'),start:v('start'),end:v('end'),active:true,createdBy:uid,createdAt:ts,updatedBy:uid,updatedAt:ts};
  try{const ref=await fs().collection('announcements').add(a);items.unshift(Object.assign({id:ref.id},a));paint();status('تم نشر الإعلان.');}
  catch(err){status(message(err));}finally{busy=false;}
}
async function toggle(id){
  const a=items.find(x=>x.id===id);if(!a||busy)return;busy=true;
  try{await fs().collection('announcements').doc(id).update({active:a.active===false,updatedBy:firebase.auth().currentUser.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});a.active=a.active===false;paint();status(a.active?'أُعيد تشغيل الإعلان.':'أُوقف الإعلان.');}
  catch(err){status(message(err));}finally{busy=false;}
}
async function showBanner(){
  const now=firebase.auth().currentUser.uid;if(now===bannerActor)return;bannerActor=now;
  const aud=root.EmployeePortal?'employees':'teachers';
  try{
    const db=fs(),snaps=await Promise.all([db.collection('announcements').where('audience','==','all').get(),db.collection('announcements').where('audience','==',aud).get()]);
    const list=snaps.flatMap(s=>s.docs.map(d=>d.data())).filter(live).sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));
    if(now!==bannerActor)return;
    if(!banner){banner=document.createElement('section');banner.className='card fa-banner';banner.setAttribute('aria-label','إعلانات المدرسة');const acc=$('account');acc.insertBefore(banner,acc.children[1]||null);}
    banner.hidden=!list.length;
    banner.innerHTML='<h3>إعلانات المدرسة</h3>'+list.map(a=>'<article><b>'+esc(a.title)+'</b><p>'+esc(a.body)+'</p><small>'+esc(hijri(a.start))+'</small></article>').join('');
  }catch(err){}
}
const style=document.createElement('style');
style.textContent='.fa-page{direction:rtl}.fa-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.fa-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.fa-head p{margin:0 0 12px;color:#5b6b66}'+
  '.fa-tabs{display:flex;gap:4px;border-bottom:2px solid #dbe8e4}.fa-tabs button{font:inherit;border:0;border-bottom:3px solid transparent;border-radius:8px 8px 0 0;background:transparent;padding:9px 16px;font-weight:600;color:#4a5e58;margin-bottom:-2px;cursor:pointer}.fa-tabs button[aria-selected=true]{border-bottom-color:#17624d;color:#17624d;background:#eef6f2}'+
  '#faStatus:empty{display:none}#faStatus{font-weight:600;color:#17624d}.fa-hint{color:#5b6b66}.fa-missing,.fa-bad b{color:#9f2727}.fa-on{color:#17633a;font-weight:600}.fa-off{color:#7a4d00}'+
  '.fa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px}.fa-kpis div{background:#fff;border:1px solid #dae5df;border-radius:12px;padding:10px 12px}.fa-kpis b{display:block;font-size:22px}.fa-kpis span{font-size:13px;color:#4a5e58}'+
  '.fa-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:10px 0}.fa-bar label,.fa-form label,.fa-wide{display:grid;gap:4px;font-size:14px}.fa-wide{grid-column:1/-1;margin-bottom:8px}'+
  '.fa-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;background:#fff;border:1px solid #dae5df;border-radius:14px;padding:14px;margin-bottom:12px}'+
  '.fa-page input,.fa-page select,.fa-page textarea{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;color:inherit}.fa-page button{font:inherit;padding:7px 12px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer;color:inherit}.fa-page .fa-primary{background:#17624d;color:#fff;border-color:#17624d}'+
  '.fa-grid{overflow:auto;background:#fff;border:1px solid #dae5df;border-radius:12px}.fa-grid table{border-collapse:collapse;width:100%;font-size:14px}.fa-grid th,.fa-grid td{border-bottom:1px solid #e3ece8;padding:7px;text-align:start;vertical-align:top}.fa-grid thead{background:#e8f2ed}'+
  '.fa-banner{border:1px solid #f0dca6;background:#fffaf0}.fa-banner h3{margin:0 0 8px;color:#7a4d00}.fa-banner article{border-top:1px solid #f3e6c4;padding:8px 0}.fa-banner article p{margin:4px 0;white-space:pre-wrap}.fa-banner small{color:#7a6a4a}';
document.head.append(style);
if(root.SchoolTick)root.SchoolTick.add(tick);else setInterval(tick,1000);
})(window);
