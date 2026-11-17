/* Trading Assistant dashboard. Reads window.TC_DATA (or window.TC_DATA_SAMPLE with ?demo=1), computes everything with
 * window.TCMetrics, draws with the vendored Chart.js. No network access, works from file://.
 * Test hooks: ?demo=1 loads the sample, ?preset=day|swing|futures-prop overrides the layout preset. */
(function () {
  'use strict';

  var M = window.TCMetrics;
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = { get: function () { return null; } }; }
  var DEMO = params.get('demo') === '1';
  var FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PRESETS = ['day', 'swing', 'futures-prop'];
  var PRESET_LABEL = { day: 'Day trading', swing: 'Swing', 'futures-prop': 'Futures prop' };
  var MINUS = '\u2212';

  /* Layout rows: [panelId, span of 12]. Hidden panels give their space to the rest of the row. */
  var ROWS = [
    [['coach', 12]],
    [['kpis', 12]],
    [['equity', 8], ['prop', 4]],
    [['calendar', 5], ['setup', 7]],
    [['timeofday', 6], ['holding', 6], ['dayofweek', 6]],
    [['rdist', 6], ['leakmap', 6]],
    [['state', 6], ['rolling', 6]],
    [['maemfe', 12]],
    [['tradelog', 12]]
  ];

  var DATA, P, TZ, CUR, ALL, J, BY_ID, J_BY_TRADE, PRESET, ANCHOR, HAS_MAE;
  var charts = {};
  var state = {
    range: 'all', from: null, to: null, account: 'all', setup: 'all',
    trades: [], evidence: null, calMonth: null,
    sort: { key: 'exit_time', dir: -1 }, q: '', limit: 25, expanded: {},
    stateMetric: 'avgR'
  };

  /* ---------------- small helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function exitIso(t) { return t.exit_time || t.entry_time; }
  function ms(iso) { var v = Date.parse(iso); return isNaN(v) ? 0 : v; }
  function localDate(iso) { return M.localParts(iso, TZ).date; }
  function ymd(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function parseYmd(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = new Date(parseYmd(s) + n * 86400000); return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function humanTag(t) { return String(t).replace(/_/g, ' '); }

  var fmtCache = {};
  function nf(key, opts) {
    if (!fmtCache[key]) {
      try { fmtCache[key] = new Intl.NumberFormat('en-US', opts); }
      catch (e) { fmtCache[key] = new Intl.NumberFormat('en-US', Object.assign({}, opts, { currency: 'USD' })); }
    }
    return fmtCache[key];
  }
  function money(v, dec) {
    dec = dec == null ? 0 : dec;
    return nf('m' + dec, { style: 'currency', currency: CUR, minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Math.abs(v));
  }
  function moneyCompact(v) {
    var a = Math.abs(v);
    if (a < 1000) return money(v, 0);
    return nf('mc', { style: 'currency', currency: CUR, notation: 'compact', maximumFractionDigits: 1 }).format(a);
  }
  function sign(v) { return v > 0 ? '+' : v < 0 ? MINUS : ''; }
  function signedMoney(v, dec) { return v == null ? '—' : sign(v) + money(v, dec); }
  function signedCompact(v) { return v == null ? '—' : sign(v) + moneyCompact(v); }
  function rFmt(v, dec) { return v == null || !isFinite(v) ? '—' : sign(v) + Math.abs(v).toFixed(dec == null ? 2 : dec) + 'R'; }
  function pct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }
  function pfFmt(v) { return v == null ? '—' : v === Infinity ? '∞' : v.toFixed(2); }
  function cls(v) { return v > 0 ? 'gain' : v < 0 ? 'loss' : 'flat'; }
  function arrow(v) { return v > 0 ? '▲' : v < 0 ? '▼' : '•'; }
  /* P&L text: colour + arrow + sign, never colour alone. */
  function pnl(v, text) {
    if (v == null) return '<span class="pnl flat">—</span>';
    return '<span class="pnl ' + cls(v) + '"><span class="arrow" aria-hidden="true">' + arrow(v) + '</span>' + esc(text) + '</span>';
  }
  function pnlMoney(v, dec) { return pnl(v, signedMoney(v, dec)); }
  function pnlR(v) { return pnl(v, rFmt(v)); }

  var dtCache = {};
  function dtf(key, opts) { if (!dtCache[key]) dtCache[key] = new Intl.DateTimeFormat('en-GB', opts); return dtCache[key]; }
  function fmtDay(s, withYear) { /* 'YYYY-MM-DD' → 'Fri 13 Nov' */
    var o = { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' };
    if (withYear) o.year = 'numeric';
    return dtf('d' + !!withYear, o).format(new Date(parseYmd(s)));
  }
  function fmtDayLong(s) { return dtf('dl', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(parseYmd(s))); }
  function fmtShort(s) { return dtf('ds', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(parseYmd(s))); }
  function fmtMonth(ym) { var p = ym.split('-'); return dtf('mo', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(+p[0], +p[1] - 1, 1))); }
  function fmtTime(iso) { return dtf('t' + TZ, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); }
  function fmtDateTime(iso) {
    return dtf('dt' + TZ, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  }

  /* ---------------- boot ---------------- */
  function boot() {
    var data = DEMO ? window.TC_DATA_SAMPLE : window.TC_DATA;
    if (DEMO) $('demo-ribbon').hidden = false;
    wireTheme();
    if (!data || typeof data !== 'object') { try { renderQuote(null); } catch (e) { /* decoration */ } showEmpty(); return; }
    DATA = data;
    try { renderQuote(data); } catch (e) { /* the quote is decoration; never block the dashboard */ }
    P = data.profile || {};
    TZ = P.timezone || 'UTC';
    try { new Intl.DateTimeFormat('en-US', { timeZone: TZ }); } catch (e) { TZ = 'UTC'; }
    CUR = P.account_currency || 'USD';
    ALL = (data.trades || []).filter(function (t) { return t && isNum(t.pnl_net); })
      .sort(function (a, b) { return ms(exitIso(a)) - ms(exitIso(b)); });
    J = Array.isArray(data.journal) ? data.journal : [];
    BY_ID = {};
    ALL.forEach(function (t) { BY_ID[t.trade_id] = t; });
    J_BY_TRADE = {};
    J.forEach(function (j) { (j.linked_trade_ids || []).forEach(function (id) { if (!J_BY_TRADE[id]) J_BY_TRADE[id] = j; }); });
    HAS_MAE = ALL.some(function (t) { return isNum(t.mae) || isNum(t.mfe); });

    var qp = params.get('preset');
    PRESET = PRESETS.indexOf(qp) >= 0 ? qp
      : PRESETS.indexOf(P.layout_preset) >= 0 ? P.layout_preset
      : PRESETS.indexOf(P.style) >= 0 ? P.style : 'day';
    document.documentElement.setAttribute('data-preset', PRESET);
    $('preset-label').textContent = PRESET_LABEL[PRESET];
    $('preset-label').hidden = false;

    var updated = data.updated && !isNaN(Date.parse(data.updated)) ? data.updated : null;
    if (updated) $('updated-label').textContent = 'Updated ' + fmtDateTime(updated);
    ANCHOR = updated ? localDate(updated) : (ALL.length ? localDate(exitIso(ALL[ALL.length - 1])) : null);
    if (ALL.length && ANCHOR < localDate(exitIso(ALL[ALL.length - 1]))) ANCHOR = localDate(exitIso(ALL[ALL.length - 1]));
    renderFooter(updated);

    if (!ALL.length) { $('no-trades').hidden = false; return; }

    $('filters').hidden = false;
    $('dash').hidden = false;
    setupFilters();
    wirePanels();
    render();
  }

  function showEmpty() {
    $('empty-state').hidden = false;
    $('footer-meta').textContent = '';
  }

  function renderFooter(updated) {
    var src;
    if (DEMO) src = 'synthetic sample (demo)';
    else {
      var b = P.tools && P.tools.broker && P.tools.broker.name;
      var ds = P.data_source === 'csv' ? 'CSV export' : P.data_source ? String(P.data_source) : 'your trades';
      src = b ? b + ' · ' + ds : ds;
    }
    $('footer-meta').textContent = 'Data: ' + src + (updated ? ' · Updated ' + fmtDateTime(updated) : '');
  }

  /* ---------------- theme ---------------- */
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function syncThemeButton() {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    $('theme-toggle').setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }
  function wireTheme() {
    syncThemeButton();
    $('theme-toggle').addEventListener('click', function () {
      var next = currentTheme() === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { window.localStorage.setItem('tc-theme', next); } catch (e) { /* storage unavailable: theme still switches */ }
      syncThemeButton();
      if (DATA && ALL && ALL.length) render();
    });
  }

  /* ---------------- filters ---------------- */
  function setupFilters() {
    var accounts = uniq(ALL.map(function (t) { return t.account; }).filter(Boolean));
    var setups = uniq((P.setups || []).concat(ALL.map(function (t) { return t.setup; })).filter(Boolean));
    $('f-account').innerHTML = '<option value="all">All accounts</option>' + accounts.map(function (a) {
      return '<option value="' + esc(a) + '">' + esc(a) + '</option>';
    }).join('');
    $('f-setup').innerHTML = '<option value="all">All setups</option>' + setups.map(function (s) {
      return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
    }).join('');

    var segs = $('range-seg').querySelectorAll('button');
    Array.prototype.forEach.call(segs, function (b) {
      b.addEventListener('click', function () { setRange(b.getAttribute('data-range')); });
      b.addEventListener('keydown', function (e) { radioKeys(e, segs, function (nb) { setRange(nb.getAttribute('data-range')); }); });
    });
    $('f-from').addEventListener('change', function () { state.from = this.value || null; changed(); });
    $('f-to').addEventListener('change', function () { state.to = this.value || null; changed(); });
    $('f-account').addEventListener('change', function () { state.account = this.value; changed(); });
    $('f-setup').addEventListener('change', function () { state.setup = this.value; changed(); });
    $('reset-filters').addEventListener('click', function () {
      state.account = 'all'; state.setup = 'all'; $('f-account').value = 'all'; $('f-setup').value = 'all';
      setRange('all');
    });
    syncRangeButtons();
  }
  function uniq(a) { var s = {}, out = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; out.push(x); } }); return out; }

  /* Arrow keys move between radio buttons (segmented controls). */
  function radioKeys(e, buttons, select) {
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    var list = Array.prototype.slice.call(buttons);
    var i = list.indexOf(e.currentTarget);
    var nb = list[(i + keys[e.key] + list.length) % list.length];
    nb.focus();
    select(nb);
  }

  function setRange(r) {
    if (r === 'custom' && state.range !== 'custom') {
      var b = rangeBounds();
      state.from = b.from || localDate(exitIso(ALL[0]));
      state.to = b.to || ANCHOR;
      $('f-from').value = state.from; $('f-to').value = state.to;
    }
    state.range = r;
    syncRangeButtons();
    changed();
  }
  function syncRangeButtons() {
    Array.prototype.forEach.call($('range-seg').querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-range') === state.range;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    $('custom-range').hidden = state.range !== 'custom';
  }
  function rangeBounds() {
    switch (state.range) {
      case '30d': return { from: addDays(ANCHOR, -29), to: null };
      case '90d': return { from: addDays(ANCHOR, -89), to: null };
      case 'ytd': return { from: ANCHOR.slice(0, 4) + '-01-01', to: null };
      case 'custom': return { from: state.from, to: state.to };
      default: return { from: null, to: null };
    }
  }
  function changed() { state.limit = 25; state.expanded = {}; render(); }

  function filtered() {
    var b = rangeBounds();
    return ALL.filter(function (t) {
      if (state.account !== 'all' && t.account !== state.account) return false;
      if (state.setup !== 'all' && t.setup !== state.setup) return false;
      if (b.from || b.to) {
        var d = localDate(exitIso(t));
        if (b.from && d < b.from) return false;
        if (b.to && d > b.to) return false;
      }
      return true;
    });
  }
  function accountTrades() {
    return ALL.filter(function (t) { return state.account === 'all' || t.account === state.account; });
  }

  /* ---------------- layout ---------------- */
  function baseVisibility() {
    var v = {
      coach: true, kpis: true, equity: true, calendar: true, setup: true,
      timeofday: PRESET !== 'swing', holding: PRESET === 'swing', dayofweek: true,
      rdist: true, leakmap: true, state: true, rolling: true,
      prop: PRESET === 'futures-prop', maemfe: HAS_MAE, tradelog: true
    };
    var o = P.panels && typeof P.panels === 'object' ? P.panels : {};
    Object.keys(o).forEach(function (k) {
      if (!(k in v)) return;
      if (o[k] === false) v[k] = false;
      else if (o[k] === true && k !== 'maemfe') v[k] = true;
    });
    return v;
  }

  function applyLayout(vis) {
    ROWS.forEach(function (row) {
      var shown = row.filter(function (c) { return vis[c[0]]; });
      var total = shown.reduce(function (s, c) { return s + c[1]; }, 0);
      var used = 0;
      row.forEach(function (c) {
        var el = document.querySelector('[data-panel="' + c[0] + '"]');
        if (!el) return;
        el.hidden = !vis[c[0]];
        if (!vis[c[0]]) return;
        var idx = shown.indexOf(c);
        var span = idx === shown.length - 1 ? 12 - used : Math.max(3, Math.round(c[1] * 12 / total));
        if (total > 12 && shown.length === 3) span = 4;
        used += span;
        var md = shown.length === 1 || span >= 8 ? 12 : 6;
        el.style.setProperty('--span', span);
        el.style.setProperty('--span-md', md);
      });
    });
  }

  /* Swap a panel's chart for a short message (or restore it). */
  function panelMsg(id, msg) {
    var sec = document.querySelector('[data-panel="' + id + '"]');
    if (!sec) return;
    var auto = sec.querySelector('.panel-empty.auto');
    Array.prototype.forEach.call(sec.querySelectorAll('.chart-box, .split, .legend'), function (n) { n.hidden = !!msg; });
    if (msg) {
      if (!auto) { auto = document.createElement('p'); auto.className = 'panel-empty auto'; sec.appendChild(auto); }
      auto.textContent = msg;
      auto.hidden = false;
    } else if (auto) auto.hidden = true;
  }

  /* ---------------- render ---------------- */
  function render() {
    var trades = filtered();
    state.trades = trades;
    var vis = baseVisibility();
    var none = trades.length === 0;
    if (none) Object.keys(vis).forEach(function (k) { if (k !== 'coach') vis[k] = false; });
    applyLayout(vis);
    $('no-match').hidden = !none;
    $('no-match').style.setProperty('--span', 12);

    var first = trades.length ? fmtShort(localDate(exitIso(trades[0]))) : '';
    var lastD = trades.length ? localDate(exitIso(trades[trades.length - 1])) : '';
    var last = lastD ? fmtShort(lastD) + ' ' + lastD.slice(0, 4) : '';
    $('filter-count').textContent = trades.length ? trades.length + ' trades · ' + first + ' – ' + last : '0 trades';

    renderCoach();
    destroyCharts();
    if (none) return;
    var t = chartTheme();
    setChartDefaults(t);
    if (vis.kpis) renderKpis(trades);
    if (vis.equity) safe('equity', function () { chartEquity(t, trades); });
    if (vis.prop) renderProp();
    if (vis.calendar) renderCalendar();
    if (vis.setup) safe('setup', function () { chartSetup(t, trades); });
    if (vis.timeofday) safe('timeofday', function () { chartTimeOfDay(t, trades); });
    if (vis.holding) safe('holding', function () { chartHolding(t, trades); });
    if (vis.dayofweek) safe('dayofweek', function () { chartDow(t, trades); });
    if (vis.rdist) safe('rdist', function () { chartRDist(t, trades); });
    if (vis.leakmap) safe('leakmap', function () { chartLeak(t, trades); });
    if (vis.state) safe('state', function () { chartState(t, trades); });
    if (vis.rolling) safe('rolling', function () { chartRolling(t, trades); });
    if (vis.maemfe) safe('maemfe', function () { chartMae(t, trades); });
    if (vis.tradelog) renderLog();
  }

  /* One panel failing (bad row, mixed currencies) should not blank the page. */
  function safe(id, fn) {
    try { panelMsg(id, null); fn(); }
    catch (e) {
      panelMsg(id, e && e.message === 'mixed currencies'
        ? 'These trades are in more than one currency. Filter to one account to see this.'
        : 'This panel could not be drawn from the current data.');
      if (window.console) console.warn('[Trading Assistant] ' + id + ':', e);
    }
  }

  /* ---------------- coach ---------------- */
  function renderCoach() {
    var ins = DATA.insights || {};
    var brief = ins.brief || null;
    $('brief-date').textContent = brief && brief.date ? fmtDay(brief.date, true) : 'Brief';
    $('brief-md').innerHTML = brief && brief.markdown ? md(brief.markdown)
      : '<p>Your first brief arrives after the next morning run.</p>';
    if (ins.focus_rule) { $('focus-text').textContent = ins.focus_rule; $('focus-rule').hidden = false; }
    else $('focus-rule').hidden = true;

    var list = (ins.insights || []).slice(0, 3);
    var ol = $('insights');
    if (!list.length) { ol.innerHTML = '<li class="insight"><p>No insights yet. They appear once there is enough history to say something useful.</p></li>'; return; }
    ol.innerHTML = list.map(function (it, i) {
      var ids = (it.evidence && it.evidence.trade_ids) || [];
      var n = it.evidence && isNum(it.evidence.n) ? it.evidence.n : ids.length;
      var conf = ['early', 'moderate', 'strong'].indexOf(it.confidence) >= 0 ? it.confidence : 'early';
      return '<li class="insight">' +
        '<div class="insight-top"><span class="insight-rank" aria-hidden="true">' + (i + 1) + '</span>' +
        '<div><h4>' + esc(it.title) + '</h4>' + (it.suggestion ? '<p>' + esc(it.suggestion) + '</p>' : '') + '</div></div>' +
        '<div class="insight-foot"><span class="conf conf-' + conf + '" title="Confidence">' + conf + ' · n ' + n + '</span>' +
        (ids.length ? '<button type="button" class="link-btn" data-insight="' + i + '">See the ' + ids.length + ' trades</button>' : '') +
        '</div></li>';
    }).join('');
    Array.prototype.forEach.call(ol.querySelectorAll('[data-insight]'), function (b) {
      b.addEventListener('click', function () {
        var it = list[+b.getAttribute('data-insight')];
        showEvidence(it.title, it.evidence.trade_ids);
      });
    });
  }

  /* Tiny safe markdown: headings, bullets, paragraphs, bold, italic. Escapes HTML first. */
  function md(src) {
    var lines = String(src || '').replace(/\r/g, '').split('\n');
    var out = [], para = [], list = null;
    function flushP() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function flushL() { if (list) { out.push('<ul>' + list.map(function (li) { return '<li>' + inline(li) + '</li>'; }).join('') + '</ul>'); list = null; } }
    lines.forEach(function (line) {
      var m;
      if (!line.trim()) { flushP(); flushL(); return; }
      if ((m = line.match(/^\s*(#{1,3})\s+(.*)$/))) { flushP(); flushL(); var h = m[1].length + 2; out.push('<h' + h + '>' + inline(m[2]) + '</h' + h + '>'); return; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushP(); (list = list || []).push(m[1]); return; }
      flushL(); para.push(line.trim());
    });
    flushP(); flushL();
    return out.join('');
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?![*\w])/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_(?!\s)([^_]+?)_(?!\w)/g, '$1<em>$2</em>');
    return s;
  }

  function showEvidence(title, ids) {
    state.evidence = { title: title, ids: ids.slice() };
    state.limit = Math.max(25, ids.length);
    state.q = ''; $('log-q').value = '';
    renderLog();
    var panel = $('panel-tradelog');
    panel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    $('evidence-clear').focus({ preventScroll: true });
  }

  /* ---------------- KPIs ---------------- */
  function renderKpis(trades) {
    var s = M.summarize(trades, P);
    var adh = M.planAdherence(trades, J);
    var rel = s.reliability;
    var tiles = [
      { label: 'Net P&L', value: pnlMoney(s.netPnl, 0), sub: (s.netR != null ? pnlR(s.netR) + '<span>·</span>' : '') + '<span>' + s.n + ' trades</span>' },
      { label: 'Win rate', value: '<span class="neutral">' + pct(s.winRate) + '</span>', sub: '<span>' + s.wins + ' won · ' + s.losses + ' lost' + (s.scratches ? ' · ' + s.scratches + ' flat' : '') + '</span>' },
      { label: 'Profit factor', value: '<span class="neutral">' + pfFmt(s.profitFactor) + '</span>', sub: '<span>ex-largest win ' + pfFmt(s.profitFactorExLargest) + '</span>' },
      { label: 'Expectancy', value: pnlR(s.expectancyR), sub: '<span class="rel rel-' + rel + '">' + rel + '</span><span>per trade' + (s.rCoverage < 1 ? ' · R on ' + pct(s.rCoverage) : '') + '</span>' },
      { label: 'Avg win / loss', value: '<span class="neutral">' + (s.avgWin != null ? money(s.avgWin, 0) : '—') + ' / ' + (s.avgLoss != null ? money(s.avgLoss, 0) : '—') + '</span>', sub: '<span>payoff ' + (s.payoff != null ? s.payoff.toFixed(2) : '—') + '</span>' },
      { label: 'Max drawdown', value: s.maxDrawdown > 0 ? pnlMoney(-s.maxDrawdown, 0) : pnlMoney(0, 0), sub: s.maxDrawdownR != null ? pnlR(-s.maxDrawdownR) : '<span>R unknown</span>' },
      { label: 'Plan adherence', value: '<span class="neutral">' + (adh.pct != null ? Math.round(adh.pct) + '%' : '—') + '</span>', sub: '<span>' + (adh.known ? adh.followed + ' of ' + adh.known + ' on plan' : 'no plan notes yet') + '</span>' }
    ];
    $('kpis').innerHTML = tiles.map(function (k) {
      return '<div class="kpi gold-trim" role="group" aria-label="' + esc(k.label) + '">' +
        '<div class="kpi-label">' + esc(k.label) + '</div>' +
        '<div class="kpi-value">' + k.value + '</div>' +
        '<div class="kpi-sub">' + k.sub + '</div></div>';
    }).join('');
  }

  /* ---------------- prop rules ---------------- */
  function renderProp() {
    var acct = accountTrades();
    var box = $('prop');
    if (!acct.length) { box.innerHTML = '<p class="panel-empty">No trades on this account yet.</p>'; return; }
    var lastDay = localDate(exitIso(acct[acct.length - 1]));
    var dl = M.dailyLossStatus(acct, P, lastDay);
    var nDay = acct.filter(function (t) { return localDate(exitIso(t)) === lastDay; }).length;
    var td = M.trailingDrawdownStatus(acct, P);
    var html = '';

    html += '<div class="prop-block"><h3>Daily loss limit</h3>';
    if (dl.limit) {
      var used = Math.max(0, Math.min(100, dl.usedPct || 0));
      var warn = used >= 75 || dl.breached;
      var color = warn ? 'var(--loss)' : 'url(#tc-gauge-gold)';
      html += '<div class="gauge-wrap">' +
        '<svg class="gauge" viewBox="0 0 200 118" role="img" aria-label="' + esc(Math.round(used) + '% of the daily loss limit used on ' + fmtDay(lastDay)) + '">' +
        '<defs><linearGradient id="tc-gauge-gold" x1="0" x2="1"><stop offset="0" stop-color="#9a7720"/><stop offset=".55" stop-color="#dcb64f"/><stop offset="1" stop-color="#f6e7b4"/></linearGradient></defs>' +
        '<path d="M20 100 A80 80 0 0 1 180 100" pathLength="100" fill="none" style="stroke:var(--surface-3)" stroke-width="14" stroke-linecap="round"/>' +
        (used > 0 ? '<path d="M20 100 A80 80 0 0 1 180 100" pathLength="100" fill="none" style="stroke:' + color + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + used.toFixed(2) + ' 100"/>' : '') +
        '<text x="100" y="88" text-anchor="middle" class="gauge-num">' + Math.round(used) + '%</text>' +
        '<text x="100" y="108" text-anchor="middle" class="gauge-cap">of limit used</text></svg>' +
        '<p class="gauge-text">' + esc(fmtDay(lastDay)) + ' (latest day): ' + pnlMoney(dl.pnl, 0) +
        ' · limit <strong>' + money(dl.limit, 0) + '</strong> · <strong>' + money(Math.max(0, dl.limit + Math.min(0, dl.pnl)), 0) + '</strong> left' +
        (isNum(P.max_trades_per_day) ? ' · ' + nDay + ' of ' + P.max_trades_per_day + ' trades' : '') + '</p>' +
        (dl.breached ? '<span class="breach">▼ Limit reached that day</span>' : '') + '</div>';
    } else {
      html += '<p class="gauge-text">Add <code>max_daily_loss</code> to your profile to track this.</p>';
    }
    html += '</div>';

    html += '<div class="prop-block"><h3>Trailing drawdown</h3>';
    if (td) {
      var size = P.prop_rules.trailing_drawdown;
      var share = Math.max(0, Math.min(1, td.distance / size));
      html += '<div class="trail-track" role="img" aria-label="' + esc(money(Math.max(0, td.distance), 0) + ' of ' + money(size, 0) + ' cushion left before the trailing floor') + '">' +
        '<div class="trail-fill' + (share < 0.25 ? ' warn' : '') + '" style="width:' + (share * 100).toFixed(1) + '%"></div></div>' +
        '<div class="trail-scale"><span>Floor ' + signedMoney(td.floor, 0) + '</span><span>Peak ' + signedMoney(td.peak, 0) + '</span></div>' +
        '<p class="trail-text">Cushion <strong>' + money(Math.max(0, td.distance), 0) + '</strong> of ' + money(size, 0) +
        '. Equity now ' + pnlMoney(td.current, 0) + ' since your first trade.</p>' +
        (td.breached ? '<span class="breach">▼ At or below the trailing floor</span>' : '');
    } else {
      html += '<p class="gauge-text">Add <code>prop_rules.trailing_drawdown</code> to your profile to track this.</p>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  /* ---------------- calendar ---------------- */
  function renderCalendar() {
    var daily = M.dailyPnl(state.trades, P);
    var days = Object.keys(daily).sort();
    var box = $('calendar');
    if (!days.length) { box.innerHTML = '<p class="panel-empty">No trading days in this range.</p>'; return; }
    var minM = days[0].slice(0, 7), maxM = days[days.length - 1].slice(0, 7);
    if (!state.calMonth || state.calMonth < minM || state.calMonth > maxM) state.calMonth = maxM;
    var ym = state.calMonth;
    $('cal-month').textContent = fmtMonth(ym);
    $('cal-prev').disabled = ym <= minM;
    $('cal-next').disabled = ym >= maxM;

    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var monthDays = days.filter(function (d) { return d.slice(0, 7) === ym; });
    var mPnl = 0, mN = 0, green = 0, red = 0, maxAbs = 0;
    monthDays.forEach(function (d) {
      var e = daily[d]; mPnl += e.pnl; mN += e.n;
      if (e.pnl > 0) green++; else if (e.pnl < 0) red++;
      maxAbs = Math.max(maxAbs, Math.abs(e.pnl));
    });
    $('sum-calendar').innerHTML = monthDays.length
      ? pnlMoney(mPnl, 0) + ' · ' + mN + ' trades · ' + green + ' green, ' + red + ' red days'
      : 'No trades this month.';
    var th = chartTheme();

    if (PRESET === 'swing') { renderWeeks(box, daily, y, m, dim, th); return; }

    var first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    var lead = (first + 6) % 7;
    var html = '<div class="cal-grid" role="group" aria-label="Daily P&amp;L for ' + esc(fmtMonth(ym)) + '">';
    html += ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) {
      return '<div class="cal-dow" aria-hidden="true">' + d.charAt(0) + '</div>';
    }).join('');
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push('<div class="cal-day blank"></div>');
    for (var d = 1; d <= dim; d++) {
      var key = ymd(y, m, d), e = daily[key];
      if (e) {
        var a = maxAbs ? 0.24 + 0.46 * Math.abs(e.pnl) / maxAbs : 0.24;
        var bg = e.pnl > 0 ? rgba(th.gain, a) : e.pnl < 0 ? rgba(th.loss, a) : th.surface;
        var label = fmtDayLong(key) + ': ' + (e.pnl > 0 ? 'up ' : e.pnl < 0 ? 'down ' : 'flat ') + money(e.pnl, 0) + ', ' + e.n + (e.n === 1 ? ' trade' : ' trades');
        cells.push('<button type="button" class="cal-day" data-date="' + key + '" style="background:' + bg + '" aria-label="' + esc(label) + '">' +
          '<span class="cal-num">' + d + '</span><span class="cal-pnl">' + arrow(e.pnl) + sign(e.pnl) + compactNum(e.pnl) + '</span></button>');
      } else {
        cells.push('<div class="cal-day off"><span class="cal-num">' + d + '</span></div>');
      }
    }
    while ((lead + dim) % 7 && cells.length % 7) cells.push('<div class="cal-day blank"></div>');
    html += cells.join('') + '</div>';
    html += '<div class="cal-legend" aria-hidden="true"><span>▼ loss</span>' +
      [0.6, 0.3].map(function (a) { return '<i class="sw" style="background:' + rgba(th.loss, a) + '"></i>'; }).join('') +
      [0.3, 0.6].map(function (a) { return '<i class="sw" style="background:' + rgba(th.gain, a) + '"></i>'; }).join('') +
      '<span>gain ▲</span></div>';
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('button.cal-day'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-date');
        openSheet(k, k, fmtDayLong(k), 'Day', b);
      });
    });
  }
  function compactNum(v) {
    var a = Math.abs(v);
    return a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k' : String(Math.round(a));
  }

  function renderWeeks(box, daily, y, m, dim, th) {
    var start = ymd(y, m, 1);
    var dow = (new Date(parseYmd(start)).getUTCDay() + 6) % 7;
    var wk = addDays(start, -dow), end = ymd(y, m, dim);
    var weeks = [];
    while (wk <= end) {
      var to = addDays(wk, 6), pnlW = 0, n = 0;
      for (var i = 0; i < 7; i++) { var e = daily[addDays(wk, i)]; if (e) { pnlW += e.pnl; n += e.n; } }
      weeks.push({ from: wk, to: to, pnl: pnlW, n: n });
      wk = addDays(wk, 7);
    }
    var maxAbs = Math.max.apply(null, weeks.map(function (w) { return Math.abs(w.pnl); }).concat([1]));
    box.innerHTML = '<div class="cal-weeks">' + weeks.map(function (w) {
      var label = fmtShort(w.from) + ' – ' + fmtShort(w.to);
      if (!w.n) return '<div class="cal-week empty"><span class="cal-week-label">' + esc(label) + '<small>No trades</small></span><span></span><span></span></div>';
      var width = Math.max(4, Math.abs(w.pnl) / maxAbs * 100);
      return '<button type="button" class="cal-week" data-from="' + w.from + '" data-to="' + w.to + '" aria-label="' +
        esc('Week of ' + label + ': ' + (w.pnl >= 0 ? 'up ' : 'down ') + money(w.pnl, 0) + ', ' + w.n + ' trades') + '">' +
        '<span class="cal-week-label">' + esc(label) + '<small>' + w.n + (w.n === 1 ? ' trade' : ' trades') + '</small></span>' +
        '<span class="cal-bar"><span style="left:0;width:' + width.toFixed(1) + '%;background:' + (w.pnl >= 0 ? th.gain : th.loss) + '"></span></span>' +
        pnlMoney(w.pnl, 0) + '</button>';
    }).join('') + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('button.cal-week'), function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-from'), t = b.getAttribute('data-to');
        openSheet(f, t, fmtShort(f) + ' – ' + fmtShort(t), 'Week', b);
      });
    });
  }

  /* ---------------- sheet (day / week drawer) ---------------- */
  var sheetOpener = null;
  function openSheet(from, to, title, eyebrow, opener) {
    var trades = state.trades.filter(function (t) { var d = localDate(exitIso(t)); return d >= from && d <= to; });
    var ids = {};
    trades.forEach(function (t) { ids[t.trade_id] = 1; });
    var notes = J.filter(function (j) {
      if (j.date && j.date >= from && j.date <= to) return true;
      return (j.linked_trade_ids || []).some(function (id) { return ids[id]; });
    });
    var s = M.summarize(trades, P);
    $('sheet-eyebrow').textContent = eyebrow;
    $('sheet-title').textContent = title;
    var html = '<div class="sheet-sum">' + pnlMoney(s.netPnl, 2) + (s.netR != null ? pnlR(s.netR) : '') +
      '<span class="muted">' + s.n + (s.n === 1 ? ' trade' : ' trades') + ' · ' + s.wins + ' won · ' + s.losses + ' lost</span></div>';
    html += '<h3>Trades</h3><ul class="sheet-trades">' + trades.map(function (t) {
      var r = M.rOf(t, P);
      return '<li><span><strong>' + esc(t.symbol) + '</strong> <span class="muted">' + esc(t.side || '') + ' · ' + esc(t.setup || 'no setup') + '</span></span>' +
        pnlMoney(t.pnl_net, 2) +
        '<span class="meta">' + esc(fmtTime(t.entry_time)) + ' → ' + esc(fmtTime(exitIso(t))) + ' · ' + esc(rFmt(r)) +
        ((t.tags || []).length ? ' · ' + esc(t.tags.map(humanTag).join(', ')) : '') + '</span></li>';
    }).join('') + '</ul>';
    html += '<h3>Journal</h3>' + (notes.length ? notes.map(noteHtml).join('') : '<p class="muted">No journal entry for this ' + eyebrow.toLowerCase() + '.</p>');
    $('sheet-body').innerHTML = html;
    sheetOpener = opener || document.activeElement;
    var dlg = $('sheet');
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute('open', '');
    $('sheet-close').focus();
  }
  function closeSheet() {
    var dlg = $('sheet');
    if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
  }
  function noteHtml(j) {
    var meta = [];
    if (j.date) meta.push(fmtDay(j.date));
    if (isNum(j.mood)) meta.push('mood ' + j.mood + '/5');
    if (isNum(j.sleep_hours)) meta.push('slept ' + j.sleep_hours + 'h');
    if (typeof j.followed_plan === 'boolean') meta.push(j.followed_plan ? 'followed plan' : 'off plan');
    return '<div class="note"><p class="note-meta">' + esc(meta.join(' · ')) + '</p>' +
      (j.excerpt ? '<blockquote>' + esc(j.excerpt) + '</blockquote>' : '') +
      (j.lesson ? '<p class="lesson"><strong>Lesson:</strong> ' + esc(j.lesson) + '</p>' : '') +
      (safeUrl(j.url) ? '<p class="lesson"><a href="' + esc(j.url) + '" target="_blank" rel="noopener noreferrer">Open the full entry ↗</a></p>' : '') +
      '</div>';
  }
  function safeUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }

  /* ---------------- trade log ---------------- */
  function logRows() {
    var base;
    if (state.evidence) {
      var want = {};
      state.evidence.ids.forEach(function (id) { want[id] = 1; });
      base = ALL.filter(function (t) { return want[t.trade_id]; });
    } else base = state.trades;
    var q = state.q.trim().toLowerCase();
    if (q) {
      base = base.filter(function (t) {
        var j = J_BY_TRADE[t.trade_id];
        var hay = [t.symbol, t.side, t.setup, t.account, (t.tags || []).join(' '), (t.tags || []).map(humanTag).join(' '),
          j && j.lesson, j && j.excerpt, localDate(exitIso(t))].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    }
    var k = state.sort.key, dir = state.sort.dir;
    function val(t) {
      if (k === 'exit_time') return ms(exitIso(t));
      if (k === 'r') { var r = M.rOf(t, P); return r == null ? -Infinity : r; }
      if (k === 'tags') return (t.tags || []).length * 1000 + ((t.tags || [])[0] ? (t.tags[0].charCodeAt(0) || 0) : 0);
      var v = t[k];
      return typeof v === 'string' ? v.toLowerCase() : v == null ? -Infinity : v;
    }
    return base.slice().sort(function (a, b) {
      var x = val(a), y = val(b);
      if (x < y) return -dir; if (x > y) return dir;
      return ms(exitIso(b)) - ms(exitIso(a));
    });
  }

  function renderLog() {
    var rows = logRows();
    var shown = rows.slice(0, state.limit);
    $('evidence-bar').hidden = !state.evidence;
    if (state.evidence) $('evidence-title').textContent = state.evidence.title;
    $('log-count').textContent = rows.length
      ? 'Showing ' + shown.length + ' of ' + rows.length + (state.evidence ? ' evidence trades (all dates)' : ' trades')
      : 'No trades match.';
    Array.prototype.forEach.call(document.querySelectorAll('#log th[data-sort]'), function (th) {
      if (th.getAttribute('data-sort') === state.sort.key) th.setAttribute('aria-sort', state.sort.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    $('log-body').innerHTML = shown.map(function (t) {
      var r = M.rOf(t, P);
      var id = esc(t.trade_id);
      var open = !!state.expanded[t.trade_id];
      var dateLabel = fmtDay(localDate(exitIso(t))) + ' · ' + fmtTime(exitIso(t));
      var tags = (t.tags || []).map(function (g) { return '<span class="tag">' + esc(humanTag(g)) + '</span>'; }).join('');
      var row = '<tr class="row' + (open ? ' open' : '') + '" data-id="' + id + '">' +
        '<td class="c-date">' + esc(dateLabel) + '</td>' +
        '<td class="c-sym"><span class="sym">' + esc(t.symbol) + '</span> <span class="side side-inline">' + esc(t.side || '') + '</span></td>' +
        '<td class="c-side"><span class="side">' + esc(t.side || '') + '</span></td>' +
        '<td class="c-setup">' + esc(t.setup || '—') + '</td>' +
        '<td class="c-qty num">' + (isNum(t.qty) ? t.qty : '—') + '</td>' +
        '<td class="c-pnl num">' + pnlMoney(t.pnl_net, 2) + '</td>' +
        '<td class="c-r num">' + esc(rFmt(r)) + '</td>' +
        '<td class="c-tags">' + (tags ? '<span class="tags">' + tags + '</span>' : '') + '</td>' +
        '<td class="c-x"><button type="button" class="expand-btn" aria-expanded="' + open + '" aria-controls="d-' + id + '" aria-label="' +
        esc((open ? 'Hide' : 'Show') + ' details for ' + t.symbol + ' on ' + dateLabel) + '">▾</button></td></tr>';
      if (open) row += '<tr class="detail" id="d-' + id + '"><td colspan="9">' + detailHtml(t) + '</td></tr>';
      return row;
    }).join('');
    $('log-more').hidden = rows.length <= state.limit;
    $('log-more').textContent = 'Show ' + Math.min(25, rows.length - state.limit) + ' more';
  }

  function detailHtml(t) {
    var j = J_BY_TRADE[t.trade_id];
    var risk = M.riskOf(t, P);
    var left = j ? noteHtml(j) : '<p class="muted">No journal entry is linked to this trade.</p>';
    var facts = '<dl class="facts">' +
      '<dt>Entry</dt><dd>' + esc(fmtTime(t.entry_time)) + (isNum(t.entry_price) ? ' @ ' + t.entry_price : '') + '</dd>' +
      '<dt>Exit</dt><dd>' + esc(fmtTime(exitIso(t))) + (isNum(t.exit_price) ? ' @ ' + t.exit_price : '') + '</dd>' +
      '<dt>Fees</dt><dd>' + (isNum(t.fees) ? money(t.fees, 2) : '—') + '</dd>' +
      '<dt>Risk</dt><dd>' + (risk.risk != null ? money(risk.risk, 0) + (risk.source ? ' (' + esc(risk.source.replace(/_/g, ' ')) + ')' : '') : '—') + '</dd>' +
      '<dt>Account</dt><dd>' + esc(t.account || '—') + '</dd></dl>';
    return '<div class="detail"><div class="detail-grid"><div>' + left + '</div>' + facts + '</div></div>';
  }

  function toggleRow(id) {
    state.expanded[id] = !state.expanded[id];
    renderLog();
    var btn = document.querySelector('#log-body tr.row[data-id="' + cssEsc(id) + '"] .expand-btn');
    if (btn) btn.focus({ preventScroll: true });
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

  /* ---------------- one-time wiring ---------------- */
  function wirePanels() {
    $('cal-prev').addEventListener('click', function () { state.calMonth = shiftMonth(state.calMonth, -1); renderCalendar(); });
    $('cal-next').addEventListener('click', function () { state.calMonth = shiftMonth(state.calMonth, 1); renderCalendar(); });

    $('log-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr.row');
      if (!tr || e.target.closest('a')) return;
      toggleRow(tr.getAttribute('data-id'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('#log th[data-sort] button'), function (b) {
      b.addEventListener('click', function () {
        var k = b.parentNode.getAttribute('data-sort');
        if (state.sort.key === k) state.sort.dir = -state.sort.dir;
        else state.sort = { key: k, dir: k === 'symbol' || k === 'setup' || k === 'side' ? 1 : -1 };
        renderLog();
      });
    });
    var qTimer;
    $('log-q').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(qTimer);
      qTimer = setTimeout(function () { state.q = v; state.limit = 25; renderLog(); }, 120);
    });
    $('log-more').addEventListener('click', function () { state.limit += 25; renderLog(); });
    $('evidence-clear').addEventListener('click', function () { state.evidence = null; state.limit = 25; renderLog(); $('log-q').focus(); });

    var segs = $('state-seg').querySelectorAll('button');
    function pick(b) {
      state.stateMetric = b.getAttribute('data-metric');
      Array.prototype.forEach.call(segs, function (x) {
        var on = x === b; x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
      });
      if (charts.mood) { charts.mood.destroy(); delete charts.mood; }
      if (charts.sleep) { charts.sleep.destroy(); delete charts.sleep; }
      var t = chartTheme(); setChartDefaults(t);
      safe('state', function () { chartState(t, state.trades); });
    }
    Array.prototype.forEach.call(segs, function (b, i) {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', function () { pick(b); });
      b.addEventListener('keydown', function (e) { radioKeys(e, segs, pick); });
    });

    $('sheet-close').addEventListener('click', closeSheet);
    $('sheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
    $('sheet').addEventListener('close', function () {
      if (sheetOpener && document.body.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true });
      sheetOpener = null;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('sheet').hasAttribute('open') && typeof $('sheet').showModal !== 'function') closeSheet();
    });
  }
  function shiftMonth(ym, d) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + d;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
  }

  /* ---------------- charts ---------------- */
  function chartTheme() {
    var cs = getComputedStyle(document.documentElement);
    function g(n) { return cs.getPropertyValue(n).trim(); }
    var light = currentTheme() === 'light';
    return {
      light: light,
      fg: g('--foreground') || (light ? '#1a0f33' : '#f5f1fb'),
      muted: g('--muted-foreground') || '#b5a8cf',
      grid: light ? 'rgba(61,26,122,.09)' : 'rgba(203,181,236,.09)',
      zero: light ? 'rgba(61,26,122,.28)' : 'rgba(203,181,236,.28)',
      gain: hex(g('--gain'), light ? '#0f8a63' : '#3ccf9a'),
      loss: hex(g('--loss'), light ? '#c4421f' : '#ff7a59'),
      purple: light ? '#6a35c2' : '#a47ce6',
      gold: light ? '#9a7720' : '#dcb64f',
      card: light ? '#ffffff' : '#120a24',
      surface: light ? 'rgba(61,26,122,.04)' : 'rgba(255,255,255,.04)',
      tipBg: light ? 'rgba(255,255,255,.98)' : 'rgba(22,12,44,.97)',
      tipBorder: light ? 'rgba(154,119,32,.5)' : 'rgba(220,182,79,.45)'
    };
  }
  function hex(v, fallback) { return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback; }
  function rgba(h, a) {
    var n = parseInt(h.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function setChartDefaults(t) {
    Chart.defaults.font.family = FONT;
    Chart.defaults.font.size = 11.5;
    Chart.defaults.color = t.muted;
    Chart.defaults.borderColor = t.grid;
    Chart.defaults.animation = REDUCED ? false : { duration: 450, easing: 'easeOutCubic' };
  }
  function destroyCharts() { Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) { /* already gone */ } delete charts[k]; }); }

  function tooltip(t, extra) {
    return Object.assign({
      backgroundColor: t.tipBg, titleColor: t.fg, bodyColor: t.fg, borderColor: t.tipBorder, borderWidth: 1,
      padding: 10, cornerRadius: 10, displayColors: false, titleFont: { weight: '600' }, caretPadding: 6
    }, extra || {});
  }
  function axis(t, o) {
    o = o || {};
    var out = {
      grid: Object.assign({ color: t.grid, drawTicks: false }, o.grid || {}),
      border: { display: false },
      ticks: Object.assign({ color: t.muted, padding: 8 }, o.ticks || {})
    };
    Object.keys(o).forEach(function (k) { if (k !== 'grid' && k !== 'ticks') out[k] = o[k]; });
    return out;
  }
  function zeroGrid(t) {
    return { color: function (c) { return c.tick && c.tick.value === 0 ? t.zero : t.grid; }, drawTicks: false };
  }
  function pnlColors(t, vals, a) { return vals.map(function (v) { return v == null ? 'transparent' : v >= 0 ? rgba(t.gain, a || 0.78) : rgba(t.loss, a || 0.78); }); }

  /* Draws a short value at the end of each bar. */
  var valueLabels = {
    id: 'tcValueLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.formatter) return;
      var ctx = chart.ctx, horiz = chart.options.indexAxis === 'y';
      chart.data.datasets.forEach(function (ds, di) {
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach(function (el, i) {
          var v = ds.data[i];
          if (v == null) return;
          ctx.save();
          ctx.font = '600 11px ' + FONT;
          ctx.fillStyle = opts.color;
          var pos = v >= 0;
          var txt = opts.formatter(v, i);
          if (horiz) {
            ctx.textBaseline = 'middle';
            /* A negative label that would run into the axis labels sits just right of zero instead. */
            if (!pos && el.x - 6 - ctx.measureText(txt).width < chart.chartArea.left) { ctx.textAlign = 'left'; ctx.fillText(txt, el.base + 6, el.y); }
            else { ctx.textAlign = pos ? 'left' : 'right'; ctx.fillText(txt, el.x + (pos ? 6 : -6), el.y); }
          }
          else { ctx.textAlign = 'center'; ctx.textBaseline = pos ? 'bottom' : 'top'; ctx.fillText(txt, el.x, el.y + (pos ? -4 : 4)); }
          ctx.restore();
        });
      });
    }
  };

  function make(key, canvasId, cfg, summary) {
    var cv = $(canvasId);
    if (summary != null) {
      cv.setAttribute('aria-label', summary);
    }
    charts[key] = new Chart(cv, cfg);
    return charts[key];
  }
  function setSum(id, html, plain) {
    $(id).innerHTML = html;
    return plain != null ? plain : $(id).textContent;
  }

  function chartEquity(t, trades) {
    var c = M.equityCurve(trades, P);
    var s = M.summarize(trades, P);
    var breaks = c.filter(function (p) { return p.ruleBreak; }).length;
    var last = c[c.length - 1];
    var sum = setSum('sum-equity', pnlMoney(last.cum, 0) + ' over ' + c.length + ' trades · peak ' + signedMoney(last.peak, 0) +
      ' · max drawdown ' + signedMoney(-s.maxDrawdown, 0) + ' · ' + breaks + ' rule-break trades ringed in gold');
    var rb = c.map(function (p) { return p.ruleBreak; });
    var ring = window.innerWidth < 700 ? 2.8 : 3.6;
    make('equity', 'c-equity', {
      type: 'line',
      data: {
        labels: c.map(function (p) { return fmtShort(localDate(p.time)); }),
        datasets: [
          { label: 'Peak', data: c.map(function (p) { return p.peak; }), borderColor: rgba(t.gold, 0.6), borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 0, pointHitRadius: 0, fill: false, tension: 0 },
          {
            label: 'Equity', data: c.map(function (p) { return p.cum; }), borderColor: t.purple, borderWidth: 2.2, tension: 0.25,
            fill: { target: 0, above: 'transparent', below: rgba(t.loss, t.light ? 0.16 : 0.2) },
            pointRadius: rb.map(function (x) { return x ? ring : 0; }),
            pointHoverRadius: rb.map(function (x) { return x ? 6 : 4; }),
            pointBackgroundColor: rb.map(function (x) { return x ? t.card : t.purple; }),
            pointBorderColor: rb.map(function (x) { return x ? t.gold : t.purple; }),
            pointBorderWidth: rb.map(function (x) { return x ? 2 : 0; }),
            pointHitRadius: 6
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 8, right: 8 } },
        scales: {
          x: axis(t, { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkipPadding: 16 } }),
          y: axis(t, { grid: zeroGrid(t), ticks: { maxTicksLimit: 6, callback: function (v) { return signedCompact(v); } } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(t, {
            filter: function (it) { return it.datasetIndex === 1; },
            callbacks: {
              title: function (items) { var p = c[items[0].dataIndex]; var tr = BY_ID[p.trade_id]; return fmtDateTime(p.time) + (tr ? ' · ' + tr.symbol : ''); },
              label: function (it) {
                var p = c[it.dataIndex], tr = BY_ID[p.trade_id];
                var lines = ['Trade ' + signedMoney(p.pnl, 2) + (tr && M.rOf(tr, P) != null ? ' (' + rFmt(M.rOf(tr, P)) + ')' : ''),
                  'Equity ' + signedMoney(p.cum, 0) + (p.drawdown > 0 ? ' · ' + signedMoney(-p.drawdown, 0) + ' from peak' : '')];
                if (p.ruleBreak) {
                  var tags = tr && tr.tags && tr.tags.length ? tr.tags.map(humanTag).join(', ') : 'off plan';
                  lines.push('Rule break: ' + tags);
                }
                return lines;
              }
            }
          })
        }
      }
    }, 'Equity curve. ' + sum);
  }

  function hBarHeight(boxId, n) { $(boxId).style.minHeight = Math.max(220, 54 * n + 40) + 'px'; }

  function chartSetup(t, trades) {
    var g = M.groupStats(trades, function (x) { return x.setup || 'No setup'; }, P)
      .sort(function (a, b) { return (b.expectancyR == null ? -1e9 : b.expectancyR) - (a.expectancyR == null ? -1e9 : a.expectancyR); });
    var vals = g.map(function (s) { return s.expectancyR == null ? null : +s.expectancyR.toFixed(3); });
    var best = g[0], worst = g[g.length - 1];
    var sum = setSum('sum-setup', g.length > 1
      ? 'Expectancy per trade. Best: ' + esc(best.key) + ' ' + pnlR(best.expectancyR) + ' (n ' + best.n + '). Weakest: ' + esc(worst.key) + ' ' + pnlR(worst.expectancyR) + ' (n ' + worst.n + ').'
      : 'Expectancy per trade for ' + esc(best.key) + ': ' + pnlR(best.expectancyR) + ' (n ' + best.n + ').');
    hBarHeight('box-setup', g.length);
    make('setup', 'c-setup', {
      type: 'bar',
      data: {
        labels: g.map(function (s) { return [s.key, 'n ' + s.n + ' · ' + pct(s.winRate) + ' win']; }),
        datasets: [{ data: vals, backgroundColor: pnlColors(t, vals), borderRadius: 6, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.85, maxBarThickness: 26 }]
      },
      plugins: [valueLabels],
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 8, left: 4 } },
        scales: {
          x: axis(t, { grace: '22%', grid: zeroGrid(t), ticks: { maxTicksLimit: 5, callback: function (v) { return rFmt(v, 1); } } }),
          y: axis(t, { grid: { display: false }, ticks: { color: t.fg, font: { size: 12 } } })
        },
        plugins: {
          legend: { display: false },
          tcValueLabels: { formatter: function (v) { return rFmt(v); }, color: t.fg },
          tooltip: tooltip(t, { callbacks: {
            title: function (it) { return g[it[0].dataIndex].key; },
            label: function (it) { var s = g[it.dataIndex]; return ['Expectancy ' + rFmt(s.expectancyR), 'Net ' + signedMoney(s.netPnl, 0), s.n + ' trades · ' + pct(s.winRate) + ' win']; }
          } })
        }
      }
    }, 'Performance by setup. ' + sum);
  }

  function simpleBars(key, canvasId, t, rows, labelFn, sumId, title, opts) {
    opts = opts || {};
    var vals = rows.map(function (r) { return r.n ? r.netPnl : null; });
    var traded = rows.filter(function (r) { return r.n; });
    var sum;
    if (traded.length) {
      var best = traded.slice().sort(function (a, b) { return b.netPnl - a.netPnl; })[0];
      var worst = traded.slice().sort(function (a, b) { return a.netPnl - b.netPnl; })[0];
      sum = setSum(sumId, 'Best ' + esc(opts.name ? opts.name(best) : best.key) + ' ' + pnlMoney(best.netPnl, 0) +
        ' · worst ' + esc(opts.name ? opts.name(worst) : worst.key) + ' ' + pnlMoney(worst.netPnl, 0));
    } else sum = setSum(sumId, 'No trades yet.');
    make(key, canvasId, {
      type: 'bar',
      data: { labels: rows.map(labelFn), datasets: [{ data: vals, backgroundColor: pnlColors(t, vals), borderRadius: 5, borderSkipped: false, maxBarThickness: 34, categoryPercentage: 0.8 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 6 } },
        scales: {
          x: axis(t, { grid: { display: false }, ticks: Object.assign({ maxRotation: 0, autoSkipPadding: 6 }, opts.xTicks || {}) }),
          y: axis(t, { grid: zeroGrid(t), ticks: { maxTicksLimit: 5, callback: function (v) { return signedCompact(v); } } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(t, { callbacks: {
            title: function (it) { var r = rows[it[0].dataIndex]; return opts.name ? opts.name(r) : String(r.key); },
            label: function (it) { var r = rows[it.dataIndex]; return ['Net ' + signedMoney(r.netPnl, 0), r.n + ' trades · ' + pct(r.winRate) + ' win']; }
          } })
        }
      }
    }, title + '. ' + sum);
  }

  function chartTimeOfDay(t, trades) {
    var rows = M.byTimeOfDay(trades, P, 30);
    simpleBars('timeofday', 'c-tod', t, rows, function (r) { return r.key; }, 'sum-tod', 'Net P&L by entry time, 30-minute buckets',
      { name: function (r) { return r.key + '–' + endOf(r.key); }, xTicks: { autoSkip: true, maxTicksLimit: 8 } });
    var s = $('sum-tod'); s.innerHTML += ' <span class="muted">(' + esc(TZ.replace(/_/g, ' ')) + ')</span>';
  }
  function endOf(hhmm) { var p = hhmm.split(':'); var mm = +p[0] * 60 + +p[1] + 30; return (mm / 60 < 10 ? '0' : '') + Math.floor(mm / 60) % 24 + ':' + (mm % 60 < 10 ? '0' : '') + mm % 60; }

  function chartHolding(t, trades) {
    var rows = M.holdingBuckets(trades);
    simpleBars('holding', 'c-hold', t, rows, function (r) { return [r.key, 'n ' + r.n]; }, 'sum-hold', 'Net P&L by holding period');
  }

  function chartDow(t, trades) {
    var rows = M.byDayOfWeek(trades, P);
    simpleBars('dayofweek', 'c-dow', t, rows, function (r) { return [r.key, 'n ' + r.n]; }, 'sum-dow', 'Net P&L by weekday');
  }

  function chartRDist(t, trades) {
    var bins = M.rDistribution(trades, P, 0.5);
    if (!bins.length) { panelMsg('rdist', 'R needs a risk per trade. Add initial risk to trades or default_risk_per_trade to your profile.'); return; }
    var rs = trades.map(function (x) { return M.rOf(x, P); }).filter(function (r) { return r != null; }).sort(function (a, b) { return a - b; });
    var med = rs[Math.floor((rs.length - 1) / 2)];
    var beyond = rs.filter(function (r) { return r < -1.05; }).length;
    var sum = setSum('sum-rdist', 'Median ' + rFmt(med) + ' · ' + beyond + ' of ' + rs.length + ' trades lost more than 1R');
    make('rdist', 'c-rdist', {
      type: 'bar',
      data: {
        labels: bins.map(function (b) { return (b.from >= 0 ? '+' : MINUS) + Math.abs(b.from).toFixed(1); }),
        datasets: [{
          data: bins.map(function (b) { return b.n; }),
          backgroundColor: bins.map(function (b) { return b.from >= 0 ? rgba(t.gain, 0.72) : rgba(t.loss, 0.72); }),
          borderRadius: 4, borderSkipped: false, categoryPercentage: 0.94, barPercentage: 0.94
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: axis(t, { grid: { display: false }, title: { display: true, text: 'R multiple (bin start)', color: t.muted, font: { size: 11 } }, ticks: { maxRotation: 0, autoSkipPadding: 8 } }),
          y: axis(t, { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5 } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(t, { callbacks: {
            title: function (it) { var b = bins[it[0].dataIndex]; return rFmt(b.from, 1) + ' to ' + rFmt(b.to, 1); },
            label: function (it) { return it.raw + (it.raw === 1 ? ' trade' : ' trades'); }
          } })
        }
      }
    }, 'R-multiple histogram. ' + sum);
  }

  function chartLeak(t, trades) {
    var rows = M.leakMap(trades, P);
    if (!rows.length) { setSum('sum-leak', 'Dollars lost per mistake tag.'); panelMsg('leakmap', 'No mistake tags in this range. Clean trading, or nothing tagged yet.'); return; }
    var w = rows[0];
    var sum = setSum('sum-leak', 'Biggest leak: ' + esc(humanTag(w.tag)) + ' ' + pnlMoney(w.pnl, 0) + ' over ' + w.n + ' trades (' + esc(rFmt(w.r, 1)) + ')');
    var vals = rows.map(function (r) { return Math.round(r.pnl * 100) / 100; });
    $('box-leak').style.minHeight = Math.max(220, 50 * rows.length + 40) + 'px';
    make('leakmap', 'c-leak', {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return [humanTag(r.tag), 'n ' + r.n + ' · ' + rFmt(r.r, 1)]; }),
        datasets: [{ data: vals, backgroundColor: pnlColors(t, vals, 0.8), borderRadius: 6, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.85, maxBarThickness: 24 }]
      },
      plugins: [valueLabels],
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: {
          x: axis(t, { grace: '28%', grid: zeroGrid(t), ticks: { maxTicksLimit: 4, callback: function (v) { return signedCompact(v); } } }),
          y: axis(t, { grid: { display: false }, ticks: { color: t.fg, font: { size: 12 } } })
        },
        plugins: {
          legend: { display: false },
          tcValueLabels: { formatter: function (v) { return signedCompact(v); }, color: t.fg },
          tooltip: tooltip(t, { callbacks: {
            title: function (it) { return humanTag(rows[it[0].dataIndex].tag); },
            label: function (it) { var r = rows[it.dataIndex]; return ['Net ' + signedMoney(r.pnl, 0) + ' · ' + rFmt(r.r, 1), r.n + ' trades tagged']; }
          } })
        }
      }
    }, 'Leak map. ' + sum);
  }

  function chartState(t, trades) {
    var sv = M.stateVsOutcome(trades, J, P);
    var total = sv.mood.concat(sv.sleep).reduce(function (s, r) { return s + r.n; }, 0);
    if (!total) { setSum('sum-state', 'From your journal: mood and sleep against results.'); panelMsg('state', 'Add mood and sleep to your journal entries to see how they line up with results.'); return; }
    var metric = state.stateMetric;
    function pick(r) { return r.n ? (metric === 'avgR' ? (r.avgR == null ? null : +r.avgR.toFixed(3)) : r.netPnl) : null; }
    function fmt(v) { return metric === 'avgR' ? rFmt(v) : signedCompact(v); }
    function bestOf(list) { var l = list.filter(function (r) { return r.n >= 3 && pick(r) != null; }); return l.sort(function (a, b) { return pick(b) - pick(a); }); }
    var mo = bestOf(sv.mood), sl = bestOf(sv.sleep);
    var parts = [];
    if (mo.length > 1) parts.push('Mood ' + mo[0].key + ' ' + pnl(pick(mo[0]), fmt(pick(mo[0]))) + ' vs mood ' + mo[mo.length - 1].key + ' ' + pnl(pick(mo[mo.length - 1]), fmt(pick(mo[mo.length - 1]))));
    if (sl.length > 1) parts.push('sleep ' + esc(sl[0].key) + ' ' + pnl(pick(sl[0]), fmt(pick(sl[0]))) + ' vs ' + esc(sl[sl.length - 1].key) + ' ' + pnl(pick(sl[sl.length - 1]), fmt(pick(sl[sl.length - 1]))));
    var sum = setSum('sum-state', (parts.length ? parts.join(' · ') : 'Not enough journal-linked trades yet.') + (metric === 'avgR' ? ' (avg R per trade)' : ' (net)'));
    [['mood', 'c-mood', sv.mood, function (r) { return [String(r.key), 'n ' + r.n]; }, 'Mood'],
     ['sleep', 'c-sleep', sv.sleep, function (r) { return [r.key, 'n ' + r.n]; }, 'Sleep']].forEach(function (cfg) {
      var rows = cfg[2], vals = rows.map(pick);
      make(cfg[0], cfg[1], {
        type: 'bar',
        data: { labels: rows.map(cfg[3]), datasets: [{ data: vals, backgroundColor: pnlColors(t, vals), borderRadius: 5, borderSkipped: false, maxBarThickness: 30 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            x: axis(t, { grid: { display: false }, ticks: { maxRotation: 0 } }),
            y: axis(t, { grid: zeroGrid(t), ticks: { maxTicksLimit: 4, callback: function (v) { return metric === 'avgR' ? rFmt(v, 1) : signedCompact(v); } } })
          },
          plugins: {
            legend: { display: false },
            tooltip: tooltip(t, { callbacks: {
              title: function (it) { return cfg[4] + ' ' + rows[it[0].dataIndex].key; },
              label: function (it) { var r = rows[it.dataIndex]; return ['Avg ' + rFmt(r.avgR) + ' · net ' + signedMoney(r.netPnl, 0), r.n + ' trades']; }
            } })
          }
        }
      }, cfg[4] + ' vs outcome. ' + sum);
    });
  }

  function chartRolling(t, trades) {
    var rows = M.rolling(trades, P, 20);
    if (!rows.length) { setSum('sum-rolling', 'Expectancy and win rate over the last 20 trades.'); panelMsg('rolling', 'Needs at least 20 trades in this range (you have ' + trades.length + ').'); return; }
    var last = rows[rows.length - 1], firstRow = rows[0];
    var sum = setSum('sum-rolling', 'Latest 20: ' + pnlR(last.expectancyR) + ' expectancy, ' + pct(last.winRate) + ' win · first 20: ' + pnlR(firstRow.expectancyR) + ', ' + pct(firstRow.winRate));
    make('rolling', 'c-rolling', {
      type: 'line',
      data: {
        labels: rows.map(function (r) { return '#' + r.index; }),
        datasets: [
          { label: 'Expectancy', data: rows.map(function (r) { return r.expectancyR; }), yAxisID: 'y', borderColor: t.gold, backgroundColor: t.gold, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
          { label: 'Win %', data: rows.map(function (r) { return r.winRate == null ? null : r.winRate * 100; }), yAxisID: 'y1', borderColor: t.purple, backgroundColor: t.purple, borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: axis(t, { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } }),
          y: axis(t, { position: 'left', grid: zeroGrid(t), ticks: { maxTicksLimit: 5, color: t.gold, callback: function (v) { return rFmt(v, 1); } } }),
          y1: axis(t, { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { maxTicksLimit: 5, color: t.purple, callback: function (v) { return v + '%'; } } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(t, { callbacks: {
            title: function (it) { var r = rows[it[0].dataIndex]; return 'Trades ' + (r.index - 19) + '–' + r.index; },
            label: function (it) { return it.datasetIndex === 0 ? 'Expectancy ' + rFmt(it.raw) : 'Win rate ' + Math.round(it.raw) + '%'; }
          } })
        }
      }
    }, 'Rolling 20-trade expectancy and win rate. ' + sum);
  }

  function chartMae(t, trades) {
    var pts = trades.filter(function (x) { return isNum(x.mae) && isNum(x.mfe); });
    if (!pts.length) { panelMsg('maemfe', 'No MAE/MFE values in this range.'); return; }
    var sum = setSum('sum-mae', 'Each dot is a trade: how far it went against you (MAE) and in your favour (MFE). ' + pts.length + ' trades.');
    make('maemfe', 'c-mae', {
      type: 'scatter',
      data: { datasets: [{
        data: pts.map(function (x) { return { x: Math.abs(x.mae), y: Math.abs(x.mfe) }; }),
        pointBackgroundColor: pts.map(function (x) { return x.pnl_net >= 0 ? rgba(t.gain, 0.75) : rgba(t.loss, 0.75); }),
        pointStyle: pts.map(function (x) { return x.pnl_net >= 0 ? 'triangle' : 'rectRot'; }),
        pointRadius: 5, pointHoverRadius: 7, borderWidth: 0
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: axis(t, { beginAtZero: true, title: { display: true, text: 'MAE (against you)', color: t.muted } }),
          y: axis(t, { beginAtZero: true, title: { display: true, text: 'MFE (in your favour)', color: t.muted } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(t, { callbacks: {
            title: function (it) { var x = pts[it[0].dataIndex]; return x.symbol + ' · ' + fmtDateTime(exitIso(x)); },
            label: function (it) { var x = pts[it.dataIndex]; return ['MAE ' + Math.abs(x.mae) + ' · MFE ' + Math.abs(x.mfe), 'Result ' + signedMoney(x.pnl_net, 2)]; }
          } })
        }
      }
    }, 'MAE versus MFE scatter. ' + sum);
  }

  /* ---------------- quote of the day ---------------- */
  /* From her own notes: the quote her Claude picked (insights.quote), else a lesson she wrote
     (plan-followed days first), else a sourced quote. Process, not money; same line all day. */
  var QUOTES = [
    ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
    ['We suffer more often in imagination than in reality.', 'Seneca'],
    ['Well done is better than well said.', 'Benjamin Franklin'],
    ['The best way out is always through.', 'Robert Frost'],
    ['Courage is grace under pressure.', 'Ernest Hemingway'],
    ["I am not afraid of storms, for I am learning how to sail my ship.", 'Louisa May Alcott'],
    ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt']
  ];
  function pickQuote(data, day) {
    var q = data && data.insights && data.insights.quote;
    if (q && typeof q.text === 'string' && q.text.trim()) return [q.text.trim(), q.by || ''];
    var lessons = ((data && data.journal) || []).filter(function (e) {
      return e && typeof e.lesson === 'string' && e.lesson.trim() && e.lesson.length <= 240;
    });
    var good = lessons.filter(function (e) { return e.followed_plan === true; });
    var pool = (good.length ? good : lessons).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 30);
    if (pool.length) {
      var e = pool[day % pool.length];
      return [e.lesson.trim(), e.date ? 'You, ' + fmtShort(e.date) : 'You'];
    }
    return QUOTES[day % QUOTES.length];
  }
  function renderQuote(data) {
    var now = new Date();
    var day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 864e5);
    var q = pickQuote(data, day);
    $('quote-text').textContent = q[0];
    $('quote-by').textContent = q[1];
    $('quote-by').hidden = !q[1];
    $('quote').hidden = false;
  }

  /* ---------------- start ---------------- */
  function start() {
    try { boot(); }
    catch (e) {
      if (window.console) console.error('[Trading Assistant] could not start:', e);
      showEmpty();
    }
  }
  window.TC_DASH = { state: state, charts: charts, render: function () { render(); } };

  if (DEMO && window.__tcSample === 'loading') window.addEventListener('tc:sample', start, { once: true });
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
