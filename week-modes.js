(function(root){'use strict';
function dayMode(m,w,day){const v=m[w];const base=typeof v==='string'?v:v?.mode;return v&&typeof v==='object'&&v.days?.[String(day)]||base||'remote'}
function remote(m,w,day){return day==null?[0,1,2,3,4].some(d=>dayMode(m,w,d)==='remote'):dayMode(m,w,day)==='remote'}
function holiday(m,w,day){return day==null?[0,1,2,3,4].every(d=>dayMode(m,w,d)==='holiday'):dayMode(m,w,day)==='holiday'}
function summary(m,w){const modes=[0,1,2,3,4].map(d=>dayMode(m,w,d));const first=modes[0];return modes.every(x=>x===first)?first:'mixed'}
const api={dayMode,remote,holiday,summary,remoteWeeks:(ws,m)=>ws.filter(w=>remote(m,w))};root.WeekModes=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
