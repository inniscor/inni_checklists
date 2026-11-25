# Changelog

All changes to the checklist widget, newest first. **Unreleased** describes what's in `widgets/dev/` and not yet in a numbered version.

## Unreleased

### Changed
- Team shading from an optional Teams table (`Team`, `Color`, calculated `Tint`): rows are tinted by team when grouped by subset or player, and team headers are tinted when grouped by team. Cards with several teams blend from the first team to the last. The 1/1s tab follows the same rules.
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
