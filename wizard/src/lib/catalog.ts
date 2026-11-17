// The compatibility catalog (../catalog/*.json, researched and dated) and helpers that
// turn a tool into "how it fits" for the wizard.
import toolsJson from '@catalog/tools.json'
import eventsJson from '@catalog/market-events.json'

export type Category = 'broker' | 'prop' | 'charting' | 'journal' | 'calendar' | 'news' | 'market_data' | 'crypto' | 'other'

export type Tool = {
  id: string
  name: string
  aliases: string[]
  category: Category
  markets: string[]
  path: 'connector' | 'csv' | 'advanced' | 'web' | 'none'
  connector: { name: string | null; in_directory: boolean; notes: string; url: string | null } | null
  export: { help_url: string | null; steps: string[]; format_notes: string } | null
  verified: boolean
  notes: string
  sources: string[]
}

export type MarketEvent = {
  id: string
  name: string
  agency: string
  schedule: string
  time_local: string | null
  time_zone: string
  markets: string[]
  symbols: string[]
  schedule_url: string
  why_it_matters: string
  verified: boolean
}

export const claudeFacts = toolsJson.claude as Record<string, string | string[]>
export const verifiedOn: string = toolsJson.verified_on
export const tools = toolsJson.items as unknown as Tool[]
export const marketEvents = eventsJson.events as unknown as MarketEvent[]

export const byId = (id: string | null | undefined) => tools.find((t) => t.id === id)

export function search(query: string, cats: Category[]): Tool[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return tools
    .filter((t) => cats.includes(t.category))
    .filter((t) => [t.name, ...t.aliases].some((n) => n.toLowerCase().includes(q)))
    .slice(0, 6)
}

export function inCategories(cats: Category[]) {
  return tools.filter((t) => cats.includes(t.category))
}

/** How a tool fits, from the user's point of view. */
export type Fit = 'directory' | 'custom' | 'export' | 'advanced' | 'web' | 'second' | 'research'

export function fitOf(t: Tool | undefined): Fit {
  if (!t) return 'research'
  if (t.path === 'connector') return t.connector?.in_directory ? 'directory' : 'custom'
  if (t.path === 'csv') return 'export'
  if (t.path === 'advanced') return 'advanced'
  if (t.path === 'web') return 'web'
  return 'second'
}

export const fitLabel: Record<Fit, string> = {
  directory: 'Connects to Claude',
  custom: 'Connects by link',
  export: 'Works with an export',
  advanced: 'Advanced setup',
  web: 'Claude reads it online',
  second: 'Second option ready',
  research: 'Claude will check',
}

export const fitExplain: Record<Fit, string> = {
  directory: "It's in Claude's connector directory. You click Connect and sign in.",
  custom: 'It has an official Claude connector you add with a link. The steps are below.',
  export: "No direct connector, so you download your history as a file and drop it in the inbox folder. Claude does the rest.",
  advanced: "There's a connector, but it needs developer setup. The export route is easier and we'll use that.",
  web: 'Claude looks this up on the web each morning. Nothing to connect.',
  second: "Claude can't reach this one directly, so we'll use the second option below.",
  research: "It's not in our list yet. During setup Claude looks it up, shows you what it found, and asks before using it.",
}

/** The fallback when the first choice doesn't work for her. */
export function secondOption(t: Tool | undefined, category: Category): string | null {
  const fit = fitOf(t)
  if (category === 'calendar') {
    if (fit === 'directory') return null
    return 'Claude writes a calendar file (trading-events.ics) into your folder each week. Open it once and the events land in any calendar app, including Apple Calendar on your iPhone.'
  }
  if (category === 'journal') {
    if (fit === 'directory') return null
    if (t?.id === 'obsidian') return 'Your vault is plain files on your computer. Put it (or a copy of the journal folder) inside the Trading Coach folder and Claude reads it directly.'
    return 'Keep journaling where you are and drop an export (PDF, text or CSV) into the inbox folder, or start new entries in Notion. Claude can help you move old ones.'
  }
  if (category === 'broker' || category === 'prop' || category === 'crypto') {
    if (fit === 'export') return null
    if (t?.export?.help_url) return 'If the connector gives you trouble, export your trade history as a CSV and drop it in the inbox folder. Same result.'
    return 'If there is no connector, export your trade history as a CSV (Claude will find the exact steps) and drop it in the inbox folder.'
  }
  if (category === 'charting') return 'Your charts stay where they are. Mention your key levels in the morning check-in and the brief will use them.'
  return null
}

/** Events that matter for the markets she picked. Macro releases always apply. */
const MACRO = new Set(['fomc', 'bls-cpi', 'bls-ppi', 'bls-nfp', 'bea-gdp', 'bea-pce', 'ism-manufacturing'])
export function eventsFor(markets: string[], instruments: string[]): MarketEvent[] {
  const syms = new Set(instruments.map((s) => s.toUpperCase()))
  const words = markets.map((m) => m.toLowerCase())
  return marketEvents.filter((e) => {
    if (MACRO.has(e.id)) return true
    if (e.symbols.some((s) => syms.has(s.toUpperCase()))) return true
    return e.markets.some((m) => words.some((w) => m.toLowerCase().includes(w) || w.includes(m.toLowerCase())))
  })
}
