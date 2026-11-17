// Every page of the setup flow. Each page is one screen, like an iPhone app's onboarding.
import * as React from 'react'
import {
  BarChart3, BookOpen, Briefcase, CalendarDays, Check, CircleHelp, Clock, Cloud, Coffee, Compass, Download, FolderOpen,
  Laptop, LineChart, Moon, Newspaper, NotebookPen, Power, Search, ShieldCheck, Sparkles, Sunrise, Target, Wand2,
} from 'lucide-react'
import promptsJson from '@prompts/prompts.json'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Callout, ChipInput, Chips, CopyBlock, FieldLabel, IconTile, LargeTitle, ListGroup, ListRow, NumberField, Section,
  Segmented, StepList, Stepper, TextField, copyText, type Step,
} from '@/components/ios'
import { byId, claudeFacts, eventsFor, fitExplain, fitLabel, fitOf, search, secondOption, verifiedOn, type Category, type Fit, type Tool } from '@/lib/catalog'
import { MARKETS, PAGES, ZIP, answersYaml, linkName, toggle, toolsSummary, type Answers, type Pick } from '@/lib/state'
import { cn } from '@/lib/utils'

type P = { a: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; go: (id: string) => void }

const prompts = Object.fromEntries(promptsJson.prompts.map((p) => [p.id, p]))
export const setupPrompt = (a: Answers) => prompts.setup.text.replace('{{ANSWERS}}', answersYaml(a))

const CLAUDE_DL = 'https://claude.com/download'
const PRICING = 'https://claude.com/pricing'
const CONNECTORS_HELP = 'https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp'

/* ---------- small shared bits ---------- */

const FIT_ICON: Record<Fit, React.ReactNode> = {
  directory: <Check className="size-3.5" strokeWidth={3} />,
  custom: <Check className="size-3.5" strokeWidth={3} />,
  export: <Download className="size-3.5" />,
  advanced: <Wand2 className="size-3.5" />,
  web: <Cloud className="size-3.5" />,
  second: <Compass className="size-3.5" />,
  research: <Search className="size-3.5" />,
}

export function FitPill({ fit }: { fit: Fit }) {
  const strong = fit === 'directory' || fit === 'custom'
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap', strong ? 'text-[var(--cta-ink)]' : 'border border-trim text-gold')}
      style={strong ? { background: 'var(--cta)' } : undefined}
    >
      {FIT_ICON[fit]}
      {fitLabel[fit]}
    </span>
  )
}

function ToolPicker({
  cats,
  popular,
  value,
  onChange,
  multiple,
  placeholder,
  header,
  footer,
}: {
  cats: Category[]
  popular: string[]
  value: Pick[]
  onChange: (v: Pick[]) => void
  multiple?: boolean
  placeholder: string
  header: string
  footer?: string
}) {
  const [q, setQ] = React.useState('')
  const results = search(q, cats)
  const isOn = (p: Pick) => value.some((v) => (v.id ?? v.name) === (p.id ?? p.name))
  const flip = (p: Pick) => {
    if (multiple) onChange(isOn(p) ? value.filter((v) => (v.id ?? v.name) !== (p.id ?? p.name)) : [...value, p])
    else onChange(isOn(p) ? [] : [p])
    setQ('')
  }
  const shown: Pick[] = [
    ...popular.map((id) => byId(id)).filter(Boolean).map((t) => ({ id: t!.id, name: t!.name })),
    ...value.filter((v) => !popular.includes(v.id ?? '')),
  ]
  return (
    <ListGroup header={header} footer={footer}>
      {shown.map((p) => {
        const t = byId(p.id)
        return (
          <ListRow key={p.id ?? p.name} title={p.name} detail={<FitPill fit={fitOf(t)} />} accessory="check" checked={isOn(p)} onClick={() => flip(p)} />
        )
      })}
      <div className="px-4 py-3">
        <div className="flex h-10 items-center gap-2 rounded-[10px] bg-foreground/[0.07] px-3">
          <Search className="size-4 text-muted-foreground" />
          <input aria-label={placeholder} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground" />
        </div>
        {q.trim() && (
          <div className="mt-2 space-y-1">
            {results.map((t) => (
              <button key={t.id} onClick={() => flip({ id: t.id, name: t.name })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-foreground/[0.05]">
                <span className="text-[15px]">{t.name}</span>
                <FitPill fit={fitOf(t)} />
              </button>
            ))}
            {!results.some((t) => t.name.toLowerCase() === q.trim().toLowerCase()) && (
              <button onClick={() => flip({ id: null, name: q.trim() })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-foreground/[0.05]">
                <span className="text-[15px]">Use “{q.trim()}”</span>
                <FitPill fit="research" />
              </button>
            )}
          </div>
        )}
      </div>
    </ListGroup>
  )
}

/* ---------- 0. Welcome ---------- */

export function Welcome() {
  const name = linkName()
  return (
    <>
      <div className="glass relative mx-5 mt-2 overflow-hidden rounded-[32px] px-6 pt-8 pb-7">
        <Crest />
        <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.12em] text-gold">Trading Assistant</p>
        {name ? (
          <>
            <h1 aria-label={`Hello, ${name}.`} className="script-hello gold-text -ml-1 mt-1 whitespace-nowrap text-[clamp(44px,15vw,64px)] tracking-normal">Hello, {name}.</h1>
            <p className="mt-1 text-[21px] leading-snug font-semibold tracking-[-0.01em] text-balance">Let's set up your trading workstation.</p>
            <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">Your journal, your numbers, a calm morning plan. About 20 minutes once; after that it updates itself every trading morning.</p>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-[32px] leading-[1.08] font-bold tracking-[-0.02em] text-balance">Your journal, your numbers, a calm morning plan.</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">Set up once in about 20 minutes. Every trading morning after that, it updates itself.</p>
          </>
        )}
      </div>
      <ListGroup header="What you get" className="pt-6">
        <ListRow icon={<Sunrise />} title="A morning brief" detail="Your limits, today's focus and the market events that matter, ready before the open." />
        <ListRow icon={<BarChart3 />} title="A dashboard that stays current" detail="Win rate, profit factor, expectancy, drawdown, best setups and where money leaks." />
        <ListRow icon={<NotebookPen />} title="Your journal, put to work" detail="Keep writing in Notion as you do now. Claude links what you wrote to what happened." />
        <ListRow icon={<ShieldCheck />} title="Private and read-only" detail="Your data stays on your computer and in Notion. It never places a trade." />
      </ListGroup>
      <ListGroup>
        <ListRow icon={<LineChart />} title="See the demo dashboard" detail="Sample data, so you know what you're building." href={`${PAGES}/dashboard.html?demo=1`} accessory="external" />
      </ListGroup>
    </>
  )
}

function Crest() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="relative">
      <defs>
        <linearGradient id="gc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e7b4" />
          <stop offset=".45" stopColor="#dcb64f" />
          <stop offset="1" stopColor="#9a7720" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="54" height="54" rx="17" fill="rgba(7,4,13,.35)" stroke="url(#gc)" strokeWidth="1.5" />
      <path d="M13 37 L22 27 L29 32 L42 18" fill="none" stroke="url(#gc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="18" r="3.2" fill="#f6e7b4" />
      <path d="M13 42 H43" stroke="url(#gc)" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
    </svg>
  )
}

/* ---------- 1. Check what you have ---------- */

export function Basics({ a, set }: P) {
  return (
    <>
      <LargeTitle eyebrow="Step 1" title="Check what you have" subtitle="Two things to have before you start. Tap each one once it's done." icon={<IconTile><Laptop className="size-7" /></IconTile>} />
      <ListGroup header="You need">
        <ListRow title="A paid Claude plan" detail="Pro or higher. Scheduled tasks need it." accessory="check" checked={a.hasPlan} onClick={() => set('hasPlan', !a.hasPlan)} />
        <ListRow title="Claude Desktop on your computer" detail="The app, not just the website." accessory="check" checked={a.hasDesktop} onClick={() => set('hasDesktop', !a.hasDesktop)} />
      </ListGroup>
      <ListGroup header="Don't have them yet?">
        <ListRow icon={<Sparkles />} title="See Claude plans" href={PRICING} accessory="external" />
        <ListRow icon={<Download />} title="Download Claude Desktop" href={CLAUDE_DL} accessory="external" />
      </ListGroup>
      <Section>
        <FieldLabel>Your computer</FieldLabel>
        <Segmented label="Your computer" value={a.os} onChange={(v) => set('os', v)} options={[{ value: 'mac', label: 'Mac' }, { value: 'windows', label: 'Windows' }]} />
      </Section>
      <Section>
        <FieldLabel htmlFor="name">What should Claude call you? (optional)</FieldLabel>
        <TextField id="name" value={a.name} onChange={(e) => set('name', e.target.value)} placeholder="First name" autoComplete="given-name" />
      </Section>
    </>
  )
}

/* ---------- 2. Your toolkit ---------- */

export function Toolkit({ a, set }: P) {
  return (
    <>
      <LargeTitle eyebrow="Step 2" title="What do you use?" subtitle="Pick the apps you already trade and plan with. We'll check each one works with Claude, and line up a second option if it doesn't." icon={<IconTile><Briefcase className="size-7" /></IconTile>} />
      <ToolPicker
        header="Where you place trades"
        cats={['broker', 'prop', 'crypto']}
        popular={['ninjatrader-tradovate', 'topstep', 'ibkr', 'thinkorswim', 'tradestation', 'metatrader', 'webull']}
        value={a.broker ? [a.broker] : []}
        onChange={(v) => set('broker', v[0] ?? null)}
        placeholder="Search or type your platform"
        footer="Not listed? Type its name. Claude will look it up during setup."
      />
      <ToolPicker header="Where you journal" cats={['journal']} popular={['notion', 'google-sheets-docs', 'excel-onedrive', 'obsidian', 'apple-notes']} value={[a.journal]} onChange={(v) => set('journal', v[0] ?? { id: null, name: '' })} placeholder="Search or type your journal app" />
      <ToolPicker header="Your calendar" cats={['calendar']} popular={['google-calendar', 'outlook-calendar', 'apple-calendar']} value={a.calendar ? [a.calendar] : []} onChange={(v) => set('calendar', v[0] ?? null)} placeholder="Search or type your calendar" footer="Optional. Used to put market events (inventory reports, Fed days) on your calendar." />
      <ToolPicker header="Charts (pick any)" multiple cats={['charting']} popular={['tradingview', 'thinkorswim', 'sierra-chart']} value={a.charting} onChange={(v) => set('charting', v)} placeholder="Search or type a charting app" />
      <ToolPicker header="News and data (pick any)" multiple cats={['news', 'market_data']} popular={['alpha-vantage']} value={a.news} onChange={(v) => set('news', v)} placeholder="e.g. Bloomberg, X, a Discord room" footer="Claude's own web search is always on for market news." />
      <Section>
        <FieldLabel>Anything else you use while trading?</FieldLabel>
        <ChipInput label="Other tools" values={a.other} onChange={(v) => set('other', v)} placeholder="e.g. Discord room, Excel sheet, Telegram" />
      </Section>
    </>
  )
}

/* ---------- 3. Compatibility ---------- */

export function Compatibility({ a }: P) {
  const rows: { label: string; pick: Pick | null; cat: Category; icon: React.ReactNode }[] = [
    { label: 'Trading platform', pick: a.broker, cat: (byId(a.broker?.id)?.category as Category) ?? 'broker', icon: <LineChart /> },
    { label: 'Journal', pick: a.journal?.name ? a.journal : null, cat: 'journal', icon: <BookOpen /> },
    { label: 'Calendar', pick: a.calendar, cat: 'calendar', icon: <CalendarDays /> },
    ...a.charting.map((p) => ({ label: 'Charts', pick: p, cat: 'charting' as Category, icon: <BarChart3 /> })),
    ...a.news.map((p) => ({ label: 'News & data', pick: p, cat: 'news' as Category, icon: <Newspaper /> })),
    ...a.other.map((n) => ({ label: 'Other', pick: { id: null, name: n }, cat: 'other' as Category, icon: <Compass /> })),
  ]
  const research = toolsSummary(a).to_research
  return (
    <>
      <LargeTitle eyebrow="Step 3" title="How your tools fit" subtitle={`Checked against Claude's connector directory on ${verifiedOn}.`} icon={<IconTile><ShieldCheck className="size-7" /></IconTile>} />
      <div className="space-y-3 px-4 pb-6">
        {rows.map((r, i) => {
          if (!r.pick) {
            return (
              <div key={i} className="rounded-2xl border border-dashed border-border px-4 py-3.5 text-[14.5px] text-muted-foreground">
                <span className="font-medium text-foreground/80">{r.label}:</span> not picked. {r.cat === 'broker' ? 'Claude will ask during setup.' : 'Skipped, which is fine.'}
              </div>
            )
          }
          const t = byId(r.pick.id)
          const fit: Fit = r.cat === 'charting' && t ? 'second' : fitOf(t)
          const second = secondOption(t, r.cat)
          return <ToolCard key={i} label={r.label} name={r.pick.name} tool={t} fit={fit} second={second} icon={r.icon} />
        })}
      </div>
      {research.length > 0 && (
        <Section>
          <Callout tone="gold" title="Claude will look these up for you">
            {research.join(', ')}. During setup Claude searches for a connector or an export, shows you the links, and asks before using anything.
          </Callout>
        </Section>
      )}
    </>
  )
}

function ToolCard({ label, name, tool, fit, second, icon }: { label: string; name: string; tool?: Tool; fit: Fit; second: string | null; icon: React.ReactNode }) {
  return (
    <div className="glass rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-secondary text-gold [&_svg]:size-[18px]">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
          <p className="text-[17px] font-semibold leading-snug">{name}</p>
        </div>
        <FitPill fit={fit} />
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-foreground/85">{fitExplain[fit]}</p>
      {tool && !tool.verified && fit !== 'research' && <p className="mt-2 text-[13px] text-muted-foreground">Some details for {name} couldn't be confirmed yet. Claude double-checks during setup.</p>}
      {second && (
        <div className="mt-3 rounded-xl bg-foreground/[0.05] p-3 text-[14px] leading-relaxed">
          <span className="font-semibold text-gold">Second option · </span>
          {second}
        </div>
      )}
    </div>
  )
}

/* ---------- 4. About your trading ---------- */

const TZS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney']

export function Trading({ a, set }: P) {
  const symbols = MARKETS.filter((m) => a.markets.includes(m.value)).flatMap((m) => m.symbols)
  const tzs = TZS.includes(a.timezone) ? TZS : [a.timezone, ...TZS]
  return (
    <>
      <LargeTitle eyebrow="Step 4" title="About your trading" subtitle="This sets up your dashboard layout and your morning brief." icon={<IconTile><Target className="size-7" /></IconTile>} />
      <Section>
        <FieldLabel>What you trade</FieldLabel>
        <Chips label="Markets" options={MARKETS.map((m) => ({ value: m.value, label: m.label }))} selected={a.markets} onToggle={(v) => set('markets', toggle(a.markets, v))} />
      </Section>
      {symbols.length > 0 && (
        <Section>
          <FieldLabel>Contracts you trade most</FieldLabel>
          <Chips label="Contracts" options={symbols.map((s) => ({ value: s, label: s }))} selected={a.instruments} onToggle={(v) => set('instruments', toggle(a.instruments, v))} />
        </Section>
      )}
      <Section>
        <FieldLabel>How you trade</FieldLabel>
        <Segmented
          label="Trading style"
          value={a.style}
          onChange={(v) => set('style', v)}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'swing', label: 'Swing' },
            { value: 'futures-prop', label: 'Prop / funded' },
          ]}
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {a.style === 'day' && 'In and out the same day. Shows time-of-day stats.'}
          {a.style === 'swing' && 'Holds for days. Shows holding-time stats instead of time of day.'}
          {a.style === 'futures-prop' && 'A funded or evaluation account. Adds daily-loss and trailing-drawdown gauges.'}
        </p>
      </Section>
      <ListGroup header="Your hours">
        <ListRow icon={<Clock />} title="Session starts" value={<TimeInput value={a.session.start} onChange={(v) => set('session', { ...a.session, start: v })} label="Session start" />} />
        <ListRow icon={<Moon />} title="Session ends" value={<TimeInput value={a.session.end} onChange={(v) => set('session', { ...a.session, end: v })} label="Session end" />} />
        <ListRow icon={<Coffee />} title="Morning brief ready by" value={<TimeInput value={a.brief_time} onChange={(v) => set('brief_time', v)} label="Brief time" />} />
        <ListRow
          icon={<Compass />}
          title="Time zone"
          value={
            <select aria-label="Time zone" value={a.timezone} onChange={(e) => set('timezone', e.target.value)} className="max-w-[170px] bg-transparent text-right text-[15px] text-gold outline-none">
              {tzs.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          }
        />
      </ListGroup>
    </>
  )
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="time" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg bg-foreground/[0.07] px-2 py-1 text-[15px] text-gold tabular outline-none focus-visible:ring-2 focus-visible:ring-ring" />
}

/* ---------- 5. Risk rules ---------- */

const SETUP_IDEAS = ['Opening range break', 'VWAP reclaim', 'Inventory report fade', 'Pullback to trend', 'Breakout retest', 'Mean reversion', 'News fade']

export function Risk({ a, set }: P) {
  return (
    <>
      <LargeTitle eyebrow="Step 5" title="Your risk rules" subtitle="The coach reminds you of these every morning and flags days you went past them. Rough numbers are fine; you can change them later." icon={<IconTile><ShieldCheck className="size-7" /></IconTile>} />
      <Section className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="risk">Risk per trade</FieldLabel>
          <NumberField id="risk" label="Risk per trade" prefix="$" value={a.default_risk_per_trade} onChange={(v) => set('default_risk_per_trade', v)} />
        </div>
        <div>
          <FieldLabel htmlFor="mdl">Max daily loss</FieldLabel>
          <NumberField id="mdl" label="Max daily loss" prefix="$" value={a.max_daily_loss} onChange={(v) => set('max_daily_loss', v)} />
        </div>
      </Section>
      <ListGroup>
        <ListRow title="Max trades a day" value={<Stepper label="max trades a day" value={a.max_trades_per_day} min={1} onChange={(v) => set('max_trades_per_day', v)} />} />
        <ListRow title="Stop after losses in a row" value={<Stepper label="losses in a row" value={a.stop_after_consecutive_losses} min={1} max={10} onChange={(v) => set('stop_after_consecutive_losses', v)} />} />
      </ListGroup>
      {a.style === 'futures-prop' && (
        <Section className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="tdd">Trailing drawdown</FieldLabel>
            <NumberField id="tdd" label="Trailing drawdown" prefix="$" value={a.prop_rules.trailing_drawdown} onChange={(v) => set('prop_rules', { ...a.prop_rules, trailing_drawdown: v })} />
          </div>
          <div>
            <FieldLabel htmlFor="pdl">Firm's daily limit</FieldLabel>
            <NumberField id="pdl" label="Firm daily loss limit" prefix="$" value={a.prop_rules.daily_loss_limit} onChange={(v) => set('prop_rules', { ...a.prop_rules, daily_loss_limit: v })} />
          </div>
        </Section>
      )}
      <Section>
        <FieldLabel>Setups you take</FieldLabel>
        <Chips label="Setup ideas" options={SETUP_IDEAS.filter((s) => !a.setups.includes(s)).map((s) => ({ value: s, label: `+ ${s}` }))} selected={[]} onToggle={(v) => set('setups', [...a.setups, v])} />
        <div className="mt-3">
          <ChipInput label="Add a setup" values={a.setups} onChange={(v) => set('setups', v)} placeholder="Name a setup you use" />
        </div>
      </Section>
    </>
  )
}

/* ---------- 6. Journal ---------- */

export function Journal({ a, set }: P) {
  const t = byId(a.journal?.id)
  const fit = fitOf(t)
  const isNotion = a.journal?.id === 'notion'
  return (
    <>
      <LargeTitle eyebrow="Step 6" title={isNotion ? 'Connect your Notion journal' : `Your journal in ${a.journal?.name || 'your app'}`} subtitle="You keep journaling exactly the way you do now. Nothing about your format changes." icon={<IconTile><NotebookPen className="size-7" /></IconTile>} />
      {fit === 'directory' ? (
        <Section>
          <StepList steps={connectSteps(t!.connector?.name ?? t!.name)} />
          {isNotion && (
            <div className="mt-4">
              <Callout title="Good to know">Notion's connector can see what your Notion account can see. If you'd like a tighter boundary, keep your trading journal in its own teamspace.</Callout>
            </div>
          )}
        </Section>
      ) : (
        <Section>
          <Callout tone="gold" title="Second option">
            {secondOption(t, 'journal')}
          </Callout>
        </Section>
      )}
      <Section>
        <FieldLabel>How is your journal set up?</FieldLabel>
        <Segmented
          label="Journal shape"
          value={a.journal_shape}
          onChange={(v) => set('journal_shape', v)}
          options={[
            { value: 'database', label: 'A database' },
            { value: 'pages', label: 'Pages' },
            { value: 'mixed', label: 'Both' },
            { value: 'unsure', label: 'Not sure' },
          ]}
        />
      </Section>
      <Section>
        <FieldLabel htmlFor="jurl">Link to your journal (optional)</FieldLabel>
        <TextField id="jurl" inputMode="url" value={a.journal_url} onChange={(e) => set('journal_url', e.target.value)} placeholder="https://www.notion.so/…" />
        <p className="mt-2 text-[13px] text-muted-foreground">In Notion: open the journal, click Share → Copy link. Skip it and Claude will search for it.</p>
      </Section>
    </>
  )
}

function connectSteps(connectorName: string): Step[] {
  const path = String(claudeFacts.add_connector_path ?? '')
  return [
    { text: <>Open Claude (Desktop or claude.ai) and go to <b>Customize → Connectors</b>.</> },
    { text: <>Click <b>+</b> next to Connectors and search for <b>{connectorName}</b>.</> },
    { text: <>Click <b>Connect</b> and sign in. Allow access when asked.</> },
    { text: <>Back in Claude, it should now show as connected.</>, link: path ? { href: CONNECTORS_HELP, label: 'Claude help: connectors' } : undefined },
  ]
}

/* ---------- 7. Trading platform ---------- */

export function Platform({ a }: P) {
  const t = byId(a.broker?.id)
  const fit = a.broker ? fitOf(t) : null
  const name = a.broker?.name
  return (
    <>
      <LargeTitle eyebrow="Step 7" title={name ? `Bring in your trades from ${name}` : 'Bring in your trades'} subtitle="The coach only reads your trades. It never places, changes or suggests an order." icon={<IconTile><LineChart className="size-7" /></IconTile>} />
      {!fit && (
        <Section>
          <Callout tone="gold" title="No platform picked">That's fine. Claude will ask which platform you use and find the right way to bring your trades in.</Callout>
        </Section>
      )}
      {fit === 'directory' && (
        <Section>
          <StepList steps={connectSteps(t!.connector?.name ?? t!.name)} />
          <div className="mt-4">
            <Callout title="Read-only">If it asks what Claude may do, allow viewing your account only. The coach never uses trading tools, even if asked.</Callout>
          </div>
        </Section>
      )}
      {fit === 'custom' && t && <CustomConnector t={t} />}
      {(fit === 'export' || fit === 'advanced' || fit === 'second') && t && <ExportSteps t={t} />}
      {fit === 'research' && (
        <Section>
          <Callout tone="gold" title={`Claude will check ${name}`}>
            During setup Claude searches for a {name} connector and for its trade-history export, shows you the links and walks you through whichever works. If there's nothing, any CSV or Excel file of your trades works.
          </Callout>
        </Section>
      )}
      {fit && fit !== 'export' && t && secondOption(t, t.category) && (
        <Section>
          <Callout title="Second option">{secondOption(t, t.category)}</Callout>
        </Section>
      )}
    </>
  )
}

function CustomConnector({ t }: { t: Tool }) {
  const urls = (t.connector?.notes.match(/https:\/\/\S+?\/mcp/g) ?? []).filter((u, i, all) => all.indexOf(u) === i)
  const live = urls.find((u) => u.includes('live'))
  const demo = urls.find((u) => u.includes('demo'))
  return (
    <Section>
      <StepList
        steps={[
          { text: <>In Claude, go to <b>Customize → Connectors</b>, click <b>+</b>, then <b>Add custom connector</b>.</> },
          {
            text: (
              <>
                Paste this link. It's {t.name}'s official one{live ? ' for your real account' : ''}:
                {live && <UrlCopy url={live} />}
                {demo && (
                  <span className="mt-1 block text-[13px] text-muted-foreground">
                    Practising on a sim account? Use <button className="text-gold underline" onClick={() => copyText(demo)}>the demo link</button> instead.
                  </span>
                )}
              </>
            ),
          },
          { text: <>Click <b>Connect</b> and sign in to {t.name} in the browser.</> },
          { text: <>When it asks what Claude may do, choose <b>view / read only</b>. Don't grant order or risk-setting access.</>, link: t.connector?.url ? { href: t.connector.url, label: `${t.name}: connect to Claude` } : undefined },
        ]}
      />
    </Section>
  )
}

function UrlCopy({ url }: { url: string }) {
  return (
    <button onClick={() => copyText(url)} className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-trim bg-[#0c0618] px-3 py-2.5 text-left font-mono text-[13px] text-[#efe7fb]">
      <span className="truncate">{url}</span>
      <span className="shrink-0 font-sans text-[13px] font-semibold text-[#dcb64f]">Copy</span>
    </button>
  )
}

function ExportSteps({ t }: { t: Tool }) {
  const steps: Step[] = (t.export?.steps ?? []).map((s) => ({ text: s }))
  if (!steps.length) steps.push({ text: <>Find your trade history (sometimes called Trades, Fills or Account statement) and export it as CSV. Claude will look up the exact steps for {t.name} if you get stuck.</> })
  steps.push({ text: <>Save the file into your <b>Trading Assistant → inbox</b> folder. Any file name works.</> })
  if (t.export?.help_url) steps[0] = { ...steps[0], link: { href: t.export.help_url, label: `${t.name} help: export` } }
  return (
    <Section>
      <StepList steps={steps} />
      <div className="mt-4">
        <Callout title="How often?">Once now with as much history as you can (ideally 3 months). After that, drop a new export in whenever you like. Duplicates are skipped automatically.</Callout>
      </div>
    </Section>
  )
}

/* ---------- 8. Extras ---------- */

export function Extras({ a, set }: P) {
  const words = MARKETS.filter((m) => a.markets.includes(m.value)).flatMap((m) => m.words)
  const events = eventsFor(words, a.instruments)
  const allOn = events.every((e) => a.event_ids.includes(e.id))
  React.useEffect(() => {
    if (a.calendar && a.calendar_events && a.event_ids.length === 0 && events.length) set('event_ids', events.map((e) => e.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const calFit = fitOf(byId(a.calendar?.id))
  return (
    <>
      <LargeTitle eyebrow="Step 8" title="Extras that help" subtitle="Optional add-ons. Turn on what sounds useful; Claude sets them up for you." icon={<IconTile><Sparkles className="size-7" /></IconTile>} />
      <ListGroup header="On your phone" footer="Claude copies each morning brief to a Notion page, so you can read it on your phone before the open.">
        <ListRow icon={<Sunrise />} title="Morning brief in Notion" toggle={{ checked: a.brief_in_notion, onChange: (v) => set('brief_in_notion', v), label: 'Morning brief in Notion' }} />
      </ListGroup>
      <ListGroup
        header="Market events on your calendar"
        footer={
          a.calendar
            ? calFit === 'directory'
              ? `Claude adds these to ${a.calendar.name} each week, with times in your time zone.`
              : `Claude writes them to a calendar file you open once (works with ${a.calendar.name}).`
            : 'Pick a calendar in step 2 to turn this on. Your brief lists them either way.'
        }
      >
        <ListRow icon={<CalendarDays />} title="Add scheduled reports and Fed days" toggle={{ checked: !!a.calendar && a.calendar_events, onChange: (v) => set('calendar_events', v), label: 'Add market events' }} />
        {a.calendar && a.calendar_events && (
          <>
            {events.map((e) => (
              <ListRow
                key={e.id}
                title={e.name}
                detail={`${e.schedule.split(/[(;.]/)[0].trim()}${e.time_local ? ` · ${e.time_local} ET` : ''}`}
                accessory="check"
                checked={a.event_ids.includes(e.id)}
                onClick={() => set('event_ids', toggle(a.event_ids, e.id))}
              />
            ))}
            {events.length > 1 && <ListRow title={allOn ? 'Clear all' : 'Select all'} className="text-gold" onClick={() => set('event_ids', allOn ? [] : events.map((e) => e.id))} />}
          </>
        )}
      </ListGroup>
      <ListGroup header="Market data" footer="Claude's web search is always on. Alpha Vantage adds quotes, news sentiment and an earnings calendar with a free key (25 requests a day).">
        <ListRow icon={<Search />} title="Web search for news and calendars" value="On" />
        <ListRow icon={<Newspaper />} title="Alpha Vantage (free key)" toggle={{ checked: a.alpha_vantage, onChange: (v) => set('alpha_vantage', v), label: 'Alpha Vantage' }} />
      </ListGroup>
      <Section>
        <Callout tone="gold" title="Claude will suggest more">During setup Claude looks at what you use and suggests other connectors that could help, like Gmail for broker trade confirmations. It always asks first.</Callout>
      </Section>
    </>
  )
}

/* ---------- 9. Get the folder ---------- */

export function Folder({ a }: P) {
  const mac = a.os === 'mac'
  return (
    <>
      <LargeTitle eyebrow="Step 9" title="Get your Trading Assistant folder" subtitle="One folder on your computer holds your dashboard and your data. It never gets uploaded anywhere." icon={<IconTile><FolderOpen className="size-7" /></IconTile>} />
      <Section>
        <a href={ZIP} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-[var(--cta-ink)]" style={{ background: 'var(--cta)' }}>
          <Download className="size-5" />
          Download the folder (ZIP)
        </a>
      </Section>
      <Section>
        <StepList
          steps={
            mac
              ? [
                  { text: <>Open <b>Downloads</b> and double-click <b>Jo-s-Trading-Platform-main.zip</b>. It unzips itself.</> },
                  { text: <>Drag the new <b>Jo-s-Trading-Platform-main</b> folder into <b>Documents</b>.</> },
                  { text: <>Click the folder once, press <b>Return</b>, and rename it <b>Trading Assistant</b>.</> },
                ]
              : [
                  { text: <>Open <b>Downloads</b>, right-click <b>Jo-s-Trading-Platform-main.zip</b> and choose <b>Extract All…</b></> },
                  { text: <>Set the destination to your <b>Documents</b> folder and click <b>Extract</b>.</> },
                  { text: <>Right-click the new folder, choose <b>Rename</b>, and call it <b>Trading Assistant</b>.</> },
                ]
          }
        />
      </Section>
      {a.broker && ['export', 'advanced', 'second'].includes(fitOf(byId(a.broker.id))) && (
        <Section>
          <Callout tone="gold">Now move the trade export from step 7 into <b>Trading Assistant → inbox</b>.</Callout>
        </Section>
      )}
    </>
  )
}

/* ---------- 10. Start Claude ---------- */

export function StartClaude({ a }: P) {
  return (
    <>
      <LargeTitle eyebrow="Step 10" title="Hand it to Claude" subtitle="This is the last real step. Claude reads the folder, asks a few questions, and builds everything." icon={<IconTile><Wand2 className="size-7" /></IconTile>} />
      <Section>
        <StepList
          steps={[
            { text: <>Open <b>Claude Desktop</b> and start a new task (Cowork).</> },
            { text: <>Choose your <b>Trading Assistant</b> folder in Documents when it asks for a folder.</> },
            { text: <>Copy the prompt below, paste it in and send. Your answers from this setup are already inside.</> },
            { text: <>Claude takes it from here, one step at a time, like this page did. About 15 minutes, and it ends by opening your dashboard.</> },
          ]}
        />
      </Section>
      <Section>
        <CopyBlock text={setupPrompt(a)} label="Copy setup prompt" />
      </Section>
      <Section>
        <Callout title="Need a break partway?">Close it any time. Claude saves your progress. Later, open the Trading Assistant folder in Claude again and say <b>“continue my setup”</b>. It picks up exactly where you stopped.</Callout>
      </Section>
      <Section>
        <p className="text-[13px] leading-relaxed text-muted-foreground">Using Claude Code instead of Cowork? Open the Trading Assistant folder there and paste the same prompt. It works the same way.</p>
      </Section>
    </>
  )
}

/* ---------- 11. Keep it running ---------- */

export function KeepRunning({ a }: P) {
  return (
    <>
      <LargeTitle eyebrow="Step 11" title="Keep it running" subtitle={`Your brief is made on your computer at ${a.brief_time}. Two switches make sure it's awake then.`} icon={<IconTile><Power className="size-7" /></IconTile>} />
      <ListGroup header={`Claude Desktop → Settings → This computer → System`} footer="If your computer was asleep at brief time, Claude makes the brief as soon as it wakes. Closing a laptop lid still sleeps it.">
        <ListRow icon={<Sunrise />} title="Keep computer awake" value="On" />
        <ListRow icon={<Power />} title="Run on startup" value="On" />
      </ListGroup>
      <Section>
        <Callout tone="gold" title="Claude makes the schedule for you">At the end of setup Claude creates the weekday morning update and the weekend review, and asks you to approve them. When it asks about connector access for scheduled runs, choose <b>Allow for all scheduled runs</b>, or the morning run will wait for a click.</Callout>
      </Section>
      <Accordion type="single" collapsible className="px-5 pb-6">
        <AccordionItem value="manual" className="glass rounded-[22px] px-4">
          <AccordionTrigger className="text-[15px]">Set the schedule up by hand instead</AccordionTrigger>
          <AccordionContent>
            <StepList
              steps={[
                { text: <>In Claude Desktop, click <b>Scheduled</b> in the sidebar, then <b>New task</b>.</> },
                { text: <>Name it <b>Morning update</b>, choose your Trading Assistant folder, set <b>Weekdays</b> at {a.brief_time}.</> },
                { text: <>Paste the morning update prompt (copy below) and save.</> },
                { text: <>Repeat for <b>Weekly review</b>, set to <b>Weekly</b> on Saturday morning.</> },
              ]}
            />
            <div className="mt-4 space-y-3">
              <CopyBlock text={prompts['morning-update'].text} label="Copy morning prompt" maxHeight={140} />
              <CopyBlock text={prompts['weekly-review'].text} label="Copy weekly prompt" maxHeight={100} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}

/* ---------- 12. Daily rhythm ---------- */

export function Rhythm({ a }: P) {
  const items = [
    { icon: <Sunrise />, when: `Morning, ${a.brief_time}`, what: 'Read your brief (dashboard or Notion), then run the 2-minute check-in.', prompt: prompts.checkin },
    { icon: <NotebookPen />, when: 'After the close', what: 'Journal in Notion as usual. Or talk it through with Claude.', prompt: prompts['log-day'] },
    { icon: <CalendarDays />, when: 'Weekend', what: 'Your weekly review appears by itself.', prompt: null },
    { icon: <CircleHelp />, when: 'Any time', what: 'Ask anything about your own trading.', prompt: prompts.ask },
    { icon: <Compass />, when: 'New app?', what: 'Started using another platform or calendar? Claude finds the best way to connect it.', prompt: prompts['add-tool'] },
  ]
  return (
    <>
      <LargeTitle eyebrow="Step 12" title="Your daily rhythm" subtitle="That's it. Here's how the coach fits into a normal week." icon={<IconTile><Clock className="size-7" /></IconTile>} />
      <div className="space-y-3 px-4 pb-6">
        {items.map((it) => (
          <div key={it.when} className="glass rounded-[22px] p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[10px] bg-secondary text-gold [&_svg]:size-[18px]">{it.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">{it.when}</p>
                <p className="text-[14px] leading-snug text-muted-foreground">{it.what}</p>
              </div>
            </div>
            {it.prompt && (
              <button onClick={() => copyText(it.prompt!.text)} className="mt-3 h-10 w-full rounded-xl border border-trim text-[14.5px] font-medium text-gold hover:bg-gold/10">
                Copy “{it.prompt.title}” prompt
              </button>
            )}
          </div>
        ))}
      </div>
      <Section>
        <Callout title="Bookmark your dashboard">Open <b>Documents → Trading Assistant → dashboard.html</b> and bookmark it in your browser. It always shows the latest numbers.</Callout>
      </Section>
    </>
  )
}

/* ---------- 13. Help ---------- */

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "The morning brief didn't appear", a: <>Check that the computer was on and Claude Desktop was open. Claude runs one catch-up when it wakes. In Claude, open <b>Scheduled</b> → your task → <b>History</b> to see what happened. If it's waiting for approval, choose “Allow for all scheduled runs”.</> },
  { q: 'A connector says it expired', a: <>Go to <b>Customize → Connectors</b>, open it, and click <b>Connect</b> again to sign back in.</> },
  { q: 'The dashboard says “Not set up yet”', a: <>Setup hasn't finished, or the data file wasn't built. Paste the “Fix something” prompt into Claude with the Trading Assistant folder selected.</> },
  { q: "Claude didn't recognise my CSV", a: <>That's normal the first time. Claude shows a 5-row preview and asks which column is which, then remembers it.</> },
  { q: 'Times on the dashboard look shifted', a: <>Your time zone is probably wrong. Ask Claude: “Set my Trading Assistant time zone to …”.</> },
]

export function Help() {
  return (
    <>
      <LargeTitle eyebrow="Help" title="If something's off" subtitle="Most fixes are one prompt. Paste “Fix something” into Claude and describe what you see." icon={<IconTile><CircleHelp className="size-7" /></IconTile>} />
      <Section>
        <CopyBlock text={prompts.fix.text} label="Copy “Fix something”" maxHeight={120} />
      </Section>
      <Section>
        <FieldLabel>Stopped partway through setup?</FieldLabel>
        <CopyBlock text={prompts['continue-setup'].text} label="Copy “Continue my setup”" maxHeight={100} />
      </Section>
      <div className="px-4 pb-6">
      <Accordion type="single" collapsible className="glass overflow-hidden rounded-[22px]">
        {FAQ.map((f, i) => (
          <AccordionItem key={i} value={String(i)} className="border-border px-4 last:border-b-0">
            <AccordionTrigger className="text-[15.5px]">{f.q}</AccordionTrigger>
            <AccordionContent className="text-[14.5px] leading-relaxed text-foreground/85">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      </div>
      <Section>
        <Callout tone="gold" title="Plan B: phone only">
          Rather not leave a computer on? Claude can run the morning update in the cloud instead: it reads your platform connector and Notion and writes the brief to a Notion page you read on your phone. You lose the local dashboard but keep the brief and can still ask questions. Tell Claude: “Switch my Trading Assistant to phone-only mode.”
        </Callout>
      </Section>
      <Section>
        <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">Educational and journaling tool. Not investment advice. Trading Assistant never places, changes or suggests trades.</p>
      </Section>
    </>
  )
}

