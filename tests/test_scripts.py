import csv
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_data  # noqa: E402
import make_sample  # noqa: E402
import normalize_csv  # noqa: E402

FILL_MAPPING = {
    "kind": "fills", "asset_class": "future", "date_format": "iso", "timezone": "America/New_York",
    "source": "csv:test",
    "columns": {"account": "acct", "symbol": "sym", "side": "side", "qty": "qty", "price": "px",
                "time": "time", "fees": "fee", "order_id": "id"},
}


def write_csv(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def read_trades(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


class NormalizeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        self.out = os.path.join(self.tmp, "data", "trades.csv")

    def run_fills(self, rows, mapping=None, name="fills.csv"):
        src = os.path.join(self.tmp, name)
        write_csv(src, ["acct", "sym", "side", "qty", "px", "time", "fee", "id"], rows)
        return normalize_csv.normalize(src, mapping or FILL_MAPPING, self.out)

    def test_fifo_partial_fills_and_multiplier(self):
        # buy 3 CLZ6 @60.00, sell 1 @60.10 then sell 2 @60.40 -> one long trade, qty 3, exit vwap 60.30
        rows = [
            ["A1", "CLZ6", "Buy", "3", "60.00", "2026-11-16T09:42:10-05:00", "6.30", "f1"],
            ["A1", "CLZ6", "Sell", "1", "60.10", "2026-11-16T09:50:00-05:00", "2.10", "f2"],
            ["A1", "CLZ6", "Sell", "2", "60.40", "2026-11-16T09:55:00-05:00", "4.20", "f3"],
        ]
        added, skipped, unmatched = self.run_fills(rows)
        self.assertEqual((added, skipped, unmatched), (1, 0, 0))
        t = read_trades(self.out)[0]
        self.assertEqual(t["symbol"], "CL")
        self.assertEqual(t["side"], "long")
        self.assertEqual(t["qty"], "3")
        self.assertEqual(t["exit_price"], "60.3")
        self.assertEqual(t["exit_time"], "2026-11-16T09:55:00-05:00")
        self.assertEqual(t["fees"], "12.6")
        self.assertEqual(t["pnl_gross"], "900")  # (60.30-60.00) * 3 * 1000
        self.assertEqual(t["pnl_net"], "887.4")
        expect = hashlib.sha1("A1|CL|2026-11-16T09:42:10-05:00|3".encode()).hexdigest()[:16]
        self.assertEqual(t["trade_id"], expect)
        self.assertEqual(t["source"], "csv:test")

    def test_scaling_in_makes_one_trade_per_entry_fill(self):
        rows = [
            ["A1", "MES", "Buy", "1", "5000", "2026-11-16T10:00:00-05:00", "0", ""],
            ["A1", "MES", "Buy", "1", "5002", "2026-11-16T10:05:00-05:00", "0", ""],
            ["A1", "MES", "Sell", "2", "5004", "2026-11-16T10:20:00-05:00", "0", ""],
        ]
        self.run_fills(rows)
        trades = read_trades(self.out)
        self.assertEqual(len(trades), 2)
        self.assertEqual([t["pnl_gross"] for t in trades], ["20", "10"])  # 4*5 and 2*5

    def test_flip_long_to_short_and_unmatched(self):
        rows = [
            ["A1", "GC", "Buy", "2", "4000.0", "2026-11-16T10:00:00-05:00", "0", ""],
            ["A1", "GC", "Sell", "5", "4001.0", "2026-11-16T10:10:00-05:00", "0", ""],   # closes 2, opens short 3
            ["A1", "GC", "Buy", "2", "3999.0", "2026-11-16T10:30:00-05:00", "0", ""],    # closes 2 of the short
        ]
        added, skipped, unmatched = self.run_fills(rows)
        trades = read_trades(self.out)
        self.assertEqual(added, 1)  # the short lot is only partly closed -> not written
        self.assertEqual(unmatched, 1)
        self.assertEqual(trades[0]["side"], "long")
        self.assertEqual(trades[0]["pnl_gross"], "200")  # 1.0 * 2 * 100

    def test_flip_fully_closed_short(self):
        rows = [
            ["A1", "GC", "Buy", "2", "4000.0", "2026-11-16T10:00:00-05:00", "0", ""],
            ["A1", "GC", "Sell", "5", "4001.0", "2026-11-16T10:10:00-05:00", "0", ""],
            ["A1", "GC", "Buy", "3", "3999.0", "2026-11-16T10:30:00-05:00", "0", ""],
        ]
        added, _, unmatched = self.run_fills(rows)
        self.assertEqual((added, unmatched), (2, 0))
        short = [t for t in read_trades(self.out) if t["side"] == "short"][0]
        self.assertEqual(short["qty"], "3")
        self.assertEqual(short["pnl_gross"], "600")  # (4001-3999) * 3 * 100

    def test_naive_times_use_timezone_and_dst(self):
        m = dict(FILL_MAPPING, date_format="%m/%d/%Y %H:%M:%S")
        rows = [
            ["A1", "NG", "Sell", "1", "3.000", "07/15/2026 10:00:00", "0", ""],
            ["A1", "NG", "Buy", "1", "2.990", "07/15/2026 10:10:00", "0", ""],
        ]
        self.run_fills(rows, m)
        t = read_trades(self.out)[0]
        self.assertEqual(t["entry_time"], "2026-07-15T10:00:00-04:00")
        self.assertEqual(t["pnl_gross"], "100")  # 0.010 * 10000

    def test_dedupe_on_rerun_and_never_deletes(self):
        rows = [
            ["A1", "MCL", "Buy", "1", "60.00", "2026-11-16T09:42:10-05:00", "0", ""],
            ["A1", "MCL", "Sell", "1", "60.20", "2026-11-16T09:50:00-05:00", "0", ""],
        ]
        self.assertEqual(self.run_fills(rows), (1, 0, 0))
        self.assertEqual(self.run_fills(rows), (0, 1, 0))
        self.assertEqual(len(read_trades(self.out)), 1)
        more = rows + [
            ["A1", "MCL", "Sell", "1", "60.50", "2026-11-17T09:42:10-05:00", "0", ""],
            ["A1", "MCL", "Buy", "1", "60.40", "2026-11-17T09:50:00-05:00", "0", ""],
        ]
        self.assertEqual(self.run_fills(more), (1, 1, 0))
        self.assertEqual(len(read_trades(self.out)), 2)

    def test_existing_rows_preserved(self):
        os.makedirs(os.path.dirname(self.out))
        row = {c: "" for c in normalize_csv.HEADER}
        row.update(trade_id="keepme", account="X", symbol="ES", side="long", setup="mine")
        with open(self.out, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=normalize_csv.HEADER)
            w.writeheader()
            w.writerow(row)
        self.run_fills([["A1", "MES", "Buy", "1", "5000", "2026-11-16T10:00:00-05:00", "0", ""],
                        ["A1", "MES", "Sell", "1", "5001", "2026-11-16T10:05:00-05:00", "0", ""]])
        ids = [t["trade_id"] for t in read_trades(self.out)]
        self.assertIn("keepme", ids)
        self.assertEqual(len(ids), 2)

    def test_round_trip_preset_from_example_mapping(self):
        mapping = normalize_csv.load_mapping(os.path.join(ROOT, "config", "csv-mapping.example.json"))
        self.assertEqual(mapping["kind"], "round_trips")
        src = os.path.join(self.tmp, "rt.csv")
        write_csv(src, ["account", "symbol", "side", "qty", "entry_time", "exit_time", "entry_price", "exit_price", "fees"],
                  [["A1", "CLZ6", "short", "2", "2026-11-16T09:42:10-05:00", "2026-11-16T09:50:10-05:00", "60.50", "60.30", "8.4"]])
        normalize_csv.normalize(src, mapping, self.out)
        t = read_trades(self.out)[0]
        self.assertEqual(t["pnl_gross"], "400")
        self.assertEqual(t["pnl_net"], "391.6")

    def test_cli_prints_summary(self):
        src = os.path.join(self.tmp, "f.csv")
        write_csv(src, ["acct", "sym", "side", "qty", "px", "time", "fee", "id"],
                  [["A1", "ES", "Buy", "1", "5000", "2026-11-16T10:00:00-05:00", "0", ""]])
        mp = os.path.join(self.tmp, "m.json")
        with open(mp, "w") as f:
            json.dump(FILL_MAPPING, f)
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "normalize_csv.py"), src, "--mapping", mp,
                            "--out", self.out], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.strip(), "added 0, skipped 0 duplicates, unmatched open fills 1")


class BuildDataTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp)
        os.makedirs(os.path.join(self.tmp, "data"))
        os.makedirs(os.path.join(self.tmp, "config"))
        shutil.copy(os.path.join(ROOT, "config", "profile.example.json"), os.path.join(self.tmp, "config"))
        self.trades = os.path.join(self.tmp, "data", "trades.csv")

    def write_trade(self, **over):
        row = {c: "" for c in build_data.TRADE_COLUMNS}
        row.update(trade_id="abc123", account="A", symbol="CL", asset_class="future", side="long", qty="1",
                   entry_time="2026-11-16T09:42:10-05:00", exit_time="2026-11-16T09:50:00-05:00",
                   entry_price="60", exit_price="60.1", fees="2", pnl_gross="100", pnl_net="98",
                   tags="fomo|moved_stop", source="sample")
        row.update(over)
        with open(self.trades, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=build_data.TRADE_COLUMNS)
            w.writeheader()
            w.writerow(row)

    def test_valid_build(self):
        self.write_trade()
        path, payload = build_data.build(self.tmp)
        with open(path) as f:
            text = f.read()
        self.assertTrue(text.startswith("window.TC_DATA = {"))
        self.assertTrue(text.rstrip().endswith("};"))
        t = payload["trades"][0]
        self.assertEqual(t["pnl_net"], 98)
        self.assertIsNone(t["initial_risk"])
        self.assertEqual(t["tags"], ["fomo", "moved_stop"])
        self.assertEqual(payload["journal"], [])
        self.assertEqual(payload["insights"], {})
        self.assertEqual(payload["profile"]["timezone"], "America/New_York")
        self.assertNotIn("notion", payload["profile"])
        self.assertIn("updated", payload)

    def test_empty_trades_header_only(self):
        with open(self.trades, "w") as f:
            f.write(",".join(build_data.TRADE_COLUMNS) + "\n")
        _, payload = build_data.build(self.tmp)
        self.assertEqual(payload["trades"], [])

    def test_quote_validation(self):
        self.write_trade()
        ins_path = os.path.join(self.tmp, "data", "insights.json")
        good = {"insights": [], "quote": {"text": "Well begun is half done.", "by": "Aristotle", "theme": "patience"},
                "verse": {"text": "Rest in the LORD, and wait patiently for him.", "ref": "Psalm 37:7 (KJV)", "theme": "patience"}}
        with open(ins_path, "w") as f:
            json.dump(good, f)
        _, payload = build_data.build(self.tmp)
        self.assertEqual(payload["insights"]["quote"]["by"], "Aristotle")
        good["quote"].pop("by")
        with open(ins_path, "w") as f:
            json.dump(good, f)
        with self.assertRaises(build_data.ValidationError) as ctx:
            build_data.build(self.tmp)
        self.assertIn("quote needs 'by'", str(ctx.exception))

    def test_validation_error_names_row_and_field(self):
        self.write_trade(side="buy")
        with self.assertRaises(build_data.ValidationError) as cm:
            build_data.build(self.tmp)
        msg = str(cm.exception)
        self.assertIn("row 2", msg)
        self.assertIn("trade_id abc123", msg)
        self.assertIn("field 'side' must be long|short, got 'buy'", msg)

    def test_cli_exit_code_and_no_write_on_error(self):
        self.write_trade(entry_time="2026-11-16 09:42")
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_data.py"), "--root", self.tmp],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertIn("field 'entry_time' must be ISO 8601 with an offset", r.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "data", "data.js")))

    def test_risk_source_required_with_risk(self):
        self.write_trade(initial_risk="100", risk_source="")
        with self.assertRaises(build_data.ValidationError) as cm:
            build_data.build(self.tmp)
        self.assertIn("field 'risk_source'", str(cm.exception))


class SampleTests(unittest.TestCase):
    def test_deterministic(self):
        a, b = tempfile.mkdtemp(), tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, a)
        self.addCleanup(shutil.rmtree, b)
        make_sample.make(a)
        make_sample.make(b)
        for name in ["trades.csv", "journal.json", "insights.json", "profile.json", "data.js"]:
            with open(os.path.join(a, "data", "sample", name), "rb") as f1, open(os.path.join(b, "data", "sample", name), "rb") as f2:
                self.assertEqual(f1.read(), f2.read(), name)

    def test_committed_sample_matches_generator(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        make_sample.make(d)
        for name in ["trades.csv", "data.js"]:
            with open(os.path.join(d, "data", "sample", name), "rb") as f1, open(os.path.join(ROOT, "data", "sample", name), "rb") as f2:
                self.assertEqual(f1.read(), f2.read(), name + " is stale; rerun scripts/make_sample.py")

    def test_sample_shape_and_kpi_sanity(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        rows, journal, insights = make_sample.make(d)
        k = make_sample.kpis(rows)
        self.assertTrue(130 <= k["n"] <= 175, k["n"])
        self.assertTrue(0.40 <= k["win_rate"] <= 0.60, k["win_rate"])
        self.assertTrue(1.05 <= k["pf"] <= 2.0, k["pf"])
        self.assertTrue(0.05 <= k["expectancy_r"] <= 0.6, k["expectancy_r"])
        self.assertTrue(0 < k["max_dd"] < 2500, k["max_dd"])
        self.assertEqual(len(journal), 60)
        self.assertTrue(all(len(j["excerpt"]) <= 200 and j["url"] is None for j in journal))
        self.assertEqual(len(insights["insights"]), 5)
        self.assertLess(len(insights["brief"]["markdown"].split()), 250)
        self.assertEqual({r["risk_source"] for r in rows}, {"journal", "broker_stop", ""})
        self.assertTrue(all(r["account"] == "DEMO-SIM (synthetic)" and r["source"] == "sample" for r in rows))
        self.assertTrue(max(r["exit_time"] for r in rows).startswith("2026-11-13"))
        # baked-in patterns
        mon = [r for r in rows if __import__("datetime").datetime.fromisoformat(r["entry_time"]).weekday() == 0]
        self.assertLess(make_sample.kpis(mon)["net"], 0)
        fade = [r for r in rows if r["setup"] == "inventory report fade"]
        self.assertGreater(make_sample.kpis(fade)["expectancy_r"], 0.5)
        rev = [r for r in rows if "revenge" in r["tags"]]
        self.assertLess(make_sample.kpis(rev)["net"], 0)


if __name__ == "__main__":
    unittest.main()
