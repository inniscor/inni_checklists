// Navigation shared by every widget page in this folder: the page header's two menus, and the popup they (and the
// checklist's 1/1 status menu) open in.
//
//   Nav.mount({ view, demo, inGrist })   once; view is 'checklist' or 'breakdown'. Fills <header id="sethead">.
//   Nav.openMenu / closeMenu / placeMenu / menuOpen   the popup, for other menus on the page
//
// The header: a view button (Checklist ▾ / Breakdown ▾) that switches between this doc's two pages, then the set's
// name, which opens the set menu. Switching sets keeps the view: from Breakdown you land on the other set's Breakdown.
//
// Where the links go:
//   This doc's pages: from its page list (the pages named "Checklist" and "Breakdown"), on Grist's address for the
//   doc, /<urlId>/<slug>/p/<page id> (e.g. /9Abbfx43q1qk/Checklist-Sandbox/p/12). Grist reads a bare /<id>/p/12 as a
//   slug of "p" and drops the page, so the slug matters.
//   Other sets: sets.json (two folders up, at the site root). Each set has `url` (its Checklist page) and may have
//   `breakdown` (its Breakdown page); without `breakdown`, a set opens on its Checklist. A set without `url`
//   ("Coming Soon...") is listed, dimmed. Sets are grouped by year; up to three marked "featured" also appear in a
//   Featured section, which opens first. Links open in the same tab with Grist's panels hidden (style=singlePage).
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ICON = {
    chev: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.4 6.3 4.9 8.7 9.7 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    caret: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.6 6 7.6l3-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    checklist: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    breakdown: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.5 11V8M8 11V4.5M11.5 11V6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };
  const VIEWS = [['checklist', 'Checklist'], ['breakdown', 'Breakdown']];

  // ---------- popup ----------
  // A dropdown under its button on wider screens, a bottom sheet on phones (tapping a choice applies it). Items are .mi
  // elements; arrow keys move between them, Escape closes.
  let menuEl = null;
  function closeMenu(refocus) {
    if (!menuEl) return;
    const { anchor, nodes } = menuEl; menuEl = null;
    nodes.forEach((n) => n.remove());
    document.removeEventListener('keydown', onMenuKey, true);
    document.removeEventListener('pointerdown', onMenuOutside, true);
    window.removeEventListener('scroll', onMenuScroll, true);
    window.removeEventListener('resize', onMenuScroll);
    if (anchor.isConnected) { anchor.setAttribute('aria-expanded', 'false'); if (refocus) anchor.focus(); }
  }
  // Opens a menu for `anchor` (or closes it if it's already open). `align`: 'right' (under the anchor's right edge) or
  // 'left'. `under`: the element the dropdown sits below (default: the anchor). Returns the menu box, or null.
  function openMenu(anchor, { label, items, sheetHead = '', align = 'right', cls = '', under = null }) {
    const reopen = menuEl && menuEl.anchor === anchor;
    closeMenu();
    if (reopen) return null;
    const nodes = [];
    if (matchMedia('(max-width: 600px)').matches) {
      const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.onclick = () => closeMenu(true);
      const sheet = document.createElement('div'); sheet.className = `sheet ${cls}`; sheet.setAttribute('role', 'menu'); sheet.setAttribute('aria-label', label);
      sheet.innerHTML = `<div class="grab"></div>${sheetHead}${items}`;
      nodes.push(scrim, sheet);
    } else {
      const m = document.createElement('div'); m.className = `menu ${cls}`; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', label); m.innerHTML = items;
      nodes.push(m);
    }
    nodes.forEach((n) => document.body.appendChild(n));
    const box = nodes[nodes.length - 1];
    menuEl = { anchor, nodes, box, align, under };
    placeMenu();
    anchor.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onMenuKey, true);
    document.addEventListener('pointerdown', onMenuOutside, true);
    window.addEventListener('scroll', onMenuScroll, true);
    window.addEventListener('resize', onMenuScroll);
    (visibleItems(box).find((n) => n.matches('[aria-checked="true"], [aria-current="page"]')) || visibleItems(box)[0]).focus();
    return box;
  }
  const visibleItems = (box) => [...box.querySelectorAll('.mi')].filter((n) => n.offsetParent !== null);
  // Puts the dropdown under its button (or above, if there's no room below). Called again when its contents change size.
  function placeMenu() {
    if (!menuEl || !menuEl.box.classList.contains('menu')) return;
    const { anchor, box, align, under } = menuEl, r = anchor.getBoundingClientRect(), u = (under || anchor).getBoundingClientRect();
    const h = box.offsetHeight, w = box.offsetWidth;
    const below = u.bottom + 6 + h <= window.innerHeight || r.top - 6 - h < 0;
    box.style.top = Math.max(8, below ? u.bottom + 6 : r.top - 6 - h) + 'px';
    box.style.left = Math.max(8, Math.min(align === 'left' ? r.left : r.right - w, window.innerWidth - w - 8)) + 'px';
  }
  function onMenuKey(e) {
    if (!menuEl) return;
    const items = visibleItems(menuEl.box), i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
    else if (e.key === 'Tab') closeMenu();
  }
  // A tap outside closes the menu; a tap on its own button is left to that button's click handler (which closes it).
  // On phones the scrim catches the tap (and closes the sheet on click) so it doesn't fall through to the row beneath.
  function onMenuOutside(e) { if (menuEl && !menuEl.box.contains(e.target) && !menuEl.anchor.contains(e.target) && !e.target.closest('.scrim')) closeMenu(); }
  function onMenuScroll(e) { if (menuEl && !(e && e.target && e.target.nodeType === 1 && menuEl.box.contains(e.target))) closeMenu(); }

  // ---------- sets and views ----------
  const FEATURED_MAX = 3;
  // Sets are listed by their `order` number: lowest first in each year, highest first in Featured (which also keeps the
  // three highest). Sets without a number always come after numbered ones, in file order.
  const byOrder = (list, desc = false) => list.map((x, i) => [x, i]).sort(([a, i], [b, j]) => {
    const na = Number.isFinite(a.order), nb = Number.isFinite(b.order);
    if (na !== nb) return na ? -1 : 1;
    return (na ? (desc ? b.order - a.order : a.order - b.order) : 0) || i - j;
  }).map(([x]) => x);
  const N = { view: 'checklist', sections: [], all: [], current: null, docName: '', viewUrls: {} };

  async function mount({ view, demo, inGrist }) {
    N.view = view === 'breakdown' ? 'breakdown' : 'checklist';
    injectStyles();
    let data = null, docId = '', docName = '', origin = '', pages = [], urlId = '';
    try {
      if (demo) data = window.DEMO_SETS || null;
      else { const r = await fetch(new URL('../../sets.json', location.href)); if (r.ok) data = await r.json(); }
    } catch (e) {}
    if (demo) { docId = window.DEMO_DOC_ID || ''; docName = window.DEMO_DOC_NAME || ''; origin = 'https://docs.getgrist.com'; pages = window.DEMO_PAGES || []; urlId = window.DEMO_URL_ID || ''; }
    else if (inGrist) {
      // getDocName() returns the doc's ID rather than its title, so the title comes from the REST API (GET /api/docs/:id)
      // using the widget's read-only access token. If that fails the title falls back to a generic one, never the ID.
      try {
        const t = await grist.docApi.getAccessToken({ readOnly: true });
        docId = (/\/docs\/([^/?#]+)/.exec(t.baseUrl || '') || [])[1] || '';
        origin = new URL(t.baseUrl).origin;
        const r = await fetch(`${t.baseUrl}?auth=${encodeURIComponent(t.token)}`);
        if (r.ok) { const j = await r.json(), n = String(j.name || '').trim(); if (n && n !== docId) docName = n; urlId = String(j.urlId || ''); }
      } catch (e) {}
      if (!docId) try { docId = await grist.docApi.getDocName(); } catch (e) {}
      // This doc's pages, to link Checklist and Breakdown by name (full access lets a widget read the page list).
      try {
        const v = await grist.docApi.fetchTable('_grist_Views'), p = await grist.docApi.fetchTable('_grist_Pages');
        const onPage = new Set(p.viewRef);
        pages = v.id.map((id, i) => ({ id, name: String(v.name[i] || '').trim() })).filter((x) => onPage.has(x.id));
      } catch (e) {}
    }
    const years = (data && Array.isArray(data.years) ? data.years : [])
      .map((y) => ({ key: 'y:' + y.year, title: String(y.year ?? ''), sets: byOrder((y.sets || []).filter((x) => x && x.name)) }))
      .filter((y) => y.title && y.sets.length);
    N.all = years.flatMap((y) => y.sets);
    const featured = byOrder(N.all.filter((x) => x.featured === true), true).slice(0, FEATURED_MAX);
    N.sections = (featured.length ? [{ key: 'featured', title: 'Featured', sets: featured }] : []).concat(years);
    N.current = N.all.find((x) => docId && x.doc === docId) || null;
    N.docName = docName;
    // This doc's two pages: found by name in its page list; else the current set's sets.json links.
    // The doc's address: a listed set's own link (exact), else Grist's urlId and a slug of the doc's name.
    const base = N.current && N.current.url ? N.current.url.replace(/\/p\/\d+.*$/, '')
      : origin && docId ? `${origin}/${urlId || docId}/${slugOf(docName) || 'doc'}` : '';
    const byName = (n) => pages.find((x) => x.name.toLowerCase() === n);
    N.viewUrls = {};
    for (const [k] of VIEWS) {
      const pg = byName(k);
      if (pg && base) N.viewUrls[k] = `${base}/p/${pg.id}?style=singlePage`;
      else if (N.current) N.viewUrls[k] = k === 'checklist' ? N.current.url : N.current.breakdown;
    }
    render();
  }
  // Grist's slug for a doc name: runs of anything but letters and digits become '-'.
  const slugOf = (name) => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Where a set opens from this page: the same view when the set has it, else its Checklist.
  const setUrl = (x) => (N.view === 'breakdown' && x.breakdown) || x.url;

  function render() {
    const head = $('#sethead'); if (!head) return;
    const cur = N.current, label = VIEWS.find(([k]) => k === N.view)[1];
    const title = cur ? cur.name : N.docName || (N.all.length ? 'Checklists' : '');
    const others = N.all.filter((x) => x !== cur).length;
    const sub = cur ? cur.sub || '' : '';
    const canSwitch = VIEWS.some(([k]) => k !== N.view && N.viewUrls[k]);
    head.hidden = false;
    head.innerHTML = `<div class="navrow">
        <button class="viewbtn" id="viewbtn" aria-haspopup="menu" aria-expanded="false" aria-label="${label}. Switch view"${canSwitch ? '' : ' disabled'}>${ICON[N.view]}<span>${label}</span>${canSwitch ? `<span class="car">${ICON.caret}</span>` : ''}</button>
        <div class="setblock">${title ? (others
          ? `<button class="setbtn" id="setbtn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(title)}. Switch checklist">${esc(title)}<span class="car">${ICON.caret}</span></button>`
          : `<h1 class="setbtn">${esc(title)}</h1>`) : ''}${sub ? `<div class="setsub">${esc(sub)}</div>` : ''}</div>
      </div>`;
    if (canSwitch) $('#viewbtn').onclick = (e) => openViewMenu(e.currentTarget);
    if (title && others) $('#setbtn').onclick = (e) => openSetMenu(e.currentTarget);
  }

  // The view menu: Checklist and Breakdown, the current one checked. A view this doc has no page for is dimmed.
  function openViewMenu(btn) {
    const items = VIEWS.map(([k, l]) => {
      const cur = k === N.view, url = N.viewUrls[k];
      const inner = `<span class="mic vic">${ICON[k]}</span><span><b>${l}</b></span>${cur ? `<span class="mic">${ICON.check}</span>` : ''}`;
      if (cur) return `<a class="mi vi" role="menuitemradio" aria-checked="true" aria-current="page" href="${esc(url || '#')}" data-view="${k}">${inner}</a>`;
      if (!url) return `<div class="mi vi soon" role="menuitemradio" aria-checked="false" aria-disabled="true" tabindex="-1" data-view="${k}">${inner}</div>`;
      return `<a class="mi vi" role="menuitemradio" aria-checked="false" href="${esc(url)}" target="_top" data-view="${k}">${inner}</a>`;
    }).join('');
    const box = openMenu(btn, { label: 'View', items, align: 'left', cls: 'viewmenu' });
    if (box) box.onclick = (e) => { const a = e.target.closest('a.mi'); if (a && a.hasAttribute('aria-current')) { e.preventDefault(); closeMenu(true); } };
  }

  // Each section is a header button and its sets. Featured starts open, years start closed; opening one section closes
  // the others, and clicking the open one closes it.
  function openSetMenu(btn) {
    const cur = N.current, start = N.sections[0] && N.sections[0].key === 'featured' ? 'featured' : '';
    // A set without a url (e.g. "Coming Soon...") is listed but dimmed and can't be opened; it can still take focus so
    // screen readers announce it as unavailable.
    const setText = (x) => `<span><b>${esc(x.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>`;
    const setLink = (x) => !x.url
      ? `<div class="mi si soon" role="menuitem" aria-disabled="true" tabindex="-1">${setText(x)}</div>`
      : `<a class="mi si" role="menuitem" href="${esc(setUrl(x))}" target="_top"${x === cur ? ' aria-current="page"' : ''}>${setText(x)}${x === cur ? `<span class="mic">${ICON.check}</span>` : ''}</a>`;
    const items = N.sections.map((g, i) => {
      const open = g.key === start, id = `msec-${i}`;
      return `<button class="mi msec" data-sec="${esc(g.key)}" aria-expanded="${open}" aria-controls="${id}"><b>${esc(g.title)}<small>${g.sets.length} checklist${g.sets.length === 1 ? '' : 's'}</small></b><span class="chev" aria-hidden="true">${ICON.chev}</span></button>` +
        `<div class="msub" id="${id}" role="group" aria-label="${esc(g.title)}"${open ? '' : ' hidden'}>${g.sets.map(setLink).join('')}</div>`;
    }).join('');
    const box = openMenu(btn, { label: 'Checklists', items, align: 'left', cls: 'setmenu', under: btn.closest('.setblock') });
    if (!box) return;
    box.onclick = (e) => {
      const sec = e.target.closest('.msec');
      if (sec) {
        const opening = sec.getAttribute('aria-expanded') !== 'true';
        box.querySelectorAll('.msec').forEach((b) => { const on = opening && b === sec; b.setAttribute('aria-expanded', on); box.querySelector('#' + b.getAttribute('aria-controls')).hidden = !on; });
        placeMenu();
        return;
      }
      // Picking the current set just closes the menu.
      const a = e.target.closest('a.mi'); if (a && a.hasAttribute('aria-current')) { e.preventDefault(); closeMenu(true); }
    };
  }

  const STYLES = `
  .menu { position: fixed; z-index: 20; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(20,33,46,.16); padding: 4px; width: 230px; max-height: calc(100vh - 16px); overflow-y: auto; }
  .scrim { position: fixed; inset: 0; background: rgba(20,33,46,.35); z-index: 19; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--surface); border-radius: 16px 16px 0 0; padding: 8px 14px 18px; box-shadow: 0 -8px 24px rgba(20,33,46,.18); max-height: 85vh; overflow-y: auto; }
  .grab { width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 2px auto 10px; }
  .sh { padding: 2px 4px 10px; } .sh strong { display: block; font-size: 16px; } .sh small { color: var(--muted); font-size: 13px; }
  .mi { width: 100%; box-sizing: border-box; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; display: grid; grid-template-columns: 24px 1fr auto; gap: 10px; align-items: center; border-radius: 8px; padding: 7px 8px; font-size: 14px; text-decoration: none; }
  .sheet .mi { padding: 12px 10px; font-size: 16px; }
  .mi b { font-weight: 600; }
  .mi small { display: block; color: var(--muted); font-size: 12px; }
  .mi[aria-current="page"], .mi[aria-checked="true"] { background: var(--bg); }
  .mi:hover, .mi:focus-visible { background: var(--bg); outline: 2px solid var(--focus); outline-offset: -2px; }
  .mi.soon { cursor: default; color: var(--muted); } .mi.soon:hover { background: none; outline: 0; }
  .mic { display: grid; place-items: center; color: #0B5A3F; } .mic .ico { width: 14px; height: 14px; display: block; }
  .mic.vic { color: var(--ink); } .mic.vic .ico { width: 16px; height: 16px; }
  .mi.vi b { font-size: 15px; } .sheet .mi.vi b { font-size: 17px; }
  .menu.viewmenu { width: 220px; }
  /* The header: view button, then the set's name (the set menu) with its subtitle. */
  .sethead { padding: 12px 2px 0; min-width: 0; }
  .navrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
  .viewbtn { flex: none; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 5px 12px; min-height: 36px; font-family: var(--cond); font-weight: 600; font-size: 17px; cursor: pointer; }
  .viewbtn .ico { width: 15px; height: 15px; display: block; }
  .viewbtn .car { display: inline-grid; color: var(--muted); } .viewbtn .car .ico { width: 12px; height: 12px; }
  .viewbtn:hover, .viewbtn[aria-expanded="true"] { border-color: var(--ink); }
  .viewbtn:disabled { cursor: default; } .viewbtn:disabled:hover { border-color: var(--line); }
  .setblock { min-width: 0; }
  .setbtn { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 0 -4px; border: 0; background: none; padding: 2px 4px; border-radius: 8px; font-family: var(--cond); font-weight: 700; font-size: 24px; line-height: 1.15; color: var(--ink); text-align: left; }
  button.setbtn { cursor: pointer; } button.setbtn:hover { background: var(--surface); }
  .setbtn .car { display: inline-grid; color: var(--muted); } .setbtn .car .ico { width: 16px; height: 16px; display: block; }
  .setsub { color: var(--muted); font-size: 13px; padding: 0 2px; }
  .menu.setmenu { width: 300px; }
  .mi.msec { grid-template-columns: 1fr auto; padding: 9px 10px; }
  .mi.msec b { font-family: var(--cond); font-weight: 700; font-size: 18px; }
  .mi.msec small { display: inline; margin-left: 8px; font-family: var(--body); font-weight: 400; font-size: 12.5px; color: var(--muted); }
  .mi.msec .chev { transition: transform .15s; display: block; } .mi.msec .chev .ico { width: 12px; height: 12px; display: block; } .mi.msec[aria-expanded="true"] .chev { transform: rotate(90deg); }
  .msub { margin: 0 0 4px 12px; padding-left: 6px; border-left: 2px solid var(--line); }
  .mi.si { grid-template-columns: 1fr auto; padding: 9px 10px; }
  .mi.si b { font-family: var(--cond); font-weight: 700; font-size: 18px; } .mi.si small { font-size: 12.5px; }
  .mi.soon b { font-weight: 600; }
  @media (max-width: 600px) { .viewbtn { font-size: 16px; padding: 4px 10px; } .setbtn { font-size: 22px; } }`;
  function injectStyles() {
    if (document.getElementById('nav-styles')) return;
    const s = document.createElement('style'); s.id = 'nav-styles'; s.textContent = STYLES; document.head.appendChild(s);
  }

  window.Nav = { mount, openMenu, closeMenu, placeMenu, menuOpen: () => !!menuEl, injectStyles };
})();
