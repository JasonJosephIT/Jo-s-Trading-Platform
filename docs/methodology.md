# How the numbers work

Every number on the dashboard is computed by `assets/metrics.js` from your own trades, the same way every time. Claude writes the *insights* (what your journal says about the numbers), never the arithmetic.

## Core metrics

| Metric | How it's calculated | How to read it |
|---|---|---|
| Net P&L | Sum of P&L after fees | Shown in $ and in R. |
| Win rate | Wins ÷ (wins + losses). Break-even trades don't count either way. | Means little alone. Read it next to profit factor and expectancy. |
| Avg win / avg loss | Mean winning trade, mean losing trade (as a positive number) | Their ratio is the payoff ratio. |
| Profit factor | Gross profit ÷ gross loss | Above 1.5 is usually called healthy. "Ex-largest" removes your single biggest win, to show if one trade carries the result. |
| Expectancy (R) | (Win % × avg win in R) − (loss % × avg loss in R) | What an average trade earns per unit of risk. "Early" under 30 trades, "building" 30–49, "reliable" at 50+. |
| R-multiple | Trade P&L ÷ the dollars you risked | Risk comes from the stop you wrote in your journal, then the platform's stop, then your default risk per trade. The dashboard shows which. |
| Max drawdown | Largest drop from a peak in your running P&L | In $ and R. Recovery factor = net P&L ÷ max drawdown. |
| Streaks | Longest run of wins and of losses, and the current run | |
| Plan adherence | Trades where you followed your plan ÷ trades where you recorded it | Discipline sits next to the equity curve on purpose. |
| Leak map | $ and R lost on trades tagged with each mistake (FOMO, revenge, moved stop…) | Tags come only from what you wrote in your journal. |

## The panels

Equity curve with drawdown band (rule-break trades marked), daily P&L calendar, performance by setup, time of day (30-minute buckets in your time zone), day of week, R distribution, leak map, mood and sleep vs outcome, a 20-trade rolling expectancy, and for funded accounts a daily-loss gauge and trailing-drawdown panel. Swing traders see holding time instead of time of day.

## The morning routine the brief follows

1. **Risk gate:** risk per trade, max daily loss, max trades, stop after N losses.
2. **State:** mood, sleep, anything on your mind (the 2-minute check-in).
3. **Market context:** scheduled releases with times (EIA inventories, USDA reports, CFTC, Fed, CPI…), overnight moves in your markets.
4. **Plan:** your watchlist and levels, the setups you allow yourself.
5. **Focus:** one behaviour to work on, picked from your costliest current leak.

It's kept under 250 words, about a 2-minute read.

## Sources

- Tradeciety on Edgewonk metrics: https://tradeciety.com/all-edgewonks-metrics-and-statistics-explained-for-successful-journaling
- NexusFi performance analytics: https://nexusfi.com/a/platforms/trading-journal-performance-analytics
- TradeZella, analyse your trading performance: https://www.tradezella.com/blog/analyze-trading-performance
- Tradervue reports and statistics: https://help.tradervue.com/article/3423-reports-and-statistics
- TradesViz time-of-day analysis: https://www.tradesviz.com/glossary/time-of-day-analysis/
- Edgewonk Tiltmeter (discipline next to results): https://edgewonk.com/trading-psychology
- Traders Second Brain routine guide: https://traderssecondbrain.com/guides/trading-routine

*Educational/journaling tool. Not investment advice.*
