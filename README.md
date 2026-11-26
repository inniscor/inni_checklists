# inni_checklists
Checklist widget to serve as a frontend for a grist table

## Widget channels

The site is published by the **Publish site** GitHub Actions workflow on every push to `main` (repo setting: Settings → Pages → Source → GitHub Actions). Each Grist doc points its custom widget at one of these folders:

| Folder | Who points here | Rule |
|---|---|---|
| `widgets/dev/` | Sandbox doc only | Work happens here. May break. |
| `widgets/latest/` | Live set docs (default) | Not in the repo. Generated at publish time from the version named in `widgets/LATEST`. |
| `widgets/v1/`, `v2/`, … | Any doc that needs a fixed version | Frozen once released. Never edit a released folder. |

Widget URL pattern: `https://inniscor.github.io/inni_checklists/widgets/<folder>/`

### Making a change
1. Work on a branch and open a pull request. The **Widget tests** workflow runs `tests/widget_test.py` on every PR that touches the widget, `sets.json` or the tests; run it locally with `python3 tests/widget_test.py` (see [Tests](#tests)).
2. Note the change under **Unreleased** in `widgets/CHANGELOG.md`. If it needs something new in the docs (a table, a column, an access rule), make that change in the sandbox doc and list it under a **Requires** heading in the changelog. The live docs and the template catch up at release.
3. Merge to `main`. The site republishes `widgets/dev/`, so only the sandbox doc sees the change. GitHub Pages caches pages for about 10 minutes, so wait and reload the widget before testing in the sandbox.

### Releasing
1. **Bring the live docs up to date first.** Check the **Requires** notes under Unreleased and make each change in every live set doc, so the new version finds what it needs the moment it goes live.
2. **Open one release PR** that:
   - copies `widgets/dev/` to the next numbered folder (e.g. `widgets/v4/`),
   - renames **Unreleased** in `widgets/CHANGELOG.md` to the version and date (e.g. `## v4 — 2026-12-01`) and adds a fresh **Unreleased** section above it,
   - changes `widgets/LATEST` to the new version,
   - if the release has **Requires** notes, refreshes the template from the sandbox doc, which already has the changes (see [Updating the template](#updating-the-template)).

   Run `python3 tests/widget_test.py widgets/v4` against the new folder before merging.
3. **Merge it.** Every doc on `latest/` picks up the new version; pinned docs don't change.
4. **Check each live doc** about 10 minutes later: reload it and confirm the new version loaded and reads its data.

Never change a live doc's custom widget URL as part of a release. Grist resets the widget's access to "none" when its URL changes, and the widget stops loading until access is set back to **Full document access**. Docs on `latest/` don't need a URL change.

`widgets/CHANGELOG.md` is one continuous log for every version; it isn't copied into version folders.

### Pinning a doc
Set the doc's custom widget URL to a numbered folder instead of `latest/`.

### Rolling back
Change `widgets/LATEST` back to the previous version and push, or pin the affected doc to the previous version.

### Building locally
`bash scripts/build-site.sh` writes the site to `_site/`. It fails if `LATEST` names a missing version or if a `widgets/latest/` folder was committed.

## Set list

`sets.json` (at the site root) lists the checklists the widget's set switcher links to, grouped by year (`"years": [{ "year": "2026", "sets": [...] }]`). Each set has an `order` number, a `name`, an optional `sub` line, the Grist `doc` ID (used to mark the set you're in) and a `url`. Sets are listed by `order`, lowest first, in Featured and in each year; number them in steps of 10 (10, 20, 30…) so a new set can slot in between without renumbering the rest. Sets without an `order` go last. Keep the file in the same order too, since widgets before v5 list sets in file order. Leave out `url` (and `doc`) for a set that isn't ready yet, such as a "Coming Soon..." entry: it's listed dimmed and can't be clicked. Add the link once the doc is ready. Add `"featured": true` to show a set in the **Featured** section at the top of the menu as well as under its year; only the three featured sets with the lowest `order` are shown. The menu opens with Featured expanded and the years collapsed, and only one section is open at a time. Point `url` at the doc's Checklist page with `?style=singlePage` so it opens without Grist's side panel and header. Adding a set is a one-line change here; no doc or widget change is needed. Widgets from v1 to v3 don't read it.

`sets.json` isn't versioned: a change to it reaches every doc on v4 or later as soon as the site republishes, without a widget release.

### Adding a new set
1. Import `schema/checklist-template.grist` in Grist (Add New → Import Document) and fill in the checklist data.
2. Fill in **Teams**: one row per team exactly as written in `Cards.Team`, with its hex `Color`.
3. Open the Checklist page and check that the custom widget has **Full document access** and loads.
4. Share it the same way as the other set docs, and take its Checklist page link with `?style=singlePage` added.
5. Add the set to `sets.json` under its year (order, name, sub line, doc ID, that link). Mark it `"featured": true` if it should be one of the three at the top, and unmark another if three are already featured.

## Schema

`schema/` holds the document structure every set doc is built from:

- `checklist-template.grist`: an empty Grist document with every table, formula, page, access rule and the checklist widget (pointed at `widgets/latest/`). To start a new set, import it in Grist (Add New → Import Document) and fill in the data. Fill in **Teams** too (each team exactly as written in `Cards.Team`, with its hex `Color`); the widget shades rows from the calculated `Tint` and skips teams without one.
- `schema.json`: a readable copy of the same structure, generated from the template. The template is binary, so review changes here.

### Changing the schema
A schema change (a table, column, formula, page or access rule) moves through the docs in this order:

1. **Sandbox, while developing.** Make the change in the sandbox doc and list it under **Requires** in `widgets/CHANGELOG.md` (see [Making a change](#making-a-change)).
2. **Live docs, at release.** Make the same change in every live set doc before the release PR is merged ([Releasing](#releasing), step 1). The template only shapes new docs; existing docs keep their structure until they're changed by hand.
3. **Template, in the release PR.** Refresh the template from the sandbox, as below.

### Updating the template
1. Download the sandbox doc as a template (no data) and run:
   `python3 scripts/grist_schema.py import <downloaded>.grist`
   This refuses files that contain rows, replaces any email addresses Grist stored in the document's history, points the widget at `latest/`, and regenerates `schema.json`.
2. Review the `schema.json` diff: it should show only the changes listed under **Requires**. Anything else means the sandbox has drifted; fix the sandbox and download again.
3. Commit both files in the release PR. The **Schema check** workflow fails if they don't match or if the template contains an email address.

`python3 scripts/grist_schema.py dump <file>.grist` prints the schema of any `.grist` file, which is handy for comparing a live doc's download against the template.

## Tests

`tests/widget_test.py` loads a widget folder in a headless browser with sample data (`tests/fixtures/demo.json`) and checks layout, team shading and multi-team cards, the 1/1 status menu and the Pulls changes it makes, the Status filter and the set switcher, at desktop and phone widths. It also runs the widget inside a frame with a stand-in Grist API.

```
pip install playwright
python3 -m playwright install chromium
python3 tests/widget_test.py              # widgets/dev
python3 tests/widget_test.py widgets/v4   # a release folder
```

Set `CHROME_PATH` to use an installed Chrome instead. The script exits non-zero if a check fails or the page throws an error. `tests/` isn't published to the site.
