(function(root){'use strict';
function dayMode(m,w,day){const v=m[w];const base=typeof v==='string'?v:v?.mode;return v&&typeof v==='object'&&v.days?.[String(day)]||base||'remote'}
function remote(m,w,day){return day==null?[0,1,2,3,4].some(d=>dayMode(m,w,d)==='remote'):dayMode(m,w,day)==='remote'}
function summary(m,w){const n=[0,1,2,3,4].filter(d=>remote(m,w,d)).length;return n===5?'remote':n===0?'onsite':'mixed'}
const api={dayMode,remote,summary,remoteWeeks:(ws,m)=>ws.filter(w=>remote(m,w))};root.WeekModes=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
