/* ui-kit.js — shared confirm/alert dialog for every page.
   Replaces the browser's grey confirm()/alert() boxes with the platform's own dialog.
   Usage: if(!await UIKit.confirm('نص السؤال'))return;  await UIKit.alert('رسالة'); */
(function(root){'use strict';
const DANGER=/حذف|لا يمكن|نهائي|إغلاق/;
let dlg=null,resolver=null;
function build(){
  dlg=document.createElement('dialog');dlg.className='uk-dialog';dlg.setAttribute('dir','rtl');
  dlg.innerHTML='<form method="dialog"><p class="uk-msg"></p><div class="uk-actions"><button value="ok" class="uk-ok">تأكيد</button><button value="cancel" class="uk-cancel">إلغاء</button></div></form>';
  dlg.addEventListener('close',()=>{const r=resolver;resolver=null;if(r)r(dlg.returnValue==='ok')});
  document.body.append(dlg);
}
function confirmBox(message,opts){
  opts=opts||{};
  if(!root.document||!document.body||typeof root.HTMLDialogElement==='undefined')return Promise.resolve(opts.alert?(root.alert(message),true):root.confirm(message));
  if(!dlg)build();
  if(resolver){const r=resolver;resolver=null;r(false)}
  const text=String(message),ok=dlg.querySelector('.uk-ok'),cancel=dlg.querySelector('.uk-cancel');
  dlg.querySelector('.uk-msg').textContent=text;
  ok.textContent=opts.ok||(opts.alert?'حسنًا':'تأكيد');
  const danger=!opts.alert&&(opts.danger||DANGER.test(text));
  ok.classList.toggle('danger',danger);cancel.hidden=!!opts.alert;dlg.returnValue='cancel';
  return new Promise(res=>{resolver=res;if(!dlg.open)dlg.showModal();(danger?cancel:ok).focus()});
}
const api={confirm:confirmBox,alert:m=>confirmBox(m,{alert:true}).then(()=>undefined)};
root.UIKit=api;if(typeof module==='object')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
