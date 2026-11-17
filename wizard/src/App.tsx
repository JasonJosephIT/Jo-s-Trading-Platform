import * as React from 'react'
import { Check } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { AppShell, BottomBar, NavBar, StepProgress } from '@/components/ios'
import { useAnswers, type Answers } from '@/lib/state'
import { cn } from '@/lib/utils'
import * as Pages from './pages'

type PageDef = {
  id: string
  title: string
  Comp: React.ComponentType<{ a: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; go: (id: string) => void }>
  cta?: string
  ready?: (a: Answers) => boolean
  hint?: (a: Answers) => string | undefined
}

const PAGES: PageDef[] = [
  { id: 'welcome', title: 'Welcome', Comp: Pages.Welcome, cta: 'Get started' },
  { id: 'toolkit', title: 'What you use', Comp: Pages.Toolkit, cta: 'Check compatibility' },
  { id: 'fit', title: 'How your tools fit', Comp: Pages.Compatibility, cta: 'Looks good' },
  { id: 'trading', title: 'About your trading', Comp: Pages.Trading, ready: (a) => a.markets.length > 0, hint: (a) => (a.markets.length ? undefined : 'Pick at least one market.') },
  { id: 'risk', title: 'Risk rules', Comp: Pages.Risk },
  { id: 'journal', title: 'Journal', Comp: Pages.Journal, cta: "I've connected it" },
  { id: 'platform', title: 'Your trades', Comp: Pages.Platform, cta: 'Done' },
  { id: 'extras', title: 'Extras', Comp: Pages.Extras },
  { id: 'folder', title: 'Get the folder', Comp: Pages.Folder, cta: 'Folder is in Documents' },
  { id: 'claude', title: 'Hand it to Claude', Comp: Pages.StartClaude, cta: 'I sent the prompt' },
  { id: 'running', title: 'Keep it running', Comp: Pages.KeepRunning, cta: 'Both switches are on' },
  { id: 'rhythm', title: 'Daily rhythm', Comp: Pages.Rhythm, cta: 'Finish' },
  { id: 'help', title: 'Help', Comp: Pages.Help, cta: 'Back to start' },
]

function initialIndex() {
  const id = typeof location !== 'undefined' ? location.hash.replace('#', '') : ''
  const i = PAGES.findIndex((p) => p.id === id)
  return i >= 0 ? i : 0
}

function useTheme() {
  const [dark, setDark] = React.useState(() => {
    try {
      const saved = localStorage.getItem('trading-coach-theme')
      if (saved) return saved === 'dark'
    } catch {
      /* ignore */
    }
    return true
  })
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('trading-coach-theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}

export default function App() {
  const { a, set } = useAnswers()
  const { dark, toggle } = useTheme()
  const [index, setIndex] = React.useState(initialIndex)
  const [dir, setDir] = React.useState<'forward' | 'back'>('forward')
  const [sheet, setSheet] = React.useState(false)
  const [furthest, setFurthest] = React.useState(index)
  const scroller = React.useRef<HTMLDivElement>(null)
  const page = PAGES[index]

  const goIndex = React.useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(PAGES.length - 1, i))
      setDir(next >= index ? 'forward' : 'back')
      setIndex(next)
      setFurthest((f) => Math.max(f, next))
    },
    [index],
  )
  const go = React.useCallback((id: string) => goIndex(PAGES.findIndex((p) => p.id === id)), [goIndex])

  React.useEffect(() => {
    try {
      history.replaceState(null, '', `#${PAGES[index].id}`)
    } catch {
      /* some browsers block this on file:// */
    }
    scroller.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [index])

  // Links like setup.html#claude open that step.
  React.useEffect(() => {
    const onHash = () => {
      const i = PAGES.findIndex((p) => p.id === location.hash.replace('#', ''))
      if (i >= 0 && i !== index) goIndex(i)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [index, goIndex])

  // Swipe in from the left edge to go back, like an iPhone app.
  const touch = React.useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current
    touch.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = Math.abs(e.changedTouches[0].clientY - t.y)
    if (t.x < 40 && dx > 80 && dy < 60 && index > 0) goIndex(index - 1)
  }

  const ready = page.ready ? page.ready(a) : true
  const isLast = index === PAGES.length - 1
  const Comp = page.Comp

  return (
    <AppShell>
      <Toaster position="top-center" theme={dark ? 'dark' : 'light'} />
      <NavBar title={index === 0 ? undefined : page.title} onBack={index > 0 ? () => goIndex(index - 1) : undefined} onSteps={() => setSheet(true)} dark={dark} onToggleTheme={toggle} />
      <StepProgress total={PAGES.length} current={index} />
      <div ref={scroller} className="flex flex-1 flex-col md:overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <main key={page.id} className={cn('flex-1 pt-2', dir === 'forward' ? 'page-forward' : 'page-back')}>
          <Comp a={a} set={set} go={go} />
        </main>
        <BottomBar
          primary={page.cta ?? 'Continue'}
          disabled={!ready}
          hint={page.hint?.(a)}
          onPrimary={() => goIndex(isLast ? 0 : index + 1)}
          secondary={index === 0 ? 'I already set this up' : undefined}
          onSecondary={() => go('rhythm')}
        />
      </div>

      <Drawer open={sheet} onOpenChange={setSheet}>
        <DrawerContent className="mx-auto max-w-[460px] bg-popover">
          <DrawerHeader>
            <DrawerTitle>All steps</DrawerTitle>
            <DrawerDescription>Jump to any step. Your answers are saved on this device.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-6">
            {PAGES.map((p, i) => {
              const done = i < furthest && i !== index
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSheet(false)
                    goIndex(i)
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left', i === index ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.04]')}
                >
                  <span
                    className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular', done ? 'text-[var(--cta-ink)]' : 'border border-trim text-gold')}
                    style={done ? { background: 'var(--cta)' } : undefined}
                  >
                    {done ? <Check className="size-4" strokeWidth={3} /> : i}
                  </span>
                  <span className="flex-1 text-[16px]">{p.title}</span>
                  {i === index && <span className="text-[13px] text-gold">Here</span>}
                </button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </AppShell>
  )
}
