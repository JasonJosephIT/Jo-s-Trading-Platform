# Trading Assistant

A journaling and process assistant for one non-technical trader. Claude imports her trades, links them to her Notion journal, finds patterns in her own data, and prepares each trading day. It gives no trade signals and never places orders.

## Language

### People and roles

**Trader**:
The person who owns the folder and trades; the assistant is built for her alone.
_Avoid_: User, client, customer

**Trading Assistant**:
Claude acting under `CLAUDE.md` as a process and data helper, never an advisor.
_Avoid_: Coach, bot, advisor

### Data

**Trade**:
One round trip (entry to exit) in `data/trades.csv`, identified by a hash-based trade id.
_Avoid_: Fill, execution, order

**Journal entry**:
One day's note in her own words, extracted from Notion into `data/journal.json`.
_Avoid_: Log, diary entry

**Inbox**:
The folder where she drops platform export files for the next import.
_Avoid_: Upload folder, import folder

**Archive**:
Where processed inbox files go, with a date prefix.
_Avoid_: Backup, trash

**Connector**:
A Claude integration (Notion, a trading platform, a calendar) used with read-only access.
_Avoid_: Plugin, integration, API

**Export file**:
A CSV or XLSX from her trading platform, the fallback when no connector works.
_Avoid_: Report, dump

**Platform preset**:
A starting column layout for one trading platform's export file, unverified until her real file proves it.
_Avoid_: Template, schema

### Process concepts

**Process, not P&L**:
The rule that every suggestion is a behaviour change, never a trade call or a judgment of results.
_Avoid_: Trade advice, signal

**R (R-multiple)**:
A trade's result measured in units of the dollars she risked on it.
_Avoid_: Risk-reward, return

**Plan adherence**:
The share of trades where she recorded following her own plan.
_Avoid_: Discipline score, compliance

**Mistake tag**:
A behaviour label (FOMO, revenge, moved stop) added to a trade only when her journal names it.
_Avoid_: Error code, flag

**Leak**:
A recurring mistake that costs her money, measured in dollars and R by tag.
_Avoid_: Weakness, problem

**Insight**:
A pattern in her numbers, with sample size, confidence label and a process suggestion; at most five at a time.
_Avoid_: Finding, analysis, signal

**Focus rule**:
The one behaviour to work on today, chosen from her costliest current leak.
_Avoid_: Goal, target

**Confidence label**:
"Early", "moderate" or "strong", set by how many trades sit behind a pattern.
_Avoid_: Significance, score

**Risk gate**:
Her own limits for the day: risk per trade, max daily loss, max trades, and stop after N losses in a row.
_Avoid_: Risk settings, limits

**Prop rules**:
A funded-account firm's trailing drawdown and daily loss limit, kept separate from her own stop.
_Avoid_: Firm limits, challenge rules

### Outputs

**Dashboard**:
Her fixed-layout page (`dashboard.html`) that reads the generated data and shows the numbers.
_Avoid_: Report, app

**Panel**:
One block of the dashboard (equity curve, leak map, brief); she can turn panels on or off and reorder them in her profile.
_Avoid_: Widget, card

**Leak map**:
The dashboard panel showing dollars and R lost per mistake tag.
_Avoid_: Mistake chart

**Brief**:
The morning note under 250 words: yesterday, today's limits, the focus rule, scheduled events and one journal question.
_Avoid_: Report, summary, newsletter

**Quote of the day**:
The verse and quote at the top of the dashboard, picked to answer what her recent entries say.
_Avoid_: Motivation, affirmation

**Market event**:
A recurring scheduled release (EIA, Fed, CPI) listed in `catalog/market-events.json`.
_Avoid_: News, catalyst

### Workflows

**Setup**:
The eleven-step onboarding flow, with progress saved per step and checked by the doctor script.
_Avoid_: Install, onboarding

**Setup wizard**:
The click-through page (`setup.html`) that collects her answers before the Setup flow runs.
_Avoid_: Setup page, installer

**Doctor**:
The script every session starts with; it reports the next setup step and what is waiting in the inbox.
_Avoid_: Health check, status script

**Morning update**:
The scheduled weekday flow that imports trades, refreshes the journal and insights, and writes the brief.
_Avoid_: Daily run, cron job

**Check-in**:
The two-minute chat about mood, sleep and what's on her mind, saved to her journal.
_Avoid_: Survey, questionnaire

**Weekly review**:
The Saturday flow that scores the week and may suggest one dashboard layout change.
_Avoid_: Weekly report

**Duet plugin**:
The optional trading-assistant plugin that gives nudges during her trading day, read-only.
_Avoid_: Extension, add-on
