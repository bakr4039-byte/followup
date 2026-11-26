/* activity-log.js — append-only activity log.
   After each successful write to a tracked collection, adds one entry to activityLog:
   {at: server time, uid: the signed-in user, section, action, target, path}.
   Firestore rules let users only add entries in their own name with the server time; nobody can edit or delete them.
   Works by wrapping the Firestore compat write methods, so modules need no changes. */
(function(root){'use strict';
if(!root.document||root.SchoolLog)return;
const SECTIONS={announcements:'الإعلانات',radioPrograms:'الإذاعة المدرسية',formRecords:'النماذج الرسمية',formAccess:'صلاحيات النماذج',classVisits:'الزيارات الصفية',remedialPlans:'الخطط العلاجية',absenceActions:'إجراءات الغياب',classRosters:'قوائم الأسماء للمعلمين',studentAttendance:'حضور الطلاب',recordWeeks:'رصد الحصص',accountability:'المساءلات',assignments:'التكليفات',signDocuments:'التوقيعات',staffAccess:'الحسابات والصلاحيات',teacherProfiles:'حسابات المعلمين',employeeProfiles:'حسابات الإداريين',config:'إعدادات المدرسة',weekModes:'نوع الأسبوع',links:'روابط الحصص',personalTasks:'المهام الشخصية'};
const LABEL_KEYS=['title','formTitle','theme','studentName','student','name','teacher','classLabel','subject','code'];
function describe(data){if(data&&typeof data==='object')for(const k of LABEL_KEYS)if(typeof data[k]==='string'&&data[k])return data[k];return '';}
function actionOf(kind,data){
  if(kind==='add')return 'إنشاء';if(kind==='delete')return 'حذف';
  const d=data&&typeof data==='object'?data:{};
  if('active' in d&&typeof d.active==='boolean')return d.active?'تشغيل':'إيقاف';
  if(typeof d.status==='string')return 'تغيير الحالة: '+d.status;
  if(d.cleared===true)return 'مسح';
  return kind==='set'?'حفظ':'تعديل';
}
function record(ref,kind,data,note){
  try{
    const path=String(ref&&ref.path||''),col=path.split('/')[0];
    if(!SECTIONS[col])return;
    const user=firebase.auth().currentUser;if(!user)return;
    firebase.firestore().collection('activityLog').add({at:firebase.firestore.FieldValue.serverTimestamp(),uid:user.uid,section:SECTIONS[col],action:(note||actionOf(kind,data)).slice(0,30),target:String(describe(data)||ref.id||'').slice(0,160),path:path.slice(0,300)}).catch(()=>{});
  }catch(err){}
}
let patched=false;
function patch(){
  const F=root.firebase&&firebase.firestore;
  if(patched||!F||!F.DocumentReference||!F.CollectionReference)return patched;
  patched=true;
  const D=F.DocumentReference.prototype,C=F.CollectionReference.prototype,B=F.WriteBatch&&F.WriteBatch.prototype,T=F.Transaction&&F.Transaction.prototype,S=F.Firestore&&F.Firestore.prototype;
  for(const kind of ['set','update','delete']){const orig=D[kind];if(typeof orig!=='function')continue;D[kind]=function(...args){const result=orig.apply(this,args);Promise.resolve(result).then(()=>record(this,kind,args[0])).catch(()=>{});return result;};}
  if(typeof C.add==='function'){const orig=C.add;C.add=function(...args){const result=orig.apply(this,args);Promise.resolve(result).then(ref=>record(ref,'add',args[0])).catch(()=>{});return result;};}
  if(B){const pending=new WeakMap();
    for(const kind of ['set','update','delete']){const orig=B[kind];if(typeof orig!=='function')continue;B[kind]=function(ref,...rest){const list=pending.get(this)||[];list.push([ref,kind,rest[0]]);pending.set(this,list);return orig.call(this,ref,...rest);};}
    const commit=B.commit;B.commit=function(...args){const list=pending.get(this)||[];pending.delete(this);const result=commit.apply(this,args);Promise.resolve(result).then(()=>{const byCol=new Map();for(const item of list){const col=String(item[0].path).split('/')[0];if(!byCol.has(col))byCol.set(col,[]);byCol.get(col).push(item);}for(const items of byCol.values()){if(items.length===1)record(items[0][0],items[0][1],items[0][2]);else record(items[0][0],items[0][1],items[0][2],'دفعة من '+items.length+' سجلات');}}).catch(()=>{});return result;};}
  if(T&&S&&typeof S.runTransaction==='function'){
    for(const kind of ['set','update','delete']){const orig=T[kind];if(typeof orig!=='function')continue;T[kind]=function(ref,...rest){if(this.__activity)this.__activity.push([ref,kind,rest[0]]);return orig.call(this,ref,...rest);};}
    const run=S.runTransaction;S.runTransaction=function(fn,...rest){let entries=[];const result=run.call(this,tx=>{entries=[];tx.__activity=entries;return fn(tx);},...rest);Promise.resolve(result).then(()=>{for(const e of entries)record(e[0],e[1],e[2]);}).catch(()=>{});return result;};
  }
  return true;
}
if(!patch()){const wait=setInterval(()=>{if(patch())clearInterval(wait);},200);setTimeout(()=>clearInterval(wait),30000);}
root.SchoolLog={sections:SECTIONS};
})(window);
