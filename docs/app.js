/* basket-check: the page's own logic. Every number comes from data.js, which
   study/summarise.py writes from BetaShares' public files. Nothing here is typed. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var SVG = 'http://www.w3.org/2000/svg';
  var C = { ink: '#1a1d21', soft: '#5b6470', faint: '#8b95a1', rule: '#e2e0dc', rule2: '#c9c5be', band: '#ebe8e2',
    accent: '#2c4a6b', mine: '#2a78d6', look: '#d9622b', floor: '#9aa3ad', neg: '#b03a3a' };
  var MONO = "'IBM Plex Mono',monospace", SANS = "'IBM Plex Sans',sans-serif", SERIF = "'Newsreader',Georgia,serif";
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MINUS = '−';

  function el(tag, attrs, text) {
    var n = document.createElementNS(SVG, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dt(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function dShort(iso) { var d = dt(iso); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCFullYear(); }
  function dLong(iso) { var d = dt(iso); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function dDay(iso) { var d = dt(iso); return DAYS[d.getUTCDay()] + ' ' + dLong(iso); }
  function sgn(x, n) {
    if (x == null) return 'n/a';
    var v = Math.abs(x).toFixed(n == null ? 1 : n);
    if (+v === 0) return v;
    return (x < 0 ? MINUS : '+') + v;
  }
  function abs1(x) { return Math.abs(x).toFixed(1); }
  function int(x) { return Math.round(x).toLocaleString('en-AU'); }
  function px(x) { return 'A$' + (x >= 1 ? x.toFixed(2) : x.toFixed(3).replace(/0$/, '')); }
  function money(x) {
    var a = Math.abs(x);
    if (a >= 1e9) return 'A$' + (x / 1e9).toFixed(2) + ' bn';
    if (a >= 1e6) return 'A$' + (x / 1e6).toFixed(1) + ' m';
    return 'A$' + int(x);
  }
  // The files print company names in capitals; prose reads them in title case.
  function nameCase(n) {
    return String(n).toLowerCase().replace(/\b([a-z])/g, function (c) { return c.toUpperCase(); })
      .replace(/\bCdi\b/g, 'CDI').replace(/\bBpce\b/g, 'BPCE').replace(/\bSa\b/g, 'SA').replace(/\bReit\b/g, 'REIT').replace(/\bPlc\b/g, 'plc').replace(/\bEvt\b/g, 'EVT').replace(/\bGqg\b/g, 'GQG');
  }
  var NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function nw(n) { return n >= 0 && n < NUMW.length ? NUMW[n] : String(n); }
  function Nw(n) { var w = nw(n); return w.charAt(0).toUpperCase() + w.slice(1); }
  function pill(t, cls) { return '<span class="pill ' + (cls || '') + '">' + esc(t) + '</span>'; }


  var S = D.summary;
  var F = D.funds;
  var BY_TK = {};
  F.forEach(function (f, i) { BY_TK[f.tk] = i; });
  var state = { tol: D.tol, sel: null };
  var FAM_SHORT = {
    'Australian shares': 'AU shares', 'International shares': 'Intl shares', 'Funds of funds': 'Funds of funds',
    'Hybrids': 'Hybrids', 'Options overlay': 'Options', 'Currency hedged': 'Hedged', 'Geared': 'Geared', 'Futures and cash': 'Futures',
    'Fixed rate bonds': 'Fixed rate bonds', 'Floating rate bonds': 'Floating', 'International bonds': 'Intl bonds', 'Other': 'Other'
  };
  function fileDate() { return S.dates[S.dates.length - 1]; }
  function famOf(name) { return F.filter(function (f) { return f.family === name; }); }

  /* ---------- the header ---------- */
  function fillHeader() {
    var au = famOf('Australian shares'), hedged = famOf('Currency hedged');
    var auIn = au.filter(function (f) { return Math.abs(f.dated) <= D.tol; }).length;
    var hedgedMed = hedged.length ? hedged.map(function (f) { return Math.abs(f.mine); }).sort(function (a, b) { return a - b; })[Math.floor(hedged.length / 2)] : null;
    var ib = S.intl_by_date || [];
    $('#dek').innerHTML = 'An ETF pricing desk checks every day that each fund\u2019s basket adds up to the NAV the issuer publishes. ' +
      'I ran that check on one day of public holdings files, ' + esc(dLong(fileDate())) + ', from every BetaShares fund that publishes one. ' +
      '<strong>Read as printed, most files miss. Dated properly, ' + auIn + ' of the ' + au.length + ' Australian share funds land within ' + D.tol +
      ' bp, and the bond funds come most of the way once each bond carries the interest it has earned. ' +
      'The currency hedged funds cannot be checked from their files, which leave the hedge out, and the international funds share a gap that moves from day to day.</strong>';
    $('#bluf-h').textContent = 'Dates and bond interest close most gaps; hedged and international funds stay off';
    var q = $('#qgrid');
    q.innerHTML =
      '<div><b>How many files add up as printed?</b><span class="num">' + (S.n - S.printed_out) + '</span> of ' + S.n +
      ' funds land within ' + String.fromCharCode(177) + D.tol + ' bp of the net assets on their own page.</div>' +
      '<div><b>How many add up once dated and read line by line?</b><span class="num">' + (S.n - S.mine_out) + '</span> of ' + S.n + '.</div>' +
      '<div><b>What is the largest correction the files allow?</b>Bond interest: it moves the typical Australian fixed rate bond fund from <span class="num">' +
      S.bond_dated_median.toFixed(0) + '</span> bp off to ' + S.bond_mine_median.toFixed(0) + ' bp off.</div>' +
      '<div><b>What does it still get wrong?</b>The currency hedged funds, which miss by a median of <span class="num">' + (hedgedMed != null ? hedgedMed.toFixed(0) : '') +
      '</span> bp because their files leave the hedge out' + (ib.length > 1 ? ', and an international gap that went from ' + sgn(ib[0].median, 0) + ' bp on ' + dShort(ib[0].d) + ' to ' + sgn(ib[ib.length - 1].median, 0) + ' bp on ' + dShort(ib[ib.length - 1].d) : '') + '.</div>';
    var g = $('#gloss-bp');
    var a200 = F[BY_TK.A200];
    if (g && a200) g.textContent = 'A hundredth of a percent. On a unit worth A$' + a200.nav.toFixed(2) + ', the largest fund\u2019s NAV that day, one basis point is ' +
      (a200.nav / 100).toFixed(1) + ' cents.';
  }

  /* ---------- strips: one mark per fund, one strip per way of checking ---------- */
  function drawStrips(host, cfg) {
    var tip = host.querySelector('.tip');
    Array.prototype.slice.call(host.querySelectorAll('svg')).forEach(function (n) { n.remove(); });
    var W = Math.max(300, Math.round(host.clientWidth || 860));
    var narrow = W < 560;
    var N = cfg.items.length;
    var P = { l: narrow ? 46 : 58, r: 8 };
    var titleH = narrow ? 34 : 22, stripH = narrow ? 80 : 88, gap = 10, axisH = narrow ? 62 : 58;
    var unit = titleH + stripH + gap;
    var H = cfg.series.length * unit + axisH;
    var step = (W - P.l - P.r) / N;
    var X = function (i) { return P.l + (i + 0.5) * step; };
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': cfg.aria });
    var clip = cfg.clip, tol = cfg.tol;
    // Family bands behind the strips, so the eye reads the marks in groups.
    cfg.groups.forEach(function (g, k) {
      if (k % 2) s.appendChild(el('rect', { x: P.l + g.start * step, y: titleH - 4, width: (g.end - g.start) * step, height: cfg.series.length * unit - titleH - gap + 4, fill: '#f5f3ef' }));
    });
    if (cfg.sel != null && cfg.sel >= 0) {
      var sw = Math.max(6, step);
      s.appendChild(el('rect', { x: X(cfg.sel) - sw / 2, y: titleH - 4, width: sw, height: cfg.series.length * unit - titleH - gap + 8,
        fill: 'rgba(44,74,107,.12)', stroke: C.accent, 'stroke-width': 1 }));
    }
    cfg.series.forEach(function (ser, k) {
      var top = k * unit + titleH;
      var half = stripH / 2 - 7;
      var Y = function (v) { var c = Math.max(-clip, Math.min(clip, v)); return top + stripH / 2 - c / clip * half; };
      s.appendChild(el('rect', { x: P.l, y: Y(tol), width: W - P.l - P.r, height: Math.max(1, Y(-tol) - Y(tol)), fill: C.band }));
      s.appendChild(el('line', { x1: P.l, y1: Y(0), x2: W - P.r, y2: Y(0), stroke: C.rule2 }));
      if (cfg.floor) {
        [cfg.floor, -cfg.floor].forEach(function (v) {
          s.appendChild(el('line', { x1: P.l, y1: Y(v), x2: W - P.r, y2: Y(v), stroke: C.faint, 'stroke-dasharray': '4 4' }));
        });
        if (k === cfg.series.length - 1 && !narrow) s.appendChild(el('text', { x: P.l + 4, y: Y(cfg.floor) - 4, 'text-anchor': 'start', 'font-family': SANS, 'font-size': 10.5, fill: C.faint },
          'a one day slip, ' + String.fromCharCode(177) + cfg.floor.toFixed(0) + ' bp'));
      }
      [clip, 0, -clip].forEach(function (v) {
        s.appendChild(el('text', { x: P.l - 5, y: Y(v) + 3.5, 'text-anchor': 'end', 'font-family': MONO, 'font-size': narrow ? 10 : 10.5, fill: C.faint },
          v === 0 ? '0' : (v > 0 ? '+' : MINUS) + Math.abs(v)));
      });
      var ty = top - (narrow ? 20 : 7);
      s.appendChild(el('rect', { x: P.l, y: ty - 9, width: 10, height: 10, rx: 2, fill: ser.colour }));
      s.appendChild(el('text', { x: P.l + 15, y: ty, 'font-family': SANS, 'font-size': narrow ? 12.5 : 13, 'font-weight': 600, fill: C.ink }, narrow ? ser.short : ser.label));
      var count = ser.vals.filter(function (v) { return v != null && Math.abs(v) > tol; }).length;
      var ctext = count + ' of ' + ser.vals.length + (narrow ? ' outside the band' : ' outside ' + String.fromCharCode(177) + tol + ' bp');
      s.appendChild(el('text', narrow ? { x: P.l + 15, y: ty + 15, 'font-family': MONO, 'font-size': 11, fill: C.soft }
        : { x: W - P.r, y: ty, 'text-anchor': 'end', 'font-family': MONO, 'font-size': 11.5, fill: C.soft }, ctext));
      var wStem = Math.max(1.5, Math.min(6, step * 0.55));
      ser.vals.forEach(function (v, i) {
        if (v == null) return;
        var out = Math.abs(v) > tol;
        if (Math.abs(v) >= 0.05) s.appendChild(el('line', { x1: X(i), y1: Y(0), x2: X(i), y2: Y(v), stroke: ser.colour, 'stroke-width': wStem, 'stroke-opacity': out ? 1 : 0.4 }));
        s.appendChild(el('circle', { cx: X(i), cy: Y(v), r: Math.abs(v) > clip ? 2.8 : 1.8, fill: Math.abs(v) > clip ? '#fff' : ser.colour, stroke: ser.colour, 'stroke-width': 1.2 }));
      });
    });
    // The family of each run of marks, along the bottom.
    var axY = cfg.series.length * unit - gap + 4;
    s.appendChild(el('line', { x1: P.l, y1: axY, x2: W - P.r, y2: axY, stroke: C.rule2 }));
    // Labels sit under their group; one that would touch its neighbour drops to a second row.
    var lastRight = [-1e9, -1e9];
    cfg.groups.forEach(function (g) {
      var x0 = P.l + g.start * step, x1 = P.l + g.end * step;
      s.appendChild(el('line', { x1: x0, y1: axY, x2: x0, y2: axY + 5, stroke: C.rule2 }));
      var fs = narrow ? 9.5 : 10.5, cw = fs * 0.62;
      var lab = (narrow ? g.short : g.label);
      if (lab.length * cw > (x1 - x0) + 30) lab = g.short;
      var w = lab.length * cw, cx = Math.min(W - P.r - w / 2, Math.max(P.l + w / 2, (x0 + x1) / 2));
      var row = cx - w / 2 > lastRight[0] + 6 ? 0 : (cx - w / 2 > lastRight[1] + 6 ? 1 : -1);
      if (row < 0) return;
      lastRight[row] = cx + w / 2;
      s.appendChild(el('text', { x: cx, y: axY + 15 + row * 12, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': fs, fill: C.faint }, lab));
    });
    s.appendChild(el('text', { x: (P.l + W - P.r) / 2, y: H - 6, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': narrow ? 11.5 : 12, fill: C.soft }, narrow && cfg.xTitleShort ? cfg.xTitleShort : cfg.xTitle));
    var midY = (titleH + cfg.series.length * unit - gap) / 2;
    s.appendChild(el('text', { x: 12, y: midY, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': narrow ? 11.5 : 12, fill: C.soft,
      transform: 'rotate(-90 12 ' + midY + ')' }, cfg.yTitle));
    var hit = el('rect', { x: P.l, y: 0, width: W - P.l - P.r, height: cfg.series.length * unit, fill: 'transparent', style: 'cursor:pointer' });
    function idxAt(evt) {
      var r = s.getBoundingClientRect();
      var x = (evt.clientX - r.left) * (W / r.width);
      return Math.max(0, Math.min(N - 1, Math.floor((x - P.l) / step)));
    }
    hit.addEventListener('pointermove', function (evt) {
      if (!tip || !cfg.tipFor) return;
      var i = idxAt(evt), hr = host.getBoundingClientRect();
      tip.innerHTML = cfg.tipFor(i);
      tip.style.display = 'block';
      var left = evt.clientX - hr.left + 12, tw = tip.offsetWidth;
      if (left + tw > hr.width) left = evt.clientX - hr.left - tw - 12;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = (evt.clientY - hr.top + 14) + 'px';
    });
    hit.addEventListener('pointerleave', function () { if (tip) tip.style.display = 'none'; });
    hit.addEventListener('click', function (evt) { if (cfg.onSel) cfg.onSel(idxAt(evt)); });
    s.appendChild(hit);
    host.insertBefore(s, tip || null);
  }
  function groups() {
    var out = [], cur = null;
    F.forEach(function (f, i) {
      if (!cur || cur.label !== f.family) { cur = { label: f.family, short: FAM_SHORT[f.family] || f.family, start: i, end: i + 1 }; out.push(cur); }
      else cur.end = i + 1;
    });
    return out;
  }
  function seriesBluf() {
    return [
      { label: 'As printed: file against the net assets on the fund’s page', short: 'As printed', colour: C.floor, vals: F.map(function (f) { return f.printed; }) },
      { label: 'Dated: file against NAV on the file’s own date, times units', short: 'Dated', colour: C.look, vals: F.map(function (f) { return f.dated; }) },
      { label: 'Mine: dated, and every fixed rate bond carrying its earned interest', short: 'Mine', colour: C.mine, vals: F.map(function (f) { return f.mine; }) }
    ];
  }
  function renderBluf() {
    drawStrips($('#blufviz'), {
      items: F, series: seriesBluf(), groups: groups(), tol: state.tol, clip: 150, sel: state.sel, floor: S.floor_median,
      aria: 'Gap between each fund’s holdings file and its published value, three ways',
      xTitle: 'Every fund with a holdings file, ' + dLong(fileDate()) + ', grouped by kind',
      xTitleShort: 'Every fund, ' + dShort(fileDate()) + ', by kind',
      yTitle: 'Gap to published value, bp',
      tipFor: function (i) {
        var f = F[i];
        return esc(f.tk) + ' · ' + esc(f.family) + '<br>as printed ' + sgn(f.printed) + ' bp<br>dated ' + sgn(f.dated) + ' bp<br>mine ' + sgn(f.mine) + ' bp';
      },
      onSel: function (i) { state.sel = i; renderBluf(); renderFund($('#fundcard'), F[i]); }
    });
    var ser = seriesBluf(), tol = state.tol;
    $('#blufstat').innerHTML = ser.map(function (x) {
      var c = x.vals.filter(function (v) { return v != null && Math.abs(v) > tol; }).length;
      var med = x.vals.map(Math.abs).sort(function (a, b) { return a - b; })[Math.floor(x.vals.length / 2)];
      return '<div><div class="k"><i style="background:' + x.colour + '"></i>' + esc(x.short) + '</div><div class="n">' + c +
        ' <span style="font-size:13px;color:#8b95a1">of ' + F.length + '</span></div><div class="s">funds outside ' +
        String.fromCharCode(177) + tol + ' bp; median gap ' + med.toFixed(1) + ' bp</div></div>';
    }).join('');
    $('#blufhint').innerHTML = 'Click any fund on the chart. The box under it says what its file shows. Marks beyond ' + String.fromCharCode(177) +
      '150 bp are cut and drawn as open circles.';
    var medP = ser[0].vals.map(Math.abs).sort(function (a, b) { return a - b; })[Math.floor(F.length / 2)];
    var medM = ser[2].vals.map(Math.abs).sort(function (a, b) { return a - b; })[Math.floor(F.length / 2)];
    $('#v0').innerHTML = '<b>Reading each file on its own date and adding bond interest cuts the median gap from ' + medP.toFixed(0) + ' bp to ' + medM.toFixed(0) + ' bp.</b> ' +
      'Both corrections come from the files and the issuer’s own NAV history, with no outside data. ' +
      'What stays outside are the currency hedged funds, whose files leave the hedge out, the funds that move through futures, loans or options, and an international gap that moves from day to day.';
  }
  function tolChips() {
    var host = $('#tolchips');
    host.innerHTML = '';
    [2, 5, 10, 25].forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'chip'; b.textContent = String.fromCharCode(177) + t + ' bp';
      b.setAttribute('aria-pressed', t === state.tol ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.tol = t;
        Array.prototype.forEach.call(host.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
        renderBluf(); renderFund($('#fundcard'), F[state.sel]); renderLog();
      });
      host.appendChild(b);
    });
  }

  /* ---------- one fund, in words ---------- */
  function tradingDaysBetween(a, b) {
    if (!a || !b || a === b) return 0;
    var d = dt(a), e = dt(b), n = 0;
    while (d < e) { d = new Date(d.getTime() + 864e5); if (d.getUTCDay() % 6) n++; }
    return n;
  }
  function fundParagraphs(f, tol) {
    var out = [];
    var na = f.nav * f.units;
    out.push(f.name + ' (' + f.tk + '): its file for ' + dLong(f.d) + ' has ' + f.lines + ' lines adding up to ' + money(f.mv) + '. ' +
      'The NAV that day, A$' + f.nav.toFixed(4) + ', times the ' + int(f.units) + ' units on issue is ' + money(na) + ', so the file is ' +
      abs1(f.dated) + ' bp ' + (f.dated >= 0 ? 'above' : 'below') + ' the fund.');
    var lag = tradingDaysBetween(f.d, f.nav_as_at);
    if (f.net_assets && Math.abs(f.printed - f.dated) > 1) {
      out.push('The net assets on the fund’s page, ' + money(f.net_assets) + ', are as at ' + dLong(f.nav_as_at || f.units_as_at || f.d) +
        (lag ? ', ' + nw(lag) + ' trading ' + (lag === 1 ? 'day' : 'days') + ' after the file' : '') + '. Checked against that figure the file misses by ' +
        abs1(f.printed) + ' bp, most of it the fund’s move in between rather than anything in the file.');
    }
    if (f.family === 'Fixed rate bonds' || (f.fixed && f.accrued_bp)) {
      out.push(f.fixed + ' of its lines are fixed rate bonds, which the file prints at clean prices. The interest they have earned since their last coupons comes to ' +
        abs1(f.accrued_bp) + ' bp of the fund, worked out from each line’s coupon, maturity and face value. With it, the gap is ' + sgn(f.mine) + ' bp.' +
        (f.floating ? ' Its ' + f.floating + ' floating rate lines are left as printed.' : ''));
    }
    if (f.family === 'Floating rate bonds') {
      out.push('Its bonds are floating rate notes, marked Float in the file. Their printed values already sit within a few basis points of the NAV, so they appear to include the interest earned, and my rule leaves them alone.');
    }
    f.no_value.forEach(function (x) {
      if (x.kind === 'futures') out.push('The file lists ' + x.tk.replace(/ Index$/, '') + ' with ' + int(x.qty) + ' contracts and no value. Futures gains and losses settle in cash each day, so this line moves the NAV through the cash line, and the file cannot show by how much on the day it is dated.');
    });
    if (f.family === 'International shares') {
      out.push('The international share funds move together from day to day: act four shows their shared gap on each day collected, and the likely reason.');
    }
    if (f.family === 'Currency hedged') {
      out.push('This fund hedges its foreign currency back into Australian dollars. The hedge contracts are not lines in the file, so the file shows the holdings unhedged while the NAV includes the hedge\u2019s gain or loss. That is the likely cause of the gap, and the file cannot size it.');
    }
    var hasFut = f.no_value.some(function (x) { return x.kind === 'futures'; });
    if (f.family === 'Geared') out.push(hasFut ? 'This fund gets its gearing from futures, so most of its daily change runs through the futures line above.' :
      'A geared fund borrows: the loan shows as negative cash, and the interest owed on it is not a line in the file.');
    if (f.family === 'International bonds') out.push('Its bonds are in foreign currencies, hedged back into Australian dollars. The hedge contracts are not lines in the file, and my interest rule, written for Australian dollar bonds, leaves these bonds as printed.');
    if (f.family === 'Other') out.push('The file does not carry enough to explain the gap: some of what this fund holds moves its value without a line that says so.');
    if (f.family === 'Funds of funds') out.push('Its holdings are other ETFs, valued at their own prices on the day; their dates and pricing carry into this file.');
    if (f.family === 'Options overlay') out.push('The fund sells options on its holdings, and the file lists no option position. An option the fund owes makes it worth less than its shares, which fits a file that adds up to more than the NAV. That is the likely cause; the file cannot prove it.');
    if (f.family === 'Hybrids') out.push('Hybrids pay quarterly distributions, and the file gives no coupon or date for them, so I cannot work out what has been earned since the last one. The gap stays unexplained.');
    if (f.family === 'Futures and cash') out.push('Almost everything this fund does happens in the futures line, so its file can be checked against the NAV only through cash, which is not enough.');
    out.push(Math.abs(f.mine) <= tol ? 'Within ' + String.fromCharCode(177) + tol + ' bp once read this way.' : 'Outside ' + String.fromCharCode(177) + tol + ' bp, by ' + abs1(f.mine) + ' bp, after everything above.');
    return out;
  }
  function renderFund(host, f, opts) {
    if (!host || !f) return;
    opts = opts || {};
    var tol = opts.tol || state.tol;
    var ok = Math.abs(f.mine) <= tol;
    host.innerHTML = '<div class="card-title">' + esc(f.name) + ' (' + esc(f.tk) + ')</div><div>' + pill(f.family) + pill(ok ? 'Adds up' : 'Break', ok ? 'ok' : 'bad') + '</div>' +
      '<div class="facts">' +
      '<div><div class="k">File adds up to</div><div class="v">' + money(f.mv) + '</div></div>' +
      '<div><div class="k">As printed</div><div class="v" style="color:' + C.soft + '">' + sgn(f.printed) + ' bp</div></div>' +
      '<div><div class="k">Dated</div><div class="v" style="color:' + C.look + '">' + sgn(f.dated) + ' bp</div></div>' +
      '<div><div class="k">Mine</div><div class="v" style="color:' + C.mine + '">' + sgn(f.mine) + ' bp</div></div>' +
      '</div><div class="daytext">' + fundParagraphs(f, tol).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
  }

  /* ---------- the domain, drawn once ---------- */
  function drawDomain() {
    var host = $('#domainviz');
    if (!host) return;
    host.innerHTML = '';
    var narrow = window.innerWidth < 620;
    var steps = [
      { t: 'The holdings file', s: 'one line per holding, each with a quantity and a market value in Australian dollars' },
      { t: 'Its date', s: 'take the NAV for the day the file states, from the fund’s NAV history' },
      { t: 'Each line’s basis', s: 'add the interest each fixed rate bond has earned; note lines with no value' },
      { t: 'The file’s sum', s: 'what the holdings say the fund is worth' },
      { t: 'NAV times units', s: 'within tolerance, or a break with a likely cause' }
    ];
    var foot = 'The published value enters only at the very end, to grade the sum.';
    function wrap(txt, per) {
      var out = [], line = '';
      txt.split(' ').forEach(function (w) {
        if ((line + ' ' + w).length > per) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
      });
      if (line) out.push(line);
      return out;
    }
    if (narrow) {
      var W = 360, BW = 344, GAP = 16, lines = steps.map(function (b) { return wrap(b.s, 44); });
      var hs = lines.map(function (l) { return 26 + l.length * 15 + 10; });
      var H = hs.reduce(function (a, b) { return a + b + GAP; }, 0) + 34;
      var s2 = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'How one fund is checked' });
      var y = 4;
      steps.forEach(function (b, i) {
        var bh = hs[i];
        s2.appendChild(el('rect', { x: 8, y: y, width: BW, height: bh, rx: 6, fill: i === 4 ? '#f3f1ed' : '#fff', stroke: '#c9c5be' }));
        s2.appendChild(el('text', { x: 20, y: y + 22, 'font-family': SERIF, 'font-size': 17, 'font-weight': 600, fill: C.ink }, b.t));
        lines[i].forEach(function (ln, k) { s2.appendChild(el('text', { x: 20, y: y + 40 + k * 15, 'font-family': SANS, 'font-size': 12.5, fill: C.soft }, ln)); });
        if (i < steps.length - 1) {
          s2.appendChild(el('line', { x1: W / 2, y1: y + bh + 3, x2: W / 2, y2: y + bh + GAP - 3, stroke: C.faint, 'stroke-width': 1.5 }));
          s2.appendChild(el('circle', { cx: W / 2, cy: y + bh + GAP - 4, r: 2.5, fill: C.faint }));
        }
        y += bh + GAP;
      });
      wrap(foot, 50).forEach(function (ln, k) { s2.appendChild(el('text', { x: 8, y: y + 8 + k * 14, 'font-family': MONO, 'font-size': 11, fill: C.faint }, ln)); });
      host.appendChild(s2);
      $('#domainhint').textContent = 'The whole check in one picture. Read top to bottom.';
      return;
    }
    var W2 = 900, H2 = 190;
    var s = el('svg', { viewBox: '0 0 ' + W2 + ' ' + H2, role: 'img', 'aria-label': 'How one fund is checked' });
    var xs = [8, 188, 368, 548, 728], bw = 164;
    steps.forEach(function (b, i) {
      s.appendChild(el('rect', { x: xs[i], y: 26, width: bw, height: 118, rx: 6, fill: i === 4 ? '#f3f1ed' : '#fff', stroke: '#c9c5be' }));
      s.appendChild(el('text', { x: xs[i] + 12, y: 50, 'font-family': SERIF, 'font-size': 16, 'font-weight': 600, fill: C.ink }, b.t));
      var yy = 70;
      wrap(b.s, 25).forEach(function (ln) { s.appendChild(el('text', { x: xs[i] + 12, y: yy, 'font-family': SANS, 'font-size': 11, fill: C.soft }, ln)); yy += 14; });
      if (i < steps.length - 1) {
        s.appendChild(el('line', { x1: xs[i] + bw + 3, y1: 85, x2: xs[i + 1] - 3, y2: 85, stroke: C.faint, 'stroke-width': 1.5 }));
        s.appendChild(el('circle', { cx: xs[i + 1] - 5, cy: 85, r: 2.5, fill: C.faint }));
      }
    });
    s.appendChild(el('text', { x: 8, y: 170, 'font-family': MONO, 'font-size': 10.5, fill: C.faint }, foot));
    host.appendChild(s);
    $('#domainhint').textContent = 'The whole check in one picture. Read left to right.';
  }

  /* ---------- act one: one fund of each kind ---------- */
  var KINDS = [];
  function buildKinds() {
    var prefer = { 'Australian shares': 'A200', 'International shares': 'NDQ', 'Fixed rate bonds': '30BB', 'Floating rate bonds': 'QPON',
      'Funds of funds': 'DHHF', 'Geared': 'GEAR', 'Futures and cash': 'BBOZ', 'Hybrids': 'BHYB', 'Options overlay': 'YMAX', 'Currency hedged': 'DRUG' };
    KINDS = D.families.map(function (g) {
      var xs = famOf(g.family);
      var f = BY_TK[prefer[g.family]] != null ? F[BY_TK[prefer[g.family]]] : xs[xs.length - 1];
      return { k: g.family, f: f };
    });
    var host = $('#kindchips');
    host.innerHTML = '';
    KINDS.forEach(function (x, i) {
      var b = document.createElement('button');
      b.className = 'chip'; b.textContent = x.k; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(host.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
        renderFund($('#kindcard'), x.f, { tol: D.tol });
      });
      host.appendChild(b);
    });
    renderFund($('#kindcard'), KINDS[0].f, { tol: D.tol });
    var au = famOf('Australian shares'), auIn = au.filter(function (f) { return Math.abs(f.mine) <= D.tol; }).length;
    $('#v1').innerHTML = '<b>Each kind of fund breaks the check in its own way, and only some of the ways are written in the file.</b> ' +
      'A date that differs and a bond printed without its interest can be corrected from the files themselves, which is why ' + nw(auIn) + ' of the ' + nw(au.length) +
      ' Australian share funds land inside the band. ' +
      'A futures contract, a loan or a sold option moves the NAV without a value in the file, so those funds cannot be checked from it alone.';
  }

  /* ---------- act two: every fund ---------- */
  var logFilter = 'All';
  function shortWhy(f) {
    var bits = [];
    if (Math.abs(f.printed - f.dated) > 5) bits.push('page dated later');
    if (f.accrued_bp) bits.push('bond interest ' + abs1(f.accrued_bp) + ' bp');
    if (f.no_value.some(function (x) { return x.kind === 'futures'; })) bits.push('futures with no value');
    if (f.family === 'International bonds') bits.push('hedges not listed');
    if (f.family === 'International shares') bits.push('shared international gap');
    if (f.family === 'Currency hedged') bits.push('hedge not listed');
    if (f.family === 'Options overlay') bits.push('options not listed');
    if (f.family === 'Geared') bits.push('loan as negative cash');
    if (f.family === 'Hybrids') bits.push('no coupon data');
    return bits.join('; ');
  }
  function renderLog() {
    var tol = state.tol;
    var out = F.filter(function (f) { return Math.abs(f.mine) > tol; }).length;
    $('#loglede').innerHTML = 'Every fund with a holdings file for ' + esc(dLong(fileDate())) + ', <b>' + F.length + ' funds</b>, in the order of the chart. ' +
      'At the tolerance set under the first chart, ' + out + ' still miss after my reading. The last column names what the file shows, and says likely where it cannot prove it.';
    var chips = $('#logchips');
    chips.innerHTML = '';
    ['All'].concat(D.families.map(function (g) { return g.family; })).forEach(function (fam) {
      var n = fam === 'All' ? F.length : famOf(fam).length;
      var b = document.createElement('button');
      b.className = 'chip'; b.textContent = fam + ' (' + n + ')';
      b.setAttribute('aria-pressed', fam === logFilter ? 'true' : 'false');
      b.addEventListener('click', function () { logFilter = fam; renderLog(); });
      chips.appendChild(b);
    });
    var shown = F.filter(function (f) { return logFilter === 'All' || f.family === logFilter; });
    $('#logtable thead').innerHTML = '<tr><th>Fund</th><th class="l">Kind</th><th>As printed, bp</th><th>Dated, bp</th><th>Mine, bp</th><th class="l">What the file shows</th></tr>';
    $('#logtable tbody').innerHTML = shown.map(function (f) {
      return '<tr class="rowsel" data-tk="' + esc(f.tk) + '"><td class="num">' + esc(f.tk) + '</td><td class="l" style="min-width:120px">' + esc(f.family) + '</td>' +
        '<td class="num" style="color:' + C.soft + '">' + sgn(f.printed) + '</td><td class="num" style="color:' + C.look + '">' + sgn(f.dated) + '</td>' +
        '<td class="num" style="color:' + (Math.abs(f.mine) > tol ? C.neg : C.mine) + '">' + sgn(f.mine) + '</td>' +
        '<td class="l" style="min-width:180px;color:#5b6470">' + esc(shortWhy(f)) + '</td></tr>';
    }).join('');
    Array.prototype.forEach.call($('#logtable tbody').querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () {
        Array.prototype.forEach.call($('#logtable tbody').querySelectorAll('tr'), function (t) { t.classList.toggle('on', t === tr); });
        renderFund($('#logdetail'), F[BY_TK[tr.getAttribute('data-tk')]]);
      });
    });
    if (!$('#logdetail').innerHTML && shown.length) {
      $('#logtable tbody tr').classList.add('on');
      renderFund($('#logdetail'), shown[0]);
    }
    var inside = D.families.map(function (g) { return g.family + ' ' + (g.n - famOf(g.family).filter(function (f) { return Math.abs(f.mine) > tol; }).length) + ' of ' + g.n; });
    $('#v2').innerHTML = '<b>Whether a file adds up depends mostly on what kind of fund it describes.</b> Inside the band at this tolerance: ' + esc(inside.join(', ')) + '. ' +
      'The kinds that fail together point at a cause shared across the kind, not at a single bad file.';
  }

  /* ---------- act three: bond interest ---------- */
  function renderBonds() {
    var bonds = famOf('Fixed rate bonds').concat(famOf('Floating rate bonds')).concat(famOf('International bonds')).concat(famOf('Hybrids'));
    var best = famOf('Fixed rate bonds').filter(function (f) { return f.bond; }).sort(function (a, b) { return Math.abs(a.mine) - Math.abs(b.mine); })[0];
    if (best) {
      var b = best.bond;
      $('#bondline').innerHTML = '<p>' + esc(best.name) + ' (' + esc(best.tk) + ') holds ' + esc(nameCase(b.name)) + ': face value ' + money(b.face) + ', coupon ' + b.coupon +
        ' percent a year, maturing ' + esc(dLong(b.maturity)) + '. Paid twice a year and counted back from maturity, its coupons fall on ' + esc(dLong(b.last)) + ' and ' + esc(dLong(b.next)) + '.</p>' +
        '<p>On ' + esc(dLong(best.d)) + ', ' + b.days + ' of the ' + b.period + ' days between those coupons have passed, so the bond has earned ' + money(b.face) + ' × ' + b.coupon +
        '% ÷ 2 × ' + b.days + '/' + b.period + ' = ' + money(b.accrued) + ' of interest. The file values the line at ' + money(b.mv) + ', its clean price, so that ' + money(b.accrued) +
        ' is missing from the file’s sum while the fund owns it and its NAV counts it.</p>' +
        '<p>Done for every fixed rate line in the fund, the missing interest comes to ' + abs1(best.accrued_bp) + ' bp of the fund, and the gap goes from ' + sgn(best.dated) + ' bp to ' + sgn(best.mine) + ' bp.</p>';
    }
    $('#bondtable thead').innerHTML = '<tr><th>Fund</th><th class="l">Kind</th><th>Fixed lines</th><th>Floating lines</th><th>Dated, bp</th><th>Interest added, bp</th><th>Mine, bp</th></tr>';
    $('#bondtable tbody').innerHTML = bonds.map(function (f) {
      return '<tr><td class="num">' + esc(f.tk) + '</td><td class="l">' + esc(f.family) + '</td><td class="num">' + f.fixed + '</td><td class="num">' + f.floating + '</td><td class="num">' + sgn(f.dated) +
        '</td><td class="num">' + (f.accrued_bp ? '+' + f.accrued_bp.toFixed(1) : '0.0') + '</td><td class="num" style="color:' + (Math.abs(f.mine) > D.tol ? C.neg : C.mine) + '">' + sgn(f.mine) + '</td></tr>';
    }).join('');
    var fixed = famOf('Fixed rate bonds');
    var near = fixed.filter(function (f) { return Math.abs(f.mine) <= 10; }).length;
    $('#v3').innerHTML = '<b>The interest correction moves the typical fixed rate bond fund from ' + S.bond_dated_median.toFixed(0) + ' bp off to ' + S.bond_mine_median.toFixed(0) + ' bp off.</b> ' +
      Nw(near) + ' of the ' + nw(fixed.length) + ' fixed rate funds ' + (near === 1 ? 'lands' : 'land') + ' within 10 bp with it. The rest keep 10 to 40 bp that move from day to day, which the coupon rule cannot account for and the file does not explain.';
  }

  /* ---------- act four: where it loses ---------- */
  function renderFail() {
    var ib = S.intl_by_date || [];
    $('#f-intl').innerHTML = '<b>The international funds share a gap that moves.</b> ' + ib.map(function (x, i) {
      return (i ? 'on ' : 'On ') + dLong(x.d) + ' the unhedged international share funds sat at a median of ' + sgn(x.median) + ' bp, ' + x.same_side + ' of ' + x.n + ' on the same side';
    }).join('; ') + '. A gap shared by assets with nothing in common but their conversion into Australian dollars, and that changes sign from one day to the next, points at the exchange rate, ' +
      'struck at a different moment for the file than for the NAV. That is the likely cause, and this page does not test it: the files carry no local prices, and the central bank\u2019s daily rates refuse automated download.';
    var nv = F.filter(function (f) { return ['Futures and cash', 'Geared', 'Options overlay', 'International bonds', 'Currency hedged'].indexOf(f.family) >= 0; });
    $('#f-novalue').innerHTML = '<b>Some funds move through lines without a value.</b> The currency hedged funds, the futures funds, the geared funds and the options overlay fund carry much of their daily change in hedges, futures or options the file prints without a value or does not list. ' +
      (function () { var k = nv.filter(function (f) { return Math.abs(f.mine) > D.tol; }).length; return (k === nv.length ? 'All ' + k + ' of these funds miss' : k + ' of these ' + nv.length + ' funds miss'); })() +
      ' by more than ' + D.tol + ' bp, and their files cannot be checked against the NAV on their own.';
    var wo = S.skipped.filter(function (x) { return /weights/.test(x.why); });
    $('#f-gap').innerHTML = '<b>Some files cannot be added up at all.</b> ' + Nw(wo.length) + ' funds publish weights only, with no quantities or values (' +
      wo.map(function (x) { return x.tk; }).join(', ') + '), and ' + nw(S.skipped.length - wo.length) + ' more had no usable NAV history for the day (' +
      S.skipped.filter(function (x) { return !/weights/.test(x.why); }).map(function (x) { return x.tk; }).join(', ') + '). They are left out of every count above.';
    $('#f-oneday').innerHTML = '<b>There is no daily history yet.</b> The issuer serves only the latest holdings file for each fund, and the Internet Archive holds the largest fund\u2019s file on fewer than twenty days in seven years, never two days running. ' +
      'This page uses the files of ' + (S.intl_by_date || []).map(function (x) { return dLong(x.d); }).join(' and ') + ', collected on two visits, which are not consecutive trading days. ' +
      'So units created on the day cannot be told apart from a gap in the file, and yesterday\u2019s basket cannot yet be repriced at today\u2019s values. The collector in the repository saves each day\u2019s files; run daily, it builds that history.';
    var same = F.filter(function (f) { return f.units_as_at === f.d; }).length, later = F.filter(function (f) { return f.units_as_at && f.units_as_at > f.d; }).length;
    $('#f-dates').innerHTML = '<b>Dates differ from fund to fund.</b> On this day ' + same + ' fund pages give units on issue as at the file’s own date and ' + later +
      ' give the next trading day. Where they differ, units created in between show up as a gap. A run of consecutive days would show which convention each fund follows.';
    $('#v4').innerHTML = '<b>Two days of files prove what dates and bond interest explain, and no more.</b> The international gap and the funds with unvalued lines need either a daily history of files or data the files do not carry. ' +
      'The collector is the cheaper of those two to get.';
  }

  /* ---------- coda ---------- */
  function selfCheck() {
    var tol = D.tol, maxd = 0, c = { printed: 0, dated: 0, mine: 0 };
    F.forEach(function (f) {
      var na = f.nav * f.units;
      var p = f.net_assets ? (f.mv / f.net_assets - 1) * 1e4 : null, d = (f.mv / na - 1) * 1e4, m = ((f.mv + f.accrued) / na - 1) * 1e4;
      maxd = Math.max(maxd, p == null ? 0 : Math.abs(p - f.printed), Math.abs(d - f.dated), Math.abs(m - f.mine));
      if (p != null && Math.abs(+p.toFixed(2)) > tol) c.printed++;
      if (Math.abs(+d.toFixed(2)) > tol) c.dated++;
      if (Math.abs(+m.toFixed(2)) > tol) c.mine++;
    });
    var ok = c.printed === S.printed_out && c.dated === S.dated_out && c.mine === S.mine_out && maxd < 0.01;
    $('#selfcheck').innerHTML = (ok ? '<b class="pos">Matched.</b> ' : '<b class="neg">Mismatch.</b> ') +
      'Recomputed here from each fund’s sums: ' + c.printed + ', ' + c.dated + ' and ' + c.mine + ' funds outside ' + tol + ' bp as printed, dated and mine; the build script wrote ' +
      S.printed_out + ', ' + S.dated_out + ' and ' + S.mine_out + '. The largest difference on any fund is ' + maxd.toFixed(4) + ' bp, which is rounding.' +
      (ok ? '' : ' Until that is fixed, the counts above cannot be trusted.');
  }
  function choices() {
    var au = famOf('Australian shares').map(function (f) { return Math.abs(f.dated); }).sort(function (a, b) { return a - b; });
    var rows = [
      ['Tolerance', D.tol + ' bp', 'The Australian share funds, dated properly, land within a median of ' + au[Math.floor(au.length / 2)].toFixed(1) + ' bp; fees owed and income due sit outside the file and account for a few basis points. Change it with the buttons under the first chart.'],
      ['Coupon schedule', 'two a year, counted back from maturity', 'The usual schedule for Australian dollar bonds. A bond on another schedule leaves a residual, which the bond table shows.'],
      ['Floating rate lines', 'left as printed', 'Their printed values already sit close to the NAV, so they appear to include the interest earned.'],
      ['Fund kind', 'from the file’s lines and the fund’s name', 'Bond layout or share layout, futures without shares, more than half the value in other BetaShares funds, and the words geared, yield maximiser or covered call.'],
      ['Floor', 'median one day NAV move, ' + S.floor_median.toFixed(0) + ' bp', 'What a check pinned one trading day early misses on a typical fund.']
    ];
    $('#choicebody').innerHTML = rows.map(function (r) {
      return '<tr><td class="l" style="white-space:nowrap">' + esc(r[0]) + '</td><td class="num" style="white-space:normal;min-width:110px">' + esc(r[1]) + '</td><td class="l" style="color:#5b6470;min-width:220px">' + esc(r[2]) + '</td></tr>';
    }).join('');
    $('#srcdates').textContent = 'Holdings files dated ' + S.dates.map(dLong).join(' and ') + ', for ' + S.n + ' funds' +
      (S.skipped.length ? '; ' + S.skipped.length + ' more funds have a file but no units on their page and are left out (' + S.skipped.map(function (x) { return x.tk; }).join(', ') + ')' : '') + '.';
  }

  /* ---------- the walkthrough ---------- */
  function tour() {
    var root = $('#tour'), hl = $('.tour-hl', root), card = $('.tour-card', root), idx = 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STEPS = [
      { sel: 'header h1', k: 'Welcome \u00b7 1 of 8', html: 'This page asks one question of every BetaShares fund: <b>does its holdings file add up to its NAV?</b> Every number comes from one day of the issuer\u2019s public files.' },
      { sel: '#bluecard', k: 'The answer \u00b7 2 of 8', html: 'The whole result in one chart. Each strip is a way of checking and each mark is one fund, grouped by kind. <b>Click any fund</b> to read what its file shows, or <b>change the tolerance</b> just under the chart.' },
      { sel: '#domain', k: 'The shape of it \u00b7 3 of 8', html: 'What happens to one fund\u2019s file: its sum, the NAV for its own date, each line read on its own basis, and only then the published value.' },
      { sel: '#quotes', k: 'Their words \u00b7 4 of 8', html: 'The advertisement\u2019s own description of the job. The page does the second line, on public files.' },
      { sel: '#kindcard', k: 'One of each \u00b7 5 of 8', html: 'One real fund of each kind. <b>Click the buttons</b> above this box to move between them.' },
      { sel: '#logcard', k: 'Every fund \u00b7 6 of 8', html: 'Every fund in one list. <b>Click a kind</b> above the table to filter, or <b>click a row</b> to open the fund.' },
      { sel: '#bondcard', k: 'Bond interest \u00b7 7 of 8', html: 'One bond line worked through by hand: the interest the file leaves out, from the file\u2019s own columns.' },
      { sel: '#failpane', k: 'Where it loses \u00b7 8 of 8', html: 'What one day of files cannot settle, stated before you find it.' }
    ];
    function place() {
      var st = STEPS[idx], elm = document.querySelector(st.sel);
      if (!elm) { next(); return; }
      var r = elm.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
      var docTop = r.top + sy, docLeft = r.left + sx;
      root.style.height = document.documentElement.scrollHeight + 'px';
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      var target = Math.max(0, Math.min(docTop - 14, maxScroll)), vTop = docTop - target;
      var cw = Math.min(400, innerWidth - 32), ch = 250;
      var fitsRight = r.left + r.width + 18 + cw <= innerWidth - 16;
      var hh = fitsRight ? r.height : Math.max(120, Math.min(r.height, innerHeight - vTop - ch - 40));
      hl.style.left = (docLeft - 8) + 'px'; hl.style.top = (docTop - 8) + 'px';
      hl.style.width = (r.width + 16) + 'px'; hl.style.height = (hh + 16) + 'px';
      var dots = STEPS.map(function (_, i) { return '<i class="' + (i === idx ? 'on' : '') + '"></i>'; }).join('');
      card.innerHTML = '<div class="tk">' + st.k + '</div><p>' + st.html + '</p><div class="tour-nav"><div class="dots">' + dots + '</div>' +
        (idx > 0 ? '<button class="tour-btn" id="tprev">Back</button>' : '') +
        '<button class="tour-btn" id="tskip">Close</button><button class="tour-btn primary" id="tnext">' + (idx < STEPS.length - 1 ? 'Next' : 'Done') + '</button></div>';
      var cx, cy;
      if (fitsRight) { cx = docLeft + r.width + 18; cy = docTop; } else { cx = Math.min(docLeft, sx + innerWidth - 16 - cw); cy = docTop + hh + 22; }
      card.style.left = Math.max(sx + 16, cx) + 'px';
      card.style.top = Math.max(target + 16, cy) + 'px';
      $('#tnext').onclick = next; $('#tskip').onclick = stop;
      var pv = $('#tprev'); if (pv) pv.onclick = function () { idx = Math.max(0, idx - 1); place(); };
      window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    }
    function next() { if (idx >= STEPS.length - 1) { stop(); return; } idx++; place(); }
    function stop() { root.classList.remove('on'); try { localStorage.setItem('bc-tour', 'seen'); } catch (e) { } }
    function start() { idx = 0; root.classList.add('on'); place(); }
    $('#tourbtn').addEventListener('click', start);
    var replace = function () { if (root.classList.contains('on')) place(); };
    window.addEventListener('resize', replace);
    window.addEventListener('load', replace);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    var seen = false;
    try { seen = localStorage.getItem('bc-tour') === 'seen'; } catch (e) { }
    if (!location.search.includes('tour=off') && (!seen || location.search.includes('tour=on'))) setTimeout(start, 700);
  }

  /* ---------- go ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof D === 'undefined') return;
    fillHeader();
    tolChips();
    // The first chart opens on a bond fund, where the correction is easiest to see.
    state.sel = BY_TK['30BB'] != null ? BY_TK['30BB'] : 0;
    renderBluf();
    renderFund($('#fundcard'), F[state.sel]);
    drawDomain();
    buildKinds();
    renderLog();
    renderBonds();
    renderFail();
    selfCheck();
    choices();
    var lastW = window.innerWidth, timer = null;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 8) return;
      lastW = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(function () { renderBluf(); drawDomain(); }, 120);
    });
    tour();
  });
})();
