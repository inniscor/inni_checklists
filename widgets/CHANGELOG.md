# Changelog

All changes to the checklist widget, newest first. **Unreleased** describes what's in `widgets/dev/` and not yet in a numbered version.

## Unreleased

_Nothing yet._

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
