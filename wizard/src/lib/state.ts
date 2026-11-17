// Wizard answers: shape, defaults, persistence and the YAML block pasted into Claude.
import * as React from 'react'
import { byId, fitOf, type Category } from './catalog'

export const REPO = 'https://github.com/JasonJosephIT/Jo-s-Trading-Platform'
export const PAGES = 'https://jasonjosephit.github.io/Jo-s-Trading-Platform'
export const ZIP = `${REPO}/archive/refs/heads/main.zip`

export type Pick = { id: string | null; name: string }
export type Style = 'day' | 'swing' | 'futures-prop'

export type Answers = {
  name: string
  os: 'mac' | 'windows'
  markets: string[]
  instruments: string[]
  style: Style
  session: { start: string; end: string }
  timezone: string
  brief_time: string
  default_risk_per_trade: number | null
  max_daily_loss: number | null
  max_trades_per_day: number
  stop_after_consecutive_losses: number
  prop_rules: { trailing_drawdown: number | null; daily_loss_limit: number | null }
  setups: string[]
  broker: Pick | null
  charting: Pick[]
  journal: Pick
  calendar: Pick | null
  news: Pick[]
  other: string[]
  journal_shape: 'database' | 'pages' | 'mixed' | 'unsure'
  journal_url: string
  calendar_events: boolean
  event_ids: string[]
  brief_in_notion: boolean
  alpha_vantage: boolean
  checks: Record<string, boolean>
}

export const MARKETS: { value: string; label: string; words: string[]; symbols: string[] }[] = [
  { value: 'energy', label: 'Crude oil & energy', words: ['crude', 'oil', 'gasoline', 'heating', 'energy'], symbols: ['CL', 'MCL', 'BZ', 'RB', 'HO'] },
  { value: 'natgas', label: 'Natural gas', words: ['natural gas'], symbols: ['NG', 'QG'] },
  { value: 'metals', label: 'Gold & metals', words: ['gold', 'silver', 'copper', 'metal'], symbols: ['GC', 'MGC', 'SI', 'SIL', 'HG'] },
  { value: 'grains', label: 'Grains & ags', words: ['corn', 'soybean', 'wheat', 'grain', 'cattle', 'hog'], symbols: ['ZC', 'ZS', 'ZW', 'ZL', 'ZM', 'LE', 'HE'] },
  { value: 'index', label: 'Index futures', words: ['equity index', 's&p', 'nasdaq', 'index'], symbols: ['ES', 'MES', 'NQ', 'MNQ', 'YM', 'RTY'] },
  { value: 'stocks', label: 'Stocks', words: ['equities', 'stocks'], symbols: [] },
  { value: 'options', label: 'Options', words: ['options'], symbols: [] },
  { value: 'forex', label: 'Forex', words: ['forex', 'dollar', 'currency'], symbols: ['6E', 'DX'] },
  { value: 'crypto', label: 'Crypto', words: ['crypto', 'bitcoin'], symbols: ['BTC', 'ETH', 'MBT'] },
  { value: 'cfd', label: 'CFDs', words: [], symbols: [] },
]

const STORAGE = 'trading-coach-wizard-v1'
const memory: { value: string | null } = { value: null }

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

export function defaults(): Answers {
  return {
    name: '',
    os: 'mac', // she has a Mac
    markets: [],
    instruments: [],
    style: 'day',
    session: { start: '09:30', end: '16:00' },
    timezone: detectTz(),
    brief_time: '07:30',
    default_risk_per_trade: 100,
    max_daily_loss: 300,
    max_trades_per_day: 4,
    stop_after_consecutive_losses: 2,
    prop_rules: { trailing_drawdown: null, daily_loss_limit: null },
    setups: [],
    broker: null,
    charting: [],
    journal: { id: 'notion', name: 'Notion' },
    calendar: null,
    news: [],
    other: [],
    journal_shape: 'database',
    journal_url: '',
    calendar_events: true,
    event_ids: [],
    brief_in_notion: true,
    alpha_vantage: false,
    checks: {},
  }
}

/** First name from the link (?name=Jo), so the welcome screen can greet her. */
export function linkName(): string {
  try {
    const n = new URLSearchParams(window.location.search).get('name') ?? ''
    return n.replace(/[^\p{L}\p{M}' -]/gu, '').trim().slice(0, 30)
  } catch {
    return ''
  }
}

function load(): Answers {
  let raw: string | null = memory.value
  try {
    raw = localStorage.getItem(STORAGE) ?? raw
  } catch {
    /* storage blocked: keep in memory */
  }
  try {
    const a: Answers = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults()
    if (!a.name && linkName()) a.name = linkName()
    return a
  } catch {
    return defaults()
  }
}

function save(a: Answers) {
  const raw = JSON.stringify(a)
  memory.value = raw
  try {
    localStorage.setItem(STORAGE, raw)
  } catch {
    /* fine: in-memory fallback */
  }
}

export function useAnswers() {
  const [a, setA] = React.useState<Answers>(load)
  React.useEffect(() => save(a), [a])
  const set = React.useCallback(<K extends keyof Answers>(k: K, v: Answers[K]) => setA((p) => ({ ...p, [k]: v })), [])
  const reset = React.useCallback(() => setA(defaults()), [])
  return { a, set, setA, reset }
}

export function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/* ---------- YAML for the setup prompt ---------- */

function q(s: string) {
  return /^[\w ./:@+-]*$/.test(s) && s.trim() === s && s !== '' ? s : JSON.stringify(s)
}

function yaml(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return q(v)
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    if (v.every((x) => typeof x !== 'object' || x === null)) return `[${v.map((x) => yaml(x)).join(', ')}]`
    return '\n' + v.map((x) => `${pad}- ${yaml(x, indent + 1).replace(/^\n\s*/, '')}`).join('\n')
  }
  const entries = Object.entries(v as Record<string, unknown>)
  return (
    '\n' +
    entries
      .map(([k, x]) => {
        const s = yaml(x, indent + 1)
        return `${pad}${k}:${s.startsWith('\n') ? s : ' ' + s}`
      })
      .join('\n')
  )
}

function describe(p: Pick | null, category: Category) {
  if (!p || !p.name) return null
  const t = byId(p.id)
  const fit = fitOf(t)
  return { name: p.name, catalog_id: p.id, category, path: t ? t.path : 'unknown', fit }
}

export function toolsSummary(a: Answers) {
  const picked = [
    describe(a.broker, (byId(a.broker?.id)?.category as Category) ?? 'broker'),
    describe(a.journal, 'journal'),
    describe(a.calendar, 'calendar'),
    ...a.charting.map((p) => describe(p, 'charting')),
    ...a.news.map((p) => describe(p, 'news')),
    ...a.other.map((n) => describe({ id: null, name: n }, 'other')),
  ].filter(Boolean) as NonNullable<ReturnType<typeof describe>>[]
  return {
    using: picked,
    to_research: picked.filter((p) => p.fit === 'research').map((p) => `${p.name} (${p.category})`),
  }
}

export function answersYaml(a: Answers): string {
  const t = toolsSummary(a)
  const doc = {
    wizard_version: 1,
    name: a.name || null,
    computer: a.os,
    timezone: a.timezone,
    markets: a.markets.map((m) => MARKETS.find((x) => x.value === m)?.label ?? m),
    instruments: a.instruments,
    style: a.style,
    layout_preset: a.style,
    session: a.session,
    brief_time: a.brief_time,
    risk: {
      default_risk_per_trade: a.default_risk_per_trade,
      max_daily_loss: a.max_daily_loss,
      max_trades_per_day: a.max_trades_per_day,
      stop_after_consecutive_losses: a.stop_after_consecutive_losses,
      prop_rules: a.style === 'futures-prop' ? a.prop_rules : null,
    },
    setups: a.setups,
    tools: {
      broker: t.using.find((x) => ['broker', 'prop', 'crypto'].includes(x.category)) ?? null,
      journal: t.using.find((x) => x.category === 'journal') ?? null,
      calendar: t.using.find((x) => x.category === 'calendar') ?? null,
      charting: t.using.filter((x) => x.category === 'charting').map((x) => x.name),
      news: t.using.filter((x) => x.category === 'news').map((x) => x.name),
      other: a.other,
      to_research: t.to_research,
    },
    notion: { journal_shape: a.journal_shape, journal_location: a.journal_url || null, brief_page: a.brief_in_notion ? 'create' : null },
    calendar: a.calendar ? { add_market_events: a.calendar_events, event_ids: a.calendar_events ? a.event_ids : [] } : null,
    market_data: { web_search: true, alpha_vantage: a.alpha_vantage },
  }
  return '```yaml' + yaml(doc) + '\n```'
}
