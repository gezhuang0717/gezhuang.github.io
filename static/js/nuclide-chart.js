/* Interactive chart of nuclides — AME2020 / NUBASE2020 (static/data/nubase2020.json).
   Chart: zoom (wheel, ＋/−), drag to pan, click a box → zoom in + info card (all values with uncertainties;
   "#" = extrapolated / from systematics, as in AME and NUBASE). Colour modes, mass filters, search,
   mulberry periodic table. Chain plots (isotopic / isotonic / isobaric) with error bars.
   Exports: high-resolution PNG, CSV with uncertainties, WebM video (zoom tour) — via static/js/zg-export.js.
   Theory masses (FRDM 1995, HFB-17, HFB-D1M from static/data/massmodels.json, built by tools/make_mass_models.py):
   mass source select, drip lines (Sn, S2n, Sp, S2p = 0), r-/rp-process paths, model curves in chain plots,
   β2 deformation and ME(AME) − ME(model) colour modes. Pairing / p-n quantities: δVpn, Wigner indicator W, Δ(3)n, Δ(3)p.
   Labels: data-labels JSON (five languages) from layouts/_shortcodes/nuclide-chart.html + data/nuclide_chart_labels.yaml. */
(() => {
  const root = document.querySelector("[data-nuclide-chart]");
  if (!root) return;
  const T = JSON.parse(root.dataset.labels || "{}");
  const cv = root.querySelector("canvas.nc-canvas"), g = cv.getContext("2d");
  const card = root.querySelector(".nc-card"), legend = root.querySelector(".nc-legend"), ptab = root.querySelector(".nc-ptable");
  const sel = root.querySelector("[name=nc-colour]"), fsel = root.querySelector("[name=nc-filter]"), search = root.querySelector("[name=nc-search]");
  const pc = root.querySelector("canvas.nc-plot"), pg = pc.getContext("2d"), pq = root.querySelector("[name=nc-pq]"), pchain = root.querySelector("[name=nc-pchain]"), pinfo = root.querySelector(".nc-pinfo");
  const MAGIC = [2, 8, 20, 28, 50, 82, 126], SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).replace(/\d/g, d => SUP[d]);
  let rows = [], M = new Map(), EL = [], view = { s: 4, x: 10, y: 0 }, pin = null, hover = null, mode = "decay", filt = "all", anim = null;
  let chain = null, plotPts = [], modPts = [], plotHover = null;
  /* theory masses: MOD[key] = {name, ref, url, map: Map(key → [ME keV, β2·1000])}; src = "ame" or a model key */
  let MOD = {}, PATHS = {}, src = "ame", modelsLoading = null, extraRows = [];
  const msel = root.querySelector("[name=nc-model]"), ovl = root.querySelector(".nc-ovl");
  const key = (Z, N) => Z * 1000 + N;
  const css = getComputedStyle(document.documentElement), ink = (css.getPropertyValue("--zg-ink") || "").trim() || "#1d2433";
  const X = window.zgExport;
  const DPR = () => Math.min(4, Math.max(2, window.devicePixelRatio || 1));   /* render at ≥ 2× for crisp text and lines */
  cv._cw = 960; cv._ch = 600; pc._cw = 960; pc._ch = 480;
  const sizeCanvas = (c, w, h) => { const k = DPR(); c._cw = w; c._ch = h; c.width = Math.round(w * k); c.height = Math.round(h * k); c.style.aspectRatio = `${w} / ${h}`; };

  /* ---------- physics with uncertainties (keV); est = any input from systematics (#) ---------- */
  const get = (Z, N) => { const r = M.get(key(Z, N)); return r && r[3] != null ? { v: r[3], e: r[4] || 0, est: !!r[5] } : null; };
  let MEn = { v: 8071.3181, e: 0.0004, est: false }, MEH = { v: 7288.971064, e: 0.000013, est: false }, MEa = { v: 2424.91587, e: 0.00015, est: false };
  /* combine a·x + b·y + … ; uncertainties in quadrature (AME correlations neglected) */
  const comb = (...terms) => {
    if (terms.some(([c, x]) => x == null)) return null;
    return { v: terms.reduce((s, [c, x]) => s + c * x.v, 0), e: Math.sqrt(terms.reduce((s, [c, x]) => s + (c * x.e) ** 2, 0)), est: terms.some(([, x]) => x.est) };
  };
  const K = c => ({ v: c, e: 0, est: false });
  const memo = new Map();
  const getM = (s, Z, N) => { const v = MOD[s] && MOD[s].map.get(key(Z, N)); return v ? { v: v[0], e: 0, est: false } : null; };
  const getter = s => s === "ame" ? get : (Z, N) => getM(s, Z, N);
  const derived = r => derivedZN(r[0], r[1], "ame");
  function derivedZN(Z, N, s = "ame") {
    const k = s + ":" + key(Z, N); if (memo.has(k)) return memo.get(k);
    const get = getter(s), A = Z + N, m = get(Z, N);
    const BE = comb([Z, MEH], [N, MEn], [-1, m]);
    const out = {
      A, me: m, BE, BEA: BE && A > 0 ? { v: BE.v / A, e: BE.e / A, est: BE.est } : null,
      sn: comb([1, get(Z, N - 1)], [1, MEn], [-1, m]), s2n: comb([1, get(Z, N - 2)], [2, MEn], [-1, m]),
      sp: comb([1, get(Z - 1, N)], [1, MEH], [-1, m]), s2p: comb([1, get(Z - 2, N)], [2, MEH], [-1, m]),
      qbm: comb([1, m], [-1, get(Z + 1, N - 1)]), qec: comb([1, m], [-1, get(Z - 1, N + 1)]), qa: comb([1, m], [-1, get(Z - 2, N - 2)], [-1, MEa]),
    };
    /* two-neutron shell gap δ2n = S2n(Z,N) − S2n(Z,N+2) */
    out.d2n = comb([1, get(Z, N - 2)], [-2, m], [1, get(Z, N + 2)]);   /* = ME(N−2) − 2·ME(N) + ME(N+2) */
    /* three-point odd–even staggering (pairing gap): Δ(3)n = (−1)^N/2 [ME(N+1) − 2ME(N) + ME(N−1)], same in Z for protons */
    const sn = N % 2 ? -0.5 : 0.5, sz = Z % 2 ? -0.5 : 0.5;
    out.d3n = comb([sn, get(Z, N + 1)], [-2 * sn, m], [sn, get(Z, N - 1)]);
    out.d3p = comb([sz, get(Z + 1, N)], [-2 * sz, m], [sz, get(Z - 1, N)]);
    /* five-point formula: Δ(5) = (−1)^N/8 [ME(N+2) − 4ME(N+1) + 6ME(N) − 4ME(N−1) + ME(N−2)] */
    const fn = sn / 4, fz = sz / 4;
    out.d5n = comb([fn, get(Z, N + 2)], [-4 * fn, get(Z, N + 1)], [6 * fn, m], [-4 * fn, get(Z, N - 1)], [fn, get(Z, N - 2)]);
    out.d5p = comb([fz, get(Z + 2, N)], [-4 * fz, get(Z + 1, N)], [6 * fz, m], [-4 * fz, get(Z - 1, N)], [fz, get(Z - 2, N)]);
    out.d2p = comb([1, get(Z - 2, N)], [-2, m], [1, get(Z + 2, N)]);   /* δ2p = S2p(Z) − S2p(Z+2) */
    /* proton–neutron interaction δVpn (Zhang et al. 1989; Cakirli & Casten 2005) from binding energies B = Z·ME(¹H) + N·ME(n) − ME */
    const B = (z, n) => comb([z, MEH], [n, MEn], [-1, get(z, n)]);
    const ze = Z % 2 === 0, ne = N % 2 === 0;
    out.vpn = ze && ne ? comb([0.25, B(Z, N)], [-0.25, B(Z, N - 2)], [-0.25, B(Z - 2, N)], [0.25, B(Z - 2, N - 2)])
      : !ze && !ne ? comb([1, B(Z, N)], [-1, B(Z, N - 1)], [-1, B(Z - 1, N)], [1, B(Z - 1, N - 1)])
      : ze ? comb([0.5, B(Z, N)], [-0.5, B(Z, N - 1)], [-0.5, B(Z - 2, N)], [0.5, B(Z - 2, N - 1)])
      : comb([0.5, B(Z, N)], [-0.5, B(Z, N - 2)], [-0.5, B(Z - 1, N)], [0.5, B(Z - 1, N - 2)]);
    out.beta2 = s !== "ame" && MOD[s] && MOD[s].map.get(key(Z, N)) ? { v: MOD[s].map.get(key(Z, N))[1], e: 0, est: false } : null;   /* β2 × 1000 */
    /* Wigner-energy indicator (as in the Mulberry code): W = δVpn(N) − ½[δVpn(N+2) + δVpn(N−2)]; peaks at N = Z.
       Lazy getter: neighbours only need their δVpn, so there is no recursion chain. */
    let wig;
    Object.defineProperty(out, "wig", { get() {
      if (wig !== undefined) return wig;
      const vp = derivedZN(Z, N + 2, s).vpn, vm = derivedZN(Z, N - 2, s).vpn;
      return (wig = out.vpn && vp && vm ? comb([1, out.vpn], [-0.5, vp], [-0.5, vm]) : null);
    } });
    memo.set(k, out); return out;
  }
  /* ME(AME) − ME(model) for the chosen (or default FRDM) model */
  const modelKey = () => src !== "ame" ? src : MOD.frdm1995 ? "frdm1995" : Object.keys(MOD)[0];
  const dmod = r => { const mk = modelKey(), a = get(r[0], r[1]), b = mk && getM(mk, r[0], r[1]); return a && b ? { v: a.v - b.v, e: a.e, est: a.est } : null; };
  const decayClass = r => {
    const b = r[10] || "";
    if (r[6] === 99) return "stable";
    const first = (b.split(";")[0] || "").replace(/[=~<>?].*$/, "").trim();
    if (first === "B-" || first === "2B-") return "bm";
    if (first === "B+" || first === "EC" || first === "e+" || first === "2B+") return "bp";
    if (first === "A") return "a"; if (first === "SF") return "sf"; if (first === "IT") return "it";
    if (first === "p" || first === "2p") return "p"; if (first === "n" || first === "2n") return "n";
    return r[6] === -98 ? "punst" : "other";
  };
  const DC = { stable: "#111827", bm: "#3b82f6", bp: "#ef4444", a: "#f2c230", sf: "#22c55e", p: "#f97316", n: "#7c3aed", it: "#ec4899", punst: "#cbd5e1", other: "#94a3b8" };

  /* ---------- colour modes ---------- */
  const ramp = x => `hsl(${(1 - Math.max(0, Math.min(1, x))) * 270},85%,52%)`;
  const mv = (o, f = 1000) => o == null ? null : o.v / f;
  const D = r => derivedZN(r[0], r[1], src);          /* derived values from the current mass source */
  const MODES = {
    decay: { label: T.m_decay, f: r => DC[decayClass(r)] },
    hl: { label: T.m_hl, f: r => r[6] === 99 ? "#111827" : r[6] <= -98 ? "#e2e8f0" : ramp((r[6] + 9) / 29), range: ["1 ns", "10²⁰ s"] },
    bea: { label: T.m_bea, v: r => mv(D(r).BEA), lo: 7.0, hi: 8.8, u: "MeV" },
    me: { label: T.m_me, v: r => mv(D(r).me), lo: -95, hi: 80, u: "MeV" },
    sn: { label: T.m_sn, v: r => mv(D(r).sn), lo: 0, hi: 20, u: "MeV" },
    s2n: { label: T.m_s2n, v: r => mv(D(r).s2n), lo: 0, hi: 35, u: "MeV" },
    sp: { label: T.m_sp, v: r => mv(D(r).sp), lo: 0, hi: 20, u: "MeV" },
    qbm: { label: T.m_qb, v: r => mv(D(r).qbm), lo: 0, hi: 20, u: "MeV" },
    qa: { label: T.m_qa, v: r => mv(D(r).qa), lo: 0, hi: 10, u: "MeV" },
    dme: { label: T.m_dme, v: r => r[4] == null ? null : Math.log10(Math.max(r[4], 1e-4)), lo: -3, hi: 3, rng: ["0.001 keV", "1 MeV"] },
    est: { label: T.m_est, f: r => r[5] ? "#f59e0b" : "#0ea5e9" },
    year: { label: T.m_year, v: r => r[9], lo: 1900, hi: 2020 },
    iso: { label: T.m_iso, f: r => ["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][Math.min(3, r[11].length)] },
    eo: { label: T.m_eo, f: r => ["#0ea5e9", "#f59e0b", "#22c55e", "#ef4444"][(r[0] % 2) * 2 + (r[1] % 2)] },
    s2p: { label: "S₂ₚ", v: r => mv(D(r).s2p), lo: 0, hi: 35, u: "MeV" },
    qec: { label: "Q(EC)", v: r => mv(D(r).qec), lo: 0, hi: 20, u: "MeV" },
    d2n: { label: "δ₂ₙ (shell gap)", v: r => mv(D(r).d2n), lo: 0, hi: 6, u: "MeV" },
    d2p: { label: "δ₂ₚ (shell gap)", v: r => mv(D(r).d2p), lo: 0, hi: 6, u: "MeV" },
    vpn: { label: T.m_vpn, v: r => mv(D(r).vpn), lo: 0, hi: 1.2, u: "MeV" },
    wig: { label: T.wig, v: r => mv(D(r).wig), lo: -0.4, hi: 0.4, u: "MeV", div: true },
    d3p: { label: "Δₚ⁽³⁾", v: r => mv(D(r).d3p), lo: 0, hi: 2.5, u: "MeV" },
    d5n: { label: "Δₙ⁽⁵⁾", v: r => mv(D(r).d5n), lo: 0, hi: 2.5, u: "MeV" },
    d5p: { label: "Δₚ⁽⁵⁾", v: r => mv(D(r).d5p), lo: 0, hi: 2.5, u: "MeV" },
    d3n: { label: T.m_d3n, v: r => mv(D(r).d3n), lo: 0, hi: 2.5, u: "MeV" },
    beta2: { label: T.m_beta2, need: true, v: r => { const v = MOD[modelKey()] && MOD[modelKey()].map.get(key(r[0], r[1])); return v ? v[1] / 1000 : null; }, lo: -0.3, hi: 0.4, div: true },
    dmod: { label: T.m_dmod, need: true, v: r => mv(dmod(r)), lo: -3, hi: 3, u: "MeV", div: true },
  };
  const FILTERS = {
    all: [T.fl_all, () => true], meas: [T.fl_meas, r => r[3] != null && !r[5]], extr: [T.fl_extr, r => !!r[5]],
    d1: ["δm < 1 keV", r => r[4] != null && !r[5] && r[4] < 1], d10: ["δm < 10 keV", r => r[4] != null && !r[5] && r[4] < 10], d100: ["δm < 100 keV", r => r[4] != null && !r[5] && r[4] < 100],
    stable: [T.fl_stable, r => r[6] === 99], hl: [T.fl_hl, r => r[6] > -90 && r[6] !== 99], iso: [T.fl_iso, r => r[11].length > 0],
    magic: [T.fl_magic, r => MAGIC.includes(r[0]) || MAGIC.includes(r[1])], nz: ["N = Z", r => r[0] === r[1]],
    nz1: ["|N − Z| = 1", r => Math.abs(r[1] - r[0]) === 1], nz2: ["|N − Z| ≤ 2", r => Math.abs(r[1] - r[0]) <= 2], prich: ["N < Z", r => r[1] < r[0]],
    ee: ["Z even · N even", r => r[0] % 2 === 0 && r[1] % 2 === 0], eo: ["Z even · N odd", r => r[0] % 2 === 0 && r[1] % 2 === 1],
    oe: ["Z odd · N even", r => r[0] % 2 === 1 && r[1] % 2 === 0], oo: ["Z odd · N odd", r => r[0] % 2 === 1 && r[1] % 2 === 1],
    oddA: [T.fl_oddA || "odd A", r => (r[0] + r[1]) % 2 === 1], evenA: [T.fl_evenA || "even A", r => (r[0] + r[1]) % 2 === 0],
    p3: [T.fl_p3 || "3-point Δ⁽³⁾ available", r => derived(r).d3n != null], p5: [T.fl_p5 || "5-point Δ⁽⁵⁾ available", r => derived(r).d5n != null],
    unb: [T.fl_unb || "particle-unbound (Sₙ or Sₚ < 0)", r => { const d = derived(r); return (d.sn && d.sn.v < 0) || (d.sp && d.sp.v < 0); }],
    lowq: [T.fl_lowq || "Q(β) < 1 MeV", r => { const d = derived(r); return (d.qbm && d.qbm.v > 0 && d.qbm.v < 1000) || (d.qec && d.qec.v > 0 && d.qec.v < 1000); }],
  };
  const pass = r => r.mo ? filt === "all" : FILTERS[filt][1](r);
  const allRows = () => src === "ame" ? rows : rows.concat(extraRows);
  function colour(r) {
    const m = MODES[mode]; if (m.f) return m.f(r);
    const v = m.v(r); if (v == null) return "#e5e7eb";
    const x = (v - m.lo) / (m.hi - m.lo);
    if (m.div) { const t = Math.max(0, Math.min(1, x)), a = Math.abs(t - (0 - m.lo) / (m.hi - m.lo)) * 2; return t < (0 - m.lo) / (m.hi - m.lo) ? `hsl(220,80%,${96 - 50 * Math.min(1, a)}%)` : `hsl(0,80%,${96 - 50 * Math.min(1, a)}%)`; }
    return ramp(x);
  }
  function drawLegend() {
    const m = MODES[mode];
    if (mode === "decay") legend.innerHTML = [["stable", T.stable], ["bm", "β⁻"], ["bp", "β⁺/EC"], ["a", "α"], ["sf", "SF"], ["p", "p"], ["n", "n"], ["it", "IT"], ["punst", T.punst]].map(([k, l]) => `<span><i style="background:${DC[k]}"></i>${l}</span>`).join("");
    else if (mode === "est") legend.innerHTML = `<span><i style="background:#0ea5e9"></i>${T.measured}</span><span><i style="background:#f59e0b"></i>${T.extrap}</span>`;
    else if (mode === "iso") legend.innerHTML = [0, 1, 2, 3].map(n => `<span><i style="background:${["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][n]}"></i>${n}${n === 3 ? "+" : ""}</span>`).join("");
    else if (mode === "eo") legend.innerHTML = [["#0ea5e9", "Z even · N even"], ["#f59e0b", "Z even · N odd"], ["#22c55e", "Z odd · N even"], ["#ef4444", "Z odd · N odd"]].map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
    else { const lo = m.range ? m.range[0] : m.rng ? m.rng[0] : m.lo, hi = m.range ? m.range[1] : m.rng ? m.rng[1] : m.hi; legend.innerHTML = `<span>${lo}</span><span class="nc-ramp${m.div ? " nc-ramp-div" : ""}"></span><span>${hi} ${m.u || ""}</span>` + (m.need || src !== "ame" ? `<span class="nc-mnote">${MOD[modelKey()] ? MOD[modelKey()].name : ""}</span>` : ""); }
  }

  /* ---------- drawing (any context / scale, for high-res export) ---------- */
  function draw(c = g, Wd = cv._cw, Hd = cv._ch, sc = 1) {
    if (c === g) g.setTransform(cv.width / cv._cw, 0, 0, cv.height / cv._ch, 0, 0);
    const v = { s: view.s * sc, x: view.x * sc, y: view.y * sc }, s = v.s;
    const P = (Z, N) => [v.x + N * s, Hd - v.y - (Z + 1) * s];
    c.clearRect(0, 0, Wd, Hd);
    if (sc > 1) { c.fillStyle = "#ffffff"; c.fillRect(0, 0, Wd, Hd); }
    c.strokeStyle = "rgba(127,127,160,.35)"; c.lineWidth = sc;
    const optOn = n => !ovl || !ovl.querySelector(`[data-opt=${n}]`) || ovl.querySelector(`[data-opt=${n}]`).checked;
    if (optOn("magic")) MAGIC.forEach(m => {
      const [x] = P(0, m); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, Hd); c.moveTo(x + s, 0); c.lineTo(x + s, Hd); c.stroke();
      if (m <= 120) { const [, y] = P(m, 0); c.beginPath(); c.moveTo(0, y); c.lineTo(Wd, y); c.moveTo(0, y + s); c.lineTo(Wd, y + s); c.stroke(); }
    });
    if (optOn("nz")) { c.save(); c.strokeStyle = "rgba(142,78,198,.75)"; c.lineWidth = 1.6 * sc; c.setLineDash([5 * sc, 5 * sc]); const a = P(0, 0), b = P(120, 120); c.beginPath(); c.moveTo(a[0], a[1] + s); c.lineTo(b[0] + s, b[1]); c.stroke(); c.restore(); }
    const big = s >= 26 * sc, mid = s >= 14 * sc;
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const r of allRows()) {
      const [x, y] = P(r[0], r[1]);
      if (x < -s || y < -s || x > Wd || y > Hd) continue;
      const ok = pass(r); c.globalAlpha = ok ? (r.mo ? 0.5 : 1) : 0.1;
      c.fillStyle = r.mo && (mode === "decay" || MODES[mode].f) ? "#cbd5e1" : colour(r); c.fillRect(x, y, s - (s > 3 ? sc : 0.3), s - (s > 3 ? sc : 0.3));
      if (mid && ok) {
        const dark = r[6] === 99 || ["bm", "sf", "n"].includes(decayClass(r)) && mode === "decay";
        c.fillStyle = dark ? "#fff" : "#111";
        c.font = `${Math.min(14 * sc, s * 0.28)}px system-ui`;
        c.fillText(sup(r[0] + r[1]) + r[2] + (r[5] ? "#" : "") + (r.mo ? "*" : ""), x + s / 2, y + s * (big ? 0.32 : 0.5));
        if (big && !r.mo) { c.font = `${Math.min(11 * sc, s * 0.2)}px system-ui`; c.fillText(r[7].replace("stable", "★"), x + s / 2, y + s * 0.68); }
      }
    }
    c.globalAlpha = 1;
    drawOverlays(c, v, Hd, sc);
    [[hover, ink], [pin, "#e5484d"]].forEach(([r, col]) => { if (!r || sc > 1 && r === hover) return; const [x, y] = P(r[0], r[1]); c.strokeStyle = col; c.lineWidth = 2 * sc; c.strokeRect(x - sc, y - sc, s + sc, s + sc); });
    c.fillStyle = ink; c.font = `${12 * sc}px system-ui`; c.textAlign = "left"; c.fillText("N →", Wd - 36 * sc, Hd - 8 * sc); c.fillText("Z ↑", 6 * sc, 14 * sc);
    if (sc > 1) { c.font = `${10 * sc}px system-ui`; c.textAlign = "right"; c.fillStyle = "#555"; c.fillText("AME2020 / NUBASE2020 · gezhuang0717.github.io", Wd - 8 * sc, 12 * sc); }
  }
  /* ---------- theory masses, drip lines and process paths ---------- */
  const DRIP = { sn: ["#2563eb", [6, 4]], s2n: ["#1e3a8a", []], sp: ["#ef4444", [6, 4]], s2p: ["#991b1b", []] };
  const dripCache = new Map();
  function dripLine(q) {          /* returns [[Z, N_last_bound], …] (n-type) or [[N, Z_last_bound], …] (p-type) */
    const ck = src + q; if (dripCache.has(ck)) return dripCache.get(ck);
    const nType = q === "sn" || q === "s2n", set = src === "ame" ? rows.map(r => [r[0], r[1]]) : [...MOD[src].map.keys()].map(k => [Math.floor(k / 1000), k % 1000]);
    const by = new Map(); set.forEach(([Z, N]) => { const i = nType ? Z : N, j = nType ? N : Z; (by.get(i) || by.set(i, []).get(i)).push(j); });
    const out = [];
    [...by.keys()].sort((a, b) => a - b).forEach(i => {
      const js = by.get(i).sort((a, b) => a - b), val = j => { const d = nType ? derivedZN(i, j, src) : derivedZN(j, i, src); return d[q] ? d[q].v : null; };
      let last = null, unbound = false;
      js.forEach(j => { const v = val(j); if (v == null) return; if (v > 0) { last = j; unbound = false; } else if (last != null) unbound = true; });
      /* AME: only where an unbound nucleus is actually known; models: the table edge is the predicted drip line */
      const anyUnbound = js.some(j => last != null && j > last && (val(j) ?? 1) <= 0);
      if (last != null && (src !== "ame" || anyUnbound)) out.push([i, last]);
    });
    dripCache.set(ck, out); return out;
  }
  function drawOverlays(c, v, Hd, sc) {
    if (!ovl) return; const s = v.s, xN = N => v.x + N * s, yZ = Z => Hd - v.y - Z * s;
    ovl.querySelectorAll("input[data-drip]:checked").forEach(cb => {
      const q = cb.dataset.drip; if (src !== "ame" && !MOD[src]) return;
      const [col, dash] = DRIP[q], pts = dripLine(q), nType = q === "sn" || q === "s2n";
      c.strokeStyle = col; c.lineWidth = 2.4 * sc; c.setLineDash(dash.map(d => d * sc)); c.beginPath();
      let prev = null;
      pts.forEach(([i, j]) => {
        if (nType) { const x = xN(j + 1); if (prev && prev[0] === i - 1) c.lineTo(x, yZ(i)); else c.moveTo(x, yZ(i)); c.lineTo(x, yZ(i + 1)); }
        else { const y = yZ(j + 1); if (prev && prev[0] === i - 1) c.lineTo(xN(i), y); else c.moveTo(xN(i), y); c.lineTo(xN(i + 1), y); }
        prev = [i, j];
      });
      c.stroke(); c.setLineDash([]);
    });
    ovl.querySelectorAll("input[data-path]:checked").forEach(cb => {
      const P = PATHS[cb.dataset.path]; if (!P) return; const col = cb.dataset.path === "r" ? "#d97706" : "#db2777";
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.5 * sc; c.globalAlpha = 0.85;
      P.pts.forEach(([Z, N]) => { c.beginPath(); c.arc(xN(N + 0.5), yZ(Z + 0.5), Math.max(1.6 * sc, s * 0.22), 0, 6.283); c.fill(); });
      c.globalAlpha = 1;
    });
  }
  function loadModels() {
    if (modelsLoading) return modelsLoading;
    modelsLoading = fetch(root.dataset.models).then(r => r.json()).then(d => {
      Object.entries(d.models).forEach(([k, m]) => { const map = new Map(); m.rows.forEach(([Z, N, me, b2]) => map.set(key(Z, N), [me, b2])); MOD[k] = { name: m.name, ref: m.ref, url: m.url, map }; });
      PATHS = d.paths; memo.clear(); dripCache.clear();
    });
    return modelsLoading;
  }
  function setSource(s) {
    const go = () => {
      src = s; memo.clear(); dripCache.clear();
      extraRows = s === "ame" ? [] : [...MOD[s].map.keys()].filter(k => !M.has(k)).map(k => { const Z = Math.floor(k / 1000), N = k % 1000, el = EL.find(e => e[0] === Z);
        const r = [Z, N, el ? el[1] : "Z" + Z, null, null, 0, -97, "—", "", null, "", []]; r.mo = true; return r; });
      root.querySelector(".nc-mref").innerHTML = s === "ame" ? "" : `${T.modnote} <a href="${MOD[s].url}" target="_blank" rel="noopener">${MOD[s].ref}</a>`;
      drawLegend(); draw(); plotChain(); if (pin) showCard(pin);
    };
    s === "ame" ? go() : loadModels().then(go);
  }

  const W = () => cv._cw, H = () => cv._ch;
  function fit() { const s = Math.min(W() / 182, H() / 122); view = { s, x: (W() - 180 * s) / 2, y: (H() - 120 * s) / 2 }; draw(); }
  function zoomTo(r, s = 34, done) {
    const wide = cv.getBoundingClientRect().width > 640, cxp = wide ? W() * 0.3 : W() / 2;
    const target = { s, x: cxp - (r[1] + 0.5) * s, y: H() / 2 - (r[0] + 0.5) * s }, start = { ...view }, t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = now => { const k = Math.min(1, (now - t0) / 600), e = k * k * (3 - 2 * k); view = { s: start.s + (target.s - start.s) * e, x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e }; draw(); if (k < 1) anim = requestAnimationFrame(step); else done && done(); };
    anim = requestAnimationFrame(step);
  }
  function at(ev) {
    const b = cv.getBoundingClientRect(), x = (ev.clientX - b.left) * W() / b.width, y = (ev.clientY - b.top) * H() / b.height;
    const k = key(Math.floor((H() - view.y - y) / view.s), Math.floor((x - view.x) / view.s));
    return M.get(k) || (src !== "ame" && extraRows.find(r => key(r[0], r[1]) === k)) || null;
  }

  /* ---------- formatting: uncertainty with 2 significant digits, value rounded to the same decimal ---------- */
  function niceTicks(a, b, n = 6) {
    const span = b - a; if (!(span > 0)) return [a]; const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9 * span; v += step) out.push(+v.toFixed(12)); return out;
  }
  const fmtTick = v => { const a = Math.abs(v); return a === 0 ? "0" : a >= 1e4 || a < 1e-3 ? v.toExponential(1) : String(+v.toPrecision(5)); };
  function fmtU(v, e) {           /* → [value string, uncertainty string] */
    if (!(e > 0)) { const d = Math.abs(v) >= 100 ? 1 : 3; return [v.toFixed(d), "0"]; }
    const dec = Math.max(0, 1 - Math.floor(Math.log10(e)));
    return [v.toFixed(dec), e.toFixed(dec)];
  }
  const fv = (o, d = 3, f = 1000, u = " MeV") => { if (o == null) return "—"; const h = o.est ? "#" : "";
    if (!(o.e > 0)) return `${(o.v / f).toFixed(d)}${h}${u}`;
    const [a, b] = fmtU(o.v / f, o.e / f); return `${a}${h} ± ${b}${h}${u}`; };
  const DM = { "B-": "β⁻", "B+": "β⁺", "EC": "EC", "A": "α", "IT": "IT", "SF": "SF", "p": "p", "2p": "2p", "n": "n", "2n": "2n", "B-n": "β⁻n", "B-2n": "β⁻2n", "B+p": "β⁺p", "e+": "e⁺", "2B-": "2β⁻", "2B+": "2β⁺", "IS": T.abund };
  const decayText = b => !b ? "—" : b.split(";").map(x => {
    const m = x.trim().match(/^([A-Za-z0-9+\-]+)(.*)$/); if (!m) return x;
    const rest = m[2].trim().replace(/^([=~<>?]*\s*[\d.]+(?:[eE][-+]?\d+)?)\s+\d+$/, "$1");
    return (DM[m[1]] || m[1]) + (rest ? " " + rest.replace(/^=/, "= ") + (/\d/.test(rest) ? " %" : "") : "");
  }).join(" · ");
  function facts(r, d) {
    const [Z, N] = r, out = [];
    if (MAGIC.includes(Z) && MAGIC.includes(N)) out.push(T.f_dmagic); else if (MAGIC.includes(Z) || MAGIC.includes(N)) out.push(T.f_magic.replace("{k}", MAGIC.includes(Z) ? "Z = " + Z : "N = " + N));
    if (Z === N) out.push(T.f_nz);
    if (M.get(key(N, Z)) && Z !== N) out.push(T.f_mirror.replace("{m}", sup(Z + N) + M.get(key(N, Z))[2]));
    const iso = rows.filter(x => x[0] === Z), lo = Math.min(...iso.map(x => x[1])), hi = Math.max(...iso.map(x => x[1]));
    if (N === lo) out.push(T.f_light); if (N === hi) out.push(T.f_heavy);
    if (d.sn && d.sn.v < 0) out.push(T.f_nunb); if (d.sp && d.sp.v < 0) out.push(T.f_punb);
    if (r[9]) out.push(T.f_year.replace("{y}", r[9]).replace("{n}", new Date().getFullYear() - r[9]));
    if (d.BE && d.A > 1) out.push(T.f_be.replace("{e}", (d.BE.v / 1000).toFixed(1)).replace("{p}", (d.BE.v / (d.A * 931494.1) * 100).toFixed(2)));
    if (r[6] !== 99 && r[6] > -90) { const f = 100 * Math.pow(0.5, 86400 / Math.pow(10, r[6]));
      out.push(T.f_left.replace("{p}", f >= 99.995 ? "≈ 100" : f >= 0.01 ? f.toFixed(2) : f > 1e-300 ? f.toExponential(1).replace(/e([+-]\d+)/, (_, x) => " × 10" + String(+x).replace(/-/, "⁻").replace(/\d/g, d => SUP[d])) : "≈ 0")); }
    return out;
  }
  function showCard(r) {
    if (!r) { card.hidden = true; return; }
    const d = derived(r), dm = src !== "ame" && MOD[src] ? derivedZN(r[0], r[1], src) : null, A = r[0] + r[1], el = EL.find(e => e[0] === r[0]), row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    card.hidden = false;
    card.innerHTML = `<button type="button" class="nc-close" aria-label="close">×</button>
      <div class="nc-head"><span class="nc-sym">${sup(A)}${r[2]}</span><span>${el ? el[2] : ""}<br><small>Z = ${r[0]} · N = ${r[1]} · A = ${A}</small></span></div>
      <table>${row(T.hl, r[7] === "stable" ? T.stable : r[7])}${row("Jπ", r[8] || "—")}${row(T.decay, decayText(r[10]))}
      ${row(T.me, d.me ? (() => { const [a, b] = fmtU(d.me.v, d.me.e), h = d.me.est ? "#" : ""; return `${a}${h} ± ${b}${h} keV`; })() : "—")}
      ${row("B/A", fv(d.BEA, 4))}${row("Sₙ", fv(d.sn))}${row("S₂ₙ", fv(d.s2n))}${row("Sₚ", fv(d.sp))}${row("S₂ₚ", fv(d.s2p))}
      ${row("Q(β⁻)", fv(d.qbm))}${row("Q(EC)", fv(d.qec))}${row("Q(α)", fv(d.qa))}${row("δ₂ₙ", fv(d.d2n))}
      ${row("Δₙ⁽³⁾ · Δₚ⁽³⁾", fv(d.d3n) + "<br>" + fv(d.d3p))}${row("δV<sub>pn</sub>", fv(d.vpn))}${row(T.wig, fv(d.wig))}
      ${dm ? `<tr class="nc-mrow"><th colspan="2">${MOD[src].name}</th></tr>${row(T.me, dm.me ? (dm.me.v / 1000).toFixed(3) + " MeV" : "—")}${row("ME(AME) − ME(" + T.model_short + ")", d.me && dm.me ? ((d.me.v - dm.me.v) / 1000).toFixed(3) + " MeV" : "—")}${row("Sₙ · S₂ₙ", fv(dm.sn, 3).replace(/ ± 0\.000/, "") + " · " + fv(dm.s2n, 3).replace(/ ± 0\.000/, ""))}${row("Sₚ · S₂ₚ", fv(dm.sp, 3).replace(/ ± 0\.000/, "") + " · " + fv(dm.s2p, 3).replace(/ ± 0\.000/, ""))}${row("β₂", dm.beta2 ? (dm.beta2.v / 1000).toFixed(3) : "—")}` : ""}
      ${row(T.disc, r[9] || "—")}
      ${r[11].length ? row(T.isomers, r[11].map(i => `${sup(A)}${i[0]}${r[2]}: ${i[1] == null ? "?" : i[1].toLocaleString()} keV, ${i[2] || "?"}, ${i[3] || ""}`).join("<br>")) : ""}</table>
      <div class="nc-cbtn"><button type="button" class="zg-btn" data-ch="Z">${T.p_iso}</button><button type="button" class="zg-btn" data-ch="N">${T.p_isot}</button><button type="button" class="zg-btn" data-ch="A">${T.p_isob}</button></div>
      <ul class="nc-facts">${facts(r, d).map(x => "<li>" + x + "</li>").join("")}</ul>
      <p class="nc-src"># ${T.hashnote} · ${T.errnote}<br>AME2020 · NUBASE2020 (Chin. Phys. C 45, 030001–030003, 2021)</p>`;
    card.querySelector(".nc-close").onclick = () => { pin = null; showCard(null); draw(); };
    card.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => { pchain.value = b.dataset.ch; plotChain(r); pc.scrollIntoView({ behavior: "smooth", block: "center" }); });
  }

  /* ---------- chain plot with error bars ---------- */
  const PQ = {
    me: [T.m_me, d => d.me, "MeV"], bea: [T.m_bea, d => d.BEA, "MeV"], sn: ["Sₙ", d => d.sn, "MeV"], s2n: ["S₂ₙ", d => d.s2n, "MeV"],
    sp: ["Sₚ", d => d.sp, "MeV"], s2p: ["S₂ₚ", d => d.s2p, "MeV"], qbm: ["Q(β⁻)", d => d.qbm, "MeV"], qec: ["Q(EC)", d => d.qec, "MeV"],
    qa: ["Q(α)", d => d.qa, "MeV"], d2n: ["δ₂ₙ = S₂ₙ(N) − S₂ₙ(N+2)", d => d.d2n, "MeV"], dme: [T.m_dme, (d, r) => r[4] == null ? null : { v: r[4] * 1000, e: 0, est: !!r[5] }, "keV"],
    hl: ["log₁₀(T½ / s)", (d, r) => r[6] > -90 && r[6] !== 99 ? { v: r[6] * 1000, e: 0, est: false } : null, ""],
    d3n: ["Δₙ⁽³⁾ (pairing)", d => d.d3n, "MeV"], d3p: ["Δₚ⁽³⁾ (pairing)", d => d.d3p, "MeV"],
    d5n: ["Δₙ⁽⁵⁾ (pairing, 5-point)", d => d.d5n, "MeV"], d5p: ["Δₚ⁽⁵⁾ (pairing, 5-point)", d => d.d5p, "MeV"], d2p: ["δ₂ₚ = S₂ₚ(Z) − S₂ₚ(Z+2)", d => d.d2p, "MeV"],
    dmod: ["ME(AME) − ME(model)", (d, r) => dmod(r), "MeV"],
    vpn: ["δVpn", d => d.vpn, "MeV"], wig: ["W = δVpn − ½[δVpn(N±2)]", d => d.wig, "MeV"],
    beta2: ["β₂ (model)", d => d.beta2, ""],
  };
  pq.innerHTML = Object.entries(PQ).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("");
  pq.value = "s2n";
  function plotChain(r) {
    chain = r || chain; if (!chain) return;
    const ch = pchain.value, [Z, N] = chain, A = Z + N;
    const q = PQ[pq.value], rg = root.querySelector("[name=nc-range]"), on = rg && rg.checked, num = n => { const v = root.querySelector(`[name=${n}]`).value; return v === "" ? null : +v; };
    const own = ch === "Z" ? Z : ch === "N" ? N : A, cfrom = on && num("nc-c0") != null ? num("nc-c0") : own, cto = on && num("nc-c1") != null ? num("nc-c1") : cfrom;
    const xlo = on ? num("nc-x0") : null, xhi = on ? num("nc-x1") : null;
    plotPts = [];
    for (let c = Math.min(cfrom, cto); c <= Math.max(cfrom, cto) && c - Math.min(cfrom, cto) < 40; c++) {
      rows.filter(x => ch === "Z" ? x[0] === c : ch === "N" ? x[1] === c : x[0] + x[1] === c).forEach(x => {
        const v = q[1](derived(x), x), xv = ch === "Z" ? x[1] : x[0];
        if (v && (xlo == null || xv >= xlo) && (xhi == null || xv <= xhi)) plotPts.push({ r: x, x: xv, y: v.v / 1000, e: v.e / 1000, est: v.est, g: c });
      });
    }
    plotPts.sort((a, b) => a.g - b.g || a.x - b.x);
    plotPts.groups = [...new Set(plotPts.map(p => p.g))];
    /* model curve over the whole chain the model predicts (needs a model source, or β₂ which only models give) */
    const mk = src !== "ame" ? src : pq.value === "beta2" ? modelKey() : null;
    modPts = [];
    if (mk && MOD[mk] && plotPts.groups.length <= 1 && !["dme", "hl", "dmod"].includes(pq.value)) {
      const ks = [...MOD[mk].map.keys()].map(k => [Math.floor(k / 1000), k % 1000]).filter(([z, n]) => (ch === "Z" ? z === cfrom : ch === "N" ? n === cfrom : z + n === cfrom) && (xlo == null || (ch === "Z" ? n : z) >= xlo) && (xhi == null || (ch === "Z" ? n : z) <= xhi));
      modPts = ks.map(([z, n]) => { const v = q[1](derivedZN(z, n, mk), [z, n]); return v && { x: ch === "Z" ? n : z, y: v.v / 1000 }; }).filter(Boolean).sort((a, b) => a.x - b.x);
      modPts.name = MOD[mk].name;
    }
    const gs = plotPts.groups, multi = gs.length > 1, nm = ch === "Z" ? "Z" : ch === "N" ? "N" : "A";
    const lab = multi ? `${ch === "Z" ? T.p_iso : ch === "N" ? T.p_isot : T.p_isob}: ${nm} = ${gs[0]}–${gs[gs.length - 1]}` : ch === "Z" ? `${T.p_iso}: Z = ${Z} (${chain[2]})` : ch === "N" ? `${T.p_isot}: N = ${N}` : `${T.p_isob}: A = ${A}`;
    pinfo.textContent = `${lab} · ${q[0]} · ${plotPts.length} ${T.points}`;
    drawPlot();
  }
  function drawPlot(c = pg, Wd = pc._cw, Hd = pc._ch, sc = 1) {
    if (c === pg) pg.setTransform(pc.width / pc._cw, 0, 0, pc.height / pc._ch, 0, 0);
    c.clearRect(0, 0, Wd, Hd); c.fillStyle = sc > 1 ? "#fff" : "transparent"; if (sc > 1) c.fillRect(0, 0, Wd, Hd);
    if (!plotPts.length && !modPts.length) { c.fillStyle = "#888"; c.font = `${13 * sc}px system-ui`; c.fillText(T.p_hint, 20 * sc, 30 * sc); return; }
    const L = 62 * sc, R = 16 * sc, Tp = 18 * sc, B = 42 * sc, xs = plotPts.map(p => p.x).concat(modPts.map(p => p.x)), ys = plotPts.flatMap(p => [p.y - p.e, p.y + p.e]).concat(modPts.map(p => p.y));
    let x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.08 || 1; y0 -= pad; y1 += pad;
    const px = x => L + (x - x0) / (x1 - x0) * (Wd - L - R), py = y => Hd - B - (y - y0) / (y1 - y0) * (Hd - B - Tp);
    c.strokeStyle = "rgba(127,127,160,.45)"; c.lineWidth = sc; c.strokeRect(L, Tp, Wd - L - R, Hd - B - Tp);
    c.fillStyle = sc > 1 ? "#222" : ink; c.font = `${11 * sc}px system-ui`; c.textAlign = "center";
    niceTicks(x0, x1, 12).filter(x => Number.isInteger(x)).forEach(x => { c.fillText(x, px(x), Hd - B + 15 * sc); c.save(); c.strokeStyle = "rgba(127,127,160,.15)"; c.beginPath(); c.moveTo(px(x), Tp); c.lineTo(px(x), Hd - B); c.stroke(); c.restore(); });
    const ch = pchain.value; c.fillText(ch === "Z" ? "N" : "Z", (L + Wd - R) / 2, Hd - 8 * sc);
    c.textAlign = "right"; niceTicks(y0, y1, 6).forEach(y => { c.fillText(fmtTick(y), L - 6 * sc, py(y) + 4 * sc); c.save(); c.strokeStyle = "rgba(127,127,160,.15)"; c.beginPath(); c.moveTo(L, py(y)); c.lineTo(Wd - R, py(y)); c.stroke(); c.restore(); });
    c.save(); c.translate(14 * sc, (Tp + Hd - B) / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillText(`${PQ[pq.value][0]}${PQ[pq.value][2] ? " (" + PQ[pq.value][2] + ")" : ""}`, 0, 0); c.restore();
    c.strokeStyle = "rgba(229,72,77,.35)"; c.setLineDash([4 * sc, 4 * sc]);
    MAGIC.forEach(m => { if (m > x0 && m < x1) { c.beginPath(); c.moveTo(px(m), Tp); c.lineTo(px(m), Hd - B); c.stroke(); } }); c.setLineDash([]);
    if (modPts.length) {   /* theory curve: dashed green, gaps where the chain is interrupted */
      c.strokeStyle = "#16a34a"; c.lineWidth = 1.6 * sc; c.setLineDash([6 * sc, 4 * sc]); c.beginPath();
      modPts.forEach((p, i) => i && p.x - modPts[i - 1].x <= 2 ? c.lineTo(px(p.x), py(p.y)) : c.moveTo(px(p.x), py(p.y))); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#16a34a"; modPts.forEach(p => { c.beginPath(); c.arc(px(p.x), py(p.y), 1.8 * sc, 0, 6.283); c.fill(); });
      c.font = `${10.5 * sc}px system-ui`; c.textAlign = "left"; c.fillText(`– – ${modPts.name}`, L + 8 * sc, Tp + 30 * sc);
      c.strokeStyle = "rgba(127,127,160,.6)"; c.lineWidth = sc; c.beginPath(); c.moveTo(L, py(0)); c.lineTo(Wd - R, py(0)); if (y0 < 0 && y1 > 0) c.stroke();
    }
    const groups = plotPts.groups || [], multi = groups.length > 1, gcol = g => multi ? `hsl(${(groups.indexOf(g) / groups.length) * 300},75%,${sc > 1 ? 40 : 48}%)` : "#3b5bdb";
    const showLine = !root.querySelector("[name=nc-lines]") || root.querySelector("[name=nc-lines]").checked, showErr = !root.querySelector("[name=nc-err]") || root.querySelector("[name=nc-err]").checked;
    if (showLine) groups.forEach(gk => { const ps = plotPts.filter(p => p.g === gk); c.strokeStyle = multi ? gcol(gk) : "rgba(139,108,255,.55)"; c.lineWidth = 1.2 * sc; c.beginPath();
      ps.forEach((p, i) => i && p.x - ps[i - 1].x <= 2 ? c.lineTo(px(p.x), py(p.y)) : c.moveTo(px(p.x), py(p.y))); c.stroke();
      if (multi && ps.length) { const l = ps[ps.length - 1]; c.fillStyle = gcol(gk); c.font = `${10 * sc}px system-ui`; c.textAlign = "left"; c.fillText((pchain.value === "Z" ? (EL.find(e => e[0] === gk) || [0, "Z" + gk])[1] : (pchain.value === "N" ? "N=" : "A=") + gk), px(l.x) + 5 * sc, py(l.y) + 3 * sc); } });
    plotPts.forEach(p => {
      const xx = px(p.x), col = multi ? gcol(p.g) : p.est ? "#f59e0b" : "#3b5bdb";
      c.strokeStyle = col; c.lineWidth = 1.3 * sc;
      if (showErr && p.e > 0) { c.beginPath(); c.moveTo(xx, py(p.y - p.e)); c.lineTo(xx, py(p.y + p.e)); c.moveTo(xx - 3 * sc, py(p.y - p.e)); c.lineTo(xx + 3 * sc, py(p.y - p.e)); c.moveTo(xx - 3 * sc, py(p.y + p.e)); c.lineTo(xx + 3 * sc, py(p.y + p.e)); c.stroke(); }
      c.beginPath(); c.arc(xx, py(p.y), (multi ? 2.8 : 3.6) * sc, 0, 6.283);
      if (p.est) { c.fillStyle = sc > 1 ? "#fff" : "rgba(255,255,255,.9)"; c.fill(); c.stroke(); } else { c.fillStyle = col; c.fill(); }
      if (chain && p.r === chain) { c.strokeStyle = "#e5484d"; c.lineWidth = 2 * sc; c.beginPath(); c.arc(xx, py(p.y), 7 * sc, 0, 6.283); c.stroke(); }
    });
    c.textAlign = "left"; c.font = `${10.5 * sc}px system-ui`; c.fillStyle = "#3b5bdb"; c.fillText(`● ${T.measured}`, L + 8 * sc, Tp + 14 * sc); c.fillStyle = "#f59e0b"; c.fillText(`○ ${T.extrap}`, L + 90 * sc, Tp + 14 * sc);
    if (sc > 1) { c.fillStyle = "#555"; c.textAlign = "right"; c.fillText("AME2020 / NUBASE2020" + (modPts.length ? " · " + modPts.name : "") + " · gezhuang0717.github.io", Wd - R - 4 * sc, Tp + 14 * sc); }
    if (plotHover && sc === 1) { const p = plotHover; c.fillStyle = ink; c.textAlign = "left"; c.font = `${12}px system-ui`; c.fillText(`${sup(p.r[0] + p.r[1])}${p.r[2]}: ${(([a, b]) => p.e > 0 ? a + (p.est ? "#" : "") + " ± " + b : a)(fmtU(p.y, p.e))}`, Math.min(px(p.x) + 8, Wd - 220), Math.max(py(p.y) - 10, 30)); }
  }
  pc.addEventListener("mousemove", e => {
    if (!plotPts.length) return; const b = pc.getBoundingClientRect(), x = (e.clientX - b.left) * pc._cw / b.width;
    const L = 62, R = 16, xs = plotPts.map(p => p.x), x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, xv = x0 + (x - L) / (pc._cw - L - R) * (x1 - x0);
    plotHover = plotPts.reduce((a, p) => Math.abs(p.x - xv) < Math.abs(a.x - xv) ? p : a, plotPts[0]); drawPlot();
  });
  pc.addEventListener("click", () => { if (plotHover) { pin = plotHover.r; zoomTo(pin); showCard(pin); } });
  pq.onchange = () => { if (["beta2", "dmod"].includes(pq.value) && !Object.keys(MOD).length) loadModels().then(() => plotChain()); plotChain(); };
  root.querySelectorAll(".nc-prange input, [name=nc-lines], [name=nc-err]").forEach(el => el.addEventListener("input", () => plotChain()));
  const rgb = root.querySelector("[name=nc-range]"); if (rgb) rgb.addEventListener("change", () => { root.querySelector(".nc-prange-in").hidden = !rgb.checked;
    if (rgb.checked && chain) { const ch = pchain.value, own = ch === "Z" ? chain[0] : ch === "N" ? chain[1] : chain[0] + chain[1], set = (n, v) => { const el = root.querySelector(`[name=${n}]`); if (el.value === "") el.value = v; };
      set("nc-c0", own); set("nc-c1", own); } plotChain(); });
  pchain.onchange = () => plotChain();

  /* ---------- periodic table (mulberry) ---------- */
  function ptPos(Z) {
    if (Z === 1) return [1, 1]; if (Z === 2) return [1, 18];
    if (Z <= 10) return [2, Z <= 4 ? Z - 2 : Z + 8]; if (Z <= 18) return [3, Z <= 12 ? Z - 10 : Z];
    if (Z <= 36) return [4, Z - 18]; if (Z <= 54) return [5, Z - 36];
    if (Z >= 57 && Z <= 71) return [9, Z - 54]; if (Z >= 89 && Z <= 103) return [10, Z - 86];
    if (Z <= 86) return [6, Z <= 56 ? Z - 54 : Z - 68]; return [7, Z <= 88 ? Z - 86 : Z - 100];
  }
  function buildPT() {
    const count = {}; rows.forEach(r => { count[r[0]] = (count[r[0]] || 0) + 1; }); const max = Math.max(...Object.values(count));
    ptab.innerHTML = EL.map(([Z, s, n]) => { const [p, gc] = ptPos(Z), c = count[Z] || 0; return `<button type="button" style="grid-row:${p};grid-column:${gc};--k:${(c / max).toFixed(2)}" data-z="${Z}" title="${n} — ${c} ${T.known}"><small>${Z}</small><b>${s}</b><i>${c}</i></button>`; }).join("")
      + `<span class="nc-pt-note" style="grid-row:8;grid-column:3/19">${T.ptnote}</span>`;
    ptab.addEventListener("click", e => {
      const b = e.target.closest("[data-z]"); if (!b) return;
      const Z = +b.dataset.z, iso = rows.filter(r => r[0] === Z), st = iso.find(r => r[6] === 99) || iso[Math.floor(iso.length / 2)];
      if (st) { pin = st; zoomTo(st, 22); showCard(st); pchain.value = "Z"; plotChain(st); cv.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  /* ---------- exports ---------- */
  const csvRow = r => { const d = derived(r), f = o => o ? [(o.v / 1000).toFixed(6), (o.e / 1000).toFixed(6), o.est ? "#" : ""] : ["", "", ""];
    const m = src !== "ame" && MOD[src] ? MOD[src].map.get(key(r[0], r[1])) : null;
    return [r[0], r[1], r[0] + r[1], r[2], d.me ? d.me.v : "", d.me ? d.me.e : "", r[5] ? "#" : "", ...f(d.BEA), ...f(d.sn), ...f(d.s2n), ...f(d.sp), ...f(d.s2p), ...f(d.qbm), ...f(d.qec), ...f(d.qa), ...f(d.d3n), ...f(d.d3p), ...f(d.vpn), r[7], r[8], r[10], r[9] || "", r[11].length, ...(src !== "ame" ? [m ? m[0] : "", m ? m[1] / 1000 : ""] : [])]; };
  const csvHead = () => ["Z", "N", "A", "El", "ME_keV", "dME_keV", "ME_flag", ...["BE/A", "Sn", "S2n", "Sp", "S2p", "Qbeta-", "QEC", "Qalpha", "D3n", "D3p", "dVpn"].flatMap(k => [k + "_MeV", "d" + k + "_MeV", k + "_flag"]), "T1/2", "Jpi", "decay_modes", "discovery_year", "isomers", ...(src !== "ame" ? ["ME_keV_" + src, "beta2_" + src] : [])];
  root.querySelector("[data-nc=png]").onclick = () => X.png(sc => { const o = document.createElement("canvas"); o.width = W() * sc; o.height = H() * sc; draw(o.getContext("2d"), o.width, o.height, sc); return o; }, "chart-of-nuclides", 6);
  root.querySelector("[data-nc=csv]").onclick = () => X.csv(csvHead(), rows.filter(pass).map(csvRow), "ame2020-nubase2020" + (filt === "all" ? "" : "-" + filt) + (src === "ame" ? "" : "-with-" + src));
  root.querySelector("[data-nc=video]").onclick = e => {
    const b = e.currentTarget, tour = [rows.find(r => r[0] === 50 && r[1] === 50), rows.find(r => r[0] === 55 && r[1] === 78), rows.find(r => r[0] === 82 && r[1] === 126)].filter(Boolean);
    const keep = [cv._cw, cv._ch], hi = () => { cv.width = Math.round(cv._cw * 3); cv.height = Math.round(cv._ch * 3); draw(); };
    hi();   /* record the tour at 3× the displayed size */
    X.record(cv, 9, "chart-of-nuclides-tour", on => { b.disabled = on; b.classList.toggle("is-rec", on); if (!on) { sizeCanvas(cv, keep[0], keep[1]); draw(); } });
    fit(); let i = 0; const next = () => { if (i < tour.length) { const r = tour[i++]; pin = r; zoomTo(r, 30, () => setTimeout(next, 900)); } else setTimeout(fit, 400); }; setTimeout(next, 600);
  };
  root.querySelector("[data-nc=ppng]").onclick = () => X.png(sc => { const o = document.createElement("canvas"); o.width = pc._cw * sc; o.height = pc._ch * sc; drawPlot(o.getContext("2d"), o.width, o.height, sc); return o; }, "chain-" + pq.value, 6);
  root.querySelector("[data-nc=pcsv]").onclick = () => {
    if ((plotPts.groups || []).length > 1) return X.csv(["chain (" + pchain.value + ")", "Z", "N", "A", "El", PQ[pq.value][0] + " (" + (PQ[pq.value][2] || "-") + ")", "uncertainty", "flag"],
      plotPts.map(p => [p.g, p.r[0], p.r[1], p.r[0] + p.r[1], p.r[2], p.y.toFixed(6), p.e.toFixed(6), p.est ? "#" : ""]), "chains-" + pq.value);
    const mm = new Map(modPts.map(p => [p.x, p.y])), xsAll = [...new Set(plotPts.map(p => p.x).concat(modPts.map(p => p.x)))].sort((a, b) => a - b), pm = new Map(plotPts.map(p => [p.x, p]));
    X.csv(["x (" + (pchain.value === "Z" ? "N" : "Z") + ")", "El", PQ[pq.value][0] + " AME2020 (" + (PQ[pq.value][2] || "-") + ")", "uncertainty", "flag", ...(modPts.length ? [modPts.name] : [])],
      xsAll.map(x => { const p = pm.get(x); return [x, p ? p.r[2] : "", p ? p.y.toFixed(6) : "", p ? p.e.toFixed(6) : "", p && p.est ? "#" : "", ...(modPts.length ? [mm.has(x) ? mm.get(x).toFixed(6) : ""] : [])]; }), "chain-" + pq.value + (modPts.length ? "-" + modelKey() : ""));
  };

  /* ---------- events ---------- */
  let drag = null, moved = false;
  cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, view.x, view.y]; moved = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    if (drag) { const b = cv.getBoundingClientRect(), k = W() / b.width, dx = (e.clientX - drag[0]) * k, dy = (e.clientY - drag[1]) * k; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; view.x = drag[2] + dx; view.y = drag[3] - dy; draw(); return; }
    hover = at(e); draw();
  });
  cv.addEventListener("pointerup", e => { if (!moved) { const r = at(e); if (r) { pin = r; zoomTo(r, Math.max(34, view.s)); showCard(r); plotChain(r); } } drag = null; });
  cv.addEventListener("wheel", e => {
    e.preventDefault(); const b = cv.getBoundingClientRect(), mx = (e.clientX - b.left) * W() / b.width, my = (e.clientY - b.top) * H() / b.height;
    const s2 = Math.max(2, Math.min(80, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))), k = s2 / view.s;
    view.x = mx - (mx - view.x) * k; view.y = (H() - my) - ((H() - my) - view.y) * k; view.s = s2; draw();
  }, { passive: false });
  const zoomBy = f => { const cx = W() / 2, cy = H() / 2, s2 = Math.max(2, Math.min(80, view.s * f)), k = s2 / view.s; view.x = cx - (cx - view.x) * k; view.y = (H() - cy) - ((H() - cy) - view.y) * k; view.s = s2; draw(); };
  root.querySelector("[data-nc=in]").onclick = () => zoomBy(1.4);
  root.querySelector("[data-nc=out]").onclick = () => zoomBy(1 / 1.4);
  root.querySelector("[data-nc=fit]").onclick = () => { pin = null; showCard(null); fit(); };
  root.querySelector("[data-nc=random]").onclick = () => { const p = rows.filter(pass), r = p[Math.floor(Math.random() * p.length)]; pin = r; zoomTo(r); showCard(r); plotChain(r); };
  sel.innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join("");
  sel.onchange = () => { mode = sel.value; if (MODES[mode].need && !Object.keys(MOD).length) loadModels().then(() => { memo.clear(); drawLegend(); draw(); }); drawLegend(); draw(); };
  if (msel) msel.onchange = () => setSource(msel.value);
  if (ovl) ovl.addEventListener("change", e => { if (e.target.dataset.path && !Object.keys(PATHS).length) loadModels().then(draw); draw(); });
  fsel.innerHTML = Object.entries(FILTERS).map(([k, f]) => `<option value="${k}">${f[0]}</option>`).join("");
  fsel.onchange = () => { filt = fsel.value; draw(); root.querySelector(".nc-fcount").textContent = `${rows.filter(pass).length} ${T.nuclides}`; };
  search.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const q = search.value.trim().replace(/[\s\-]/g, ""), m1 = q.match(/^(\d+)([A-Za-z]{1,2})$/) || q.match(/^([A-Za-z]{1,2})(\d+)$/); if (!m1) return;
    const A = +(isNaN(m1[1]) ? m1[2] : m1[1]), sym = (isNaN(m1[1]) ? m1[1] : m1[2]).toLowerCase(), r = rows.find(x => x[2].toLowerCase() === sym && x[0] + x[1] === A);
    if (r) { pin = r; zoomTo(r); showCard(r); plotChain(r); } else { search.setCustomValidity(T.notfound); search.reportValidity(); setTimeout(() => search.setCustomValidity(""), 1500); }
  });
  /* canvases follow the browser window: width of the card, height limited to ~78 % of the window */
  const resize = () => {
    const w = Math.round(cv.getBoundingClientRect().width), h = Math.round(Math.min(w * 0.62, innerHeight * 0.78, 1100));
    if (w && (Math.abs(w - cv._cw) > 2 || Math.abs(h - cv._ch) > 2 || cv.width !== Math.round(w * DPR()))) { sizeCanvas(cv, w, h); fit(); }
    const pw = Math.round(pc.getBoundingClientRect().width), ph = Math.round(Math.min(pw * 0.5, innerHeight * 0.6, 700));
    if (pw && (Math.abs(pw - pc._cw) > 2 || Math.abs(ph - pc._ch) > 2 || pc.width !== Math.round(pw * DPR()))) { sizeCanvas(pc, pw, ph); drawPlot(); }
  };
  new ResizeObserver(resize).observe(cv); new ResizeObserver(resize).observe(pc); addEventListener("resize", resize);

  fetch(root.dataset.src).then(r => r.json()).then(d => {
    rows = d.rows; EL = d.elements; rows.forEach(r => M.set(key(r[0], r[1]), r));
    MEn = get(0, 1) || MEn; MEH = get(1, 0) || MEH; MEa = get(2, 2) || MEa;
    root.querySelector(".nc-count").textContent = `${rows.length} ${T.nuclides} · ${rows.reduce((a, r) => a + r[11].length, 0)} ${T.isomers}`;
    buildPT(); drawLegend(); fit(); fsel.onchange();
    const q = new URLSearchParams(location.search).get("nuclide");
    if (q) { search.value = q; search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); }
    else { const sn = rows.find(r => r[0] === 50 && r[1] === 50); pchain.value = "Z"; plotChain(sn); }
  }).catch(() => { card.hidden = false; card.textContent = "Chart data could not load."; });
})();
