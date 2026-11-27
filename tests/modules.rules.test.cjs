// Rules tests for the school modules added in Nov 2026: announcements (and the public display screen) and school radio.
const {test,before,after}=require('node:test');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,query,where,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
const fs=require('node:fs');let env;
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-followup-modules',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
  await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
    await setDoc(doc(d,'staffAccess/admin'),{active:true,role:-1});
    await setDoc(doc(d,'staffAccess/staff0'),{active:true,role:0});
    await setDoc(doc(d,'teacherProfiles/teacher'),{active:true,scheduleName:'معلم أول'});
    await setDoc(doc(d,'employeeProfiles/emp'),{active:true,name:'إداري'});
    const base={body:'نص',start:'2026-11-01',end:'',active:true,createdBy:'admin',updatedBy:'admin'};
    for(const a of ['all','teachers','employees','screen'])await setDoc(doc(d,'announcements/'+a),{...base,title:a,audience:a});
    await setDoc(doc(d,'radioPrograms/r1'),radio('admin'));
  });
});
after(async()=>env&&env.cleanup());
const db=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'password'}}).firestore();
const anon=()=>env.unauthenticatedContext().firestore();
const ts=serverTimestamp;
function announcement(uid,over={}){return {title:'إعلان',body:'نص الإعلان',audience:'all',start:'2026-11-26',end:'',active:true,createdBy:uid,createdAt:ts(),updatedBy:uid,updatedAt:ts(),...over};}
function radio(uid,over={}){return {date:'2026-11-29',classId:'g1-1',classLabel:'الأول 1/1',supervisor:'',theme:'',segments:[{part:'القرآن الكريم',student:''}],status:'planned',rating:0,notes:'',createdBy:uid,createdAt:ts(),updatedBy:uid,updatedAt:ts(),...over};}

test('announcements: only the manager publishes, with valid fields',async()=>{
  await assertSucceeds(setDoc(doc(db('admin'),'announcements/n1'),announcement('admin')));
  await assertFails(setDoc(doc(db('admin'),'announcements/n2'),announcement('someoneElse')));
  await assertFails(setDoc(doc(db('admin'),'announcements/n3'),announcement('admin',{audience:'parents'})));
  await assertFails(setDoc(doc(db('admin'),'announcements/n4'),announcement('admin',{title:'x'.repeat(121)})));
  await assertFails(setDoc(doc(db('admin'),'announcements/n5'),announcement('admin',{start:'2026-11-26',end:'2026-11-20'})));
  await assertFails(setDoc(doc(db('admin'),'announcements/n6'),announcement('admin',{extra:true})));
  await assertFails(setDoc(doc(db('teacher'),'announcements/n7'),announcement('teacher')));
  await assertFails(setDoc(doc(db('emp'),'announcements/n8'),announcement('emp')));
  await assertFails(setDoc(doc(db('staff0'),'announcements/n9'),announcement('staff0')));
});

test('announcements: the display screen reads only screen items without sign-in',async()=>{
  await assertSucceeds(getDoc(doc(anon(),'announcements/screen')));
  await assertSucceeds(getDocs(query(collection(anon(),'announcements'),where('audience','==','screen'))));
  await assertFails(getDoc(doc(anon(),'announcements/all')));
  await assertFails(getDocs(collection(anon(),'announcements')));
  await assertFails(getDocs(query(collection(anon(),'announcements'),where('audience','==','all'))));
});

test('announcements: each audience reads only what is addressed to it',async()=>{
  await assertSucceeds(getDoc(doc(db('teacher'),'announcements/all')));
  await assertSucceeds(getDoc(doc(db('teacher'),'announcements/teachers')));
  await assertFails(getDoc(doc(db('teacher'),'announcements/employees')));
  await assertSucceeds(getDocs(query(collection(db('teacher'),'announcements'),where('audience','==','teachers'))));
  await assertSucceeds(getDoc(doc(db('emp'),'announcements/employees')));
  await assertFails(getDoc(doc(db('emp'),'announcements/teachers')));
  await assertSucceeds(getDocs(collection(db('admin'),'announcements')));
});

test('announcements: the manager can stop or resume but not rewrite or delete',async()=>{
  await assertSucceeds(updateDoc(doc(db('admin'),'announcements/all'),{active:false,updatedBy:'admin',updatedAt:ts()}));
  await assertFails(updateDoc(doc(db('admin'),'announcements/all'),{title:'معدل',updatedBy:'admin',updatedAt:ts()}));
  await assertFails(updateDoc(doc(db('teacher'),'announcements/teachers'),{active:false,updatedBy:'teacher',updatedAt:ts()}));
  await assertFails(deleteDoc(doc(db('admin'),'announcements/all')));
});

test('radio programs: manager only, validated, cancelled instead of deleted',async()=>{
  await assertSucceeds(setDoc(doc(db('admin'),'radioPrograms/r2'),radio('admin')));
  await assertFails(setDoc(doc(db('admin'),'radioPrograms/r3'),radio('admin',{rating:6})));
  await assertFails(setDoc(doc(db('admin'),'radioPrograms/r4'),radio('admin',{status:'deleted'})));
  await assertFails(setDoc(doc(db('admin'),'radioPrograms/r5'),radio('admin',{date:'29-11-2026'})));
  await assertFails(setDoc(doc(db('admin'),'radioPrograms/r6'),radio('admin',{segments:Array.from({length:16},()=>({part:'x',student:''}))})));
  await assertFails(setDoc(doc(db('teacher'),'radioPrograms/r7'),radio('teacher')));
  await assertFails(getDoc(doc(db('teacher'),'radioPrograms/r1')));
  await assertFails(getDoc(doc(anon(),'radioPrograms/r1')));
  await assertSucceeds(updateDoc(doc(db('admin'),'radioPrograms/r1'),{status:'done',rating:4,updatedBy:'admin',updatedAt:ts()}));
  await assertFails(updateDoc(doc(db('admin'),'radioPrograms/r1'),{date:'2026-12-01',updatedBy:'admin',updatedAt:ts()}));
  await assertFails(updateDoc(doc(db('admin'),'radioPrograms/r1'),{status:'cancelled',updatedBy:'other',updatedAt:ts()}));
  await assertFails(deleteDoc(doc(db('admin'),'radioPrograms/r1')));
});

test('activity log: append-only, own name, server time, manager reads',async()=>{
  const entry=(uid,over={})=>({at:ts(),uid,section:'الإعلانات',action:'إنشاء',target:'إعلان',path:'announcements/x',...over});
  await assertSucceeds(setDoc(doc(db('teacher'),'activityLog/a1'),entry('teacher')));
  await assertSucceeds(setDoc(doc(db('emp'),'activityLog/a2'),entry('emp')));
  await assertFails(setDoc(doc(db('teacher'),'activityLog/a3'),entry('admin')));
  await assertFails(setDoc(doc(db('teacher'),'activityLog/a4'),entry('teacher',{at:new Date('2020-01-01')})));
  await assertFails(setDoc(doc(db('teacher'),'activityLog/a5'),entry('teacher',{extra:1})));
  await assertFails(setDoc(doc(db('teacher'),'activityLog/a6'),entry('teacher',{target:'x'.repeat(161)})));
  await assertFails(setDoc(doc(anon(),'activityLog/a7'),entry('nobody')));
  await assertFails(getDoc(doc(db('teacher'),'activityLog/a1')));
  await assertSucceeds(getDocs(collection(db('admin'),'activityLog')));
  await assertFails(updateDoc(doc(db('teacher'),'activityLog/a1'),{target:'تزوير'}));
  await assertFails(updateDoc(doc(db('admin'),'activityLog/a1'),{target:'تزوير'}));
  await assertFails(deleteDoc(doc(db('admin'),'activityLog/a1')));
  await assertFails(deleteDoc(doc(db('teacher'),'activityLog/a1')));
});
