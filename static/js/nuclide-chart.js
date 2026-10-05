/* Interactive chart of nuclides — AME2020 / NUBASE2020 (static/data/nubase2020.json).
   Chart: zoom (wheel, ＋/−), drag to pan, click a box → zoom in + info card (all values with uncertainties;
   "#" = extrapolated / from systematics, as in AME and NUBASE). Colour modes, mass filters, search,
   mulberry periodic table. Chain plots (isotopic / isotonic / isobaric) with error bars.
   Exports: high-resolution PNG, CSV with uncertainties, WebM video (zoom tour) — via static/js/zg-export.js.
   Labels: data-labels JSON (five languages) from layouts/_shortcodes/nuclide-chart.html. */
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
  let chain = null, plotPts = [], plotHover = null;
  const key = (Z, N) => Z * 1000 + N;
  const css = getComputedStyle(document.documentElement), ink = (css.getPropertyValue("--zg-ink") || "").trim() || "#1d2433";
  const X = window.zgExport;

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
  function derived(r) {
    const k = key(r[0], r[1]); if (memo.has(k)) return memo.get(k);
    const [Z, N] = r, A = Z + N, m = get(Z, N);
    const BE = comb([Z, MEH], [N, MEn], [-1, m]);
    const out = {
      A, me: m, BE, BEA: BE && A > 0 ? { v: BE.v / A, e: BE.e / A, est: BE.est } : null,
      sn: comb([1, get(Z, N - 1)], [1, MEn], [-1, m]), s2n: comb([1, get(Z, N - 2)], [2, MEn], [-1, m]),
      sp: comb([1, get(Z - 1, N)], [1, MEH], [-1, m]), s2p: comb([1, get(Z - 2, N)], [2, MEH], [-1, m]),
      qbm: comb([1, m], [-1, get(Z + 1, N - 1)]), qec: comb([1, m], [-1, get(Z - 1, N + 1)]), qa: comb([1, m], [-1, get(Z - 2, N - 2)], [-1, MEa]),
    };
    /* two-neutron shell gap δ2n = S2n(Z,N) − S2n(Z,N+2) */
    out.d2n = comb([1, get(Z, N - 2)], [-2, m], [1, get(Z, N + 2)]);   /* = ME(N−2) − 2·ME(N) + ME(N+2) */
    memo.set(k, out); return out;
  }
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
  const MODES = {
    decay: { label: T.m_decay, f: r => DC[decayClass(r)] },
    hl: { label: T.m_hl, f: r => r[6] === 99 ? "#111827" : r[6] <= -98 ? "#e2e8f0" : ramp((r[6] + 9) / 29), range: ["1 ns", "10²⁰ s"] },
    bea: { label: T.m_bea, v: r => mv(derived(r).BEA), lo: 7.0, hi: 8.8, u: "MeV" },
    me: { label: T.m_me, v: r => mv(derived(r).me), lo: -95, hi: 80, u: "MeV" },
    sn: { label: T.m_sn, v: r => mv(derived(r).sn), lo: 0, hi: 20, u: "MeV" },
    s2n: { label: T.m_s2n, v: r => mv(derived(r).s2n), lo: 0, hi: 35, u: "MeV" },
    sp: { label: T.m_sp, v: r => mv(derived(r).sp), lo: 0, hi: 20, u: "MeV" },
    qbm: { label: T.m_qb, v: r => mv(derived(r).qbm), lo: 0, hi: 20, u: "MeV" },
    qa: { label: T.m_qa, v: r => mv(derived(r).qa), lo: 0, hi: 10, u: "MeV" },
    dme: { label: T.m_dme, v: r => r[4] == null ? null : Math.log10(Math.max(r[4], 1e-4)), lo: -3, hi: 3, rng: ["0.001 keV", "1 MeV"] },
    est: { label: T.m_est, f: r => r[5] ? "#f59e0b" : "#0ea5e9" },
    year: { label: T.m_year, v: r => r[9], lo: 1900, hi: 2020 },
    iso: { label: T.m_iso, f: r => ["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][Math.min(3, r[11].length)] },
    eo: { label: T.m_eo, f: r => ["#0ea5e9", "#f59e0b", "#22c55e", "#ef4444"][(r[0] % 2) * 2 + (r[1] % 2)] },
  };
  const FILTERS = {
    all: [T.fl_all, () => true], meas: [T.fl_meas, r => r[3] != null && !r[5]], extr: [T.fl_extr, r => !!r[5]],
    d1: ["δm < 1 keV", r => r[4] != null && !r[5] && r[4] < 1], d10: ["δm < 10 keV", r => r[4] != null && !r[5] && r[4] < 10], d100: ["δm < 100 keV", r => r[4] != null && !r[5] && r[4] < 100],
    stable: [T.fl_stable, r => r[6] === 99], hl: [T.fl_hl, r => r[6] > -90 && r[6] !== 99], iso: [T.fl_iso, r => r[11].length > 0],
    magic: [T.fl_magic, r => MAGIC.includes(r[0]) || MAGIC.includes(r[1])], nz: ["N = Z", r => r[0] === r[1]],
  };
  const pass = r => FILTERS[filt][1](r);
  function colour(r) {
    const m = MODES[mode]; if (m.f) return m.f(r);
    const v = m.v(r); return v == null ? "#e5e7eb" : ramp((v - m.lo) / (m.hi - m.lo));
  }
  function drawLegend() {
    const m = MODES[mode];
    if (mode === "decay") legend.innerHTML = [["stable", T.stable], ["bm", "β⁻"], ["bp", "β⁺/EC"], ["a", "α"], ["sf", "SF"], ["p", "p"], ["n", "n"], ["it", "IT"], ["punst", T.punst]].map(([k, l]) => `<span><i style="background:${DC[k]}"></i>${l}</span>`).join("");
    else if (mode === "est") legend.innerHTML = `<span><i style="background:#0ea5e9"></i>${T.measured}</span><span><i style="background:#f59e0b"></i>${T.extrap}</span>`;
    else if (mode === "iso") legend.innerHTML = [0, 1, 2, 3].map(n => `<span><i style="background:${["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][n]}"></i>${n}${n === 3 ? "+" : ""}</span>`).join("");
    else if (mode === "eo") legend.innerHTML = [["#0ea5e9", "Z even · N even"], ["#f59e0b", "Z even · N odd"], ["#22c55e", "Z odd · N even"], ["#ef4444", "Z odd · N odd"]].map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
    else { const lo = m.range ? m.range[0] : m.rng ? m.rng[0] : m.lo, hi = m.range ? m.range[1] : m.rng ? m.rng[1] : m.hi; legend.innerHTML = `<span>${lo}</span><span class="nc-ramp"></span><span>${hi} ${m.u || ""}</span>`; }
  }

  /* ---------- drawing (any context / scale, for high-res export) ---------- */
  function draw(c = g, Wd = cv.width, Hd = cv.height, sc = 1) {
    const v = { s: view.s * sc, x: view.x * sc, y: view.y * sc }, s = v.s;
    const P = (Z, N) => [v.x + N * s, Hd - v.y - (Z + 1) * s];
    c.clearRect(0, 0, Wd, Hd);
    if (sc > 1) { c.fillStyle = "#ffffff"; c.fillRect(0, 0, Wd, Hd); }
    c.strokeStyle = "rgba(127,127,160,.35)"; c.lineWidth = sc;
    MAGIC.forEach(m => {
      const [x] = P(0, m); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, Hd); c.moveTo(x + s, 0); c.lineTo(x + s, Hd); c.stroke();
      if (m <= 120) { const [, y] = P(m, 0); c.beginPath(); c.moveTo(0, y); c.lineTo(Wd, y); c.moveTo(0, y + s); c.lineTo(Wd, y + s); c.stroke(); }
    });
    c.setLineDash([5 * sc, 5 * sc]); const a = P(0, 0), b = P(120, 120); c.beginPath(); c.moveTo(a[0], a[1] + s); c.lineTo(b[0] + s, b[1]); c.stroke(); c.setLineDash([]);
    const big = s >= 26 * sc, mid = s >= 14 * sc;
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const r of rows) {
      const [x, y] = P(r[0], r[1]);
      if (x < -s || y < -s || x > Wd || y > Hd) continue;
      const ok = pass(r); c.globalAlpha = ok ? 1 : 0.1;
      c.fillStyle = colour(r); c.fillRect(x, y, s - (s > 3 ? sc : 0.3), s - (s > 3 ? sc : 0.3));
      if (mid && ok) {
        const dark = r[6] === 99 || ["bm", "sf", "n"].includes(decayClass(r)) && mode === "decay";
        c.fillStyle = dark ? "#fff" : "#111";
        c.font = `${Math.min(14 * sc, s * 0.28)}px system-ui`;
        c.fillText(sup(r[0] + r[1]) + r[2] + (r[5] ? "#" : ""), x + s / 2, y + s * (big ? 0.32 : 0.5));
        if (big) { c.font = `${Math.min(11 * sc, s * 0.2)}px system-ui`; c.fillText(r[7].replace("stable", "★"), x + s / 2, y + s * 0.68); }
      }
    }
    c.globalAlpha = 1;
    [[hover, ink], [pin, "#e5484d"]].forEach(([r, col]) => { if (!r || sc > 1 && r === hover) return; const [x, y] = P(r[0], r[1]); c.strokeStyle = col; c.lineWidth = 2 * sc; c.strokeRect(x - sc, y - sc, s + sc, s + sc); });
    c.fillStyle = ink; c.font = `${12 * sc}px system-ui`; c.textAlign = "left"; c.fillText("N →", Wd - 36 * sc, Hd - 8 * sc); c.fillText("Z ↑", 6 * sc, 14 * sc);
    if (sc > 1) { c.font = `${10 * sc}px system-ui`; c.textAlign = "right"; c.fillStyle = "#555"; c.fillText("AME2020 / NUBASE2020 · gezhuang0717.github.io", Wd - 8 * sc, 12 * sc); }
  }
  const W = () => cv.width, H = () => cv.height;
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
    return M.get(key(Math.floor((H() - view.y - y) / view.s), Math.floor((x - view.x) / view.s))) || null;
  }

  /* ---------- formatting ---------- */
  const fv = (o, d = 3, f = 1000, u = " MeV") => o == null ? "—" : `${(o.v / f).toFixed(d)}${o.est ? "#" : ""} ± ${(o.e / f).toFixed(d)}${o.est ? "#" : ""}${u}`;
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
    if (r[6] !== 99 && r[6] > -90) out.push(T.f_left.replace("{p}", (100 * Math.pow(0.5, 86400 / Math.pow(10, r[6]))).toPrecision(3)));
    return out;
  }
  function showCard(r) {
    if (!r) { card.hidden = true; return; }
    const d = derived(r), A = r[0] + r[1], el = EL.find(e => e[0] === r[0]), row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    card.hidden = false;
    card.innerHTML = `<button type="button" class="nc-close" aria-label="close">×</button>
      <div class="nc-head"><span class="nc-sym">${sup(A)}${r[2]}</span><span>${el ? el[2] : ""}<br><small>Z = ${r[0]} · N = ${r[1]} · A = ${A}</small></span></div>
      <table>${row(T.hl, r[7] === "stable" ? T.stable : r[7])}${row("Jπ", r[8] || "—")}${row(T.decay, decayText(r[10]))}
      ${row(T.me, d.me ? `${d.me.v.toLocaleString(undefined, { maximumFractionDigits: 3 })}${d.me.est ? "#" : ""} ± ${d.me.e}${d.me.est ? "#" : ""} keV` : "—")}
      ${row("B/A", fv(d.BEA, 4))}${row("Sₙ", fv(d.sn))}${row("S₂ₙ", fv(d.s2n))}${row("Sₚ", fv(d.sp))}${row("S₂ₚ", fv(d.s2p))}
      ${row("Q(β⁻)", fv(d.qbm))}${row("Q(EC)", fv(d.qec))}${row("Q(α)", fv(d.qa))}${row("δ₂ₙ", fv(d.d2n))}${row(T.disc, r[9] || "—")}
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
  };
  pq.innerHTML = Object.entries(PQ).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("");
  pq.value = "s2n";
  function plotChain(r) {
    chain = r || chain; if (!chain) return;
    const ch = pchain.value, [Z, N] = chain, A = Z + N;
    const list = rows.filter(x => ch === "Z" ? x[0] === Z : ch === "N" ? x[1] === N : x[0] + x[1] === A);
    const q = PQ[pq.value];
    plotPts = list.map(x => { const v = q[1](derived(x), x); return v && { r: x, x: ch === "Z" ? x[1] : x[0], y: v.v / 1000, e: v.e / 1000, est: v.est }; }).filter(Boolean);
    const lab = ch === "Z" ? `${T.p_iso}: Z = ${Z} (${chain[2]})` : ch === "N" ? `${T.p_isot}: N = ${N}` : `${T.p_isob}: A = ${A}`;
    pinfo.textContent = `${lab} · ${q[0]} · ${plotPts.length} ${T.points}`;
    drawPlot();
  }
  function drawPlot(c = pg, Wd = pc.width, Hd = pc.height, sc = 1) {
    c.clearRect(0, 0, Wd, Hd); c.fillStyle = sc > 1 ? "#fff" : "transparent"; if (sc > 1) c.fillRect(0, 0, Wd, Hd);
    if (!plotPts.length) { c.fillStyle = "#888"; c.font = `${13 * sc}px system-ui`; c.fillText(T.p_hint, 20 * sc, 30 * sc); return; }
    const L = 62 * sc, R = 16 * sc, Tp = 18 * sc, B = 42 * sc, xs = plotPts.map(p => p.x), ys = plotPts.flatMap(p => [p.y - p.e, p.y + p.e]);
    let x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.08 || 1; y0 -= pad; y1 += pad;
    const px = x => L + (x - x0) / (x1 - x0) * (Wd - L - R), py = y => Hd - B - (y - y0) / (y1 - y0) * (Hd - B - Tp);
    c.strokeStyle = "rgba(127,127,160,.45)"; c.lineWidth = sc; c.strokeRect(L, Tp, Wd - L - R, Hd - B - Tp);
    c.fillStyle = sc > 1 ? "#222" : ink; c.font = `${11 * sc}px system-ui`; c.textAlign = "center";
    const step = Math.max(1, Math.ceil((x1 - x0) / 14));
    for (let x = Math.ceil(x0); x <= x1; x += step) { c.fillText(x, px(x), Hd - B + 15 * sc); }
    const ch = pchain.value; c.fillText(ch === "Z" ? "N" : "Z", (L + Wd - R) / 2, Hd - 8 * sc);
    c.textAlign = "right"; for (let i = 0; i <= 5; i++) { const y = y0 + (y1 - y0) * i / 5; c.fillText(y.toFixed(Math.abs(y1 - y0) < 5 ? 2 : 1), L - 6 * sc, py(y) + 4 * sc); }
    c.save(); c.translate(14 * sc, (Tp + Hd - B) / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillText(`${PQ[pq.value][0]}${PQ[pq.value][2] ? " (" + PQ[pq.value][2] + ")" : ""}`, 0, 0); c.restore();
    c.strokeStyle = "rgba(229,72,77,.35)"; c.setLineDash([4 * sc, 4 * sc]);
    MAGIC.forEach(m => { if (m > x0 && m < x1) { c.beginPath(); c.moveTo(px(m), Tp); c.lineTo(px(m), Hd - B); c.stroke(); } }); c.setLineDash([]);
    c.strokeStyle = "rgba(139,108,255,.55)"; c.lineWidth = 1.2 * sc; c.beginPath();
    plotPts.forEach((p, i) => i ? c.lineTo(px(p.x), py(p.y)) : c.moveTo(px(p.x), py(p.y))); c.stroke();
    plotPts.forEach(p => {
      const xx = px(p.x), col = p.est ? "#f59e0b" : "#3b5bdb";
      c.strokeStyle = col; c.lineWidth = 1.3 * sc;
      if (p.e > 0) { c.beginPath(); c.moveTo(xx, py(p.y - p.e)); c.lineTo(xx, py(p.y + p.e)); c.moveTo(xx - 3 * sc, py(p.y - p.e)); c.lineTo(xx + 3 * sc, py(p.y - p.e)); c.moveTo(xx - 3 * sc, py(p.y + p.e)); c.lineTo(xx + 3 * sc, py(p.y + p.e)); c.stroke(); }
      c.beginPath(); c.arc(xx, py(p.y), 3.6 * sc, 0, 6.283);
      if (p.est) { c.fillStyle = sc > 1 ? "#fff" : "rgba(255,255,255,.9)"; c.fill(); c.stroke(); } else { c.fillStyle = col; c.fill(); }
      if (chain && p.r === chain) { c.strokeStyle = "#e5484d"; c.lineWidth = 2 * sc; c.beginPath(); c.arc(xx, py(p.y), 7 * sc, 0, 6.283); c.stroke(); }
    });
    c.textAlign = "left"; c.font = `${10.5 * sc}px system-ui`; c.fillStyle = "#3b5bdb"; c.fillText(`● ${T.measured}`, L + 8 * sc, Tp + 14 * sc); c.fillStyle = "#f59e0b"; c.fillText(`○ ${T.extrap}`, L + 90 * sc, Tp + 14 * sc);
    if (sc > 1) { c.fillStyle = "#555"; c.textAlign = "right"; c.fillText("AME2020 / NUBASE2020 · gezhuang0717.github.io", Wd - R - 4 * sc, Tp + 14 * sc); }
    if (plotHover && sc === 1) { const p = plotHover; c.fillStyle = ink; c.textAlign = "left"; c.font = `${12}px system-ui`; c.fillText(`${sup(p.r[0] + p.r[1])}${p.r[2]}: ${p.y.toFixed(4)}${p.est ? "#" : ""} ± ${p.e.toFixed(4)}`, Math.min(px(p.x) + 8, Wd - 220), Math.max(py(p.y) - 10, 30)); }
  }
  pc.addEventListener("mousemove", e => {
    if (!plotPts.length) return; const b = pc.getBoundingClientRect(), x = (e.clientX - b.left) * pc.width / b.width;
    const L = 62, R = 16, xs = plotPts.map(p => p.x), x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, xv = x0 + (x - L) / (pc.width - L - R) * (x1 - x0);
    plotHover = plotPts.reduce((a, p) => Math.abs(p.x - xv) < Math.abs(a.x - xv) ? p : a, plotPts[0]); drawPlot();
  });
  pc.addEventListener("click", () => { if (plotHover) { pin = plotHover.r; zoomTo(pin); showCard(pin); } });
  pq.onchange = () => plotChain(); pchain.onchange = () => plotChain();

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
    return [r[0], r[1], r[0] + r[1], r[2], d.me ? d.me.v : "", d.me ? d.me.e : "", r[5] ? "#" : "", ...f(d.BEA), ...f(d.sn), ...f(d.s2n), ...f(d.sp), ...f(d.s2p), ...f(d.qbm), ...f(d.qec), ...f(d.qa), r[7], r[8], r[10], r[9] || "", r[11].length]; };
  const csvHead = ["Z", "N", "A", "El", "ME_keV", "dME_keV", "ME_flag", ...["BE/A", "Sn", "S2n", "Sp", "S2p", "Qbeta-", "QEC", "Qalpha"].flatMap(k => [k + "_MeV", "d" + k + "_MeV", k + "_flag"]), "T1/2", "Jpi", "decay_modes", "discovery_year", "isomers"];
  root.querySelector("[data-nc=png]").onclick = () => X.png(sc => { const o = document.createElement("canvas"); o.width = cv.width * sc; o.height = cv.height * sc; draw(o.getContext("2d"), o.width, o.height, sc); return o; }, "chart-of-nuclides");
  root.querySelector("[data-nc=csv]").onclick = () => X.csv(csvHead, rows.filter(pass).map(csvRow), "ame2020-nubase2020" + (filt === "all" ? "" : "-" + filt));
  root.querySelector("[data-nc=video]").onclick = e => {
    const b = e.currentTarget, tour = [rows.find(r => r[0] === 50 && r[1] === 50), rows.find(r => r[0] === 55 && r[1] === 78), rows.find(r => r[0] === 82 && r[1] === 126)].filter(Boolean);
    X.record(cv, 9, "chart-of-nuclides-tour", on => { b.disabled = on; b.classList.toggle("is-rec", on); });
    fit(); let i = 0; const next = () => { if (i < tour.length) { const r = tour[i++]; pin = r; zoomTo(r, 30, () => setTimeout(next, 900)); } else setTimeout(fit, 400); }; setTimeout(next, 600);
  };
  root.querySelector("[data-nc=ppng]").onclick = () => X.png(sc => { const o = document.createElement("canvas"); o.width = pc.width * sc; o.height = pc.height * sc; drawPlot(o.getContext("2d"), o.width, o.height, sc); return o; }, "chain-" + pq.value);
  root.querySelector("[data-nc=pcsv]").onclick = () => X.csv(["Z", "N", "A", "El", "x", PQ[pq.value][0] + " (" + (PQ[pq.value][2] || "-") + ")", "uncertainty", "flag"], plotPts.map(p => [p.r[0], p.r[1], p.r[0] + p.r[1], p.r[2], p.x, p.y.toFixed(6), p.e.toFixed(6), p.est ? "#" : ""]), "chain-" + pq.value);

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
  sel.onchange = () => { mode = sel.value; drawLegend(); draw(); };
  fsel.innerHTML = Object.entries(FILTERS).map(([k, f]) => `<option value="${k}">${f[0]}</option>`).join("");
  fsel.onchange = () => { filt = fsel.value; draw(); root.querySelector(".nc-fcount").textContent = `${rows.filter(pass).length} ${T.nuclides}`; };
  search.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const q = search.value.trim().replace(/[\s\-]/g, ""), m1 = q.match(/^(\d+)([A-Za-z]{1,2})$/) || q.match(/^([A-Za-z]{1,2})(\d+)$/); if (!m1) return;
    const A = +(isNaN(m1[1]) ? m1[2] : m1[1]), sym = (isNaN(m1[1]) ? m1[1] : m1[2]).toLowerCase(), r = rows.find(x => x[2].toLowerCase() === sym && x[0] + x[1] === A);
    if (r) { pin = r; zoomTo(r); showCard(r); plotChain(r); } else { search.setCustomValidity(T.notfound); search.reportValidity(); setTimeout(() => search.setCustomValidity(""), 1500); }
  });
  new ResizeObserver(() => { const w = Math.round(cv.getBoundingClientRect().width); if (w && Math.abs(w - cv.width) > 4) { cv.width = w; cv.height = Math.round(w * 0.62); fit(); } }).observe(cv);
  new ResizeObserver(() => { const w = Math.round(pc.getBoundingClientRect().width); if (w && Math.abs(w - pc.width) > 4) { pc.width = w; pc.height = Math.round(w * 0.5); drawPlot(); } }).observe(pc);

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
