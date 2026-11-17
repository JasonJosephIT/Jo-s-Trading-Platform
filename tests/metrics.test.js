'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../assets/metrics.js');

const profile = { timezone: 'America/New_York', default_risk_per_trade: 100, max_daily_loss: 300, prop_rules: { trailing_drawdown: 500, daily_loss_limit: null } };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, (msg || '') + ' expected ' + b + ' got ' + a);

function T(id, entry, exit, pnl, risk, src, extra) {
  return Object.assign({
    trade_id: id, account: 'A', symbol: 'CL', side: 'long', qty: 1,
    entry_time: entry, exit_time: exit, pnl_gross: pnl, pnl_net: pnl,
    initial_risk: risk, risk_source: src, tags: []
  }, extra || {});
}

// Fixture (all Nov 2026, EST, -05:00). pnl_net, risk (null = default 100):
//  t1  Mon 11-02 09:35  +200 risk 100 journal    R +2
//  t2  Mon 11-02 10:10  -100 risk 100 journal    R -1   tag revenge
//  t3  Tue 11-03 10:30  +300 risk 150 broker     R +2
//  t4  Wed 11-04 10:35  -150 risk 150 broker     R -1
//  t5  Wed 11-04 11:05  -100 default             R -1   tags revenge, fomo
//  t6  Thu 11-05 09:50     0 default             R  0   (scratch)
//  t7  Fri 11-06 09:20  +100 default             R +1
//  t8  Mon 11-09 14:00  -200 risk 100 journal    R -2   tag moved_stop
//  t9  Tue 11-10 10:00  +400 risk 200 journal    R +2
//  t10 Wed 11-11 10:45   -50 default             R -0.5
//
// Hand calculation:
//  n=10, wins=4 (t1,t3,t7,t9), losses=5, scratches=1
//  netPnl = 200-100+300-150-100+0+100-200+400-50 = 400
//  grossProfit = 1000, grossLoss = 600 -> PF = 1000/600 = 1.6667; ex largest win (400): 600/600 = 1
//  winRate = 4/(4+5) = 0.4444 (scratch excluded); avgWin = 250; avgLoss = 120; payoff = 2.0833
//  R: 2,-1,2,-1,-1,0,1,-2,2,-0.5 -> netR = 1.5, avgR = 0.15
//  expectancyR = 0.4*avgWinR(1.75) - 0.5*avgLossR(1.1) = 0.70 - 0.55 = 0.15
//  cum: 200,100,400,250,150,150,250,50,450,400 -> max DD = 400->50 = 350; recovery = 400/350
//  cumR: 2,1,3,2,1,1,2,0,2,1.5 -> max DD R = 3 -> 0 = 3
//  streaks sequence W L W L L S W L W L -> longestWin 1, longestLoss 2, current loss x1
const fixture = [
  T('t1', '2026-11-02T09:35:00-05:00', '2026-11-02T09:50:00-05:00', 200, 100, 'journal'),
  T('t2', '2026-11-02T10:10:00-05:00', '2026-11-02T10:20:00-05:00', -100, 100, 'journal', { tags: ['revenge'] }),
  T('t3', '2026-11-03T10:30:00-05:00', '2026-11-03T11:00:00-05:00', 300, 150, 'broker_stop'),
  T('t4', '2026-11-04T10:35:00-05:00', '2026-11-04T10:50:00-05:00', -150, 150, 'broker_stop'),
  T('t5', '2026-11-04T11:05:00-05:00', '2026-11-04T11:20:00-05:00', -100, null, null, { tags: ['revenge', 'fomo'] }),
  T('t6', '2026-11-05T09:50:00-05:00', '2026-11-05T10:00:00-05:00', 0, null, null),
  T('t7', '2026-11-06T09:20:00-05:00', '2026-11-06T09:40:00-05:00', 100, null, null),
  T('t8', '2026-11-09T14:00:00-05:00', '2026-11-09T14:10:00-05:00', -200, 100, 'journal', { tags: ['moved_stop'] }),
  T('t9', '2026-11-10T10:00:00-05:00', '2026-11-10T10:30:00-05:00', 400, 200, 'journal'),
  T('t10', '2026-11-11T10:45:00-05:00', '2026-11-11T11:00:00-05:00', -50, null, null)
];

test('riskOf: trade risk, then default, then null', () => {
  assert.deepStrictEqual(M.riskOf(fixture[0], profile), { risk: 100, source: 'journal' });
  assert.deepStrictEqual(M.riskOf(fixture[2], profile), { risk: 150, source: 'broker_stop' });
  assert.deepStrictEqual(M.riskOf(fixture[4], profile), { risk: 100, source: 'default' });
  assert.deepStrictEqual(M.riskOf(fixture[4], {}), { risk: null, source: null });
  assert.strictEqual(M.rOf(fixture[4], {}), null);
  assert.strictEqual(M.rOf(fixture[8], profile), 2);
});

test('summarize: hand-calculated KPIs', () => {
  const s = M.summarize(fixture, profile);
  assert.strictEqual(s.n, 10);
  assert.strictEqual(s.wins, 4);
  assert.strictEqual(s.losses, 5);
  assert.strictEqual(s.scratches, 1);
  assert.strictEqual(s.netPnl, 400);
  assert.strictEqual(s.grossProfit, 1000);
  assert.strictEqual(s.grossLoss, 600);
  close(s.winRate, 4 / 9);
  assert.strictEqual(s.avgWin, 250);
  assert.strictEqual(s.avgLoss, 120);
  close(s.payoff, 250 / 120);
  close(s.profitFactor, 1000 / 600);
  assert.strictEqual(s.profitFactorExLargest, 1);
  assert.strictEqual(s.netR, 1.5);
  close(s.avgR, 0.15);
  close(s.expectancyR, 0.15);
  assert.strictEqual(s.rCoverage, 1);
  assert.strictEqual(s.maxDrawdown, 350);
  assert.strictEqual(s.maxDrawdownR, 3);
  close(s.recoveryFactor, 400 / 350);
  assert.deepStrictEqual(s.streaks, { longestWin: 1, longestLoss: 2, current: { kind: 'loss', length: 1 } });
  assert.strictEqual(s.reliability, 'early');
});

test('summarize is order independent (sorts by exit_time)', () => {
  const s = M.summarize(fixture.slice().reverse(), profile);
  assert.strictEqual(s.maxDrawdown, 350);
  assert.strictEqual(s.netPnl, 400);
});

test('edge: zero trades', () => {
  const s = M.summarize([], profile);
  assert.strictEqual(s.n, 0);
  assert.strictEqual(s.netPnl, 0);
  assert.strictEqual(s.winRate, null);
  assert.strictEqual(s.profitFactor, null);
  assert.strictEqual(s.expectancyR, null);
  assert.strictEqual(s.rCoverage, 0);
  assert.strictEqual(s.reliability, 'none');
  assert.deepStrictEqual(M.equityCurve([], profile), []);
  assert.deepStrictEqual(M.rDistribution([], profile), []);
});

test('edge: all wins gives Infinity profit factor', () => {
  const wins = [
    T('w1', '2026-11-02T09:35:00-05:00', '2026-11-02T09:50:00-05:00', 100, 100, 'journal'),
    T('w2', '2026-11-03T09:35:00-05:00', '2026-11-03T09:50:00-05:00', 50, 100, 'journal')
  ];
  const s = M.summarize(wins, profile);
  assert.strictEqual(s.profitFactor, Infinity);
  assert.strictEqual(s.profitFactorExLargest, Infinity);
  assert.strictEqual(s.winRate, 1);
  assert.strictEqual(s.avgLoss, null);
  assert.strictEqual(s.payoff, null);
  assert.strictEqual(s.recoveryFactor, null);
});

test('edge: missing risk falls back to default, then null', () => {
  const noRisk = [T('x1', '2026-11-02T09:35:00-05:00', '2026-11-02T09:50:00-05:00', 100, null, null)];
  const withDefault = M.summarize(noRisk, profile);
  assert.strictEqual(withDefault.rCoverage, 1);
  assert.strictEqual(withDefault.netR, 1);
  const none = M.summarize(noRisk, { timezone: 'UTC' });
  assert.strictEqual(none.rCoverage, 0);
  assert.strictEqual(none.netR, null);
  assert.strictEqual(none.expectancyR, null);
  assert.strictEqual(none.maxDrawdownR, null);
  assert.strictEqual(none.netPnl, 100);
});

test('edge: mixed currencies throws', () => {
  const mixed = [
    Object.assign({}, fixture[0], { currency: 'USD' }),
    Object.assign({}, fixture[1], { currency: 'EUR' })
  ];
  assert.throws(() => M.summarize(mixed, profile), /mixed currencies/);
});

test('equityCurve', () => {
  const c = M.equityCurve(fixture, profile);
  assert.strictEqual(c.length, 10);
  assert.deepStrictEqual(c.map(p => p.cum), [200, 100, 400, 250, 150, 150, 250, 50, 450, 400]);
  assert.deepStrictEqual(c.map(p => p.cumR), [2, 1, 3, 2, 1, 1, 2, 0, 2, 1.5]);
  assert.strictEqual(c[7].peak, 400);
  assert.strictEqual(c[7].drawdown, 350);
  assert.strictEqual(c[1].ruleBreak, true);
  assert.strictEqual(c[0].ruleBreak, false);
  const planBreak = M.equityCurve([Object.assign({}, fixture[0], { followed_plan: false })], profile);
  assert.strictEqual(planBreak[0].ruleBreak, true);
});

test('localParts and DST-crossing bucketing', () => {
  // US fall-back 2026-11-01: 04:30Z is 00:30 EDT, 05:30Z is 01:30 EST (clock repeats 01:00-02:00 local).
  assert.deepStrictEqual(M.localParts('2026-11-01T04:30:00Z', 'America/New_York'), { date: '2026-11-01', weekday: 6, minutes: 30 });
  assert.deepStrictEqual(M.localParts('2026-11-01T06:30:00Z', 'America/New_York'), { date: '2026-11-01', weekday: 6, minutes: 90 });
  // spring-forward 2026-03-08: 06:59Z is 01:59 EST, 07:00Z is 03:00 EDT
  assert.strictEqual(M.localParts('2026-03-08T06:59:00Z', 'America/New_York').minutes, 119);
  assert.strictEqual(M.localParts('2026-03-08T07:00:00Z', 'America/New_York').minutes, 180);
  assert.strictEqual(M.localParts('2026-11-02T14:35:00Z', 'America/New_York').weekday, 0); // Monday

  // Same local 09:35 entry on either side of the DST change lands in the same bucket.
  const across = [
    T('d1', '2026-10-30T09:35:00-04:00', '2026-10-30T09:50:00-04:00', 10, 100, 'journal'),
    T('d2', '2026-11-02T09:35:00-05:00', '2026-11-02T09:50:00-05:00', 20, 100, 'journal')
  ];
  const b = M.byTimeOfDay(across, profile);
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].key, '09:30');
  assert.strictEqual(b[0].n, 2);
});

test('byTimeOfDay (30 min) and custom bucket size', () => {
  const b = M.byTimeOfDay(fixture, profile);
  const byKey = Object.fromEntries(b.map(x => [x.key, x]));
  assert.deepStrictEqual(b.map(x => x.key), ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00']);
  assert.strictEqual(byKey['09:30'].n, 2);
  assert.strictEqual(byKey['09:30'].netPnl, 200);
  assert.strictEqual(byKey['10:00'].netPnl, 300);
  assert.strictEqual(byKey['10:30'].netPnl, 100);
  assert.strictEqual(byKey['14:00'].netPnl, -200);
  const hourly = M.byTimeOfDay(fixture, profile, 60);
  assert.strictEqual(hourly.find(x => x.key === '10:00').n, 5);
});

test('byDayOfWeek always lists Mon-Fri', () => {
  const d = M.byDayOfWeek(fixture, profile);
  assert.deepStrictEqual(d.map(x => x.key), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  assert.strictEqual(d[0].n, 3);
  assert.strictEqual(d[0].netPnl, -100);
  close(d[0].winRate, 1 / 3);
  assert.strictEqual(d[1].netPnl, 700);
  assert.strictEqual(d[2].netPnl, -300);
  const empty = M.byDayOfWeek([], profile);
  assert.strictEqual(empty.length, 5);
  assert.strictEqual(empty[0].n, 0);
  const sat = M.byDayOfWeek([T('s', '2026-11-07T10:00:00-05:00', '2026-11-07T10:10:00-05:00', 5, 100, 'journal')], profile);
  assert.strictEqual(sat.length, 6);
  assert.strictEqual(sat[5].key, 'Sat');
});

test('dailyPnl keyed by local exit date', () => {
  const d = M.dailyPnl(fixture, profile);
  assert.deepStrictEqual(d['2026-11-02'], { pnl: 100, n: 2, r: 1 });
  assert.deepStrictEqual(d['2026-11-04'], { pnl: -250, n: 2, r: -2 });
  assert.strictEqual(Object.keys(d).length, 8);
  // 23:30 EST exit is next day in UTC but still the local day
  const late = M.dailyPnl([T('l', '2026-11-02T23:00:00-05:00', '2026-11-02T23:30:00-05:00', 5, 100, 'journal')], profile);
  assert.ok(late['2026-11-02']);
});

test('rDistribution bins are contiguous and cover min..max', () => {
  const bins = M.rDistribution(fixture, profile);
  assert.strictEqual(bins[0].from, -2);
  assert.strictEqual(bins[bins.length - 1].to, 2);
  for (let i = 1; i < bins.length; i++) assert.strictEqual(bins[i].from, bins[i - 1].to);
  assert.strictEqual(bins.reduce((a, b) => a + b.n, 0), 10);
  assert.strictEqual(bins[0].n, 1);
  assert.strictEqual(bins[bins.length - 1].n, 3); // the three +2R trades sit on the top edge
});

test('holdingBuckets always lists five buckets', () => {
  const h = M.holdingBuckets([
    T('h1', '2026-11-02T09:00:00-05:00', '2026-11-02T09:30:00-05:00', 10, 100, 'journal'),
    T('h2', '2026-11-02T09:00:00-05:00', '2026-11-04T09:00:00-05:00', -10, 100, 'journal')
  ]);
  assert.deepStrictEqual(h.map(x => x.key), ['<1h', '1h–1d', '1–3d', '3–10d', '>10d']);
  assert.strictEqual(h[0].n, 1);
  assert.strictEqual(h[2].n, 1);
  assert.strictEqual(h[4].n, 0);
});

test('leakMap sorts worst first', () => {
  const l = M.leakMap(fixture, profile);
  assert.deepStrictEqual(l.map(x => x.tag), ['moved_stop', 'revenge', 'fomo']);
  assert.deepStrictEqual(l[0], { tag: 'moved_stop', n: 1, pnl: -200, r: -2 });
  assert.deepStrictEqual(l[1], { tag: 'revenge', n: 2, pnl: -200, r: -2 });
});

const journal = [
  { id: 'j1', date: '2026-11-02', linked_trade_ids: ['t1', 't2'], mood: 4, sleep_hours: 8.5, followed_plan: true },
  { id: 'j2', date: '2026-11-04', linked_trade_ids: ['t4', 't5'], mood: 2, sleep_hours: 5, followed_plan: false },
  { id: 'j3', date: '2026-11-03', linked_trade_ids: ['t3'], mood: 4, sleep_hours: 6.5, followed_plan: true }
];

test('planAdherence and stateVsOutcome join through linked_trade_ids', () => {
  const p = M.planAdherence(fixture, journal);
  assert.strictEqual(p.known, 5);
  assert.strictEqual(p.followed, 3);
  assert.strictEqual(p.pct, 60);
  const tradeLevel = M.planAdherence([Object.assign({}, fixture[0], { followed_plan: false })], journal);
  assert.deepStrictEqual(tradeLevel, { known: 1, followed: 0, pct: 0 });
  assert.deepStrictEqual(M.planAdherence([], []), { known: 0, followed: 0, pct: null });

  const s = M.stateVsOutcome(fixture, journal, profile);
  assert.strictEqual(s.mood.length, 5);
  const m4 = s.mood.find(x => x.key === 4);
  assert.strictEqual(m4.n, 3);
  assert.strictEqual(m4.netPnl, 400); // t1 +200, t2 -100, t3 +300
  close(m4.avgR, 1);
  const m2 = s.mood.find(x => x.key === 2);
  assert.strictEqual(m2.netPnl, -250);
  assert.strictEqual(s.mood.find(x => x.key === 1).avgR, null);
  assert.deepStrictEqual(s.sleep.map(x => x.key), ['<6h', '6–7h', '7–8h', '8h+']);
  assert.strictEqual(s.sleep[0].n, 2);
  assert.strictEqual(s.sleep[1].n, 1);
  assert.strictEqual(s.sleep[3].n, 2);
});

test('rolling window', () => {
  const r = M.rolling(fixture, profile, 5);
  assert.strictEqual(r.length, 6);
  assert.strictEqual(r[0].index, 5);
  // first window t1..t5: R 2,-1,2,-1,-1 -> win 40% x 2 - 60% x 1 = 0.2; win rate 2/5
  close(r[0].expectancyR, 0.2);
  close(r[0].winRate, 0.4);
  assert.deepStrictEqual(M.rolling(fixture, profile, 20), []);
});

test('dailyLossStatus uses the tighter limit', () => {
  const d = M.dailyLossStatus(fixture, profile, '2026-11-04');
  assert.strictEqual(d.pnl, -250);
  assert.strictEqual(d.limit, 300);
  close(d.usedPct, 250 / 300 * 100);
  assert.strictEqual(d.breached, false);
  const p2 = Object.assign({}, profile, { prop_rules: { trailing_drawdown: 500, daily_loss_limit: 200 } });
  const d2 = M.dailyLossStatus(fixture, p2, '2026-11-04');
  assert.strictEqual(d2.limit, 200);
  assert.strictEqual(d2.breached, true);
  const d3 = M.dailyLossStatus(fixture, {}, '2026-11-04');
  assert.strictEqual(d3.limit, null);
  assert.strictEqual(d3.breached, false);
});

test('trailingDrawdownStatus', () => {
  // peak 450, current 400, limit 500 -> floor -50, distance 450
  assert.deepStrictEqual(M.trailingDrawdownStatus(fixture, profile), { peak: 450, current: 400, floor: -50, distance: 450, breached: false });
  const tight = M.trailingDrawdownStatus(fixture, Object.assign({}, profile, { prop_rules: { trailing_drawdown: 350 } }));
  assert.strictEqual(tight.breached, false); // current 400 vs floor 100
  const hit = M.trailingDrawdownStatus(fixture.slice(0, 8), Object.assign({}, profile, { prop_rules: { trailing_drawdown: 300 } }));
  assert.strictEqual(hit.current, 50);
  assert.strictEqual(hit.floor, 100);
  assert.strictEqual(hit.breached, true);
  assert.strictEqual(M.trailingDrawdownStatus(fixture, { prop_rules: { trailing_drawdown: null } }), null);
  assert.strictEqual(M.trailingDrawdownStatus(fixture, {}), null);
});

test('groupStats sorts by key and spreads summarize', () => {
  const g = M.groupStats(fixture, t => t.symbol + (t.pnl_net > 0 ? '-win' : '-other'), profile);
  assert.deepStrictEqual(g.map(x => x.key), ['CL-other', 'CL-win']);
  assert.strictEqual(g[1].n, 4);
  assert.strictEqual(g[1].netPnl, 1000);
});
