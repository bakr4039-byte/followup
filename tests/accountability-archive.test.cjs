const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('accountability.js','utf8');
function setup(size=120){
  const pages=[];let captures=0;
  const host={innerHTML:'',querySelector(selector){if(selector==='img')return {complete:true};return {html:this.innerHTML}}};
  const document={baseURI:'https://example.test/followup/',fonts:{ready:Promise.resolve()},getElementById:()=>host,createElement:()=>({getContext:()=>({measureText:t=>({width:t.length*9})})})};
  class Reader{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:application/pdf;base64,'+Buffer.from(b).toString('base64');this.onload()}).catch(e=>this.onerror(e))}}
  class Pdf{addImage(){}addPage(){}output(){return new Blob([new Uint8Array(size)],{type:'application/pdf'})}}
  const window={html2canvas:async node=>{captures++;pages.push(node.html);return {toDataURL:()=>''}},jspdf:{jsPDF:Pdf}};
  vm.runInNewContext(source,{window,document,URL,File,Blob,FileReader:Reader,Uint8Array,atob,setTimeout,console,Intl,Date});
  return {A:window.ACC,pages,get captures(){return captures}};
}
test('archive creates a single-page official form and keeps stored source fields untouched',async()=>{
  const env=setup();const a={id:'legacy-123',teacher:'معلم',date:'2026-10-01',reply:('رد طويل '.repeat(400))+'علامةالنهاية',decision:'القرار النهائي',generalDecision:'قرار المشرف',status:'decided',archiveActor:'admin-1'};
  const result=await env.A.archiveData(a);
  assert.equal(result.archiveVersion,1);assert.equal(result.archiveActor,'admin-1');assert.match(result.archiveFileName,/2026-10-01-legacy-123/);
  assert.equal(env.pages.length,1);assert.ok(a.reply.endsWith('علامةالنهاية'));assert.ok(env.pages[0].includes('قرار المشرف'));
  const count=env.captures;const saved=await env.A.pdfFile({...a,...result});assert.equal(env.captures,count,'archived download must use saved bytes without regenerating');
  assert.deepEqual(Buffer.from(await saved.arrayBuffer()),Buffer.from(result.archivePdf,'base64'));
});
test('oversize PDFs reject before any archive is returned',async()=>{const {A}=setup(680001);await assert.rejects(A.archiveData({id:'1',teacher:'معلم',date:'2026-11-07'}),/archive-too-large/)});
test('older records without archive fields still generate PDFs',async()=>{const {A}=setup();const f=await A.pdfFile({teacher:'قديم',date:'2026-10-01',reply:'رد محفوظ',decision:'قرار محفوظ'});assert.equal(f.type,'application/pdf');assert.ok(f.size)});
test('PDF render queue recovers after failed job',async()=>{const {A}=setup();await assert.rejects(A.pdfFile({archivePdf:'!invalid',archiveFileName:'نموذج-invalid.pdf'}));const f=await A.pdfFile({teacher:'معلم',date:'2026-11-07'});assert.ok(f.size)});
test('teacher history retains legacy records, excludes deleted, sorts and filters archive/month',()=>{
  const {A}=setup();const elements=new Map();let section,authCallback;
  const element=()=>({innerHTML:'',value:'',hidden:true,setAttribute(){},addEventListener(){}});
  const document={head:{appendChild(){}},createElement:()=>element(),querySelector:()=>({after(el){section=el}}),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}};
  const records=[{id:'old',date:'2026-10-01',teacher:'أ',status:'decided',reply:'الرد القديم'},{id:'closed',date:'2026-11-03',teacher:'أ',status:'decided',archivedAt:new Date('2026-11-04'),archivePdf:'JVBERg=='},{id:'gone',teacher:'أ',status:'deleted'},{id:'waiting',teacher:'أ',date:'2026-11-07',status:'sent'}];
  const user={uid:'teacher-1'},auth={currentUser:user,onAuthStateChanged:cb=>authCallback=cb};
  const rawDb={collection(name){
    assert.equal(name,'accountability');
    return {where(field,op,name){
      assert.deepEqual([field,op,name],['teacher','==','أ']);
      return {onSnapshot(cb){cb({docs:records.map(a=>({id:a.id,data:()=>a}))});return ()=>{}}};
    }};
  }};
  vm.runInNewContext(fs.readFileSync('teacher-acc.js','utf8'),{window:{ACC:A},document,auth,rawDb,profile:{scheduleName:'أ'},location:{hash:''},setTimeout,console});
  authCallback(user);assert.ok(section.innerHTML.includes('الرد القديم'));assert.ok(!section.innerHTML.includes('acc-gone'));
  assert.ok(section.innerHTML.indexOf('acc-waiting')<section.innerHTML.indexOf('acc-old'));
  elements.get('accStatus').onchange({target:{value:'archived'}});assert.ok(section.innerHTML.includes('acc-closed'));assert.ok(!section.innerHTML.includes('acc-old'));
  elements.get('accMonth').onchange({target:{value:'2026-10'}});assert.ok(section.innerHTML.includes('لا توجد مساءلات مطابقة'));
});
test('snapshot comparison ignores Firestore map ordering but detects actual edits',()=>{
  const {A}=setup();
  const first={teacher:'معلم',status:'decided',decidedAt:{seconds:123,nanoseconds:45},items:['أ','ب'],nested:{x:1,y:2}};
  const reordered={nested:{y:2,x:1},items:['أ','ب'],decidedAt:{nanoseconds:45,seconds:123},status:'decided',teacher:'معلم'};
  assert.equal(A.sameRecord(first,reordered),true);
  assert.equal(A.sameRecord(first,{...reordered,decision:'تعديل حقيقي'}),false);
  assert.equal(A.sameRecord(first,{...reordered,items:['ب','أ']}),false);
  assert.equal(A.sameRecord(first,{...reordered,decidedAt:{seconds:123,nanoseconds:46}}),false);
});

test('older archived PDFs are rendered again as the one-page preview without changing original bytes',async()=>{
 const env=setup();const old={id:'legacy-archived',teacher:'معلم',date:'2026-10-01',archivePdf:'old-multipage-bytes',archiveFileName:'مساءلة-old.pdf',archiveVersion:1};
 const f=await env.A.pdfFile(old);assert.ok(f.size);assert.equal(env.captures,1);assert.equal(old.archivePdf,'old-multipage-bytes');
});
