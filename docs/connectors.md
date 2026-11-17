# Connectors and second options

Generated from `catalog/tools.json` (checked 2026-11-17). Edit the catalog, then run `node scripts/gen_connectors.mjs`.
"Unconfirmed" means a detail couldn't be verified on an official page that day; Claude re-checks it during setup.

## How to add a connector in Claude

- **From the directory:** Customize > Connectors, then click the + next to Connectors and browse the directory (or from a chat: + > Connectors > Manage connectors > +). Then click Connect/Install and sign in. Some broker docs still say 'Settings > Connectors'; the current Anthropic path is Customize > Connectors.
- **By link (custom connector):** For a service not in the directory: Customize > Connectors > Add > Custom > Web, paste the server's remote MCP URL, then Connect and sign in in the browser. Custom connectors run from Anthropic's cloud, so never paste a remote URL into claude_desktop_config.json. Free plan: one custom connector. Local (stdio) servers such as tastytrade's need a developer-style setup.
- **Scheduled tasks:** Available on all paid plans (Pro, Max, Ultra, Team, Enterprise). Create: click Scheduled in the left sidebar > New task > Create with Claude or Set up manually (name, prompt, approval mode, frequency hourly/daily/weekdays/weekly/manual, optional model and folder), or just describe the task in a chat. A task with a local folder / 'Require this computer' (or 'Only on this computer') runs only while the computer is awake and Claude Desktop is open; tasks without a folder run remotely on schedule. Missed runs (local): when the app opens or the computer wakes, Desktop runs ONE catch-up for the most recent missed time and discards older ones (7-day window), so a 9am task can run at 11pm. Connector tools need a lasting approval ('Allow for all scheduled runs' in Cowork / 'Always allow' in Code) or the run stalls waiting for a click. Minimum interval is 1 hour in the forms. Open bug reports exist about dropped Cowork scheduled runs, so check the task's History page.
- **Keep it running:** Settings > This computer > System: turn on 'Keep computer awake' (the computer will not idle-sleep while Claude Desktop is open; closing a laptop lid still sleeps it) and 'Run on startup' (Claude Desktop opens at login). Claude Code docs also name the page 'Settings > Desktop app'. Known bugs: Windows 'Run on startup' may not stick; macOS keep-awake may also keep the display on.
- **Turning off individual tools:** Yes, but documented for Team and Enterprise only: Customize > Connectors > select the connector > Tool permissions groups tools (read-only vs write/delete) and lets an Owner set each category or tool to Always allow, Needs approval or Blocked, org-wide. Anthropic's help article does not say whether individual Pro/Max users get the same panel; not confirmed. Safest default for a read-only coach: connect only read-only connectors, leave order-capable connectors disconnected, and keep approvals on 'Needs approval'.

The assistant only ever uses read tools, whatever a connector offers.

## Trading platforms and brokers

| App | How it works with Claude | Connector | Export help | Status |
|---|---|---|---|---|
| Interactive Brokers | Claude directory connector | [Interactive Brokers (IBKR)](https://claude.com/marketplace/connectors/interactive-brokers) | [how to export](https://www.interactivebrokers.com/campus/trading-lessons/client-portal-reporting/) | Checked |
| Webull | Claude directory connector | [Webull](https://claude.com/marketplace/connectors/webull) | [how to export](https://www.webull.com/help/faq/992-How-do-I-get-a-copy-of-my-transaction-history) | Checked |
| Questrade | Claude directory connector | [Questrade](https://claude.com/marketplace/connectors/questrade) | [how to export](https://www.questrade.com/learning/questrade-basics/track-your-account-activity/checking-your-account-activity) | Checked |
| Gemini | Claude directory connector | [Gemini](https://claude.com/marketplace/connectors/gemini-mcp) | — | Checked |
| Alpaca | Developer setup (use export instead) | [Alpaca MCP Server (alpacahq/alpaca-mcp-server)](https://github.com/alpacahq/alpaca-mcp-server) | — | Checked |
| Robinhood | Developer setup (use export instead) | [Robinhood Trading MCP (custom connector)](https://robinhood.com/us/en/support/articles/setting-up-an-agent/) | — | Checked |
| Charles Schwab | Second option | [Schwab MCP server (pilot)](https://pressroom.aboutschwab.com/press-releases/press-release/2026/Schwab-Announces-Platform-Enhancements-Including-MCP-Server-to-Connect-Clients-AI-Platforms-With-Their-Schwab-Accounts/default.aspx) | — | Checked |
| Fidelity | Export file → inbox | — | — | Unconfirmed |
| E*TRADE | Export file → inbox | — | — | Unconfirmed |
| Coinbase | Export file → inbox | — | — | Unconfirmed |
| Kraken | Export file → inbox | — | — | Unconfirmed |
| tastytrade | Developer setup (use export instead) | [tastytrade MCP (self-hosted)](https://developer.tastytrade.com/docs/sdks-and-tools/mcp-server/) | — | Checked |
| Public.com | Claude directory connector | [Public (directory) / custom connector https://mcp.public.com/mcp](https://public.com/api/docs/templates/claude) | — | Checked |
| Tradier | Developer setup (use export instead) | [Tradier MCP (hosted)](https://docs.tradier.com/docs/tradier-mcp) | — | Unconfirmed |
| NinjaTrader / Tradovate | Official connector (add by link) | [NinjaTrader MCP (custom connector)](https://docs.ninjatrader.com/mcp/connect) | [how to export](https://vendor-support.ninjatrader.com/s/article/Tradovate-Account-Reports?language=en_US) | Checked |
| TradeStation | Official connector (add by link) | [TradeStation MCP](https://tradestation.com/platforms-and-tools/mcp/) | [how to export](https://www.tradestation.com/insights/2025/05/20/hub-track-trades-generate-reports/) | Unconfirmed |
| TopstepX / Topstep | Export file → inbox | [page](https://help.topstep.com/en/articles/11187768-topstepx-api-access) | [how to export](https://help.topstep.com/en/articles/14434175-topstepx) | Unconfirmed |
| Apex Trader Funding | Export file → inbox | — | — | Unconfirmed |
| AMP Futures | Export file → inbox | — | — | Unconfirmed |
| Optimus Futures | Export file → inbox | — | — | Unconfirmed |
| Rithmic / R\|Trader Pro | Export file → inbox | — | — | Unconfirmed |
| MetaTrader 4 / 5 | Export file → inbox | — | [how to export](https://www.metatrader5.com/en/terminal/help/trading/report) | Checked |
| Plus500 | Export file → inbox | — | — | Unconfirmed |
| CoinDesk Data & Indices | Claude directory connector | [CoinDesk Data & Indices Connector](https://claude.com/marketplace/connectors/coindesk) | — | Checked |

## Journals

| App | How it works with Claude | Connector | Export help | Status |
|---|---|---|---|---|
| Notion | Claude directory connector | [Notion](https://claude.com/marketplace/connectors/notion) | — | Checked |
| Google Sheets / Docs / Drive | Claude directory connector | [Google Drive](https://claude.com/marketplace/connectors/google-drive) | — | Checked |
| Excel / OneDrive / Microsoft 365 | Claude directory connector | [Microsoft 365](https://claude.com/marketplace/connectors/microsoft-365) | — | Checked |
| Apple Notes | Second option | — | — | Unconfirmed |
| Obsidian | Second option | — | — | Unconfirmed |
| TradeZella | Export file → inbox | — | [how to export](https://help.tradezella.com/en/articles/9725069-how-to-export-data-to-a-csv-file-from-the-trade-log-page) | Checked |
| Tradervue | Export file → inbox | — | — | Unconfirmed |
| Edgewonk | Export file → inbox | — | [how to export](https://edgewonk.com/import) | Unconfirmed |

## Calendars

| App | How it works with Claude | Connector | Export help | Status |
|---|---|---|---|---|
| Google Calendar | Claude directory connector | [Google Calendar](https://claude.com/marketplace/connectors/google-calendar) | — | Checked |
| Microsoft Outlook / 365 Calendar | Claude directory connector | [Microsoft 365](https://claude.com/marketplace/connectors/microsoft-365) | — | Checked |
| Apple iCloud Calendar | Second option | — | — | Unconfirmed |

## Charting

| App | How it works with Claude | Connector | Export help | Status |
|---|---|---|---|---|
| thinkorswim (Schwab) | Export file → inbox | — | [how to export](https://www.schwab.com/learn/story/using-account-statement-on-thinkorswim) | Unconfirmed |
| Sierra Chart | Export file → inbox | — | [how to export](https://www.sierrachart.com/index.php?page=doc%2FTradeActivityLog.php) | Checked |
| TradingView | Export file → inbox | — | [how to export](https://www.tradingview.com/support/solutions/43000663814-how-can-i-download-trading-data/) | Checked |

## News and market data

| App | How it works with Claude | Connector | Export help | Status |
|---|---|---|---|---|
| Alpha Vantage | Claude directory connector | [Alpha Vantage MCP Server](https://claude.com/marketplace/connectors/alpha-vantage) | — | Checked |
| Financial Datasets | Claude directory connector | [Financial Datasets](https://claude.com/marketplace/connectors/financial-datasets) | — | Checked |
| Bigdata.com | Claude directory connector | [Bigdata.com](https://claude.com/marketplace/connectors/bigdata) | — | Checked |
| MT Newswires | Claude directory connector | [MT Newswires](https://claude.com/marketplace/connectors/mt-newswires) | — | Checked |
| Morningstar | Claude directory connector | [Morningstar](https://claude.com/marketplace/connectors/morningstar) | — | Checked |
| FactSet | Claude directory connector | [FactSet](https://claude.com/marketplace/connectors/factset) | — | Checked |
| S&P Global | Claude directory connector | [S&P Global](https://claude.com/marketplace/connectors/s-p-global) | — | Checked |
| Polygon.io / Massive | Developer setup (use export instead) | [Massive MCP (mcp_massive)](https://github.com/massive-com/mcp_massive) | — | Unconfirmed |

## Other

| App | How it works with Claude | Connector | Export help | Status |
|---|---|---|---|---|
| Gmail | Claude directory connector | [Gmail](https://claude.com/marketplace/connectors/gmail) | — | Checked |
| Slack | Claude directory connector | [Slack](https://claude.com/marketplace/connectors/slack) | — | Checked |
| Discord | Second option | — | — | Unconfirmed |

## Second options

- **Platform with no connector:** export your trade history as CSV into `inbox/`. Claude maps the columns once (with a 5-row preview you confirm) and remembers them.
- **Calendar with no connector (Apple Calendar):** Claude writes `trading-events.ics` into the folder; open it once to import.
- **Journal outside Notion:** Obsidian vaults are local files Claude can read; for other apps, drop an export into `inbox/` or start new entries in Notion.
- **Unknown app:** use the "Add a tool" prompt. Claude looks it up and shows you the options with links.

## Market events (for the brief and the calendar)

| Event | When | Markets | Schedule |
|---|---|---|---|
| EIA Weekly Petroleum Status Report | Wednesdays, 10:30 ET | CL, RB, HO, BZ | [official](https://www.eia.gov/petroleum/supply/weekly/schedule.php) |
| EIA Weekly Natural Gas Storage Report | Thursdays. 2026 exceptions: Fri Nov 13 10:30 ET, 10:30 ET | NG | [official](https://ir.eia.gov/ngs/schedule.html) |
| API Weekly Statistical Bulletin (crude inventories) | Tuesdays, about 4:30 pm ET, 16:30 ET | CL, RB, HO | [official](https://www.api.org/energy-insights/statistics/wsb) |
| Baker Hughes North America Rig Count | Fridays, 13:00 ET | CL, NG | [official](https://rigcount.bakerhughes.com/) |
| USDA WASDE (World Agricultural Supply and Demand Estimates) | Monthly. Next: Thu Dec 10 2026, 12:00 ET | ZC, ZS, ZW, CT, SB, LE, HE | [official](https://www.usda.gov/about-usda/general-information/staff-offices/office-chief-economist/commodity-markets/wasde-report) |
| USDA Crop Progress | Mondays during the growing season, 16:00 ET | ZC, ZS, ZW, CT | [official](https://www.nass.usda.gov/Publications/Calendar/) |
| USDA Weekly Export Sales | Thursdays, 08:30 ET | ZC, ZS, ZW, CT, LE | [official](https://www.fas.usda.gov/data/scheduled-reports) |
| USDA Grain Stocks, Acreage and Prospective Plantings | Quarterly Grain Stocks, 12:00 ET | ZC, ZS, ZW | [official](https://www.nass.usda.gov/Publications/Calendar/) (unconfirmed) |
| CFTC Commitments of Traders (COT) | Fridays, 15:30 ET | all futures markets | [official](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm) |
| FOMC interest rate decision | 8 meetings a year. Next: Dec 8-9 2026, 14:00 ET | ES, NQ, GC, CL, 6E | [official](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) |
| Consumer Price Index (CPI) | Monthly, usually mid-month. Nov 10 2026 was the October release. The December date was not on the page checked, 08:30 ET | ES, NQ, GC, ZN | [official](https://www.bls.gov/schedule/news_release/cpi.htm) |
| Producer Price Index (PPI) | Monthly. Nov 13 2026 was the October release. The December date was not on the page checked., 08:30 ET | ES, NQ, GC, ZN | [official](https://www.bls.gov/schedule/news_release/ppi.htm) |
| Employment Situation (Non-Farm Payrolls) | Monthly, usually the first Friday. Next: Fri Dec 4 2026, 08:30 ET | ES, NQ, GC, CL, 6E | [official](https://www.bls.gov/schedule/news_release/empsit.htm) |
| GDP (advance, second and third estimates) | Quarterly. Q3 2026 second estimate Wed Nov 25, 08:30 ET | ES, NQ, GC | [official](https://www.bea.gov/news/schedule) |
| Personal Income and Outlays (PCE inflation) | Monthly. Wed Nov 25 2026, 08:30 ET | ES, NQ, GC, ZN | [official](https://www.bea.gov/news/schedule) |
| ISM Manufacturing PMI | First business day of the month. Next: Tue Dec 1 2026, 10:00 ET | ES, NQ, HG, CL | [official](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/) |
| OPEC+ meetings | Irregular. A monthly meeting of the eight-country group and periodic full ministerial meetings | CL, BZ | [official](https://www.opec.org/meetings-and-events.html) (unconfirmed) |
| China trade data (commodity imports) | Monthly preliminary data, usually in the second week of the month | CL, HG, ZS | [official](http://english.customs.gov.cn/) (unconfirmed) |
