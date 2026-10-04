/* Interactive chart of nuclides — AME2020 / NUBASE2020 (static/data/nubase2020.json).
   Zoom (wheel, +/−, pinch-free buttons), drag to pan, click a box to zoom in and open its card.
   Colour modes, search, and a "mulberry" periodic table that jumps to an element.
   Labels come from the element's data-labels JSON (five languages, see layouts/_shortcodes/nuclide-chart.html). */
(() => {
  const root = document.querySelector("[data-nuclide-chart]");
  if (!root) return;
  const T = JSON.parse(root.dataset.labels || "{}");
  const cv = root.querySelector("canvas.nc-canvas"), g = cv.getContext("2d");
  const card = root.querySelector(".nc-card"), legend = root.querySelector(".nc-legend"), ptab = root.querySelector(".nc-ptable");
  const sel = root.querySelector("[name=nc-colour]"), search = root.querySelector("[name=nc-search]");
  const MAGIC = [2, 8, 20, 28, 50, 82, 126], SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).replace(/\d/g, d => SUP[d]);
  let rows = [], M = new Map(), EL = [], view = { s: 4, x: 10, y: 0 }, pin = null, hover = null, mode = "decay", anim = null;
  const key = (Z, N) => Z * 1000 + N;
  const css = getComputedStyle(document.documentElement), ink = (css.getPropertyValue("--zg-ink") || "").trim() || "#1d2433";

  /* ---------- physics helpers (keV) ---------- */
  const me = (Z, N) => { const r = M.get(key(Z, N)); return r && r[3] != null ? r[3] : null; };
  let MEn = 8071.3181, MEH = 7288.971064, MEa = 2424.91587;
  const diff = (...t) => t.some(v => v == null) ? null : t.reduce((a, b) => a + b, 0);
  function derived(r) {
    const [Z, N] = r, m = r[3], A = Z + N;
    const BE = m == null ? null : Z * MEH + N * MEn - m;
    const sn = me(Z, N - 1) != null && m != null ? me(Z, N - 1) + MEn - m : null;
    const s2n = me(Z, N - 2) != null && m != null ? me(Z, N - 2) + 2 * MEn - m : null;
    const sp = me(Z - 1, N) != null && m != null ? me(Z - 1, N) + MEH - m : null;
    const s2p = me(Z - 2, N) != null && m != null ? me(Z - 2, N) + 2 * MEH - m : null;
    const qbm = me(Z + 1, N - 1) != null && m != null ? m - me(Z + 1, N - 1) : null;
    const qec = me(Z - 1, N + 1) != null && m != null ? m - me(Z - 1, N + 1) : null;
    const qa = me(Z - 2, N - 2) != null && m != null ? m - me(Z - 2, N - 2) - MEa : null;
    return { A, BE, BEA: BE != null && A > 0 ? BE / A : null, sn, s2n, sp, s2p, qbm, qec, qa };
  }
  const decayClass = r => {
    const b = r[10] || "";
    if (r[6] === 99) return "stable";
    const first = (b.split(";")[0] || "").replace(/[=~<>?].*$/, "").trim();
    if (first === "B-" || first === "2B-") return "bm";
    if (first === "B+" || first === "EC" || first === "e+" || first === "2B+") return "bp";
    if (first === "A") return "a";
    if (first === "SF") return "sf";
    if (first === "IT") return "it";
    if (first === "p" || first === "2p") return "p";
    if (first === "n" || first === "2n") return "n";
    return r[6] === -98 ? "punst" : "other";
  };
  const DC = { stable: "#111827", bm: "#3b82f6", bp: "#ef4444", a: "#f2c230", sf: "#22c55e", p: "#f97316", n: "#7c3aed", it: "#ec4899", punst: "#cbd5e1", other: "#94a3b8" };

  /* ---------- colour modes ---------- */
  const ramp = x => `hsl(${(1 - Math.max(0, Math.min(1, x))) * 270},85%,${52}%)`;
  const MODES = {
    decay: { label: T.m_decay, f: r => DC[decayClass(r)] },
    hl: { label: T.m_hl, f: r => r[6] === 99 ? "#111827" : r[6] <= -98 ? "#e2e8f0" : ramp((r[6] + 9) / 29), range: ["1 ns", "10²⁰ s"] },
    bea: { label: T.m_bea, v: r => derived(r).BEA, lo: 7.0, hi: 8.8 },
    me: { label: T.m_me, v: r => r[3] == null ? null : r[3] / 1000, lo: -95, hi: 80 },
    sn: { label: T.m_sn, v: r => nz(derived(r).sn), lo: 0, hi: 20 },
    s2n: { label: T.m_s2n, v: r => nz(derived(r).s2n), lo: 0, hi: 35 },
    sp: { label: T.m_sp, v: r => nz(derived(r).sp), lo: 0, hi: 20 },
    qbm: { label: T.m_qb, v: r => nz(derived(r).qbm), lo: 0, hi: 20 },
    qa: { label: T.m_qa, v: r => nz(derived(r).qa), lo: 0, hi: 10 },
    dme: { label: T.m_dme, v: r => r[4] == null ? null : Math.log10(Math.max(r[4], 1e-4)), lo: -3, hi: 3, rng: ["0.001 keV", "1 MeV"] },
    est: { label: T.m_est, f: r => r[5] ? "#f59e0b" : "#0ea5e9" },
    year: { label: T.m_year, v: r => r[9], lo: 1900, hi: 2020 },
    iso: { label: T.m_iso, f: r => ["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][Math.min(3, r[11].length)] },
    eo: { label: T.m_eo, f: r => ["#0ea5e9", "#f59e0b", "#22c55e", "#ef4444"][(r[0] % 2) * 2 + (r[1] % 2)] },
  };
  function nz(v) { return v == null ? null : v / 1000; }
  function colour(r) {
    const m = MODES[mode];
    if (m.f) return m.f(r);
    const v = m.v(r);
    return v == null ? "#e5e7eb" : ramp((v - m.lo) / (m.hi - m.lo));
  }
  function drawLegend() {
    const m = MODES[mode];
    if (mode === "decay") legend.innerHTML = [["stable", T.stable], ["bm", "β⁻"], ["bp", "β⁺/EC"], ["a", "α"], ["sf", "SF"], ["p", "p"], ["n", "n"], ["it", "IT"], ["punst", T.punst]]
      .map(([k, l]) => `<span><i style="background:${DC[k]}"></i>${l}</span>`).join("");
    else if (mode === "est") legend.innerHTML = `<span><i style="background:#0ea5e9"></i>${T.measured}</span><span><i style="background:#f59e0b"></i>${T.extrap}</span>`;
    else if (mode === "iso") legend.innerHTML = [0, 1, 2, 3].map(n => `<span><i style="background:${["#e5e7eb", "#a78bfa", "#7c3aed", "#4c1d95"][n]}"></i>${n}${n === 3 ? "+" : ""}</span>`).join("");
    else if (mode === "eo") legend.innerHTML = [["#0ea5e9", "Z even · N even"], ["#f59e0b", "Z even · N odd"], ["#22c55e", "Z odd · N even"], ["#ef4444", "Z odd · N odd"]].map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
    else {
      const lo = m.range ? m.range[0] : m.rng ? m.rng[0] : m.lo, hi = m.range ? m.range[1] : m.rng ? m.rng[1] : m.hi;
      legend.innerHTML = `<span>${lo}</span><span class="nc-ramp"></span><span>${hi}${m.range || m.rng || mode === "year" ? "" : (mode === "bea" || mode === "me" || mode.startsWith("s") || mode.startsWith("q")) ? " MeV" : ""}</span>`;
    }
  }

  /* ---------- drawing ---------- */
  const W = () => cv.width, H = () => cv.height;
  const toScreen = (Z, N) => [view.x + N * view.s, H() - view.y - (Z + 1) * view.s];
  function draw() {
    g.clearRect(0, 0, W(), H());
    const s = view.s;
    g.strokeStyle = "rgba(127,127,160,.35)"; g.lineWidth = 1;
    MAGIC.forEach(m => {           /* magic-number lines */
      let [x] = toScreen(0, m); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H()); g.stroke(); g.beginPath(); g.moveTo(x + s, 0); g.lineTo(x + s, H()); g.stroke();
      if (m <= 120) { const [, y] = toScreen(m, 0); g.beginPath(); g.moveTo(0, y); g.lineTo(W(), y); g.stroke(); g.beginPath(); g.moveTo(0, y + s); g.lineTo(W(), y + s); g.stroke(); }
    });
    g.setLineDash([5, 5]); const a = toScreen(0, 0), b = toScreen(120, 120); g.beginPath(); g.moveTo(a[0], a[1] + s); g.lineTo(b[0] + s, b[1]); g.stroke(); g.setLineDash([]);
    const big = s >= 26, mid = s >= 14;
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const r of rows) {
      const [x, y] = toScreen(r[0], r[1]);
      if (x < -s || y < -s || x > W() || y > H()) continue;
      g.fillStyle = colour(r); g.fillRect(x, y, s - (s > 3 ? 1 : 0.3), s - (s > 3 ? 1 : 0.3));
      if (mid) {
        const dark = r[6] === 99 || ["bm", "sf", "n"].includes(decayClass(r)) && mode === "decay";
        g.fillStyle = dark ? "#fff" : "#111";
        g.font = `${Math.min(14, s * 0.28)}px system-ui`;
        g.fillText(sup(r[0] + r[1]) + r[2], x + s / 2, y + s * (big ? 0.32 : 0.5));
        if (big) { g.font = `${Math.min(11, s * 0.2)}px system-ui`; g.fillText(r[7].replace("stable", "★"), x + s / 2, y + s * 0.68); }
      }
    }
    [[hover, ink], [pin, "#e5484d"]].forEach(([r, c]) => { if (!r) return; const [x, y] = toScreen(r[0], r[1]); g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, s + 1, s + 1); });
    g.fillStyle = ink; g.font = "12px system-ui"; g.textAlign = "left"; g.fillText("N →", W() - 36, H() - 8); g.fillText("Z ↑", 6, 14);
  }
  function fit() {
    const s = Math.min(W() / 182, H() / 122);
    view = { s, x: (W() - 180 * s) / 2, y: (H() - 120 * s) / 2 }; draw();
  }
  function zoomTo(r, s = 34) {
    const wide = cv.getBoundingClientRect().width > 640, cxp = wide ? W() * 0.3 : W() / 2;  /* leave room for the card on the right */
    const target = { s, x: cxp - (r[1] + 0.5) * s, y: H() / 2 - (r[0] + 0.5) * s };
    const start = { ...view }, t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = now => {
      const k = Math.min(1, (now - t0) / 500), e = k * k * (3 - 2 * k);
      view = { s: start.s + (target.s - start.s) * e, x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e };
      draw(); if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function at(ev) {
    const b = cv.getBoundingClientRect(), x = (ev.clientX - b.left) * W() / b.width, y = (ev.clientY - b.top) * H() / b.height;
    const N = Math.floor((x - view.x) / view.s), Z = Math.floor((H() - view.y - y) / view.s) - 1 + 1;
    return M.get(key(Z - 0, N)) || null;
  }

  /* ---------- info card ---------- */
  const f1 = (v, d = 1) => v == null ? "—" : (v / 1000).toFixed(d);
  const DM = { "B-": "β⁻", "B+": "β⁺", "EC": "EC", "A": "α", "IT": "IT", "SF": "SF", "p": "p", "2p": "2p", "n": "n", "2n": "2n", "B-n": "β⁻n", "B-2n": "β⁻2n", "B+p": "β⁺p", "e+": "e⁺", "2B-": "2β⁻", "2B+": "2β⁺", "IS": T.abund };
  const decayText = b => !b ? "—" : b.split(";").map(x => {
    const m = x.trim().match(/^([A-Za-z0-9+\-]+)(.*)$/); if (!m) return x;
    let rest = m[2].trim().replace(/^([=~<>?]*\s*[\d.]+(?:[eE][-+]?\d+)?)\s+\d+$/, "$1");
    return (DM[m[1]] || m[1]) + (rest ? " " + rest.replace(/^=/, "= ") + (/\d/.test(rest) ? " %" : "") : "");
  }).join(" · ");
  function facts(r, d) {
    const [Z, N] = r, out = [];
    if (MAGIC.includes(Z) && MAGIC.includes(N)) out.push(T.f_dmagic);
    else if (MAGIC.includes(Z) || MAGIC.includes(N)) out.push(T.f_magic.replace("{k}", MAGIC.includes(Z) ? "Z = " + Z : "N = " + N));
    if (Z === N) out.push(T.f_nz);
    if (M.get(key(N, Z)) && Z !== N) out.push(T.f_mirror.replace("{m}", sup(Z + N) + (M.get(key(N, Z))[2])));
    const iso = rows.filter(x => x[0] === Z), lightest = Math.min(...iso.map(x => x[1])), heaviest = Math.max(...iso.map(x => x[1]));
    if (N === lightest) out.push(T.f_light); if (N === heaviest) out.push(T.f_heavy);
    if (d.sn != null && d.sn < 0) out.push(T.f_nunb); if (d.sp != null && d.sp < 0) out.push(T.f_punb);
    if (r[9]) out.push(T.f_year.replace("{y}", r[9]).replace("{n}", new Date().getFullYear() - r[9]));
    if (d.BE != null && d.A > 1) out.push(T.f_be.replace("{e}", (d.BE / 1000).toFixed(1)).replace("{p}", (d.BE / (d.A * 931494.1) * 100).toFixed(2)));
    if (r[6] !== 99 && r[6] > -90) { const t = Math.pow(10, r[6]); out.push(T.f_left.replace("{p}", (100 * Math.pow(0.5, 86400 / t)).toPrecision(3))); }
    return out;
  }
  function showCard(r) {
    if (!r) { card.hidden = true; return; }
    const d = derived(r), A = r[0] + r[1], el = EL.find(e => e[0] === r[0]);
    const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    card.hidden = false;
    card.innerHTML = `<button type="button" class="nc-close" aria-label="close">×</button>
      <div class="nc-head"><span class="nc-sym">${sup(A)}${r[2]}</span><span>${el ? el[2] : ""}<br><small>Z = ${r[0]} · N = ${r[1]} · A = ${A}</small></span></div>
      <table>${row(T.hl, r[7] === "stable" ? T.stable : r[7])}${row("Jπ", r[8] || "—")}${row(T.decay, decayText(r[10]))}
      ${row(T.me, r[3] == null ? "—" : `${r[3].toLocaleString(undefined, { maximumFractionDigits: 3 })} ± ${r[4]} keV${r[5] ? " (" + T.extrap + ")" : ""}`)}
      ${row("B/A", d.BEA == null ? "—" : (d.BEA / 1000).toFixed(4) + " MeV")}${row("Sₙ / S₂ₙ", f1(d.sn, 3) + " / " + f1(d.s2n, 3) + " MeV")}
      ${row("Sₚ / S₂ₚ", f1(d.sp, 3) + " / " + f1(d.s2p, 3) + " MeV")}${row("Q(β⁻) / Q(EC)", f1(d.qbm, 3) + " / " + f1(d.qec, 3) + " MeV")}${row("Q(α)", f1(d.qa, 3) + " MeV")}
      ${row(T.disc, r[9] || "—")}
      ${r[11].length ? row(T.isomers, r[11].map(i => `${sup(A)}${i[0]}${r[2]}: ${i[1] == null ? "?" : i[1].toLocaleString()} keV, ${i[2] || "?"}, ${i[3] || ""}`).join("<br>")) : ""}</table>
      <ul class="nc-facts">${facts(r, d).map(x => "<li>" + x + "</li>").join("")}</ul>
      <p class="nc-src">AME2020 · NUBASE2020 (Chin. Phys. C 45, 030001–030003, 2021)</p>`;
    card.querySelector(".nc-close").onclick = () => { pin = null; showCard(null); draw(); };
  }

  /* ---------- periodic table (mulberry) ---------- */
  function ptPos(Z) {
    if (Z === 1) return [1, 1]; if (Z === 2) return [1, 18];
    if (Z <= 10) return [2, Z <= 4 ? Z - 2 : Z + 8]; if (Z <= 18) return [3, Z <= 12 ? Z - 10 : Z];
    if (Z <= 36) return [4, Z - 18]; if (Z <= 54) return [5, Z - 36];
    if (Z >= 57 && Z <= 71) return [9, Z - 54]; if (Z >= 89 && Z <= 103) return [10, Z - 86];
    if (Z <= 86) return [6, Z <= 56 ? Z - 54 : Z - 68]; return [7, Z <= 88 ? Z - 86 : Z - 100];
  }
  function buildPT() {
    const count = {}; rows.forEach(r => { count[r[0]] = (count[r[0]] || 0) + 1; });
    const max = Math.max(...Object.values(count));
    ptab.innerHTML = EL.map(([Z, s, n]) => {
      const [p, gcol] = ptPos(Z), c = count[Z] || 0, x = c / max;
      return `<button type="button" style="grid-row:${p};grid-column:${gcol};--k:${x.toFixed(2)}" data-z="${Z}" title="${n} — ${c} ${T.known}"><small>${Z}</small><b>${s}</b><i>${c}</i></button>`;
    }).join("") + `<span class="nc-pt-note" style="grid-row:8;grid-column:3/19">${T.ptnote}</span>`;
    ptab.addEventListener("click", e => {
      const b = e.target.closest("[data-z]"); if (!b) return;
      const Z = +b.dataset.z, iso = rows.filter(r => r[0] === Z), st = iso.find(r => r[6] === 99) || iso[Math.floor(iso.length / 2)];
      if (st) { pin = st; zoomTo(st, 22); showCard(st); cv.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  /* ---------- events ---------- */
  let drag = null, moved = false;
  cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, view.x, view.y]; moved = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    if (drag) {
      const b = cv.getBoundingClientRect(), k = W() / b.width, dx = (e.clientX - drag[0]) * k, dy = (e.clientY - drag[1]) * k;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      view.x = drag[2] + dx; view.y = drag[3] - dy; draw(); return;
    }
    hover = at(e); draw();
  });
  cv.addEventListener("pointerup", e => { if (!moved) { const r = at(e); if (r) { pin = r; zoomTo(r, Math.max(34, view.s)); showCard(r); } } drag = null; });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    const b = cv.getBoundingClientRect(), mx = (e.clientX - b.left) * W() / b.width, my = (e.clientY - b.top) * H() / b.height;
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15, s2 = Math.max(2, Math.min(80, view.s * f)), k = s2 / view.s;
    view.x = mx - (mx - view.x) * k; view.y = (H() - my) - ((H() - my) - view.y) * k; view.s = s2; draw();
  }, { passive: false });
  root.querySelector("[data-nc=in]").onclick = () => zoomBy(1.4);
  root.querySelector("[data-nc=out]").onclick = () => zoomBy(1 / 1.4);
  root.querySelector("[data-nc=fit]").onclick = () => { pin = null; showCard(null); fit(); };
  root.querySelector("[data-nc=random]").onclick = () => { const r = rows[Math.floor(Math.random() * rows.length)]; pin = r; zoomTo(r); showCard(r); };
  function zoomBy(f) { const cx = W() / 2, cy = H() / 2, s2 = Math.max(2, Math.min(80, view.s * f)), k = s2 / view.s; view.x = cx - (cx - view.x) * k; view.y = (H() - cy) - ((H() - cy) - view.y) * k; view.s = s2; draw(); }
  sel.innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join("");
  sel.onchange = () => { mode = sel.value; drawLegend(); draw(); };
  search.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const q = search.value.trim().replace(/[\s\-]/g, ""), m1 = q.match(/^(\d+)([A-Za-z]{1,2})$/) || q.match(/^([A-Za-z]{1,2})(\d+)$/);
    if (!m1) return;
    const A = +(isNaN(m1[1]) ? m1[2] : m1[1]), sym = (isNaN(m1[1]) ? m1[1] : m1[2]).toLowerCase();
    const r = rows.find(x => x[2].toLowerCase() === sym && x[0] + x[1] === A);
    if (r) { pin = r; zoomTo(r); showCard(r); } else search.setCustomValidity(T.notfound), search.reportValidity(), setTimeout(() => search.setCustomValidity(""), 1500);
  });
  new ResizeObserver(() => { const w = Math.round(cv.getBoundingClientRect().width); if (w && Math.abs(w - cv.width) > 4) { cv.width = w; cv.height = Math.round(w * 0.62); fit(); } }).observe(cv);

  fetch(root.dataset.src).then(r => r.json()).then(d => {
    rows = d.rows; EL = d.elements; rows.forEach(r => M.set(key(r[0], r[1]), r));
    MEn = me(0, 1) ?? MEn; MEH = me(1, 0) ?? MEH; MEa = me(2, 2) ?? MEa;
    root.querySelector(".nc-count").textContent = `${rows.length} ${T.nuclides} · ${rows.reduce((a, r) => a + r[11].length, 0)} ${T.isomers}`;
    buildPT(); drawLegend(); fit();
    const q = new URLSearchParams(location.search).get("nuclide"); if (q) { search.value = q; search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); }
  }).catch(() => { card.hidden = false; card.textContent = "Chart data could not load."; });
})();
