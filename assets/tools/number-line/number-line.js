// AIJJ number line generator. Runs entirely in the browser:
// no network requests, no cookies, no analytics. Builds an SVG preview
// and a vector PDF (US Letter or A4, printed at actual size).
(function () {
  'use strict';

  // Helvetica glyph widths (1/1000 em), ASCII 32-126.
  var HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  var MINUS = '–'; // en dash: prints like a minus sign in Helvetica

  function charW(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) return HW[c - 32];
    if (ch === MINUS) return 556;
    return 556;
  }
  function textW(str, size) {
    var s = 0;
    for (var i = 0; i < str.length; i++) s += charW(str[i]);
    return s * size / 1000;
  }

  var PAPER = { letter: [612, 792], a4: [595.28, 841.89] };
  var MAX_INTERVALS = 50;

  // ---------- config ----------
  var DEFAULTS = {
    type: 'num', start: -10, end: 10, step: 1, minor: 0,
    den: 4, fstyle: 'frac', simplify: 1, wholes: 1,
    labels: 'all', lines: 4, paper: 'letter', orient: 'land',
    arrows: 1, cut: 0, name: 0, title: ''
  };
  var KEYS = Object.keys(DEFAULTS);

  function decimalsOf(s) {
    s = String(s);
    var i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function fmtNum(v, dec) {
    var s = v.toFixed(dec);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.charAt(0) === '-' ? MINUS + s.slice(1) : s;
  }

  // Returns { error } or { n, minor, labels: [label|null per major tick] }
  // label: { t:'n', s } | { t:'f', sign, whole, num, den }
  function buildTicks(c) {
    var labels = [], n, i;
    if (c.type === 'frac') {
      var a = Math.round(+c.start), b = Math.round(+c.end), d = Math.round(+c.den);
      if (!isFinite(a) || !isFinite(b)) return { error: 'Enter whole numbers for start and end.' };
      if (b <= a) return { error: 'End must be greater than start.' };
      if (d < 2 || d > 12) return { error: 'Choose a denominator from 2 to 12.' };
      n = (b - a) * d;
      if (n > MAX_INTERVALS) return { error: 'Too many parts for one line (' + n + '). Use a shorter range or a smaller denominator; up to ' + MAX_INTERVALS + ' parts fit.' };
      for (i = 0; i <= n; i++) {
        var N = a * d + i, sign = N < 0 ? -1 : 1, AN = Math.abs(N);
        if (AN % d === 0 && +c.wholes) { labels.push({ t: 'n', s: fmtNum(N / d, 0) }); continue; }
        if (N === 0) { labels.push({ t: 'n', s: '0' }); continue; }
        var whole = 0, num = AN, den = d;
        if (c.fstyle === 'mixed') { whole = Math.floor(AN / d); num = AN % d; }
        if (num === 0) { labels.push({ t: 'n', s: fmtNum(sign * whole, 0) }); continue; }
        if (+c.simplify) { var g = gcd(num, den); num /= g; den /= g; }
        if (den === 1) { labels.push({ t: 'n', s: fmtNum(sign * (whole + num), 0) }); continue; }
        labels.push({ t: 'f', sign: sign, whole: whole, num: num, den: den });
      }
      return { n: n, minor: 0, labels: labels };
    }
    var dec = Math.min(3, Math.max(decimalsOf(c.start), decimalsOf(c.end), decimalsOf(c.step)));
    var sc = Math.pow(10, dec);
    var S = Math.round(+c.start * sc), E = Math.round(+c.end * sc), T = Math.round(+c.step * sc);
    if (!isFinite(S) || !isFinite(E) || !isFinite(T) || String(c.start) === '' || String(c.end) === '') return { error: 'Enter a start and an end number.' };
    if (T <= 0) return { error: 'The step must be greater than 0.' };
    if (E <= S) return { error: 'End must be greater than start.' };
    if ((E - S) % T !== 0) return { error: 'Counting from ' + fmtNum(S / sc, dec).replace(MINUS, '-') + ' in steps of ' + fmtNum(T / sc, dec) + ' does not land exactly on ' + fmtNum(E / sc, dec).replace(MINUS, '-') + '. Change the end or the step.' };
    n = (E - S) / T;
    if (n > MAX_INTERVALS) return { error: 'Too many numbered ticks (' + (n + 1) + '). Use a bigger step, for example 0 to 100 in steps of 10 with 9 small ticks in between.' };
    var minor = Math.max(0, Math.min(9, Math.round(+c.minor) || 0));
    if (n * (minor + 1) > 200) minor = Math.floor(200 / n) - 1;
    for (i = 0; i <= n; i++) labels.push({ t: 'n', s: fmtNum((S + i * T) / sc, dec) });
    return { n: n, minor: minor, labels: labels };
  }

  // label width in em units at font size 1 (fractions are stacked at 0.8 size)
  function labelUnits(l) {
    if (!l) return 0;
    if (l.t === 'n') return textW(l.s, 1);
    var fw = Math.max(textW(String(l.num), 0.8), textW(String(l.den), 0.8)) + 0.12;
    var pre = (l.sign < 0 ? MINUS : '') + (l.whole ? String(l.whole) : '');
    return fw + (pre ? textW(pre, 1) + 0.08 : 0);
  }

  // ---------- layout into drawing primitives ----------
  function layout(c) {
    var t = buildTicks(c);
    if (t.error) return t;
    var P = PAPER[c.paper] || PAPER.letter;
    var W = c.orient === 'port' ? P[0] : P[1], H = c.orient === 'port' ? P[1] : P[0];
    var M = 36, prims = [], note = '';
    var lines = Math.max(1, Math.min(10, Math.round(+c.lines) || 1));
    var hasFrac = t.labels.some(function (l) { return l && l.t === 'f'; });

    var title = String(c.title || '').slice(0, 60);
    var headerH = (title || +c.name) ? 34 : 0;
    var footerH = 16;
    if (title) prims.push({ k: 't', x: M, y: M + 14, s: title, size: 14, bold: 1, a: 'l' });
    if (+c.name) {
      var nx = W - M, nameStr = 'Name ______________________   Date ____________';
      prims.push({ k: 't', x: nx, y: M + 14, s: nameStr, size: 10, a: 'r', col: 0.25 });
    }
    prims.push({ k: 't', x: W / 2, y: H - M / 2 - 2, s: 'Free number line generator: aijj.net/tools/number-line', size: 7, a: 'c', col: 0.6 });

    var arrowLen = +c.arrows ? 16 : 0;
    var x0 = M + arrowLen + 10, x1 = W - M - arrowLen - 10;
    var sp = (x1 - x0) / t.n;

    // font size and label thinning
    var maxU = 0;
    t.labels.forEach(function (l) { maxU = Math.max(maxU, labelUnits(l)); });
    var fs = maxU ? Math.min(hasFrac ? 15 : 13, (sp * 0.82) / maxU) : 12;
    var every = 1;
    if (fs < 7.5) { fs = 7.5; every = Math.ceil((maxU * fs) / (sp * 0.82)); }
    if (c.labels === 'alt') every = Math.max(every, 2);
    if (every > 1 && c.labels === 'all') note = 'Labels were thinned to every ' + every + ' ticks so they fit. Use fewer ticks or landscape paper for more labels.';

    var labelH = hasFrac ? fs * 2.3 : fs * 1.1;
    var majorT = 8, minorT = 4.5, gap = 4;
    var groupH = majorT + majorT + gap + labelH;
    var top = M + headerH, bottom = H - M - footerH;
    var rowH = (bottom - top) / lines;
    if (rowH < groupH + 10) return { error: 'Too many number lines for this page. Choose fewer lines per page or a different orientation.' };

    for (var r = 0; r < lines; r++) {
      var rowTop = top + r * rowH;
      var cy = rowTop + (rowH - groupH) / 2 + majorT;
      if (+c.cut && r > 0) prims.push({ k: 'l', x1: M / 2, y1: rowTop, x2: W - M / 2, y2: rowTop, w: 0.6, col: 0.6, dash: 1 });
      // axis
      prims.push({ k: 'l', x1: x0 - arrowLen, y1: cy, x2: x1 + arrowLen, y2: cy, w: 1.3 });
      if (arrowLen) {
        var ax = x0 - arrowLen - 9, bx = x1 + arrowLen + 9;
        prims.push({ k: 'p', pts: [[ax, cy], [ax + 11, cy - 4.5], [ax + 11, cy + 4.5]] });
        prims.push({ k: 'p', pts: [[bx, cy], [bx - 11, cy - 4.5], [bx - 11, cy + 4.5]] });
      }
      for (var i = 0; i <= t.n; i++) {
        var x = x0 + i * sp;
        prims.push({ k: 'l', x1: x, y1: cy - majorT, x2: x, y2: cy + majorT, w: 1.1 });
        if (i < t.n) for (var m = 1; m <= t.minor; m++) {
          var mx = x + (sp * m) / (t.minor + 1);
          prims.push({ k: 'l', x1: mx, y1: cy - minorT, x2: mx, y2: cy + minorT, w: 0.6 });
        }
        var show;
        if (c.labels === 'none') show = false;
        else if (c.labels === 'ends') show = (i === 0 || i === t.n);
        else show = (i % every === 0);
        if (!show) continue;
        var l = t.labels[i], ly = cy + majorT + gap;
        if (l.t === 'n') {
          // in fraction lines, whole numbers sit level with the fraction bars
          prims.push({ k: 't', x: x, y: hasFrac ? ly + fs * 1.48 : ly + fs * 0.85, s: l.s, size: fs, a: 'c' });
        } else {
          var fsz = fs * 0.8;
          var pre = (l.sign < 0 ? MINUS : '') + (l.whole ? String(l.whole) : '');
          var fw = Math.max(textW(String(l.num), fsz), textW(String(l.den), fsz)) + fs * 0.12;
          var total = fw + (pre ? textW(pre, fs) + fs * 0.08 : 0);
          var left = x - total / 2;
          var barY = ly + fs * 1.12;
          if (pre) {
            prims.push({ k: 't', x: left, y: barY + fs * 0.36, s: pre, size: fs, a: 'l' });
            left += textW(pre, fs) + fs * 0.08;
          }
          var fc = left + fw / 2;
          prims.push({ k: 't', x: fc, y: barY - fs * 0.16, s: String(l.num), size: fsz, a: 'c' });
          prims.push({ k: 'l', x1: left, y1: barY, x2: left + fw, y2: barY, w: 0.7 });
          prims.push({ k: 't', x: fc, y: barY + fsz * 0.86, s: String(l.den), size: fsz, a: 'c' });
        }
      }
    }
    return { W: W, H: H, prims: prims, note: note, n: t.n };
  }

  // ---------- SVG ----------
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function gray(c) { var v = Math.round((c || 0) * 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; }
  function toSVG(L) {
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + L.W.toFixed(2) + ' ' + L.H.toFixed(2) + '" role="img" aria-label="Preview of the printable number line page">',
      '<rect width="100%" height="100%" fill="#fff"/>'];
    L.prims.forEach(function (p) {
      if (p.k === 'l') o.push('<line x1="' + p.x1.toFixed(2) + '" y1="' + p.y1.toFixed(2) + '" x2="' + p.x2.toFixed(2) + '" y2="' + p.y2.toFixed(2) + '" stroke="' + gray(p.col) + '" stroke-width="' + p.w + '"' + (p.dash ? ' stroke-dasharray="4 3"' : '') + '/>');
      else if (p.k === 'p') o.push('<polygon points="' + p.pts.map(function (q) { return q[0].toFixed(2) + ',' + q[1].toFixed(2); }).join(' ') + '" fill="#000"/>');
      else {
        var anchor = p.a === 'c' ? 'middle' : p.a === 'r' ? 'end' : 'start';
        o.push('<text x="' + p.x.toFixed(2) + '" y="' + p.y.toFixed(2) + '" font-family="Helvetica, Arial, sans-serif" font-size="' + p.size.toFixed(2) + '"' + (p.bold ? ' font-weight="bold"' : '') + ' fill="' + gray(p.col) + '" text-anchor="' + anchor + '">' + esc(p.s) + '</text>');
      }
    });
    o.push('</svg>');
    return o.join('');
  }

  // ---------- PDF ----------
  function pdfStr(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], c = ch.charCodeAt(0);
      if (ch === MINUS) out += '\\226';
      else if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
      else if (c >= 32 && c <= 126) out += ch;
      else if (c >= 160 && c <= 255) out += '\\' + c.toString(8);
      else out += '?';
    }
    return out;
  }
  function f(v) { return (Math.round(v * 100) / 100).toString(); }
  function toPDF(L) {
    var H = L.H, s = [];
    L.prims.forEach(function (p) {
      var g = f(p.col || 0);
      if (p.k === 'l') {
        s.push(f(p.w) + ' w ' + g + ' ' + g + ' ' + g + ' RG ' + (p.dash ? '[4 3] 0 d ' : '[] 0 d ') +
          f(p.x1) + ' ' + f(H - p.y1) + ' m ' + f(p.x2) + ' ' + f(H - p.y2) + ' l S');
      } else if (p.k === 'p') {
        s.push('0 0 0 rg ' + p.pts.map(function (q, i) { return f(q[0]) + ' ' + f(H - q[1]) + (i ? ' l' : ' m'); }).join(' ') + ' h f');
      } else {
        var w = textW(p.s, p.size) * (p.bold ? 1.06 : 1);
        var x = p.a === 'c' ? p.x - w / 2 : p.a === 'r' ? p.x - w : p.x;
        s.push('BT /' + (p.bold ? 'F2' : 'F1') + ' ' + f(p.size) + ' Tf ' + g + ' ' + g + ' ' + g + ' rg ' + f(x) + ' ' + f(H - p.y) + ' Td (' + pdfStr(p.s) + ') Tj ET');
      }
    });
    var content = s.join('\n');
    var objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(L.W) + ' ' + f(L.H) + '] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
      '<< /Producer (aijj.net number line generator) /Title (Number lines) >>'
    ];
    var out = '%PDF-1.4\n%âãÏÓ\n', offs = [];
    objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 7 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }

  // ---------- UI ----------
  var app = document.getElementById('nl-app');
  if (!app) { window.AIJJNumberLine = { layout: layout, toSVG: toSVG, toPDF: toPDF }; return; }
  var form = app.querySelector('form');
  var preview = app.querySelector('.nl-preview');
  var msg = app.querySelector('.nl-msg');
  var preset = {};
  try { preset = JSON.parse(app.getAttribute('data-preset') || '{}'); } catch (e) { preset = {}; }

  function readURL() {
    var q = {}, sp;
    try { sp = new URLSearchParams(location.search); } catch (e) { return q; }
    KEYS.forEach(function (k) { if (sp.has(k)) q[k] = sp.get(k); });
    return q;
  }
  function setForm(c) {
    KEYS.forEach(function (k) {
      var els = form.querySelectorAll('[name="' + k + '"]');
      if (!els.length) return;
      if (els[0].type === 'radio') els.forEach(function (el) { el.checked = String(el.value) === String(c[k]); });
      else if (els[0].type === 'checkbox') els[0].checked = !!+c[k];
      else els[0].value = c[k];
    });
  }
  function getForm() {
    var c = {};
    KEYS.forEach(function (k) {
      var els = form.querySelectorAll('[name="' + k + '"]');
      if (!els.length) { c[k] = DEFAULTS[k]; return; }
      if (els[0].type === 'radio') { var on = form.querySelector('[name="' + k + '"]:checked'); c[k] = on ? on.value : DEFAULTS[k]; }
      else if (els[0].type === 'checkbox') c[k] = els[0].checked ? 1 : 0;
      else c[k] = els[0].value.trim();
    });
    return c;
  }
  function syncType(c) {
    app.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.getAttribute('data-for') !== c.type; });
  }
  function shareURL(c) {
    var p = [];
    KEYS.forEach(function (k) { if (String(c[k]) !== String(DEFAULTS[k])) p.push(k + '=' + encodeURIComponent(c[k])); });
    return location.origin + location.pathname + (p.length ? '?' + p.join('&') : '');
  }

  var current = null, timer = null;
  function render() {
    var c = getForm();
    syncType(c);
    var L = layout(c);
    if (L.error) {
      current = null;
      msg.textContent = L.error; msg.className = 'nl-msg is-error';
      preview.classList.add('is-stale');
      return;
    }
    current = { L: L, c: c };
    preview.classList.remove('is-stale');
    preview.innerHTML = toSVG(L);
    preview.style.aspectRatio = L.W + ' / ' + L.H;
    msg.textContent = L.note || ''; msg.className = 'nl-msg';
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 120); }

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  app.querySelector('.nl-download').addEventListener('click', function () {
    render();
    if (!current) return;
    var c = current.c;
    var name = c.type === 'frac'
      ? 'fraction-number-lines-' + c.start + '-to-' + c.end + '-denominator-' + c.den
      : 'number-lines-' + c.start + '-to-' + c.end;
    name = name.replace(/-to--/, '-to-minus').replace(/-lines--/, '-lines-minus').replace(/[^0-9a-z.-]+/gi, '_') + '.pdf';
    var blob = new Blob([toPDF(current.L)], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    msg.textContent = 'PDF downloaded. Print at Actual size (100%), not "Fit to page".'; msg.className = 'nl-msg is-ok';
  });

  var copyBtn = app.querySelector('.nl-copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var u = shareURL(getForm());
    var done = function () { msg.textContent = 'Link copied. It opens this page with the same settings.'; msg.className = 'nl-msg is-ok'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { window.prompt('Copy this link:', u); });
    else window.prompt('Copy this link:', u);
  });

  var c0 = {};
  KEYS.forEach(function (k) { c0[k] = DEFAULTS[k]; });
  Object.keys(preset).forEach(function (k) { c0[k] = preset[k]; });
  var q = readURL();
  Object.keys(q).forEach(function (k) { c0[k] = q[k]; });
  setForm(c0);
  render();
})();
