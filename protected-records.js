/* Notes are fetched from separate, server-authorized documents. Original records are retained. */
(function(root){
  'use strict';
  const FIELDS={vcNotes:'notesVC',supNotes:'notesSup',monitorNotes:'notesAdm'};
  const LABELS={notesVC:'حسب فيوكلاس',notesSup:'حسب المسؤول المتابع',notesAdm:'حسب المشرف'};
  function route(path){let m=path.match(/^logs(?:\/([^/]+))?$/);if(m)return {week:'2026-10-11',id:m[1]};m=path.match(/^weeks\/([^/]+)\/logs(?:\/([^/]+))?$/);return m?{week:m[1],id:m[2]}:null}
  function groups(role){return role>=0&&role<=3?['vcNotes','supNotes']:role>=4&&role<=7?['vcNotes','monitorNotes']:['vcNotes','supNotes','monitorNotes','legacyNotes']}
  function join(parts){return Object.keys(LABELS).filter(k=>String(parts[k]||'').trim()).map(k=>LABELS[k]+': '+String(parts[k]).trim()).join('\n')}
  function wrapDb(base,fs,auth){
    let rolePromise=null,roleUid=null;
    async function actor(){const user=auth.currentUser;if(!user)throw Error('authentication-required');if(roleUid!==user.uid){roleUid=user.uid;rolePromise=null}if(!rolePromise)rolePromise=(async()=>{const d=await fs.doc('staffAccess/'+user.uid).get();if(d.exists&&d.data().active===true)return {role:d.data().role,uid:user.uid};const t=await user.getIdTokenResult();if(t.claims.teacher===true)return {role:'teacher',uid:user.uid};throw Error('account-not-approved')})();try{return await rolePromise}catch(e){rolePromise=null;throw e}}
    function ref(r,group,id=r.id){return fs.doc('recordWeeks/'+r.week+'/'+group+'/'+id)}
    function compose(core,notes){const original=core.exists?core.data():{},data={...original};for(const [group,key] of Object.entries(FIELDS)){const s=notes[group];if(s)data[key]=s.exists?s.data().text||'':''}data.notes=join(data);
      const legacy=notes.legacyNotes;if(legacy&&legacy.exists){const v=legacy.data(),parts=v.parts||{};if(Object.keys(LABELS).every(k=>(data[k]||'')===(parts[k]||'')))data.notes=v.notes??data.notes}
      return {id:core.id,exists:core.exists&&original.cleared!==true,data:()=>data,metadata:core.metadata||{fromCache:false,hasPendingWrites:false}}}
    function document(r,path){return {id:r.id,path,
      get:async()=>{const a=await actor(),gs=groups(a.role);const ss=await Promise.all(['logs',...gs].map(g=>ref(r,g).get()));return compose(ss[0],Object.fromEntries(gs.map((g,i)=>[g,ss[i+1]])))},
      onSnapshot:(next,error)=>{let active=true;const stops=[];actor().then(a=>{if(!active)return;const gs=['logs',...groups(a.role)],seen=new Map();gs.forEach(g=>stops.push(ref(r,g).onSnapshot(s=>{if(!active)return;seen.set(g,s);if(seen.size===gs.length)next(compose(seen.get('logs'),Object.fromEntries(gs.slice(1).map(k=>[k,seen.get(k)]))))},e=>{if(active&&error)error(e)})))},e=>{if(active&&error)error(e)});return()=>{active=false;stops.forEach(f=>f())}},
      set:data=>write(r,data),update:data=>write(r,data),
      // Clearing a record preserves its stored fields and notes instead of deleting documents.
      delete:async()=>{const a=await actor();if(a.role!==-1)throw Error('permission-denied');const now=new Date().toISOString();return ref(r,'logs').set({cleared:true,clearedAt:now,clearedBy:a.uid,by:a.role,updatedBy:a.uid,updatedAt:now},{merge:true})}
    }}
    async function write(r,data){const a=await actor();if(a.role==='teacher'||a.role===8)throw Error('permission-denied');const core={};for(const [k,v] of Object.entries(data))if(!['notes','notesVC','notesSup','notesAdm'].includes(k))core[k]=v;
      const batch=fs.batch();if(a.role>=4&&a.role<=7){const old=await ref(r,'logs').get(),patch={monUid:a.uid,monBy:a.role-4,monAt:new Date().toISOString()};if(Object.hasOwn(core,'ratingMon'))patch.ratingMon=core.ratingMon;if(!old.exists){patch.teacher=core.teacher||'';patch.week=r.week;patch.sup=({c1:0,c2:1,c3:2,ba:3,cs:3})[r.id.split('-')[0]];patch.day=Number(r.id.match(/-d(\d+)-/)[1])}batch.set(ref(r,'logs'),patch,{merge:true})}else{if(a.role>=0&&a.role<=3){delete core.ratingMon;delete core.monBy;delete core.monAt;delete core.monUid}core.cleared=false;core.by=a.role;core.updatedBy=a.uid;core.updatedAt=new Date().toISOString();if(a.role===-1&&Object.hasOwn(core,'ratingMon')){const old=await ref(r,'logs').get();if(!old.exists||old.data().ratingMon!==core.ratingMon){core.monUid=a.uid;core.monAt=core.updatedAt;core.monBy=-1}}batch.set(ref(r,'logs'),core,{merge:true})}
      const writable=a.role===-1?['vcNotes','supNotes','monitorNotes']:a.role<=3?['vcNotes','supNotes']:['monitorNotes'];for(const g of writable){const k=FIELDS[g];if(Object.hasOwn(data,k))batch.set(ref(r,g),{text:String(data[k]??''),updatedBy:a.uid,updatedAt:new Date().toISOString()},{merge:true})}await batch.commit()
    }
    function collection(r,path){return {path,
      get:async()=>{const a=await actor(),gs=['logs',...groups(a.role)];const qs=await Promise.all(gs.map(g=>fs.collection('recordWeeks/'+r.week+'/'+g).get()));const maps=qs.slice(1).map(q=>new Map(q.docs.map(d=>[d.id,d])));const docs=qs[0].docs.map(c=>compose(c,Object.fromEntries(gs.slice(1).map((g,i)=>[g,maps[i].get(c.id)])))).filter(d=>d.exists);return {docs,size:docs.length,empty:!docs.length}},
      onSnapshot:(next,error)=>{let active=true;const stops=[];actor().then(a=>{if(!active)return;const gs=['logs',...groups(a.role)],seen=new Map();gs.forEach(g=>stops.push(fs.collection('recordWeeks/'+r.week+'/'+g).onSnapshot(q=>{if(!active)return;seen.set(g,q);if(seen.size!==gs.length)return;const maps=gs.slice(1).map(k=>new Map(seen.get(k).docs.map(d=>[d.id,d])));const docs=seen.get('logs').docs.map(c=>compose(c,Object.fromEntries(gs.slice(1).map((k,i)=>[k,maps[i].get(c.id)])))).filter(d=>d.exists);next({docs,size:docs.length,empty:!docs.length})},e=>{if(active&&error)error(e)})))},e=>{if(active&&error)error(e)});return()=>{active=false;stops.forEach(f=>f())}}
    }}
    return {doc:path=>{const r=route(path);return r&&r.id?document(r,path):base.doc(path)},collection:path=>{const r=route(path);return r&&!r.id?collection(r,path):base.collection(path)}}
  }
  root.ProtectedRecords={wrapDb};
})(typeof window!=='undefined'?window:globalThis);
