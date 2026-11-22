# Graph Report - wt-trading-coach  (2026-11-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1449 nodes · 3349 edges · 75 communities (59 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e2aaa5f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72

## God Nodes (most connected - your core abstractions)
1. `tn` - 130 edges
2. `n()` - 58 edges
3. `a()` - 40 edges
4. `s()` - 35 edges
5. `o()` - 32 edges
6. `ho()` - 29 edges
7. `render()` - 29 edges
8. `Ba` - 28 edges
9. `d()` - 25 edges
10. `react` - 25 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `BottomBar()`  [EXTRACTED]
  wizard/src/App.tsx → wizard/src/components/ios/index.tsx
- `Help()` --calls--> `FieldLabel()`  [EXTRACTED]
  wizard/src/pages.tsx → wizard/src/components/ios/index.tsx
- `Journal()` --calls--> `FieldLabel()`  [EXTRACTED]
  wizard/src/pages.tsx → wizard/src/components/ios/index.tsx
- `Welcome()` --calls--> `FieldLabel()`  [EXTRACTED]
  wizard/src/pages.tsx → wizard/src/components/ios/index.tsx
- `Extras()` --calls--> `ListGroup()`  [EXTRACTED]
  wizard/src/pages.tsx → wizard/src/components/ios/index.tsx

## Import Cycles
- None detected.

## Communities (75 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (107): accountTrades(), addDays(), applyLayout(), applyOrder(), arrow(), axis(), baseVisibility(), boot() (+99 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (20): beforeLayout(), buildLookupTable(), cn(), draw(), dt(), fo(), getDecimalForValue(), getValueForPixel() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (14): Bt(), Ft(), Gt(), It(), jt(), kt(), mt(), qt() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (39): brief(), byDayOfWeek(), byTimeOfDay(), checkCurrency(), cmpKey(), dailyLossStatus(), dailyPnl(), equityCurve() (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (4): an(), on, rn(), sn

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): Bn(), _calculateBarIndexPixels(), _calculateBarValuePixels(), getLabelAndValue(), getMaxOverflow(), getPixelForTick(), getPixelForValue(), _getRuler() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (12): class-variance-authority, cn, radix-ui, react, class-variance-authority@^0.7.1, radix-ui@^1.8.1, Badge(), badgeVariants (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (21): col(), Ctx, from_fills(), from_round_trips(), load_mapping(), Lot, main(), make_trade_id() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (4): fn(), gn(), n(), xn()

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (21): addElements(), bs(), ct(), es(), Fs(), ge(), is(), ks() (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (25): oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (5): d(), Di(), Pn(), qi(), i()

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (23): BottomBar(), ChipInput(), Chips(), FieldLabel(), GoldButton(), ListGroup(), ListRow(), NumberField() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (4): at(), initialize(), rt(), w()

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (5): _generate(), _getTimestampsForTable(), ho(), nt(), Vo()

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (23): build_brief(), build_insights(), build_sample(), confidence(), entry_minutes(), fnum(), generate_days(), journal_ids_for() (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (6): a(), Ee(), Le(), Oi(), Si(), ya()

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (20): Category, claudeFacts, eventsFor(), Fit, fitExplain, fitLabel, MACRO, MarketEvent (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (17): lucide-react, App(), initialIndex(), PageDef, PAGES, useTheme(), AppShell(), NavBar() (+9 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (5): afterInit(), Ba, f(), Va(), za()

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (3): DoctorTests, make_folder(), SampleTests

### Community 23 - "Community 23"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 24 - "Community 24"
Cohesion: 0.28
Nodes (22): Callout(), copyText(), IconTile(), LargeTitle(), Section(), StepList(), byId(), fitOf() (+14 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (20): b(), dn(), e(), ei(), eo(), fe(), g(), gi() (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.10
Nodes (15): Be(), et(), getCenterPoint(), _i(), ji(), ko(), label(), ne() (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (17): beforeDatasetDraw(), beforeDatasetsDraw(), beforeDraw(), ca, da(), ea(), fa(), ga() (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.10
Nodes (20): @fontsource/great-vibes, @fontsource-variable/geist, @paper-design/shaders-react, react-dom, shadcn, sonner, tw-animate-css, vaul (+12 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (18): Answers, answersYaml(), defaults(), detectTz(), linkName(), load(), MARKETS, memory (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (16): ai(), dataset(), hi(), index(), nearest(), pi(), q(), r() (+8 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (5): ce(), de, en, he(), te()

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (11): compute(), compute_from(), first15(), hour_bucket(), confidence(), group(), load(), _local() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.19
Nodes (3): Ae(), Ie(), ze()

### Community 38 - "Community 38"
Cohesion: 0.13
Nodes (7): Bi(), Ci(), Fi(), io(), no(), oo, zi()

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.20
Nodes (10): build(), check_insights(), check_journal(), _is_iso_with_offset(), load_json(), load_trades(), main(), ValidationError (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.17
Nodes (13): ao(), co(), Do(), ha(), inRange(), inXRange(), inYRange(), K() (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.30
Nodes (3): NormalizeTests, read_trades(), write_csv()

### Community 44 - "Community 44"
Cohesion: 0.14
Nodes (7): events, groups, root, tools, check, { prompts }, root

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (4): bo, H(), j(), xo()

### Community 47 - "Community 47"
Cohesion: 0.42
Nodes (9): check(), _data_js(), _load_json(), load_state(), main(), mark(), _p(), report() (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (3): committed(), TestNoPersonalData, tracked()

### Community 49 - "Community 49"
Cohesion: 0.27
Nodes (11): TextField(), Drawn, GOLD, hasWebGL2(), Metal(), MetalCrest(), MetalText(), reducedMotion() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (7): aa(), afterDatasetsUpdate(), generateLabels(), ki(), lo(), ra(), wi()

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (10): brief_time, computer, instruments, layout_preset, markets, name, setups, style (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (8): daily_loss_limit, trailing_drawdown, risk, default_risk_per_trade, max_daily_loss, max_trades_per_day, prop_rules, stop_after_consecutive_losses

### Community 56 - "Community 56"
Cohesion: 0.50
Nodes (7): CopyBlock(), Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), Help(), KeepRunning()

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, files, @catalog/*, @prompts/*, references

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (6): catalog_id, category, fit, name, path, broker

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (6): catalog_id, category, fit, name, path, calendar

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (6): catalog_id, category, fit, name, path, journal

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (6): scripts, build, check, dev, lint, preview

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (3): buildTicks(), init(), mo()

### Community 68 - "Community 68"
Cohesion: 0.40
Nodes (5): tools, charting, news, other, to_research

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (4): notion, brief_page, journal_location, journal_shape

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (3): calendar, add_market_events, event_ids

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (3): market_data, alpha_vantage, web_search

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (3): session, end, start

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tn` connect `Community 10` to `Community 1`, `Community 34`, `Community 67`, `Community 58`, `Community 37`, `Community 4`, `Community 39`, `Community 12`, `Community 45`, `Community 15`, `Community 26`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06676860346585117 - nodes in this community are weakly interconnected._
- **Why does `zt()` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0331225534477567 - nodes in this community are weakly interconnected._
- **Why does `n()` connect `Community 8` to `Community 32`, `Community 1`, `Community 34`, `Community 2`, `Community 58`, `Community 5`, `Community 38`, `Community 39`, `Community 37`, `Community 9`, `Community 42`, `Community 15`, `Community 53`, `Community 25`, `Community 26`, `Community 27`, `Community 29`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06037414965986394 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08985507246376812 - nodes in this community are weakly interconnected._