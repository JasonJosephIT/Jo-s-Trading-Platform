#!/usr/bin/env python3
"""Where does this Trading Coach folder stand? Claude runs this first, every time.

Usage:
  python3 scripts/doctor.py              # plain-words report
  python3 scripts/doctor.py --json       # same, as JSON
  python3 scripts/doctor.py --mark trades done "IBKR connector, 212 trades"

Setup progress lives in config/setup-state.json (never in git). The step list below is
the single source; CLAUDE.md's SETUP flow uses the same ids and order.
"""
import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

STEPS = [
    {"id": "config", "title": "Your settings", "who": "claude"},
    {"id": "toolkit", "title": "Check your apps", "who": "both"},
    {"id": "extras", "title": "Helpful extras", "who": "both"},
    {"id": "trades", "title": "Bring in your trades", "who": "both"},
    {"id": "journal", "title": "Read your journal", "who": "both"},
    {"id": "insights", "title": "First insights", "who": "claude"},
    {"id": "dashboard", "title": "Open your dashboard", "who": "her"},
    {"id": "schedules", "title": "Daily schedule", "who": "both"},
    {"id": "notion_brief", "title": "Brief on your phone", "who": "both"},
    {"id": "calendar", "title": "Market events on your calendar", "who": "both"},
    {"id": "wrapup", "title": "You're set", "who": "claude"},
]
STATUSES = ("pending", "in_progress", "done", "skipped")
STEP_IDS = [s["id"] for s in STEPS]


def _p(root, *parts):
    return os.path.join(root, *parts)


def _load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def load_state(root):
    state = _load_json(_p(root, "config", "setup-state.json"), {})
    state.setdefault("steps", {})
    return state


def mark(root, step, status, note=None):
    if step not in STEP_IDS:
        raise ValueError(f"unknown step {step!r}; use one of {', '.join(STEP_IDS)}")
    if status not in STATUSES:
        raise ValueError(f"unknown status {status!r}; use one of {', '.join(STATUSES)}")
    state = load_state(root)
    entry = {"status": status, "at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")}
    if note:
        entry["note"] = note
    state["steps"][step] = entry
    state["updated"] = entry["at"]
    os.makedirs(_p(root, "config"), exist_ok=True)
    with open(_p(root, "config", "setup-state.json"), "w") as f:
        json.dump(state, f, indent=2)
    return state


def _trades(root):
    path = _p(root, "data", "trades.csv")
    out = {"count": 0, "last_exit": None, "accounts": []}
    try:
        with open(path, newline="") as f:
            rows = list(csv.DictReader(f))
    except OSError:
        return out
    out["count"] = len(rows)
    exits = [r.get("exit_time") for r in rows if r.get("exit_time")]
    out["last_exit"] = max(exits) if exits else None
    out["accounts"] = sorted({r.get("account") for r in rows if r.get("account")})
    return out


def _data_js(root):
    path = _p(root, "data", "data.js")
    try:
        with open(path) as f:
            head = f.read(200)
    except OSError:
        return {"built": False, "updated": None}
    if "TC_DATA = null" in head or "TC_DATA=null" in head:
        return {"built": False, "updated": None}
    updated = None
    marker = '"updated":"'
    if marker in head:
        updated = head.split(marker, 1)[1].split('"', 1)[0]
    return {"built": True, "updated": updated, "mtime": os.path.getmtime(path)}


def check(root):
    state = load_state(root)
    steps = []
    for i, s in enumerate(STEPS, 1):
        st = state["steps"].get(s["id"], {})
        steps.append({**s, "number": i, "status": st.get("status", "pending"), "note": st.get("note")})
    pending = [s for s in steps if s["status"] not in ("done", "skipped")]
    nxt = pending[0] if pending else None

    profile_exists = os.path.exists(_p(root, "config", "profile.json"))
    profile = _load_json(_p(root, "config", "profile.json"), {})
    journal = _load_json(_p(root, "data", "journal.json"), [])
    insights = _load_json(_p(root, "data", "insights.json"), {})
    trades = _trades(root)
    data = _data_js(root)
    try:
        inbox = sorted(f for f in os.listdir(_p(root, "inbox")) if not f.startswith("."))
    except OSError:
        inbox = []
    try:
        briefs = sorted(f for f in os.listdir(_p(root, "briefs")) if f[:4].isdigit())
    except OSError:
        briefs = []

    warnings = []
    if inbox:
        warnings.append(f"{len(inbox)} file(s) waiting in inbox/ to be imported")
    if trades["count"] and not data["built"]:
        warnings.append("trades exist but data/data.js was never built: run scripts/build_data.py")
    for name in ("trades.csv", "journal.json", "insights.json"):
        p = _p(root, "data", name)
        if data.get("mtime") and os.path.exists(p) and os.path.getmtime(p) > data["mtime"] + 1:
            warnings.append(f"data/{name} changed after data/data.js was built: run scripts/build_data.py")
    if os.path.exists(_p(root, "data", "sample")) and profile.get("name") == "Sample Trader":
        warnings.append("config/profile.json looks like the sample profile")

    return {
        "set_up": nxt is None,
        "next": {"step": nxt["id"] if nxt else None, "title": nxt["title"] if nxt else None,
                 "number": nxt["number"] if nxt else None, "of": len(STEPS)},
        "steps": steps,
        "profile": {"exists": profile_exists, "timezone": profile.get("timezone"), "style": profile.get("style"),
                    "data_source": profile.get("data_source"), "brief_time": profile.get("brief_time")},
        "trades": trades,
        "journal": {"count": len(journal) if isinstance(journal, list) else 0,
                    "last_date": max((e.get("date") or "" for e in journal), default=None) if isinstance(journal, list) and journal else None},
        "insights": {"generated": insights.get("generated") if isinstance(insights, dict) else None,
                     "brief_date": (insights.get("brief") or {}).get("date") if isinstance(insights, dict) else None},
        "data_js": {k: v for k, v in data.items() if k != "mtime"},
        "inbox": inbox,
        "latest_brief": briefs[-1] if briefs else None,
        "warnings": warnings,
    }


def report(r):
    lines = []
    if r["set_up"]:
        lines.append("Setup is complete. Daily mode: run the flow she asks for (or MORNING_UPDATE).")
    else:
        n = r["next"]
        lines.append(f"Setup: next is step {n['number']} of {n['of']}: {n['title']} ({n['step']}).")
    for s in r["steps"]:
        mark_ = {"done": "x", "skipped": "-", "in_progress": ">", "pending": " "}[s["status"]]
        lines.append(f"  [{mark_}] {s['number']:>2}. {s['title']}" + (f"  ({s['note']})" if s.get("note") else ""))
    lines.append("  ([x] done  [-] skipped  [>] waiting on her  [ ] to do)")
    t = r["trades"]
    lines.append(f"Trades: {t['count']}" + (f", last exit {t['last_exit']}" if t["last_exit"] else ""))
    lines.append(f"Journal entries: {r['journal']['count']}" + (f", latest {r['journal']['last_date']}" if r["journal"]["last_date"] else ""))
    lines.append(f"Dashboard data built: {'yes, ' + str(r['data_js'].get('updated')) if r['data_js']['built'] else 'no'}")
    lines.append(f"Latest brief: {r['latest_brief'] or 'none yet'}")
    for w in r["warnings"]:
        lines.append(f"! {w}")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Report where this Trading Coach folder stands.")
    ap.add_argument("--root", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--mark", nargs="+", metavar=("STEP", "STATUS"), help="STEP STATUS [NOTE]")
    a = ap.parse_args(argv)
    if a.mark:
        if len(a.mark) < 2:
            ap.error("--mark needs STEP and STATUS")
        try:
            mark(a.root, a.mark[0], a.mark[1], " ".join(a.mark[2:]) or None)
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
    r = check(a.root)
    print(json.dumps(r, indent=2) if a.json else report(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
