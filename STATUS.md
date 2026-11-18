---
status: active
progress: v1 published and blind-tested twice; setup link ready to send
next_date: 2026-11-18
updated: 2026-11-17
---

# Trading Assistant status

## Now
- Live 2026-11-17: https://jasonjosephit.github.io/Jo-s-Trading-Platform/setup.html and /dashboard.html?demo=1 (repo JasonJosephIT/Jo-s-Trading-Platform, Pages from main root).
- v1 built: setup wizard (`setup.html` from `wizard/`, React + shadcn/ui, iPhone-style onboarding, royal purple → black with gold trim), dashboard, data scripts, CLAUDE.md, prompts, catalog, docs.
- 2026-11-17: dashboard is liquid metal too, with a Bible verse and a quote of the day at the top, chosen for what her journal says. Checked at phone width in Chromium; not checked in Safari.


## Next
1. Send her the setup link (ready 2026-11-17): https://jasonjosephit.github.io/Jo-s-Trading-Platform/setup.html?name=Jo ; collect her answers to: which platform, Notion database or pages.
2. v2 is parked: `docs/v2-plan.md` is notes her Claude follows only if she asks (CLAUDE.md points to it).
3. Verify the unverified CSV presets (Tradovate, NinjaTrader, thinkorswim, IBKR Flex, Webull) against a real export once she drops one in `inbox/`.
4. Test the Notion journal flow against her real journal shape (this build was dry-run on synthetic data only; the session's Notion connector could only view pages).

## Decisions
- 2026-11-17 — A Bible verse sits above the quote, picked the same way: her Claude writes `insights.verse` each morning for the theme her recent entries point to; otherwise the dashboard shows a built-in verse for that theme (`VERSE_THEMES` in `assets/dashboard.js`, New International Version 2011, all 20 checked word for word against biblegateway.com on 2026-11-17, some trimmed to a full clause; Biblica's NIV credit line is in the dashboard footer, as their free-use terms require). Never about wealth or prosperity.
- 2026-11-17 — The quote at the top of the dashboard is an inspiring quote (real, correctly attributed, never about money) chosen for what her recent journal entries say: her Claude picks it each morning into `insights.quote` (CLAUDE.md "Quote of the day"); without it the dashboard reads her last 7 days of entries (mistakes, emotions, mood, sleep, plan followed), picks a theme (patience, composure, courage, discipline, rest, resilience, steady) and shows a built-in quote for it (`QUOTE_THEMES` in `assets/dashboard.js`). Her own words are not quoted back to her there.
- 2026-11-17 — Dashboard is liquid metal, CSS only (no WebGL shader: it has no build step and must work from `file://`). `assets/theme.css` carries the setup page's tokens (`--metal` flowing gold, `--metal-rim` conic rim, `--glass-sheen`); `.gold-trim` panels now get the metal rim and a glass sheen; wordmark, gold buttons, demo ribbon, range chips, insight numbers and the prop progress bar are polished metal; flowing stops for reduced motion. Chart colours unchanged. A quote of the day sits under the brand: one quiet italic line, process not money, from 7 sourced quotes in `assets/dashboard.js` (Durant, Seneca, Franklin, Frost, Hemingway, Alcott, T. Roosevelt), same quote all day.
- 2026-11-17 — She has a Mac: the setup page no longer asks (and step 1 "About you" is gone; the name field shows on the welcome screen only when the link has no `?name=`). Everything is "liquid metal": "Hello, Jo." and the logo use Paper Shaders' `LiquidMetal` WebGL effect (Apache-2.0, `@paper-design/shaders-react@0.0.82`) coloured gold with a CSS sepia filter, falling back to the static gold text without WebGL2 and holding still for reduced motion; buttons, chips, checks and progress use a flowing metallic-gold gradient; glass cards get a polished metal rim.
- 2026-11-17 — She already has Claude: setup step 1 is now "About you" (computer + name); the paid-plan and Claude Desktop checks are gone.
- 2026-11-17 — Renamed to **Trading Assistant** everywhere she sees it (setup page, dashboard, CLAUDE.md, prompts, docs, her folder `~/Documents/Trading Assistant`); plugin and marketplace ids are now `trading-assistant`. Repo name and internal slugs unchanged.
- 2026-11-17 — Setup page uses a CSS-only Liquid Glass look (frosted translucent cards, light rims, specular sheen, gold glass buttons, glass segmented control and chips; falls back to solid for reduced transparency / more contrast). No SVG refraction filters (Chromium-only; she likely uses Safari). "Hello, Jo." is set in Great Vibes script (bundled, works offline) with a left-to-right write-in.
- 2026-11-17 — The Duet skill ships as a plugin, `trading-assistant`, with this repo as its marketplace (`trading-assistant`). Her Claude installs it in setup step 11 with two pre-allowed `claude plugin` commands (no clicks if her permission option is accept-all); `.plugin` file fallback for Cowork. Whether Duet picks up plugins is untested; skill-upload fallback in `duet/README.md`.
- 2026-11-17 — Claude Duet slot: Duet has no hooks and can't read the folder, but loads account skills, memory and connectors, so `duet/` holds a `trading-assistant` skill (nudges: brief missing, before the open, `[Mkt]` report coming, limits, journal after the session; read-only, no trade calls) plus a first message to paste. Untested until she has Duet access.
- 2026-11-17 — v2 parked; ship v1. The setup link greets her by name with `?name=Jo` ("Hello, Jo. Let's set up your trading workstation."). Sample insights cite up to 12 example trades while `n` counts all; documented in contracts.md, not a bug.
- 2026-11-17 — v2 direction: setup, dashboard and a connector Status tab live in one private Claude Artifact; her data may live in the Artifact's db on claude.ai (privacy change accepted). The morning run stays a Claude Code scheduled task. Ponytail: reuse the wizard and dashboard; borrow Upptime/Gatus status rows and the Healthchecks push heartbeat; no servers. Plan: `docs/v2-plan.md` / `.html`.
- 2026-11-17 — Second blind test (fresh chat setup, stop at trades, resume) passed end to end: 10 trades imported, dashboard built, .ics written. Fixes: one default export per platform (Tradovate → Performance), NT8 is Windows-only so Mac users get Tradovate steps, full-mapping rule for rewritten CSV mappings, extra chat questions (Notion shape, brief page, calendar events), event picking matches the setup page, steps waiting on her no longer block (doctor shows "Ready for daily use"), no jargon to her.
- 2026-11-17 — Published to Jason's existing public repo `Jo-s-Trading-Platform` instead of a new `trading-assistant` repo; unzip folder is `Jo-s-Trading-Platform-main`, renamed to `Trading Assistant`.
- 2026-11-17 — Wizard is React + shadcn/ui (Radix, Nova preset) + Tailwind v4, built to one self-contained `setup.html` (vite-plugin-singlefile) so it works on GitHub Pages and `file://`. Dashboard stays vanilla JS + vendored Chart.js (fixed layout, Claude never edits it).
- 2026-11-17 — Look: dark default, royal purple (#6a35c2) fading to near-black (#07040d), gold (#dcb64f) as trim and CTA; light mode is ivory with royal ink. P&L uses a colourblind-safe green/orange pair plus ▲/▼ and signs.
- 2026-11-17 — Onboarding feels like an iPhone app: one step per screen, segmented progress bar, back chevron + edge swipe, grouped lists, segmented controls, sticky gold CTA, bottom-sheet step list.
- 2026-11-17 — Added a "What do you use?" step: she picks her platform, journal, calendar, charts and news apps; each is checked against `catalog/tools.json` and gets a second option if it can't connect. Unknown apps go to `tools.to_research`, which her Claude looks up during setup and confirms with her.
- 2026-11-17 — Calendar extra: Claude puts scheduled market events (EIA, USDA, CFTC, Fed, BLS…) on Google/Outlook via connector, or writes an `.ics` file for Apple Calendar.
- 2026-11-17 — Futures default: NinjaTrader/Tradovate has an official MCP connector added by link (not in the directory); wizard tells her to grant read-only access.
- 2026-11-17 — Added prompt 08 "Add a tool" and an ADD_TOOL flow so new apps get the same connector-or-second-option check later.

## Open items / waiting on
- Not tested in Safari or Edge (Chromium only).
- Her platform is unknown; the wizard handles it.
- Per-tool connector toggles are documented for Team/Enterprise only; unconfirmed for Pro/Max.
- Unconfirmed in catalog: several futures-platform export pages, OPEC+ dates, China customs timing, USDA Grain Stocks/Acreage dates.

## Idea Shelf
- A real native iOS shell (SwiftUI WebView around setup.html + dashboard) if she wants it on her home screen.
