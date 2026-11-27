// Team and player stats: one component shared by every widget page in this folder (the checklist now, the dashboard
// next). It holds no data of its own: the page reads the doc through Grist, applies custom teams, and hands over the
// cards. So a team (real or custom) gets the same numbers on every page, and each release folder carries the version
// of this file its pages were tested with.
//
// SetStats.model(input) → a model for SetStats.panel(model, kind, name). input:
//   cards:         [{ id, Subset, sub: { Base, Autograph, SSP, Memorabilia }, teams: [..], playerNames: [..] }]
//   parsBySubset:  Map subset id → [{ id, Print_Run, products: Set(product id) }]
//   excByKey:      Map "cardId:parallelId" → { Print_Run, Not_Available }
//   pulls:         Map "cardId:parallelId" → { Off_Market }
//   products:      [{ id, Product, Autos_Per_Box, Numbered_Per_Box, Boxes_Per_Case }]
//   product:       a product id to count only its parallels, or null for every product
//
// Math (see the Dashboard Prototype note): numbered copies add up effective print runs (a card's exception, else the
// parallel's run; Not_Available skipped; unnumbered versions add nothing). A card with two teams (or players) counts
// in full in each one's counts and lists, but half in shares, ranks and per-box estimates, so shares add up to 100%.
// Per-box estimates are left out until the stats mature (the products' box configuration is still passed in).
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const int = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (x) => x === 0 ? '0%' : x < 0.001 ? '<0.1%' : (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%';
  const plural = (n, one, many) => `${int(n)} ${Math.round(n) === 1 ? one : (many || one + 's')}`;
  const share = (part, whole) => whole ? part / whole : 0;

  function versions(I, c, product) {
    return (I.parsBySubset.get(c.Subset) || []).filter((p) => product == null || p.products.has(product)).map((p) => {
      const e = I.excByKey.get(c.id + ':' + p.id);
      if (e) return { p, run: e.Not_Available ? null : e.Print_Run, na: !!e.Not_Available };
      return { p, run: p.Print_Run, na: false };
    });
  }
  const blank = () => ({ cards: 0, autos: 0, hits: 0, mem: 0, num: { auto: 0, insert: 0, base: 0, all: 0 }, ones: { all: 0, live: 0, pulled: 0, off: 0 } });
  function tally(I, cards, w, product) {
    const t = blank();
    for (const c of cards) {
      const k = w ? w(c) : 1; if (!k) continue;
      t.cards += k;
      if (c.sub.Autograph) t.autos += k;
      if (c.sub.SSP) t.hits += k;
      if (c.sub.Memorabilia) t.mem += k;
      const tier = c.sub.Autograph ? 'auto' : c.sub.Base ? 'base' : 'insert';
      for (const v of versions(I, c, product)) {
        if (v.na || !v.run) continue;
        t.num[tier] += v.run * k; t.num.all += v.run * k;
        if (v.run === 1) { const pl = I.pulls.get(c.id + ':' + v.p.id); t.ones.all += k; t.ones[!pl ? 'live' : pl.Off_Market ? 'off' : 'pulled'] += k; }
      }
    }
    return t;
  }

  function model(I) {
    const product = I.product == null ? null : I.product;
    const total = tally(I, I.cards, null, product);
    const build = (field) => {
      const names = [...new Set(I.cards.flatMap((c) => c[field]))];
      return new Map(names.map((n) => {
        const mine = I.cards.filter((c) => c[field].includes(n));
        const w = (c) => c[field].includes(n) ? 1 / c[field].length : 0;
        return [n, { name: n, cards: mine, w, full: tally(I, mine, null, product), fair: tally(I, mine, (c) => 1 / c[field].length, product) }];
      }));
    };
    return { I, product, total, team: build('teams'), player: build('playerNames') };
  }

  const METRICS = { autos: (t) => t.autos, hits: (t) => t.hits, live: (t) => t.ones.live, cards: (t) => t.cards };
  // Teams (or players) in rank order for a metric: by share (half credit for shared cards), then numbered copies, then name.
  function ranked(map, metric) {
    const get = METRICS[metric];
    return [...map.values()].sort((a, b) => (get(b.fair) - get(a.fair)) || (b.full.num.all - a.full.num.all) || a.name.localeCompare(b.name));
  }
  const rankOf = (map, metric, name) => ranked(map, metric).findIndex((x) => x.name === name) + 1;
  // One row of a ranked list: the count, its share of the set, and the even share (1 of the teams or players).
  function rankRows(M, kind, metric) {
    const map = kind === 'team' ? M.team : M.player, get = METRICS[metric], tot = get(M.total), even = map.size ? 1 / map.size : 0;
    return ranked(map, metric).map((x, i) => ({ name: x.name, rank: i + 1, value: get(x.full), share: share(get(x.fair), tot), even, full: x.full }));
  }

  // The panel: one row per top-line number. Left: the number and its rank. Right: its share of the set as a bar whose
  // middle tick is an even share (1 of n teams or players), so a fill past the middle is more than an even share; the
  // bar is full at twice an even share. Shares use half credit for shared cards; the numbers count them in full.
  const ROWS = [
    { key: 'autos', label: 'Autos', get: (t) => t.autos, of: "of the set's autos", unit: 'auto cards', none: 'No autos in this set' },
    { key: 'hits', label: 'Case hits', get: (t) => t.hits, of: "of the set's case hits", unit: 'SSP cards', none: 'No case hits in this set' },
    { key: 'live', label: '<span class="ss-nocase">1/1s</span> live', get: (t) => t.ones.live, of: 'of the live 1/1s', unit: 'live', none: 'No live 1/1s in this set' },
    { key: 'cards', label: 'Cards', get: (t) => t.cards, of: 'of the checklist', unit: 'cards', none: 'No cards' },
  ];
  const pct1 = (x) => x === 0 ? '0%' : x < 0.001 ? '<0.1%' : (x * 100).toFixed(1) + '%';

  // opts.footer: HTML for the right end of the panel's footer (the page's Back to cards button).
  function panel(M, kind, name, opts = {}) {
    const map = kind === 'team' ? M.team : M.player;
    const x = map.get(name);
    if (!x) return `<div class="ss-panel"><p class="ss-note">No cards for ${esc(name)} here.</p></div>`;
    const T = M.total, n = map.size, even = 1 / n, who = kind === 'team' ? 'teams' : 'players';
    const rows = ROWS.map((r) => {
      const v = r.get(x.full), tot = r.get(T), s = share(r.get(x.fair), tot);
      // No rank when the set has none of it (every team would tie).
      const rank = tot ? `#${rankOf(map, r.key, name)} of ${n} ${who}` : '';
      const pulled = x.full.ones.pulled + x.full.ones.off;
      const left = r.key === 'live'
        ? `<b class="ss-big">${int(v)}<em> of ${int(x.full.ones.all)}</em></b><small class="ss-rank">${[pulled ? `${int(pulled)} reported pulled` : '', rank].filter(Boolean).join(' · ')}</small>`
        : `<b class="ss-big">${int(v)}</b><small class="ss-rank">${rank}</small>`;
      const right = !tot ? `<small class="ss-count">${r.none}</small>` :
        `<span class="ss-share"><b>${pct1(s)} ${r.of}</b><span class="ss-x">${s ? `${(s / even).toFixed(1)}× even` : ''}</span></span>` +
        `<span class="ss-meter" role="img" aria-label="${pct1(s)}, an even share is ${pct1(even)}"><i style="width:${Math.min(100, 50 * s / even)}%"></i><span class="ss-even"></span></span>` +
        `<small class="ss-count">${int(v)} of ${int(tot)} ${r.unit}</small>`;
      return `<div class="ss-row" data-metric="${r.key}"><div class="ss-left"><span class="ss-lab">${r.label}</span>${left}</div><div class="ss-right">${right}</div></div>`;
    }).join('');
    // Only a product filter changes what the numbers mean, so only then does the footer say so.
    const scope = M.product == null ? '' : `${esc((M.I.products.find((p) => p.id === M.product) || {}).Product || 'One product')} only`;
    return `<div class="ss-panel"><div class="ss-head"><h4>Share of the set</h4></div>${rows}
      <div class="ss-foot"><span class="ss-note">${scope}</span>${opts.footer || ''}</div></div>`;
  }

  // Styles, added once. The variables fall back to the checklist's palette.
  const STYLES = `
  .ss-panel { background: var(--surface, #fff); }
  .ss-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 10px 16px 8px; }
  .ss-head h4 { margin: 0; font-family: var(--cond, sans-serif); font-weight: 700; font-size: 17px; }
  .ss-head small { color: var(--muted, #5E6B78); font-size: 12.5px; text-align: right; }
  .ss-row { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; align-items: center; padding: 14px 16px; border-top: 1px solid var(--line, #D3DAE1); }
  .ss-left { display: flex; flex-direction: column; }
  .ss-lab { font-family: var(--cond, sans-serif); font-weight: 600; font-size: 14px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted, #5E6B78); }
  .ss-nocase { text-transform: none; }
  .ss-big { font-family: var(--cond, sans-serif); font-weight: 700; font-size: 34px; line-height: 1.05; font-variant-numeric: tabular-nums; }
  .ss-big em { font-style: normal; font-size: 18px; font-weight: 600; color: var(--muted, #5E6B78); }
  .ss-rank, .ss-count { color: var(--muted, #5E6B78); font-size: 12.5px; line-height: 1.3; }
  .ss-share { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14px; }
  .ss-share b { font-weight: 600; } .ss-x { flex: none; font-size: 12.5px; color: var(--muted, #5E6B78); }
  .ss-meter { position: relative; display: block; height: 8px; margin: 6px 0 5px; background: var(--bg, #E9EDF1); border-radius: 4px; }
  .ss-meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--pitch, #0F7A55); }
  .ss-even { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--ink, #14212E); border-radius: 1px; box-shadow: 0 0 0 1px var(--surface, #fff); }
  .ss-foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 16px 14px; border-top: 1px solid var(--line, #D3DAE1); }
  .ss-note { color: var(--muted, #5E6B78); font-size: 12.5px; }
  .ss-note:empty { display: none; }
  .ss-foot > :not(.ss-note) { flex: none; margin-left: auto; }
  @media (max-width: 600px) {
    .ss-head { display: block; padding: 10px 12px 8px; } .ss-head small { display: block; text-align: left; }
    .ss-row { grid-template-columns: 96px minmax(0, 1fr); gap: 14px; padding: 12px; }
    .ss-big { font-size: 30px; } .ss-lab { font-size: 13px; }
    .ss-foot { flex-direction: column; text-align: center; gap: 10px; padding: 10px 12px 14px; } .ss-foot > :not(.ss-note) { margin: 0 auto; }
  }`;
  function injectStyles() {
    if (document.getElementById('ss-styles')) return;
    const s = document.createElement('style'); s.id = 'ss-styles'; s.textContent = STYLES; document.head.appendChild(s);
  }

  window.SetStats = { model, panel, injectStyles, tally, rankOf, rankRows };
})();
