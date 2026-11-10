const {test}=require('node:test');
const a=require('node:assert/strict');
const {sameTask,commitOperations,BATCH_SIZE}=require('../personnel-tasks-admin.js');
test('unchanged assignments ignore list order and timestamps but detect scope changes',()=>{
 const old={active:true,reports:false,responsibilities:[1,0],monitorTeachers:['ب','أ'],updatedAt:'old'};
 a.equal(sameTask(old,{...old,responsibilities:[0,1],monitorTeachers:['أ','ب'],updatedAt:'new'}),true);
 for(const change of [{reports:true},{active:false},{responsibilities:[2]},{monitorTeachers:['أ']}])a.equal(sameTask(old,{...old,...change}),false);
 a.equal(sameTask(null,old),false);
});
test('21 account writes are bounded, preserve payloads and report committed progress',async()=>{
 const batches=[],progress=[],ops=Array.from({length:21},(_,i)=>({ref:'personalTasks/'+i,data:{active:true,responsibilities:[i%4],monitorTeachers:[]}}));
 const db={batch(){const entries=[];return{set(ref,data){entries.push({ref,data})},update(){throw Error('unexpected update')},async commit(){a.ok(entries.length<=BATCH_SIZE);batches.push(entries)}}}};
 a.equal(await commitOperations(db,ops,(_,n)=>progress.push(n)),21);
 a.deepEqual(batches.map(b=>b.length),[8,8,5]);a.deepEqual(progress,[8,16,21]);a.deepEqual(batches.flat(),ops);
});
test('a failed chunk stops later writes and reports only completed accounts for retry',async()=>{
 let n=0;const committed=[];const ops=Array.from({length:21},(_,i)=>({ref:i,data:{active:true}}));
 const db={batch(){return{set(){},async commit(){if(++n===2)throw Error('permission-denied')}}}};
 await a.rejects(commitOperations(db,ops,(part)=>committed.push(...part)),/permission-denied/);
 a.equal(n,2);a.deepEqual(committed,ops.slice(0,8));
});
test('legacy retirement uses updates and does not overwrite legacy profile fields',async()=>{
 const writes=[];const db={batch(){return{set(){throw Error('must retain old fields')},update(ref,data){writes.push({ref,data})},async commit(){}}}};
 await commitOperations(db,[{ref:'staffAccess/legacy',data:{active:false},update:true}]);a.deepEqual(writes,[{ref:'staffAccess/legacy',data:{active:false}}]);
});
