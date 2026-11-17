"""The public repo must ship empty data templates only. Fails if personal data was committed."""
import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent


def tracked(path):
    out = subprocess.run(["git", "ls-files", "--error-unmatch", path], cwd=ROOT, capture_output=True)
    return out.returncode == 0


def committed(path):
    return subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, capture_output=True, text=True).stdout


class TestNoPersonalData(unittest.TestCase):
    def setUp(self):
        inside = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True)
        if inside.returncode != 0:
            self.skipTest("not a git checkout with commits")

    def test_trades_template_is_header_only(self):
        if tracked("data/trades.csv"):
            lines = [l for l in committed("data/trades.csv").splitlines() if l.strip()]
            self.assertEqual(len(lines), 1, "data/trades.csv in git must be the header row only")

    def test_journal_and_insights_templates_are_empty(self):
        if tracked("data/journal.json"):
            self.assertEqual(json.loads(committed("data/journal.json")), [])
        if tracked("data/insights.json"):
            self.assertEqual(json.loads(committed("data/insights.json")), {})

    def test_data_js_template_is_null(self):
        if tracked("data/data.js"):
            self.assertIn("window.TC_DATA = null", committed("data/data.js"))

    def test_no_personal_config_or_inbox_files(self):
        files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
        for f in files:
            if f.startswith("config/"):
                self.assertIn(".example.", f, f"{f} looks like personal config")
            if f.startswith(("inbox/", "archive/", "briefs/")):
                self.assertTrue(f.endswith(".gitkeep"), f"{f} should not be in git")


if __name__ == "__main__":
    unittest.main()
