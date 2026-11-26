/* lesson-alerts.js — reminds the teacher of the next lesson today (remote or onsite, per the day's mode).
   Uses the approved bell times in school-timetable.js. The reminder appears in the notification bell and,
   when allowed, as a device notification while the platform is open or in the background. Reads only. */
(function(root){'use strict';
const LEAD=10; // minutes before the lesson starts
function riyadhNow(d){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(d||new Date());
  const g=t=>(p.find(x=>x.type===t)||{}).value;
  return {date:g('year')+'-'+g('month')+'-'+g('day'),dow:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(g('weekday')),min:Number(g('hour'))*60+Number(g('minute'))};
}
function weekOf(date,dow){const t=new Date(date+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-dow);return t.toISOString().slice(0,10)}
function startMin(range){const m=/^(\d{1,2}):(\d{2})/.exec(range||'');if(!m)return null;let h=Number(m[1]);if(h<6)h+=12;return h*60+Number(m[2])}
function todayLessons(o){
  const T=root.SchoolTimetable;if(!T||!o.name||o.mode==='holiday')return [];
  const all=o.mode==='onsite'?T.onsiteSessions(o.onsite):T.remoteSessions(o.remote);
  return all.filter(s=>s.day===o.day&&s.teacher===o.name).map(s=>{const range=T.periodTime(o.mode,s.period,s.classIds[0]);
    return Object.assign({},s,{mode:o.mode,range,start:startMin(range),cls:T.classLabel(o.mode,s.classIds[0],o.onsite)})}).filter(s=>s.start!=null).sort((a,b)=>a.start-b.start);
}
function due(lessons,nowMin){return lessons.filter(s=>s.start-nowMin<=LEAD&&s.start-nowMin>=-5)}
const api={riyadhNow,weekOf,startMin,todayLessons,due,LEAD};root.LessonAlerts=api;if(typeof module==='object')module.exports=api;
if(!root.document||!root.firebase)return;
let name=null,uid=null,week='',modes={},onsite=null,subs={};
const DAY_NAMES=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
// Substitution lessons assigned to this teacher this week (config/subs-<week>: {map:{lessonId:{t:substitute,o:original}}}).
function mySubstitutions(now){
  const T=root.SchoolTimetable,remote=typeof S!=='undefined'?S:[];if(!T||!name)return [];
  return Object.entries(subs).filter(([,x])=>x&&x.t===name).map(([id,x])=>{const l=remote.find(s=>s.id===id);if(!l)return null;
    const range=T.periodTime('remote',l.slot+1,l.cls),start=startMin(range);
    if(l.day<now.dow||(l.day===now.dow&&start!=null&&start+50<now.min))return null;
    return {day:l.day,start,range,label:'حصة انتظار مسندة إليك: '+l.subj+' · '+T.classLabel('remote',l.cls)+' · '+DAY_NAMES[l.day]+' '+range+(x.o?' · بدلًا من '+x.o:'')}}).filter(Boolean).sort((a,b)=>a.day-b.day||a.start-b.start);
}
function post(list){
  if(!root.ActionReminders)return;
  root.ActionReminders.set('lesson-alerts',list.map(s=>({label:'حصتك القادمة: '+s.subject+' · '+s.cls+' · '+s.range+(s.mode==='remote'?' (عن بُعد)':' (حضوري)'),
    open:()=>{const b=document.querySelector('.school-sidebar-links [data-workspace-key="schedule"]');if(b)b.click()}})));
}
async function load(){
  const db=firebase.firestore(),now=riyadhNow();week=weekOf(now.date,now.dow);
  const [m,o,sb]=await Promise.all([db.doc('weekModes/'+week).get().catch(()=>null),db.doc('config/subs-onsite-data').get().catch(()=>null),db.doc('config/subs-'+week).get().catch(()=>null)]);
  modes=m&&m.exists?{[week]:m.data()}:{};onsite=o&&o.exists?o.data():null;
  const sv=sb&&sb.exists?sb.data():null;subs=sv&&sv.map&&typeof sv.map==='object'?sv.map:{};
}
async function refresh(user){
  if(!user){uid=null;name=null;post([]);return}
  if(uid===user.uid&&name!==null)return;
  uid=user.uid;
  try{const p=await firebase.firestore().doc('teacherProfiles/'+user.uid).get();name=p.exists?(p.data().scheduleName||''):'';if(name)await load()}catch(e){name=''}
  tick();
}
async function tick(){
  if(!name){post([]);if(root.ActionReminders)root.ActionReminders.set('substitutions',[]);return}
  const now=riyadhNow();if(now.dow<0||now.dow>4){post([]);if(root.ActionReminders)root.ActionReminders.set('substitutions',[]);return}
  if(weekOf(now.date,now.dow)!==week){try{await load()}catch(e){}}
  const mode=root.WeekModes?root.WeekModes.dayMode(modes,week,now.dow):'remote';
  post(due(todayLessons({name,mode,day:now.dow,remote:typeof S!=='undefined'?S:[],onsite}),now.min));
  if(root.ActionReminders)root.ActionReminders.set('substitutions',mode==='holiday'?[]:mySubstitutions(now).map(x=>({label:x.label,open:()=>{const b=document.querySelector('.school-sidebar-links [data-workspace-key="schedule"]');if(b)b.click()}})));
}
function start(){if(!firebase.apps||!firebase.apps.length){setTimeout(start,500);return}firebase.auth().onAuthStateChanged(refresh);setInterval(tick,30000)}
start();
})(typeof window==='undefined'?globalThis:window);
