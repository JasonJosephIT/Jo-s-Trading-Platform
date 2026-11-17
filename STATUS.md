---
status: active
progress: v1 published; her setup pending
next_date: 2026-11-18
updated: 2026-11-17
---

# Trading Coach status

## Now
- Live 2026-11-17: https://jasonjosephit.github.io/Jo-s-Trading-Platform/setup.html and /dashboard.html?demo=1 (repo JasonJosephIT/Jo-s-Trading-Platform, Pages from main root).
- v1 built: setup wizard (`setup.html` from `wizard/`, React + shadcn/ui, iPhone-style onboarding, royal purple → black with gold trim), dashboard, data scripts, CLAUDE.md, prompts, catalog, docs.

## Handoff (2026-11-17, context limit)
Done this session, committed locally (last pushed commit is `30035c8`; push the rest):
- Self-guided setup for her Claude: `scripts/doctor.py` (11 setup steps, `--mark`, resumable via `config/setup-state.json`), `scripts/insights_stats.py` (pattern numbers with evidence), CLAUDE.md "Start here" + first-message templates + app-style guidance rules + 15-question no-wizard script + Cowork vs Claude Code + fixes from a blind test, README "For Claude: start here", `.claude/commands/*` and `.claude/settings.json` (generated/allowed), `config/wizard-answers.example.yaml`, prompt `continue-setup`, setup page resume note. All tests pass (node 20, python OK).
- The blind-test fixes (second commit) may still be uncommitted: run `git status` first.
Next for the new session:
1. `cd ~/Projects/trading-coach && git status`; commit anything pending; `cd wizard && npm run build` if `wizard/src` changed after the last build; run `node --test` and `python3 -m unittest discover -s tests`; `git push`.
2. Second blind test (not yet run): copy the folder (minus wizard/.git) to the scratchpad, have a fresh sonnet agent play her Claude with only "hi, set up my trading coach" (NinjaTrader, crude+gold futures, prop account, Notion, Google Calendar, Mac, NY, answers in chat), stop partway, then resume with "continue my setup". Fix any gaps it reports in CLAUDE.md.
3. Then send her the setup link.
Don't redo: the dashboard, wizard, research catalog, data scripts or the first blind test.

## Next
1. Send her the setup link; collect her answers to: which platform, Mac or Windows, Notion database or pages.
2. Verify the unverified CSV presets (Tradovate, NinjaTrader, thinkorswim, IBKR Flex, Webull) against a real export once she drops one in `inbox/`.
3. Test the Notion journal flow against her real journal shape (this build was dry-run on synthetic data only; the session's Notion connector could only view pages).

## Decisions
- 2026-11-17 — Published to Jason's existing public repo `Jo-s-Trading-Platform` instead of a new `trading-coach` repo; unzip folder is `Jo-s-Trading-Platform-main`, renamed to `Trading Coach`.
- 2026-11-17 — Wizard is React + shadcn/ui (Radix, Nova preset) + Tailwind v4, built to one self-contained `setup.html` (vite-plugin-singlefile) so it works on GitHub Pages and `file://`. Dashboard stays vanilla JS + vendored Chart.js (fixed layout, Claude never edits it).
- 2026-11-17 — Look: dark default, royal purple (#6a35c2) fading to near-black (#07040d), gold (#dcb64f) as trim and CTA; light mode is ivory with royal ink. P&L uses a colourblind-safe green/orange pair plus ▲/▼ and signs.
- 2026-11-17 — Onboarding feels like an iPhone app: one step per screen, segmented progress bar, back chevron + edge swipe, grouped lists, segmented controls, sticky gold CTA, bottom-sheet step list.
- 2026-11-17 — Added a "What do you use?" step: she picks her platform, journal, calendar, charts and news apps; each is checked against `catalog/tools.json` and gets a second option if it can't connect. Unknown apps go to `tools.to_research`, which her Claude looks up during setup and confirms with her.
- 2026-11-17 — Calendar extra: Claude puts scheduled market events (EIA, USDA, CFTC, Fed, BLS…) on Google/Outlook via connector, or writes an `.ics` file for Apple Calendar.
- 2026-11-17 — Futures default: NinjaTrader/Tradovate has an official MCP connector added by link (not in the directory); wizard tells her to grant read-only access.
- 2026-11-17 — Added prompt 08 "Add a tool" and an ADD_TOOL flow so new apps get the same connector-or-second-option check later.

## Open items / waiting on
- Not tested in Safari or Edge (Chromium only).
- Sample insights list slightly fewer trade ids than their `n` (e.g. n 13, 12 ids).
- Her platform is unknown; the wizard handles it.
- Per-tool connector toggles are documented for Team/Enterprise only; unconfirmed for Pro/Max.
- Unconfirmed in catalog: several futures-platform export pages, OPEC+ dates, China customs timing, USDA Grain Stocks/Acreage dates.

## Idea Shelf
- A real native iOS shell (SwiftUI WebView around setup.html + dashboard) if she wants it on her home screen.
