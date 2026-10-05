/* Games page: physics games (the trap zoo animation lives in static/js/trap-zoo.js).
   Data: static/data/nubase2020.json (NUBASE2020). Labels: data-labels JSON on [data-games]. */
(() => {
  const root = document.querySelector("[data-games]");
  if (!root) return;
  const T = JSON.parse(root.dataset.labels), $ = s => root.querySelector(s);
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", sup = n => String(n).replace(/\d/g, d => SUP[d]);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const best = (k, v) => { try { const o = +localStorage.getItem("zg-game-" + k) || 0; if (v > o) localStorage.setItem("zg-game-" + k, v); return Math.max(o, v); } catch (e) { return v; } };
  let rows = [];

  /* ── 1. Half-life: higher or lower ─────────────────────────────────── */
  function hlGame() {
    const box = $("#g-hl"); let a, b, score = 0;
    const pool = () => rows.filter(r => r[6] > -9 && r[6] < 20 && r[6] !== 99);
    const card = r => `<div class="g-nuc"><b>${sup(r[0] + r[1])}${r[2]}</b><small>Z ${r[0]} · N ${r[1]}</small></div>`;
    function round() {
      const p = pool(); a = a || rnd(p); do { b = rnd(p); } while (b === a || Math.abs(b[6] - a[6]) < 0.15);
      box.querySelector(".g-pair").innerHTML = card(a) + `<span class="g-vs">${T.hl_q}</span>` + card(b);
      box.querySelector(".g-msg").textContent = `${T.score}: ${score} · ${T.best}: ${best("hl", score)}`;
    }
    box.addEventListener("click", e => {
      const pick = e.target.closest("[data-pick]")?.dataset.pick; if (!pick) return;
      const longer = b[6] > a[6] ? "b" : "a", ok = pick === longer;
      score = ok ? score + 1 : 0;
      box.querySelector(".g-msg").textContent = `${ok ? "✔ " + T.right : "✘ " + T.wrong} ${sup(a[0] + a[1])}${a[2]}: ${a[7]} · ${sup(b[0] + b[1])}${b[2]}: ${b[7]} — ${T.score}: ${score} · ${T.best}: ${best("hl", score)}`;
      a = b; setTimeout(round, 1400);
    });
    round();
  }

  /* ── shared plotting helpers: crisp HiDPI canvases, axes with ticks, exports ── */
  const K = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  function crisp(cv) {
    if (!cv._W) { cv._W = +cv.getAttribute("width"); cv._H = +cv.getAttribute("height"); cv.width = cv._W * K; cv.height = cv._H * K; }
    const g = cv.getContext("2d"); g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, cv._W, cv._H); return [g, cv._W, cv._H];
  }
  /* render paint(g, W, H, ink) at 4× on white for a publication-quality PNG */
  function savePNG(cv, paint, name) {
    if (!window.zgExport) return;
    window.zgExport.png(sc => { const c = document.createElement("canvas"); c.width = cv._W * sc; c.height = cv._H * sc;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.scale(sc, sc); paint(g, cv._W, cv._H, "#1d2433", true); return c; }, name, 4);
  }
  const inkOf = () => getComputedStyle(root).color || "#888";
  const fmtN = v => Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(1) : String(+v.toPrecision(6));
  function ticks(a, b, n = 6) {
    const span = b - a, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9 * span; v += step) out.push(+v.toFixed(12));
    return out;
  }
  /* frame with grid, ticks and labels; returns data→pixel maps */
  function axes(g, P, xr, yr, xl, yl, ink, ny = 5) {
    const X = v => P.l + (v - xr[0]) / (xr[1] - xr[0]) * (P.r - P.l), Y = v => P.b - (v - yr[0]) / (yr[1] - yr[0]) * (P.b - P.t);
    g.save(); g.lineWidth = 1; g.font = "11px system-ui,sans-serif"; g.fillStyle = ink;
    g.strokeStyle = "rgba(127,127,160,.18)"; g.textAlign = "center"; g.textBaseline = "top";
    ticks(xr[0], xr[1]).forEach(v => { const x = X(v); g.beginPath(); g.moveTo(x, P.t); g.lineTo(x, P.b); g.stroke(); g.fillText(fmtN(v), x, P.b + 4); });
    g.textAlign = "right"; g.textBaseline = "middle";
    ticks(yr[0], yr[1], ny).forEach(v => { const y = Y(v); g.beginPath(); g.moveTo(P.l, y); g.lineTo(P.r, y); g.stroke(); g.fillText(fmtN(v), P.l - 5, y); });
    g.strokeStyle = "rgba(127,127,160,.75)"; g.strokeRect(P.l, P.t, P.r - P.l, P.b - P.t);
    g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText(xl, (P.l + P.r) / 2, P.b + 32);
    g.translate(13, (P.t + P.b) / 2); g.rotate(-Math.PI / 2); g.fillText(yl, 0, 0);
    g.restore();
    return [X, Y];
  }
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const poisson = l => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= Math.random(); } while (p > L); return k - 1; };
  const viridis = t => { t = Math.max(0, Math.min(1, t)); const c = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
    const i = Math.min(3, Math.floor(t * 4)), f = t * 4 - i, a = c[i], b = c[i + 1]; return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",")})`; };
  const msg = (box, html) => (box.querySelector(".g-msg").innerHTML = html);

  /* ── 2. TOF-ICR resonance hunt ─────────────────────────────────────────
     ¹³³Cs⁺ in B = 7 T: ν_c = qB/(2πm) = 808 795.0 Hz (reference). The true ν_c is hidden near it.
     Quadrupole excitation converts magnetron → reduced-cyclotron motion; the conversion profile F(δ)
     (rectangular or Ramsey two-pulse, as in König et al. 1995 / Kretzschmar 2007, same formulas as the
     owner's toficr.py). Radial energy E_r ∝ F is turned into axial energy in the B-field gradient, so the
     time of flight to the MCP is SHORTEST at resonance: the resonance is a TOF minimum (dip).          */
  function tofGame() {
    const TL = T;
    const box = $("#g-tof"), cv = box.querySelector("canvas"), sl = box.querySelector("input[type=range]");
    const sel = n => box.querySelector(`[name=${n}]`);
    const NU_REF = 808795.0115, M_CS = 132.905451933, U = 1.66053906660e-27, ME = 9.1093837e-31, QE = 1.602176634e-19, B = 7.0;
    let nuTrue, Trf, scheme, Wd, ions = [], shots = 0, fit = null, reveal = false, step;
    const tofOf = F => 62 + 193 / Math.sqrt(1 + 1.876 * F);          /* µs: 255 µs off resonance, ≈ 175 µs at full conversion */
    function conv(dnu) {
      const d = 2 * Math.PI * dnu;
      if (scheme === "rect") { const g0 = Math.PI / (2 * Trf), wB = Math.hypot(2 * g0, d); return (2 * g0 / wB) ** 2 * Math.sin(wB * Trf / 2) ** 2; }
      const tau = 0.1 * Trf, tw = Trf - 2 * tau, g0 = Math.PI / (4 * tau), wR = Math.hypot(2 * g0, d);
      return (2 * g0 / wR * Math.sin(wR * tau / 2)) ** 2 * (2 * Math.cos(d * tw / 2) * Math.cos(wR * tau / 2) - 2 * d / wR * Math.sin(d * tw / 2) * Math.sin(wR * tau / 2)) ** 2;
    }
    const U6 = [0.835, 0.865, 0.895, 0.925, 0.955, 0.985];
    const expect = dnu => { const F = conv(dnu); return 0.92 * U6.reduce((s, u) => s + tofOf(F * u), 0) / 6 + 0.08 * tofOf(0); };
    function fwhm() { /* numerical FWHM of the central conversion peak */
      let h = 0; while (h < Wd && conv(h) > 0.5) h += Wd / 4000; return 2 * h;
    }
    function shoot(dnu) {
      const n = poisson(+sel("ions").value), F = conv(dnu - (nuTrue - NU_REF)); shots++;
      for (let i = 0; i < n; i++) {
        const t = Math.random() < 0.08 ? tofOf(0) + 9 * gauss() : tofOf(F * (0.82 + 0.18 * Math.random())) + 7 * gauss();
        ions.push([dnu, t]);
      }
      return n;
    }
    function bins() { /* mean TOF ± standard error per frequency */
      const m = new Map(); ions.forEach(([f, t]) => { const k = f.toFixed(4); (m.get(k) || m.set(k, []).get(k)).push(t); });
      return [...m].map(([k, ts]) => { const n = ts.length, mu = ts.reduce((a, b) => a + b, 0) / n,
        sd = n > 1 ? Math.sqrt(ts.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)) : 14; return [+k, mu, Math.max(sd, 5) / Math.sqrt(n), n]; }).sort((a, b) => a[0] - b[0]);
    }
    function doFit() { /* least squares in the centre only (shape known): grid + parabola, σ from Δχ² = 1 */
      const bs = bins(); if (bs.length < 3) return null;
      const chi = c => bs.reduce((s, [f, mu, e]) => s + ((mu - expect(f - c)) / e) ** 2, 0);
      let best = [Infinity, 0]; for (let c = -Wd; c <= Wd; c += Wd / 600) { const v = chi(c); if (v < best[0]) best = [v, c]; }
      let lo = best[1], hi = best[1], h = Wd / 6000;
      while (chi(lo) - best[0] < 1 && lo > -2 * Wd) lo -= h; while (chi(hi) - best[0] < 1 && hi < 2 * Wd) hi += h;
      return { c: best[1], s: (hi - lo) / 2, chi2: best[0] / Math.max(1, bs.length - 1) };
    }
    function paint(g, W, H, ink, print) {
      const P = { l: 58, t: 14, r: W - 12, b: H - 44 }, yr = [140, 290];
      const [X, Y] = axes(g, P, [-Wd, Wd], yr, `ν_rf − ${NU_REF.toLocaleString("en")} Hz  (Hz)`, "mean TOF (µs)", ink);
      g.save(); g.beginPath(); g.rect(P.l, P.t, P.r - P.l, P.b - P.t); g.clip();
      if (sel("view").value === "pix") {          /* 2D histogram: crisp pixels, viridis */
        const nx = 64, ny = 42, h = new Array(nx * ny).fill(0); let mx = 0;
        ions.forEach(([f, t]) => { const i = Math.floor((f + Wd) / (2 * Wd) * nx), j = Math.floor((t - yr[0]) / (yr[1] - yr[0]) * ny);
          if (i >= 0 && i < nx && j >= 0 && j < ny) mx = Math.max(mx, ++h[j * nx + i]); });
        const cw = (P.r - P.l) / nx, ch = (P.b - P.t) / ny;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = h[j * nx + i]; if (!v) continue;
          g.fillStyle = viridis(0.15 + 0.85 * Math.sqrt(v / mx)); g.fillRect(Math.floor(P.l + i * cw), Math.floor(P.b - (j + 1) * ch), Math.ceil(cw), Math.ceil(ch)); }
      } else {
        g.fillStyle = "rgba(139,108,255,.28)";
        ions.forEach(([f, t]) => { g.beginPath(); g.arc(X(f) + (Math.random() - 0.5) * 2, Y(t), 1.8, 0, 6.283); g.fill(); });
      }
      if (reveal || sel("theory").checked) {        /* expected line shape */
        g.strokeStyle = reveal ? "#e5484d" : "rgba(229,72,77,.55)"; g.lineWidth = 1.6; g.setLineDash(reveal ? [] : [5, 4]); g.beginPath();
        for (let i = 0; i <= 600; i++) { const f = -Wd + 2 * Wd * i / 600, y = Y(expect(f - (nuTrue - NU_REF))); i ? g.lineTo(X(f), y) : g.moveTo(X(f), y); } g.stroke(); g.setLineDash([]);
      }
      if (fit) {
        g.strokeStyle = "#30a46c"; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= 600; i++) { const f = -Wd + 2 * Wd * i / 600, y = Y(expect(f - fit.c)); i ? g.lineTo(X(f), y) : g.moveTo(X(f), y); } g.stroke();
        g.fillStyle = "rgba(48,164,108,.15)"; g.fillRect(X(fit.c - fit.s), P.t, Math.max(1, X(fit.c + fit.s) - X(fit.c - fit.s)), P.b - P.t);
      }
      bins().forEach(([f, mu, e]) => { const x = X(f);   /* means with error bars */
        g.strokeStyle = ink; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, Y(mu - e)); g.lineTo(x, Y(mu + e)); g.moveTo(x - 3, Y(mu - e)); g.lineTo(x + 3, Y(mu - e)); g.moveTo(x - 3, Y(mu + e)); g.lineTo(x + 3, Y(mu + e)); g.stroke();
        g.fillStyle = "#3e63dd"; g.beginPath(); g.arc(x, Y(mu), 3.4, 0, 6.283); g.fill(); });
      if (!print) { const x = X(+sl.value); g.strokeStyle = "rgba(247,107,21,.85)"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, P.t); g.lineTo(x, P.b); g.stroke(); g.setLineDash([]); }
      if (reveal) { const x = X(nuTrue - NU_REF); g.strokeStyle = "#e5484d"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, P.t); g.lineTo(x, P.b); g.stroke(); }
      g.restore();
      g.fillStyle = ink; g.font = "11px system-ui,sans-serif"; g.textAlign = "right";
      g.fillText(`¹³³Cs⁺ · B = 7 T · T_rf = ${Trf * 1000} ms (${scheme === "rect" ? "rectangular" : "Ramsey 10–80–10 %"}) · ${ions.length} ions / ${shots} shots`, P.r - 4, P.t + 13);
    }
    const draw = () => { const [g, W, H] = crisp(cv); paint(g, W, H, inkOf(), false); };
    function info() {
      const fw = fwhm(), R = NU_REF / fw;
      box.querySelector(".g-info").innerHTML = `FWHM ≈ ${fw.toFixed(2)} Hz (≈ ${(fw * Trf).toFixed(2)}/T_rf) · R = ν_c/FWHM ≈ ${Math.round(R).toLocaleString()} · ` +
        `δν = 0.1 Hz ↔ δm/m = ${(0.1 / NU_REF).toExponential(2)} ≈ ${(0.1 / NU_REF * 133 * 931494).toFixed(1)} keV`;
    }
    function reset() {
      Trf = +sel("trf").value; scheme = sel("scheme").value; Wd = (scheme === "rect" ? 3.2 : 2.4) / Trf; step = +(Wd / 160).toPrecision(2);
      sl.min = -Wd; sl.max = Wd; sl.step = step; sl.value = 0;
      nuTrue = NU_REF + (Math.random() - 0.5) * 0.9 * Wd; ions = []; shots = 0; fit = null; reveal = false;
      upd(); info(); draw(); msg(box, TL.tof_start);
    }
    const upd = () => (box.querySelector("output").textContent = `${(NU_REF + +sl.value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Hz (Δ = ${(+sl.value).toFixed(2)} Hz)`);
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "shot") { const n = shoot(+sl.value); draw(); msg(box, `${TL.shots}: ${shots} · ${TL.ions_got}: ${n}`); }
      if (a === "scan") { const n0 = 15; for (let i = 0; i < n0; i++) shoot(+(-Wd + 2 * Wd * i / (n0 - 1)).toFixed(4)); draw(); msg(box, `${TL.shots}: ${shots} · ${TL.scan_done}`); }
      if (a === "fit") { fit = doFit(); draw(); msg(box, fit ? `${TL.fit_res}: ν_c = ${(NU_REF + fit.c).toLocaleString("en", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ± ${fit.s.toFixed(3)} Hz · χ²/ν = ${fit.chi2.toFixed(2)}` : TL.fit_need); }
      if (a === "guess") {
        const err = Math.abs(+sl.value - (nuTrue - NU_REF)), fw = fwhm(), sc = Math.max(0, Math.round(100 - 60 * err / fw - shots));
        const mG = QE * B / (2 * Math.PI * (NU_REF + +sl.value)) / U + ME / U, dm = (mG - M_CS) * 931494.10242;
        reveal = true; draw();
        msg(box, `ν_c = ${nuTrue.toLocaleString("en", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Hz · ${TL.yours}: ${(NU_REF + +sl.value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Hz (Δ = ${err.toFixed(3)} Hz = ${(err / fw).toFixed(2)} FWHM)<br>` +
          `m = qB/(2πν_c) → ${mG.toFixed(7)} u (${dm >= 0 ? "+" : ""}${dm.toFixed(1)} keV vs AME2020) · ${TL.score}: <b>${sc}</b> · ${TL.best}: ${best("tof", sc)}`);
      }
      if (a === "new") reset();
      if (a === "png") savePNG(cv, paint, "tof-icr-resonance");
      if (a === "csv" && window.zgExport) window.zgExport.csv(["nu_rf_Hz", "detuning_Hz", "tof_us"], ions.map(([f, t]) => [(NU_REF + f).toFixed(4), f.toFixed(4), t.toFixed(2)]), "tof-icr-ions");
    });
    sl.addEventListener("input", () => { upd(); draw(); });
    ["trf", "scheme"].forEach(n => sel(n).addEventListener("change", reset));
    ["view", "theory"].forEach(n => sel(n).addEventListener("change", draw));
    addEventListener("resize", draw);
    reset();
  }

  /* ── 3. MR-TOF isobar separation ──────────────────────────────────────
     t(N) = t₀ + N·T_lap,  both ∝ √m.  Isobars differ by Δt = t·Δm/(2m).
     Peak width: FWHM(N)² = Δt₀² + (N·δ_lap)²  (Δt₀ = initial bunch width from the cooler-buncher,
     δ_lap = width added per lap by energy spread / aberrations).  R = t/(2·FWHM); separated when Δt ≥ FWHM. */
  function mrtofGame() {
    const box = $("#g-mr"), [cv, cv2] = box.querySelectorAll("canvas"), sel = n => box.querySelector(`[name=${n}]`);
    const pairs = [["¹⁰⁰Sn", "¹⁰⁰In", 100, 7030], ["¹³³Cs", "¹³³Xe", 133, 427], ["⁸⁴Rb", "⁸⁴Kr", 84, 2690], ["⁵⁶Ni", "⁵⁶Co", 56, 2133], ["¹²⁹Sb", "¹²⁹Sn", 129, 4040], ["¹⁰¹Sn", "¹⁰¹In", 101, 7300]];
    let P = pairs[0], hist = null;
    const V = n => +sel(n).value;
    function model() {
      const N = V("laps"), dt0 = V("dt0"), dl = V("dlap") / 1000, A = P[2], s = Math.sqrt(A / 100);
      const t = (V("t0") + N * V("tlap")) * s * 1000;            /* ns */
      const dT = t * P[3] / (2 * A * 931494.1), fw = Math.hypot(dt0, N * dl), R = t / (2 * fw), need = A * 931494.1 / P[3];
      return { N, t, dT, fw, R, need, dt0, dl, s };
    }
    function sample(m) { /* counts per bin with Poisson noise; ratio sets the 2nd peak */
      const n1 = 400, n2 = Math.round(400 * V("ratio")), span = Math.max(4 * m.fw, 1.8 * m.dT + 3 * m.fw), nb = 160, h = new Array(nb).fill(0), x0 = m.dT / 2 - span / 2, sg = m.fw / 2.3548;
      for (let i = 0; i < n1; i++) { const b = Math.floor((sg * gauss() - x0) / span * nb); if (b >= 0 && b < nb) h[b]++; }
      for (let i = 0; i < n2; i++) { const b = Math.floor((m.dT + sg * gauss() - x0) / span * nb); if (b >= 0 && b < nb) h[b]++; }
      return { h, x0, span, nb };
    }
    function paint(g, W, H, ink) {
      const m = model(); hist = hist || sample(m);
      const { h, x0, span, nb } = hist, mx = Math.max(5, ...h) * 1.15, Pp = { l: 52, t: 12, r: W - 12, b: H - 42 };
      const [X, Y] = axes(g, Pp, [x0, x0 + span], [0, mx], `TOF − t(${P[0]}) (ns)  ·  t(${P[0]}) = ${(m.t / 1000).toFixed(3)} µs`, "counts", ink, 4);
      const bw = (Pp.r - Pp.l) / nb, sg = m.fw / 2.3548;
      h.forEach((v, i) => { if (!v) return; const x = X(x0 + i * span / nb), c = x0 + (i + 0.5) * span / nb;
        g.fillStyle = Math.abs(c) < Math.abs(c - m.dT) ? "rgba(62,99,221,.75)" : "rgba(229,72,77,.75)"; g.fillRect(x, Y(v), Math.max(1, bw - 0.6), Pp.b - Y(v)); });
      const area = 400 * span / nb / (sg * Math.sqrt(2 * Math.PI));
      [[0, "#3e63dd", 1], [m.dT, "#e5484d", V("ratio")]].forEach(([mu, col, r]) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
        for (let i = 0; i <= 300; i++) { const x = x0 + span * i / 300, y = Y(r * area * Math.exp(-0.5 * ((x - mu) / sg) ** 2)); i ? g.lineTo(X(x), y) : g.moveTo(X(x), y); } g.stroke(); });
      g.fillStyle = ink; g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center";
      g.fillText(P[0], X(0), Pp.t + 14); g.fillText(P[1], X(m.dT), Pp.t + 28);
      const y = Pp.t + 40; g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.moveTo(X(0), y); g.lineTo(X(m.dT), y); g.stroke();
      g.font = "11px system-ui,sans-serif"; g.fillText(`Δt = ${m.dT.toFixed(1)} ns`, (X(0) + X(m.dT)) / 2, y - 4);
    }
    function paint2(g, W, H, ink) {           /* resolving power vs laps */
      const m = model(), Nmax = +sel("laps").max, Pp = { l: 58, t: 10, r: W - 12, b: H - 40 };
      const Rof = N => (V("t0") + N * V("tlap")) * m.s * 1000 / (2 * Math.hypot(m.dt0, N * m.dl));
      let top = 0; for (let N = 0; N <= Nmax; N += 10) top = Math.max(top, Rof(N)); top = Math.max(top, m.need) * 1.2;
      const [X, Y] = axes(g, Pp, [0, Nmax], [0, top], TL.laps, "R = t / (2·FWHM)", ink, 4);
      g.strokeStyle = "#e5484d"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(Pp.l, Y(m.need)); g.lineTo(Pp.r, Y(m.need)); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#e5484d"; g.font = "11px system-ui,sans-serif"; g.textAlign = "left"; g.fillText(`${TL.need}: m/Δm = ${Math.round(m.need).toLocaleString()}`, Pp.l + 6, Y(m.need) - 4);
      g.strokeStyle = "#8e4ec6"; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 200; i++) { const N = Nmax * i / 200, y = Y(Rof(N)); i ? g.lineTo(X(N), y) : g.moveTo(X(N), y); } g.stroke();
      g.fillStyle = "#f76b15"; g.beginPath(); g.arc(X(m.N), Y(m.R), 5, 0, 6.283); g.fill();
    }
    const TL = T;
    function draw(resample) {
      if (resample) hist = null;
      const m = model();
      { const [g, W, H] = crisp(cv); paint(g, W, H, inkOf()); }
      { const [g, W, H] = crisp(cv2); paint2(g, W, H, inkOf()); }
      box.querySelectorAll("output").forEach(o => { const n = o.dataset.for; if (n) o.textContent = { laps: m.N, dt0: m.dt0 + " ns", dlap: V("dlap") + " ps", ratio: "1 : " + V("ratio"), tlap: V("tlap") + " µs", t0: V("t0") + " µs" }[n]; });
      const ok = m.dT >= m.fw;
      msg(box, `${P[0]} – ${P[1]}: Δm = ${P[3].toLocaleString()} keV · t = ${(m.t / 1000).toFixed(2)} µs · Δt = ${m.dT.toFixed(1)} ns · FWHM = ${m.fw.toFixed(1)} ns · R ≈ ${Math.round(m.R).toLocaleString()} (${TL.need} ${Math.round(m.need).toLocaleString()}) · ${ok ? "✔ " + TL.separated : "… " + TL.overlap}` +
        (m.dl > 0 && m.dt0 / m.dl < 1e9 ? ` · ${TL.mr_sat}: N ≈ ${Math.round(m.dt0 / m.dl).toLocaleString()}` : ""));
    }
    function fillPairs() {
      sel("pair").innerHTML = pairs.map((p, i) => `<option value="${i}">${p[0]} / ${p[1]} (Δm = ${p[3].toLocaleString()} keV)</option>`).join("");
    }
    function randomPair() { /* two neighbouring isobars from NUBASE2020 that live ≥ 10 ms */
      const ok = rows.filter(r => r[6] >= -2 && r[5] === 0), by = new Map(); ok.forEach(r => by.set(r[0] + "," + (r[0] + r[1]), r));
      for (let k = 0; k < 500; k++) { const a = rnd(ok), b = by.get((a[0] + 1) + "," + (a[0] + a[1])); if (!b) continue;
        const d = Math.abs(a[3] - b[3]); if (d < 50) continue; const A = a[0] + a[1];
        const p = [sup(A) + a[2], sup(A) + b[2], A, Math.round(d)]; pairs.push(p); fillPairs(); sel("pair").value = pairs.length - 1; P = p; draw(true); return; }
    }
    box.addEventListener("input", e => { if (e.target.name && e.target.name !== "pair") draw(e.target.name !== "laps"); });
    box.addEventListener("change", e => { if (e.target.name === "pair") { P = pairs[+e.target.value]; draw(true); } });
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "rand") rows.length ? randomPair() : null;
      if (a === "new") { sel("laps").value = 0; draw(true); }
      if (a === "png") savePNG(cv, paint, "mrtof-isobars");
      if (a === "png2") savePNG(cv2, paint2, "mrtof-resolving-power");
      if (a === "csv" && window.zgExport && hist) window.zgExport.csv(["tof_minus_t1_ns", "counts"], hist.h.map((v, i) => [(hist.x0 + (i + 0.5) * hist.span / hist.nb).toFixed(3), v]), "mrtof-spectrum");
    });
    box.querySelector("[name=laps]").addEventListener("input", () => (hist = null));
    fillPairs(); addEventListener("resize", () => draw(false)); draw(true);
  }

  /* ── 3b. Keep the ions: linear Paul trap / RFQ mass filter ──────────────
     Mathieu equations (ξ = Ωt/2):  x'' + (a − 2q cos 2ξ) x = 0,  y'' − (a − 2q cos 2ξ) y = 0
     a = 8eU/(m r₀²Ω²), q = 4eV/(m r₀²Ω²);  r₀ = 4.5 mm, Ω/2π = 1 MHz.  Rods: radius 1.145 r₀.
     An ion is lost when it touches a rod (distance to a rod centre < rod radius) — shown as a spark.   */
  function rfqGame() {
    const box = $("#g-rfq"); if (!box) return;
    const [cv, cvd] = box.querySelectorAll("canvas"), sel = n => box.querySelector(`[name=${n}]`), V = n => +sel(n).value;
    const r0 = 4.5e-3, Om = 2 * Math.PI * 1e6, k = 1.602176634e-19 / (1.66053906660e-27 * r0 * r0 * Om * Om), rho = 1.145, Rc = 1 + rho;
    const cols = ["#3e63dd", "#30a46c", "#e5484d", "#f5b800", "#8e4ec6"];
    let masses, ions = [], sparks = [], stat, xi = 0, raf = 0, running = true;
    const aq = A => [8 * k * V("U") / A, 4 * k * V("V") / A];
    const a0 = q => -q * q / 2 + 7 * q ** 4 / 128 - 29 * q ** 6 / 2304 + 68687 * q ** 8 / 18874368;
    const b1 = q => 1 - q - q * q / 8 + q ** 3 / 64 - q ** 4 / 1536 - 11 * q ** 5 / 36864;
    const stable = (a, q) => q < 0.92 && a < b1(q) && a > a0(q) && -a < b1(q) && -a > a0(q);
    function spawn(i) { const A = masses[i % masses.length], r = 0.12 * Math.sqrt(Math.random()), f = 6.283 * Math.random();
      return { A, c: cols[masses.indexOf(A)], x: r * Math.cos(f), y: r * Math.sin(f), vx: 0.012 * gauss(), vy: 0.012 * gauss(), age: 0, tr: [] }; }
    function reset() {
      const A0 = V("A"); masses = sel("set").value === "near" ? [A0 - 2, A0, A0 + 2] : [Math.round(A0 / 2), A0, A0 * 2];
      ions = Array.from({ length: 24 }, (_, i) => spawn(i)); ions.forEach(o => (o.age = Math.random() * 40)); sparks = [];
      stat = Object.fromEntries(masses.map(A => [A, [0, 0]]));
      box.querySelector(".rfq-leg").innerHTML = masses.map((A, i) => `<span><i style="background:${cols[i]}"></i>A = ${A}${A === A0 ? " ★" : ""}</span>`).join("");
    }
    function acc(o, x, y, s) { const [a, q] = aq(o.A), f = a - 2 * q * Math.cos(2 * s); return [-f * x, f * y]; }
    function step(o, h) { /* RK4 in ξ */
      const s = xi, p = [o.x, o.y, o.vx, o.vy];
      const F = (s1, [x, y, vx, vy]) => { const [ax, ay] = acc(o, x, y, s1); return [vx, vy, ax, ay]; };
      const k1 = F(s, p), k2 = F(s + h / 2, p.map((v, i) => v + h / 2 * k1[i])), k3 = F(s + h / 2, p.map((v, i) => v + h / 2 * k2[i])), k4 = F(s + h, p.map((v, i) => v + h * k3[i]));
      [o.x, o.y, o.vx, o.vy] = p.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    }
    const hit = o => [[Rc, 0], [-Rc, 0], [0, Rc], [0, -Rc]].some(([cx, cy]) => Math.hypot(o.x - cx, o.y - cy) < rho) || Math.hypot(o.x, o.y) > 3;
    const LIFE = 60 * Math.PI;  /* 60 RF periods ≈ passage through the filter */
    function tick() {
      const h = 0.05, n = V("speed");
      for (let s = 0; s < n; s++) {
        ions.forEach((o, i) => {
          step(o, h); o.age += h;
          if (hit(o)) { stat[o.A][1]++; sparks.push([o.x, o.y, 1, o.c]); ions[i] = spawn(i); }
          else if (o.age > LIFE) { stat[o.A][0]++; ions[i] = spawn(i); }
        });
        xi += h;
      }
      ions.forEach(o => { o.tr.push([o.x, o.y]); if (o.tr.length > 70) o.tr.shift(); });
    }
    function paint(g, W, H, ink) {   /* cross-section */
      const S = Math.min(W, H) / 2 / 2.05 * 1.0, cx = W / 2, cy = H / 2, pol = Math.cos(2 * xi) > 0;
      [[Rc, 0, 1], [-Rc, 0, 1], [0, Rc, -1], [0, -Rc, -1]].forEach(([x, y, sgn]) => {
        const pos = (sgn > 0) === pol; g.fillStyle = pos ? "rgba(229,72,77,.82)" : "rgba(62,99,221,.82)";
        g.beginPath(); g.arc(cx + x * S, cy + y * S, rho * S, 0, 6.283); g.fill();
        g.fillStyle = "#fff"; g.font = "700 14px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(pos ? "+" : "−", cx + x * S * 0.78, cy + y * S * 0.78);
      });
      g.strokeStyle = "rgba(127,127,160,.55)"; g.setLineDash([3, 4]); g.beginPath(); g.arc(cx, cy, S, 0, 6.283); g.stroke(); g.setLineDash([]);
      g.fillStyle = ink; g.font = "11px system-ui"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("r₀ = 4.5 mm", cx + S * 0.72, cy - S * 0.72);
      ions.forEach(o => { g.strokeStyle = o.c + "66"; g.lineWidth = 1; g.beginPath(); o.tr.forEach(([x, y], i) => i ? g.lineTo(cx + x * S, cy + y * S) : g.moveTo(cx + x * S, cy + y * S)); g.stroke();
        g.fillStyle = o.c; g.beginPath(); g.arc(cx + o.x * S, cy + o.y * S, 3, 0, 6.283); g.fill(); });
      sparks = sparks.filter(s => (s[2] -= 0.03) > 0);
      sparks.forEach(([x, y, l, c]) => { g.strokeStyle = c; g.globalAlpha = l; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.moveTo(cx + x * S, cy + y * S); g.lineTo(cx + x * S + 9 * l * Math.cos(a), cy + y * S + 9 * l * Math.sin(a)); g.stroke(); } g.globalAlpha = 1; });
    }
    function paintD(g, W, H, ink) {  /* a–q stability diagram with scan line and ion working points */
      const P = { l: 50, t: 10, r: W - 10, b: H - 40 }, [X, Y] = axes(g, P, [0, 1], [-0.3, 0.3], "q = 4eV / (m r₀² Ω²)", "a = 8eU / (m r₀² Ω²)", ink, 6);
      g.fillStyle = "rgba(48,164,108,.22)"; g.beginPath();
      const up = [], dn = []; for (let i = 0; i <= 240; i++) { const q = 0.92 * i / 240; up.push([q, Math.min(b1(q), -a0(q))]); dn.push([q, Math.max(a0(q), -b1(q))]); }
      up.forEach(([q, a], i) => i ? g.lineTo(X(q), Y(Math.min(0.3, a))) : g.moveTo(X(q), Y(a))); dn.reverse().forEach(([q, a]) => g.lineTo(X(q), Y(Math.max(-0.3, a)))); g.closePath(); g.fill();
      g.strokeStyle = "rgba(48,164,108,.8)"; g.lineWidth = 1.2; g.stroke();
      const r = V("V") > 0 ? 2 * V("U") / V("V") : 0; g.strokeStyle = ink; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(r * 1)); g.stroke(); g.setLineDash([]);
      masses.forEach((A, i) => { const [a, q] = aq(A); if (q > 1.02 || Math.abs(a) > 0.32) return; g.fillStyle = cols[i]; g.beginPath(); g.arc(X(q), Y(a), 4.5, 0, 6.283); g.fill();
        if (A === V("A")) { g.fillStyle = ink; g.font = "600 11px system-ui"; g.textAlign = "right"; g.fillText("★ A = " + A, X(q) - 8, Y(a) + 4); g.textAlign = "left"; } });
      g.fillStyle = ink; g.font = "11px system-ui"; g.textAlign = "left"; g.fillText(TL.rfq_stable, X(0.05), Y(0.02));
    }
    const TL = T;
    function report() {
      const A0 = V("A"), [a, q] = aq(A0);
      box.querySelector(".rfq-out").innerHTML = masses.map((A, i) => { const [t, l] = stat[A], n = t + l, [aa, qq] = aq(A);
        return `<span style="color:${cols[i]}">A = ${A}: q = ${qq.toFixed(3)}, a = ${aa.toFixed(3)} → ${stable(aa, qq) ? "✔" : "✘"} ${n ? Math.round(100 * t / n) + " %" : "–"}</span>`; }).join(" · ");
      const T0 = stat[A0][0] / Math.max(1, stat[A0][0] + stat[A0][1]), Tx = Math.max(...masses.filter(A => A !== A0).map(A => stat[A][0] / Math.max(1, stat[A][0] + stat[A][1])));
      const n = masses.reduce((s, A) => s + stat[A][0] + stat[A][1], 0);
      msg(box, n > 60 ? `${TL.rfq_score}: <b>${Math.round(100 * T0 * (1 - Tx))}</b> (${TL.rfq_t}: ${Math.round(100 * T0)} %, ${TL.rfq_o}: ${Math.round(100 * Tx)} %) · ${TL.best}: ${best("rfq", Math.round(100 * T0 * (1 - Tx)))}` : TL.rfq_start);
      box.querySelectorAll("output").forEach(o => { const n = o.dataset.for; if (n) o.textContent = n === "A" ? "A = " + A0 : n === "speed" ? "×" + V(n) : V(n) + " V"; });
    }
    let last = 0;
    function loop(ts) {
      if (running && box.getBoundingClientRect().bottom > 0 && box.getBoundingClientRect().top < innerHeight) {
        tick(); { const [g, W, H] = crisp(cv); paint(g, W, H, inkOf()); }
        if (ts - last > 400) { last = ts; const [g, W, H] = crisp(cvd); paintD(g, W, H, inkOf()); report(); }
      }
      raf = requestAnimationFrame(loop);
    }
    box.addEventListener("input", e => { if (["A", "set"].includes(e.target.name)) reset(); else if (["U", "V"].includes(e.target.name)) masses.forEach(A => (stat[A] = [0, 0])); last = 0; });
    box.addEventListener("change", e => { if (e.target.name === "set") reset(); });
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "cool") { sel("U").value = 0; sel("V").value = Math.round(0.4 * V("A") / (4 * k)); reset(); }
      if (a === "tip") { sel("V").value = (0.7035 * V("A") / (4 * k)).toFixed(1); sel("U").value = (0.2335 * V("A") / (8 * k)).toFixed(2); reset(); }
      if (a === "pause") running = !running;
      if (a === "png") savePNG(cv, paint, "rfq-cross-section");
      if (a === "png2") savePNG(cvd, paintD, "rfq-stability-diagram");
      last = 0;
    });
    reset(); raf = requestAnimationFrame(loop);
  }

  /* ── 4. Magic-number & element quiz ────────────────────────────────── */
  function quiz(els) {
    const box = $("#g-quiz"); let score = 0, ans;
    const Q = [
      () => { const e = rnd(els.filter(e => e[0] <= 100)); ans = e[1]; return [T.q_sym.replace("{z}", e[0]), [e[1], ...pick3(els.filter(x => x !== e).map(x => x[1]))]]; },
      () => { const m = rnd([2, 8, 20, 28, 50, 82, 126]); ans = String(m); const fake = [4, 6, 10, 14, 16, 30, 40, 64, 70, 90, 100, 114].filter(x => x !== m); return [T.q_magic, [String(m), ...pick3(fake.map(String))]]; },
      () => { const d = rnd([["¹⁰⁰Sn", 50, 50], ["¹³²Sn", 50, 82], ["²⁰⁸Pb", 82, 126], ["⁴⁸Ca", 20, 28], ["⁵⁶Ni", 28, 28], ["¹⁶O", 8, 8]]); ans = d[0]; return [T.q_dmagic, [d[0], ...pick3(["¹²⁰Sn", "⁴⁴Ca", "²⁰⁴Pb", "⁶⁰Ni", "¹⁴C", "⁹⁰Zr", "¹⁴⁰Ce"])]]; },
    ];
    function pick3(a) { const o = []; while (o.length < 3) { const x = rnd(a); if (!o.includes(x) && x !== ans) o.push(x); } return o; }
    function next() {
      const [q, opts] = rnd(Q)(); opts.sort(() => Math.random() - 0.5);
      box.querySelector(".g-q").textContent = q;
      box.querySelector(".g-opts").innerHTML = opts.map(o => `<button type="button" class="zg-btn zg-btn-ghost" data-o="${o}">${o}</button>`).join("");
    }
    box.addEventListener("click", e => {
      const o = e.target.closest("[data-o]")?.dataset.o; if (o == null) return;
      const ok = o === ans; score = ok ? score + 1 : 0;
      box.querySelector(".g-msg").textContent = `${ok ? "✔ " + T.right : "✘ " + T.wrong + " → " + ans} · ${T.score}: ${score} · ${T.best}: ${best("quiz", score)}`;
      setTimeout(next, 900);
    });
    next();
  }

  fetch(root.dataset.src).then(r => r.json()).then(d => { rows = d.rows; hlGame(); quiz(d.elements); });
  tofGame(); mrtofGame(); rfqGame();
})();
