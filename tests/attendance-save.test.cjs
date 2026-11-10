const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf("$('dAttendance').onclick=async()=>"),html.indexOf("$('dSave').onclick=async()=>"));
function fixture(role=-1,present='22',absent='35'){
 const fields={dAttendance:{},dPresent:{value:present},dAbsent:{value:absent},nVC:{value:'تقرير فيوكلاس'}};let patch=null;
 const old={status:'',rating:4,ratingMon:5,recorded:'yes',entry:'07:00',notesSup:'متابعة المسؤول',notesAdm:'متابعة المشرف'};
 const state={open:'c1-d2-p0',week:'2026-11-08',canWrite:true,role,uid:'manager',logs:{}};
 state.db={doc(){return{async update(p){patch=p},async get(){return{data:()=>({...old,...patch})}}}}};
 const c={state,byId:{'c1-d2-p0':{teacher:'معلم',sup:0,day:2}},$:id=>fields[id],onlineWeek:()=>true,isSupRole:r=>r>=0&&r<=3,logsCol:()=>'',toast(){},closeDrawer(){state.open=null},render(){},console};vm.createContext(c);vm.runInContext(source,c);return{fields,state,old,patch:()=>patch,save:fields.dAttendance.onclick};
}
test('attendance-only save retains unknown lesson status, both ratings, recording and other note channels',async()=>{const f=fixture();await f.save();const d=f.state.logs['c1-d2-p0'];a.equal(d.present,22);a.equal(d.absent,35);for(const [k,v]of Object.entries(f.old))a.equal(d[k],v);for(const k of ['status','rating','ratingMon','recorded','entry','notesSup','notesAdm'])a.equal(Object.hasOwn(f.patch(),k),false)});
test('zero counts are accepted; blanks, fractions and negatives are rejected',async()=>{for(const v of ['','-1','1.5','NaN']){const f=fixture(-1,v);await f.save();a.equal(f.patch(),null)}const f=fixture(-1,'0','1');await f.save();a.equal(f.patch().present,0)});
test('report-only and supervisor-review roles cannot write attendance; assigned responsible role can',async()=>{for(const r of [1,4,8,null]){const f=fixture(r);await f.save();a.equal(f.patch(),null)}const f=fixture(0);await f.save();a.equal(f.patch().present,22)});
