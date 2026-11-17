#!/usr/bin/env python3
"""Pattern numbers for writing insights, so Claude never does the arithmetic by hand.

Usage:
  python3 scripts/insights_stats.py            # her data, JSON to stdout
  python3 scripts/insights_stats.py --sample   # the demo data

Every group lists n, net $, win rate, average R, a confidence label from n (early <10,
moderate 10-29, strong 30+) and the trade_ids behind it, so each insight can cite evidence.
Formulas match assets/metrics.js (win rate ignores break-even trades; R uses initial_risk,
else profile.default_risk_per_trade).
"""
import argparse
import csv
import json
import os
import sys
from datetime import datetime, timedelta

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def load(root, sample):
    base = os.path.join(root, "data", "sample") if sample else os.path.join(root, "data")
    with open(os.path.join(base, "trades.csv"), newline="") as f:
        trades = list(csv.DictReader(f))
    try:
        with open(os.path.join(base, "journal.json")) as f:
            journal = json.load(f)
    except (OSError, ValueError):
        journal = []
    prof_paths = [os.path.join(base, "profile.json")] if sample else [
        os.path.join(root, "config", "profile.json"), os.path.join(root, "config", "profile.example.json")]
    profile = {}
    for p in prof_paths:
        if os.path.exists(p):
            with open(p) as f:
                profile = json.load(f)
            break
    return trades, journal, profile


def _parse(t):
    return datetime.fromisoformat(t.replace("Z", "+00:00"))


def _local(t, tz):
    d = _parse(t)
    return d.astimezone(ZoneInfo(tz)) if ZoneInfo and tz else d


def confidence(n):
    return "early" if n < 10 else "moderate" if n < 30 else "strong"


def stats(rows, profile, key=None):
    pnl = [_num(r["pnl_net"]) or 0.0 for r in rows]
    wins = [p for p in pnl if p > 0]
    losses = [p for p in pnl if p < 0]
    default_risk = _num(profile.get("default_risk_per_trade"))
    rs = []
    for r, p in zip(rows, pnl):
        risk = _num(r.get("initial_risk")) or default_risk
        if risk:
            rs.append(p / risk)
    out = {
        "n": len(rows),
        "net": round(sum(pnl), 2),
        "win_rate": round(len(wins) / (len(wins) + len(losses)), 3) if wins or losses else None,
        "avg_r": round(sum(rs) / len(rs), 3) if rs else None,
        "net_r": round(sum(rs), 2) if rs else None,
        "confidence": confidence(len(rows)),
        "trade_ids": [r["trade_id"] for r in rows],
    }
    if key is not None:
        out = {"key": key, **out}
    return out


def group(rows, keyfn, profile, sort="net"):
    buckets = {}
    for r in rows:
        k = keyfn(r)
        if k is None:
            continue
        for kk in (k if isinstance(k, list) else [k]):
            buckets.setdefault(kk, []).append(r)
    out = [stats(v, profile, k) for k, v in buckets.items()]
    if sort == "net":
        out.sort(key=lambda g: g["net"])
    else:
        out.sort(key=lambda g: sort(g["key"]))
    return out


def compute_from(trades, journal, profile):
    tz = profile.get("timezone") or "America/New_York"
    trades = sorted(trades, key=lambda r: r["entry_time"])
    notes = []

    # Journal joins
    by_trade = {}
    for e in journal:
        for tid in e.get("linked_trade_ids") or []:
            by_trade[tid] = e
    if not journal:
        notes.append("No journal entries yet: mood, sleep, plan-adherence and mistake insights need the journal.")

    def hour_bucket(r):
        d = _local(r["entry_time"], tz)
        m = (d.hour * 60 + d.minute) // 30 * 30
        return f"{m // 60:02d}:{m % 60:02d}"

    start = (profile.get("session") or {}).get("start") or "09:30"
    sh, sm = (int(x) for x in start.split(":"))

    def first15(r):
        d = _local(r["entry_time"], tz)
        mins = d.hour * 60 + d.minute - (sh * 60 + sm)
        return "first 15 min" if 0 <= mins < 15 else "after 15 min" if mins >= 15 else "before session"

    # Trades opened within 10 minutes after a losing trade closed, same account.
    after_loss = []
    closed = sorted(trades, key=lambda r: r["exit_time"])
    for r in trades:
        t = _parse(r["entry_time"])
        prev = [c for c in closed if c["account"] == r["account"] and c is not r and _parse(c["exit_time"]) <= t]
        if prev and (_num(prev[-1]["pnl_net"]) or 0) < 0 and t - _parse(prev[-1]["exit_time"]) <= timedelta(minutes=10):
            after_loss.append(r)

    def mood(r):
        e = by_trade.get(r["trade_id"])
        return e.get("mood") if e and e.get("mood") is not None else None

    def sleep(r):
        e = by_trade.get(r["trade_id"])
        h = e.get("sleep_hours") if e else None
        if h is None:
            return None
        return "<6h" if h < 6 else "6–7h" if h < 7 else "7–8h" if h < 8 else "8h+"

    def plan(r):
        e = by_trade.get(r["trade_id"])
        if not e or e.get("followed_plan") is None:
            return None
        return "followed plan" if e["followed_plan"] else "off plan"

    recent = closed[-20:]
    prior = closed[-60:-20]
    return {
        "overall": stats(trades, profile),
        "recent_20_vs_prior_40": {"recent": stats(recent, profile), "prior": stats(prior, profile)},
        "by_setup": group(trades, lambda r: r.get("setup") or None, profile),
        "by_tag": group(trades, lambda r: [t for t in (r.get("tags") or "").split("|") if t] or None, profile),
        "by_weekday": group(trades, lambda r: DAYS[_local(r["entry_time"], tz).weekday()], profile, sort=DAYS.index),
        "by_time_30min": group(trades, hour_bucket, profile, sort=lambda k: k),
        "open_first_15min": group(trades, first15, profile),
        "after_loss_10min": stats(after_loss, profile),
        "by_symbol": group(trades, lambda r: r["symbol"], profile),
        "by_mood": group(trades, mood, profile, sort=lambda k: k),
        "by_sleep": group(trades, sleep, profile, sort=lambda k: ["<6h", "6–7h", "7–8h", "8h+"].index(k)),
        "plan_adherence": group(trades, plan, profile),
        "notes": notes,
        "_trades": trades,
    }


def compute(root, sample=False):
    trades, journal, profile = load(root, sample)
    return compute_from(trades, journal, profile)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Pattern numbers for Trading Assistant insights (JSON).")
    ap.add_argument("--root", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--ids", action="store_true", help="include trade_ids in every group (long)")
    a = ap.parse_args(argv)
    s = compute(a.root, a.sample)
    s.pop("_trades")
    if not a.ids:
        def strip(x):
            if isinstance(x, dict):
                return {k: strip(v) for k, v in x.items() if k != "trade_ids" or len(v) <= 15}
            if isinstance(x, list):
                return [strip(v) for v in x]
            return x
        s = strip(s)
    json.dump(s, sys.stdout, indent=1, ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
