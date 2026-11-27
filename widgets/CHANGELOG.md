# Changelog

All changes to the checklist widget, newest first. **Unreleased** describes what's in `widgets/dev/` and not yet in a numbered version.

## Unreleased

### Added
- **Dashboard** (`dashboard.html`, beside the checklist): the set's teams, ranked. Tabs **Default** and **Break** (Break is shown but not available yet). A search box and a **Rank by** pill (Autos, Case hits, 1/1s live, Cards); no filters. Each team card is tinted with its color and shows its rank, its name, the other three numbers, and the ranked number with its share of the set (bar with an even-share tick in the middle).
- Clicking a team opens its players, ranked the same way, each showing her rank across the whole set and her own share bar. Players sit under their team (or their custom team).
- Chart buttons on teams and players flip the whole team card to the stats card (the same one as the checklist): the team's stats, or that player's, with her name on top. The rest of the list dims until it flips back (chart button, **Back to the list**, Escape or a click on the dimmed list). Read-only.
- Search: typing a team's name shows that team; typing a player's name shows her team, open, with only the matching players. Matching players are offered in a dropdown to pin as chips: pinned players show only their teams, open, with only them, so several players can be compared. **Clear all** removes the chips.
- The dashboard has the same **Customize** button and drawer as the checklist, so My teams can be edited from either page; both read the same saved teams, so a change in one shows in the other.

### Changed
- Fewer explanatory lines: the stats card drops its legend ("tick = an even share…") and its footer note ("Whole set, every product. Cards shared… count half in shares."); the footer now says "<Product> only" when one product is chosen in Filters, and is otherwise just the back button. The 1/1s count reads "4 of 11 live" (was "still out there"). The My teams section drops its explanation line.
- My teams (custom teams and the Customize drawer) moved into a shared file, `lib/teams.js`, used by the checklist and the dashboard. No change in how it works.

### Added
- **Stats** (Checklist tab): a chart button at the right end of every team and player group header (grouped by Team or Player) flips that group's card over to show its stats where its cards were, opening the group if it was closed. Four rows, one per top-line number: **Autos**, **Case hits**, **1/1s live** and **Cards**. Each shows the number and its rank on the left, and its share of the set on the right: a percentage, a bar whose middle tick is an even share (1 of the teams or players; full at twice that), how many times an even share it is, and the count behind it. A number the set doesn't have (e.g. no case hits) says so, with no bar or rank.
- While a card is flipped, the rest of the list is dimmed and can't be used, and the flipped group can't be collapsed. Filters still work and the numbers follow the Product filter (one product chosen → that product only; other filters don't change them). The chart button, **Back to cards**, Escape or a click on the dimmed list flips it back, showing the group's cards. One group at a time; switching tabs or grouping drops the flip. With reduced motion the card changes without the flip.
- Custom teams get stats like any team.
- The stats come from a shared file, `lib/stats.js`, beside the widget, so the dashboard can show the same component when it moves into the repo. It's copied into each release folder with `index.html`.

### Added
- **Customize**: a button in the top-right corner, across from the set title, opens a side drawer (a bottom sheet with **Done** on phones). Escape, the close button or a tap outside closes it, and focus returns to the button.
- **My teams**, the drawer's first section: visitors can make their own teams and claim players for them. A switch turns the whole feature off without deleting anything. Each team is a card with its own switch, color and name, and the player and card counts; it opens to edit the name and color, claim players from the set by name, remove them, or delete the team. Cards start closed, except a team with no players yet.
- Custom teams **override** the doc: a claimed player's cards leave her real team for the custom one in every view (grouping, Team filter, team shading, search, the 1/1s tab) and in CSV downloads. On a shared card, each player brings her own team: with one player claimed, the card lists the custom team and the other player's team (shown under both, blended tile, half credit); with every player claimed, it belongs only to the custom team. A real team that loses all its players drops out of the list. Custom teams are listed first.
- Any name can be added to a team, not only players in the current set, so one team (e.g. "Personal Collection") can be built from a single checklist. A name that matches a player here takes this set's spelling; any other is kept as typed (shown dimmed, with a notice) and claims that player in whichever set lists her under that name (case and accents ignored).
- A player is on one custom team at most; claiming her for another moves her (with a notice). A custom team can't take a real team's name.
- Custom teams are saved in the browser only (`localStorage`, key `cl:customTeams`), never in the doc. Every set's widget shares them, so a team made in one checklist appears in the others with whichever of its players are in that set (the rest are shown dimmed). Other widgets on the same site pick up changes through the `storage` event.
- **Share/import**: the teams as a `CT1:` code to copy, and a box to paste a code. Imported teams replace custom teams of the same name.
- While custom teams change the view, the **Customize** button turns dark with a green dot.
- Each custom team has its own on/off switch, beside the switch for the whole feature. A team that's off keeps its players but doesn't claim them; turning the feature back on restores each team's own setting. Share codes keep each team's switch.
- The custom team's tint uses the same calculation as the Teams table's `Tint` formula (checked against the 16 NWSL club tints).

### Requires
- Nothing. No document changes.

## v6 — 2026-11-25

### Changed
- The search box, the **Filters** button with its chips, and the filters panel stay pinned to the top while scrolling; the set title, tabs, count/Group by row and the list scroll away. The pinned bar gets a light shadow once it sticks, and an open filters panel scrolls on its own if it's taller than the screen. (The tabs were the pinned part before.)
- Rows reached by keyboard or "Show in the 1/1s tab" stop below the pinned bar instead of behind it.

### Added
- **Back to top**: a footer button at the end of the list (shown when the page is longer than the screen), and a floating button in the bottom-right corner after about a screen of scrolling, which hides once the footer is in view. Used from the keyboard, it also moves focus to the selected tab.

### Requires
- Nothing. No document changes.

## v5 — 2026-11-25

### Changed
- The set menu lists sets by their `order` number in `sets.json`: lowest first in each year, highest first in Featured. If more than three sets are featured, Featured shows the three with the highest numbers. Sets without a number go last.

### Requires
- `order` numbers in `sets.json` (already there). No document changes.

## v4 — 2026-11-25

### Added
- Set switcher: the set's name (e.g. **Prizm Black**, "2026 Panini · NWSL") is the page title, and clicking it lists the other checklists. A set opens in the same tab on its Checklist page, with Grist's panels hidden. On phones the list opens as a bottom sheet. The menu has a **Featured** section (up to three sets marked `featured`) that opens first, and a section for each year that opens on click; only one section is open at a time. A set listed without a link (e.g. "Coming Soon...") shows dimmed and can't be opened. The list comes from `sets.json` at the site root, grouped by year; a doc that isn't listed shows its own name as the title (read from Grist's API), or **Checklists** if the name can't be read.

### Requires
- `sets.json` on the site (in the repo root). Without it the title is just the doc's name and there's no menu. No document changes.

## v3 — 2026-11-25

### Changed
- Design cleanup: one set of drawn icons (chevrons, close, check, download, filters) replaces text glyphs; tags use 6px corners and controls are pills; card numbers are lighter with aligned digits; print runs are emphasized in parallel chips ("Prizms Blue **/149**"); **Download CSV** is a pill with an icon; **Clear all** sits beside the filter chips.
- 1/1 slots use the same row layout as the Checklist: team tile with the card number, the card name with "Parallel · team" (or subset) beneath, and a status pill on the right where the parallel count sits. Grouped by player, slots lead with the subset like card rows.
- Each 1/1 has one of three statuses: **Live**, **Pulled** or **Off market** (pulled, and the owner says it isn't for sale). Clicking the pill opens a menu of the three; on phones it opens a bottom sheet, and tapping a choice applies it. This replaces the separate Pulled and Off market toggles. Live removes the logged pull, Pulled logs one, and Off market logs one with `Off_Market` set (or flips it on a pull already logged).
- Pills read **Live**, **✓ Pulled** or **🔒 Pulled** (off market, in a deeper green). The 1/1 chips in an expanded Checklist row use the same three looks.
- The Status filter has **Off market** alongside Live and Pulled; any mix can be chosen. Docs without `Pulls.Off_Market` show only Live and Pulled.
- The card row chevron moves from the tile to just after the card name. On both tabs the card number is centered across its tile and vertically on the card's line.
- The parallel count and 1/1 status pills are a little larger.
- Cards with several teams (e.g. "Gotham FC / Kansas City Current") appear under each team when grouped by team, and match either team in the Team filter, instead of forming a combined team.
- With a team filter (grouped by team) or pinned players (grouped by player), only the chosen teams' or players' groups are shown, even when a shared card also belongs to another.
- Team shading from an optional Teams table (`Team`, `Color`, calculated `Tint`): each card row (and 1/1 slot) tints the rounded tile behind its card number with its team's color, leaving the rest of the row neutral; group headers are fully tinted when grouped by team. Cards with several teams blend from the first team to the last.
- Filters moved into a panel behind a **Filters** button, with every option visible once it's open. Active filters and pinned players show as removable chips next to the button.
- Player suggestions appear in a dropdown under the search box (arrow keys and Enter work) instead of a row of pills. Typing still filters the list.
- Groups start closed and open or close only when clicked or with Expand all. Filter changes no longer open or close them.
- Card rows show a chevron after the card name. The pill on the right shows the number of parallels with a rainbow stacked-cards icon; the subset (or team, when grouped by subset) and any custom print runs move under the player name. Click a row to list every parallel.
- When grouped by player, card rows lead with the subset and show the card name underneath.
- In an expanded card row, each 1/1 shows whether it's live (dark with a rainbow ring), pulled (green with ✓) or off market (deep green with a lock). Clicking it opens the 1/1s tab narrowed to that card, highlights the slot and focuses its status pill.

### Requires
- Optional `Teams` table (`Team`, `Color`, calculated `Tint`, `Tint_Override`) for team shading. Without it rows aren't shaded.
- `Pulls.Off_Market` for the **Off market** status. Without it the menu and Status filter offer only Live and Pulled.

## v2 — 2026-11-25

### Changed
- Pulled 1/1s show an **Off market** toggle in place of the free-text Forever Home box. The widget no longer reads or writes `Pulls.Forever_Home`.
- The 1/1 CSV export has **Off Market** and **Reported** columns in place of Forever Home.

### Requires
- `Pulls.Off_Market` (Bool) for the toggle. Without it the toggle is hidden.
- `Pulls.Reported_At` (DateTime) for the Reported column. Without it the column is left out.

## v1 — 2026-11-25

First numbered release, identical to the widget previously served from `widgets/default/`.

- Checklist view grouped by subset, team or player, with search, filter pills and a CSV export.
- 1/1 view with a progress bar per group, pull toggles and a free-text Forever Home box.
