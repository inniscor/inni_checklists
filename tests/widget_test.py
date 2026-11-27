"""Headless browser tests for the checklist widget.

Usage:
    python3 tests/widget_test.py [widget folder]     # default: widgets/dev

Loads the widget with sample data (tests/fixtures/demo.json) in demo mode, plus once inside an iframe with a
stand-in for the Grist plugin API, and checks layout, the status menu (including the Pulls changes it makes), the
Status filter, the set switcher and its fallbacks, at desktop and phone widths.

Needs Playwright for Python (pip install playwright, then: python3 -m playwright install chromium).
Set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
Exits non-zero if any check fails or the page throws an error.
"""
import copy
import csv
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WIDGET = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "widgets/dev") / "index.html"
DEMO = json.loads((ROOT / "tests/fixtures/demo.json").read_text())
SETS = json.loads((ROOT / "sets.json").read_text())
PLUGIN_TAG = '<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>'
TMP = Path(tempfile.mkdtemp(prefix="widget-test-"))

results, page_errors = [], []


def check(name, cond):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name)


def demo_page(browser, tab="checklist", by="subset", w=760, h=900, demo=None, sets=SETS,
              doc="pCMKPajFwTiuzyVLySNiMT", name="2026 Panini Prizm Black NWSL", custom=None):
    """The widget in demo mode: data, set list and doc identity come from window globals instead of Grist."""
    js = ("localStorage.clear();"
          f"localStorage.setItem('cl:tab',{json.dumps(json.dumps(tab))});"
          f"localStorage.setItem('cl:groupBy',{json.dumps(json.dumps({'checklist': by, 'ones': by}))});"
          f"window.DEMO_DATA={json.dumps(demo or DEMO)};window.DEMO_SETS={json.dumps(sets)};"
          f"window.DEMO_DOC_ID={json.dumps(doc)};window.DEMO_DOC_NAME={json.dumps(name)};")
    if custom is not None:
        js += f"localStorage.setItem('cl:customTeams',{json.dumps(json.dumps(custom))});"
    f = TMP / f"demo_{tab}_{w}.html"
    # The page is written to a temp folder, so files beside the widget (lib/) are loaded from the widget folder itself.
    f.write_text(WIDGET.read_text().replace(PLUGIN_TAG, f"<script>{js}</script>").replace('src="lib/', f'src="{(WIDGET.parent / "lib").as_uri()}/'))
    pg = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
    pg.set_default_timeout(5000)
    pg.on("pageerror", lambda e: page_errors.append(str(e)))
    pg.goto(f.as_uri())
    pg.wait_for_timeout(250)
    return pg


DASH = WIDGET.parent / "dashboard.html"


def dash_page(browser, w=760, h=900, demo=None, custom=None, doc="pCMKPajFwTiuzyVLySNiMT"):
    """The dashboard (dashboard.html beside the widget) in demo mode, like demo_page."""
    js = ("localStorage.clear();"
          f"window.DEMO_DATA={json.dumps(demo or DEMO)};window.DEMO_SETS={json.dumps(SETS)};"
          f"window.DEMO_DOC_ID={json.dumps(doc)};window.DEMO_DOC_NAME='Checklist Sandbox';")
    if custom is not None:
        js += f"localStorage.setItem('cl:customTeams',{json.dumps(json.dumps(custom))});"
    f = TMP / f"dash_{w}.html"
    f.write_text(DASH.read_text().replace(PLUGIN_TAG, f"<script>{js}</script>").replace('src="lib/', f'src="{(WIDGET.parent / "lib").as_uri()}/'))
    pg = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
    pg.set_default_timeout(5000)
    pg.on("pageerror", lambda e: page_errors.append(str(e)))
    pg.goto(f.as_uri())
    pg.wait_for_selector("#list .group")
    return pg


def dash_rows(pg):
    return pg.evaluate("() => [...document.querySelectorAll('#list .group')].map((g) => ({ name: g.querySelector('.ghwrap .who strong').textContent, rank: g.querySelector('.ghwrap .rk').textContent, value: g.querySelector('.ghwrap .val b').textContent.replace(/\\s+/g, ' ').trim(), open: g.querySelector('.rowmain').getAttribute('aria-expanded') === 'true' }))")


def dash_players(pg, team):
    return pg.evaluate("(t) => [...document.querySelectorAll(`#list .group[data-group=\"${CSS.escape(t)}\"] .prow`)].map((r) => ({ name: r.querySelector('.who strong')?.textContent, rank: r.querySelector('.rk')?.textContent }))", team)


def dash_flip(pg, team, player=None):
    sel = f'.gstats[data-flip="{team}"]' + (f'[data-player="{player}"]' if player else ':not([data-player])')
    pg.wait_for_function("() => !document.querySelector('.flip-out, .flip-in')")
    pg.click(sel)
    pg.wait_for_selector(f'.group.flipped[data-group="{team}"] .ss-panel')
    pg.wait_for_function("() => !document.querySelector('.flip-out, .flip-in')")


def dash_back(pg, how="escape"):
    if how == "escape":
        pg.keyboard.press("Escape")
    else:
        pg.click(".group.flipped .ss-foot [data-flip]")
    pg.wait_for_function("() => !document.querySelector('.group.flipped') && !document.querySelector('.flip-out, .flip-in')")


def test_dashboard(browser):
    if not DASH.exists():
        return
    pg = dash_page(browser)
    check("dashboard: title from sets.json", pg.inner_text("#settitle") == "Prizm Black")
    check("dashboard: Default tab selected, Break shown but disabled",
          pg.get_attribute("#tab-default", "aria-selected") == "true" and pg.is_disabled("#tab-break"))
    pg.click("#tab-break", force=True)
    check("dashboard: clicking Break does nothing", pg.get_attribute("#tab-default", "aria-selected") == "true")
    check("dashboard: no filters and no Group by, just search and Rank by",
          pg.query_selector("#fbtn, #filters, #groupby") is None and pg.is_visible("#q") and pg.is_visible("#rankby"))
    check("dashboard: Cards is the first Rank by option and the default",
          pg.evaluate("() => [...document.querySelectorAll('#rankby button')].map((b) => b.textContent)") == ["Cards", "Autos", "Case hits", "1/1s live"]
          and pg.get_attribute('#rankby [data-metric="cards"]', "aria-pressed") == "true")
    check("dashboard: by default teams are ranked by cards (shared cards count half; ties by numbered copies, then name)",
          [r["name"] for r in dash_rows(pg)] == ["Gotham FC", "Kansas City Current", "Angel City FC", "Washington Spirit", "Houston Dash", "Portland Thorns FC"])
    pg.click('#rankby [data-metric="autos"]')
    rows = dash_rows(pg)
    check("dashboard: Rank by Autos reorders (ties broken by numbered copies, then name)",
          [r["name"] for r in rows] == ["Kansas City Current", "Angel City FC", "Washington Spirit", "Gotham FC", "Houston Dash", "Portland Thorns FC"])
    check("dashboard: each team shows its rank and the ranked number, closed", rows[0]["rank"] == "1" and rows[0]["value"] == "1" and not any(r["open"] for r in rows))
    check("dashboard: team cards are tinted with their color", "#D5F1F1" in (pg.get_attribute('.group[data-group="Kansas City Current"] .ghwrap', "style") or "").upper())
    check("dashboard: the share bar's even-share tick sits in the middle",
          pg.evaluate("() => { const m = document.querySelector('.meter'), t = m.querySelector('.even'); return Math.round(100 * (t.getBoundingClientRect().left + 1 - m.getBoundingClientRect().left) / m.getBoundingClientRect().width); }") == 50)
    pg.click('.rowmain[data-toggle="Kansas City Current"]')
    kc = dash_players(pg, "Kansas City Current")
    check("dashboard: clicking a team opens its players, ranked the same way", [p["name"] for p in kc] == ["Temwa Chawinga", "Croix Bethune"])
    check("dashboard: player ranks are across the whole set", kc[0]["rank"] == "1" and kc[1]["rank"] != "2")
    sub = pg.evaluate("() => document.querySelector('.prow .who small').textContent")
    check("dashboard: a player's subline lists cards first", sub.startswith("4 cards ·"))
    check("dashboard: the team's subline does too", pg.evaluate("() => document.querySelector('.ghwrap .who small').textContent").startswith("4 cards ·"))
    check("dashboard: each player has a chart button", pg.query_selector('.prow .gstats[data-player="Temwa Chawinga"]') is not None)
    pg.click('.rowmain[data-toggle="Kansas City Current"]')
    check("dashboard: clicking it again closes it", dash_players(pg, "Kansas City Current") == [])

    dash_flip(pg, "Kansas City Current")
    check("dashboard: the team's chart button flips the card to the team's stats", metric(pg, "Kansas City Current", "autos")["share"] == "33.3% of the set's autos")
    check("dashboard: the rest of the list dims and can't be used", pg.evaluate("() => [...document.querySelectorAll('#list .group:not(.flipped)')].every((g) => g.inert)"))
    dash_back(pg)
    pg.click('.rowmain[data-toggle="Kansas City Current"]')
    dash_flip(pg, "Kansas City Current", "Temwa Chawinga")
    banner = pg.inner_text('.group.flipped .pbanner')
    tc = metric(pg, "Kansas City Current", "autos")
    check("dashboard: a player's chart button flips the whole team card to her stats", "Temwa Chawinga" in banner and tc["rank"].endswith("of 9 players"))
    check("dashboard: the flipped card hides the player rows", pg.query_selector(".group.flipped .prow") is None)
    dash_back(pg, "button")
    check("dashboard: Back to the list returns to the open team", [p["name"] for p in dash_players(pg, "Kansas City Current")] == ["Temwa Chawinga", "Croix Bethune"])

    pg.fill("#q", "rodman")
    check("dashboard: typing a player's name shows her team, open, with only her",
          [r["name"] for r in dash_rows(pg)] == ["Washington Spirit"] and [p["name"] for p in dash_players(pg, "Washington Spirit")] == ["Trinity Rodman"])
    pg.fill("#q", "gotham")
    check("dashboard: typing a team's name shows the team as it is", [r["name"] for r in dash_rows(pg)] == ["Gotham FC"] and not dash_rows(pg)[0]["open"])
    pg.fill("#q", "zzz")
    check("dashboard: no match says so", "No teams or players match" in pg.inner_text("#list"))
    pg.fill("#q", "esth")
    check("dashboard: typing offers players to pin", pg.query_selector('#suggest [data-pin="Esther Gonzalez"]') is not None)
    pg.click('#suggest [data-pin="Esther Gonzalez"]')
    check("dashboard: a pinned player shows as a chip and clears the search", pg.query_selector('#chips [data-unpin="Esther Gonzalez"]') is not None and pg.input_value("#q") == "")
    check("dashboard: pinned: only her team, open, with only her",
          [r["name"] for r in dash_rows(pg)] == ["Gotham FC"] and [p["name"] for p in dash_players(pg, "Gotham FC")] == ["Esther Gonzalez"])
    pg.fill("#q", "temwa")
    pg.press("#q", "ArrowDown")
    pg.press("#q", "Enter")
    check("dashboard: pin a second player from the keyboard; both teams show",
          [r["name"] for r in dash_rows(pg)] == ["Kansas City Current", "Gotham FC"] and [p["name"] for p in dash_players(pg, "Kansas City Current")] == ["Temwa Chawinga"])
    pg.click('#chips [data-unpin="*"]')
    check("dashboard: Clear all brings every team back", len(dash_rows(pg)) == 6 and pg.is_hidden("#chips"))
    pg.close()

    team = {"on": True, "teams": [{"id": "t1", "name": "Trinity Squared", "color": "#7048E8", "players": ["Trinity Rodman", "Temwa Chawinga"]}]}
    pg = dash_page(browser, custom=team)
    pg.click('#rankby [data-metric="autos"]')
    rows = dash_rows(pg)
    check("dashboard: custom teams apply (Trinity Squared leads on autos, Washington is gone)",
          rows[0]["name"] == "Trinity Squared" and rows[0]["value"] == "2" and "Washington Spirit" not in [r["name"] for r in rows])
    pg.click('.rowmain[data-toggle="Trinity Squared"]')
    check("dashboard: a custom team opens to its claimed players", sorted(p["name"] for p in dash_players(pg, "Trinity Squared")) == ["Temwa Chawinga", "Trinity Rodman"])
    check("dashboard: Customize shows its dot", pg.is_visible("#custbtn .cdot"))
    pg.click("#custbtn")
    check("dashboard: the Customize drawer opens", pg.is_visible("#ctdrawer"))
    pg.uncheck("#cton")
    pg.keyboard.press("Escape")
    check("dashboard: turning custom teams off in its drawer updates the list", "Washington Spirit" in [r["name"] for r in dash_rows(pg)] and pg.is_hidden("#custbtn .cdot"))
    check("dashboard: the change is saved for the checklist too", stored_teams(pg)["on"] is False)
    pg.close()

    pg = dash_page(browser, w=390)
    pg.click('.rowmain[data-toggle="Gotham FC"]')
    check("dashboard: team cards and player rows fit on a phone",
          pg.evaluate("() => [...document.querySelectorAll('.group, .prow')].every((g) => g.getBoundingClientRect().right <= innerWidth)"))
    pg.screenshot(path=str(TMP / "dashboard_390.png"), full_page=True)
    pg.close()


def pulls(pg):
    return pg.evaluate("() => JSON.parse(JSON.stringify(window.DEMO_DATA.Pulls))")


def pull_rows(pg, card, par):
    P = pulls(pg)
    return [i for i, k in enumerate(zip(P["Card_Key"], P["Parallel_Key"])) if k == (card, par)], P


def tile_offsets(pg, sel):
    """How far each row's card number sits from the middle of its team tile (dx) and of its card line (dy)."""
    return pg.evaluate("""(sel) => [...document.querySelectorAll(sel)].slice(0, 4).map((card) => {
      const cs = getComputedStyle(card, '::before'), r = card.getBoundingClientRect(), n = card.querySelector('.num').getBoundingClientRect();
      const left = r.left + parseFloat(cs.left), width = parseFloat(cs.width);
      const line = (card.querySelector(':scope > button') || card.querySelector('.slotrow')).getBoundingClientRect();
      return { dx: n.left + n.width / 2 - (left + width / 2), dy: n.top + n.height / 2 - (line.top + line.height / 2) };
    })""", sel)


def test_checklist_and_ones(browser, w):
    pg = demo_page(browser, "checklist", w=w)
    pg.click('.ghead:has-text("Base")')
    for cid in (1, 2, 3):
        pg.click(f'button[data-card="{cid}"]')
    check(f"[{w}] chevron sits after the card name", pg.query_selector('button[data-card="1"] .who strong .chev'))
    rot = pg.evaluate("() => ['1', '5'].map((id) => getComputedStyle(document.querySelector(`[data-card=\"${id}\"] .chev`)).transform)")
    check(f"[{w}] chevron turns only on open rows", rot[0] != "none" and rot[1] == "none")
    off = tile_offsets(pg, "#list .card")
    check(f"[{w}] checklist number centered in its tile and on its line", all(abs(o["dx"]) < 1.5 and abs(o["dy"]) < 1.5 for o in off))
    chips = {x.get_attribute("data-one"): x.get_attribute("class") for x in pg.query_selector_all(".par.one")}
    check(f"[{w}] 1/1 chips show off / pulled / live", "off" in chips.get("1:9", "") and "pulled" in chips.get("2:9", "") and "live" in chips.get("3:9", ""))
    pg.click('[data-one="2:9"]')
    pg.wait_for_timeout(100)
    check(f"[{w}] a 1/1 chip opens the 1/1s tab focused on its status pill",
          pg.evaluate("() => document.activeElement && document.activeElement.dataset.status") == "2:9")
    pg.close()

    pg = demo_page(browser, "ones", w=w)
    pg.click('.ghead:has-text("Base")')
    ones_off = tile_offsets(pg, "#list .card.slot")
    check(f"[{w}] 1/1 number centered the same way as the checklist",
          all(abs(o["dx"]) < 1.5 and abs(o["dy"]) < 1.5 for o in ones_off) and abs(ones_off[0]["dx"] - off[0]["dx"]) < 1)
    labels = [x.inner_text().strip() for x in pg.query_selector_all(".par.status")][:3]
    check(f"[{w}] status pills read {labels}", labels == ["Pulled", "Pulled", "Live"])

    pg.click('[data-status="3:9"]')
    if w > 600:
        check("[desktop] status dropdown has 3 choices with Live checked",
              len(pg.query_selector_all(".menu .mi")) == 3 and pg.get_attribute('.menu [data-set="live"]', "aria-checked") == "true")
        pg.keyboard.press("ArrowDown")
        pg.keyboard.press("ArrowDown")
        check("[desktop] arrow keys move through the choices", pg.evaluate("() => document.activeElement.dataset.set") == "off")
        pg.keyboard.press("Escape")
        check("[desktop] Escape closes and returns focus to the pill",
              not pg.query_selector(".menu") and pg.evaluate("() => document.activeElement.dataset.status") == "3:9")
        pg.click('[data-status="3:9"]')
        pg.mouse.click(5, 5)
        check("[desktop] clicking outside closes the menu", not pg.query_selector(".menu"))
    else:
        check("[phone] status opens as a bottom sheet", pg.query_selector(".sheet") and pg.query_selector(".scrim"))
        pg.mouse.click(195, 60)
        check("[phone] tapping the scrim closes it without changes", not pg.query_selector(".sheet") and len(pulls(pg)["id"]) == 2)
    pg.click('[data-status="3:9"]')
    pg.click('.mi[data-set="off"]')
    pg.wait_for_timeout(120)
    rows, P = pull_rows(pg, 3, 9)
    check(f"[{w}] Live -> Off market adds a pull with Off_Market", rows and P["Off_Market"][rows[0]] is True)
    pg.click('[data-status="3:9"]')
    pg.click('.mi[data-set="pulled"]')
    pg.wait_for_timeout(120)
    rows, P = pull_rows(pg, 3, 9)
    check(f"[{w}] Off market -> Pulled updates the same pull", len(rows) == 1 and P["Off_Market"][rows[0]] is False)
    pg.click('[data-status="3:9"]')
    pg.click('.mi[data-set="live"]')
    pg.wait_for_timeout(120)
    check(f"[{w}] Pulled -> Live removes the pull", not pull_rows(pg, 3, 9)[0])

    pg.click("#fbtn")
    check(f"[{w}] Status filter offers three states",
          [x.inner_text() for x in pg.query_selector_all('#filters [data-f="status"]')] == ["Live", "Pulled", "Off market"])
    pg.click('#filters [data-f="status"][data-v="off"]')
    check(f"[{w}] Off market filter shows only off-market 1/1s",
          [x.get_attribute("data-slotrow") for x in pg.query_selector_all("[data-slotrow]")] == ["1:9"])
    pg.close()


def test_without_off_market(browser):
    d = copy.deepcopy(DEMO)
    del d["Pulls"]["Off_Market"]
    pg = demo_page(browser, "ones", demo=d)
    pg.click('.ghead:has-text("Base")')
    pg.click("#fbtn")
    check("doc without Off_Market: two states in filter and menu",
          [x.inner_text() for x in pg.query_selector_all('#filters [data-f="status"]')] == ["Live", "Pulled"]
          and (pg.click('[data-status="3:9"]') or len(pg.query_selector_all(".menu .mi")) == 2))
    pg.close()


def group_names(pg):
    return [g.inner_text().strip() for g in pg.query_selector_all("#list .ghead .gname")]


def cards_in_group(pg, name):
    """Opens the group (if closed) and returns the card IDs listed under it."""
    head = pg.query_selector(f'#list .ghead:has(.gname:text-is("{name}"))')
    if head.get_attribute("aria-expanded") != "true":
        head.click()
        head = pg.query_selector(f'#list .ghead:has(.gname:text-is("{name}"))')
    section = head.evaluate_handle("h => h.closest('section')")
    return [int(b.get_attribute("data-card")) for b in section.query_selector_all("button[data-card]")]


def row_style(pg, card_id):
    return pg.eval_on_selector(f'button[data-card="{card_id}"]', "b => b.closest('.card').getAttribute('style') || ''")


def test_teams(browser):
    tint = dict(zip(DEMO["Teams"]["Team"], DEMO["Teams"]["Tint"]))
    multi = next(i for i, t in zip(DEMO["Cards"]["id"], DEMO["Cards"]["Team"]) if " / " in t)
    a, b = [x.strip() for x in DEMO["Cards"]["Team"][DEMO["Cards"]["id"].index(multi)].split(" / ")]
    pg = demo_page(browser, "checklist", by="team")
    names = group_names(pg)
    check(f"grouped by team: no combined group for #{multi}", not any(" / " in n for n in names) and a in names and b in names)
    check(f"multi-team card #{multi} is listed under {a} and under {b}", multi in cards_in_group(pg, a) and multi in cards_in_group(pg, b))
    heads = {h.inner_text().split("\n")[0].strip(): h.get_attribute("style") or "" for h in pg.query_selector_all("#list .ghead")}
    check("team headers are tinted with their team's color", all(tint[n] in heads[n] for n in names if n in tint))
    single = next(i for i, t in zip(DEMO["Cards"]["id"], DEMO["Cards"]["Team"]) if t == a)
    check(f"a single-team row tints its tile with {a}'s color", f"--blk:linear-gradient({tint[a]}, {tint[a]})" in row_style(pg, single))
    st = row_style(pg, multi)
    check(f"multi-team row blends {a} to {b}", "90deg" in st and st.index(tint[a]) < st.index(tint[b]))
    pg.click("#fbtn")
    pg.click(f'#filters [data-f="team"][data-v="{a}"]')
    check(f"team filter on {a}: only the {a} group shows, with the shared card", group_names(pg) == [a] and multi in cards_in_group(pg, a))
    pg.close()

    pg = demo_page(browser, "checklist", by="subset")
    check("grouped by subset: headers aren't tinted", not any(h.get_attribute("style") for h in pg.query_selector_all("#list .ghead")))
    pg.close()

    pg = demo_page(browser, "checklist", by="player")
    pg.fill("#q", "Esther")
    pg.click('#suggest [data-add="Esther Gonzalez"]')
    pg.fill("#q", "")
    pg.dispatch_event("#q", "input")
    check("pinned player, grouped by player: only that player's group shows", group_names(pg) == ["Esther Gonzalez"] and multi in cards_in_group(pg, "Esther Gonzalez"))
    pg.close()

    d = copy.deepcopy(DEMO)
    del d["Teams"]
    pg = demo_page(browser, "checklist", by="team", demo=d)
    cards_in_group(pg, a)
    check("no Teams table: no tiles or headers are tinted",
          not any(h.get_attribute("style") for h in pg.query_selector_all("#list .ghead")) and "--blk" not in row_style(pg, multi))
    pg.close()


# The 16 NWSL club colors and the tints the sandbox's Teams.Tint formula gives them (Nov 2026).
DOC_TINTS = {"#F1B1A5": "#F7D5CE", "#0D2032": "#D2E3F3", "#36E882": "#CEF8E0", "#3AB5E8": "#CEECF8", "#20604E": "#D5F1E9",
             "#000000": "#E0E0E0", "#FF6900": "#F8DFCE", "#62CBC9": "#D5F1F1", "#AB0033": "#F8CEDA", "#61259E": "#E3D2F4",
             "#99242B": "#F4D2D4", "#14002F": "#E0CEF8", "#FC1896": "#F8CEE5", "#2E407A": "#D6DCF0", "#FDB71A": "#F8EBCE",
             "#F3FB00": "#F7F8CE"}


def stored_teams(pg):
    return pg.evaluate("() => JSON.parse(localStorage.getItem('cl:customTeams') || 'null')")


def csv_rows(pg):
    with pg.expect_download() as dl:
        pg.click("#download")
    with open(dl.value.path(), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def test_custom_teams(browser):
    pg = demo_page(browser, "checklist", by="team")
    got = pg.evaluate(f"() => Object.fromEntries(Object.keys({json.dumps(DOC_TINTS)}).map((c) => [c, window.__tintOf(c)]))")
    check("custom team tint matches the doc's Tint formula for all 16 club colors", got == DOC_TINTS)
    check("no custom teams: Customize shows no dot", pg.is_hidden("#custbtn .cdot") and "on" not in (pg.get_attribute("#custbtn", "class") or "").split())
    check("there's no custom-teams line in the summary", pg.query_selector("#ctnote") is None)
    pg.close()

    # Override: Rodman (Washington's only player) and Chawinga (on two shared cards) move to Trinity Squared.
    team = {"on": True, "teams": [{"id": "t1", "name": "Trinity Squared", "color": "#7048E8", "players": ["Trinity Rodman", "temwa chawinga"]}]}
    tint = pg_tint = None
    pg = demo_page(browser, "checklist", by="team", custom=team)
    tint = pg.evaluate("() => window.__tintOf('#7048E8')")
    names = group_names(pg)
    check("custom team is listed first when grouped by team", names[0] == "Trinity Squared")
    check("Washington Spirit disappears once its only player is claimed", "Washington Spirit" not in names)
    mine = cards_in_group(pg, "Trinity Squared")
    check("custom team holds the claimed players' cards (name match ignores case)", set(mine) == {3, 10, 4, 11, 9, 13})
    kc = cards_in_group(pg, "Kansas City Current")
    check("claimed cards leave the real team; the shared card with an unclaimed teammate stays", 9 in kc and 4 not in kc and 11 not in kc)
    check("shared card with one claimed player shows under the other player's team too", 13 in cards_in_group(pg, "Gotham FC"))
    check("a claimed card's tile uses the custom team's tint", f"--blk:linear-gradient({tint}, {tint})" in row_style(pg, 3))
    st = row_style(pg, 9)
    check("shared card blends the custom tint with the teammate's team", "90deg" in st and tint in st and "#D5F1F1" in st)
    heads = {h.inner_text().split("\n")[0].strip(): h.get_attribute("style") or "" for h in pg.query_selector_all("#list .ghead")}
    check("custom team header is tinted", tint in heads["Trinity Squared"])
    check("Customize shows its dot while custom teams are in effect", pg.is_visible("#custbtn .cdot") and "on" in pg.get_attribute("#custbtn", "class").split())
    rows = {r["Card Number"] + r["Subset"]: r for r in csv_rows(pg)}
    check("CSV: a claimed card's Team is the custom team", rows["55Base"]["Team"] == "Trinity Squared")
    check("CSV: a shared card lists both teams", rows["10Connections"]["Team"] in ("Trinity Squared / Kansas City Current", "Kansas City Current / Trinity Squared"))
    pg.click("#fbtn")
    check("Team filter lists the custom team and not the emptied one",
          pg.query_selector('#filters [data-f="team"][data-v="Trinity Squared"]') is not None and pg.query_selector('#filters [data-f="team"][data-v="Washington Spirit"]') is None)
    pg.click('#filters [data-f="team"][data-v="Trinity Squared"]')
    check("filtering on the custom team shows only its group", group_names(pg) == ["Trinity Squared"])
    pg.click("#custbtn")
    pg.uncheck("#cton")
    pg.keyboard.press("Escape")
    check("turning custom teams off removes the dot", pg.is_hidden("#custbtn .cdot"))
    names = group_names(pg)
    check("turning custom teams off restores the doc's teams", "Washington Spirit" in names and "Trinity Squared" not in names)
    st = stored_teams(pg)
    check("turning off keeps the team saved", st["on"] is False and st["teams"][0]["name"] == "Trinity Squared")
    pg.close()

    # Both players of a shared card claimed: the card belongs only to the custom team.
    both = {"on": True, "teams": [{"id": "t1", "name": "Duo", "color": "#D6336C", "players": ["Esther Gonzalez", "Temwa Chawinga"]}]}
    pg = demo_page(browser, "checklist", by="team", custom=both)
    duo = pg.evaluate("() => window.__tintOf('#D6336C')")
    check("card with every player claimed is only on the custom team",
          13 in cards_in_group(pg, "Duo") and 13 not in cards_in_group(pg, "Gotham FC") and 13 not in cards_in_group(pg, "Kansas City Current"))
    check("that card's tile uses only the custom tint", row_style(pg, 13) == f"--blk:linear-gradient({duo}, {duo});")
    pg.close()

    # 1/1s tab follows too.
    pg = demo_page(browser, "ones", by="team", custom=team)
    check("1/1s tab groups by the custom team", "Trinity Squared" in group_names(pg) and "Washington Spirit" not in group_names(pg))
    pg.close()

    # Building a team in the panel.
    pg = demo_page(browser, "checklist", by="team", custom={"on": True, "teams": []})
    pg.click("#custbtn")
    check("Customize opens the drawer", pg.is_visible("#ctdrawer") and pg.is_visible("#ctscrim"))
    check("drawer sits at the right edge on desktop", pg.evaluate("() => { const r = document.querySelector('#ctdrawer').getBoundingClientRect(); return Math.round(r.right) === innerWidth && r.top === 0 && r.width <= 420; }"))
    check("Customize sits across from the set title", pg.evaluate("() => { const b = document.querySelector('#custbtn').getBoundingClientRect(), h = document.querySelector('#sethead').getBoundingClientRect(); return b.left > h.right && Math.abs(b.top - h.top) < 30; }"))
    pg.click("#ctnew")
    check("New team focuses its name", pg.evaluate("() => document.activeElement.matches('[data-ctname]')"))
    pg.fill("[data-ctname]", "Gotham FC")
    pg.press("[data-ctname]", "Enter")
    check("a real team's name is refused", pg.input_value("[data-ctname]") == "My team")
    pg.fill("[data-ctname]", "Rodmans")
    pg.press("[data-ctname]", "Enter")
    pg.fill("[data-ctadd]", "trinity rodman")
    pg.press("[data-ctadd]", "Enter")
    check("claiming a player adds her chip", pg.query_selector('[data-ctrm="Trinity Rodman"]') is not None)
    check("the new team appears in the list", "Rodmans" in group_names(pg))
    pg.fill("[data-ctadd]", "  Sam   Coffey ")
    pg.press("[data-ctadd]", "Enter")
    check("a name that isn't in this set is added as typed (spaces tidied)", stored_teams(pg)["teams"][0]["players"] == ["Trinity Rodman", "Sam Coffey"])
    check("it's shown dimmed and the notice says it isn't in this set",
          "away" in pg.get_attribute('[data-ctrm="Sam Coffey"]', "class") and "(not in this set)" in pg.inner_text("#toast"))
    check("it doesn't change the checklist", "Rodmans" in group_names(pg) and len(group_names(pg)) == 6)
    pg.fill("[data-ctadd]", "sam coffey")
    pg.press("[data-ctadd]", "Enter")
    check("the same name twice is caught (case and accents ignored)", "already on" in pg.inner_text("#toast"))
    pg.click('[data-ctrm="Sam Coffey"]')
    check("removing a chip drops the name", stored_teams(pg)["teams"][0]["players"] == ["Trinity Rodman"])
    pg.click("#ctnew")
    second = pg.query_selector_all(".ctteam")[1]
    second.query_selector("[data-ctadd]").fill("Trinity Rodman")
    second.query_selector("[data-ctadd]").press("Enter")
    st = stored_teams(pg)
    check("claiming a player for another custom team moves her", st["teams"][0]["players"] == [] and st["teams"][1]["players"] == ["Trinity Rodman"])
    check("the move is announced", "Moved Trinity Rodman" in pg.inner_text("#toast"))
    pg.click("#ctsharebtn")
    code = pg.input_value("#ctcode")
    check("share code is offered", code.startswith("CT1:"))
    pg.keyboard.press("Escape")
    check("Escape closes the drawer", pg.is_hidden("#ctdrawer"))
    pg.click("#custbtn")
    first = pg.query_selector_all(".ctteam")[0]
    first.query_selector("[data-ctdel]").click()
    check("Delete asks once more", pg.query_selector_all(".ctteam")[0].query_selector(".ctdel.confirm") is not None)
    pg.query_selector_all(".ctteam")[0].query_selector("[data-ctdel]").click()
    check("confirmed Delete removes the team", len(stored_teams(pg)["teams"]) == 1)
    pg.close()

    pg = demo_page(browser, "checklist", by="team", custom={"on": True, "teams": []})
    pg.click("#custbtn")
    pg.click("#ctsharebtn")
    pg.fill("#ctimport", code)
    pg.click("#ctdoimport")
    st = stored_teams(pg)
    check("importing a code brings its teams", [t["players"] for t in st["teams"]] == [[], ["Trinity Rodman"]] and "Washington Spirit" not in group_names(pg))
    pg.close()

    # Each team has its own switch; the feature switch sits above them.
    two = {"on": True, "teams": [{"id": "a", "name": "Rodmans", "color": "#7048E8", "players": ["Trinity Rodman"]},
                                 {"id": "b", "name": "Chawingas", "color": "#D6336C", "players": ["Temwa Chawinga"], "on": False}]}
    pg = demo_page(browser, "checklist", by="team", custom=two)
    names = group_names(pg)
    check("a team that's switched off doesn't claim its players", "Chawingas" not in names and "Rodmans" in names and 4 in cards_in_group(pg, "Kansas City Current"))
    pg.click("#custbtn")
    check("panel says Share/import", pg.inner_text("#ctsharebtn") == "Share/import")
    check("the explanation keeps the first two sentences", pg.inner_text(".cthint") == "Claim players for a team of your own. Their cards move to your team in every view and download.")
    pg.query_selector_all(".ctteam")[1].query_selector("[data-cton]").click()
    pg.keyboard.press("Escape")
    check("switching a team on applies it", "Chawingas" in group_names(pg) and 4 in cards_in_group(pg, "Chawingas"))
    pg.click("#custbtn")
    pg.query_selector_all(".ctteam")[0].query_selector("[data-cton]").click()
    names = group_names(pg)
    check("switching a team off returns its players to their teams", "Rodmans" not in names and "Washington Spirit" in names)
    check("each team's switch is saved", [t["on"] for t in stored_teams(pg)["teams"]] == [False, True])
    pg.uncheck("#cton")
    check("the feature switch turns every team off", not any(n in group_names(pg) for n in ("Rodmans", "Chawingas")))
    pg.check("#cton")
    check("turning the feature back on restores each team's own setting", "Chawingas" in group_names(pg) and "Rodmans" not in group_names(pg))
    pg.click("#ctsharebtn")
    code = pg.input_value("#ctcode")
    pg.close()
    pg = demo_page(browser, "checklist", by="team", custom={"on": True, "teams": []})
    pg.click("#custbtn"); pg.click("#ctsharebtn"); pg.fill("#ctimport", code); pg.click("#ctdoimport")
    check("share codes keep each team's switch", [t["on"] for t in stored_teams(pg)["teams"]] == [False, True])
    pg.close()

    # A name typed in another set (lower case, no accents) claims the player here.
    pg = demo_page(browser, "checklist", by="team", custom={"on": True, "teams": [{"id": "p", "name": "Personal Collection", "color": "#0C8599", "players": ["esther gonzalez", "Sam Coffey"]}]})
    check("a typed name claims the matching player in this set", 2 in cards_in_group(pg, "Personal Collection"))
    pg.close()

    # A team from another set: players missing here are kept but dimmed.
    away = {"on": True, "teams": [{"id": "t1", "name": "Mixed", "color": "#1C7ED6", "players": ["Trinity Rodman", "Alex Morgan"]}]}
    pg = demo_page(browser, "checklist", by="team", custom=away, w=390)
    pg.click("#custbtn")
    check("drawer is a bottom sheet on a phone", pg.evaluate("() => { const r = document.querySelector('#ctdrawer').getBoundingClientRect(); return r.left === 0 && Math.round(r.bottom) === innerHeight && r.top > 0; }"))
    check("a team with players starts closed, showing its count", "1 of 2 players in this set" in pg.inner_text(".ctteam") and pg.query_selector("[data-ctadd]") is None)
    pg.click(".ctopen")
    check("a player not in this set is kept and dimmed", "away" in pg.get_attribute('[data-ctrm="Alex Morgan"]', "class"))
    check("the open team still says how many of its players are here", "1 of 2 players in this set" in pg.inner_text(".ctteam"))
    pg.click("#ctclose")
    check("Done closes the sheet and returns focus to Customize", pg.is_hidden("#ctdrawer") and pg.evaluate("() => document.activeElement.id") == "custbtn")
    pg.screenshot(path=str(TMP / "my_teams_390.png"), full_page=True)
    pg.close()


def stats_panel(pg, key):
    """Flips a group (by its key, e.g. 'tGotham FC') to its stats, waits out the animation, and returns the panel's text."""
    pg.wait_for_function("() => !document.querySelector('.flip-out, .flip-in')")
    if pg.get_attribute(f'.gstats[data-gstats="{key}"]', "aria-pressed") != "true":
        pg.click(f'.gstats[data-gstats="{key}"]')
    pg.wait_for_selector(f'.group.flipped[data-group="{key}"] .ss-panel')
    pg.wait_for_function("() => !document.querySelector('.flip-out, .flip-in')")
    return pg.inner_text(f'.group.flipped[data-group="{key}"] .ss-panel')


def flip_back(pg, how):
    if how == "button":
        pg.click(".group.flipped .gstats")
    elif how == "back":
        pg.click(".group.flipped .ss-foot [data-gstats]")
    elif how == "escape":
        pg.keyboard.press("Escape")
    elif how == "dimmed":
        pg.mouse.click(30, pg.evaluate("() => { const g = document.querySelector('#list .group:not(.flipped)'); const r = g.getBoundingClientRect(); return r.top + r.height / 2; }"))
    pg.wait_for_function("() => !document.querySelector('.group.flipped') && !document.querySelector('.flip-out, .flip-in')")


def metric(pg, key, m):
    """One row of a flipped group's stats panel (m: autos, hits, live, cards) as a dict of its texts and bar fill."""
    return pg.evaluate("""([key, m]) => {
      const r = document.querySelector(`.group.flipped[data-group="${CSS.escape(key)}"] .ss-row[data-metric="${m}"]`);
      if (!r) return null;
      const t = (s) => { const e = r.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
      const i = r.querySelector('.ss-meter i'), tick = r.querySelector('.ss-even');
      return { big: t('.ss-big'), rank: t('.ss-rank'), share: t('.ss-share b'), x: t('.ss-x'), count: t('.ss-count'),
               fill: i ? Math.round(parseFloat(i.style.width)) : null,
               tick: tick ? Math.round(100 * (tick.getBoundingClientRect().left + 1 - r.querySelector('.ss-meter').getBoundingClientRect().left) / r.querySelector('.ss-meter').getBoundingClientRect().width) : null };
    }""", [key, m])


def test_stats(browser):
    pg = demo_page(browser, "checklist", by="subset")
    check("grouped by subset: no stats buttons", pg.query_selector(".gstats") is None)
    pg.close()

    d = copy.deepcopy(DEMO)
    d["Products"].update({"Autos_Per_Box": [2], "Boxes_Per_Case": [10], "Numbered_Per_Box": [None]})
    pg = demo_page(browser, "checklist", by="team", demo=d)
    heads = pg.query_selector_all("#list .ghwrap")
    check("grouped by team: every team header has a stats button at its right end",
          len(heads) == len(group_names(pg)) and all(h.evaluate("w => w.lastElementChild.classList.contains('gstats')") for h in heads))
    key = "tKansas City Current"
    pg.click(f'.gstats[data-gstats="{key}"]')
    check("the card flips: it turns away first", pg.query_selector(f'.group[data-group="{key}"].flip-out') is not None)
    text = stats_panel(pg, key)
    sec = f'.group[data-group="{key}"]'
    check("flipped: the stats replace the group's cards", pg.query_selector(f"{sec} button[data-card]") is None and pg.get_attribute(f"{sec} .gstats", "aria-pressed") == "true")
    check("flipping opens the group underneath", pg.get_attribute(f'[data-gkey="{key}"]', "aria-expanded") == "true")
    check("the flipped group can't be collapsed", pg.is_disabled(f'[data-gkey="{key}"]'))
    check("the rest of the list is dimmed and can't be used",
          pg.evaluate("() => [...document.querySelectorAll('#list .group:not(.flipped)')].every((g) => g.inert && +getComputedStyle(g).opacity < .5)"))
    rows = pg.evaluate(f"() => [...document.querySelectorAll('.group.flipped .ss-row')].map((r) => r.dataset.metric)")
    check("four rows, the top-line numbers only", rows == ["autos", "hits", "live", "cards"])
    check("no per-box estimates or other tiers", "Per box" not in text and "Numbered" not in text)
    au = metric(pg, key, "autos")
    check("Autos: number and rank on the left", au["big"] == "1" and au["rank"] == "#1 of 6 teams")
    check("Autos: share on the right (shared cards count half)", au["share"] == "33.3% of the set's autos" and au["x"] == "2.0× even" and au["count"] == "1 of 3 auto cards")
    check("the even-share tick sits in the middle and the bar is full at twice an even share", au["tick"] == 50 and au["fill"] == 100)
    ca = metric(pg, key, "cards")
    check("Cards: shared cards count in full on the left, half in the share", ca["big"] == "4" and ca["share"] == "26.9% of the checklist" and ca["fill"] == 81)
    li = metric(pg, key, "live")
    check("1/1s live: no pulls reported means no pulled line, just the rank", li["rank"] == "#1 of 6 teams")
    check("the label keeps “1/1s” in lower case", pg.evaluate("() => document.querySelector('.group.flipped [data-metric=live] .ss-lab').innerText.startsWith('1/1s')"))
    check("1/1s live: live of total on the left, share of the live 1/1s on the right", li["big"] == "4 of 4" and li["share"] == "31.8% of the live 1/1s" and li["count"] == "4 of 11 still out there")
    hi = metric(pg, key, "hits")
    check("a number the set doesn't have says so, without a bar or a rank", hi["big"] == "0" and hi["count"] == "No case hits in this set" and hi["fill"] is None and hi["rank"] == "")
    check("the legend names the even share", "tick = an even share (1 of 6 teams)" in text)
    check("the footer says what the numbers cover, beside Back to cards", "Whole set, every product." in text and pg.query_selector(f"{sec} .ss-foot [data-gstats]") is not None)
    pg.click("#fbtn")
    pg.click('#filters [data-f="type"][data-v="Autograph"]')
    check("changing a filter keeps the group flipped", pg.query_selector(f'.group.flipped[data-group="{key}"] .ss-panel') is not None)
    pg.click('#filters [data-f="type"][data-v="Autograph"]')
    pg.click("#fbtn")
    flip_back(pg, "back")
    check("Back to cards flips it back, open, with its cards", pg.query_selector(f"{sec} button[data-card]") is not None and not pg.evaluate("() => document.querySelector('#list').classList.contains('focus')"))
    check("…and the list is usable again", pg.evaluate("() => ![...document.querySelectorAll('#list .group')].some((g) => g.inert)"))
    for how in ("button", "escape", "dimmed"):
        stats_panel(pg, key)
        flip_back(pg, how)
        check(f"flips back with {'the chart button' if how == 'button' else 'Escape' if how == 'escape' else 'a click on the dimmed list'}", pg.query_selector(".group.flipped") is None)
    stats_panel(pg, key)
    pg.click('.tab[data-tab="ones"]')
    check("switching tabs drops the flip", pg.query_selector(".group.flipped") is None and not pg.evaluate("() => document.querySelector('#list').classList.contains('focus')"))
    check("the 1/1s tab has no stats buttons", pg.query_selector(".gstats") is None and pg.query_selector(".ghwrap") is None)
    pg.close()

    pg = demo_page(browser, "checklist", by="player")
    pg.emulate_media(reduced_motion="reduce")
    pg.click('.gstats[data-gstats="pTemwa Chawinga"]')
    check("with reduced motion the card changes without the flip", pg.query_selector(".flip-out, .flip-in") is None and pg.query_selector(".group.flipped") is not None)
    tc = metric(pg, "pTemwa Chawinga", "autos")
    check("grouped by player: ranks and even share are among players", tc["rank"].endswith("of 9 players") and "1 of 9 players" in pg.inner_text(".group.flipped .ss-head"))
    pg.close()

    team = {"on": True, "teams": [{"id": "t1", "name": "Trinity Squared", "color": "#7048E8", "players": ["Trinity Rodman", "Temwa Chawinga"]}]}
    pg = demo_page(browser, "checklist", by="team", custom=team)
    stats_panel(pg, "tTrinity Squared")
    ts = metric(pg, "tTrinity Squared", "autos")
    check("a custom team gets stats from its claimed cards", ts["big"] == "2" and ts["rank"] == "#1 of 6 teams" and ts["share"] == "66.7% of the set's autos")
    pg.click("#custbtn"); pg.uncheck("#cton"); pg.keyboard.press("Escape")
    check("turning the custom team off drops its flip", pg.query_selector(".group.flipped") is None and pg.query_selector('[data-gstats="tTrinity Squared"]') is None)
    stats_panel(pg, "tWashington Spirit")
    check("…and the real team's stats are back", metric(pg, "tWashington Spirit", "autos")["big"] == "1")
    pg.close()

    pg = demo_page(browser, "checklist", by="team", w=390)
    check("stats buttons fit on a phone", pg.evaluate("() => [...document.querySelectorAll('.ghwrap')].every((w) => w.getBoundingClientRect().right <= innerWidth)"))
    stats_panel(pg, "tGotham FC")
    check("on a phone each row keeps the number left and the share right",
          pg.evaluate("() => getComputedStyle(document.querySelector('.ss-row')).gridTemplateColumns.split(' ').length") == 2 and
          pg.evaluate("() => document.querySelector('.ss-panel').getBoundingClientRect().right <= innerWidth"))
    pg.screenshot(path=str(TMP / "stats_390.png"), full_page=True)
    pg.close()


def open_sections(pg):
    return [b.get_attribute("data-sec") for b in pg.query_selector_all(".menu .msec, .sheet .msec") if b.get_attribute("aria-expanded") == "true"]


def visible_sets(pg):
    return [a.inner_text().split("\n")[0] for a in pg.query_selector_all(".menu .mi.si, .sheet .mi.si") if a.is_visible()]


def test_set_switcher(browser):
    all_sets = [x for y in SETS["years"] for x in y["sets"]]
    featured = [x["name"] for x in sorted((x for x in all_sets if x.get("featured")), key=lambda x: -x.get("order", float("-inf")))][:3]
    pg = demo_page(browser, h=640)
    check("listed doc: set name as the title, with subtitle",
          pg.inner_text("#setbtn").strip() == "Prizm Black" and pg.inner_text(".setsub") == "2026 Panini · NWSL")
    pg.click("#setbtn")
    secs = [b.get_attribute("data-sec") for b in pg.query_selector_all(".menu .msec")]
    check(f"sections are Featured then each year {secs}", secs == ["featured"] + [f"y:{y['year']}" for y in SETS["years"]])
    check("Featured starts open, years closed", open_sections(pg) == ["featured"] and visible_sets(pg) == featured)
    check("current set is focused when the menu opens", pg.evaluate("() => document.activeElement.getAttribute('aria-current')") == "page")
    pg.click('.menu .msec[data-sec="y:2026"]')
    check("opening a year closes Featured", open_sections(pg) == ["y:2026"] and visible_sets(pg) == [x["name"] for x in SETS["years"][0]["sets"]])
    check("the menu stays open while switching sections", pg.query_selector(".menu"))
    pg.click('.menu .msec[data-sec="y:2026"]')
    check("clicking the open section closes it", open_sections(pg) == [] and visible_sets(pg) == [])
    pg.click('.menu .msec[data-sec="featured"]')
    check("reopening Featured", open_sections(pg) == ["featured"])
    check("current set marked in each section it appears in", len(pg.query_selector_all('.menu [aria-current="page"]')) == 2)
    links = pg.eval_on_selector_all(".menu a.mi", "els => els.map(a => [a.getAttribute('href'), a.target])")
    check("set links open in the same tab with style=singlePage", links and all(l[1] == "_top" and "style=singlePage" in l[0] for l in links))
    # Arrow keys only visit what's showing: 3 featured sets, then the section buttons.
    order = []
    for _ in range(6):
        pg.keyboard.press("ArrowDown")
        order.append(pg.evaluate("() => document.activeElement.dataset.sec || document.activeElement.innerText.split('\\n')[0]"))
    check(f"arrow keys skip sets in closed sections {order}", "y:2026" in order and order.count("featured") == 1 and len(set(order)) == 5)
    pg.keyboard.press("Escape")
    check("Escape closes the set menu", not pg.query_selector(".menu"))
    pg.close()

    soon = {"years": [{"year": "2026", "sets": [all_sets[0], {"name": "Coming Soon...", "sub": "2026 Parkside - CONCACAF", "featured": True}]}]}
    pg = demo_page(browser, sets=soon)
    pg.click("#setbtn")
    item = pg.query_selector('#msec-0 .mi.si:has-text("Coming Soon...")')
    check("an entry without a url is listed, dimmed and not a link",
          item and item.get_attribute("aria-disabled") == "true" and item.evaluate("n => n.tagName") == "DIV" and not item.query_selector("a"))
    url = pg.url
    item.click(force=True)  # Playwright waits for aria-disabled items to become enabled; a real click still lands
    check("clicking an entry without a url does nothing", pg.query_selector(".menu") and pg.url == url)
    pg.close()

    pg = demo_page(browser, w=390, h=760)
    pg.click("#setbtn")
    check("[phone] set menu opens as a bottom sheet with Featured open", pg.query_selector(".sheet.setmenu") and open_sections(pg) == ["featured"])
    pg.click('.sheet .msec[data-sec="y:2026"]')
    check("[phone] tapping a year switches sections", open_sections(pg) == ["y:2026"])
    pg.close()

    many = {"years": [{"year": "2026", "sets": [dict(x, featured=True) for x in all_sets] + [dict(all_sets[0], name="Extra", doc="x", featured=True)]}]}
    pg = demo_page(browser, sets=many)
    pg.click("#setbtn")
    check("Featured shows at most three", len(pg.query_selector_all("#msec-0 .mi.si")) == 3)
    pg.close()
    # Order comes from the `order` numbers, not file position; sets without one go last.
    # Years list lowest first; Featured lists highest first and keeps the three highest.
    base = {k: v for k, v in all_sets[0].items() if k not in ("order", "featured")}
    shuffled = {"years": [{"year": "2026", "sets": [
        dict(base, name="C", doc="c", order=30, featured=True), dict(base, name="Unnumbered", doc="u", featured=True),
        dict(base, name="A", doc="a", order=10, featured=True), dict(base, name="D", doc="d", order=40, featured=True),
        dict(base, name="B", doc="b", order=20)]}]}
    pg = demo_page(browser, sets=shuffled)
    pg.click("#setbtn")
    check("Featured lists the three highest-numbered featured sets, highest first", visible_sets(pg) == ["D", "C", "A"])
    pg.click('.menu .msec[data-sec="y:2026"]')
    check("a year lists its sets by order, unnumbered last", visible_sets(pg) == ["A", "B", "C", "D", "Unnumbered"])
    pg.close()
    none = {"years": [{"year": "2026", "sets": [{k: v for k, v in x.items() if k != "featured"} for x in all_sets]}, {"year": "2025", "sets": [dict(all_sets[0], name="Old set", doc="old", featured=False)]}]}
    pg = demo_page(browser, sets=none)
    pg.click("#setbtn")
    check("no featured sets: no Featured section, all years closed",
          [b.get_attribute("data-sec") for b in pg.query_selector_all(".menu .msec")] == ["y:2026", "y:2025"] and open_sections(pg) == [])
    pg.close()

    pg = demo_page(browser, doc="9Abbfx43q1qkGw3t1Qm9BL", name="Checklist Sandbox")
    check("unlisted doc: its own name as the title, nothing marked",
          pg.inner_text("#setbtn").strip() == "Checklist Sandbox" and (pg.click("#setbtn") or not pg.query_selector(".menu [aria-current]")))
    pg.close()
    pg = demo_page(browser, sets=None)
    check("no sets.json: plain title, no menu", pg.query_selector("h1.setbtn") and not pg.query_selector("#setbtn"))
    pg.close()


def test_in_grist_frame(browser):
    """Inside an iframe with a stand-in Grist API: the doc's title must come from the REST API, never the doc ID."""
    site = TMP / "site"
    (site / "widgets/w").mkdir(parents=True, exist_ok=True)
    (site / "sets.json").write_text(json.dumps(SETS))
    if (WIDGET.parent / "lib").is_dir():
        shutil.copytree(WIDGET.parent / "lib", site / "widgets/w/lib", dirs_exist_ok=True)
    for api_ok, doc, want in ((True, "9Abbfx43q1qkGw3t1Qm9BL", "Checklist Sandbox"),
                              (False, "9Abbfx43q1qkGw3t1Qm9BL", "Checklists"),
                              (False, "pCMKPajFwTiuzyVLySNiMT", "Prizm Black")):
        stub = f"""<script>
        const DATA = {json.dumps(DEMO)}, DOC = {json.dumps(doc)}, API_OK = {json.dumps(api_ok)};
        window.grist = {{ ready() {{}}, onRecords() {{}}, docApi: {{
          fetchTable: async (t) => {{ if (!DATA[t]) throw new Error('no table ' + t); return DATA[t]; }},
          getAccessToken: async () => ({{ token: 'tok', baseUrl: 'https://docs.example.com/api/docs/' + DOC }}),
          getDocName: async () => DOC, applyUserActions: async () => {{}} }} }};
        const realFetch = window.fetch;
        window.fetch = (u, o) => String(u).startsWith('https://docs.example.com/api/docs/')
          ? Promise.resolve(API_OK ? new Response(JSON.stringify({{ name: 'Checklist Sandbox' }})) : new Response('denied', {{ status: 403 }}))
          : realFetch(u, o);
        </script>"""
        (site / "widgets/w/index.html").write_text(WIDGET.read_text().replace(PLUGIN_TAG, stub))
        (site / "host.html").write_text('<iframe src="widgets/w/index.html" style="width:760px;height:500px;border:0"></iframe>')
        pg = browser.new_page()
        pg.set_default_timeout(5000)
        pg.on("pageerror", lambda e: page_errors.append(str(e)))
        pg.goto((site / "host.html").as_uri())
        pg.wait_for_timeout(700)
        frame = pg.frames[1]
        head = frame.query_selector("#sethead:not([hidden])")
        title = head.inner_text().split("\n")[0].strip() if head else None
        check(f"in Grist (API {'ok' if api_ok else 'refused'}, doc {doc[:6]}…): title {title!r}", title == want)
        if api_ok:
            check("in Grist: the shared stats file loads from beside the widget", frame.evaluate("() => !!window.SetStats"))
        pg.close()


def test_sticky_and_back_to_top(browser, w):
    """The search box and filter chips stay in view while the tabs and the rest scroll away; Back to top returns."""
    pg = demo_page(browser, tab="checklist", by="subset", w=w, h=420)
    pg.click("#allgroups")  # Expand all, so the page is long enough to scroll
    pg.wait_for_timeout(100)
    check(f"{w}px: page is taller than the screen once expanded", pg.evaluate("document.documentElement.scrollHeight > innerHeight * 2"))
    check(f"{w}px: footer with Back to top shows", pg.is_visible("#foot #totop"))
    check(f"{w}px: floating button hidden at the top", not pg.evaluate("document.querySelector('#fab').classList.contains('show')"))
    pg.evaluate("window.scrollTo(0, 600)")
    pg.wait_for_timeout(250)
    tops = pg.evaluate("""() => Object.fromEntries(['#toolbar', '#q', '#activebar', '.tabbar', '.summary'].map((s) =>
      [s, document.querySelector(s).getBoundingClientRect().top]))""")
    check(f"{w}px: toolbar pinned to the top after scrolling", abs(tops["#toolbar"]) < 1)
    check(f"{w}px: search box and filter chips in view", 0 <= tops["#q"] < 60 and 0 <= tops["#activebar"] < 110)
    check(f"{w}px: tabs and summary scrolled away", tops[".tabbar"] < -40 and tops[".summary"] < 0)
    check(f"{w}px: toolbar shows its stuck shadow", pg.evaluate("document.querySelector('#toolbar').classList.contains('stuck')"))
    check(f"{w}px: floating Back to top shows after scrolling", pg.evaluate("document.querySelector('#fab').classList.contains('show')"))
    y_before = pg.evaluate("window.scrollY")
    pg.click("#fbtn")
    box = pg.evaluate("(() => { const r = document.querySelector('#filters').getBoundingClientRect(); return [r.top, r.bottom]; })()")
    check(f"{w}px: filters panel opens in view while scrolled", 0 < box[0] < 160 and box[1] <= 420)
    pg.click("#fbtn")
    pg.wait_for_timeout(100)
    check(f"{w}px: closing the filters panel leaves the list where it was", abs(pg.evaluate("window.scrollY") - y_before) < 2)
    pg.click("#fab")
    pg.wait_for_function("window.scrollY === 0", timeout=3000)
    check(f"{w}px: floating button scrolls back to the top", pg.evaluate("window.scrollY") == 0)
    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    pg.wait_for_timeout(250)
    check(f"{w}px: floating button hides when the footer is in view", not pg.evaluate("document.querySelector('#fab').classList.contains('show')"))
    pg.focus("#totop")
    pg.keyboard.press("Enter")
    pg.wait_for_function("window.scrollY === 0", timeout=3000)
    check(f"{w}px: footer button by keyboard returns to the top and focuses the tab",
          pg.evaluate("document.activeElement.matches('.tab[aria-selected=\"true\"]')"))
    pg.click("#allgroups")  # Collapse all: the short page has no footer
    pg.wait_for_timeout(100)
    short = pg.evaluate("document.documentElement.scrollHeight <= innerHeight + 4")
    check(f"{w}px: footer hidden when the page fits on screen", (not short) or pg.is_hidden("#foot"))
    pg.close()


def main():
    print(f"Testing {WIDGET.relative_to(ROOT)}")
    with sync_playwright() as pw:
        chrome = os.environ.get("CHROME_PATH")
        browser = pw.chromium.launch(executable_path=chrome or None, args=["--allow-file-access-from-files"])
        # A step that can't find what it needs fails its whole group instead of stopping the run.
        groups = [(f"checklist and 1/1s at {w}px", test_checklist_and_ones, (w,)) for w in (760, 390)] + [
            ("doc without Off_Market", test_without_off_market, ()),
            ("team shading and multi-team cards", test_teams, ()),
            ("custom teams", test_custom_teams, ()),
            ("team and player stats", test_stats, ()),
            ("dashboard", test_dashboard, ()),
            ("set switcher", test_set_switcher, ())] + [
            (f"sticky toolbar and back to top at {w}px", test_sticky_and_back_to_top, (w,)) for w in (760, 390)] + [
            ("inside a Grist frame", test_in_grist_frame, ())]
        for label, fn, args in groups:
            try:
                fn(browser, *args)
            except Exception as e:
                check(f"{label}: stopped early ({type(e).__name__}: {str(e).splitlines()[0]})", False)
        browser.close()
    for e in page_errors:
        print("PAGE ERROR " + e)
    print(f"{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) and not page_errors else 1)


if __name__ == "__main__":
    main()
