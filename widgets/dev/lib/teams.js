// My teams: a visitor's own teams and the Customize drawer that edits them, shared by every widget page in this folder.
// Teams are kept only in this browser (localStorage "cl:customTeams"), never in the doc. Every set's widgets load from
// the same site, so the teams follow the visitor across checklists and pages. Players are matched by name (case and
// accents ignored), and each player is on at most one custom team.
//
// Custom teams override the doc: a claimed player's cards leave her real team for the custom one. On a shared card,
// each player brings her own team, so a card with one claimed player lists the custom team and the other player's team
// (shown under both, blended tile, half credit), and a card whose players are all claimed belongs only to the custom
// team. A switch turns the whole feature off; each team has its own switch too.
//
// A page uses it like this:
//   MyTeams.mount({ players, baseTeamNames, teamCards, toast, changed, renamed })   once, after its data has loaded
//   const r = MyTeams.apply({ cards, basePlayerTeam, baseTint, players })          whenever teams or data change
//     → sets c.teams and c.Team on each card; returns { teamTint, customNames, playerTeam }
//   MyTeams.render(soft)   with the page's render; updates the Customize button and the open drawer
// The page's markup has the Customize button (#custbtn, with a .cdot inside); the drawer is added to <body> here.
(function () {
  const KEY = 'cl:customTeams';
  const COLORS = ['#7048E8', '#D6336C', '#1C7ED6', '#F08C00', '#2B8A3E', '#0C8599'];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const ICON = {
    chev: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.6 3.6l4.8 4.8m0-4.8-4.8 4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };

  // ---------- storage ----------
  function load() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) {}
    const teams = (Array.isArray(raw.teams) ? raw.teams : []).map((t, i) => ({
      id: String(t && t.id || 'ct' + Date.now().toString(36) + i),
      name: String(t && t.name || '').trim(),
      color: /^#[0-9a-f]{6}$/i.test(t && t.color) ? t.color : COLORS[i % COLORS.length],
      players: [...new Set((Array.isArray(t && t.players) ? t.players : []).map((p) => String(p).trim()).filter(Boolean))],
      on: !(t && t.on === false),
    })).filter((t) => t.name);
    return { on: raw.on !== false, teams };
  }
  let CT = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(CT)); } catch (e) {} };

  // ---------- tint ----------
  // Same tint as the Teams table's Tint formula: keep the hue, pale it (lightness .89, saturation clamped to .45–.75),
  // neutral gray for colors with no usable hue, and lighten until text keeps 7:1 contrast with the ink #14212E.
  function tintOf(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
    let H = 0, S = 0;
    if (mx !== mn) {
      const d = mx - mn;
      S = L <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
      const rc = (mx - r) / d, gc = (mx - g) / d, bc = (mx - b) / d;
      H = (r === mx ? bc - gc : g === mx ? 2 + rc - bc : 4 + gc - rc) / 6;
      H = ((H % 1) + 1) % 1;
    }
    let S2, L2;
    if (S < 0.12 || mx - mn < 0.08) { S2 = 0; L2 = 0.88; } else { S2 = Math.min(Math.max(S, 0.45), 0.75); L2 = 0.89; }
    const v = (m1, m2, h) => { h = ((h % 1) + 1) % 1; return h < 1 / 6 ? m1 + (m2 - m1) * h * 6 : h < 0.5 ? m2 : h < 2 / 3 ? m1 + (m2 - m1) * (2 / 3 - h) * 6 : m1; };
    const hls = (h, l, s) => { if (!s) return [l, l, l]; const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s, m1 = 2 * l - m2; return [v(m1, m2, h + 1 / 3), v(m1, m2, h), v(m1, m2, h - 1 / 3)]; };
    const lum = (rgb) => { const c = rgb.map((x) => x / 255).map((x) => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ink = lum([0x14, 0x21, 0x2E]);
    let rgb;
    for (;;) {
      // Python's round() rounds halves to even; match it so tints agree with the doc's to the digit.
      rgb = hls(H, L2, S2).map((x) => { const y = x * 255, f = Math.floor(y); return y - f === 0.5 ? (f % 2 ? f + 1 : f) : Math.round(y); });
      if ((lum(rgb) + 0.05) / (ink + 0.05) >= 7 || L2 >= 0.97) break;
      L2 += 0.01;
    }
    return '#' + rgb.map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join('');
  }

  // ---------- override ----------
  let last = { customNames: new Set() };
  function apply({ cards, basePlayerTeam, baseTint, players }) {
    const claims = new Map();
    const live = CT.on ? CT.teams.filter((t) => t.on) : [];
    for (const t of live) for (const p of t.players) claims.set(norm(p), t.name);
    const teamTint = new Map(baseTint);
    for (const t of live) { const x = tintOf(t.color); if (x) teamTint.set(t.name, x); }
    const customNames = new Set();
    // Which of a shared card's teams an unclaimed player brings: her own team when it's on the card, else the team in
    // her position (when there's one team per player), else all of the card's teams.
    const ownTeams = (c, n, i) => {
      if (c.baseTeams.length <= 1) return c.baseTeams;
      const known = basePlayerTeam.get(n);
      if (known && c.baseTeams.includes(known)) return [known];
      return c.baseTeams.length === c.playerNames.length ? [c.baseTeams[i]] : c.baseTeams;
    };
    for (const c of cards) {
      const claimed = c.playerNames.map((n) => claims.get(norm(n)));
      if (!claimed.some(Boolean)) { c.teams = c.baseTeams; c.Team = c.baseTeam; continue; }
      c.teams = [...new Set(c.playerNames.flatMap((n, i) => claimed[i] ? [claimed[i]] : ownTeams(c, n, i)))];
      c.Team = c.teams.join(' / ');
      claimed.forEach((t) => t && customNames.add(t));
    }
    const playerTeam = new Map();
    for (const n of players) { const t = claims.get(norm(n)) || basePlayerTeam.get(n); if (t) playerTeam.set(n, t); }
    last = { customNames };
    return { teamTint, customNames, playerTeam };
  }
  const active = () => CT.on && last.customNames.size > 0;

  // ---------- editing ----------
  let host = null;
  const ui = { open: false, share: false, confirm: null, focus: null, exp: new Map(), dirty: false };
  function changed() { ui.dirty = true; save(); host.changed(); }
  const nameTaken = (name, exceptId) => {
    const k = norm(name);
    return [...host.baseTeamNames()].some((t) => norm(t) === k) || CT.teams.some((t) => t.id !== exceptId && norm(t.name) === k);
  };
  function newTeam() {
    let i = CT.teams.length + 1, name;
    do { name = 'My team' + (i > 1 ? ' ' + i : ''); i++; } while (nameTaken(name));
    const t = { id: 'ct' + Date.now().toString(36), name, color: COLORS[CT.teams.length % COLORS.length], players: [], on: true };
    CT.teams.push(t); CT.on = true;
    ui.focus = { id: t.id, field: 'name' };
    ui.exp.set(t.id, true);
    changed();
  }
  // Claim a player for a team; she leaves any other custom team. Any name can be added, so one team (e.g. "Personal
  // Collection") can be built from a single checklist: a name that matches a player in this set takes the set's
  // spelling; any other is kept as typed, shown dimmed here, and claims that player wherever a set lists her.
  function claimPlayer(teamId, input) {
    const t = CT.teams.find((x) => x.id === teamId); if (!t) return;
    const typed = String(input || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const k = norm(typed); if (!k) return;
    const match = host.players().find((p) => norm(p) === k);
    const name = match || typed;
    if (t.players.some((p) => norm(p) === k)) { host.toast(`${name} is already on ${t.name}`); return; }
    const from = CT.teams.find((x) => x !== t && x.players.some((p) => norm(p) === k));
    if (from) from.players = from.players.filter((p) => norm(p) !== k);
    t.players.push(name);
    ui.focus = { id: t.id, field: 'add' };
    changed();
    host.toast((from ? `Moved ${name} from ${from.name} to ${t.name}` : `${name} added to ${t.name}`) + (match ? '' : ' (not in this set)'));
  }
  function renameTeam(teamId, value) {
    const t = CT.teams.find((x) => x.id === teamId); if (!t) return;
    const name = value.trim();
    if (!name || name === t.name) { render(); return; }
    if (nameTaken(name, t.id)) { host.toast(`“${name}” is already a team name`); render(); return; }
    const old = t.name;
    t.name = name;
    if (host.renamed) host.renamed(old, name);
    changed();
  }
  // Share codes: the teams as base64 JSON ("CT1:…"), for backup and for passing a team to someone else.
  const exportCode = () => 'CT1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ teams: CT.teams.map((t) => ({ n: t.name, c: t.color, p: t.players, ...(t.on ? {} : { o: false }) })) }))));
  function importCode(code) {
    let data;
    try { data = JSON.parse(decodeURIComponent(escape(atob(String(code).trim().replace(/^CT1:/, ''))))); } catch (e) { host.toast('That code isn’t a custom teams code'); return; }
    const incoming = (Array.isArray(data && data.teams) ? data.teams : []).filter((t) => t && String(t.n || '').trim());
    if (!incoming.length) { host.toast('That code has no teams in it'); return; }
    for (const x of incoming) {
      let name = String(x.n).trim();
      const players = [...new Set((Array.isArray(x.p) ? x.p : []).map((p) => String(p).trim()).filter(Boolean))];
      let t = CT.teams.find((y) => norm(y.name) === norm(name));
      if (!t) {
        if ([...host.baseTeamNames()].some((b) => norm(b) === norm(name))) name += ' (custom)';
        t = { id: 'ct' + Date.now().toString(36) + CT.teams.length, name, color: COLORS[CT.teams.length % COLORS.length], players: [], on: true };
        CT.teams.push(t);
      }
      if (/^#[0-9a-f]{6}$/i.test(x.c)) t.color = x.c;
      t.players = players;
      t.on = x.o !== false;
      // The imported team wins any player it shares with another custom team.
      const ks = new Set(players.map(norm));
      for (const y of CT.teams) if (y !== t) y.players = y.players.filter((p) => !ks.has(norm(p)));
    }
    CT.on = true;
    ui.share = false;
    changed();
    host.toast(`Imported ${incoming.length} team${incoming.length === 1 ? '' : 's'}`);
  }

  // ---------- drawer ----------
  // The Customize button (top right, across from the set title) opens a side drawer, or a bottom sheet on phones.
  // My teams is its first section: a switch for the whole feature, then one card per custom team with its own switch,
  // color and name. A card opens to edit its players or delete the team. Cards start closed, except a team with no
  // players yet. soft: called from a general render; leaves the drawer alone while the visitor is typing in it.
  function teamMeta(t, inSet) {
    const n = t.players.length, here = t.players.filter((p) => inSet.has(norm(p))).length;
    const who = !n ? 'No players yet' : here === n ? `${n} player${n === 1 ? '' : 's'}` : `${here} of ${n} players in this set`;
    if (!CT.on || !t.on) return (t.on ? '' : 'Off · ') + who;
    const k = host.teamCards(t.name);
    return who + (k ? ` · ${k} card${k === 1 ? '' : 's'}` : '');
  }
  function render(soft) {
    if (!host) return;
    const btn = $('#custbtn'), drawer = $('#ctdrawer'), panel = $('#ctpanel');
    const on = active();
    if (btn) {
      btn.classList.toggle('on', on);
      const dot = btn.querySelector('.cdot'); if (dot) dot.hidden = !on;
      btn.setAttribute('aria-expanded', ui.open);
      btn.setAttribute('aria-label', 'Customize' + (on ? ', custom teams on' : ''));
    }
    drawer.hidden = $('#ctscrim').hidden = !ui.open;
    if (!ui.open) return;
    if (soft && !ui.dirty && drawer.contains(document.activeElement) && panel.childElementCount) return;
    ui.dirty = false;
    const players = host.players();
    $('#ctplayers').innerHTML = players.map((p) => `<option value="${esc(p)}">`).join('');
    const inSet = new Set(players.map(norm));
    const teamsHtml = CT.teams.map((t) => {
      const open = ui.exp.has(t.id) ? ui.exp.get(t.id) : !t.players.length;
      const tint = tintOf(t.color) || '';
      const meta = esc(teamMeta(t, inSet));
      const chev = `<button class="ctchev" data-cttoggle aria-expanded="${open}" aria-label="${open ? 'Close' : 'Open'} ${esc(t.name)}">${ICON.chev}</button>`;
      const sw = `<label class="switch sm" title="${t.on ? 'On' : 'Off'}"><input type="checkbox" data-cton ${t.on ? 'checked' : ''} aria-label="Use ${esc(t.name)}"></label>`;
      if (!open) return `<div class="ctteam${t.on ? '' : ' off'}" data-ct="${esc(t.id)}"><div class="ctrow">${sw}
        <span class="ctsw" style="background:${esc(t.color)}" aria-hidden="true"></span>
        <button class="ctopen" data-cttoggle aria-expanded="false"><strong>${esc(t.name)}</strong><small>${meta}</small></button>${chev}</div></div>`;
      const chips = t.players.map((p) => { const away = !inSet.has(norm(p));
        return `<button class="ctp${away ? ' away' : ''}" style="--blk:${tint}" data-ctrm="${esc(p)}" aria-label="Remove ${esc(p)} from ${esc(t.name)}"${away ? ' title="Not in this set"' : ''}>${esc(p)}<span aria-hidden="true">${ICON.x}</span></button>`; }).join('');
      const confirming = ui.confirm === t.id;
      return `<div class="ctteam${t.on ? '' : ' off'}" data-ct="${esc(t.id)}">
        <div class="ctrow">${sw}<input type="color" value="${esc(t.color)}" data-ctcolor aria-label="Color for ${esc(t.name)}">
          <input class="ctname" value="${esc(t.name)}" data-ctname aria-label="Team name" maxlength="40">${chev}</div>
        ${chips ? `<div class="ctplayers">${chips}</div>` : ''}
        <div class="ctadd"><input list="ctplayers" placeholder="Add a player" aria-label="Add a player to ${esc(t.name)}" data-ctadd autocomplete="off"><button class="ctbtn" data-ctaddbtn>Add</button></div>
        <div class="ctmetarow"><span class="ctmeta">${meta}</span><span><button class="ctlink ctdel${confirming ? ' confirm' : ''}" data-ctdel>${confirming ? 'Delete team?' : 'Delete team'}</button>${confirming ? '<button class="ctlink" data-ctkeep>Keep</button>' : ''}</span></div>
      </div>`;
    }).join('');
    // Redrawing replaces the controls; keep keyboard focus on the same one (by id) when it had it.
    const keep = panel.contains(document.activeElement) ? document.activeElement.id : '';
    panel.classList.toggle('alloff', !CT.on);
    panel.innerHTML = `<div class="cthead"><span class="ctsec"><label class="switch"><input type="checkbox" id="cton" ${CT.on ? 'checked' : ''} aria-labelledby="ctsech"></label><h3 id="ctsech">My teams</h3></span>
        <button class="ctlink" id="ctsharebtn" aria-expanded="${ui.share}">Share/import</button></div>
      <p class="cthint">Claim players for a team of your own. Their cards move to your team in every view and download.</p>
      ${ui.share ? `<div class="ctshare"><label class="ctlabel" for="ctcode">Your teams as a code</label><textarea id="ctcode" readonly>${esc(CT.teams.length ? exportCode() : '')}</textarea>
        <span><button class="ctbtn" id="ctcopy" ${CT.teams.length ? '' : 'disabled'}>Copy code</button></span>
        <label class="ctlabel" for="ctimport">Paste a code to add its teams</label><textarea id="ctimport" placeholder="CT1:…"></textarea>
        <span><button class="ctbtn" id="ctdoimport">Import</button></span></div>` : ''}
      ${teamsHtml}
      <div class="ctfoot"><button class="ctbtn ctnew" id="ctnew">+ New team</button></div>`;
    if (ui.focus) {
      const f = ui.focus; ui.focus = null;
      const el = panel.querySelector(`[data-ct="${CSS.escape(f.id)}"] [data-ct${f.field}]`);
      if (el) { el.focus(); if (f.field === 'name') el.select(); }
    } else if (keep) panel.querySelector('#' + CSS.escape(keep))?.focus();
    if (!drawer.contains(document.activeElement)) $('#ctclose').focus();
  }
  function openDrawer() {
    ui.open = true; ui.confirm = null; ui.dirty = true;
    render();
    document.documentElement.style.overflow = 'hidden';
    $('#ctclose').focus();
  }
  function closeDrawer() {
    if (!ui.open) return;
    ui.open = false; ui.confirm = null;
    render();
    document.documentElement.style.overflow = '';
    $('#custbtn')?.focus();
  }

  const MARKUP = `<div class="dscrim" id="ctscrim" hidden></div>
<aside class="drawer" id="ctdrawer" role="dialog" aria-modal="true" aria-labelledby="ctdtitle" hidden>
  <div class="dgrab" aria-hidden="true"></div>
  <div class="dhead"><h2 id="ctdtitle">Customize</h2><button class="dclose" id="ctclose" aria-label="Close">${ICON.x}<span class="done">Done</span></button></div>
  <div class="dbody ctpanel" id="ctpanel"></div>
</aside>
<datalist id="ctplayers"></datalist>`;

  const STYLES = `
  .custbtn { flex: none; margin: 14px 0 0 auto; display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 6px 14px 6px 12px; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
  .custbtn .ico { width: 16px; height: 16px; display: block; }
  .custbtn:hover, .custbtn[aria-expanded="true"] { border-color: var(--ink); }
  .custbtn.on { background: var(--ink); border-color: var(--ink); color: #fff; }
  .cdot { width: 7px; height: 7px; border-radius: 50%; background: #3DDC97; }
  .dscrim { position: fixed; inset: 0; z-index: 30; background: rgba(20, 33, 46, .28); }
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 31; width: min(420px, 100vw); box-sizing: border-box; background: var(--surface); color: var(--ink); border-left: 1px solid var(--line); box-shadow: -12px 0 32px rgba(20, 33, 46, .14); display: flex; flex-direction: column; font-family: var(--body); }
  .drawer .ico { width: 12px; height: 12px; display: block; }
  .drawer :where(button, input, textarea) { font: inherit; color: inherit; }
  .dgrab { display: none; }
  .dhead { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 12px; border-bottom: 1px solid var(--line); }
  .dhead h2 { margin: 0; font-family: var(--cond); font-weight: 700; font-size: 24px; }
  .dclose { width: 36px; height: 36px; border: 0; border-radius: 8px; background: #F1F4F7; display: grid; place-items: center; cursor: pointer; }
  .dclose .done { display: none; }
  .dbody { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 14px 20px 24px; }
  @media (max-width: 600px) {
    .custbtn { width: 44px; height: 44px; padding: 0; justify-content: center; border-radius: 12px; position: relative; margin-top: 12px; }
    .custbtn .lab { display: none; } .custbtn .cdot { position: absolute; top: 7px; right: 7px; }
    .drawer { top: auto; left: 0; width: auto; max-height: 85vh; border-left: 0; border-radius: 18px 18px 0 0; box-shadow: 0 -8px 24px rgba(20, 33, 46, .18); }
    .dgrab { display: block; width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 8px auto 0; }
    .dhead { border-bottom: 0; padding: 8px 16px 4px; } .dbody { padding: 4px 16px 20px; }
    .dclose { width: auto; padding: 8px 16px; border-radius: 999px; font-weight: 600; } .dclose .ico { display: none; } .dclose .done { display: inline; }
  }
  .ctbtn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 4px 12px; font-weight: 500; font-size: 14px; cursor: pointer; white-space: nowrap; }
  .ctbtn:hover { border-color: var(--ink); } .ctbtn:disabled { opacity: .5; cursor: default; }
  .ctlink { border: 0; background: none; color: var(--focus); padding: 4px 2px; cursor: pointer; font-size: 14px; }
  .ctlabel { font-family: var(--cond); font-weight: 600; font-size: 15px; color: var(--muted); }
  .cthead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; }
  .ctsec { display: inline-flex; align-items: center; gap: 10px; }
  .ctsec h3 { margin: 0; font-family: var(--cond); font-weight: 700; font-size: 20px; }
  .ctsw { flex: none; width: 26px; height: 26px; border-radius: 6px; }
  .ctopen { flex: 1; min-width: 0; border: 0; background: none; padding: 2px 0; text-align: left; cursor: pointer; }
  .ctopen strong { display: block; font-family: var(--cond); font-weight: 700; font-size: 19px; line-height: 1.2; }
  .ctopen small { display: block; color: var(--muted); font-size: 12.5px; }
  .ctchev { flex: none; width: 32px; height: 32px; border: 0; background: none; border-radius: 6px; display: grid; place-items: center; color: var(--muted); cursor: pointer; }
  .ctchev .ico { transition: transform .15s; transform: rotate(90deg); } .ctchev[aria-expanded="true"] .ico { transform: rotate(-90deg); }
  .ctchev:hover { background: var(--bg); }
  .ctmetarow { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 8px; }
  .ctmetarow .ctmeta { margin: 0; }
  .ctnew { border: 1px dashed #A9B4BF; }
  .cthint { color: var(--muted); font-size: 13px; margin: 6px 0 2px; }
  .switch { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
  .switch input { appearance: none; width: 34px; height: 20px; border-radius: 999px; background: var(--line); position: relative; margin: 0; cursor: pointer; transition: background .15s; }
  .switch input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(20,33,46,.3); }
  .switch input:checked { background: var(--pitch); } .switch input:checked::after { transform: translateX(14px); }
  .switch.sm input { width: 28px; height: 16px; } .switch.sm input::after { width: 12px; height: 12px; } .switch.sm input:checked::after { transform: translateX(12px); }
  .ctteam { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px 10px; margin-top: 10px; }
  .ctteam.off .ctplayers, .ctteam.off .ctname, .ctteam.off input[type=color], .ctteam.off .ctsw, .ctteam.off .ctopen strong { opacity: .5; }
  .ctrow { display: flex; align-items: center; gap: 8px; }
  .ctrow input[type=color] { flex: none; width: 30px; height: 30px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: none; cursor: pointer; }
  .ctname { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; font-family: var(--cond); font-weight: 700; font-size: 19px; }
  .ctname:hover, .ctname:focus { border-color: var(--line); background: var(--surface); }
  .ctdel { color: #B42318; } .ctdel.confirm { font-weight: 600; }
  .ctplayers { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .ctp { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; padding: 4px 6px 4px 11px; font-size: 14px; cursor: pointer; background: var(--blk, var(--bg)); color: var(--ink); }
  .ctp span { display: inline-grid; place-items: center; width: 14px; height: 14px; }
  .ctp.away { opacity: .55; }
  .ctadd { display: flex; gap: 6px; margin-top: 8px; }
  .ctadd input { flex: 1; min-width: 0; padding: 6px 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: 15px; }
  .ctmeta { display: block; color: var(--muted); font-size: 12.5px; margin-top: 6px; }
  .ctfoot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
  .ctshare { margin-top: 10px; display: grid; gap: 6px; }
  .ctshare textarea { width: 100%; box-sizing: border-box; min-height: 56px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; font: 12.5px/1.4 ui-monospace, monospace; resize: vertical; }
  .ctpanel.alloff .ctteam { opacity: .6; }`;

  function mount(h) {
    host = h;
    if (!document.getElementById('ct-styles')) {
      const s = document.createElement('style'); s.id = 'ct-styles'; s.textContent = STYLES; document.head.appendChild(s);
      document.body.insertAdjacentHTML('beforeend', MARKUP);
    }
    const panel = $('#ctpanel'), drawer = $('#ctdrawer');
    const btn = $('#custbtn'); if (btn) btn.onclick = () => ui.open ? closeDrawer() : openDrawer();
    $('#ctclose').onclick = closeDrawer;
    $('#ctscrim').onclick = closeDrawer;
    // Escape closes; Tab stays inside the drawer while it's open.
    document.addEventListener('keydown', (e) => { if (ui.open && e.key === 'Escape') { e.preventDefault(); closeDrawer(); } });
    drawer.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...drawer.querySelectorAll('button, input, textarea, a[href]')].filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    // Another widget (or another set's tab) changed the custom teams: pick them up.
    window.addEventListener('storage', (e) => { if (e.key === KEY) { CT = load(); ui.dirty = true; host.changed(); } });

    const teamOf = (el) => el.closest('[data-ct]')?.dataset.ct;
    panel.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('#ctnew')) return newTeam();
      if (t.closest('#ctsharebtn')) { ui.share = !ui.share; return render(); }
      if (t.closest('#ctdoimport')) return importCode($('#ctimport').value);
      if (t.closest('#ctcopy')) {
        const code = $('#ctcode'); code.select();
        const done = () => host.toast('Code copied');
        (navigator.clipboard ? navigator.clipboard.writeText(code.value) : Promise.reject()).then(done, () => { try { document.execCommand('copy') ? done() : host.toast('Select the code and copy it'); } catch (err) { host.toast('Select the code and copy it'); } });
        return;
      }
      const id = teamOf(t); if (!id) return;
      const team = CT.teams.find((x) => x.id === id); if (!team) return;
      const tg = t.closest('[data-cttoggle]');
      if (tg) { const open = tg.getAttribute('aria-expanded') !== 'true'; ui.exp.set(id, open); ui.confirm = null; ui.focus = { id, field: 'toggle' }; return render(); }
      const rm = t.closest('[data-ctrm]');
      if (rm) { team.players = team.players.filter((p) => p !== rm.dataset.ctrm); ui.focus = { id, field: 'add' }; return changed(); }
      if (t.closest('[data-ctaddbtn]')) return claimPlayer(id, t.closest('[data-ct]').querySelector('[data-ctadd]').value);
      if (t.closest('[data-ctkeep]')) { ui.confirm = null; return render(); }
      if (t.closest('[data-ctdel]')) {
        if (ui.confirm !== id) { ui.confirm = id; return render(); }
        ui.confirm = null; CT.teams = CT.teams.filter((x) => x.id !== id);
        changed(); host.toast(`Deleted ${team.name}`);
      }
    });
    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'cton') { CT.on = t.checked; return changed(); }
      const id = teamOf(t); if (!id) return;
      const team = CT.teams.find((x) => x.id === id); if (!team) return;
      if (t.matches('[data-cton]')) { team.on = t.checked; return changed(); }
      if (t.matches('[data-ctcolor]')) { team.color = t.value; return changed(); }
      if (t.matches('[data-ctname]')) return renameTeam(id, t.value);
      // Picking a name from the list (or leaving the box) claims the player, if it's an exact match.
      if (t.matches('[data-ctadd]') && t.value.trim() && host.players().some((p) => norm(p) === norm(t.value))) return claimPlayer(id, t.value);
    });
    panel.addEventListener('keydown', (e) => {
      const t = e.target;
      if (e.key !== 'Enter') return;
      if (t.matches('[data-ctadd]')) { e.preventDefault(); claimPlayer(teamOf(t), t.value); }
      else if (t.matches('[data-ctname]')) { e.preventDefault(); t.blur(); }
    });
  }

  window.__tintOf = tintOf; // for the tests
  window.MyTeams = { mount, apply, render, active, isOpen: () => ui.open, tintOf, norm };
})();
