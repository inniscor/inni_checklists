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

### Releasing
1. Test the change in `widgets/dev/` against the sandbox doc, and note it under **Unreleased** in `widgets/CHANGELOG.md`.
2. Copy `widgets/dev/` to the next numbered folder (e.g. `widgets/v2/`). You can commit it ahead of time; it isn't live until step 4.
3. In `widgets/CHANGELOG.md`, rename **Unreleased** to the new version and date (e.g. `## v2 — 2026-12-01`) and add a fresh empty **Unreleased** section above it.
4. Change `widgets/LATEST` to the new version (e.g. `v2`) and push. Every doc on `latest/` picks it up; pinned docs don't change.

`widgets/CHANGELOG.md` is one continuous log for every version; it isn't copied into version folders.

### Pinning a doc
Set the doc's custom widget URL to a numbered folder instead of `latest/`.

### Rolling back
Change `widgets/LATEST` back to the previous version and push, or pin the affected doc to the previous version.

### Building locally
`bash scripts/build-site.sh` writes the site to `_site/`. It fails if `LATEST` names a missing version or if a `widgets/latest/` folder was committed.

## Set list

`sets.json` (at the site root) lists the checklists the widget's set switcher links to. Each set has a `name`, an optional `sub` line, the Grist `doc` ID (used to mark the set you're in) and a `url`, grouped under a `title`. Point `url` at the doc's Checklist page with `?style=singlePage` so it opens without Grist's side panel and header. Adding a set is a one-line change here; no doc or widget change is needed. Widgets from v1 to v3 don't read it.

## Schema

`schema/` holds the document structure every set doc is built from:

- `checklist-template.grist`: an empty Grist document with every table, formula, page, access rule and the checklist widget (pointed at `widgets/latest/`). To start a new set, import it in Grist (Add New → Import Document) and fill in the data. Fill in **Teams** too (each team exactly as written in `Cards.Team`, with its hex `Color`); the widget shades rows from the calculated `Tint` and skips teams without one.
- `schema.json`: a readable copy of the same structure, generated from the template. The template is binary, so review changes here.

### Updating the schema
1. Make the change in the sandbox doc.
2. Download it as a template (no data) and run:
   `python3 scripts/grist_schema.py import <downloaded>.grist`
   This refuses files that contain rows, replaces any email addresses Grist stored in the document's history, points the widget at `latest/`, and regenerates `schema.json`.
3. Commit both files. The **Schema check** workflow fails if they don't match or if the template contains an email address.

`python3 scripts/grist_schema.py dump <file>.grist` prints the schema of any `.grist` file, which is handy for comparing a live doc's download against the template.
