/* iPhone-style building blocks for the setup flow, built on shadcn/ui.
   AppShell · NavBar · StepProgress · LargeTitle · ListGroup/ListRow · Segmented
   BottomBar · CopyBlock · ChipInput · StepList · Callout · ToolBadge */
import * as React from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Info, ListChecks, Moon, Plus, Sun, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/* ---------- Shell ---------- */

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full md:flex md:items-center md:justify-center md:p-6" style={{ background: 'var(--app-bg)' }}>
      <div
        className={cn(
          'glass-orbs relative isolate mx-auto flex min-h-dvh w-full flex-col',
          'md:min-h-0 md:h-[min(900px,calc(100dvh-48px))] md:max-w-[460px] md:overflow-hidden md:rounded-[44px] md:gold-trim',
          'md:shadow-[0_40px_120px_-30px_rgba(74,31,148,.65),0_0_0_8px_rgba(7,4,13,.55)]',
        )}
        style={{ background: 'var(--app-bg)' }}
      >
        {children}
      </div>
    </div>
  )
}

export function NavBar({
  title,
  onBack,
  onSteps,
  dark,
  onToggleTheme,
}: {
  title?: string
  onBack?: () => void
  onSteps?: () => void
  dark: boolean
  onToggleTheme: () => void
}) {
  return (
    <div className="sticky top-0 z-20 flex h-12 items-center gap-1 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="w-24 shrink-0">
        {onBack && (
          <button onClick={onBack} className="glass press flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3.5 text-[16px] font-medium text-gold outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="size-6" strokeWidth={2.2} />
            Back
          </button>
        )}
      </div>
      <div className="flex-1 truncate text-center text-[15px] font-semibold tracking-tight text-foreground/90">{title}</div>
      <div className="glass flex w-auto justify-end gap-0 rounded-full p-0.5">
        <button aria-label={dark ? 'Use light mode' : 'Use dark mode'} onClick={onToggleTheme} className="press grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none">
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        {onSteps && (
          <button aria-label="All steps" onClick={onSteps} className="press grid size-9 place-items-center rounded-full text-gold focus-visible:ring-2 focus-visible:ring-ring outline-none">
            <ListChecks className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function StepProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1 px-5 pb-1" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/10">
          <div className={cn('h-full rounded-full transition-all duration-500', i <= current ? 'w-full' : 'w-0')} style={{ background: 'var(--cta)' }} />
        </div>
      ))}
    </div>
  )
}

export function LargeTitle({ eyebrow, title, subtitle, icon }: { eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <header className="px-5 pt-4 pb-5">
      {icon && <div className="mb-4">{icon}</div>}
      {eyebrow && <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-gold">{eyebrow}</p>}
      <h1 className="text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-balance">{title}</h1>
      {subtitle && <p className="mt-2.5 text-[16px] leading-relaxed text-muted-foreground text-pretty">{subtitle}</p>}
    </header>
  )
}

export function IconTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid size-14 place-items-center rounded-[18px] gold-trim text-gold', className)} style={{ background: 'var(--hero-bg)' }}>
      {children}
    </div>
  )
}

/* ---------- Grouped lists (iOS Settings style) ---------- */

export function ListGroup({ header, footer, children, className }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('px-4 pb-6', className)}>
      {header && <h2 className="px-4 pb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{header}</h2>}
      <div className="glass overflow-hidden rounded-[22px] [&>*+*]:border-t [&>*+*]:border-border">{children}</div>
      {footer && <p className="px-4 pt-2 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  )
}

type RowProps = {
  icon?: React.ReactNode
  title: React.ReactNode
  detail?: React.ReactNode
  value?: React.ReactNode
  onClick?: () => void
  href?: string
  accessory?: 'chevron' | 'check' | 'external' | 'none'
  checked?: boolean
  toggle?: { checked: boolean; onChange: (v: boolean) => void; label: string }
  className?: string
  children?: React.ReactNode
}

export function ListRow({ icon, title, detail, value, onClick, href, accessory, checked, toggle, className, children }: RowProps) {
  const body = (
    <>
      {icon && <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-secondary text-gold [&_svg]:size-[18px]">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-snug">{title}</span>
        {detail && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{detail}</span>}
        {children}
      </span>
      {value && <span className="shrink-0 text-[15px] text-muted-foreground">{value}</span>}
      {toggle && <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} aria-label={toggle.label} className="data-[state=checked]:bg-gold" />}
      {accessory === 'chevron' && <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />}
      {accessory === 'external' && <ExternalLink className="size-4 shrink-0 text-gold" />}
      {accessory === 'check' && (
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border transition-colors', checked ? 'border-transparent text-[var(--cta-ink)]' : 'border-foreground/25')} style={checked ? { background: 'var(--cta)' } : undefined}>
          {checked && <Check className="size-4" strokeWidth={3} />}
        </span>
      )}
    </>
  )
  const cls = cn('flex w-full items-center gap-3 px-4 py-3 text-left min-h-[52px]', (onClick || href) && 'transition-colors hover:bg-foreground/[0.04] active:bg-foreground/[0.07] outline-none focus-visible:bg-foreground/[0.06]', className)
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} role={accessory === 'check' ? 'checkbox' : undefined} aria-checked={accessory === 'check' ? !!checked : undefined}>
        {body}
      </button>
    )
  return <div className={cls}>{body}</div>
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      spacing={0}
      className="glass w-full rounded-full p-[3px]"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="press h-9 flex-1 rounded-full text-[14px] font-medium text-foreground/80 transition-[background,box-shadow] duration-200 data-[state=on]:bg-[var(--glass-fill-strong)] data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_1px_0_var(--glass-rim),0_4px_12px_-4px_rgba(0,0,0,.35)]"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/* ---------- Bottom CTA bar ---------- */

export function BottomBar({ primary, onPrimary, secondary, onSecondary, disabled, hint }: { primary: string; onPrimary: () => void; secondary?: string; onSecondary?: () => void; disabled?: boolean; hint?: string }) {
  return (
    <div className="sticky bottom-0 z-20 mt-auto px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(to top, color-mix(in oklab, var(--background) 70%, transparent) 40%, transparent)' }}>
      {hint && <p className="pb-2 text-center text-[13px] text-muted-foreground">{hint}</p>}
      <GoldButton onClick={onPrimary} disabled={disabled}>
        {primary}
      </GoldButton>
      {secondary && (
        <Button variant="ghost" onClick={onSecondary} className="mt-1.5 h-11 w-full rounded-2xl text-[16px] text-gold hover:bg-transparent hover:text-gold/80">
          {secondary}
        </Button>
      )}
    </div>
  )
}

export function GoldButton({ children, className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={cn(
        'glass-gold press h-[54px] w-full rounded-full text-[17px] font-semibold tracking-tight text-[var(--cta-ink)] hover:brightness-105 disabled:opacity-40 disabled:shadow-none outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------- Copyable prompt ---------- */

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } finally {
      ta.remove()
    }
  }
  toast.success('Copied. Paste it into Claude.')
}

export function CopyBlock({ text, label = 'Copy prompt', maxHeight = 260 }: { text: string; label?: string; maxHeight?: number }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="overflow-hidden rounded-2xl gold-trim bg-[#0c0618] text-[#efe7fb]">
      <pre className="overflow-auto px-4 pt-4 pb-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words" style={{ maxHeight }}>
        {text}
      </pre>
      <div className="flex justify-end border-t border-white/10 p-2">
        <button
          onClick={async () => {
            await copyText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          }}
          className="flex h-10 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold text-[var(--cta-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[#dcb64f]"
          style={{ background: 'var(--cta)' }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : label}
        </button>
      </div>
    </div>
  )
}

/* ---------- Chips ---------- */

export function Chips({ options, selected, onToggle, label }: { options: { value: string; label: string; hint?: string }[]; selected: string[]; onToggle: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={cn(
              'press flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'glass-gold font-medium text-[var(--cta-ink)]' : 'glass text-foreground/90',
            )}
          >
            {on && <Check className="size-3.5" strokeWidth={3} />}
            {o.label}
            {o.hint && <span className={cn('text-[12px]', on ? 'opacity-70' : 'text-muted-foreground')}>{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ChipInput({ values, onChange, placeholder, label }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; label: string }) {
  const [draft, setDraft] = React.useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setDraft('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="flex min-h-9 items-center gap-1 glass rounded-full pl-3.5 pr-1 text-[15px]">
            {v}
            <button aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-7 place-items-center rounded-full text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-row px-3.5 text-[16px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button onClick={add} aria-label="Add" className="grid size-11 place-items-center rounded-xl text-[var(--cta-ink)]" style={{ background: 'var(--cta)' }}>
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  )
}

/* ---------- Instructions ---------- */

export type Step = { text: React.ReactNode; link?: { href: string; label: string } }

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-[var(--cta-ink)] tabular" style={{ background: 'var(--cta)' }}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5 text-[15.5px] leading-relaxed">
            {s.text}
            {s.link && (
              <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="mt-2 flex w-fit items-center gap-1.5 rounded-full border border-trim px-3 py-1.5 text-[14px] font-medium text-gold hover:bg-gold/10">
                {s.link.label}
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Callout({ children, tone = 'info', title }: { children: React.ReactNode; tone?: 'info' | 'gold' | 'warn'; title?: string }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border p-4 text-[14.5px] leading-relaxed',
        tone === 'gold' && 'gold-trim border-transparent bg-gold/[0.08]',
        tone === 'info' && 'glass border-transparent',
        tone === 'warn' && 'border-destructive/40 bg-destructive/10',
      )}
    >
      <Info className={cn('mt-0.5 size-[18px] shrink-0', tone === 'warn' ? 'text-destructive' : 'text-gold')} />
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pb-6', className)}>{children}</div>
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </label>
  )
}

export function TextField(props: React.ComponentProps<'input'>) {
  return <input {...props} className={cn('h-12 w-full rounded-xl border border-input bg-row px-4 text-[16px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring tabular', props.className)} />
}

export function NumberField({ value, onChange, prefix, suffix, label, id }: { value: number | null; onChange: (v: number | null) => void; prefix?: string; suffix?: string; label: string; id?: string }) {
  return (
    <div className="flex h-12 items-center rounded-xl border border-input bg-row px-4 focus-within:ring-2 focus-within:ring-ring">
      {prefix && <span className="mr-1 text-muted-foreground">{prefix}</span>}
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '')
          onChange(raw === '' ? null : Number(raw))
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none tabular"
      />
      {suffix && <span className="ml-1 text-muted-foreground">{suffix}</span>}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 20, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-[11px] bg-foreground/[0.07] p-[3px]" role="group" aria-label={label}>
      <button aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-8 w-10 place-items-center rounded-[9px] text-[20px] leading-none disabled:opacity-30 hover:bg-foreground/10">
        −
      </button>
      <span className="w-8 text-center text-[16px] font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <button aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-8 w-10 place-items-center rounded-[9px] text-[20px] leading-none disabled:opacity-30 hover:bg-foreground/10">
        +
      </button>
    </div>
  )
}

export function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? <Sun /> : <Moon />
}
