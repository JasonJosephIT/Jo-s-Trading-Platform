import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import insights_stats  # noqa: E402


class InsightsStatsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = insights_stats.compute(ROOT, sample=True)

    def test_overall_matches_sample_headline(self):
        o = self.s["overall"]
        self.assertEqual(o["n"], 153)
        self.assertAlmostEqual(o["net"], 4201.8, places=1)

    def test_groups_carry_evidence_and_confidence(self):
        for g in self.s["by_setup"]:
            self.assertEqual(len(g["trade_ids"]), g["n"])
            self.assertIn(g["confidence"], ("early", "moderate", "strong"))

    def test_finds_the_baked_in_patterns(self):
        best = max(self.s["by_setup"], key=lambda g: g["avg_r"] if g["avg_r"] is not None else -99)
        self.assertEqual(best["key"], "inventory report fade")
        self.assertLess(self.s["after_loss_10min"]["net"], 0)
        worst_tag = self.s["by_tag"][0]
        self.assertLess(worst_tag["net"], 0)
        days = {g["key"]: g for g in self.s["by_weekday"]}
        self.assertLess(days["Mon"]["net"], days["Wed"]["net"])

    def test_journal_dependent_sections_say_when_missing(self):
        s = insights_stats.compute_from(self.s["_trades"], [], {"timezone": "America/New_York", "default_risk_per_trade": 100,
                                                                  "session": {"start": "09:00"}})
        self.assertEqual(s["by_mood"], [])
        self.assertIn("journal", " ".join(s["notes"]))


if __name__ == "__main__":
    unittest.main()
