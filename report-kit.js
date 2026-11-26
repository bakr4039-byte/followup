/* report-kit.js — one official look for every printed report:
   school logo and name, title and period, tables, signature row and issue date.
   Usage: ReportKit.open({title, subtitle, body, landscape, signatures}) opens a print/PDF window. */
(function(root){'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SCHOOL='ثانوية الصحافة الأهلية';
const CSS='*{box-sizing:border-box}'+
'body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;direction:rtl;color:#13231f;margin:0;font-size:12.5px;line-height:1.6;background:#fff}'+
'.rk-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;background:#0E6B57;color:#fff;font-weight:600}'+
'.rk-toolbar button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:7px 18px;background:#fff;color:#0E6B57;cursor:pointer}'+
'.rk-page{max-width:1100px;margin:0 auto;padding:18px 22px}'+
'.rk-hdr{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:2px solid #0E6B57;padding-bottom:10px;margin-bottom:14px}'+
'.rk-org{display:flex;align-items:center;gap:10px;font-size:11px;line-height:1.6;color:#445}.rk-org img{width:64px;height:56px;object-fit:contain}.rk-org b{display:block;font-size:13.5px;color:#13231f}'+
'.rk-ttl{text-align:left}.rk-ttl h1{margin:0;font-size:19px;color:#0E6B57}.rk-ttl p{margin:2px 0 0;font-size:11.5px;color:#556}'+
'h2,h3{font-size:15px;margin:16px 0 6px;color:#0E6B57;break-after:avoid}'+
'table{width:100%;border-collapse:collapse;font-size:11px;margin:6px 0 12px}th,td{border:1px solid #bccbc7;padding:5px 7px;text-align:right;vertical-align:top}th{background:#e7f1ee;font-weight:700}tr{break-inside:avoid}'+
'summary{font-weight:700;color:#0E6B57;margin:12px 0 4px;list-style:none}summary::-webkit-details-marker{display:none}'+
'.rk-body button,.rk-body .sa-actions,.rk-body .no-print{display:none!important}.rk-body a{color:inherit;text-decoration:none}'+
'.rk-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:28px;text-align:center;font-size:12px;break-inside:avoid}.rk-sign div{padding-top:36px;border-top:1px dashed #889}'+
'.rk-foot{margin-top:14px;font-size:10px;color:#889;text-align:center}'+
'@media print{.rk-toolbar{display:none}.rk-page{max-width:none;padding:0}}';
function hijri(d){try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(d)}catch(e){return d.toLocaleDateString('ar')}}
function html(o){
  o=o||{};const base=(root.location&&root.location.href)||'';
  let logo='';try{logo=new URL('assets/sahafa-school-logo.jpeg',base).href}catch(e){}
  const signs=o.signatures===false?[]:(o.signatures||['معدّ التقرير','وكيل المدرسة','مدير المدرسة']);
  const page='@page{size:A4'+(o.landscape?' landscape':'')+';margin:14mm 12mm 16mm}';
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(o.title)+'</title>'+
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">'+
  '<style>'+page+CSS+'</style></head><body>'+
  '<div class="rk-toolbar"><span>'+esc(o.title)+'</span><button type="button" onclick="window.print()">طباعة / حفظ PDF</button></div>'+
  '<div class="rk-page"><header class="rk-hdr"><div class="rk-org">'+(logo?'<img src="'+esc(logo)+'" alt="">':'')+
  '<div><b>'+SCHOOL+'</b>المملكة العربية السعودية · وزارة التعليم</div></div>'+
  '<div class="rk-ttl"><h1>'+esc(o.title)+'</h1>'+(o.subtitle?'<p>'+esc(o.subtitle)+'</p>':'')+'</div></header>'+
  '<main class="rk-body">'+(o.body||'')+'</main>'+
  (signs.length?'<section class="rk-sign">'+signs.map(s=>'<div>'+esc(s)+'</div>').join('')+'</section>':'')+
  '<footer class="rk-foot">صدر من منصة المتابعة · '+SCHOOL+' · '+esc(hijri(new Date()))+'هـ</footer></div></body></html>';
}
function open(o){
  const w=root.open('','_blank');if(!w)return null;
  w.document.open();w.document.write(html(o));w.document.close();
  w.document.querySelectorAll('details').forEach(d=>{d.open=true});
  w.focus();return w;
}
const api={html,open,css:CSS};root.ReportKit=api;if(typeof module==='object')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
