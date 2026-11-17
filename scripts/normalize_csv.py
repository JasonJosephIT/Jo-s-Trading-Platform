#!/usr/bin/env python3
"""Normalize a raw broker CSV into data/trades.csv round-trip rows.

Usage:
  python3 scripts/normalize_csv.py inbox/file.csv --mapping config/csv-mapping.json \
      --out data/trades.csv [--account NAME] [--timezone America/New_York]

Fills are matched FIFO into round trips: one trade per entry lot that is fully closed
(scaling in gives one trade per entry fill; scaling out averages the exit price; a
flip closes the old lot and opens a new one). Entry lots still open (or only partly
closed) are not written; they are counted as "unmatched open fills".
Existing rows in --out are never deleted; new rows are appended, deduped by trade_id.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
from collections import deque
from datetime import datetime
from zoneinfo import ZoneInfo

HEADER = ["trade_id", "account", "symbol", "asset_class", "side", "qty", "entry_time", "exit_time",
          "entry_price", "exit_price", "fees", "pnl_gross", "pnl_net", "initial_risk", "risk_source",
          "setup", "tags", "source", "source_ref"]

# Dollars per 1.0 point of price, by futures root symbol. Override or extend in the mapping's "multipliers".
MULTIPLIERS = {
    "CL": 1000, "MCL": 100, "QM": 500, "BZ": 1000, "NG": 10000, "QG": 2500, "RB": 42000, "HO": 42000,
    "GC": 100, "MGC": 10, "SI": 5000, "SIL": 1000, "HG": 25000, "MHG": 2500, "PL": 50,
    "ES": 50, "MES": 5, "NQ": 20, "MNQ": 2, "YM": 5, "MYM": 0.5, "RTY": 50, "M2K": 5,
    "ZC": 50, "ZS": 50, "ZW": 50, "ZM": 100, "ZL": 600, "KE": 50,
    "ZB": 1000, "ZN": 1000, "ZF": 1000, "ZT": 2000, "6E": 125000, "6B": 62500, "6J": 12500000,
}
MONTH_CODES = "FGHJKMNQUVXZ"
BUY_WORDS = ["b", "buy", "bot", "bought", "long", "buy to open", "buy to close"]
SELL_WORDS = ["s", "sell", "sld", "sold", "short", "sell to open", "sell to close"]


class MappingError(Exception):
    pass


def load_mapping(path):
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    presets = raw.get("presets", {})
    name = raw.get("preset")
    mapping = {}
    if name:
        if name not in presets:
            raise MappingError("preset %r not found in %s (have: %s)" % (name, path, ", ".join(sorted(presets))))
        mapping.update(presets[name])
    for k, v in raw.items():
        if k in ("presets", "preset") or k.startswith("_"):
            continue
        mapping[k] = v
    return mapping


def parse_num(s):
    if s is None:
        return None
    s = str(s).strip()
    if s == "":
        return None
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg, s = True, s[1:-1]
    s = s.replace("$", "").replace(",", "").replace(" ", "")
    if s.endswith("-"):
        neg, s = True, s[:-1]
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v


def num(x):
    """Format a number compactly: no trailing zeros, no '-0'."""
    s = ("%.8f" % x).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def parse_time(s, fmt, tz, strip_rx=None):
    s = (s or "").strip()
    if strip_rx:
        s = re.sub(strip_rx, "", s).strip()
    if not s:
        return None
    if fmt in (None, "", "iso"):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    elif fmt == "epoch_ms":
        dt = datetime.fromtimestamp(float(s) / 1000.0, ZoneInfo(tz))
    else:
        dt = datetime.strptime(s, fmt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(tz))
    return dt.replace(microsecond=0)


def root_of(symbol, table):
    s = re.split(r"[\s:]", symbol.strip().upper().lstrip("/@."))[0]
    for r in sorted(table, key=len, reverse=True):
        if s.startswith(r) and re.fullmatch(r"([%s]\d{1,4})?" % MONTH_CODES, s[len(r):]):
            return r
    m = re.fullmatch(r"([A-Z0-9]+?)[%s]\d{1,2}" % MONTH_CODES, s)
    return m.group(1) if m else s


def make_trade_id(account, symbol, entry_time, qty):
    key = "%s|%s|%s|%s" % (account, symbol, entry_time, num(qty))
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def read_rows(path, mapping):
    with open(path, encoding="utf-8-sig", newline="") as f:
        text = f.read()
    lines = text.splitlines()
    need = mapping.get("header_row_contains")
    if need:
        start = None
        for i, line in enumerate(lines):
            cells = [c.strip() for c in next(csv.reader([line]))] if line.strip() else []
            if all(n in cells for n in need):
                start = i
                break
        if start is None:
            raise MappingError("could not find a header row containing %s in %s" % (need, path))
        block = []
        for line in lines[start:]:
            if not line.strip() and block:
                break
            block.append(line)
        lines = block
    reader = csv.reader(lines)
    header = None
    rows = []
    for raw in reader:
        if header is None:
            header = [h.strip() for h in raw]
            continue
        if not any(c.strip() for c in raw):
            continue
        rows.append({header[i]: raw[i].strip() for i in range(min(len(header), len(raw)))})
    if header is None:
        raise MappingError("%s is empty" % path)
    flt = mapping.get("row_filter") or {}
    for col, allowed in flt.items():
        allowed = [a.lower() for a in allowed]
        rows = [r for r in rows if r.get(col, "").lower() in allowed]
    return header, rows


def col(row, header, mapping, field, required=True):
    name = (mapping.get("columns") or {}).get(field)
    if not name:
        if required:
            raise MappingError("mapping.columns.%s is not set" % field)
        return None
    if name not in header:
        if required:
            raise MappingError("column %r (for %s) not found; the file has: %s" % (name, field, ", ".join(header)))
        return None
    return row.get(name, "")


def side_of(value, mapping):
    sv = mapping.get("side_values") or {}
    buys = [b.lower() for b in sv.get("buy", BUY_WORDS)]
    sells = [b.lower() for b in sv.get("sell", SELL_WORDS)]
    v = (value or "").strip().lower()
    if v in buys:
        return 1
    if v in sells:
        return -1
    raise MappingError("unrecognised side value %r (set mapping.side_values)" % value)


class Ctx:
    def __init__(self, mapping, account_override, tz_override, source_file):
        self.mapping = mapping
        self.tz = tz_override or mapping.get("timezone") or "UTC"
        self.account_override = account_override
        self.table = dict(MULTIPLIERS)
        self.table.update({k.upper(): v for k, v in (mapping.get("multipliers") or {}).items()})
        self.asset_class = mapping.get("asset_class", "future")
        self.source = mapping.get("source", "csv:generic")
        self.fee_per_unit = float(mapping.get("fee_per_unit_per_side") or 0)
        self.source_file = os.path.basename(source_file)

    def instrument(self, symbol, row_asset_class=None):
        ac = row_asset_class or self.asset_class
        if ac == "future":
            r = root_of(symbol, self.table)
            return r, ac, float(self.table.get(r, 1))
        mult = float(self.table.get(symbol.upper(), 100 if ac == "option" else 1))
        return symbol.strip().upper(), ac, mult

    def row_asset_class(self, row, header):
        v = col(row, header, self.mapping, "asset_class", required=False)
        if v:
            return (self.mapping.get("asset_class_values") or {}).get(v.upper(), self.asset_class)
        return None

    def account(self, row, header):
        if self.account_override:
            return self.account_override
        return col(row, header, self.mapping, "account", required=False) or self.mapping.get("account") or "default"

    def time(self, s):
        return parse_time(s, self.mapping.get("date_format"), self.tz, self.mapping.get("time_strip_regex"))


def trade_row(ctx, account, symbol, asset_class, mult, direction, qty, t_in, t_out, p_in, p_out, fees, ref,
              pnl_gross=None):
    if pnl_gross is None:
        pnl_gross = (p_out - p_in) * direction * qty * mult
    pnl_net = pnl_gross - fees
    entry_iso, exit_iso = t_in.isoformat(), t_out.isoformat()
    return {
        "trade_id": make_trade_id(account, symbol, entry_iso, qty),
        "account": account, "symbol": symbol, "asset_class": asset_class,
        "side": "long" if direction > 0 else "short", "qty": num(qty),
        "entry_time": entry_iso, "exit_time": exit_iso,
        "entry_price": num(p_in), "exit_price": num(p_out), "fees": num(fees),
        "pnl_gross": num(pnl_gross), "pnl_net": num(pnl_net),
        "initial_risk": "", "risk_source": "", "setup": "", "tags": "",
        "source": ctx.source, "source_ref": ref or ctx.source_file,
    }


def from_round_trips(rows, header, ctx):
    m = ctx.mapping
    out = []
    for i, row in enumerate(rows, start=2):
        where = "row %d" % i
        try:
            account = ctx.account(row, header)
            symbol, ac, mult = ctx.instrument(col(row, header, m, "symbol"), ctx.row_asset_class(row, header))
            qty = abs(parse_num(col(row, header, m, "qty")))
            if (m.get("columns") or {}).get("buy_time"):
                tb = ctx.time(col(row, header, m, "buy_time"))
                ts = ctx.time(col(row, header, m, "sell_time"))
                pb = parse_num(col(row, header, m, "buy_price"))
                ps = parse_num(col(row, header, m, "sell_price"))
                if tb <= ts:
                    direction, t_in, t_out, p_in, p_out = 1, tb, ts, pb, ps
                else:
                    direction, t_in, t_out, p_in, p_out = -1, ts, tb, ps, pb
            else:
                direction = side_of(col(row, header, m, "side"), m)
                t_in = ctx.time(col(row, header, m, "entry_time"))
                t_out = ctx.time(col(row, header, m, "exit_time"))
                p_in = parse_num(col(row, header, m, "entry_price"))
                p_out = parse_num(col(row, header, m, "exit_price"))
            fee = parse_num(col(row, header, m, "fees", required=False))
            if fee is None:
                fee = ctx.fee_per_unit * qty * 2
            gross = parse_num(col(row, header, m, "pnl_gross", required=False))
            ref = col(row, header, m, "order_id", required=False)
            if None in (qty, t_in, t_out, p_in, p_out):
                raise MappingError("missing quantity, time or price")
        except MappingError:
            raise
        except (ValueError, TypeError) as e:
            raise MappingError("%s: cannot parse (%s)" % (where, e))
        out.append(trade_row(ctx, account, symbol, ac, mult, direction, qty, t_in, t_out, p_in, p_out,
                             abs(fee), ref, gross))
    return out, 0


class Lot:
    def __init__(self, direction, qty, price, time, fee_unit, ref):
        self.direction, self.qty, self.remaining = direction, qty, qty
        self.price, self.time, self.fee_unit, self.ref = price, time, fee_unit, ref
        self.pieces = []  # (qty, price, time, fee)


def parse_fills(rows, header, ctx):
    m = ctx.mapping
    fills = []
    for i, row in enumerate(rows, start=2):
        try:
            symbol, ac, mult = ctx.instrument(col(row, header, m, "symbol"), ctx.row_asset_class(row, header))
            qty_raw = parse_num(col(row, header, m, "qty"))
            side_col = (m.get("columns") or {}).get("side")
            if side_col:
                direction = side_of(col(row, header, m, "side"), m)
            else:
                direction = 1 if qty_raw > 0 else -1
            qty = abs(qty_raw)
            price = parse_num(col(row, header, m, "price"))
            when = ctx.time(col(row, header, m, "time"))
            fee = parse_num(col(row, header, m, "fees", required=False))
            if fee is None:
                fee = ctx.fee_per_unit * qty
            if None in (qty_raw, price, when) or qty == 0:
                raise MappingError("missing quantity, price or time")
        except MappingError as e:
            raise MappingError("row %d: %s" % (i, e))
        except (ValueError, TypeError) as e:
            raise MappingError("row %d: cannot parse (%s)" % (i, e))
        fills.append({"account": ctx.account(row, header), "symbol": symbol, "ac": ac, "mult": mult,
                      "dir": direction, "qty": qty, "price": price, "time": when, "fee": abs(fee),
                      "ref": col(row, header, m, "order_id", required=False), "seq": i})
    return fills


def merge_same_time(fills):
    """Partial fills of one order share a timestamp: combine them (VWAP price, summed qty and fees)."""
    merged = {}
    order = []
    for f in fills:
        k = (f["account"], f["symbol"], f["time"], f["dir"])
        if k not in merged:
            merged[k] = dict(f)
            order.append(k)
        else:
            g = merged[k]
            tot = g["qty"] + f["qty"]
            g["price"] = (g["price"] * g["qty"] + f["price"] * f["qty"]) / tot
            g["qty"], g["fee"] = tot, g["fee"] + f["fee"]
    return [merged[k] for k in order]


def from_fills(rows, header, ctx):
    fills = merge_same_time(parse_fills(rows, header, ctx))
    fills.sort(key=lambda f: (f["time"], f["seq"]))
    books = {}
    closed = []
    meta = {}
    for f in fills:
        key = (f["account"], f["symbol"])
        meta[key] = (f["ac"], f["mult"])
        book = books.setdefault(key, deque())
        remaining = f["qty"]
        fee_unit = f["fee"] / f["qty"]
        while remaining > 1e-12 and book and book[0].direction == -f["dir"]:
            lot = book[0]
            take = min(remaining, lot.remaining)
            lot.pieces.append((take, f["price"], f["time"], fee_unit * take))
            lot.remaining -= take
            remaining -= take
            if lot.remaining <= 1e-12:
                book.popleft()
                closed.append((key, lot))
        if remaining > 1e-12:
            book.append(Lot(f["dir"], remaining, f["price"], f["time"], fee_unit, f["ref"]))
    out = []
    for key, lot in closed:
        ac, mult = meta[key]
        qty = lot.qty
        exit_price = sum(q * p for q, p, _, _ in lot.pieces) / qty
        exit_time = max(t for _, _, t, _ in lot.pieces)
        fees = lot.fee_unit * qty + sum(fee for _, _, _, fee in lot.pieces)
        out.append(trade_row(ctx, key[0], key[1], ac, mult, lot.direction, qty, lot.time, exit_time,
                             lot.price, exit_price, fees, lot.ref))
    out.sort(key=lambda r: (r["entry_time"], r["trade_id"]))
    unmatched = sum(len(b) for b in books.values())
    return out, unmatched


def time_key(row):
    try:
        return datetime.fromisoformat(row.get("entry_time", ""))
    except ValueError:
        return datetime.min.replace(tzinfo=ZoneInfo("UTC"))


def merge_into(out_path, new_rows):
    existing = []
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        with open(out_path, encoding="utf-8", newline="") as f:
            existing = list(csv.DictReader(f))
    seen = {r.get("trade_id") for r in existing}
    added = skipped = 0
    for r in new_rows:
        if r["trade_id"] in seen:
            skipped += 1
            continue
        seen.add(r["trade_id"])
        existing.append(r)
        added += 1
    existing.sort(key=time_key)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADER, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        for r in existing:
            w.writerow({k: r.get(k, "") or "" for k in HEADER})
    os.replace(tmp, out_path)
    return added, skipped


def normalize(csv_path, mapping, out_path, account=None, timezone=None):
    ctx = Ctx(mapping, account, timezone, csv_path)
    header, rows = read_rows(csv_path, mapping)
    kind = mapping.get("kind", "round_trips")
    if kind == "fills":
        trades, unmatched = from_fills(rows, header, ctx)
    elif kind == "round_trips":
        trades, unmatched = from_round_trips(rows, header, ctx)
    else:
        raise MappingError("mapping.kind must be 'fills' or 'round_trips', got %r" % kind)
    added, skipped = merge_into(out_path, trades)
    return added, skipped, unmatched


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("csv")
    ap.add_argument("--mapping", default="config/csv-mapping.json")
    ap.add_argument("--out", default="data/trades.csv")
    ap.add_argument("--account")
    ap.add_argument("--timezone")
    a = ap.parse_args(argv)
    try:
        mapping = load_mapping(a.mapping)
        added, skipped, unmatched = normalize(a.csv, mapping, a.out, a.account, a.timezone)
    except (MappingError, OSError, json.JSONDecodeError) as e:
        print("error: %s" % e, file=sys.stderr)
        return 2
    print("added %d, skipped %d duplicates, unmatched open fills %d" % (added, skipped, unmatched))
    return 0


if __name__ == "__main__":
    sys.exit(main())
