const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8'),teacher=fs.readFileSync('teacher.html','utf8');
const slotsFrom=s=>vm.runInNewContext(s.match(/const SLOTS=([^;]+);/)[1]);
const SLOTS=slotsFrom(source),toMin=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
test('teacher and delegated manager views use the photographed seven-period timetable',()=>{
 assert.equal(JSON.stringify(slotsFrom(teacher)),JSON.stringify(SLOTS));
 assert.deepEqual(Array.from(SLOTS,s=>s.slice(1).join('-')),['7:00-7:40','7:40-8:20','8:20-9:00','9:15-9:55','9:55-10:35','10:35-11:15','11:15-11:55']);
 assert.ok(SLOTS.every(s=>toMin(s[2])-toMin(s[1])===40));
});
test('live clock changes at 7:00, the 9:00-9:15 break, and 11:55',()=>{
 let minute=0;const label={};const ctx={SLOTS,toMin,riyadh:()=>({min:minute,hm:''}),todayIdx:()=>0,onlineWeek:()=>true,weekModesReady:true,DAYS:[{n:'الثلاثاء'}],state:{},$:()=>label};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function nowSlot()'),source.indexOf('{const ti=todayIdx();')),ctx);
 for(const [time,slot,text] of [['6:59',-1,'تبدأ الحصص 7:00'],['7:00',0,'الأولى'],['7:40',1,'الثانية'],['8:59',2,'الثالثة'],['9:00',-1,'الفسحة حتى 9:15'],['9:14',-1,'الفسحة حتى 9:15'],['9:15',3,'الرابعة'],['11:15',6,'السابعة'],['11:54',6,'السابعة'],['11:55',-1,'انتهى اليوم الدراسي']]){
  minute=toMin(time);assert.equal(ctx.nowSlot(),slot,time);ctx.tickClock();assert.ok(label.innerHTML.includes(text),time+': '+label.innerHTML);
 }
});
