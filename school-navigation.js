/* Move existing controls into one school navigation; preserve their listeners and role gates. */
(function(root){'use strict';if(!root.document)return;document.body.classList.add('school-ui');
const groups=[
{key:'students',title:'شؤون الطلاب',note:'حضور الطلاب وملفاتهم وأولياء الأمور والإذاعة',ids:['vStudentAttendance','schoolProfilesLink','schoolFamilyLink','schoolRadioLink','schoolRosterSyncBtn']},
{key:'day',title:'المعلمون والمتابعة اليومية',note:'جدول اليوم والانتظار والمناوبة والزيارات',ids:['vSchedule','vSubs','vSchoolDuty','vStaff','schoolSupervisionLink']},
{key:'schedules',title:'الجداول',note:'الجدول المدرسي والجدول الحضوري',ids:['vTimetable','schoolTimetableBuilderLink','vSchoolSchedule']},
{key:'followup',title:'التقارير',note:'مركز التقارير ومؤشرات المدرسة',ids:['schoolReportsLink','vReport','vBoard']},
{key:'people',title:'المنسوبون والاعتمادات',note:'الدليل والتكليفات والتوقيعات والمساءلات والنماذج',ids:['vTeachers','vAssignments','vCoordinatorPage','vSignatures','vAcc','schoolFormsLink','schoolPlansLink']},
{key:'admin',title:'الإدارة',note:'الإعدادات والحسابات وسجل العمليات',ids:['vStaffSettings','vEmployeeAccounts','schoolAuditLink','vSchoolStudents','namesBtn','securityAuditBtn','securityLoginBtn']}
];
const labels={vSchoolSchedule:'الجدول الحضوري والفصول',vEmployeeAccounts:'الحسابات والصلاحيات',namesBtn:'إعدادات المدرسة',pwBtn:'كلمة مروري',securityAuditBtn:'سجل الأمان والدخول',securityLoginBtn:'أمان الدخول',vTeachers:'دليل المنسوبين',vBoard:'مؤشرات المدرسة',vStaff:'متابعة المسؤولين والمشرفين',vSignatures:'التوقيعات والإقرارات',schoolRosterSyncBtn:'مطابقة قوائم الطلاب'};
const $=id=>document.getElementById(id),personal=!!root.TeacherPortal||!!root.EmployeePortal;let queued=false;
function move(button,target){if(button&&target&&button.parentElement!==target)target.append(button)}
function rename(button,label){if(button&&label&&button.textContent.trim()!==label)button.textContent=label}
function accountTools(){const center=$('eaMain');if(!center)return;const title=center.querySelector('h2');if(title&&title.textContent!=='الحسابات والصلاحيات')title.textContent='الحسابات والصلاحيات';let section=$('schoolAccountTools');if(!section){section=document.createElement('section');section.id='schoolAccountTools';section.className='school-account-tools';section.innerHTML='<h3>إدارة الحسابات وتوزيع المسؤوليات</h3><p>إضافة حسابات المعلمين، وتوزيع مهام الإداريين والمشرفين، وإعداد حساب مسؤول رصد المساءلات.</p><div class="school-account-actions"></div>';const header=center.querySelector('.ea-actions');if(header)header.after(section);else center.prepend(section)}const box=section.querySelector('.school-account-actions');for(const id of ['vCreateTeacher','vPersonalTasks','vRecorderAccount'])move($(id),box)}
function sync(){queued=false;if(personal&&root.SchoolWorkspace?.active)return;if(personal){const actions=document.querySelector('#account .welcome .actions');if(!actions)return;actions.classList.add('school-personal-actions');const map=[{key:'documents',title:'المهام والمستندات',ids:['vAssignments','vSignatures']},{key:'learning',title:'الجداول والتقارير',ids:['vSchoolSchedule','printReport','downloadPdf']}];for(const g of map){let group=actions.querySelector('[data-personal-group="'+g.key+'"]');if(!group){group=document.createElement('div');group.className='school-personal-group';group.dataset.personalGroup=g.key;group.innerHTML='<span>'+g.title+'</span><div></div>';actions.append(group)}const box=group.querySelector('div');for(const id of g.ids){const button=$(id);if(button){rename(button,id==='vSchoolSchedule'?'ملفات الجداول':id==='vAssignments'?'تكليفاتي':id==='vSignatures'?'التوقيعات والإقرارات':null);move(button,box)}}const empty=![...box.children].some(b=>!b.hidden);if(group.hidden!==empty)group.hidden=empty}return}
const nav=document.querySelector('.views');if(!nav)return;nav.classList.add('school-hub');nav.setAttribute('role','navigation');nav.setAttribute('aria-label','أقسام المدرسة');const rosterSync=[...nav.querySelectorAll('button')].find(b=>!b.id&&/مطابقة قوائم فيوكلاس/.test(b.textContent));if(rosterSync)rosterSync.id='schoolRosterSyncBtn';for(const [i,g]of groups.entries()){let section=$('schoolGroup-'+g.key);if(!section){section=document.createElement('section');section.id='schoolGroup-'+g.key;section.className='school-nav-group';section.innerHTML='<header><span class="school-group-order">'+String(i+1).padStart(2,'0')+'</span><div><h3>'+g.title+'</h3><p>'+g.note+'</p></div></header><div class="school-nav-links"></div>';nav.append(section)}const box=section.querySelector('.school-nav-links');for(const id of g.ids){const button=$(id);if(button){rename(button,labels[id]);move(button,box)}}const ordered=g.ids.map(id=>$(id)).filter(b=>b&&b.parentElement===box),now=[...box.children].filter(b=>ordered.includes(b));if(ordered.some((b,n)=>now[n]!==b))for(const b of ordered)box.append(b);const restricted=['people','admin'].includes(g.key)&&root.__FUACC?.state?.role!==-1;const empty=restricted||![...box.children].some(b=>!b.hidden);if(section.hidden!==empty)section.hidden=empty}accountTools();}
function schedule(){if(!queued){queued=true;queueMicrotask(sync)}}
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});sync();
})(window);


/* Load the school home from the existing shared navigation entry point. */
(function(){if(typeof document==='undefined'||document.getElementById('schoolWorkspaceLoader'))return;const css=document.createElement('link');css.rel='stylesheet';css.href='school-workspace.css?v=20261110-1';document.head.append(css);const script=document.createElement('script');script.id='schoolWorkspaceLoader';script.src='school-workspace.js?v=20261110-1';document.head.append(script)})();


/* Responsive shared sidebar: retains original controls, handlers and role gates. */
(function(root){
'use strict';
if(!root.document||new URLSearchParams(location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id),personal=!!root.TeacherPortal||!!root.EmployeePortal,recorder=!!root.AccountabilityRecorder;
const style=document.createElement('style');style.id='schoolSidebarStyle';style.textContent=`
:root{--school-sidebar-width:278px}
#schoolGroup-admin .school-nav-links>button:not(#vStaffSettings):not(#schoolAuditLink){display:none!important}
body.school-sidebar-page{background:#f3f6f8}
.school-sidebar-page>.wrap,.school-sidebar-page>.shell{max-width:none;margin-inline-start:var(--school-sidebar-width);padding:28px 32px 70px;min-width:0}
.school-sidebar{position:fixed;inset-block:0;inset-inline-start:0;width:var(--school-sidebar-width);box-sizing:border-box;background:#123e36;color:#fff;z-index:80;display:flex;flex-direction:column;box-shadow:-5px 0 28px #123e3612;font-family:inherit;direction:rtl}
.school-sidebar-brand{display:flex;align-items:center;gap:12px;padding:26px 20px 20px;border-bottom:1px solid #ffffff1c}
.school-sidebar-seal{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#ffffff16;color:#e6c984;font-size:25px;flex:none;border:1px solid #ffffff25}
.school-sidebar-brand strong{display:block;font-size:16px;line-height:1.6}
.school-sidebar-brand small{display:block;font-size:11px;color:#b7cfc7;margin-top:3px}
.school-sidebar-account{margin:16px 18px 5px;padding:12px 14px;border:1px solid #ffffff20;border-radius:12px;background:#ffffff09}
.school-sidebar-account span{display:block;color:#a6c5b9;font-size:11px;margin-bottom:4px}
.school-sidebar-account strong{font-size:13px;line-height:1.7;overflow-wrap:anywhere}
.school-sidebar-links{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:12px 14px 24px;scrollbar-width:thin;scrollbar-color:#53776b transparent}
.school-sidebar .views.school-hub{display:flex!important;flex-direction:column;width:100%;gap:20px;border:0;background:none;padding:0}
.school-sidebar .school-nav-group{padding:0;border:0;border-radius:0;background:none;box-shadow:none;width:100%}
.school-sidebar .school-nav-group header{border:0;padding:0 10px;margin:0 0 8px;align-items:center;gap:8px}
.school-sidebar .school-nav-group h3{font-size:11px;color:#acc7bd;font-weight:500}
.school-sidebar .school-nav-group header p{display:none}
.school-sidebar .school-group-order{background:none;color:#86ab9c;font-size:10px;width:auto;height:auto;flex-basis:auto}
.school-sidebar .school-nav-links{display:grid;grid-template-columns:1fr;gap:5px}
.school-sidebar .school-workspace-nav{display:grid!important;grid-template-columns:1fr;gap:6px;background:none;border:0;padding:0;margin:0}
.school-sidebar .school-nav-links button,.school-sidebar .school-workspace-nav button,.school-sidebar-links>.school-recorder-link{width:100%;min-height:45px;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;gap:10px;text-align:right;background:transparent;border:1px solid transparent;color:#e1eee8;padding:11px 13px;border-radius:10px;font:inherit;font-size:13px;line-height:1.6;cursor:pointer;box-shadow:none;white-space:normal}
.school-sidebar .school-nav-links button:before,.school-sidebar .school-workspace-nav button:before,.school-recorder-link:before{content:'◈';font-size:15px;color:#8bb4a2;width:18px;flex:none;text-align:center}
.school-sidebar .school-nav-links button:hover,.school-sidebar .school-workspace-nav button:hover{background:#ffffff0d;border-color:#ffffff18}
.school-sidebar .school-nav-links button[aria-pressed=true],.school-sidebar button[data-sidebar-active=true]{background:#e5f1ea!important;color:#143e32!important;font-weight:700;border-color:#e5f1ea;box-shadow:0 4px 12px #0000000c}
.school-sidebar button[data-sidebar-active=true]:before,.school-sidebar button[aria-pressed=true]:before{color:#176c4e}
.school-sidebar-footer{border-top:1px solid #ffffff1c;padding:14px 18px 18px;display:grid;gap:12px}
.school-sidebar-footer button{width:100%;background:#ffffff09;border:1px solid #ffffff26;color:#f8e3df;border-radius:10px;min-height:42px;padding:9px 12px;font:inherit;font-size:13px;cursor:pointer}
.school-sidebar-footer small{color:#8fafa1;font-size:10px;text-align:center}
.school-sidebar-toggle{display:none;position:fixed;inset-inline-start:14px;top:14px;z-index:85;min-height:42px;padding:9px 14px;background:#123e36;color:white;border:1px solid #ffffff30;border-radius:11px;font:inherit;font-size:13px;box-shadow:0 4px 16px #123e3626;cursor:pointer}
.school-sidebar-close{display:none;background:none;border:1px solid #ffffff35;color:white;border-radius:8px;min-width:34px;min-height:34px;margin-inline-start:auto;font-size:20px;cursor:pointer}
.school-sidebar-overlay{display:none}
.school-sidebar-page .top,.school-sidebar-page .topbar{background:white;padding:20px 24px;border:1px solid #dae5df;border-radius:18px;margin-bottom:22px;box-shadow:0 3px 16px #183e2e05;gap:16px;flex-wrap:wrap}
.school-sidebar-page .top h1,.school-sidebar-page .topbar h1{font-size:21px}
.school-sidebar-page .top .clock{flex-wrap:wrap}
.school-sidebar-page .overview-summary{border-radius:18px}
.school-sidebar-page .nav{display:flex;flex-direction:column;align-items:stretch;gap:12px;margin-bottom:20px}
.school-sidebar-page .weeknav{flex-wrap:wrap}
.school-sidebar-page .school-workspace-section{box-shadow:0 4px 18px #173e2b06;border-color:#dce6e0}
.school-sidebar-page .school-workspace-section>summary{background:#fff;padding:20px}
.school-sidebar-page .school-workspace-section[open]>summary{background:#f8fbf9}
.school-sidebar-page .school-workspace-title{font-size:18px}
.school-sidebar-page .school-workspace-body{background:white}
.school-sidebar-page .school-workspace-section{scroll-margin-top:20px}
.school-sidebar-page.school-recorder-page #acDrawer{inset-inline-start:var(--school-sidebar-width);width:auto}
.school-sidebar [hidden],.school-sidebar-toggle[hidden],.school-sidebar[hidden]{display:none!important}
@media(max-width:1000px){
.school-sidebar-page>.wrap,.school-sidebar-page>.shell{margin-inline-start:0;padding:76px 18px 48px}
.school-sidebar{transform:translateX(105%);transition:transform .2s ease;z-index:120;width:min(290px,86vw);visibility:hidden}
.school-sidebar-page.school-sidebar-open .school-sidebar{transform:translateX(0);visibility:visible}
.school-sidebar-toggle{display:block}
.school-sidebar-close{display:block}
.school-sidebar-page.school-sidebar-open{overflow:hidden}
.school-sidebar-page.school-sidebar-open .school-sidebar-overlay{display:block;position:fixed;inset:0;z-index:110;background:#0d241e85;backdrop-filter:blur(2px)}
.school-sidebar-page .top,.school-sidebar-page .topbar{padding:18px}
.school-sidebar-page .top h1,.school-sidebar-page .topbar h1{font-size:18px}
.school-sidebar-page.school-recorder-page #acDrawer{inset-inline-start:0;padding-top:66px}
}
@media(prefers-reduced-motion:reduce){.school-sidebar{transition:none}}
@media print{
.school-sidebar,.school-sidebar-toggle,.school-sidebar-overlay{display:none!important}
.school-sidebar-page>.wrap,.school-sidebar-page>.shell{margin:0!important;padding:0!important}
.school-sidebar-page.school-recorder-page #acDrawer{inset-inline-start:0}
body.school-sidebar-page{background:white}
}
`;document.head.append(style);
const side=document.createElement('aside');side.id='schoolSidebar';side.className='school-sidebar';side.setAttribute('aria-label','القائمة الرئيسية');
side.innerHTML='<div class="school-sidebar-brand"><div class="school-sidebar-seal school-brand-seal"><img class="school-brand-logo" src="assets/sahafa-school-logo.jpeg" alt="شعار مدارس الصحافة الأهلية" width="1320" height="1162"></div><div><strong>ثانوية الصحافة الأهلية</strong><small>منصة الإدارة والمتابعة</small></div><button type="button" class="school-sidebar-close" aria-label="إغلاق القائمة">×</button></div><div class="school-sidebar-account"><span>مساحة العمل</span><strong id="schoolSidebarAccount"></strong></div><div class="school-sidebar-links"></div><div class="school-sidebar-footer"><div class="school-sidebar-session"></div><small>إعداد وتنفيذ / بكر الدوخي</small></div>';
const toggle=document.createElement('button');toggle.type='button';toggle.id='schoolSidebarToggle';toggle.className='school-sidebar-toggle';toggle.textContent='☰ القائمة الرئيسية';toggle.setAttribute('aria-controls',side.id);toggle.setAttribute('aria-expanded','false');
const overlay=document.createElement('div');overlay.className='school-sidebar-overlay';overlay.setAttribute('aria-hidden','true');
document.body.append(side,toggle,overlay);
const media=root.matchMedia('(max-width:1000px)'),links=side.querySelector('.school-sidebar-links'),session=side.querySelector('.school-sidebar-session');
let queued=false,lastFocus=null,selected=personal?(root.EmployeePortal?'followup':'schedule'):(new URLSearchParams(location.search).has('view')?'native':'home');
const sectionMap={vCoordinatorPage:'assignments',vAssignments:'assignments',vSignatures:'signatures',vSchoolDuty:'duty',vSchoolSchedule:'duty',vSchoolStudents:'duty',vAcc:'accountability',vEmployeeAccounts:'accounts'};
const nativeIds=['vSchedule','vReport','vTeachers','vBoard','vStaff','vStudentAttendance'];
const selectionStyle=document.createElement('style');document.head.append(selectionStyle);
function selectSection(key){
selected=key;
let css='.school-sidebar-page #schoolWorkspace>.school-workspace-section{display:none!important}';
if(key!=='native'){
css+='.school-sidebar-page #schoolSection-'+key+':not([hidden]){display:block!important}';
if(!personal)css+='.school-sidebar-page #scheduleView,.school-sidebar-page #reportView,.school-sidebar-page #teachersView,.school-sidebar-page #boardView,.school-sidebar-page #staffView,.school-sidebar-page #studentAttendance,.school-sidebar-page #overviewSummary,.school-sidebar-page .wrap>.nav,.school-sidebar-page #dueBar{display:none!important}';
}
if(key==='home')css+='.school-sidebar-page #banner,.school-sidebar-page .wrap>.foot,.school-sidebar-page>.credit{display:none!important}';
css+='.school-sidebar-page #schoolWorkspace>details>summary{pointer-events:none;list-style:none}.school-sidebar-page #schoolWorkspace>details>summary::marker{content:""}';
if(selectionStyle.textContent!==css)selectionStyle.textContent=css;
const region=$('schoolSection-'+key);if(region&&!region.hidden)region.open=true;
}
selectSection(selected);
root.SchoolNav={select:key=>selectSection(key),selected:()=>selected};
function close(restore=false){document.body.classList.remove('school-sidebar-open');toggle.setAttribute('aria-expanded','false');side.removeAttribute('role');side.removeAttribute('aria-modal');if(restore&&lastFocus?.isConnected)lastFocus.focus()}
function open(){lastFocus=document.activeElement;document.body.classList.add('school-sidebar-open');toggle.setAttribute('aria-expanded','true');side.setAttribute('role','dialog');side.setAttribute('aria-modal','true');side.querySelector('.school-sidebar-close').focus()}
toggle.onclick=()=>document.body.classList.contains('school-sidebar-open')?close(true):open();
side.querySelector('.school-sidebar-close').onclick=()=>close(true);overlay.onclick=()=>close(true);
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('school-sidebar-open'))return;if(e.key==='Escape'){e.preventDefault();close(true)}if(e.key==='Tab'){const focusable=[...side.querySelectorAll('button,a[href]')].filter(n=>n.getClientRects().length&&!n.disabled);const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
media.addEventListener('change',()=>close());
side.addEventListener('click',e=>{const b=e.target.closest('.school-sidebar-links button');if(!b||b.disabled||b.classList.contains('school-group-toggle'))return;const key=b.dataset.workspaceKey||sectionMap[b.id]||(nativeIds.includes(b.id)?'native':null);if(key){selectSection(key);for(const old of links.querySelectorAll('[aria-pressed=true]'))if(old!==b)old.setAttribute('aria-pressed','false');requestAnimationFrame(()=>{const r=$('schoolSection-'+key);if(r)r.scrollIntoView({block:'start'})})}for(const old of links.querySelectorAll('[data-sidebar-active]'))old.removeAttribute('data-sidebar-active');b.dataset.sidebarActive='true';if(media.matches){close();const heading=document.querySelector('#schoolWorkspace details[open]:not([hidden]) summary')||document.querySelector('.top h1,.topbar h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}}});
function move(node,target){if(node&&node.parentElement!==target)target.append(node)}
function sync(){
queued=false;
const account=$('account'),nav=personal?$('schoolWorkspaceNav'):document.querySelector('.views'),gate=$('gate');
const ready=personal?!!account&&!account.hidden:recorder?root.__FUACC?.state?.role==='recorder':!!nav;
if(side.hidden===ready)side.hidden=!ready;if(toggle.hidden===ready)toggle.hidden=!ready;
document.body.classList.toggle('school-sidebar-page',ready);document.body.classList.toggle('school-recorder-page',recorder&&ready);
if(!ready){close();return}
move(nav,links);if(!personal&&!recorder&&selected==='home'&&root.__FUACC?.state?.role!=null&&root.__FUACC.state.role!==-1)selected='native';selectSection(selected);if(selected==='home'){for(const id of nativeIds)$(id)?.setAttribute('aria-pressed','false');for(const b of links.querySelectorAll('[data-sidebar-active]'))b.removeAttribute('data-sidebar-active')}
const name=personal?$('name')?.textContent.trim():null;
const role=personal?(root.EmployeePortal?'حساب الإداري':'حساب المعلم'):recorder?'مسؤول رصد المساءلات':root.__FUACC?.state?.role===-1?'حساب مدير المدرسة':root.__FUACC?.state?.role!=null?'حساب المتابعة':'الإدارة والمتابعة';
const label=name?name+' · '+role:role;if($('schoolSidebarAccount').textContent!==label)$('schoolSidebarAccount').textContent=label;
if(!personal&&!recorder&&$('pwBtn')){move($('pwBtn'),session);if($('pwBtn').textContent.trim()!=='كلمة مروري')$('pwBtn').textContent='كلمة مروري'}move($(personal?'logout':'logoutBtn'),session);
if(recorder&&!links.querySelector('.school-recorder-link')){const b=document.createElement('button');b.type='button';b.className='school-recorder-link';b.textContent='رصد المساءلات';b.onclick=()=>$('acDrawer')?.scrollIntoView({behavior:'smooth'});links.append(b)}
if(selected!=='home'&&!links.querySelector('[data-sidebar-active=true]')&&!links.querySelector('[aria-pressed=true]')){const first=[...links.querySelectorAll('button')].find(b=>!b.hidden&&!b.closest('[hidden]'));if(first)first.dataset.sidebarActive='true'}
}
function schedule(){if(!queued){queued=true;queueMicrotask(sync)}}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});sync();
})(window);

/* Four compact navigation groups, one expanded at a time. */
(function(){
'use strict';
if(typeof document==='undefined')return;
const css=document.createElement('style');
css.textContent=`
.school-sidebar .school-nav-group header{display:block;padding:0;margin:0}
.school-sidebar .school-group-toggle{display:flex;align-items:center;gap:10px;width:100%;min-height:55px;border:1px solid #ffffff24;border-radius:12px;background:#ffffff08;color:#e2eee8;padding:12px;text-align:right;font:inherit;cursor:pointer}
.school-sidebar .school-group-toggle:hover{background:#ffffff14}
.school-sidebar .school-group-toggle .school-group-order{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;border-radius:9px;background:#ffffff12;color:#dfc788;font-size:13px;font-weight:700}
.school-sidebar .school-group-toggle h3{font-size:13px;color:#e2eee8;font-weight:600;margin:0}
.school-sidebar .school-group-toggle:after{content:'+';margin-inline-start:auto;font-size:20px;color:#b9d2c5}
.school-sidebar .school-group-toggle[aria-expanded=true]{background:#ffffff17;border-color:#a8c4b46b}
.school-sidebar .school-group-toggle[aria-expanded=true]:after{content:'−'}
.school-sidebar .school-nav-group:not([data-school-expanded=true]) .school-nav-links{display:none!important}
.school-sidebar .school-nav-group[data-school-expanded=true] .school-nav-links{display:grid;gap:6px;padding:9px 3px 2px}
.school-sidebar .views.school-hub{gap:10px!important}
`;document.head.append(css);
let queued=false;
function sync(){
queued=false;
for(const group of document.querySelectorAll('.school-sidebar .school-nav-group')){
const header=group.querySelector('header'),links=group.querySelector('.school-nav-links');
if(!header||!links||header.querySelector('.school-group-toggle'))continue;
const button=document.createElement('button');button.type='button';button.className='school-group-toggle';
links.id=group.id+'-links';button.setAttribute('aria-controls',links.id);button.setAttribute('aria-expanded','false');
button.setAttribute('aria-label',header.textContent.trim());
const children=[...header.childNodes];button.append(...children);header.append(button);
button.addEventListener('click',()=>{
const expand=button.getAttribute('aria-expanded')!=='true';
for(const other of document.querySelectorAll('.school-sidebar .school-nav-group')){
other.removeAttribute('data-school-expanded');other.querySelector('.school-group-toggle')?.setAttribute('aria-expanded','false');
}
if(expand){group.dataset.schoolExpanded='true';button.setAttribute('aria-expanded','true')}
});
}
}
function schedule(){if(!queued){queued=true;queueMicrotask(sync)}}
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});sync();
})();


/* Page-style navigation like other websites:
   - "حصص الانتظار" opens inside the page as its own section instead of a panel over the page (manager page);
   - moving between sections is recorded in the browser history, so the phone/browser Back button returns to the previous section;
   - Back first closes an open side panel instead of leaving the platform. */
(function(root){
'use strict';
if(!root.document||new URLSearchParams(location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id),personal=!!root.TeacherPortal||!!root.EmployeePortal;
let restoring=false,skipPop=0,subsHost=null;
const css=document.createElement('style');
css.textContent='#schoolSection-subs>.drawer{position:static!important;inset:auto!important;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;transform:none!important;box-shadow:none!important;z-index:auto!important;border:1px solid #dae5df;border-radius:18px;background:#fff;display:flex;flex-direction:column}#schoolSection-subs #sbClose{display:none!important}#schoolSection-subs .drawer-body{overflow:visible!important;max-height:none!important}#schoolSection-subs .drawer-foot{position:static!important}';
document.head.append(css);
const keyOf=b=>b.id||(b.dataset.workspaceKey?'k:'+b.dataset.workspaceKey:'');
const buttonOf=k=>k.startsWith('k:')?document.querySelector('.school-sidebar-links button[data-workspace-key="'+k.slice(2)+'"]'):$(k);
function current(){return (history.state&&history.state.schoolNav)||''}
function push(entry){try{history.pushState(Object.assign({},history.state||{},entry),'',location.href)}catch(e){}}
// Section changes from the sidebar.
document.addEventListener('click',e=>{
  const b=e.target.closest('.school-sidebar-links button');
  if(!b||restoring||b.classList.contains('school-group-toggle'))return;
  const k=keyOf(b);if(!k)return;
  setTimeout(()=>{if(restoring)return;const opened=openDrawer();if(opened&&k!=='vSubs')return;if(current()!==k)push({schoolNav:k,schoolDrawer:null})},0);
},true);
// Side panels opened over the page (direct children of body).
const drawers=()=>[...document.querySelectorAll('body>.drawer')];
function openDrawer(){return drawers().find(d=>!d.hidden)}
function closeDrawer(d){const x=d.querySelector('[id$=Close]')||[...d.querySelectorAll('button')].find(b=>/إغلاق/.test(b.textContent));if(x)x.click();else{d.hidden=true;const s=$(d.id.replace('Drawer','Scrim'));if(s)s.hidden=true}}
const seen=new WeakMap();
function watchDrawers(){
  for(const d of drawers()){
    const was=seen.get(d),now=!d.hidden;seen.set(d,now);
    if(was===undefined||was===now)continue;
    if(now&&!restoring)push({schoolDrawer:d.id});
    else if(!now&&history.state&&history.state.schoolDrawer===d.id){skipPop++;history.back()}
  }
}
// Substitutions inside the page (manager only).
function inlineSubs(){
  if(personal)return;const d=$('sbDrawer'),ws=$('schoolWorkspace'),b=$('vSubs');if(!d||!ws)return;
  if(!subsHost||!subsHost.isConnected){subsHost=document.createElement('section');subsHost.id='schoolSection-subs';subsHost.className='school-workspace-section school-inline-subs';subsHost.setAttribute('aria-label','حصص الانتظار');ws.append(subsHost)}
  if(b&&b.dataset.workspaceKey!=='subs')b.dataset.workspaceKey='subs';
  if(!d.hidden&&d.parentElement!==subsHost){subsHost.append(d);const s=$('sbScrim');if(s)s.hidden=true;if(root.SchoolNav)root.SchoolNav.select('subs')}
  if(d.parentElement===subsHost){const s=$('sbScrim');if(s&&!s.hidden)s.hidden=true;if(d.hidden&&root.SchoolNav&&root.SchoolNav.selected()==='subs')d.hidden=false}
}
root.addEventListener('popstate',e=>{
  if(skipPop){skipPop--;return}
  const dialog=[...document.querySelectorAll('dialog[open]')].pop();
  if(dialog){dialog.close();return}
  const open=openDrawer();
  if(open){restoring=true;closeDrawer(open);seen.set(open,false);restoring=false;return}
  const k=(e.state&&e.state.schoolNav)||'';
  restoring=true;
  try{
    const b=k?buttonOf(k):($('schoolHomeLink')||null);
    if(b){b.click();root.scrollTo(0,0)}else if(root.SchoolNav)root.SchoolNav.select(personal?(root.EmployeePortal?'followup':'schedule'):'home');
  }finally{setTimeout(()=>{restoring=false},0)}
});
try{if(!history.state||!('schoolNav' in history.state))history.replaceState(Object.assign({},history.state||{},{schoolNav:''}),'',location.href)}catch(e){}
let queued=false;
function sync(){queued=false;inlineSubs();watchDrawers()}
new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(sync)}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
sync();
})(window);


/* Easier finding and orientation:
   - the group holding the current section opens by itself;
   - a heading at the top of the page shows "group › section" with a back button;
   - a quick search box at the top of the sidebar filters the buttons. */
(function(root){
'use strict';
if(!root.document||new URLSearchParams(location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const LAST='school-last-section',SECTION_IDS=['vSchedule','vReport','vTeachers','vBoard','vStaff','vStudentAttendance','vAssignments','vCoordinatorPage','vSignatures','vAcc','vSchoolDuty','vSchoolSchedule','vTimetable'];
const css=document.createElement('style');
css.textContent='#schoolCrumb{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #dae5df;border-radius:14px;padding:10px 14px;margin:0 0 14px;font-size:14px;color:#4a5e58}#schoolCrumb b{color:#123e36;font-size:16px}#schoolCrumb button{font:inherit;border:1px solid #a5c5ba;background:#fff;border-radius:9px;padding:5px 12px;cursor:pointer;color:#123e36}#schoolCrumb[hidden],#schoolCrumb button[hidden]{display:none}'+
  '.school-sidebar-search{margin:8px 14px 0;position:relative}.school-sidebar-search input{width:100%;box-sizing:border-box;border:1px solid #ffffff30;background:#ffffff12;color:#fff;border-radius:10px;padding:9px 12px;font:inherit;font-size:13px}.school-sidebar-search input::placeholder{color:#a9c4ba}.school-sidebar [data-search-hidden]{display:none!important}';
document.head.append(css);
const sidebarLinks=()=>document.querySelector('.school-sidebar-links');
const keyOf=b=>b.id||(b.dataset.workspaceKey?'k:'+b.dataset.workspaceKey:'');
const buttonOf=k=>k&&(k.startsWith('k:')?document.querySelector('.school-sidebar-links button[data-workspace-key="'+k.slice(2)+'"]'):$(k));
const restorable=b=>!!b&&(!!b.dataset.workspaceKey||SECTION_IDS.includes(b.id));
function activeButton(){const l=sidebarLinks();return l&&(l.querySelector('button[data-sidebar-active=true]')||l.querySelector('.school-nav-links button[aria-pressed=true]'))}
function expandFor(b){
  const group=b&&b.closest('.school-nav-group');if(!group||group.dataset.schoolExpanded==='true')return;
  for(const other of document.querySelectorAll('.school-sidebar .school-nav-group')){if(other!==group&&other.dataset.schoolExpanded){other.removeAttribute('data-school-expanded');const t=other.querySelector('.school-group-toggle');if(t)t.setAttribute('aria-expanded','false')}}
  group.dataset.schoolExpanded='true';const t=group.querySelector('.school-group-toggle');if(t)t.setAttribute('aria-expanded','true');
}
let crumb=null;
function paintCrumb(){
  const main=document.querySelector('.school-sidebar-page>.wrap,.school-sidebar-page>.shell');if(!main)return;
  if(!crumb||!crumb.isConnected){crumb=document.createElement('nav');crumb.id='schoolCrumb';crumb.setAttribute('aria-label','موقعك في المنصة');crumb.innerHTML='<button type="button" data-crumb-back>→ رجوع</button><span></span>';main.prepend(crumb);crumb.querySelector('[data-crumb-back]').onclick=()=>history.back()}
  const b=activeButton(),group=b&&b.closest('.school-nav-group'),gt=group&&group.querySelector('h3');
  const text=b?(gt?gt.textContent.trim()+' › ':'')+'<b>'+b.textContent.trim().replace(/[<>&]/g,'')+'</b>':'<b>الصفحة الرئيسية</b>';
  const span=crumb.querySelector('span');if(span.innerHTML!==text)span.innerHTML=text;
  const back=crumb.querySelector('[data-crumb-back]'),can=!!(history.state&&history.state.schoolNav);if(back.hidden===can)back.hidden=!can;
}
let searchBox=null;
function ensureSearch(){
  const side=$('schoolSidebar'),links=sidebarLinks();if(!side||!links||searchBox&&searchBox.isConnected)return;
  searchBox=document.createElement('div');searchBox.className='school-sidebar-search';searchBox.innerHTML='<input type="search" placeholder="ابحث عن قسم…" aria-label="البحث في أقسام المنصة">';
  links.before(searchBox);
  searchBox.querySelector('input').addEventListener('input',e=>{
    const q=e.target.value.trim();
    for(const b of links.querySelectorAll('.school-nav-links button')){const hit=!q||b.textContent.includes(q);if(hit)b.removeAttribute('data-search-hidden');else b.setAttribute('data-search-hidden','')}
    for(const g of document.querySelectorAll('.school-sidebar .school-nav-group')){
      const any=[...g.querySelectorAll('.school-nav-links button')].some(b=>!b.hasAttribute('data-search-hidden')&&!b.hidden);
      if(q){if(any){g.dataset.schoolExpanded='true';g.removeAttribute('data-search-hidden')}else g.setAttribute('data-search-hidden','')}
      else{g.removeAttribute('data-search-hidden');if(g.dataset.schoolExpanded)g.removeAttribute('data-school-expanded')}
    }
    if(!q)expandFor(activeButton());
  });
}
// The platform always opens on the home page after sign-in (the user asked not to reopen the last section).
try{localStorage.removeItem(LAST)}catch(err){}
function restoreLast(){}
let queued=false;
function sync(){queued=false;ensureSearch();const q=searchBox&&searchBox.querySelector('input').value.trim();if(!q)expandFor(activeButton());paintCrumb();restoreLast()}
const schedule=()=>{if(!queued){queued=true;setTimeout(sync,120)}};
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-sidebar-active','aria-pressed']});
root.addEventListener('popstate',schedule);
schedule();
})(window);
