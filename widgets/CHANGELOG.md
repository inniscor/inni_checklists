# Changelog

All changes to the checklist widget, newest first. **Unreleased** describes what's in `widgets/dev/` and not yet in a numbered version.

## Unreleased

Nothing yet.

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
