/* Manager-only personnel records. Keep both fields in the private configuration document. */
(function (root) {
  'use strict';
  const F = root.__FUACC;
  if (!F) return;
  const $ = id => document.getElementById(id);
  const esc = root.ACC.esc;
  const normalize = root.DepartmentPersonnel.normalize;
  const config = () => firebase.firestore().doc('config/teacherCivilIds');
  const manager = () => F.state.role === -1 && firebase.apps.length && firebase.auth().currentUser;
  const keysFor = name => {
    const entry = root.DepartmentPersonnel.admins.find(person => [person.name, ...(person.aliases || [])].some(alias => normalize(alias) === normalize(name)));
    return [...new Set([name, ...(entry ? [entry.name, ...(entry.aliases || [])] : [])])];
  };
  function read(name, source) {
    const keys = keysFor(name);
    const pick = map => keys.map(key => Object.hasOwn(map || {}, key) ? map[key] : '').find(Boolean) || '';
    return {civilId: pick(source?.ids), specialty: pick(source?.specialties)};
  }

  let snapshot = {}, onsiteTeachers = [], accounts = [], removed = {}, selected = '', group = 'all', uid = '', stop, accountBusy = false;
  const accountLog = () => firebase.firestore().doc('config/removedPersonnelLogins');
  const get = name => manager() ? read(name, snapshot) : {};
  root.StaffSettings = {get, async load(name) {
    return manager() ? read(name, (await config().get()).data()) : {};
  }, open};

  const roster = () => {
    const names = new Map();
    for (const name of [...F.S.map(lesson => lesson.teacher), ...onsiteTeachers, ...accounts.filter(a => a.kind === 'teacher').map(a => a.scheduleName || a.name)]) {
      const aliases = keysFor(name);
      const person = root.DepartmentPersonnel.admins.find(p => aliases.includes(p.name));
      const key = normalize(person?.name || name);
      if (name && !names.has(key)) names.set(key, {name});
    }
    return root.DepartmentPersonnel.members([...names.values()]);
  };
  const button = document.createElement('button');
  button.id = 'vStaffSettings';
  button.textContent = 'إعدادات المدرسة';
  button.hidden = true;
  $('vTeachers')?.after(button);
  const style = document.createElement('style');
  style.textContent = `
    #staffSettings{width:min(880px,calc(100vw - 24px));max-height:calc(100dvh - 32px);padding:0;border:1px solid #c9ddd6;border-radius:20px;color:#163c31;background:#f4f8f6;direction:rtl;box-shadow:0 20px 70px #173a3340}
    #staffSettings::backdrop{background:#142e2990}
    #staffSettings header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;background:#163e34;color:white}#staffSettings h2,#staffSettings h3{margin:0}
    #staffSettings main{display:grid;gap:14px;padding:18px 22px}
    #staffSettings nav,#staffSettings .ss-links{display:flex;gap:8px;flex-wrap:wrap}
    #staffSettings button,#staffSettings input{font:inherit;border:1px solid #bdcfc8;padding:8px 12px;border-radius:9px;background:white;color:#1c3d33}
    #staffSettings button[aria-pressed=true],#ssSave{background:#17624d!important;color:white!important}
    #staffSettings input{width:100%;box-sizing:border-box}#staffSettings label{display:grid;gap:4px}
    #ssGrid{display:grid;grid-template-columns:minmax(170px,1fr) minmax(210px,1.45fr);gap:14px;align-items:start}
    #ssPeople{display:grid;gap:6px;max-height:43vh;overflow:auto;padding:2px}#ssPeople button{text-align:start}
    #staffSettings details summary{cursor:pointer;padding:8px 0}#staffSettings details[open]{flex-basis:100%}#ssProfile{display:grid;gap:14px;padding:18px;background:white;border:1px solid #d5e5dd;border-radius:14px}#ssProfile form{display:grid;gap:10px}#ssAccountArea{border-top:1px solid #d5e5dd;padding-top:12px;display:grid;gap:9px}#ssAccountArea h4{margin:0}#ssAccountList{display:grid;gap:8px}#ssAccountList article{display:grid;gap:7px;border-radius:10px;background:#f3f8f5;padding:10px}#staffSettings button[data-ss-action=remove]{color:#962525;border-color:#e6c0c0}#ssAccountForm{padding:10px;background:#f5f8f6;border-radius:10px}#staffSettings button:disabled{opacity:.6}
    #ssRole,#ssMessage{margin:0;font-size:13px;color:#455f55}#ssMessage:empty{display:none}
    @media(max-width:560px){#ssGrid{grid-template-columns:1fr}#ssPeople{max-height:25vh}#staffSettings main,#staffSettings header{padding:14px}}
  `;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.id = 'staffSettings';
  dialog.setAttribute('aria-labelledby', 'ssTitle');
  dialog.innerHTML = `
    <header><h2 id="ssTitle">إعدادات المدرسة</h2><button type="button" id="ssClose" autofocus>إغلاق</button></header>
    <main>
      <nav aria-label="فئات المنسوبين"><button type="button" data-ss-group="all">الكل</button><button type="button" data-ss-group="teacher">المعلمون</button><button type="button" data-ss-group="admin">الإداريون والمشرفون</button></nav>
      <div class="ss-links"><button type="button" data-settings-open="vSchoolStudents">الطلاب حسب الفصل</button><details><summary>إعدادات إضافية</summary><div class="ss-links">
        <button type="button" data-settings-open="namesBtn">بيانات المدرسة</button><button type="button" data-settings-open="vEmployeeAccounts">الصلاحيات وتوزيع المهام</button>
        <button type="button" data-settings-open="pwBtn">كلمة مرور المدير</button><button type="button" data-settings-open="securityAuditBtn">سجل التعديلات</button><button type="button" data-settings-open="securityLoginBtn">أمان الدخول</button>
      </div></details></div>
      <label>بحث بالاسم<input type="search" id="ssSearch" autocomplete="off"></label>
      <div id="ssGrid"><div id="ssPeople" aria-label="قائمة المنسوبين"></div>
      <section id="ssProfile" hidden><div><h3 id="ssName"></h3><p id="ssRole"></p></div><form id="ssDetailsForm">
      <label>رقم السجل المدني<input id="ssCivil" inputmode="numeric" autocomplete="off" maxlength="10" dir="ltr"></label>
      <label>التخصص<input id="ssSpecialty" maxlength="100" autocomplete="off"></label>
      <button id="ssSave" type="submit">حفظ بيانات المنسوب</button></form>
      <section id="ssAccountArea" aria-labelledby="ssAccountTitle">
        <h4 id="ssAccountTitle">حساب الدخول</h4><div id="ssAccountList"></div>
        <form id="ssAccountForm" hidden>
          <strong id="ssActionTitle"></strong>
          <label>كلمة المرور الحالية<input type="password" id="ssCurrentPassword" autocomplete="current-password" required></label>
          <label id="ssNewField">كلمة المرور الجديدة<input type="password" id="ssNewPassword" autocomplete="new-password" minlength="6" maxlength="128"></label>
          <label id="ssDeleteConfirm" hidden><span><input type="checkbox" id="ssDeleteCheck" style="width:auto"> أؤكد حذف حساب الدخول المحدد</span></label>
          <div class="ss-links"><button type="submit" id="ssAccountSave">تنفيذ</button><button type="button" id="ssAccountCancel">إلغاء</button></div>
        </form>
      </section></section></div>
      <p id="ssMessage" role="status"></p>
    </main>`;
  document.body.append(dialog);
  const message = text => { $('ssMessage').textContent = text; };
  function paintPeople() {
    const query = normalize($('ssSearch').value);
    const people = roster().filter(p => (group === 'all' || p.kind === group || p.kind === 'both') && (!query || normalize(p.name).includes(query) || normalize(p.personnel?.name || '').includes(query)));
    dialog.querySelectorAll('[data-ss-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ssGroup === group)));
    $('ssPeople').innerHTML = people.map(p => `<button type="button" data-ss-name="${esc(p.name)}" aria-pressed="${p.name === selected}">${esc(group === 'admin' ? p.personnel.name : p.name)}</button>`).join('') || '<p>لا توجد أسماء مطابقة.</p>';
  }
  function showPerson(name) {
    const p = roster().find(person => person.name === name || normalize(person.personnel?.name || '') === normalize(name));
    if (!p) return;
    selected = p.name;
    const fields = get(selected);
    $('ssName').textContent = p.personnel?.name || selected;
    $('ssRole').textContent = p.personnel?.title || 'معلم';
    $('ssCivil').value = fields.civilId || '';
    $('ssSpecialty').value = fields.specialty || '';
    $('ssProfile').hidden = false;
    resetAccountForm();
    paintAccounts();
    paintPeople();
  }
  async function open(name) {
    if (!manager()) return;
    const currentUid = manager().uid;
    if(accountBusy)return;
    resetAccountForm();
    selected = '';
    $('ssProfile').hidden = true;
    $('ssSearch').value = '';
    group = roster().find(p => p.name === name)?.kind === 'admin' ? 'admin' : 'all';
    if (!dialog.open) dialog.showModal();
    $('ssPeople').textContent = 'جارٍ تحميل البيانات…';
    try {
      const [directory, onsite, teachers, employees, log] = await Promise.all([
        config().get(),
        firebase.firestore().doc('config/subs-onsite-data').get().catch(() => null),
        firebase.firestore().collection('teacherProfiles').get().catch(() => null),
        firebase.firestore().collection('employeeProfiles').get().catch(() => null),
        accountLog().get().catch(() => null)
      ]);
      const data = directory.data() || {};
      if (!dialog.open || manager()?.uid !== currentUid) return;
      snapshot = data;
      accountsAvailable = {teacher:!!teachers,employee:!!employees,log:!!log};
      const fromProfiles = (result, kind) => (result?.docs || []).map(doc => ({...doc.data(), uid:doc.id, kind}));
      accounts = [...fromProfiles(teachers,'teacher'), ...fromProfiles(employees,'employee')];
      removed = log?.data()?.accounts || {};
      onsiteTeachers = (onsite?.data()?.lessons || []).map(lesson => lesson.scheduleName).filter(Boolean);
      message('');
      paintPeople();
      if (name) showPerson(name);
    } catch { message('تعذّر تحميل بيانات المنسوبين. افتح الإعدادات وحاول مرة أخرى.'); }
  }
  button.onclick = () => open();
  $('ssClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    selected = '';
    $('ssCivil').value = $('ssSpecialty').value = '';
    resetAccountForm();
    $('ssAccountList').textContent='';
    $('ssProfile').hidden = true;
  });
  dialog.querySelectorAll('[data-settings-open]').forEach(link => {
    link.onclick = () => {
      const control = $(link.dataset.settingsOpen);
      if (!manager() || accountBusy || !control || control.hidden) {
        message('هذا الإعداد غير متاح للحساب الحالي.');
        return;
      }
      dialog.close();
      control.click();
    };
  });
  document.addEventListener('teacher-account-created', event => {
    if (manager() && event.detail?.name) open(event.detail.name);
  });
  $('ssSearch').oninput = paintPeople;
  dialog.querySelector('nav').onclick = event => {
    const choice = event.target.closest('[data-ss-group]');
    if (!choice || accountBusy) return;
    resetAccountForm();
    group = choice.dataset.ssGroup;
    $('ssSearch').value = '';
    $('ssProfile').hidden = true;
    selected = '';
    paintPeople();
  };
  $('ssPeople').onclick = event => {
    const choice = event.target.closest('[data-ss-name]');
    if (choice && !accountBusy) showPerson(choice.dataset.ssName);
  };
  $('ssDetailsForm').onsubmit = async event => {
    event.preventDefault();
    const actor = manager(), name = selected;
    if (!actor || !name) return;
    const civilId = $('ssCivil').value.trim().replace(/[٠-٩۰-۹]/g, ch => String(ch.charCodeAt(0) - (ch <= '٩' ? 1632 : 1776)));
    const specialty = $('ssSpecialty').value.trim();
    if (civilId && !/^\d{10}$/.test(civilId)) { message('أدخل رقم السجل المدني من 10 أرقام.'); return; }
    const save = $('ssSave');
    save.disabled = true;
    try {
      const ref = config();
      const written = await firebase.firestore().runTransaction(async tx => {
        const current = (await tx.get(ref)).data() || {};
        const ids = {...current.ids}, specialties = {...current.specialties};
        for (const key of keysFor(name)) { delete ids[key]; delete specialties[key]; }
        if (civilId) ids[name] = civilId;
        if (specialty) specialties[name] = specialty;
        tx.set(ref, {ids, specialties}, {mergeFields: ['ids', 'specialties']});
        return {ids, specialties};
      });
      if (manager()?.uid === actor.uid) {
        snapshot = written;
        if (name === selected) $('ssCivil').value = civilId;
        message('تم حفظ بيانات ' + name + '.');
      }
    } catch { message('تعذّر حفظ بيانات المنسوب. حاول مرة أخرى.'); }
    finally { save.disabled = false; }
  };
  let accountAction = null, accountsAvailable = {};
  function resetAccountForm(){
    accountAction = null;
    $('ssAccountForm').reset();
    $('ssAccountForm').hidden = true;
  }
  const suffixFor = a => a.kind === 'employee' ? '@employees.alsahafa-followup.invalid' : '@teachers.alsahafa-followup.invalid';
  const accountEmail = a => a.email || (/^05\d{8}$/.test(a.phone||'') ? a.phone+suffixFor(a) : '');
  function accountsFor(name){
    const aliases = keysFor(name);
    const normalized = aliases.map(normalize);
    const matching = accounts.filter(a => [a.name,a.scheduleName].some(candidate => candidate && normalized.includes(normalize(candidate))));
    if (matching.some(a => a.kind === 'teacher')) return matching;
    const phone = aliases.map(alias => F.state.phones?.[alias]).find(value => /^05\d{8}$/.test(value||''));
    if(!phone)return matching;
    const teachers = accounts.filter(a => a.kind === 'teacher' && a.phone === phone);
    return teachers.length===1 ? [...matching,teachers[0]] : matching;
  }
  function paintAccounts(){
    const options = accountsFor(selected);
    const person = roster().find(p => p.name === selected);
    const isTeacher = person?.kind !== 'admin';
    const available = accountsAvailable.log && (isTeacher ? accountsAvailable.teacher : accountsAvailable.employee);
    if (!available) { $('ssAccountList').textContent = 'تعذّر تحميل حساب الدخول. أعد فتح الإعدادات للمحاولة.'; return; }
    $('ssAccountList').innerHTML = options.map(a => {
      const type = a.kind === 'employee' ? 'حساب إداري' : 'حساب معلم';
      const deleted = !!removed[a.uid], disabled = a.active !== true || a.loginDisabled === true;
      const status = deleted ? 'حُذف حساب الدخول' : disabled ? 'دخول موقوف' : 'دخول مفعّل';
      return `<article><div><b>${type}</b> · ${status}${a.phone?' · <bdi>'+esc(a.phone)+'</bdi>':''}</div>
        ${deleted?'':accountEmail(a)?`<div class="ss-links"><button type="button" data-ss-account="${esc(a.uid)}" data-ss-action="password">تغيير كلمة المرور</button><button type="button" data-ss-account="${esc(a.uid)}" data-ss-action="remove">حذف حساب الدخول</button></div>`:'<p>الحساب مسجل دون بيانات دخول قابلة للتحقق.</p>'}</article>`;
    }).join('');
    if(isTeacher && !options.some(a=>a.kind==='teacher'&&!removed[a.uid])){
      $('ssAccountList').insertAdjacentHTML('beforeend','<article><div>لا يوجد حساب معلم نشط مرتبط بهذا الاسم.</div><div><button type="button" data-ss-create>إنشاء حساب معلم</button></div></article>');
    }else if(!options.length){
      $('ssAccountList').textContent='لا يوجد حساب دخول مرتبط بهذا الاسم. افتح الصلاحيات وتوزيع المهام لتفعيل الحساب.';
    }
  }
  $('ssAccountList').onclick = event => {
    if(event.target.closest('[data-ss-create]')){
      if(accountBusy||!manager()||!selected)return;
      const name=selected,phone=F.state.phones?.[name]||'';
      dialog.close();
      root.openTeacherProvision?.({name,phone});
      return;
    }
    const action = event.target.closest('[data-ss-account]');
    if (!action || accountBusy || !manager()) return;
    const account = accountsFor(selected).find(a => a.uid === action.dataset.ssAccount);
    if (!account || removed[account.uid]) return;
    resetAccountForm();
    accountAction = {account, type:action.dataset.ssAction};
    const deleting = accountAction.type === 'remove';
    $('ssActionTitle').textContent = deleting ? 'حذف حساب الدخول مع الاحتفاظ بالسجلات والتقارير' : 'تعيين كلمة مرور جديدة للحساب المحدد';
    $('ssNewField').hidden = deleting;
    $('ssNewPassword').required = !deleting;
    $('ssDeleteConfirm').hidden = !deleting;
    $('ssDeleteCheck').required = deleting;
    $('ssAccountSave').textContent = deleting ? 'تأكيد حذف حساب الدخول' : 'حفظ كلمة المرور الجديدة';
    $('ssAccountForm').hidden = false;
    $('ssCurrentPassword').focus();
    message('');
  };
  $('ssAccountCancel').onclick = () => { if (!accountBusy) resetAccountForm(); };
  $('ssAccountForm').onsubmit = async event => {
    event.preventDefault();
    const actor = manager(), action = accountAction;
    if (!actor || !action || accountBusy) return;
    const {account, type} = action, deleting = type === 'remove';
    const current = $('ssCurrentPassword').value, replacement = $('ssNewPassword').value;
    if (!current || (deleting ? !$('ssDeleteCheck').checked : replacement.length < 6)) return;
    const suffix=suffixFor(account),email=accountEmail(account);
    if (actor.uid === account.uid || !email.endsWith(suffix)) { message('تعذّر التحقق من الحساب الشخصي المحدد.'); return; }
    accountBusy = true;
    $('ssAccountSave').disabled = $('ssAccountCancel').disabled = true;
    $('ssCurrentPassword').value = $('ssNewPassword').value = '';
    let secondary, deletedAuth = false;
    try {
      const db = firebase.firestore();
      const staff = await db.doc('staffAccess/'+account.uid).get();
      if (staff.exists) { message('هذا الحساب مرتبط بدور إداري مستقل. افتح الحسابات والصلاحيات لإدارته.'); return; }
      let app = firebase.apps.find(item => item.name === 'personnel-credential-management');
      if (!app) {
        app = firebase.initializeApp(firebase.app().options, 'personnel-credential-management');
        root.FollowupAppCheck.activate(app);
      }
      secondary = app.auth();
      await secondary.setPersistence(firebase.auth.Auth.Persistence.NONE);
      const result = await secondary.signInWithEmailAndPassword(email, current);
      if (result.user.uid !== account.uid || manager()?.uid !== actor.uid || !dialog.open || action !== accountAction) throw Error('account-mismatch');
      if (deleting) {
        await result.user.delete();
        deletedAuth = true;
        const ref = accountLog(), stamp = firebase.firestore.FieldValue.serverTimestamp();
        await ref.set({accounts:{[account.uid]:{kind:account.kind,deletedAt:stamp,deletedBy:actor.uid}}},{merge:true});
        removed[account.uid] = true;
        paintAccounts();
        message('تم حذف حساب الدخول. السجلات والتقارير محفوظة.');
      } else {
        await result.user.updatePassword(replacement);
        message('تم تحديث كلمة مرور الحساب المحدد.');
      }
      resetAccountForm();
    } catch (error) {
      if (deletedAuth) {
        removed[account.uid] = true;paintAccounts();resetAccountForm();
        message('حُذف حساب الدخول، وتعذّر تسجيل حالة الحذف في الإعدادات.');
      } else if (['auth/wrong-password','auth/invalid-credential','auth/invalid-login-credentials','auth/user-not-found'].includes(error.code)) {
        message('لم تُقبل كلمة المرور الحالية للحساب المحدد.');
      } else {
        message(error.code === 'auth/weak-password' ? 'اختر كلمة مرور أقوى.' : 'تعذّر تنفيذ الإجراء للحساب المحدد.');
      }
    } finally {
      if (secondary?.currentUser) await secondary.signOut().catch(() => {});
      accountBusy = false;
      $('ssAccountSave').disabled = $('ssAccountCancel').disabled = false;
    }
  };
  setInterval(() => {
    const current = manager()?.uid || '';
    button.hidden = !current;
    if (current === uid) return;
    uid = current;
    stop?.();
    stop = null;
    snapshot = {};onsiteTeachers = [];accounts = [];removed = {};accountsAvailable={};
    if (!uid) { if (dialog.open) dialog.close(); return; }
    const listeningUid = uid;
    stop = config().onSnapshot(doc => { if (listeningUid === uid) snapshot = doc.data() || {}; }, () => {});
  }, 700);
})(window);
