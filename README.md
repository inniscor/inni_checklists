# inni_checklists
Checklist widget to serve as a frontend for a grist table

## Widget channels

The site is published by the **Publish site** GitHub Actions workflow on every push to `main` (repo setting: Settings → Pages → Source → GitHub Actions). Each Grist doc points its custom widget at one of these folders:

| Folder | Who points here | Rule |
|---|---|---|
| `widgets/dev/` | Sandbox doc only | Work happens here. May break. |
| `widgets/latest/` | Live set docs (default) | Not in the repo. Generated at publish time from the version named in `widgets/LATEST`. |
| `widgets/v1/`, `v2/`, … | Any doc that needs a fixed version | Frozen once released. Never edit a released folder. |
| `widgets/default/` | Nothing, once live docs move to `latest/` | Legacy; delete after the switch. |

Widget URL pattern: `https://inniscor.github.io/inni_checklists/widgets/<folder>/`

### Releasing
1. Test the change in `widgets/dev/` against the sandbox doc.
2. Copy `widgets/dev/` to the next numbered folder (e.g. `widgets/v2/`). You can commit it ahead of time; it isn't live until step 3.
3. Change `widgets/LATEST` to the new version (e.g. `v2`) and push. Every doc on `latest/` picks it up; pinned docs don't change.

### Pinning a doc
Set the doc's custom widget URL to a numbered folder instead of `latest/`.

### Rolling back
Change `widgets/LATEST` back to the previous version and push, or pin the affected doc to the previous version.

### Building locally
`bash scripts/build-site.sh` writes the site to `_site/`. It fails if `LATEST` names a missing version or if a `widgets/latest/` folder was committed.
