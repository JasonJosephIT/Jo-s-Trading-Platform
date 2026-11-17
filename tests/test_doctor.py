import json
import os
import shutil
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import doctor  # noqa: E402


def make_folder():
    tmp = tempfile.mkdtemp()
    for d in ["data", "config", "inbox", "archive", "briefs"]:
        os.makedirs(os.path.join(tmp, d))
    shutil.copy(os.path.join(ROOT, "config/profile.example.json"), os.path.join(tmp, "config/profile.example.json"))
    with open(os.path.join(tmp, "data/trades.csv"), "w") as f:
        f.write("trade_id,account,symbol\n")
    with open(os.path.join(tmp, "data/data.js"), "w") as f:
        f.write("window.TC_DATA = null;\n")
    return tmp


class DoctorTests(unittest.TestCase):
    def setUp(self):
        self.root = make_folder()
        self.addCleanup(shutil.rmtree, self.root)

    def test_fresh_download_starts_at_step_one(self):
        r = doctor.check(self.root)
        self.assertFalse(r["set_up"])
        self.assertEqual(r["next"]["step"], "config")
        self.assertEqual(r["next"]["number"], 1)
        self.assertEqual(r["next"]["of"], len(doctor.STEPS))
        self.assertEqual(r["trades"]["count"], 0)

    def test_resumes_at_first_pending_step(self):
        state = {"steps": {"config": {"status": "done"}, "toolkit": {"status": "done"}, "extras": {"status": "skipped"}}}
        with open(os.path.join(self.root, "config/setup-state.json"), "w") as f:
            json.dump(state, f)
        r = doctor.check(self.root)
        self.assertEqual(r["next"]["step"], "trades")
        self.assertEqual(r["next"]["number"], 4)

    def test_mark_records_step_and_note(self):
        doctor.mark(self.root, "config", "done", "copied example files")
        state = json.load(open(os.path.join(self.root, "config/setup-state.json")))
        self.assertEqual(state["steps"]["config"]["status"], "done")
        self.assertEqual(state["steps"]["config"]["note"], "copied example files")
        with self.assertRaises(ValueError):
            doctor.mark(self.root, "nope", "done")
        with self.assertRaises(ValueError):
            doctor.mark(self.root, "config", "finished")

    def test_inbox_files_and_stale_data_are_reported(self):
        with open(os.path.join(self.root, "inbox/export.csv"), "w") as f:
            f.write("a,b\n1,2\n")
        open(os.path.join(self.root, "inbox/.gitkeep"), "w").close()
        r = doctor.check(self.root)
        self.assertEqual(r["inbox"], ["export.csv"])
        self.assertTrue(any("inbox" in w for w in r["warnings"]))

    def test_all_steps_done_means_set_up_and_daily_mode(self):
        doctor.mark(self.root, "config", "done")
        for s in doctor.STEPS:
            doctor.mark(self.root, s["id"], "done")
        r = doctor.check(self.root)
        self.assertTrue(r["set_up"])
        self.assertEqual(r["next"]["step"], None)

    def test_only_waiting_steps_left_means_ready_for_daily_use(self):
        waiting = {"journal", "schedules", "notion_brief"}
        for s in doctor.STEPS:
            doctor.mark(self.root, s["id"], "in_progress" if s["id"] in waiting else "done")
        r = doctor.check(self.root)
        self.assertFalse(r["set_up"])
        self.assertTrue(r["ready"])
        self.assertEqual([w["step"] for w in r["waiting"]], ["journal", "schedules", "notion_brief"])
        self.assertIn("Ready for daily use", doctor.report(r))

    def test_last_exit_is_shown_short(self):
        with open(os.path.join(self.root, "data/trades.csv"), "w") as f:
            f.write("trade_id,account,symbol,exit_time\nt1,A,CL,2026-11-16T10:40:27-05:00\n")
        self.assertIn("last trade 2026-11-16 10:40", doctor.report(doctor.check(self.root)))


if __name__ == "__main__":
    unittest.main()
