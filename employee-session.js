/* A scoped UI subject. Firebase always keeps the real authenticated manager. */
(function(root){'use strict';
function create(nativeAuth,db,managerMode,onError=()=>{}){
 let current=null,ready=false,version=0;const listeners=new Set();
 nativeAuth.onAuthStateChanged(async actor=>{const turn=++version;current=null;ready=false;try{
  let subject=actor;
  if(actor&&managerMode){
   const staff=await db.doc('staffAccess/'+actor.uid).get();
   if(!staff.exists||staff.data().active!==true||staff.data().role!==-1)throw Error('هذه الصفحة متاحة من حساب المدير فقط.');
   const directory=await db.doc('config/employeeDirectory').get(),person=directory.data()?.entries?.['admin-2'];
   if(!person?.uid||person.active!==true||person.name!=='عادل عبد الرحيم')throw Error('تعذر مطابقة حساب عادل عبد الرحيم.');
   const record=await db.doc('employeeProfiles/'+person.uid).get(),p=record.data();
   if(!record.exists||p.active!==true||p.memberId!=='admin-2'||p.name!==person.name)throw Error('حساب عادل غير مفعّل أو تغير ربطه.');
   subject=Object.freeze({uid:person.uid,actorUid:actor.uid,managerAccess:true,email:actor.email});
  }
  if(turn!==version)return;current=subject;
 }catch(e){if(turn!==version)return;onError(e)}
 if(turn!==version)return;ready=true;for(const fn of [...listeners])fn(current);
 });
 return {get currentUser(){return current},get managerMode(){return managerMode},
  onAuthStateChanged(fn){listeners.add(fn);if(ready)queueMicrotask(()=>{if(listeners.has(fn))fn(current)});return()=>listeners.delete(fn)},
  signOut:()=>nativeAuth.signOut(),setPersistence:value=>nativeAuth.setPersistence(value),signInWithEmailAndPassword:(...args)=>nativeAuth.signInWithEmailAndPassword(...args)};
}
root.EmployeeSession={create};
})(typeof window==='undefined'?globalThis:window);
