/* noor-import.js — converts a student list exported from Noor (pasted from Excel with its header row, or a CSV file)
   into the column order the "مطابقة قوائم فيوكلاس" window expects: name, section code, civil ID, guardian phone.
   Columns are found by their Arabic headers, in any order. Nothing is saved here: the manager still previews and approves. */
(function(root){'use strict';
if(!root.document)return;
const digits=v=>String(v==null?'':v).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776));
const norm=v=>digits(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
function parse(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').filter(l=>l.trim());if(!lines.length)return [];
  const sample=lines.slice(0,5).join('\n'),sep=sample.includes('\t')?'\t':(sample.split(';').length>sample.split(',').length?';':',');
  return lines.map(line=>{if(sep==='\t')return line.split('\t').map(c=>c.trim());const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}else if(ch==='"')q=true;else if(ch===sep){out.push(cur.trim());cur='';}else cur+=ch;}out.push(cur.trim());return out;});
}
function gradeOf(v){const t=norm(v);if(/^[123]$/.test(t))return t;if(/اول|الاول|1/.test(t))return '1';if(/ثاني|الثاني|2/.test(t))return '2';if(/ثالث|الثالث|3/.test(t))return '3';return '';}
function columns(head){
  const h=head.map(norm),find=(re,prefer)=>{const all=h.map((x,i)=>re.test(x)?i:-1).filter(i=>i>=0);if(!all.length)return -1;const p=prefer?all.find(i=>prefer.test(h[i])):undefined;return p!==undefined?p:all[0];};
  return {name:find(/اسم/,/الطالب/),id:find(/هويه|سجل|اقامه|الهويه/),grade:find(/^الصف|الصف الدراسي|المرحله|^صف/),section:find(/فصل|شعبه/),phone:find(/جوال|هاتف|موبايل|تواصل/,/ولي|الامر/)};
}
function convert(text){
  const rows=parse(text);let at=rows.findIndex(r=>r.some(c=>/اسم/.test(norm(c))));if(at<0)return {error:'لم أجد صف العناوين (يجب أن يحتوي عمودًا باسم «اسم الطالب»).'};
  const col=columns(rows[at]);if(col.name<0)return {error:'لم أجد عمود اسم الطالب.'};
  const out=[],skipped=[];
  for(const r of rows.slice(at+1)){
    const name=String(r[col.name]||'').trim();if(!name)continue;
    const secRaw=col.section>=0?digits(r[col.section]):'',grRaw=col.grade>=0?String(r[col.grade]||''):'';
    const combo=/([123])\s*[\/\-ث]\s*(\d{1,2})/.exec(secRaw)||/([123])\s*[\/\-ث]\s*(\d{1,2})/.exec(digits(grRaw));
    const grade=combo?combo[1]:gradeOf(grRaw),section=combo?combo[2]:secRaw.replace(/\D/g,'');
    if(!grade||!section||+section<1){skipped.push(name);continue;}
    const id=col.id>=0?digits(r[col.id]).replace(/\D/g,''):'',phone=col.phone>=0?digits(r[col.phone]).replace(/[^\d+]/g,''):'';
    out.push([name,grade+'/'+(+section),id,phone].join('\t'));
  }
  return {lines:out,skipped,found:col};
}
function mount(dialog,target){
  if(dialog.querySelector('.noor-box'))return;
  const box=document.createElement('details');box.className='noor-box';
  box.innerHTML='<summary>تحويل كشف نظام نور</summary><p>صدّر كشف الطلاب من نور إلى Excel، ثم انسخ الجدول كاملًا مع صف العناوين والصقه هنا، أو ارفع ملف CSV. تُعرف الأعمدة من عناوينها: اسم الطالب، رقم الهوية، الصف، الفصل، جوال ولي الأمر.</p><textarea rows="5" class="noor-text" dir="rtl"></textarea><div class="noor-row"><input type="file" accept=".csv,.txt,text/csv,text/plain" class="noor-file" aria-label="ملف CSV من نور"><button type="button" class="noor-go">تحويل ووضعها في خانة المطابقة</button></div><p class="noor-status" role="status"></p>';
  target.before(box);
  const status=t=>{box.querySelector('.noor-status').textContent=t;};
  box.querySelector('.noor-file').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;if(f.size>5*1024*1024){status('الملف أكبر من 5 ميجابايت.');return;}box.querySelector('.noor-text').value=await f.text();status('قُرئ الملف. اضغط «تحويل».');});
  box.querySelector('.noor-go').addEventListener('click',()=>{
    const r=convert(box.querySelector('.noor-text').value);if(r.error){status(r.error);return;}
    if(!r.lines.length){status('لم أجد طلابًا بصف وفصل صالحين.');return;}
    target.value=r.lines.join('\n');target.dispatchEvent(new Event('input',{bubbles:true}));
    const miss=[];if(r.found.id<0)miss.push('رقم الهوية');if(r.found.phone<0)miss.push('جوال ولي الأمر');
    status('حُوّل '+r.lines.length+' طالبًا إلى خانة المطابقة'+(r.skipped.length?' · تُرك '+r.skipped.length+' بلا صف أو فصل واضح: '+r.skipped.slice(0,5).join('، '):'')+(miss.length?' · لم أجد عمود: '+miss.join('، '):'')+'. اضغط «معاينة المطابقة» للمراجعة قبل الاعتماد.');
  });
  if(!document.getElementById('noorCss')){const css=document.createElement('style');css.id='noorCss';css.textContent='.noor-box{border:1px dashed #a5c5ba;border-radius:10px;padding:8px 12px;margin:8px 0;background:#f7fbf9}.noor-box summary{font-weight:700;cursor:pointer;color:#17624d}.noor-box p{font-size:13px;color:#5b6b66}.noor-box textarea{width:100%;box-sizing:border-box;font:inherit}.noor-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}.noor-status{font-weight:600;color:#17624d}';document.head.append(css);}
}
function tick(){
  for(const d of document.querySelectorAll('dialog')){
    if(!/مطابقة قوائم فيوكلاس/.test(d.textContent||''))continue;
    const target=d.querySelector('textarea:not(.noor-text)');if(target)mount(d,target);
  }
}
root.NoorImport={convert,parse};
if(root.SchoolTick)root.SchoolTick.add(tick);else setInterval(tick,1500);
})(window);
