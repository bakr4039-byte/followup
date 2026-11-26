/* school-backup.js — manual JSON backup for the manager (no Blaze plan needed).
   Adds a "النسخ الاحتياطي" card to the activity-log section. Reads the platform collections the manager can read
   and downloads them as one JSON file. Read-only: there is no restore button on purpose. */
(function(root){'use strict';
if(!root.document)return;
const $=id=>document.getElementById(id);
const CORE=['config','announcements','radioPrograms','formAccess','formRecords','classVisits','remedialPlans','absenceActions','classRosters','weekModes','links','staffAccess','teacherProfiles','employeeProfiles','assignments','accountability','signDocuments','personalTasks','activityLog'];
const managerMode=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
let busy=false;
function plain(value){
  if(value&&typeof value.toDate==='function')return {__time:value.toDate().toISOString()};
  if(Array.isArray(value))return value.map(plain);
  if(value&&typeof value==='object'){const out={};for(const k of Object.keys(value))out[k]=plain(value[k]);return out;}
  return value;
}
async function dump(ref){const snap=await ref.get(),out={};for(const d of snap.docs)out[d.id]=plain(d.data());return out;}
async function run(){
  if(busy||!managerMode())return;busy=true;
  const say=t=>{const s=$('bkStatus');if(s)s.textContent=t;};const btn=$('bkRun');if(btn)btn.disabled=true;
  const db=firebase.firestore(),data={},skipped=[];
  try{
    for(const col of CORE){say('جارٍ قراءة: '+col+'…');try{data[col]=await dump(db.collection(col));}catch(err){skipped.push(col);}}
    if($('bkBig')&&$('bkBig').checked){
      say('جارٍ قراءة حضور الطلاب…');try{data.studentAttendance=await dump(db.collection('studentAttendance'));}catch(err){skipped.push('studentAttendance');}
      const sunday=d=>addDays(d,-new Date(d+'T12:00:00Z').getUTCDay());const start=sunday(today());
      for(let i=0;i<16;i++){const w=addDays(start,-7*i);say('جارٍ قراءة رصد أسبوع '+w+'…');try{const logs=await dump(db.collection('recordWeeks/'+w+'/logs'));if(Object.keys(logs).length)data['recordWeeks/'+w+'/logs']=logs;}catch(err){skipped.push('recordWeeks/'+w);}}
    }
    const count=Object.values(data).reduce((n,c)=>n+Object.keys(c).length,0);
    const file={exportedAt:new Date().toISOString(),exportedBy:firebase.auth().currentUser.uid,project:'alsahafa-followup',note:'نسخة احتياطية للقراءة فقط. تحتوي بيانات شخصية للطلاب والمنسوبين: احفظها في مكان آمن ولا تشاركها.',skipped,collections:data};
    const url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='followup-backup-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    say('نُزّلت النسخة: '+count+' سجلًا من '+Object.keys(data).length+' مجموعة'+(skipped.length?' · تعذّرت قراءة: '+skipped.join('، '):'')+'.');
  }catch(err){say('تعذّر إنشاء النسخة: '+(err&&err.message||err));}
  finally{busy=false;if(btn)btn.disabled=false;}
}
function tick(){
  const host=$('schoolSection-audit');if(!host)return;
  let card=$('auBackup');
  if(!managerMode()){if(card)card.hidden=true;return;}
  if(!card){
    card=document.createElement('details');card.id='auBackup';card.className='au-backup';
    card.innerHTML='<summary>النسخ الاحتياطي</summary><p>تنزيل نسخة من بيانات المنصة في ملف JSON واحد: الإعدادات والإعلانات والإذاعة والنماذج والزيارات والخطط والحسابات والتكليفات والمساءلات وسجل العمليات. يُنصح بتنزيلها أسبوعيًا وحفظها في مكان آمن، لأنها تحتوي بيانات شخصية.</p>'+
      '<label class="au-chk"><input type="checkbox" id="bkBig"> تضمين حضور الطلاب ورصد الحصص لآخر 16 أسبوعًا (حجم كبير)</label><button type="button" id="bkRun">تنزيل نسخة احتياطية</button><p id="bkStatus" role="status"></p>';
    host.append(card);$('bkRun').addEventListener('click',run);
    const css=document.createElement('style');css.textContent='.au-backup{background:#fff;border:1px solid #dae5df;border-radius:14px;padding:12px 16px;margin-top:14px}.au-backup summary{font-weight:700;color:#123e36;cursor:pointer}.au-backup p{color:#5b6b66;font-size:14px}.au-chk{display:flex;gap:6px;align-items:center;margin:8px 0}.au-backup button{font:inherit;padding:7px 12px;border:1px solid #17624d;border-radius:8px;background:#17624d;color:#fff;cursor:pointer}.au-backup button:disabled{opacity:.6}';document.head.append(css);
  }
  if(card.hidden)card.hidden=false;
}
if(root.SchoolTick)root.SchoolTick.add(tick);else setInterval(tick,1500);
})(window);
