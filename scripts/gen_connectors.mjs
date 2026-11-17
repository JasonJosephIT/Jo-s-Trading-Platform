// Writes docs/connectors.md from catalog/tools.json and catalog/market-events.json.
// Usage: node scripts/gen_connectors.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tools = JSON.parse(readFileSync(join(root, 'catalog/tools.json'), 'utf8'))
const events = JSON.parse(readFileSync(join(root, 'catalog/market-events.json'), 'utf8'))

const fit = (t) => {
  if (t.path === 'connector') return t.connector?.in_directory ? 'Claude directory connector' : 'Official connector (add by link)'
  return { csv: 'Export file → inbox', advanced: 'Developer setup (use export instead)', web: 'Web search', none: 'Second option' }[t.path] ?? t.path
}
const link = (url, label) => (url ? `[${label}](${url})` : '—')
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

const groups = [
  ['Trading platforms and brokers', ['broker', 'prop', 'crypto']],
  ['Journals', ['journal']],
  ['Calendars', ['calendar']],
  ['Charting', ['charting']],
  ['News and market data', ['news', 'market_data']],
  ['Other', ['other']],
]

let md = `# Connectors and second options

Generated from \`catalog/tools.json\` (checked ${tools.verified_on}). Edit the catalog, then run \`node scripts/gen_connectors.mjs\`.
"Unconfirmed" means a detail couldn't be verified on an official page that day; Claude re-checks it during setup.

## How to add a connector in Claude

- **From the directory:** ${esc(tools.claude.add_connector_path)}
- **By link (custom connector):** ${esc(tools.claude.custom_connector_note)}
- **Scheduled tasks:** ${esc(tools.claude.scheduled_tasks)}
- **Keep it running:** ${esc(tools.claude.keep_awake_setting)}
- **Turning off individual tools:** ${esc(tools.claude.per_tool_toggles)}

The coach only ever uses read tools, whatever a connector offers.
`

for (const [title, cats] of groups) {
  const rows = tools.items.filter((t) => cats.includes(t.category))
  if (!rows.length) continue
  md += `\n## ${title}\n\n| App | How it works with Claude | Connector | Export help | Status |\n|---|---|---|---|---|\n`
  for (const t of rows) {
    md += `| ${esc(t.name)} | ${fit(t)} | ${link(t.connector?.url, t.connector?.name ? esc(t.connector.name) : 'page')} | ${link(t.export?.help_url, 'how to export')} | ${t.verified ? 'Checked' : 'Unconfirmed'} |\n`
  }
}

md += `\n## Second options\n
- **Platform with no connector:** export your trade history as CSV into \`inbox/\`. Claude maps the columns once (with a 5-row preview you confirm) and remembers them.
- **Calendar with no connector (Apple Calendar):** Claude writes \`trading-events.ics\` into the folder; open it once to import.
- **Journal outside Notion:** Obsidian vaults are local files Claude can read; for other apps, drop an export into \`inbox/\` or start new entries in Notion.
- **Unknown app:** use the "Add a tool" prompt. Claude looks it up and shows you the options with links.

## Market events (for the brief and the calendar)

| Event | When | Markets | Schedule |
|---|---|---|---|
`
for (const e of events.events) {
  md += `| ${esc(e.name)} | ${esc(e.schedule.split(/[(;]/)[0].trim())}${e.time_local ? `, ${e.time_local} ET` : ''} | ${esc(e.symbols.join(', ') || e.markets.join(', '))} | ${link(e.schedule_url, 'official')}${e.verified ? '' : ' (unconfirmed)'} |\n`
}

writeFileSync(join(root, 'docs/connectors.md'), md)
console.log('wrote docs/connectors.md')
