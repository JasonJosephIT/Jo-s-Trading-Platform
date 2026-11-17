# Data contracts

Every file in `data/` and `config/` follows these shapes. Claude, the scripts and the dashboard all rely on them. `null` beats a guess.

## `data/trades.csv`: one row per round-trip trade

```
trade_id,account,symbol,asset_class,side,qty,entry_time,exit_time,entry_price,exit_price,fees,pnl_gross,pnl_net,initial_risk,risk_source,setup,tags,source,source_ref
```

- Times are ISO 8601 with offset (`2026-11-16T09:42:10-05:00`).
- `side`: `long` | `short`.
- `asset_class`: `stock` | `option` | `future` | `crypto` | `forex` | `other`.
- `initial_risk`: dollars at risk at entry (positive number) or empty.
- `risk_source`: `journal` | `broker_stop` | `default` (empty when `initial_risk` is empty).
- `tags`: pipe-separated mistake/behaviour tags (`fomo|moved_stop`), filled by Claude only from what the journal says.
- `trade_id`: first 16 hex chars of `sha1("account|symbol|entry_time|qty")`. Used for dedupe.
- `source`: `connector:<name>` | `csv:<broker>` | `sample`. `source_ref`: broker order/exec id or file name.

## `data/journal.json`: array, one object per journal entry

```json
{ "id": "notion-page-id", "date": "2026-11-16", "url": "https://notion.so/…",
  "linked_trade_ids": ["…"], "symbols": ["CL"], "setup": "opening range break",
  "mood": 3, "sleep_hours": 6, "followed_plan": false,
  "mistakes": ["fomo","moved_stop"], "emotions": ["anxious"],
  "lesson": "one-line summary in her words",
  "excerpt": "≤200 chars of her own text" }
```

Missing fields are `null` (arrays may be `[]`). Never invent values.

## `data/insights.json`: written by Claude, at most 5 insights, ranked

```json
{ "generated": "2026-11-17T07:31:00-05:00", "focus_rule": "No entries in the first 15 min",
  "insights": [ { "title": "Revenge trades after a loss cost you −6.2R this month",
     "evidence": { "trade_ids": ["…"], "journal_ids": ["…"], "n": 11 },   // trade_ids: up to ~12 examples, worst first; n counts every trade behind it
     "confidence": "early|moderate|strong", "suggestion": "process change, never a trade call" } ],
  "brief": { "date": "2026-11-17", "markdown": "…" },
  "quote": { "text": "Waiting for the setup paid; keep doing the boring version.",   // optional, ≤240 chars
     "by": "You, 17 Jul",            // her words: "You, <date>"; a quoted person: their name
     "source": "journal|quoted",     // journal = verbatim from her journal; quoted = a real, correctly attributed quote
     "journal_id": "…",              // required when source is journal
     "why": "one line for her Claude: which note or leak it answers" } }
```

`quote` is the line at the top of the dashboard. Without it the dashboard rotates through the `lesson` lines in her journal (days she followed her plan first), and only with no journal does it fall back to a few built-in quotes.

## `config/profile.json`

See `config/profile.example.json`. Key fields: `timezone`, `style` (`day|swing|futures-prop`), `session`, `brief_time`, `account_currency`, `default_risk_per_trade`, `max_daily_loss`, `max_trades_per_day`, `stop_after_consecutive_losses`, `prop_rules`, `setups`, `mistake_tags`, `markets`, `instruments`, `watchlist`, `data_source`, `tools`, `calendar`, `notion`, `layout_preset`, `panels`.

## `data/data.js` (generated, never hand-edited during routine runs)

```js
window.TC_DATA = { updated: "ISO", profile: {…}, trades: [ … ], journal: [ … ], insights: { … } };
```

- `trades[]` are the CSV rows parsed: numbers as numbers, empty as `null`, `tags` as an array.
- In the public repo `data/data.js` is `window.TC_DATA = null;` and the dashboard shows "Not set up yet".
- `data/sample/data.js` sets `window.TC_DATA_SAMPLE = {…}` with the same shape; `dashboard.html?demo=1` uses it.

## `assets/metrics.js` API

Plain browser script that also works with `require()` in Node. Exposes `window.TCMetrics` / `module.exports`. Pure functions, no DOM. Every function takes already-filtered `trades` (closed trades from `TC_DATA.trades`).

| Function | Returns |
|---|---|
| `riskOf(trade, profile)` | `{ risk, source }`: `trade.initial_risk` with its `risk_source`, else `profile.default_risk_per_trade` with `"default"`, else `{ risk: null, source: null }` |
| `rOf(trade, profile)` | `pnl_net / risk`, or `null` |
| `summarize(trades, profile)` | `{ n, wins, losses, scratches, netPnl, netR, grossProfit, grossLoss, winRate, avgWin, avgLoss, payoff, profitFactor, profitFactorExLargest, expectancyR, avgR, rCoverage, maxDrawdown, maxDrawdownR, recoveryFactor, streaks: { longestWin, longestLoss, current: { kind: "win"|"loss"|null, length } }, reliability: "none"|"early"|"building"|"reliable" }`. Win = `pnl_net > 0`, loss = `< 0`, scratch = `0` (scratches count in n, not in win rate's numerator). `profitFactor` is `Infinity` with no losses, `null` with no trades. `reliability`: n=0 none, n<30 early, n<50 building, else reliable. Throws `Error("mixed currencies")` if trades carry different `currency` values. |
| `equityCurve(trades, profile)` | sorted by `exit_time`: `[{ trade_id, time, pnl, cum, peak, drawdown, cumR, ruleBreak }]` (`ruleBreak` = tags non-empty or `followed_plan === false` on the trade) |
| `groupStats(trades, keyFn, profile)` | `[{ key, ...summarize }]` sorted by key |
| `localParts(isoTime, timeZone)` | `{ date: "YYYY-MM-DD", weekday: 0-6 (Mon=0), minutes: minutes since local midnight }` using `Intl.DateTimeFormat` |
| `byTimeOfDay(trades, profile, bucketMinutes = 30)` | buckets by local entry time in `profile.timezone`: `[{ key: "09:30", n, netPnl, winRate }]` |
| `byDayOfWeek(trades, profile)` | `[{ key: "Mon", n, netPnl, winRate }]` Mon–Fri always present, Sat/Sun only if trades |
| `dailyPnl(trades, profile)` | `{ "YYYY-MM-DD": { pnl, n, r } }` keyed by local exit date |
| `rDistribution(trades, profile, binWidth = 0.5)` | `[{ from, to, n }]` contiguous bins covering min..max R |
| `holdingBuckets(trades)` | `[{ key: "<1h"|"1h–1d"|"1–3d"|"3–10d"|">10d", n, netPnl, winRate }]` |
| `leakMap(trades, profile)` | per tag from `trade.tags`: `[{ tag, n, pnl, r }]` sorted worst (most negative pnl) first |
| `planAdherence(trades, journal)` | `{ known, followed, pct }` using each trade's `followed_plan` if present, else the journal entry that lists it in `linked_trade_ids` |
| `stateVsOutcome(trades, journal, profile)` | `{ mood: [{ key: 1..5, n, netPnl, avgR }], sleep: [{ key: "<6h"|"6–7h"|"7–8h"|"8h+", n, netPnl, avgR }] }` joined through `linked_trade_ids` |
| `rolling(trades, profile, window = 20)` | `[{ index, time, expectancyR, winRate }]` from the window-th trade on |
| `dailyLossStatus(trades, profile, date)` | `{ date, pnl, limit, usedPct, breached }` against `profile.max_daily_loss` / `prop_rules.daily_loss_limit` |
| `trailingDrawdownStatus(trades, profile)` | `{ peak, current, floor, distance, breached }` against `prop_rules.trailing_drawdown`; `null` if not set |
