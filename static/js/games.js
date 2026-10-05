/* Games page: four small physics games + an animated gallery of trap types.
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

  /* ── 2. TOF-ICR resonance hunt ─────────────────────────────────────── */
  function tofGame() {
    const box = $("#g-tof"), cv = box.querySelector("canvas"), g = cv.getContext("2d"), sl = box.querySelector("input");
    let nu0, pts = [], shots = 0;
    /* conversion profile (Ramsey-free rectangular excitation): F(x) = sin²(π√(1+x²)/2)/(1+x²); TOF dips where F → 1 */
    const conv = x => Math.pow(Math.sin(Math.PI / 2 * Math.sqrt(1 + x * x)), 2) / (1 + x * x);
    const time = nu => 42 - 14 * conv((nu - nu0) / 1.0) + (Math.random() - 0.5) * 0.8;
    function reset() { nu0 = 808795 + Math.round((Math.random() - 0.5) * 16); pts = []; shots = 0; draw(); box.querySelector(".g-msg").textContent = T.tof_start; }
    function draw() {
      g.clearRect(0, 0, cv.width, cv.height); const W = cv.width, H = cv.height, x0 = 808780, x1 = 808810;
      g.strokeStyle = "rgba(127,127,160,.4)"; g.strokeRect(40, 10, W - 50, H - 40);
      g.fillStyle = "#888"; g.font = "11px system-ui"; g.fillText("ν_rf − 808 780 Hz →", W - 130, H - 8); g.fillText("TOF (µs)", 2, 20);
      pts.forEach(([nu, t]) => { const x = 40 + (nu - x0) / (x1 - x0) * (W - 50), y = 10 + (t - 26) / 18 * (H - 40); g.fillStyle = "#8b6cff"; g.beginPath(); g.arc(x, y, 3.5, 0, 6.283); g.fill(); });
    }
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
      if (a === "shot") { const nu = +sl.value; pts.push([nu, time(nu)]); shots++; draw(); box.querySelector(".g-msg").textContent = `${T.shots}: ${shots}`; }
      if (a === "guess") { const err = Math.abs(+sl.value - nu0), sc = Math.max(0, Math.round(100 - err * 12 - shots * 2));
        box.querySelector(".g-msg").textContent = `ν_c = ${nu0.toLocaleString()} Hz · ${T.yours}: ${(+sl.value).toLocaleString()} Hz (Δ = ${err} Hz) · ${T.score}: ${sc} · ${T.best}: ${best("tof", sc)}`;
        for (let n = 808780; n <= 808810; n += 0.25) pts.push([n, 42 - 14 * conv(n - nu0)]); draw(); }
      if (a === "new") reset();
    });
    sl.addEventListener("input", () => (box.querySelector("output").textContent = (+sl.value).toLocaleString() + " Hz"));
    reset();
  }

  /* ── 3. MR-TOF isobar separation ───────────────────────────────────── */
  function mrtofGame() {
    const box = $("#g-mr"), cv = box.querySelector("canvas"), g = cv.getContext("2d"), sl = box.querySelector("input");
    const pairs = [["¹⁰⁰Sn", "¹⁰⁰In", 100, 7030], ["¹³³Cs", "¹³³Xe", 133, 427], ["⁸⁴Rb", "⁸⁴Kr", 84, 2690], ["⁵⁶Ni", "⁵⁶Co", 56, 2133], ["¹²⁹Sb", "¹²⁹Sn", 129, 4040]];
    let P;
    const R0 = 150; /* R = t/(2Δt) grows ~linearly with laps; ~150 per lap is typical of compact MR-TOFs */
    function draw() {
      const laps = +sl.value, R = R0 * laps, need = P[2] * 931494 / P[3], sep = R / need, W = cv.width, H = cv.height;
      box.querySelector("output").textContent = laps + " · R ≈ " + R.toLocaleString();
      g.clearRect(0, 0, W, H); const sig = W * 0.06 / Math.max(0.15, sep), c = W / 2, d = W * 0.06;
      [[c - d, "#3b82f6"], [c + d, "#ef4444"]].forEach(([mu, col]) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < W; x++) { const y = H - 10 - (H - 25) * Math.exp(-0.5 * ((x - mu) / sig) ** 2); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
      g.fillStyle = "#888"; g.font = "12px system-ui"; g.fillText(P[0], c - d - 18, 14); g.fillText(P[1], c + d - 10, 14);
      box.querySelector(".g-msg").textContent = `Δm = ${P[3].toLocaleString()} keV · ${T.need} R ≈ ${Math.round(need).toLocaleString()} · ${sep >= 1 ? "✔ " + T.separated : "… " + T.overlap}`;
    }
    function reset() { P = rnd(pairs); sl.value = 1; draw(); }
    sl.addEventListener("input", draw); box.querySelector("[data-act=new]").onclick = reset; reset();
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

  /* ── 5. Animated trap gallery ──────────────────────────────────────── */
  function gallery() {
    const kinds = ["penning", "cyl", "paul", "linear", "mrtof", "ring", "ebit", "orbi"];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll(".g-trap canvas").forEach((cv, idx) => {
      const g = cv.getContext("2d"), k = kinds[idx], W = cv.width, H = cv.height, cx = W / 2, cy = H / 2; let t = 0, tr = [];
      const elec = "rgba(214,140,40,.85)", elec2 = "rgba(90,120,220,.85)";
      function frame() {
        g.clearRect(0, 0, W, H); g.lineWidth = 3; let x = cx, y = cy;
        if (k === "penning" || k === "cyl") {
          g.strokeStyle = elec2;
          if (k === "penning") { g.beginPath(); g.moveTo(40, 25); g.quadraticCurveTo(cx, 75, W - 40, 25); g.stroke(); g.beginPath(); g.moveTo(40, H - 25); g.quadraticCurveTo(cx, H - 75, W - 40, H - 25); g.stroke(); g.strokeStyle = elec; g.beginPath(); g.moveTo(20, 60); g.quadraticCurveTo(70, cy, 20, H - 60); g.stroke(); g.beginPath(); g.moveTo(W - 20, 60); g.quadraticCurveTo(W - 70, cy, W - 20, H - 60); g.stroke(); }
          else { [30, 60, 90, 120, 150].forEach((yy, i) => { g.strokeStyle = i === 2 ? elec : elec2; g.strokeRect(30, yy - 12, W - 60, 22); }); }
          x = cx + 38 * Math.cos(0.3 * t) + 12 * Math.cos(5 * t); y = cy + 25 * Math.cos(1.3 * t) * (k === "cyl" ? 1.6 : 1);
        } else if (k === "paul" || k === "linear") {
          if (k === "paul") { g.strokeStyle = elec; g.beginPath(); g.moveTo(25, 40); g.quadraticCurveTo(75, cy, 25, H - 40); g.stroke(); g.beginPath(); g.moveTo(W - 25, 40); g.quadraticCurveTo(W - 75, cy, W - 25, H - 40); g.stroke(); g.strokeStyle = elec2; g.beginPath(); g.moveTo(60, 20); g.quadraticCurveTo(cx, 60, W - 60, 20); g.stroke(); g.beginPath(); g.moveTo(60, H - 20); g.quadraticCurveTo(cx, H - 60, W - 60, H - 20); g.stroke(); }
          else { [[cx - 30, cy - 30], [cx + 30, cy - 30], [cx - 30, cy + 30], [cx + 30, cy + 30]].forEach(([a, b], i) => { g.fillStyle = (i === 0 || i === 3) === (Math.sin(14 * t) > 0) ? elec : elec2; g.beginPath(); g.arc(a, b, 16, 0, 6.283); g.fill(); }); }
          const mm = 1 + 0.18 * Math.cos(14 * t); x = cx + 30 * Math.cos(1.1 * t) * mm; y = cy + 22 * Math.sin(1.6 * t) * mm;
        } else if (k === "mrtof") {
          g.strokeStyle = elec2; for (let i = 0; i < 4; i++) { g.strokeRect(14 + i * 9, 40, 6, H - 80); g.strokeRect(W - 20 - i * 9, 40, 6, H - 80); }
          const u = (0.25 * t) % 1, tri = u < 0.5 ? u * 2 : 2 - u * 2; x = 55 + (W - 110) * (0.5 - 0.5 * Math.cos(Math.PI * tri)); y = cy + 8 * Math.sin(6 * t);
        } else if (k === "ring") {
          g.strokeStyle = elec2; g.beginPath(); g.ellipse(cx, cy, W * 0.38, H * 0.33, 0, 0, 6.283); g.stroke(); g.fillStyle = elec;
          for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; g.fillRect(cx + W * 0.38 * Math.cos(a) - 6, cy + H * 0.33 * Math.sin(a) - 6, 12, 12); }
          const a = 0.8 * t; x = cx + W * 0.38 * Math.cos(a) + 5 * Math.cos(9 * a) * Math.cos(a); y = cy + H * 0.33 * Math.sin(a) + 5 * Math.cos(9 * a) * Math.sin(a);
        } else if (k === "ebit") {
          g.strokeStyle = elec2; [[20, 70], [80, 140], [150, W - 20]].forEach(([a, b], i) => { g.strokeStyle = i === 1 ? elec : elec2; g.strokeRect(a, cy - 28, b - a, 56); });
          g.strokeStyle = "rgba(255,200,40,.9)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, cy); g.lineTo(W, cy); g.stroke();
          x = 110 + 28 * Math.cos(2.2 * t); y = cy + 6 * Math.sin(9 * t);
        } else {                         /* Orbitrap: spindle + barrel */
          g.strokeStyle = elec; g.beginPath(); g.ellipse(cx, cy, W * 0.38, 14, 0, 0, 6.283); g.stroke(); g.strokeStyle = elec2; g.strokeRect(cx - W * 0.42, cy - 52, W * 0.84, 104);
          x = cx + W * 0.3 * Math.sin(1.4 * t); y = cy + 38 * Math.cos(9 * t);
        }
        tr.push([x, y]); if (tr.length > 260) tr.shift();
        for (let i = 1; i < tr.length; i++) { g.strokeStyle = `hsla(${i / tr.length * 300},85%,55%,${i / tr.length})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...tr[i - 1]); g.lineTo(...tr[i]); g.stroke(); }
        g.fillStyle = "#e5484d"; g.beginPath(); g.arc(x, y, 4, 0, 6.283); g.fill();
        t += 0.03; if (!reduce) requestAnimationFrame(frame);
      }
      frame();
    });
  }

  gallery();
  fetch(root.dataset.src).then(r => r.json()).then(d => { rows = d.rows; hlGame(); quiz(d.elements); });
  tofGame(); mrtofGame();
})();
