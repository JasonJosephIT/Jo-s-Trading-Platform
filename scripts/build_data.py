#!/usr/bin/env python3
"""Build data/data.js from data/trades.csv, journal.json, insights.json and the profile.

Usage:
  python3 scripts/build_data.py [--root .] [--sample]

Normal run reads <root>/data/* and config/profile.json (falls back to profile.example.json)
and writes data/data.js as `window.TC_DATA = {...};`.
--sample reads <root>/data/sample/* (profile.json included) and writes data/sample/data.js
as `window.TC_DATA_SAMPLE = {...};`.
Validation errors name the file, row and field; nothing is written if any are found.
"""
import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone

TRADE_COLUMNS = ["trade_id", "account", "symbol", "asset_class", "side", "qty", "entry_time", "exit_time",
                 "entry_price", "exit_price", "fees", "pnl_gross", "pnl_net", "initial_risk", "risk_source",
                 "setup", "tags", "source", "source_ref"]
NUMERIC = ["qty", "entry_price", "exit_price", "fees", "pnl_gross", "pnl_net", "initial_risk"]
REQUIRED = ["trade_id", "account", "symbol", "asset_class", "side", "qty", "entry_time", "exit_time",
            "entry_price", "exit_price", "pnl_net"]
ASSET_CLASSES = ["stock", "option", "future", "crypto", "forex", "other"]
RISK_SOURCES = ["journal", "broker_stop", "default"]
CONFIDENCE = ["early", "moderate", "strong"]
PROFILE_KEYS = ["name", "timezone", "markets", "instruments", "style", "session", "brief_time", "account_currency",
                "default_risk_per_trade", "max_daily_loss", "max_trades_per_day", "stop_after_consecutive_losses",
                "prop_rules", "setups", "mistake_tags", "watchlist", "layout_preset", "panels"]
TIME_RX = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$")


class ValidationError(Exception):
    def __init__(self, errors):
        super().__init__("\n".join(errors))
        self.errors = errors


def _is_iso_with_offset(s):
    if not TIME_RX.match(s):
        return False
    try:
        datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def load_trades(path, errors):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        missing = [c for c in TRADE_COLUMNS if c not in header]
        if missing:
            errors.append("%s: header is missing column(s): %s" % (path, ", ".join(missing)))
            return []
        trades, seen = [], {}
        for i, row in enumerate(reader, start=2):
            tid = (row.get("trade_id") or "").strip()
            where = "%s row %d (trade_id %s)" % (path, i, tid or "<empty>")
            t = {}
            for c in TRADE_COLUMNS:
                v = (row.get(c) or "").strip()
                t[c] = v if v != "" else None
            for c in REQUIRED:
                if t[c] is None:
                    errors.append("%s: field '%s' is required but empty" % (where, c))
            for c in NUMERIC:
                if t[c] is not None:
                    try:
                        t[c] = float(t[c])
                    except ValueError:
                        errors.append("%s: field '%s' must be a number, got '%s'" % (where, c, t[c]))
                        t[c] = None
                    else:
                        if t[c] == int(t[c]) and abs(t[c]) < 1e15:
                            t[c] = int(t[c])
            if t["side"] is not None and t["side"] not in ("long", "short"):
                errors.append("%s: field 'side' must be long|short, got '%s'" % (where, t["side"]))
            if t["asset_class"] is not None and t["asset_class"] not in ASSET_CLASSES:
                errors.append("%s: field 'asset_class' must be one of %s, got '%s'"
                              % (where, "|".join(ASSET_CLASSES), t["asset_class"]))
            for c in ("entry_time", "exit_time"):
                if t[c] is not None and not _is_iso_with_offset(t[c]):
                    errors.append("%s: field '%s' must be ISO 8601 with an offset (2026-11-16T09:42:10-05:00), got '%s'"
                                  % (where, c, t[c]))
            if t["initial_risk"] is not None:
                if isinstance(t["initial_risk"], (int, float)) and t["initial_risk"] <= 0:
                    errors.append("%s: field 'initial_risk' must be positive, got %s" % (where, t["initial_risk"]))
                if t["risk_source"] not in RISK_SOURCES:
                    errors.append("%s: field 'risk_source' must be %s when initial_risk is set, got '%s'"
                                  % (where, "|".join(RISK_SOURCES), t["risk_source"]))
            elif t["risk_source"] is not None:
                errors.append("%s: field 'risk_source' must be empty when initial_risk is empty" % where)
            t["tags"] = [x.strip() for x in (t["tags"] or "").split("|") if x.strip()]
            if tid:
                if tid in seen:
                    errors.append("%s: duplicate trade_id (first seen on row %d)" % (where, seen[tid]))
                seen[tid] = i
            trades.append(t)
    return trades


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        text = f.read().strip()
    return json.loads(text) if text else default


def check_journal(journal, path, trade_ids, errors):
    if not isinstance(journal, list):
        errors.append("%s: must be a JSON array" % path)
        return
    ids = set()
    for i, j in enumerate(journal):
        where = "%s entry %d (id %s)" % (path, i, j.get("id") if isinstance(j, dict) else "?")
        if not isinstance(j, dict):
            errors.append("%s: must be an object" % where)
            continue
        if not j.get("id"):
            errors.append("%s: field 'id' is required" % where)
        elif j["id"] in ids:
            errors.append("%s: duplicate id" % where)
        ids.add(j.get("id"))
        if not isinstance(j.get("date"), str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", j["date"]):
            errors.append("%s: field 'date' must be YYYY-MM-DD, got %r" % (where, j.get("date")))
        if j.get("mood") is not None and j["mood"] not in (1, 2, 3, 4, 5):
            errors.append("%s: field 'mood' must be 1-5 or null, got %r" % (where, j["mood"]))
        if j.get("sleep_hours") is not None and not isinstance(j["sleep_hours"], (int, float)):
            errors.append("%s: field 'sleep_hours' must be a number or null" % where)
        if j.get("followed_plan") is not None and not isinstance(j["followed_plan"], bool):
            errors.append("%s: field 'followed_plan' must be true, false or null" % where)
        for k in ("linked_trade_ids", "symbols", "mistakes", "emotions"):
            if k in j and j[k] is not None and not isinstance(j[k], list):
                errors.append("%s: field '%s' must be an array" % (where, k))
        if isinstance(j.get("excerpt"), str) and len(j["excerpt"]) > 200:
            errors.append("%s: field 'excerpt' is %d chars; the limit is 200" % (where, len(j["excerpt"])))
        for tid in j.get("linked_trade_ids") or []:
            if tid not in trade_ids:
                errors.append("%s: linked_trade_ids has '%s', which is not in trades.csv" % (where, tid))


def check_insights(ins, path, errors):
    if not isinstance(ins, dict):
        errors.append("%s: must be a JSON object" % path)
        return
    q = ins.get("quote")
    if q is not None:
        if not isinstance(q, dict) or not isinstance(q.get("text"), str) or not q["text"].strip():
            errors.append("%s: field 'quote' needs a non-empty 'text'" % path)
        else:
            if len(q["text"]) > 240:
                errors.append("%s: quote 'text' must be at most 240 chars, got %d" % (path, len(q["text"])))
            if not isinstance(q.get("by"), str) or not q["by"].strip():
                errors.append("%s: quote needs 'by'" % path)
    items = ins.get("insights", [])
    if not isinstance(items, list):
        errors.append("%s: field 'insights' must be an array" % path)
        return
    if len(items) > 5:
        errors.append("%s: at most 5 insights, got %d" % (path, len(items)))
    for i, it in enumerate(items):
        where = "%s insight %d" % (path, i)
        if not isinstance(it, dict) or not it.get("title"):
            errors.append("%s: field 'title' is required" % where)
            continue
        if it.get("confidence") not in CONFIDENCE:
            errors.append("%s: field 'confidence' must be %s, got %r" % (where, "|".join(CONFIDENCE), it.get("confidence")))
        ev = it.get("evidence")
        if not isinstance(ev, dict) or not isinstance(ev.get("n"), int):
            errors.append("%s: field 'evidence' needs an integer 'n'" % where)


def build(root, sample=False, updated=None):
    root = os.path.abspath(root)
    data_dir = os.path.join(root, "data", "sample") if sample else os.path.join(root, "data")
    errors = []
    trades_path = os.path.join(data_dir, "trades.csv")
    trades = load_trades(trades_path, errors)
    ids = {t["trade_id"] for t in trades}
    journal_path = os.path.join(data_dir, "journal.json")
    insights_path = os.path.join(data_dir, "insights.json")
    try:
        journal = load_json(journal_path, [])
        insights = load_json(insights_path, {})
    except json.JSONDecodeError as e:
        errors.append("invalid JSON: %s" % e)
        journal, insights = [], {}
    if sample:
        profile_path = os.path.join(data_dir, "profile.json")
    else:
        profile_path = os.path.join(root, "config", "profile.json")
        if not os.path.exists(profile_path):
            profile_path = os.path.join(root, "config", "profile.example.json")
    try:
        profile = load_json(profile_path, {})
    except json.JSONDecodeError as e:
        errors.append("%s: invalid JSON: %s" % (profile_path, e))
        profile = {}
    check_journal(journal, journal_path, ids, errors)
    check_insights(insights, insights_path, errors)
    if not isinstance(profile, dict) or not profile.get("timezone"):
        errors.append("%s: field 'timezone' is required" % profile_path)
    if errors:
        raise ValidationError(errors)
    if updated is None:
        if sample and isinstance(insights, dict) and insights.get("generated"):
            updated = insights["generated"]
        else:
            updated = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    payload = {
        "updated": updated,
        "profile": {k: profile[k] for k in PROFILE_KEYS if k in profile},
        "trades": trades,
        "journal": journal,
        "insights": insights,
    }
    out_path = os.path.join(data_dir, "data.js")
    var = "window.TC_DATA_SAMPLE" if sample else "window.TC_DATA"
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("%s = %s;\n" % (var, json.dumps(payload, ensure_ascii=True, separators=(",", ":"))))
    return out_path, payload


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=".")
    ap.add_argument("--sample", action="store_true")
    a = ap.parse_args(argv)
    try:
        out, payload = build(a.root, a.sample)
    except ValidationError as e:
        print("data validation failed (%d problem%s):" % (len(e.errors), "" if len(e.errors) == 1 else "s"),
              file=sys.stderr)
        for line in e.errors:
            print("  - " + line, file=sys.stderr)
        return 1
    print("wrote %s (%d trades, %d journal entries)" % (out, len(payload["trades"]), len(payload["journal"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
