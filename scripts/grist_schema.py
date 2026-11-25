#!/usr/bin/env python3
"""Manage the checklist Grist template and its readable schema.

Commands:
  import <export.grist>  Clean an empty Grist export and save it as the template,
                         then regenerate schema.json from it.
  dump [file.grist]      Print the schema JSON for a .grist file (default: the template).
  check                  Fail if schema.json doesn't match the template.

Uses only the Python standard library.
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "schema" / "checklist-template.grist"
SCHEMA = ROOT / "schema" / "schema.json"
WIDGET_URL = re.compile(r"(https://inniscor\.github\.io/inni_checklists/widgets/)[^/\"\\]+/")
EMAIL = re.compile(rb"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
HIDDEN_COLS = ("manualSort",)


def connect(path, readonly=True):
    uri = f"file:{path}?mode=ro" if readonly else f"file:{path}"
    return sqlite3.connect(uri, uri=True)


def user_tables(c):
    return [r[0] for r in c.execute("SELECT tableId FROM _grist_Tables ORDER BY id")]


def has_email(data):
    return any(re.sub(rb"[@.]", b"", m.group(0)).strip(b"x") for m in EMAIL.finditer(data))


def redact(match):
    # Same length keeps Grist's encoded action history valid.
    return re.sub(rb"[^@.]", b"x", match.group(0))


# ---------- import ----------

def cmd_import(src):
    src = Path(src)
    c = connect(src)
    problems = []
    for t in user_tables(c):
        n = c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        if n:
            problems.append(f"{t} has {n} rows")
    for t in ("_grist_Attachments", "_grist_Cells"):
        n = c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        if n:
            problems.append(f"{t} has {n} rows")
    c.close()
    if problems:
        sys.exit("Not an empty template: " + "; ".join(problems) +
                 ".\nIn Grist, use Download > 'Download document as template' or remove the data first.")

    TEMPLATE.parent.mkdir(exist_ok=True)
    tmp = TEMPLATE.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    c = connect(src)
    c.execute("VACUUM INTO ?", (str(tmp),))
    c.close()

    c = connect(tmp, readonly=False)
    redacted = 0
    for (t,) in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
        cols = [r[1] for r in c.execute(f'PRAGMA table_info("{t}")')]
        for row in c.execute(f'SELECT rowid, * FROM "{t}"').fetchall():
            for col, v in zip(cols, row[1:]):
                raw = v if isinstance(v, bytes) else v.encode() if isinstance(v, str) else None
                if raw is None or not has_email(raw):
                    continue
                new, n = EMAIL.subn(redact, raw)
                redacted += n
                c.execute(f'UPDATE "{t}" SET "{col}" = ? WHERE rowid = ?',
                          (new if isinstance(v, bytes) else new.decode(), row[0]))
    # New set docs start on the live channel, whatever the export pointed at.
    for sid, opts in c.execute("SELECT id, options FROM _grist_Views_section").fetchall():
        if opts and WIDGET_URL.search(opts):
            c.execute("UPDATE _grist_Views_section SET options = ? WHERE id = ?",
                      (WIDGET_URL.sub(r"\1latest/", opts), sid))
    c.commit()
    c.close()

    # Compact again so no old page still holds the replaced text.
    TEMPLATE.unlink(missing_ok=True)
    c = connect(tmp)
    c.execute("VACUUM INTO ?", (str(TEMPLATE),))
    c.close()
    tmp.unlink()
    if has_email(TEMPLATE.read_bytes()):
        sys.exit("An email address is still present in the template; not saving.")

    SCHEMA.write_text(render(TEMPLATE))
    print(f"Saved {TEMPLATE.relative_to(ROOT)} ({redacted} email address(es) redacted)")
    print(f"Saved {SCHEMA.relative_to(ROOT)}")


# ---------- schema dump ----------

def parse_json(s):
    if not s:
        return None
    try:
        return json.loads(s)
    except ValueError:
        return s


def dump(path):
    c = connect(path)
    c.row_factory = sqlite3.Row
    tables = {r["id"]: r["tableId"] for r in c.execute("SELECT id, tableId FROM _grist_Tables")}
    cols_by_id = {r["id"]: r for r in c.execute("SELECT * FROM _grist_Tables_column")}

    out = {"tables": {}, "access_rules": [], "pages": []}
    for tid, tname in sorted(tables.items()):
        cols = []
        for col in sorted((r for r in cols_by_id.values() if r["parentId"] == tid),
                          key=lambda r: (r["parentPos"], r["id"])):
            cid = col["colId"]
            if cid.startswith("gristHelper_") or cid in HIDDEN_COLS:
                continue
            if col["isFormula"] and col["formula"]:
                kind = "formula"
            elif col["isFormula"]:
                kind = "empty"
            elif col["formula"]:
                kind = "trigger"
            else:
                kind = "data"
            entry = {"id": cid, "type": col["type"], "kind": kind}
            if col["label"] and col["label"] != cid:
                entry["label"] = col["label"]
            if col["formula"]:
                entry["formula"] = col["formula"].replace("\r\n", "\n")
            if kind == "trigger":
                deps = parse_json(col["recalcDeps"])
                entry["recalc"] = {
                    "when": {0: "new_and_changes", 1: "new_only", 2: "manual"}.get(col["recalcWhen"], col["recalcWhen"]),
                    "deps": [cols_by_id[d]["colId"] for d in deps[1:]] if isinstance(deps, list) else deps,
                }
            if col["visibleCol"]:
                entry["show_column"] = cols_by_id[col["visibleCol"]]["colId"]
            if col["description"]:
                entry["description"] = col["description"]
            opts = parse_json(col["widgetOptions"])
            if opts:
                entry["widget_options"] = opts
            cols.append(entry)
        out["tables"][tname] = cols

    resources = {r["id"]: r for r in c.execute("SELECT * FROM _grist_ACLResources")}
    for r in c.execute("SELECT * FROM _grist_ACLRules ORDER BY resource, rulePos"):
        res = resources.get(r["resource"])
        rule = {
            "table": res["tableId"] if res else None,
            "columns": res["colIds"] if res else None,
            "condition": r["aclFormula"],
            "permissions": r["permissionsText"],
        }
        if r["memo"]:
            rule["memo"] = r["memo"]
        if r["userAttributes"]:
            rule["user_attributes"] = parse_json(r["userAttributes"])
        out["access_rules"].append(rule)

    page_order = [r["viewRef"] for r in c.execute("SELECT viewRef FROM _grist_Pages ORDER BY pagePos")]
    views = {r["id"]: r for r in c.execute("SELECT * FROM _grist_Views")}
    for vid in page_order:
        v = views[vid]
        widgets = []
        for s in c.execute("SELECT * FROM _grist_Views_section WHERE parentId = ? ORDER BY id", (vid,)):
            w = {"type": s["parentKey"], "table": tables.get(s["tableRef"])}
            if s["title"]:
                w["title"] = s["title"]
            if s["description"]:
                w["description"] = s["description"]
            opts = parse_json(s["options"]) or {}
            cv = parse_json(opts.get("customView")) if isinstance(opts, dict) else None
            if isinstance(cv, dict) and cv.get("url"):
                w["custom_widget"] = {"url": cv["url"], "access": cv.get("access")}
            widgets.append(w)
        out["pages"].append({"name": v["name"], "widgets": widgets})
    c.close()
    return out


def render(path):
    return json.dumps(dump(path), indent=2, ensure_ascii=False) + "\n"


# ---------- main ----------

def main(argv):
    if len(argv) >= 2 and argv[0] == "import":
        cmd_import(argv[1])
    elif argv and argv[0] == "dump":
        sys.stdout.write(render(argv[1] if len(argv) > 1 else TEMPLATE))
    elif argv == ["check"]:
        if not TEMPLATE.exists() or not SCHEMA.exists():
            sys.exit("Missing schema/checklist-template.grist or schema/schema.json")
        if has_email(TEMPLATE.read_bytes()):
            sys.exit("The template contains an email address. Re-run: python3 scripts/grist_schema.py import <export.grist>")
        if render(TEMPLATE) != SCHEMA.read_text():
            sys.exit("schema/schema.json is out of date with the template. Re-run: python3 scripts/grist_schema.py import <export.grist>")
        print("Schema and template match.")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
