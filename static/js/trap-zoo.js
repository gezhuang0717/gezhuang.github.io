/* Animated sketches of the ion- and atom-trap family (not to scale).
   Markup: layouts/_shortcodes/trap-zoo.html → <figure class="g-trap" data-kind="penning"><canvas width=240 height=180>…
   Texts: data/trap_zoo.yaml. Add a trap: a yaml entry + a function in DRAW with the same key.
   Each draw(g, W, H, t, st) paints the device and returns [x, y] of the tracked ion/atom (or null). */
(() => {
  if (window.__zgTrapZoo) return; window.__zgTrapZoo = true;
  const K = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RED = "rgba(229,72,77,.85)", BLUE = "rgba(62,99,221,.85)", GOLD = "rgba(214,140,40,.85)", GREY = "rgba(127,127,160,.55)";
  const lbl = (g, s, x, y, al = "left") => { g.fillStyle = GREY; g.font = "10px system-ui,sans-serif"; g.textAlign = al; g.fillText(s, x, y); };
  const arrow = (g, x1, y1, x2, y2, col, w = 2) => { const a = Math.atan2(y2 - y1, x2 - x1); g.strokeStyle = g.fillStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 7 * Math.cos(a - 0.4), y2 - 7 * Math.sin(a - 0.4)); g.lineTo(x2 - 7 * Math.cos(a + 0.4), y2 - 7 * Math.sin(a + 0.4)); g.fill(); };

  const DRAW = {
    penning(g, W, H, t) {
      const cx = W / 2, cy = H / 2;
      g.strokeStyle = "rgba(127,127,160,.18)"; g.lineWidth = 1; for (let x = 30; x < W; x += 30) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, H - 8); g.stroke(); }
      lbl(g, "B ↑", 8, 16);
      g.lineWidth = 4; g.strokeStyle = BLUE;  /* end caps (hyperbolae, z) */
      [-1, 1].forEach(s => { g.beginPath(); for (let i = -1; i <= 1.001; i += 0.05) { const x = cx + 85 * i, y = cy + s * Math.sqrt(30 * 30 + 0.5 * (85 * i) ** 2 * 0.28); i > -1 ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
      g.strokeStyle = RED;                    /* ring (two branches in this cut) */
      [-1, 1].forEach(s => { g.beginPath(); for (let i = -1; i <= 1.001; i += 0.05) { const y = cy + 55 * i, x = cx + s * Math.sqrt(46 * 46 + 2 * (55 * i) ** 2 * 0.35); i > -1 ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
      return [cx + 26 * Math.cos(0.35 * t) + 8 * Math.cos(6 * t), cy + 14 * Math.cos(1.6 * t)];
    },
    cyl(g, W, H, t) {
      const cy = H / 2; lbl(g, "B →", 8, 16);
      [[18, 50], [52, 86], [90, 150], [154, 188], [192, 222]].forEach(([a, b], i) => {
        g.fillStyle = i === 2 ? RED : BLUE; g.globalAlpha = i === 2 ? 0.85 : 0.55; g.fillRect(a, cy - 46, b - a, 10); g.fillRect(a, cy + 36, b - a, 10); g.globalAlpha = 1; });
      return [120 + 26 * Math.cos(1.3 * t), cy + 20 * Math.cos(0.33 * t) + 6 * Math.cos(6.2 * t)];
    },
    paul(g, W, H, t) {
      const cx = W / 2, cy = H / 2, pol = Math.cos(14 * t) > 0; g.lineWidth = 4;
      g.strokeStyle = pol ? RED : BLUE; [-1, 1].forEach(s => { g.beginPath(); for (let i = -1; i <= 1.001; i += 0.05) { const x = cx + 80 * i, y = cy + s * Math.sqrt(32 * 32 + 0.5 * (80 * i) ** 2 * 0.3); i > -1 ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
      g.strokeStyle = pol ? BLUE : RED; [-1, 1].forEach(s => { g.beginPath(); for (let i = -1; i <= 1.001; i += 0.05) { const y = cy + 55 * i, x = cx + s * Math.sqrt(46 * 46 + 2 * (55 * i) ** 2 * 0.35); i > -1 ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
      lbl(g, "RF ~", 8, 16);
      const m = 1 - 0.2 * Math.cos(14 * t), n = 1 + 0.2 * Math.cos(14 * t);
      return [cx + 22 * Math.cos(1.0 * t) * m, cy + 15 * Math.sin(1.37 * t + 0.6) * n];
    },
    linear(g, W, H, t) {
      const cx = W / 2, cy = H / 2, r0 = 30, rho = 1.145 * r0, Rc = r0 + rho, pol = Math.cos(14 * t) > 0;
      g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
      [[Rc, 0, 1], [-Rc, 0, 1], [0, Rc, 0], [0, -Rc, 0]].forEach(([a, b, s]) => { g.fillStyle = (s === 1) === pol ? RED : BLUE; g.beginPath(); g.arc(cx + a, cy + b, rho, 0, 6.283); g.fill(); });
      g.restore(); g.strokeStyle = GREY; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.arc(cx, cy, r0, 0, 6.283); g.stroke(); g.setLineDash([]);
      lbl(g, "r₀", cx + r0 * 0.72 + 3, cy - r0 * 0.72);
      const m = 1 - 0.2 * Math.cos(14 * t), n = 1 + 0.2 * Math.cos(14 * t);
      return [cx + 17 * Math.cos(1.0 * t) * m, cy + 13 * Math.sin(1.37 * t + 0.6) * n];
    },
    mrtof(g, W, H, t) {
      const cy = H / 2; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.strokeStyle = i < 2 ? RED : BLUE; g.globalAlpha = 0.5 + 0.1 * i; g.strokeRect(10 + i * 8, cy - 40, 5, 80); g.strokeRect(W - 15 - i * 8, cy - 40, 5, 80); }
      g.globalAlpha = 1; lbl(g, "mirror", 8, cy + 56); lbl(g, "mirror", W - 8, cy + 56, "right"); lbl(g, "drift  ·  t ∝ √(m/q)", W / 2, 18, "center");
      const u = (0.22 * t) % 1, tri = u < 0.5 ? u * 2 : 2 - u * 2;
      return [58 + (W - 116) * (0.5 - 0.5 * Math.cos(Math.PI * tri)), cy + 8 * Math.sin(5 * t)];
    },
    ring(g, W, H, t) {
      const cx = W / 2, cy = H / 2, a = W * 0.38, b = H * 0.33; g.strokeStyle = GREY; g.lineWidth = 8; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(cx, cy, a, b, 0, 0, 6.283); g.stroke(); g.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { const f = i / 6 * 6.283; g.fillStyle = RED; g.save(); g.translate(cx + a * Math.cos(f), cy + b * Math.sin(f)); g.rotate(f); g.fillRect(-6, -9, 12, 18); g.restore(); }
      for (let i = 0; i < 6; i++) { const f = (i + 0.5) / 6 * 6.283; g.fillStyle = BLUE; g.save(); g.translate(cx + a * Math.cos(f), cy + b * Math.sin(f)); g.rotate(f); g.fillRect(-4, -6, 8, 12); g.restore(); }
      lbl(g, "dipole", 8, 16); g.fillStyle = BLUE; lbl(g, "quadrupole", W - 8, 16, "right");
      const f = 0.8 * t; return [cx + (a + 4 * Math.cos(9 * f)) * Math.cos(f), cy + (b + 4 * Math.cos(9 * f)) * Math.sin(f)];
    },
    ebit(g, W, H, t) {
      const cy = H / 2;
      [[14, 74, BLUE], [80, 160, RED], [166, W - 14, BLUE]].forEach(([a, b, c]) => { g.fillStyle = c; g.globalAlpha = 0.7; g.fillRect(a, cy - 40, b - a, 9); g.fillRect(a, cy + 31, b - a, 9); g.globalAlpha = 1; });
      const grd = g.createLinearGradient(0, cy - 6, 0, cy + 6); grd.addColorStop(0, "rgba(255,200,40,0)"); grd.addColorStop(0.5, "rgba(255,200,40,.9)"); grd.addColorStop(1, "rgba(255,200,40,0)");
      g.fillStyle = grd; g.fillRect(0, cy - 6, W, 12); arrow(g, W - 40, cy + 18, W - 12, cy + 18, "rgba(214,160,20,.9)", 1.5); lbl(g, "e⁻ beam", W - 44, cy + 22, "right");
      lbl(g, "q⁺ → q⁺⁺ → …", 8, 16);
      return [120 + 34 * Math.cos(2.2 * t), cy + 5 * Math.sin(9 * t)];
    },
    orbi(g, W, H, t) {
      const cx = W / 2, cy = H / 2; g.strokeStyle = BLUE; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - W * 0.42, cy - 48); g.quadraticCurveTo(cx, cy - 72, cx + W * 0.42, cy - 48); g.stroke();
      g.beginPath(); g.moveTo(cx - W * 0.42, cy + 48); g.quadraticCurveTo(cx, cy + 72, cx + W * 0.42, cy + 48); g.stroke();
      g.fillStyle = RED; g.beginPath(); g.moveTo(cx - W * 0.42, cy); g.quadraticCurveTo(cx, cy - 26, cx + W * 0.42, cy); g.quadraticCurveTo(cx, cy + 26, cx - W * 0.42, cy); g.fill();
      lbl(g, "ω_z = √(kq/m)", 8, 16);
      return [cx + W * 0.3 * Math.sin(1.4 * t), cy + 34 * Math.cos(9 * t)];
    },
    mot(g, W, H, t, st) {
      const cx = W / 2, cy = H / 2;
      [[0, 1], [1, 0], [0.7, -0.7]].forEach(([dx, dy]) => { g.strokeStyle = "rgba(229,72,77,.25)"; g.lineWidth = 12; g.beginPath(); g.moveTo(cx - 110 * dx, cy - 110 * dy); g.lineTo(cx + 110 * dx, cy + 110 * dy); g.stroke(); });
      [[0, 1], [1, 0], [0.7, -0.7]].forEach(([dx, dy]) => { arrow(g, cx - 100 * dx, cy - 100 * dy, cx - 62 * dx, cy - 62 * dy, "rgba(229,72,77,.8)", 1.5); arrow(g, cx + 100 * dx, cy + 100 * dy, cx + 62 * dx, cy + 62 * dy, "rgba(229,72,77,.8)", 1.5); });
      g.strokeStyle = GOLD; g.lineWidth = 3; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx, cy + s * 62, 46, 10, 0, 0, 6.283); g.stroke(); });
      lbl(g, "I ↻", cx + 50, cy - 58); lbl(g, "I ↺", cx + 50, cy + 70);
      if (!st.atoms) st.atoms = Array.from({ length: 70 }, () => ({ x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 150, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3 }));
      st.atoms.forEach(a => { a.vx += -0.004 * a.x - 0.06 * a.vx + (Math.random() - 0.5) * 0.25; a.vy += -0.004 * a.y - 0.06 * a.vy + (Math.random() - 0.5) * 0.25; a.x += a.vx; a.y += a.vy;
        const r = Math.hypot(a.x, a.y); g.fillStyle = `hsla(${200 - Math.min(160, r * 2)},90%,${55 + Math.max(0, 20 - r)}%,.85)`; g.beginPath(); g.arc(cx + a.x, cy + a.y, 1.7, 0, 6.283); g.fill(); });
      if (Math.random() < 0.004) st.atoms = null;      /* reload the cloud now and then */
      return null;
    },
    tweezer(g, W, H, t) {
      const cy = H / 2, xs = [60, 120, 180];
      xs.forEach((x, i) => { const grd = g.createLinearGradient(x - 30, 0, x + 30, 0); grd.addColorStop(0, "rgba(229,72,77,0)"); grd.addColorStop(0.5, "rgba(229,72,77,.45)"); grd.addColorStop(1, "rgba(229,72,77,0)");
        g.fillStyle = grd; g.beginPath(); g.moveTo(x - 26, 6); g.quadraticCurveTo(x - 2, cy, x - 26, H - 6); g.lineTo(x + 26, H - 6); g.quadraticCurveTo(x + 2, cy, x + 26, 6); g.closePath(); g.fill();
        if (i !== 1) { g.fillStyle = "#30a46c"; g.beginPath(); g.arc(x + 2 * Math.sin(5 * t + i), cy + 4 * Math.sin(3.1 * t + i), 3.5, 0, 6.283); g.fill(); } });
      lbl(g, "focus · F ∝ ∇I", 8, 16); lbl(g, "laser ↓", W - 8, 16, "right");
      return [xs[1] + 3 * Math.sin(6 * t), cy + 6 * Math.sin(3.7 * t)];
    },
  };

  function start(fig) {
    const cv = fig.querySelector("canvas"), k = fig.dataset.kind, draw = DRAW[k]; if (!cv || !draw || cv._zoo) return; cv._zoo = 1;
    const W = +cv.getAttribute("width"), H = +cv.getAttribute("height"); cv.width = W * K; cv.height = H * K;
    const g = cv.getContext("2d"), st = {}; let t = Math.random() * 10, tr = [], vis = true;
    new IntersectionObserver(es => es.forEach(e => (vis = e.isIntersecting))).observe(cv);
    (function frame() {
      if (vis || !tr.length) {
        g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, W, H);
        const p = draw(g, W, H, t, st);
        if (p) { tr.push(p); if (tr.length > 240) tr.shift();
          for (let i = 1; i < tr.length; i++) { g.strokeStyle = `hsla(${i / tr.length * 300},85%,55%,${i / tr.length})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...tr[i - 1]); g.lineTo(...tr[i]); g.stroke(); }
          g.fillStyle = "#e5484d"; g.beginPath(); g.arc(p[0], p[1], 3.6, 0, 6.283); g.fill(); }
        t += 0.03;
      }
      if (!reduce) requestAnimationFrame(frame);
    })();
  }
  const init = () => document.querySelectorAll(".zg-trapzoo figure[data-kind]").forEach(start);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
