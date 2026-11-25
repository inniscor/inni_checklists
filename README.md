# inni_checklists
Checklist widget to serve as a frontend for a grist table

## Widget channels

GitHub Pages serves every folder under `widgets/`, and each Grist doc points its custom widget at one of them.

| Folder | Who points here | Rule |
|---|---|---|
| `widgets/dev/` | Sandbox doc only | Work happens here. May break. |
| `widgets/latest/` | Live set docs (default) | Always identical to the newest numbered version. |
| `widgets/v1/`, `v2/`, … | Any doc that needs a fixed version | Frozen once released. Never edit a released folder. |
| `widgets/default/` | Nothing, once live docs move to `latest/` | Legacy; delete after the switch. |

Widget URL pattern: `https://inniscor.github.io/inni_checklists/widgets/<folder>/`

### Releasing
1. Test the change in `widgets/dev/` against the sandbox doc.
2. Copy `widgets/dev/` to the next numbered folder (e.g. `widgets/v2/`).
3. Copy the same files over `widgets/latest/`.
4. Push. Every doc on `latest/` picks up the release; pinned docs don't change.

### Pinning a doc
Set the doc's custom widget URL to a numbered folder instead of `latest/`.

### Rolling back
Copy the previous numbered folder over `widgets/latest/` and push, or pin the affected doc to the previous version.
