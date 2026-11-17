# v2 plan: Trading Coach as one Claude Artifact

Status: draft for review (2026-11-17). Build in a new session.

## Goal
Her whole Trading Coach lives at one private claude.ai link she can open on her phone or Mac:
1. **Hello screen + setup** ("Hello, Jo. Let's set up your trading workstation."), iPhone-onboarding style.
2. **Dashboard**: the existing dashboard, unchanged in look, reading data Claude stores in the page.
3. **Status** (like AO's harness settings): each connector connected or not, and when the morning run last worked.

A Claude Code scheduled task on her Mac still does the work each morning (trades, journal, insights, brief) and writes the result into the Artifact.

## Decisions (2026-11-17)
- Privacy change accepted: her trades, journal summary and insights live in the Artifact's database on claude.ai (private to her account), as well as in the folder.
- Scheduling stays a Claude Code scheduled task (her Mac).
- The dashboard is the existing `dashboard.html`, published as an Artifact. No redesign.
- Ponytail: reuse what exists; borrow open-source patterns, not servers.

## Current state → target
| Piece | Today | v2 |
|---|---|---|
| Setup | `setup.html` (GitHub Pages) → she copies a prompt with YAML into Claude | Same wizard published as an Artifact; answers saved in the page's db; Claude reads them with `ArtifactData`. No copy-paste. |
| Dashboard | Double-click `dashboard.html`, reads `data/data.js` | Same page published as an Artifact; reads one db doc holding the same payload `build_data.py` already makes |
| Status | `python3 scripts/doctor.py` (only Claude sees it) | Status tab: live connector checks + last-run heartbeat |
| Morning run | Writes `data/data.js` + brief | Same, plus one `ArtifactData` write of the payload and a heartbeat doc |

## Approach (reuse first)
**Setup page.** Publish the existing Vite single-file build (`setup.html`, ~690 KB, under the 16 MB limit). Add one intro screen ("Hello, Jo" in big type, gold CTA). Replace the final "copy this prompt" screen with a db write (`setup/answers`, the same YAML shape as JSON). CLAUDE.md SETUP reads that doc instead of pasted YAML. Keep the GitHub Pages version as the fallback.

**Dashboard.** Inline `assets/*` and Chart.js into one HTML file at publish time (a ~20-line build step). Replace `<script src="data/data.js">` with a loader: `await claude.use("db")`, read doc `tc/data`, set `window.TC_DATA`, then run `dashboard.js`. Nothing else in the dashboard changes. `?demo=1` keeps working with the sample.

**Status tab** (the AO-settings idea). Nothing open source can see her claude.ai connectors, since they sit behind her own sign-in. Only two things can, and we use both:
1. *Live check in the page*: the `mcp` capability calls one harmless read tool per connector (Notion search, NinjaTrader `my_portfolio`, Google Calendar list). Result: Connected / Not connected / Needs sign-in. The manifest lists only read tools, so the page can never place an order.
2. *Heartbeat from the scheduled run*, the Healthchecks.io / Gatus "push" pattern: each morning run writes `status/last_run` with time, per-source ok/failed, and `doctor.py --json` output. The page shows "Last update 07:31 ✓ · next tomorrow 07:30" and turns amber when the run is overdue.
Look borrowed from Upptime / Gatus status pages: one row per service, a coloured dot, "checked 2 min ago", a strip of the last 14 runs.

## Borrowed vs rejected
| Option | Use? | Why |
|---|---|---|
| Upptime / Gatus status-page layout | Borrow the pattern | Proven, simple rows + history strip; we draw it ourselves in ~100 lines |
| Healthchecks.io / Gatus push heartbeat | Borrow the pattern | Morning run "checks in"; the page flags a missed check-in |
| `mcp-server-health-monitor` (npm, single-file HTML dashboard) | Look at its HTML only | It checks MCP servers by `list_tools`; ours are claude.ai connectors it can't reach. Check licence before copying markup. |
| Uptime Kuma / Gatus / Upptime as running software | No | Needs a server or GitHub Actions and can't see her connectors |
| Native Mac app (like Open Thoughts) | No | More to build, no phone view |

## Build tickets (new session)
1. **Spike, ~1 h.** Publish a throwaway Artifact with `db` + `mcp`. Prove: (a) `ArtifactData` can write a 100–500 KB doc (sample `data.js` is 96 KB); (b) the page can call a Notion read tool; (c) a *custom* connector (NinjaTrader MCP, added by link) is reachable through `mcp`; (d) a Claude Code scheduled task can call `ArtifactData`. Each answer decides a ticket below.
2. **Dashboard Artifact, ~3 h.** Inline build script, db loader, publish flow, MORNING_UPDATE writes `tc/data`. Done when her dashboard link shows today's numbers on a phone.
3. **Status tab, ~3 h.** Heartbeat doc written by MORNING_UPDATE; live checks; rows + history strip. Done when disconnecting Notion turns its row red.
4. **Hello setup Artifact, ~3 h.** Intro screen, answers saved to db, CLAUDE.md SETUP reads them. Done when a blind test runs setup with no copy-paste.
5. **Blind test, ~1 h.** Same two-part test as 2026-11-17, plus the phone view.

## Risks and open questions
- **Who publishes.** Her own Claude should publish the Artifact, so she owns it and her connectors answer. Jason can't preview her data unless she shares it.
- **db size cap** isn't stated in the type definitions; if 90 days of trades don't fit one doc, split into `trades/<month>` docs.
- **Custom connectors through `mcp`** (NinjaTrader) are unconfirmed; if they don't work, NinjaTrader's row reports from the heartbeat only.
- **Scheduled task writes.** If a scheduled run can't call `ArtifactData`, fall back to the run publishing a new Artifact version with the data embedded (the `artifact` capability pattern).
- **Offline.** The folder keeps `dashboard.html` + `data.js`, so a local copy always works.
