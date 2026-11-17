/* Trading Assistant metrics. Pure functions, no DOM. Works as a <script> (window.TCMetrics) and via require().
 * Scratch handling: scratches (pnl_net === 0) count in n but not in winRate's denominator (winRate = wins / (wins + losses)).
 * Expectancy R: over trades with a known R, (win% x avg win R) - (loss% x avg loss R), where win%/loss% use the known-R trade count.
 */
(function () {
  'use strict';

  var DAY_MS = 86400000;
  var HOUR_MS = 3600000;
  var WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : null; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function cmpKey(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    a = String(a); b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function timeMs(s) {
    var t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }
  function exitMs(t) { return timeMs(t.exit_time || t.entry_time); }
  function sortByExit(trades) {
    return (trades || []).slice().sort(function (a, b) { return exitMs(a) - exitMs(b); });
  }

  function checkCurrency(trades) {
    var seen = null;
    for (var i = 0; i < trades.length; i++) {
      var c = trades[i].currency;
      if (c == null || c === '') continue;
      if (seen === null) seen = c;
      else if (c !== seen) throw new Error('mixed currencies');
    }
  }

  function riskOf(trade, profile) {
    var r = trade && trade.initial_risk;
    if (isNum(r) && r > 0) return { risk: r, source: trade.risk_source || null };
    var d = profile && profile.default_risk_per_trade;
    if (isNum(d) && d > 0) return { risk: d, source: 'default' };
    return { risk: null, source: null };
  }

  function rOf(trade, profile) {
    var risk = riskOf(trade, profile).risk;
    if (risk == null || !isNum(trade.pnl_net)) return null;
    return trade.pnl_net / risk;
  }

  function maxDrawdownOf(values) {
    var cum = 0, peak = 0, dd = 0;
    for (var i = 0; i < values.length; i++) {
      cum += values[i];
      if (cum > peak) peak = cum;
      if (peak - cum > dd) dd = peak - cum;
    }
    return dd;
  }

  function expectancyOf(rs) {
    if (!rs.length) return null;
    var w = rs.filter(function (r) { return r > 0; });
    var l = rs.filter(function (r) { return r < 0; }).map(Math.abs);
    var winPct = w.length / rs.length, lossPct = l.length / rs.length;
    return winPct * (mean(w) || 0) - lossPct * (mean(l) || 0);
  }

  function reliabilityOf(n) {
    return n === 0 ? 'none' : n < 30 ? 'early' : n < 50 ? 'building' : 'reliable';
  }

  function summarize(trades, profile) {
    trades = sortByExit(trades);
    checkCurrency(trades);
    var n = trades.length;
    var pnls = trades.map(function (t) { return t.pnl_net; });
    var wins = pnls.filter(function (p) { return p > 0; });
    var losses = pnls.filter(function (p) { return p < 0; });
    var scratches = n - wins.length - losses.length;
    var grossProfit = sum(wins);
    var grossLoss = Math.abs(sum(losses));
    var netPnl = sum(pnls);
    var decided = wins.length + losses.length;
    var avgWin = wins.length ? grossProfit / wins.length : null;
    var avgLoss = losses.length ? grossLoss / losses.length : null;

    var profitFactor = null, profitFactorExLargest = null;
    if (n > 0) {
      if (grossLoss === 0) profitFactor = grossProfit > 0 ? Infinity : null;
      else profitFactor = grossProfit / grossLoss;
      if (wins.length) {
        var gp2 = grossProfit - Math.max.apply(null, wins);
        if (grossLoss === 0) profitFactorExLargest = gp2 > 0 ? Infinity : null;
        else profitFactorExLargest = gp2 / grossLoss;
      }
    }

    var rs = [];
    var rSeries = trades.map(function (t) {
      var r = rOf(t, profile);
      if (r != null) rs.push(r);
      return r == null ? 0 : r;
    });
    var maxDrawdown = maxDrawdownOf(pnls);
    var streaks = { longestWin: 0, longestLoss: 0, current: { kind: null, length: 0 } };
    var kind = null, len = 0;
    pnls.forEach(function (p) {
      var k = p > 0 ? 'win' : p < 0 ? 'loss' : null;
      if (k !== null && k === kind) len++;
      else { kind = k; len = k === null ? 0 : 1; }
      if (kind === 'win' && len > streaks.longestWin) streaks.longestWin = len;
      if (kind === 'loss' && len > streaks.longestLoss) streaks.longestLoss = len;
    });
    streaks.current = { kind: kind, length: len };

    return {
      n: n, wins: wins.length, losses: losses.length, scratches: scratches,
      netPnl: netPnl,
      netR: rs.length ? sum(rs) : null,
      grossProfit: grossProfit, grossLoss: grossLoss,
      winRate: decided ? wins.length / decided : null,
      avgWin: avgWin, avgLoss: avgLoss,
      payoff: avgWin != null && avgLoss != null ? avgWin / avgLoss : null,
      profitFactor: profitFactor, profitFactorExLargest: profitFactorExLargest,
      expectancyR: expectancyOf(rs),
      avgR: mean(rs),
      rCoverage: n ? rs.length / n : 0,
      maxDrawdown: maxDrawdown,
      maxDrawdownR: rs.length ? maxDrawdownOf(rSeries) : null,
      recoveryFactor: maxDrawdown > 0 ? netPnl / maxDrawdown : null,
      streaks: streaks,
      reliability: reliabilityOf(n)
    };
  }

  function equityCurve(trades, profile) {
    var cum = 0, cumR = 0, peak = 0;
    return sortByExit(trades).map(function (t) {
      cum += t.pnl_net;
      if (cum > peak) peak = cum;
      var r = rOf(t, profile);
      if (r != null) cumR += r;
      var tagged = Array.isArray(t.tags) && t.tags.length > 0;
      return {
        trade_id: t.trade_id, time: t.exit_time, pnl: t.pnl_net,
        cum: cum, peak: peak, drawdown: peak - cum, cumR: cumR,
        ruleBreak: tagged || t.followed_plan === false
      };
    });
  }

  function groupStats(trades, keyFn, profile) {
    var groups = {}, keys = [];
    (trades || []).forEach(function (t) {
      var k = keyFn(t);
      var id = typeof k + ':' + k;
      if (!groups[id]) { groups[id] = { key: k, items: [] }; keys.push(id); }
      groups[id].items.push(t);
    });
    return keys.map(function (id) { return groups[id]; })
      .sort(function (a, b) { return cmpKey(a.key, b.key); })
      .map(function (g) {
        var s = summarize(g.items, profile);
        s.key = g.key;
        var out = { key: g.key };
        Object.keys(s).forEach(function (k) { if (k !== 'key') out[k] = s[k]; });
        return out;
      });
  }

  var fmtCache = {};
  function formatter(tz) {
    if (!fmtCache[tz]) {
      fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'short'
      });
    }
    return fmtCache[tz];
  }

  function localParts(isoTime, timeZone) {
    var parts = {};
    formatter(timeZone || 'UTC').formatToParts(new Date(isoTime)).forEach(function (p) { parts[p.type] = p.value; });
    return {
      date: parts.year + '-' + parts.month + '-' + parts.day,
      weekday: WEEKDAYS[parts.weekday],
      minutes: (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10)
    };
  }

  function tzOf(profile) { return (profile && profile.timezone) || 'UTC'; }

  function brief(s) { return { n: s.n, netPnl: s.netPnl, winRate: s.winRate }; }
  function hhmm(min) { return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }

  function byTimeOfDay(trades, profile, bucketMinutes) {
    var b = bucketMinutes || 30, tz = tzOf(profile);
    return groupStats(trades, function (t) {
      var m = localParts(t.entry_time, tz).minutes;
      return hhmm(Math.floor(m / b) * b);
    }, profile).map(function (g) { return { key: g.key, n: g.n, netPnl: g.netPnl, winRate: g.winRate }; });
  }

  function byDayOfWeek(trades, profile) {
    var tz = tzOf(profile);
    var by = {};
    (trades || []).forEach(function (t) {
      var d = localParts(t.entry_time, tz).weekday;
      (by[d] = by[d] || []).push(t);
    });
    var out = [];
    for (var d = 0; d < 7; d++) {
      if (d >= 5 && !by[d]) continue;
      out.push(Object.assign({ key: DAY_NAMES[d] }, brief(summarize(by[d] || [], profile))));
    }
    return out;
  }

  function dailyPnl(trades, profile) {
    var tz = tzOf(profile), out = {};
    (trades || []).forEach(function (t) {
      var d = localParts(t.exit_time || t.entry_time, tz).date;
      var e = out[d] || (out[d] = { pnl: 0, n: 0, r: 0 });
      e.pnl += t.pnl_net; e.n++;
      var r = rOf(t, profile);
      if (r != null) e.r += r;
    });
    return out;
  }

  function rDistribution(trades, profile, binWidth) {
    var w = binWidth || 0.5;
    var rs = [];
    (trades || []).forEach(function (t) { var r = rOf(t, profile); if (r != null) rs.push(r); });
    if (!rs.length) return [];
    var lo = Math.floor(Math.min.apply(null, rs) / w + 1e-9);
    var hi = Math.ceil(Math.max.apply(null, rs) / w - 1e-9);
    if (hi <= lo) hi = lo + 1;
    var bins = [];
    for (var i = lo; i < hi; i++) bins.push({ from: +(i * w).toFixed(10), to: +((i + 1) * w).toFixed(10), n: 0 });
    rs.forEach(function (r) {
      var idx = Math.floor(r / w + 1e-9) - lo;
      if (idx >= bins.length) idx = bins.length - 1;
      if (idx < 0) idx = 0;
      bins[idx].n++;
    });
    return bins;
  }

  function holdingBuckets(trades) {
    var keys = ['<1h', '1h–1d', '1–3d', '3–10d', '>10d'];
    var by = {};
    keys.forEach(function (k) { by[k] = []; });
    (trades || []).forEach(function (t) {
      var d = timeMs(t.exit_time) - timeMs(t.entry_time);
      var k = d < HOUR_MS ? keys[0] : d < DAY_MS ? keys[1] : d < 3 * DAY_MS ? keys[2] : d < 10 * DAY_MS ? keys[3] : keys[4];
      by[k].push(t);
    });
    return keys.map(function (k) { return Object.assign({ key: k }, brief(summarize(by[k], null))); });
  }

  function leakMap(trades, profile) {
    var by = {};
    (trades || []).forEach(function (t) {
      (t.tags || []).forEach(function (tag) {
        var e = by[tag] || (by[tag] = { tag: tag, n: 0, pnl: 0, r: 0 });
        e.n++; e.pnl += t.pnl_net;
        var r = rOf(t, profile);
        if (r != null) e.r += r;
      });
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return a.pnl - b.pnl || cmpKey(a.tag, b.tag); });
  }

  function journalByTrade(journal) {
    var map = {};
    (journal || []).forEach(function (j) {
      (j.linked_trade_ids || []).forEach(function (id) { if (!(id in map)) map[id] = j; });
    });
    return map;
  }

  function planAdherence(trades, journal) {
    var map = journalByTrade(journal), known = 0, followed = 0;
    (trades || []).forEach(function (t) {
      var v = typeof t.followed_plan === 'boolean' ? t.followed_plan
        : map[t.trade_id] && typeof map[t.trade_id].followed_plan === 'boolean' ? map[t.trade_id].followed_plan : null;
      if (v === null) return;
      known++;
      if (v) followed++;
    });
    return { known: known, followed: followed, pct: known ? followed / known * 100 : null };
  }

  function stateVsOutcome(trades, journal, profile) {
    var map = journalByTrade(journal);
    var sleepKeys = ['<6h', '6–7h', '7–8h', '8h+'];
    var mood = {}, sleep = {};
    [1, 2, 3, 4, 5].forEach(function (k) { mood[k] = []; });
    sleepKeys.forEach(function (k) { sleep[k] = []; });
    (trades || []).forEach(function (t) {
      var j = map[t.trade_id];
      if (!j) return;
      if (isNum(j.mood) && mood[j.mood]) mood[j.mood].push(t);
      if (isNum(j.sleep_hours)) {
        var h = j.sleep_hours;
        sleep[h < 6 ? sleepKeys[0] : h < 7 ? sleepKeys[1] : h < 8 ? sleepKeys[2] : sleepKeys[3]].push(t);
      }
    });
    function row(key, items) {
      var s = summarize(items, profile);
      return { key: key, n: s.n, netPnl: s.netPnl, avgR: s.avgR };
    }
    return {
      mood: [1, 2, 3, 4, 5].map(function (k) { return row(k, mood[k]); }),
      sleep: sleepKeys.map(function (k) { return row(k, sleep[k]); })
    };
  }

  function rolling(trades, profile, windowSize) {
    var w = windowSize || 20, ts = sortByExit(trades), out = [];
    for (var i = w - 1; i < ts.length; i++) {
      var slice = ts.slice(i - w + 1, i + 1);
      var rs = [];
      slice.forEach(function (t) { var r = rOf(t, profile); if (r != null) rs.push(r); });
      var wins = slice.filter(function (t) { return t.pnl_net > 0; }).length;
      var losses = slice.filter(function (t) { return t.pnl_net < 0; }).length;
      out.push({ index: i + 1, time: ts[i].exit_time, expectancyR: expectancyOf(rs), winRate: wins + losses ? wins / (wins + losses) : null });
    }
    return out;
  }

  // limit = the tighter of profile.max_daily_loss and prop_rules.daily_loss_limit (whichever are set)
  function dailyLossStatus(trades, profile, date) {
    var tz = tzOf(profile), pnl = 0;
    (trades || []).forEach(function (t) {
      if (localParts(t.exit_time || t.entry_time, tz).date === date) pnl += t.pnl_net;
    });
    var limits = [profile && profile.max_daily_loss, profile && profile.prop_rules && profile.prop_rules.daily_loss_limit]
      .filter(function (x) { return isNum(x) && x > 0; });
    var limit = limits.length ? Math.min.apply(null, limits) : null;
    var loss = Math.max(0, -pnl);
    return {
      date: date, pnl: pnl, limit: limit,
      usedPct: limit ? loss / limit * 100 : null,
      breached: limit ? loss >= limit : false
    };
  }

  function trailingDrawdownStatus(trades, profile) {
    var td = profile && profile.prop_rules && profile.prop_rules.trailing_drawdown;
    if (!isNum(td) || td <= 0) return null;
    var cum = 0, peak = 0;
    sortByExit(trades).forEach(function (t) {
      cum += t.pnl_net;
      if (cum > peak) peak = cum;
    });
    var floor = peak - td;
    return { peak: peak, current: cum, floor: floor, distance: cum - floor, breached: cum <= floor };
  }

  var api = {
    riskOf: riskOf, rOf: rOf, summarize: summarize, equityCurve: equityCurve, groupStats: groupStats,
    localParts: localParts, byTimeOfDay: byTimeOfDay, byDayOfWeek: byDayOfWeek, dailyPnl: dailyPnl,
    rDistribution: rDistribution, holdingBuckets: holdingBuckets, leakMap: leakMap,
    planAdherence: planAdherence, stateVsOutcome: stateVsOutcome, rolling: rolling,
    dailyLossStatus: dailyLossStatus, trailingDrawdownStatus: trailingDrawdownStatus
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TCMetrics = api;
})();
