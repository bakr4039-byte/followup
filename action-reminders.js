/* In-account reminders reuse the same authorized records and signature states.
   Also powers the sidebar notification bell (count, list, open, WhatsApp share) and shows a
   device notification for new requests while the platform is in the background, if allowed. */
(function (root) {
  'use strict';
  const groups = new Map();
  let host = null, bell = null, panel = null, expanded = false;
  const SEEN = 'reminderSeen';
  // Open the sidebar section that holds the request before opening it, so it is visible.
  function reveal(label) {
    const key = /مساءل/.test(label) ? 'accountability' : /تكليف/.test(label) ? 'assignments' : /إقرار|اطلاع|توقيع/.test(label) ? 'signatures' : '';
    if (!key) return;
    const ids = { assignments: 'vAssignments', signatures: 'vSignatures', accountability: 'vAcc' };
    const b = document.querySelector('.school-sidebar-links [data-workspace-key="' + key + '"]') || document.getElementById(ids[key]);
    if (b && b.closest('.school-sidebar-links')) b.click();
  }
  function act(item, event) { reveal(item.label); if (item.open) item.open(event); }
  function seen() { try { return new Set(JSON.parse(sessionStorage.getItem(SEEN) || '[]')); } catch (e) { return new Set(); } }
  function notifyNew(items) {
    const known = seen(), fresh = items.filter((i) => !known.has(i.label));
    items.forEach((i) => known.add(i.label));
    try { sessionStorage.setItem(SEEN, JSON.stringify(Array.from(known).slice(-200))); } catch (e) {}
    if (!fresh.length || !document.hidden || !('Notification' in root) || Notification.permission !== 'granted') return;
    const title = fresh.length === 1 ? 'طلب جديد في المنصة' : 'لديك ' + fresh.length + ' طلبات جديدة';
    const opts = { body: fresh.slice(0, 3).map((i) => i.label).join('\n'), icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: 'reminders', lang: 'ar', dir: 'rtl' };
    const fallback = () => { try { new Notification(title, opts); } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(fallback); else fallback();
  }
  function ensureBell() {
    const links = document.querySelector('.school-sidebar-links');
    if (!links) return false;
    if (bell && bell.isConnected) return true;
    bell = document.createElement('button');
    bell.type = 'button'; bell.id = 'notifyBell'; bell.className = 'nc-bell';
    bell.setAttribute('aria-controls', 'notifyPanel'); bell.setAttribute('aria-expanded', 'false');
    panel = document.createElement('div');
    panel.id = 'notifyPanel'; panel.className = 'nc-panel'; panel.hidden = true;
    bell.addEventListener('click', (e) => { e.stopPropagation(); expanded = !expanded; panel.hidden = !expanded; bell.setAttribute('aria-expanded', String(expanded)); });
    panel.addEventListener('click', (e) => e.stopPropagation());
    const home = document.getElementById('schoolHomeLink');
    if (home && home.parentElement === links) home.after(bell, panel); else links.prepend(bell, panel);
    return true;
  }
  function paintBell(items) {
    if (!ensureBell()) return;
    const n = items.length;
    bell.replaceChildren();
    const label = document.createElement('span'); label.textContent = 'الإشعارات'; bell.appendChild(label);
    if (n) { const c = document.createElement('b'); c.className = 'nc-count'; c.textContent = String(n); bell.appendChild(c); }
    bell.setAttribute('aria-label', 'الإشعارات' + (n ? '، ' + n + ' تحتاج إجراء' : ''));
    const toggle = document.getElementById('schoolSidebarToggle');
    if (toggle) { if (n) toggle.dataset.count = String(n); else delete toggle.dataset.count; }
    panel.replaceChildren();
    if (!n) { const p = document.createElement('p'); p.className = 'nc-empty'; p.textContent = 'لا توجد إشعارات تحتاج إجراء.'; panel.appendChild(p); }
    for (const item of items) {
      const row = document.createElement('div'); row.className = 'nc-item';
      const text = document.createElement('p'); text.textContent = item.label; row.appendChild(text);
      const actions = document.createElement('div'); actions.className = 'nc-actions';
      const go = document.createElement('button'); go.type = 'button'; go.textContent = 'فتح';
      go.onclick = (event) => { expanded = false; panel.hidden = true; bell.setAttribute('aria-expanded', 'false'); act(item, event); };
      const wa = document.createElement('a'); wa.textContent = 'واتساب'; wa.target = '_blank'; wa.rel = 'noopener';
      wa.href = 'https://wa.me/?text=' + encodeURIComponent(item.label + '\n' + root.location.origin + root.location.pathname);
      actions.append(go, wa); row.appendChild(actions); panel.appendChild(row);
    }
    if ('Notification' in root && Notification.permission === 'default') {
      const en = document.createElement('button'); en.type = 'button'; en.className = 'nc-enable'; en.textContent = 'تفعيل تنبيهات الجهاز';
      en.onclick = () => { Notification.requestPermission().then(() => paint()).catch(() => {}); };
      panel.appendChild(en);
    }
  }
  function paint() {
    const items = Array.from(groups.values()).flat();
    paintBell(items);
    notifyNew(items);
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
      button.onclick = (event) => act(item, event);
      host.appendChild(button);
    }
  }
  root.ActionReminders = {
    set(group, items) { groups.set(group, items); paint(); },
    clear() { groups.clear(); paint(); },
    items() { return Array.from(groups.values()).flat(); }
  };
  if (root.document) new MutationObserver(() => { if ((!bell || !bell.isConnected) && document.querySelector('.school-sidebar-links')) paint(); }).observe(document.documentElement, { childList: true, subtree: true });
})(window);
