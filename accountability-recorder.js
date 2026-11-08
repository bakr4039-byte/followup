/* Separate create-only account; never subscribes to personnel records or accountability history. */
(function(){'use strict';
const state=window.__FUACC.state,$=id=>document.getElementById(id);
FollowupAppCheck.activate(firebase.initializeApp(window.FIREBASE_CONFIG));
const auth=firebase.auth(),db=firebase.firestore();let generation=0;
$('acClose').textContent='تسجيل الخروج';$('acClose').onclick=()=>auth.signOut();
$('recLogin').onsubmit=async e=>{e.preventDefault();$('recError').textContent='';$('recSubmit').disabled=true;try{const username=$('recUsername').value.trim();if(!/^[A-Za-z0-9_-]{3,40}$/.test(username))throw Error('username');await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);await auth.signInWithEmailAndPassword(username.toLowerCase()+'@accountability.alsahafa-followup.invalid',$('recPassword').value);$('recPassword').value=''}catch(e){$('recError').textContent='تعذر الدخول؛ تحقق من بيانات حساب مسؤول الرصد وتفعيله.'}finally{$('recSubmit').disabled=false}};
auth.onAuthStateChanged(async user=>{const turn=++generation;state.role=null;state.uid=null;$('gate').hidden=false;$('acDrawer').hidden=true;if(!user)return;try{const p=await db.doc('accountabilityRecorders/'+user.uid).get();if(turn!==generation)return;if(!p.exists||p.data().active!==true)throw Error('inactive');state.uid=user.uid;state.role='recorder';$('gate').hidden=true;$('recError').textContent=''}catch(e){if(turn!==generation)return;$('recError').textContent='هذا الحساب غير مفعّل لمسؤول رصد المساءلات.'}});
})();
