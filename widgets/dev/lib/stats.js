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
// Expected autos per box = Autos_Per_Box × share of auto cards, assuming each auto card is equally likely.
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
  function rankOf(map, metric, name) {
    const get = METRICS[metric];
    const list = [...map.values()].sort((a, b) => (get(b.fair) - get(a.fair)) || (b.full.num.all - a.full.num.all) || a.name.localeCompare(b.name));
    return list.findIndex((x) => x.name === name) + 1;
  }

  // A thin share bar with a tick at an even share (teams only); scale = the leader's share, so a full bar means "leads".
  const meter = (x, scale, even, tip) => `<span class="ss-meter" title="${esc(tip)}"><i style="width:${scale ? Math.min(100, 100 * x / scale) : 0}%"></i>` +
    (even != null && scale ? `<span class="ss-even" style="left:${Math.min(100, 100 * even / scale)}%"></span>` : '') + `</span>`;

  function panel(M, kind, name) {
    const map = kind === 'team' ? M.team : M.player;
    const x = map.get(name);
    if (!x) return `<div class="ss-panel"><p class="ss-note">No cards for ${esc(name)} here.</p></div>`;
    const T = M.total, f = x.full, fr = x.fair, n = map.size;
    const even = kind === 'team' ? 1 / n : null;
    const r = (m) => `#${rankOf(map, m, name)} of ${n}`;
    const tiles = `<div class="ss-tiles">
      <div class="ss-stat"><span>Autos</span><b>${int(f.autos)}</b><small>${T.autos ? `${pct(share(fr.autos, T.autos))} of the set · ${r('autos')}` : 'No autos in this set'}</small></div>
      <div class="ss-stat"><span>Case hits</span><b>${int(f.hits)}</b><small>${T.hits ? `${pct(share(fr.hits, T.hits))} of the set · ${r('hits')}` : 'No case hits in this set'}</small></div>
      <div class="ss-stat"><span>1/1s live</span><b>${int(f.ones.live)}<em> of ${int(f.ones.all)}</em></b><small>${f.ones.all ? `${int(f.ones.pulled + f.ones.off)} reported pulled` : 'No 1/1s'}</small></div>
      <div class="ss-stat"><span>Cards</span><b>${int(f.cards)}</b><small>${pct(share(fr.cards, T.cards))} of the checklist${f.mem ? ` · ${plural(f.mem, 'relic')}` : ''}</small></div></div>`;

    // Per box: within each product (or the chosen one), from this team's or player's share.
    const lines = [];
    for (const p of M.I.products.filter((p) => M.product == null || p.id === M.product)) {
      const mine = tally(M.I, x.cards, x.w, p.id), all = tally(M.I, M.I.cards, null, p.id);
      const est = [];
      if (p.Autos_Per_Box > 0 && all.autos) est.push(['auto', p.Autos_Per_Box * share(mine.autos, all.autos)]);
      if (p.Numbered_Per_Box > 0 && all.num.all) est.push(['numbered card', p.Numbered_Per_Box * share(mine.num.all, all.num.all)]);
      for (const [what, perBox] of est) {
        const perCase = p.Boxes_Per_Case > 0 ? perBox * p.Boxes_Per_Case : null;
        const oneIn = perBox > 0 && perBox < 1 ? ` · about 1 in ${int(1 / perBox)} boxes` : '';
        lines.push(`<div class="ss-odds"><span>${esc(p.Product)}<small>${what}s${oneIn}${perCase != null ? ` · ${perCase.toFixed(1)} per case` : ''}</small></span><b>${perBox.toFixed(2)}<small>per box</small></b></div>`);
      }
    }
    const odds = lines.length ? `<div class="ss-sec"><h4>Per box <small>estimate · no published odds</small></h4>${lines.join('')}</div>` : '';

    const tiers = [
      ['Autographs', 'auto cards', (t) => t.autos, T.autos],
      ['Numbered autos', 'copies', (t) => t.num.auto, T.num.auto],
      ['Numbered inserts', 'copies', (t) => t.num.insert, T.num.insert],
      ['Numbered base parallels', 'copies', (t) => t.num.base, T.num.base],
      ['Case hits', 'cards', (t) => t.hits, T.hits],
      ['Relics', 'cards', (t) => t.mem, T.mem],
      ['1/1s', 'copies', (t) => t.ones.all, T.ones.all],
    ].filter((t) => t[3] > 0).map(([label, unit, get, tot]) => {
      const s = share(get(fr), tot);
      const scale = Math.max(even || 0, ...[...map.values()].map((y) => share(get(y.fair), tot)));
      return `<div class="ss-tier"><span class="ss-lab">${label}<small>${int(get(f))} of ${int(tot)} ${unit}</small></span>${meter(s, scale, even, `${pct(s)} of the set's ${label.toLowerCase()}${even ? ` · even share ${pct(even)}` : ''}`)}<span class="ss-num">${pct(s)}${even && s ? `<small>${(s / even).toFixed(1)}× even</small>` : ''}</span></div>`;
    }).join('');
    const shares = `<div class="ss-sec"><h4>Share of the set <small>${even ? 'tick = even share · full bar = leader' : 'full bar = leader'}</small></h4>${tiers}</div>`;
    const scope = M.product == null ? 'Whole set, every product' : `${esc((M.I.products.find((p) => p.id === M.product) || {}).Product || 'One product')} only`;
    return `<div class="ss-panel">${tiles}${odds}${shares}<p class="ss-note">${scope}. Filters other than Product don't change these numbers. Cards shared with another ${kind} count half in shares and estimates.</p></div>`;
  }

  // Styles, added once. The variables fall back to the checklist's palette.
  const CSS = `
  .ss-panel { padding: 10px 12px 12px; border-top: 1px solid var(--line, #D3DAE1); background: var(--surface, #fff); }
  .ss-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  @media (max-width: 600px) { .ss-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .ss-stat { border: 1px solid var(--line, #D3DAE1); border-radius: 10px; padding: 8px 10px; }
  .ss-stat span { display: block; font-family: var(--cond, sans-serif); font-weight: 600; font-size: 14px; color: var(--muted, #5E6B78); }
  .ss-stat b { display: block; font-family: var(--cond, sans-serif); font-weight: 700; font-size: 26px; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .ss-stat b em { font-style: normal; font-size: 15px; font-weight: 600; color: var(--muted, #5E6B78); }
  .ss-stat small { display: block; color: var(--muted, #5E6B78); font-size: 12.5px; line-height: 1.3; }
  .ss-sec { margin-top: 12px; }
  .ss-sec h4 { margin: 0 0 2px; font-family: var(--cond, sans-serif); font-weight: 700; font-size: 17px; }
  .ss-sec h4 small { font-family: var(--body, sans-serif); font-weight: 400; font-size: 12.5px; color: var(--muted, #5E6B78); margin-left: 6px; }
  @media (max-width: 600px) { .ss-sec h4 small { display: block; margin: 0; } }
  .ss-odds { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 0; border-top: 1px solid var(--line, #D3DAE1); }
  .ss-odds span { font-size: 14px; font-weight: 600; } .ss-odds span small { display: block; font-weight: 400; font-size: 12.5px; color: var(--muted, #5E6B78); }
  .ss-odds b { text-align: right; font-family: var(--cond, sans-serif); font-weight: 700; font-size: 22px; line-height: 1; } .ss-odds b small { display: block; font-family: var(--body, sans-serif); font-weight: 400; font-size: 12px; color: var(--muted, #5E6B78); }
  .ss-tier { display: grid; grid-template-columns: minmax(120px, 32%) minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line, #D3DAE1); }
  @media (max-width: 600px) { .ss-tier { grid-template-columns: minmax(0, 1fr) auto; } .ss-tier .ss-meter { grid-column: 1 / -1; grid-row: 2; } }
  .ss-lab { font-size: 14px; } .ss-lab small { display: block; color: var(--muted, #5E6B78); font-size: 12px; }
  .ss-num { text-align: right; font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; } .ss-num small { display: block; color: var(--muted, #5E6B78); font-size: 12px; }
  .ss-meter { position: relative; display: block; height: 8px; background: var(--bg, #E9EDF1); border-radius: 4px; }
  .ss-meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--pitch, #0F7A55); }
  .ss-even { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--ink, #14212E); border-radius: 1px; box-shadow: 0 0 0 1px var(--surface, #fff); }
  .ss-note { margin: 10px 0 0; color: var(--muted, #5E6B78); font-size: 12.5px; }`;
  function injectStyles() {
    if (document.getElementById('ss-styles')) return;
    const s = document.createElement('style'); s.id = 'ss-styles'; s.textContent = CSS; document.head.appendChild(s);
  }

  window.SetStats = { model, panel, injectStyles, tally, rankOf };
})();
