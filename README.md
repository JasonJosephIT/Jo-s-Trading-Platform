# Trading Coach

Turns Claude into your trading-journal dashboard and morning coach. You keep journaling in Notion; Claude pulls in your trades, links them to what you wrote, and every trading morning gives you a short brief and an up-to-date dashboard.

**[Start the setup →](https://jasonjosephit.github.io/trading-coach/setup.html)** · **[See the demo dashboard →](https://jasonjosephit.github.io/trading-coach/dashboard.html?demo=1)**

![Demo dashboard](docs/screenshots/dashboard-desktop-dark.png)

## Quick start (about 20 minutes, no terminal)

1. **Open the setup** link above. It walks you through every step page by page, like setting up a new app: what you trade, which apps you use (it checks each one works with Claude and lines up a second option if not), your risk rules, and connecting Notion and your trading platform.
2. **Download this folder** (the setup gives you the button), unzip it into Documents and name it `Trading Coach`.
3. **Paste one prompt into Claude Desktop** with that folder selected. Claude asks a few questions, imports your history, builds your dashboard and schedules the daily update.

You need a paid Claude plan and [Claude Desktop](https://claude.com/download).

## What you get

- **Morning brief** before the open: yesterday, your limits, today's focus, scheduled reports with times (EIA, USDA, CFTC, Fed, CPI…), one journal question. In the dashboard and, if you like, on a Notion page for your phone.
- **Dashboard** with win rate, profit factor, expectancy, drawdown, a P&L calendar, best setups, timing, a leak map of what mistakes cost you, and mood/sleep vs results. Prop/funded accounts also get daily-loss and trailing-drawdown gauges.
- **Insights from your own journal**, each with the evidence and sample size behind it.
- **Optional:** market events added to your calendar, quotes and news via Alpha Vantage.

## Works with

Notion (journal) plus your trading platform through a Claude connector where one exists (Interactive Brokers, Webull, Questrade, Gemini, Public; NinjaTrader/Tradovate by link) or a CSV export from any other platform. Full list with links: [docs/connectors.md](docs/connectors.md).

## Privacy

Your data stays on your computer and in your Notion. This public repo contains only empty templates and made-up sample data. The coach is read-only with your platform and never places or suggests trades. See [docs/privacy.md](docs/privacy.md).

*Educational/journaling tool. Not investment advice.*

---

## For maintainers

| Path | |
|---|---|
| `setup.html` | Built from `wizard/` (React + shadcn/ui + Tailwind, single-file build). `cd wizard && npm install && npm run build`. |
| `wizard/src/components/ios/` | iPhone-style onboarding components (nav bar, step progress, grouped lists, segmented control, bottom CTA, copy blocks) on top of shadcn/ui. |
| `dashboard.html`, `assets/` | Vanilla dashboard, works offline on `file://`. Chart.js vendored. |
| `CLAUDE.md` | The operating manual her Claude follows. |
| `prompts/prompts.json` | Single source for every prompt; `node scripts/gen_prompts.mjs` writes `prompts/*.md`, and the wizard imports the JSON. |
| `catalog/` | Researched connector/export catalog and market-event schedule. `node scripts/gen_connectors.mjs` writes `docs/connectors.md`. |
| `scripts/` | `normalize_csv.py`, `build_data.py`, `make_sample.py` (stdlib Python 3.9+). |

Tests: `node --test` and `python3 -m unittest discover -s tests`. Brand: royal purple → black gradients with gold trim (`assets/theme.css`, `wizard/src/index.css`).
