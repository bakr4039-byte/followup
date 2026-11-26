/* home-dashboard.js — the manager's home page: today at a glance, what needs action now, and shortcuts.
   It reads what the page already renders (summary, overdue bar, reminders, loading card); it stores and changes nothing. */
(function(root){'use strict';
if(!root.document||root.TeacherPortal||root.EmployeePortal)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LINKS=[
 ['vSchedule','جدول اليوم','الحصص والرصد لهذا اليوم'],
 ['vStudentAttendance','حضور الطلاب','الحضور والغياب وتقاريره'],
 ['vReport','التقرير الأسبوعي','نسب الرصد والطباعة'],
 ['vBoard','مؤشرات المدرسة','الأرقام العامة'],
 ['vAcc','المساءلات','الرصد والقرارات والأرشيف'],
 ['vAssignments','التكليفات','المطلوب والمعتمد'],
 ['vSignatures','التوقيعات والإقرارات','طلبات التوقيع والملفات'],
 ['vSchoolDuty','المناوبات والإشراف','جداول المناوبة'],
 ['vSubs','حصص الانتظار','توزيع الانتظار'],
 ['vTeachers','دليل المنسوبين','بيانات المعلمين والإداريين']
];
let host=null,queued=false,last='';
function hijri(){try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())+'هـ'}catch(e){return ''}}
function ensure(){
  if(host&&host.isConnected)return host;
  const ws=$('schoolWorkspace');if(!ws)return null;
  host=document.createElement('section');host.id='schoolSection-home';host.className='school-workspace-section hd-home';host.hidden=true;
  host.setAttribute('aria-label','الصفحة الرئيسية');
  host.addEventListener('click',e=>{
    const go=e.target.closest('[data-go]');if(go){const t=$(go.dataset.go);if(t)t.click();return}
    const sc=e.target.closest('[data-scroll]');if(sc){const t=$(sc.dataset.scroll);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}
  });
  ws.prepend(host);return host;
}
function kpis(){
  const mode=$('weekMode'),opt=mode&&mode.selectedOptions&&mode.selectedOptions[0];
  const list=[{label:'نوع الأسبوع',value:opt?opt.textContent.replace(/\s*\(.*\)\s*/,''):'—',hint:(($('dayModesNotice')||{}).textContent||'').trim().slice(0,90)}];
  for(const m of document.querySelectorAll('#overviewSummary .overview-metric'))list.push({label:(m.querySelector('span')||{}).textContent||'',value:(m.querySelector('strong')||{}).textContent||'—',hint:(m.querySelector('small')||{}).textContent||''});
  return list;
}
function todo(){
  const items=[],lc=$('loadCard'),due=$('dueBar'),rem=$('actionReminders');
  if(lc&&!lc.hidden)items.push({text:'جارٍ تحميل بيانات الأسبوع…',kind:'wait'});
  if(due&&!due.hidden){const b=due.querySelector('b');const t=b?b.textContent.replace('⏰','').trim():'';if(t)items.push({text:t,go:'vSchedule',act:'فتح جدول اليوم'})}
  if(rem&&!rem.hidden&&rem.textContent.trim())items.push({text:'لديك طلبات توقيع أو اعتماد تنتظر إجراءك',scroll:'actionReminders',act:'عرض الطلبات'});
  if(!items.length)items.push({text:'لا توجد مهام متأخرة الآن',kind:'ok'});
  return items;
}
function paint(){
  queued=false;const h=ensure();if(!h)return;
  const show=!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1);
  if(h.hidden===show)h.hidden=!show;if(!show)return;
  const links=LINKS.filter(([id])=>{const b=$(id);return b&&!b.hidden&&!b.closest('[hidden]')});
  const html='<div class="hd-hero"><p>'+esc(hijri())+'</p><h2>'+(new Date().getHours()<12?'صباح الخير':'مساء الخير')+'، مدير المدرسة</h2><p>ملخص المتابعة وما ينتظر إجراءك اليوم</p></div>'+
    '<div class="hd-kpis">'+kpis().map(k=>'<div class="hd-kpi"><span>'+esc(k.label)+'</span><strong>'+esc(k.value)+'</strong><small>'+esc(k.hint)+'</small></div>').join('')+'</div>'+
    '<section class="hd-block"><h3>مطلوب الآن</h3><ul class="hd-todo">'+todo().map(t=>'<li class="'+(t.kind||'')+'"><span>'+esc(t.text)+'</span>'+(t.go?'<button type="button" data-go="'+t.go+'">'+esc(t.act)+'</button>':t.scroll?'<button type="button" data-scroll="'+t.scroll+'">'+esc(t.act)+'</button>':'')+'</li>').join('')+'</ul></section>'+
    '<section class="hd-block"><h3>اختصارات</h3><div class="hd-links">'+links.map(([id,t,n])=>'<button type="button" class="hd-link" data-go="'+id+'"><b>'+esc(t)+'</b><small>'+esc(n)+'</small></button>').join('')+'</div></section>';
  if(html===last)return;last=html;h.innerHTML=html;
}
function schedule(){if(!queued){queued=true;queueMicrotask(paint)}}
new MutationObserver(muts=>{if(host&&muts.every(m=>host.contains(m.target)))return;schedule()}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
setInterval(schedule,60000);schedule();
})(window);
