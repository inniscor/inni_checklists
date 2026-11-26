# Changelog

All changes to the checklist widget, newest first. **Unreleased** describes what's in `widgets/dev/` and not yet in a numbered version.

## Unreleased

### Changed
- Design cleanup: one set of drawn icons (chevrons, close, check, download, filters) replaces text glyphs; tags use 6px corners and controls are pills; card numbers are lighter with aligned digits; print runs are emphasized in parallel chips ("Prizms Blue **/149**"); **Download CSV** is a pill with an icon; **Clear all** sits beside the filter chips.
- 1/1 stamps are slimmer, say **Live** (matching the Status filter) or **✓ Pulled**, and the Off market control uses a filled or empty circle instead of a checkbox.
- Cards with several teams (e.g. "Gotham FC / Kansas City Current") appear under each team when grouped by team, and match either team in the Team filter, instead of forming a combined team.
- With a team filter (grouped by team) or pinned players (grouped by player), only the chosen teams' or players' groups are shown, even when a shared card also belongs to another.
- Team shading from an optional Teams table (`Team`, `Color`, calculated `Tint`): each card row (and 1/1 slot) tints a rounded tile beside the name with its team's color, leaving the rest of the row neutral; group headers are fully tinted when grouped by team. Cards with several teams blend from the first team to the last.
- Filters moved into a panel behind a **Filters** button, with every option visible once it's open. Active filters and pinned players show as removable chips next to the button.
- Player suggestions appear in a dropdown under the search box (arrow keys and Enter work) instead of a row of pills. Typing still filters the list.
- Groups start closed and open or close only when clicked or with Expand all. Filter changes no longer open or close them.
- Card rows show a chevron. The pill on the right shows the number of parallels with a rainbow stacked-cards icon; the subset (or team, when grouped by subset) and any custom print runs move under the player name. Click a row to list every parallel.
- When grouped by player, card rows lead with the subset and show the card name underneath.
- In an expanded card row, each 1/1 shows whether it's still live (dark with a rainbow ring, like the 1/1s tab) or pulled (green with ✓). Clicking it opens the 1/1s tab narrowed to that card and highlights the slot.

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
