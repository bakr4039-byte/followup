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

  let snapshot = {}, onsiteTeachers = [], selected = '', group = 'teacher', uid = '', stop;
  const get = name => manager() ? read(name, snapshot) : {};
  root.StaffSettings = {get, async load(name) {
    return manager() ? read(name, (await config().get()).data()) : {};
  }, open};

  const roster = () => {
    const names = new Map();
    for (const name of [...F.S.map(lesson => lesson.teacher), ...onsiteTeachers]) {
      const aliases = keysFor(name);
      const person = root.DepartmentPersonnel.admins.find(p => aliases.includes(p.name));
      const key = normalize(person?.name || name);
      if (name && !names.has(key)) names.set(key, {name});
    }
    return root.DepartmentPersonnel.members([...names.values()]);
  };
  const button = document.createElement('button');
  button.id = 'vStaffSettings';
  button.textContent = 'المنسوبون والطلاب';
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
    #ssProfile{display:grid;gap:12px;padding:15px;background:white;border:1px solid #d5e5dd;border-radius:12px}
    #ssRole,#ssMessage{margin:0;font-size:13px;color:#455f55}#ssMessage:empty{display:none}
    @media(max-width:560px){#ssGrid{grid-template-columns:1fr}#ssPeople{max-height:25vh}#staffSettings main,#staffSettings header{padding:14px}}
  `;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.id = 'staffSettings';
  dialog.setAttribute('aria-labelledby', 'ssTitle');
  dialog.innerHTML = `
    <header><h2 id="ssTitle">إعدادات المنسوبين والطلاب</h2><button type="button" id="ssClose" autofocus>إغلاق</button></header>
    <main>
      <nav aria-label="فئات المنسوبين"><button type="button" data-ss-group="teacher">المعلمون</button><button type="button" data-ss-group="admin">الإداريون والمشرفون</button></nav>
      <div class="ss-links"><button type="button" id="ssStudents">الطلاب حسب الفصل</button><button type="button" id="ssAccounts">الحسابات والصلاحيات</button></div>
      <label>بحث بالاسم<input type="search" id="ssSearch" autocomplete="off"></label>
      <div id="ssGrid"><div id="ssPeople" aria-label="قائمة المنسوبين"></div>
      <form id="ssProfile" hidden><h3 id="ssName"></h3><p id="ssRole"></p>
      <label>رقم السجل المدني<input id="ssCivil" inputmode="numeric" autocomplete="off" maxlength="10" dir="ltr"></label>
      <label>التخصص<input id="ssSpecialty" maxlength="100" autocomplete="off"></label>
      <button id="ssSave" type="submit">حفظ بيانات المنسوب</button></form></div>
      <p id="ssMessage" role="status"></p>
    </main>`;
  document.body.append(dialog);
  const message = text => { $('ssMessage').textContent = text; };
  function paintPeople() {
    const query = normalize($('ssSearch').value);
    const people = roster().filter(p => (p.kind === group || p.kind === 'both') && (!query || normalize(p.name).includes(query) || normalize(p.personnel?.name || '').includes(query)));
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
    paintPeople();
  }
  async function open(name) {
    if (!manager()) return;
    const currentUid = manager().uid;
    selected = '';
    $('ssProfile').hidden = true;
    $('ssSearch').value = '';
    group = roster().find(p => p.name === name)?.kind === 'admin' ? 'admin' : 'teacher';
    if (!dialog.open) dialog.showModal();
    $('ssPeople').textContent = 'جارٍ تحميل البيانات…';
    try {
      const [directory, onsite] = await Promise.all([
        config().get(),
        firebase.firestore().doc('config/subs-onsite-data').get().catch(() => null)
      ]);
      const data = directory.data() || {};
      if (!dialog.open || manager()?.uid !== currentUid) return;
      snapshot = data;
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
    $('ssProfile').hidden = true;
  });
  $('ssStudents').onclick = () => {
    dialog.close();
    $('vSchoolStudents')?.click();
  };
  $('ssAccounts').onclick = () => {
    dialog.close();
    $('vEmployeeAccounts')?.click();
  };
  $('ssSearch').oninput = paintPeople;
  dialog.querySelector('nav').onclick = event => {
    const choice = event.target.closest('[data-ss-group]');
    if (!choice) return;
    group = choice.dataset.ssGroup;
    $('ssSearch').value = '';
    $('ssProfile').hidden = true;
    selected = '';
    paintPeople();
  };
  $('ssPeople').onclick = event => {
    const choice = event.target.closest('[data-ss-name]');
    if (choice) showPerson(choice.dataset.ssName);
  };
  $('ssProfile').onsubmit = async event => {
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
  setInterval(() => {
    const current = manager()?.uid || '';
    button.hidden = !current;
    if (current === uid) return;
    uid = current;
    stop?.();
    stop = null;
    snapshot = {};onsiteTeachers = [];
    if (!uid) { if (dialog.open) dialog.close(); return; }
    const listeningUid = uid;
    stop = config().onSnapshot(doc => { if (listeningUid === uid) snapshot = doc.data() || {}; }, () => {});
  }, 700);
})(window);
