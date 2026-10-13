(function(){
 'use strict';
 var attached=false;
 function start(){
  if(!window.firebase||!firebase.apps.length){setTimeout(start,500);return;}
  firebase.auth().onAuthStateChanged(async function(user){
   document.getElementById('securityAuditBtn')?.remove();attached=false;
   document.getElementById('securityAuditDialog')?.remove();
   if(!user)return;
   try{
    var access=await firebase.firestore().doc('staffAccess/'+user.uid).get();
    if(!access.exists||access.data().active!==true||access.data().role!==-1||attached)return;
    var anchor=document.getElementById('logoutBtn');if(!anchor)return;attached=true;
    var button=document.createElement('button');button.textContent='سجل التعديلات';button.id='securityAuditBtn';
    anchor.parentElement.insertBefore(button,anchor);button.addEventListener('click',show);
   }catch(error){console.warn('Audit access check failed:',error.code||'unknown');}
  });
 }
 async function show(){
  var dialog=document.createElement('dialog');dialog.dir='rtl';dialog.id='securityAuditDialog';
  dialog.style.cssText='width:min(850px,90vw);max-height:85vh;border:1px solid #ccd5df;border-radius:16px;padding:24px;color:#172c43;background:white;overflow:auto';
  var title=document.createElement('h2');title.textContent='سجل التعديلات المحمي';dialog.appendChild(title);
  var close=document.createElement('button');close.textContent='إغلاق';close.onclick=function(){dialog.close();dialog.remove();};dialog.appendChild(close);
  var info=document.createElement('p');info.textContent='جارٍ تحميل آخر 50 تعديلًا…';dialog.appendChild(info);
  document.body.appendChild(dialog);dialog.showModal();
  try{
   var result=await firebase.firestore().collection('securityAudit').orderBy('capturedAt','desc').limit(50).get();
   info.textContent=result.empty?'لا توجد تعديلات مسجلة بعد. يبدأ التسجيل من تفعيل الخدمة.':'آخر '+result.size+' تعديلًا. يُنشأ السجل من الخادم ولا يمكن تعديله من المنصة.';
   result.forEach(function(doc){
    var record=doc.data(),item=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=new Date(record.eventTime).toLocaleString('ar-SA')+' · '+record.path+' · '+({create:'إضافة',update:'تعديل',delete:'حذف'}[record.operation]||record.operation);item.appendChild(summary);
    var who=document.createElement('p');who.textContent='الحساب الذي نفّذ العملية: '+(record.authId||'غير متاح')+' · '+record.authType;item.appendChild(who);
    [['قبل التعديل',record.before],['بعد التعديل',record.after]].forEach(function(pair){var h=document.createElement('h4');h.textContent=pair[0];var pre=document.createElement('pre');pre.dir='auto';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7fa;padding:12px';pre.textContent=JSON.stringify(pair[1],null,2);item.append(h,pre);});
    dialog.appendChild(item);
   });
  }catch(error){info.textContent='تعذر تحميل السجل. أعد المحاولة لاحقًا.';console.error('Audit load failed:',error.code||'unknown');}
 }
 start();
})();
