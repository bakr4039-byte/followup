/* In-account reminders reuse the same authorized records and signature states. */
(function (root) {
  'use strict';
  const groups = new Map();
  let host = null;
  // Open the sidebar section that holds the request before opening it, so it is visible.
  function reveal(label) {
    const key = /مساءل/.test(label) ? 'accountability' : /تكليف/.test(label) ? 'assignments' : /إقرار|اطلاع|توقيع/.test(label) ? 'signatures' : '';
    if (!key) return;
    const ids = { assignments: 'vAssignments', signatures: 'vSignatures', accountability: 'vAcc' };
    const b = document.querySelector('.school-sidebar-links [data-workspace-key="' + key + '"]') || document.getElementById(ids[key]);
    if (b && b.closest('.school-sidebar-links')) b.click();
  }
  function paint() {
    const items = Array.from(groups.values()).flat();
    if (!host && !items.length) return;
    if (!host) {
      host = document.createElement('section');
      host.id = 'actionReminders';
      host.dir = 'rtl';
      host.setAttribute('aria-label', 'طلبات تحتاج إجراء منك');
      host.style.cssText = 'margin:16px auto;padding:18px;max-width:1100px;background:#fff6df;color:#573b09;border:2px solid #c7922d;border-radius:16px;position:relative;z-index:20';
      const account = document.getElementById('account');
      (account || document.querySelector('main') || document.body).prepend(host);
    }
    host.hidden = !items.length;
    host.replaceChildren();
    if (!items.length) return;
    const title = document.createElement('h3');
    title.style.margin = '0 0 10px';
    title.textContent = 'لديك ' + items.length + ' طلب يحتاج إجراء منك';
    title.setAttribute('role', 'status');
    host.appendChild(title);
    const note = document.createElement('p');
    note.textContent = 'تظهر الطلبات حتى إتمام الرد أو التوقيع أو الإجراء المطلوب.';
    host.appendChild(note);
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.style.cssText = 'display:block;text-align:right;width:100%;margin:8px 0;padding:12px;white-space:normal';
      button.textContent = item.label + ' — فتح الطلب';
      button.onclick = (event) => { reveal(item.label); if (item.open) item.open(event); };
      host.appendChild(button);
    }
  }
  root.ActionReminders = {
    set(group, items) { groups.set(group, items); paint(); },
    clear() { groups.clear(); paint(); }
  };
})(window);
