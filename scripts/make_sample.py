#!/usr/bin/env python3
"""Generate the synthetic sample dataset (seeded, deterministic).

Usage:  python3 scripts/make_sample.py [--root .]

Writes data/sample/{trades.csv,journal.json,insights.json,profile.json,data.js}.
Everything here is made up: ~150 futures round trips for "Sample Trader" with
patterns baked in for the coach to find (weak Mondays, revenge trades, a strong
Wednesday inventory-report fade, bad first-15-minute entries, moved stops that
produce outsized losses, worse results on low-mood / short-sleep days).
"""
import argparse
import csv
import hashlib
import json
import os
import random
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data  # noqa: E402

TZ = ZoneInfo("America/New_York")
ACCOUNT = "DEMO-SIM (synthetic)"
DEFAULT_RISK = 100
START, END = date(2026, 7, 15), date(2026, 11, 13)
HOLIDAYS = {date(2026, 9, 7)}
N_JOURNAL = 60

# symbol: (price group, tick, dollars per point, round-trip fee per contract, stop choices in price units)
INSTR = {
    "CL": ("crude", 0.01, 1000, 4.2, [0.08, 0.10, 0.12]),
    "MCL": ("crude", 0.01, 100, 1.3, [0.08, 0.10, 0.12]),
    "GC": ("gold", 0.1, 100, 4.2, [0.8, 1.0, 1.2]),
    "MGC": ("gold", 0.1, 10, 1.3, [0.8, 1.0, 1.2]),
    "NG": ("gas", 0.001, 10000, 4.2, [0.008, 0.010, 0.012]),
    "ZC": ("corn", 0.25, 50, 4.8, [1.5, 2.0, 2.5]),
}
SYMBOL_WEIGHTS = [("CL", 30), ("MCL", 25), ("GC", 15), ("MGC", 15), ("NG", 10), ("ZC", 5)]
START_PRICE = {"crude": 61.8, "gold": 4180.0, "gas": 3.45, "corn": 438.0}

PROFILE = {
    "name": "Sample Trader",
    "timezone": "America/New_York",
    "markets": ["futures"],
    "instruments": ["CL", "MCL", "GC", "MGC", "NG", "ZC"],
    "style": "futures-prop",
    "session": {"start": "09:00", "end": "14:30"},
    "brief_time": "07:30",
    "account_currency": "USD",
    "default_risk_per_trade": DEFAULT_RISK,
    "max_daily_loss": 500,
    "max_trades_per_day": 4,
    "stop_after_consecutive_losses": 2,
    "prop_rules": {"trailing_drawdown": 2000, "daily_loss_limit": 1000},
    "setups": ["opening range break", "VWAP reclaim", "inventory report fade", "trend pullback"],
    "mistake_tags": ["fomo", "revenge", "oversize", "moved_stop", "early_exit", "overtrading", "off_plan"],
    "watchlist": ["CL", "GC", "NG"],
    "data_source": "csv",
    "tools": {
        "broker": {"name": "Sample (synthetic)", "path": "csv", "status": "confirmed"},
        "charting": [],
        "journal": {"name": "Notion", "status": "connector"},
        "calendar": {"name": "", "status": "skip"},
        "news": [],
        "other": [],
    },
    "calendar": {"add_market_events": False, "calendar_name": "Trading", "event_ids": []},
    "notion": {"journal_location": "", "journal_shape": "database", "brief_page": None},
    "layout_preset": "futures-prop",
    "panels": {},
}

OPENERS = {
    1: ["Rough one. I woke up drained and it showed in every decision.", "I barely slept and knew I should have sat this one out."],
    2: ["Off from the start today.", "Slow, heavy morning and not much patience."],
    3: ["Fairly even day.", "Nothing special going in, just the routine."],
    4: ["Felt sharp going in.", "Good energy and I stuck to the morning routine."],
    5: ["Locked in all day.", "Best headspace I've had in a while."],
}
MISTAKE_TEXT = {
    "revenge": "Took a trade right after the stop-out just to get it back.",
    "moved_stop": "I moved my stop instead of letting the trade work, and it cost far more than my plan allowed.",
    "fomo": "Chased an entry after the move had already started.",
    "oversize": "Sized up when I should have stayed at base size.",
    "early_exit": "Bailed on a winner way too early.",
    "overtrading": "Kept clicking after my setup was gone.",
    "off_plan": "Took a trade that was not on my plan.",
}
BAD_PLAN_TAGS = {"revenge", "moved_stop", "fomo", "oversize", "overtrading", "off_plan"}
LESSONS = {
    "moved_stop": "Once the stop is set, it only moves in my favor.",
    "revenge": "After a loss, walk away for 15 minutes before looking at the next setup.",
    "oversize": "Size stays the same after a loss. Always.",
    "fomo": "If the move already started, I missed it. Wait for the next one.",
    "overtrading": "Four trades is the cap. After that the screen is just noise.",
    "early_exit": "Let the target do its job; I wrote it down for a reason.",
}
EMOTIONS = {1: ["tired", "frustrated"], 2: ["tired", "impatient"], 3: ["neutral", "focused"],
            4: ["calm", "focused"], 5: ["confident", "calm"]}


def weighted(rng, pairs):
    total = sum(w for _, w in pairs)
    x = rng.uniform(0, total)
    for v, w in pairs:
        x -= w
        if x <= 0:
            return v
    return pairs[-1][0]


def fnum(x, places=4):
    s = ("%.*f" % (places, x)).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def trading_days():
    d, out = START, []
    while d <= END:
        if d.weekday() < 5 and d not in HOLIDAYS:
            out.append(d)
        d += timedelta(days=1)
    return out


def pwin(kind, entry_min, wd, mood, sleep, idx):
    if kind == "fade":
        p = 0.70
    elif kind == "revenge":
        p = 0.22
    else:
        p = 0.58
        if wd == 0:
            p -= 0.18
        if entry_min < 9 * 60 + 15:
            p -= 0.24
        if idx >= 3:
            p -= 0.10
    p += 0.04 * (mood - 3) + 0.03 * (min(sleep, 8.5) - 6.5)
    return max(0.08, min(0.85, p))


def make_trade(rng, d, entry_min, kind, idx, mood, sleep, prices):
    wd = d.weekday()
    sym = rng.choice(["CL", "CL", "MCL"]) if kind == "fade" else weighted(rng, SYMBOL_WEIGHTS)
    group, tick, mult, rt_fee, stops = INSTR[sym]
    stop = rng.choice(stops)
    risk_target = rng.choice([75, 100, 100, 125, 150])
    qty = max(1, int(round(risk_target / (stop * mult))))
    tags = []
    if kind == "revenge":
        tags.append("revenge")
        if rng.random() < 0.2:
            qty *= 2
            tags.append("oversize")
    p = pwin(kind, entry_min, wd, mood, sleep, idx)
    if kind == "normal" and entry_min < 9 * 60 + 15 and rng.random() < 0.25:
        tags.append("fomo")
    if kind == "normal" and idx >= 3 and rng.random() < 0.5:
        tags.append("overtrading")
    if rng.random() < p:
        r = rng.uniform(1.2, 3.0) if kind == "fade" else rng.uniform(0.8, 2.4)
        if kind == "normal" and rng.random() < 0.07:
            r = rng.uniform(0.2, 0.6)
            tags.append("early_exit")
    else:
        if kind == "revenge":
            r = -rng.uniform(0.9, 1.4)
        elif kind != "fade" and rng.random() < 0.17:
            r = -rng.uniform(1.9, 3.0)
            tags.append("moved_stop")
        else:
            r = -rng.uniform(0.75, 1.0)
    direction = rng.choice([1, -1])
    entry_px = round(prices[group] * (1 + rng.gauss(0, 0.003)) / tick) * tick
    exit_px = round((entry_px + direction * r * stop) / tick) * tick
    gross = round((exit_px - entry_px) * direction * qty * mult, 2)
    fees = round(qty * rt_fee, 2)
    dur = rng.uniform(8, 25) if kind == "fade" else rng.uniform(3, 40)
    return {
        "date": d, "symbol": sym, "direction": direction, "qty": qty, "kind": kind,
        "entry_min": entry_min, "exit_min": entry_min + dur,
        "entry_px": entry_px, "exit_px": exit_px, "fees": fees, "gross": gross,
        "net": round(gross - fees, 2), "risk": round(qty * stop * mult, 2), "tags": tags,
        "setup": None,
    }


def to_dt(d, minutes, rng):
    m = int(minutes)
    return datetime(d.year, d.month, d.day, m // 60, m % 60, rng.randint(0, 59), tzinfo=TZ)


def generate_days(rng):
    days = trading_days()
    prices = dict(START_PRICE)
    all_days = []
    for di, d in enumerate(days):
        for g in prices:
            prices[g] *= 1 + rng.gauss(0, 0.011)
        forced = di >= len(days) - 5
        if not forced and rng.random() < 0.17:
            continue
        wd = d.weekday()
        mood = weighted(rng, [(1, 7), (2, 20), (3, 38), (4, 25), (5, 10)])
        sleep = max(4.0, min(9.0, round((rng.gauss(6.6 + 0.35 * (mood - 3), 0.9)) * 2) / 2))
        n_target = weighted(rng, [(1, 30), (2, 40), (3, 20), (4, 10)])
        fade_plan = wd == 2 and rng.random() < 0.92
        if fade_plan:
            n_target = max(2, n_target)
        fade_done = False
        trades = []
        last = None
        while len(trades) < n_target:
            kind = "normal"
            prev_loss = last is not None and last["net"] < 0
            if prev_loss and rng.random() < 0.5:
                kind = "revenge"
                entry = last["exit_min"] + rng.uniform(1.5, 9)
            else:
                if last is None:
                    if fade_plan and rng.random() < 0.85:
                        entry = 10 * 60 + 28
                    else:
                        entry = weighted(rng, [((9 * 60, 9 * 60 + 15), 18), ((9 * 60 + 15, 10 * 60 + 30), 50),
                                               ((10 * 60 + 30, 12 * 60), 25), ((12 * 60, 13 * 60 + 30), 7)])
                        entry = rng.uniform(*entry)
                else:
                    entry = last["exit_min"] + rng.uniform(12, 85)
                if fade_plan and not fade_done and entry > 10 * 60 + 20 and (last is None or last["exit_min"] < 10 * 60 + 25):
                    entry = 10 * 60 + 28 + rng.uniform(0, 8)
                    kind = "fade"
                    fade_done = True
            if entry > 14 * 60 + 10:
                break
            t = make_trade(rng, d, entry, kind, len(trades), mood, sleep, prices)
            trades.append(t)
            last = t
            if sum(x["net"] for x in trades) < -800:
                break
        if trades:
            all_days.append({"date": d, "mood": mood, "sleep": sleep, "trades": trades})
    return all_days


def pick_journal_days(rng, all_days):
    tagged = [i for i, dd in enumerate(all_days) if any(t["tags"] for t in dd["trades"])]
    tagged.sort(key=lambda i: -sum(len(t["tags"]) for t in all_days[i]["trades"]))
    chosen = set(tagged[:N_JOURNAL])
    chosen.add(len(all_days) - 1)
    rest = [i for i in range(len(all_days)) if i not in chosen]
    rng.shuffle(rest)
    for i in rest:
        if len(chosen) >= N_JOURNAL:
            break
        chosen.add(i)
    while len(chosen) > N_JOURNAL:
        chosen.remove(sorted(chosen - {len(all_days) - 1}, key=lambda i: sum(len(t["tags"]) for t in all_days[i]["trades"]))[0])
    return chosen


def journal_text(rng, dd, tags, pnl, symbols, has_fade, fade_win):
    mood, sleep = dd["mood"], dd["sleep"]
    parts = [rng.choice(OPENERS[mood]), "Slept about %s hours." % fnum(sleep, 1)]
    mistakes = [t for t in ("moved_stop", "revenge", "oversize", "fomo", "overtrading", "early_exit") if t in tags]
    if has_fade:
        parts.append("The inventory report setup played out like I wrote it down." if fade_win
                     else "Faded the inventory report and it did not work, but the entry was by the book.")
    if mistakes:
        parts.append(MISTAKE_TEXT[mistakes[0]])
    parts.append("Ended %s on %s." % ("green" if pnl > 0 else "red", "/".join(symbols)))
    full = " ".join(parts)
    excerpt = full
    if len(excerpt) > 200:
        excerpt = excerpt[:197].rsplit(" ", 1)[0] + "..."
    if mistakes:
        lesson = LESSONS[mistakes[0]]
    elif pnl > 0:
        lesson = "Waiting for the setup paid; keep doing the boring version."
    else:
        lesson = "The loss was inside the plan. Stop-outs are the cost of doing business."
    return excerpt, lesson


def build_sample(rng):
    all_days = generate_days(rng)
    journaled = pick_journal_days(rng, all_days)
    trades, journal = [], []
    jn = 0
    for di, dd in enumerate(all_days):
        d = dd["date"]
        in_journal = di in journaled
        ids = []
        for t in dd["trades"]:
            if not in_journal:
                t["tags"] = []  # tags come only from what a journal entry says
            t["entry_dt"] = to_dt(d, t["entry_min"], rng)
            t["exit_dt"] = to_dt(d, t["exit_min"], rng)
            if t["exit_dt"] <= t["entry_dt"]:
                t["exit_dt"] = t["entry_dt"] + timedelta(minutes=3)
            t["id"] = hashlib.sha1(("%s|%s|%s|%d" % (ACCOUNT, t["symbol"], t["entry_dt"].isoformat(), t["qty"])).encode()).hexdigest()[:16]
            ids.append(t["id"])
            if t["kind"] == "fade":
                t["setup"] = "inventory report fade"
            elif t["entry_min"] < 9 * 60 + 45:
                t["setup"] = "opening range break"
            else:
                t["setup"] = rng.choice(["VWAP reclaim", "VWAP reclaim", "trend pullback"])
            x = rng.random()
            if in_journal:
                t["risk_source"] = "journal" if x < 0.6 else "broker_stop" if x < 0.8 else None
            else:
                t["risk_source"] = "broker_stop" if x < 0.45 else None
            trades.append(t)
        if in_journal:
            jn += 1
            tags = set(g for t in dd["trades"] for g in t["tags"])
            pnl = sum(t["net"] for t in dd["trades"])
            symbols = []
            for t in dd["trades"]:
                if t["symbol"] not in symbols:
                    symbols.append(t["symbol"])
            fades = [t for t in dd["trades"] if t["kind"] == "fade"]
            excerpt, lesson = journal_text(rng, dd, tags, pnl, symbols, bool(fades), bool(fades) and fades[0]["net"] > 0)
            mistakes = [m for m in ("revenge", "moved_stop", "fomo", "oversize", "early_exit", "overtrading") if m in tags]
            journal.append({
                "id": "sample-j-%03d" % jn, "date": d.isoformat(), "url": None, "linked_trade_ids": ids,
                "symbols": symbols, "setup": dd["trades"][0]["setup"], "mood": dd["mood"],
                "sleep_hours": dd["sleep"], "followed_plan": not (tags & BAD_PLAN_TAGS),
                "mistakes": mistakes, "emotions": EMOTIONS[dd["mood"]] + (["angry"] if "revenge" in tags else []),
                "lesson": lesson, "excerpt": excerpt,
            })
    trades.sort(key=lambda t: t["entry_dt"])
    return trades, journal


def trades_to_rows(trades):
    rows = []
    for t in trades:
        rows.append({
            "trade_id": t["id"], "account": ACCOUNT, "symbol": t["symbol"], "asset_class": "future",
            "side": "long" if t["direction"] > 0 else "short", "qty": str(t["qty"]),
            "entry_time": t["entry_dt"].isoformat(), "exit_time": t["exit_dt"].isoformat(),
            "entry_price": fnum(t["entry_px"]), "exit_price": fnum(t["exit_px"]),
            "fees": fnum(t["fees"], 2), "pnl_gross": fnum(t["gross"], 2), "pnl_net": fnum(t["net"], 2),
            "initial_risk": fnum(t["risk"], 2) if t["risk_source"] else "",
            "risk_source": t["risk_source"] or "", "setup": t["setup"], "tags": "|".join(t["tags"]),
            "source": "sample", "source_ref": "sample-seed-42",
        })
    return rows


# ---- KPI helpers (same formulas as assets/metrics.js) -------------------------------------------

def r_of(row):
    risk = float(row["initial_risk"]) if row["initial_risk"] else DEFAULT_RISK
    return float(row["pnl_net"]) / risk


def kpis(rows):
    pn = [float(r["pnl_net"]) for r in rows]
    wins = [p for p in pn if p > 0]
    losses = [p for p in pn if p < 0]
    rs = [r_of(r) for r in rows]
    w = [x for x in rs if x > 0]
    l = [-x for x in rs if x < 0]
    cum = peak = dd = 0.0
    for p in pn:
        cum += p
        peak = max(peak, cum)
        dd = max(dd, peak - cum)
    n = len(rows)
    gl = -sum(losses)
    return {
        "n": n, "net": round(sum(pn), 2),
        "win_rate": len(wins) / (len(wins) + len(losses)) if wins or losses else None,
        "pf": (sum(wins) / gl) if gl else None,
        "expectancy_r": ((len(w) / n) * (sum(w) / len(w) if w else 0) - (len(l) / n) * (sum(l) / len(l) if l else 0)) if n else None,
        "net_r": sum(rs), "max_dd": round(dd, 2),
    }


def entry_minutes(row):
    dt = datetime.fromisoformat(row["entry_time"])
    return dt.hour * 60 + dt.minute


def confidence(n):
    return "early" if n < 10 else "moderate" if n < 25 else "strong"


def worst_ids(rows, k=12, reverse=False):
    return [r["trade_id"] for r in sorted(rows, key=lambda r: float(r["pnl_net"]), reverse=reverse)[:k]]


def journal_ids_for(rows, journal):
    want = {r["trade_id"] for r in rows}
    return [j["id"] for j in journal if want & set(j["linked_trade_ids"])][:12]


def build_insights(rows, journal):
    insights = []
    rev = [r for r in rows if "revenge" in r["tags"].split("|")]
    k = kpis(rev)
    insights.append((abs(k["net"]), {
        "title": "Revenge trades after a loss cost you %.1fR over %d trades" % (abs(k["net_r"]), k["n"]),
        "evidence": {"trade_ids": worst_ids(rev), "journal_ids": journal_ids_for(rev, journal), "n": k["n"]},
        "confidence": confidence(k["n"]),
        "suggestion": "After a stop-out, step away for 15 minutes and re-read your plan before the next entry.",
    }))
    mon = [r for r in rows if datetime.fromisoformat(r["entry_time"]).weekday() == 0]
    oth = [r for r in rows if datetime.fromisoformat(r["entry_time"]).weekday() != 0]
    km, ko = kpis(mon), kpis(oth)
    insights.append((abs(km["net"]), {
        "title": "Mondays are your weakest day: %.2fR per trade over %d trades, against %.2fR on Tuesday to Friday"
                 % (km["net_r"] / km["n"], km["n"], ko["net_r"] / ko["n"]),
        "evidence": {"trade_ids": worst_ids(mon), "journal_ids": journal_ids_for(mon, journal), "n": km["n"]},
        "confidence": confidence(km["n"]),
        "suggestion": "Cap Mondays at two trades at half size, or treat them as an observe-and-plan session.",
    }))
    fade = [r for r in rows if r["setup"] == "inventory report fade"]
    kf = kpis(fade)
    insights.append((abs(kf["net"]), {
        "title": "Your Wednesday inventory report fade averages %+.2fR over %d trades (win rate %d%%)"
                 % (kf["expectancy_r"], kf["n"], round(100 * kf["win_rate"])),
        "evidence": {"trade_ids": worst_ids(fade, reverse=True), "journal_ids": journal_ids_for(fade, journal), "n": kf["n"]},
        "confidence": confidence(kf["n"]),
        "suggestion": "Keep this setup at full planned size, and write down what makes the good ones good.",
    }))
    first = [r for r in rows if entry_minutes(r) < 9 * 60 + 15]
    later = [r for r in rows if entry_minutes(r) >= 9 * 60 + 15]
    k1, k2 = kpis(first), kpis(later)
    insights.append((abs(k1["net"]), {
        "title": "Entries in the first 15 minutes average %+.2fR against %+.2fR for the rest of the session"
                 % (k1["expectancy_r"], k2["expectancy_r"]),
        "evidence": {"trade_ids": worst_ids(first), "journal_ids": journal_ids_for(first, journal), "n": k1["n"]},
        "confidence": confidence(k1["n"]),
        "suggestion": "Watch the first 15 minutes without entering; take your first trade at 09:15 or later.",
    }))
    moved = [r for r in rows if "moved_stop" in r["tags"].split("|")]
    km2 = kpis(moved)
    other_losses = [r_of(r) for r in rows if "moved_stop" not in r["tags"].split("|") and float(r["pnl_net"]) < 0]
    avg_other = -sum(other_losses) / len(other_losses)
    avg_moved = -km2["net_r"] / km2["n"]
    insights.append((abs(km2["net"]), {
        "title": "Moved stops turn a %.1fR loss into %.1fR on average (%d trades, %s)"
                 % (avg_other, avg_moved, km2["n"], "-$%d" % round(-km2["net"])),
        "evidence": {"trade_ids": worst_ids(moved), "journal_ids": journal_ids_for(moved, journal), "n": km2["n"]},
        "confidence": confidence(km2["n"]),
        "suggestion": "Set the stop at entry and only ever move it toward profit.",
    }))
    insights.sort(key=lambda x: -x[0])
    return [i for _, i in insights]


def build_brief(rows, journal):
    ymd = {}
    for r in rows:
        ymd.setdefault(r["exit_time"][:10], []).append(r)
    y = kpis(ymd.get("2026-11-13", []))
    week = [r for k, v in ymd.items() if "2026-11-09" <= k <= "2026-11-13" for r in v]
    wk = kpis(week)
    cum = peak = 0.0
    for r in sorted(rows, key=lambda r: r["exit_time"]):
        cum += float(r["pnl_net"])
        peak = max(peak, cum)
    cushion = 2000 - (peak - cum)
    md = (
        "**Yesterday (Fri 13 Nov):** %d trades, %s, %d of them winners.\n\n"
        "**Week so far:** %d trades, %s, win rate %d%%.\n\n"
        "**Limits for the next session (Mon 16 Nov):** max loss $500 a day (prop limit $1,000), 4 trades, "
        "stop after 2 losses in a row. Trailing drawdown cushion: $%s of $2,000.\n\n"
        "**Focus rule:** After a loss, wait 15 minutes before the next entry.\n\n"
        "**Market context (sample, not live):**\n"
        "- 08:30 ET US economic data window\n"
        "- 10:30 ET EIA petroleum status report (Wed)\n"
        "- 10:30 ET EIA natural gas storage report (Thu)\n\n"
        "**Watchlist notes:** CL: wait for the 09:30 range before entering. GC: watch the prior day high. "
        "NG: only if the setup is clean; it has been choppy.\n\n"
        "**Reflection:** Mondays have been your weakest day. What would a good, boring Monday look like?\n\n"
        "*Sample data: synthetic, for demonstration only.*"
    ) % (
        y["n"], money(y["net"]), sum(1 for r in ymd.get("2026-11-13", []) if float(r["pnl_net"]) > 0),
        wk["n"], money(wk["net"]), round(100 * wk["win_rate"]) if wk["win_rate"] is not None else 0,
        format(int(round(cushion)), ","),
    )
    return {"date": "2026-11-14", "markdown": md}


def money(x):
    return ("+$%s" if x >= 0 else "-$%s") % format(int(round(abs(x))), ",")


def write_json(path, obj):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def make(root):
    rng = random.Random(42)
    trades, journal = build_sample(rng)
    rows = trades_to_rows(trades)
    out = os.path.join(root, "data", "sample")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "trades.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=build_data.TRADE_COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    write_json(os.path.join(out, "journal.json"), journal)
    insights_list = build_insights(rows, journal)
    insights = {
        "generated": "2026-11-14T07:31:00-05:00",
        "focus_rule": "After a loss, wait 15 minutes before the next entry",
        "insights": insights_list,
        "brief": build_brief(rows, journal),
    }
    write_json(os.path.join(out, "insights.json"), insights)
    write_json(os.path.join(out, "profile.json"), PROFILE)
    build_data.build(root, sample=True, updated="2026-11-14T07:31:00-05:00")
    return rows, journal, insights


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    a = ap.parse_args(argv)
    rows, journal, insights = make(os.path.abspath(a.root))
    k = kpis(rows)
    print("sample: %d trades, %d journal entries; net %.2f, win rate %.1f%%, PF %.2f, expectancy %.3fR, max DD %.2f"
          % (k["n"], len(journal), k["net"], 100 * k["win_rate"], k["pf"], k["expectancy_r"], k["max_dd"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
