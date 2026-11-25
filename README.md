# inni_checklists
Checklist widget to serve as a frontend for a grist table

## Widget channels

GitHub Pages serves every folder under `widgets/`, and each Grist doc points its custom widget at one of them.

| Folder | Who points here | Rule |
|---|---|---|
| `widgets/dev/` | Sandbox doc only | Work happens here. May break. |
| `widgets/v1/`, `v2/`, … | Live set docs | Frozen once released. Never edit a released folder. |
| `widgets/default/` | Live set docs (legacy) | Kept until every live doc points at a numbered version, then removed. |

Widget URL pattern: `https://inniscor.github.io/inni_checklists/widgets/<folder>/`

### Releasing
1. Test the change in `widgets/dev/` against the sandbox doc.
2. Copy `widgets/dev/` to the next numbered folder (e.g. `widgets/v2/`) and push.
3. Change each live doc's custom widget URL to the new folder.

### Rolling back
Point the affected doc's widget URL back at the previous numbered folder.
