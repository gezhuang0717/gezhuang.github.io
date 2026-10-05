/* Ion-trace hero: rainbow ions moving around the name.
   Modes: Penning (magnetron + cyclotron), PI-ICR flower, Paul (secular + micromotion),
   MR-TOF (mirror bounces), storage ring (betatron).  No dependencies, ~6 kB. */
(() => {
  const TAU = Math.PI * 2;
  const MODES = ["penning", "flower", "paul", "mrtof", "ring"];
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);

  function init(root) {
    const cv = root.querySelector("canvas"), ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const S = { mode: root.dataset.mode || "penning", speed: 1, count: +root.dataset.ions || 36,
                palette: "rainbow", trails: true, playing: !reduce, t: 0, mix: 1, prev: null };
    let W = 0, H = 0, dpr = 1, ions = [], ptr = null, raf = 0, last = 0;

    const mkIon = (i, at) => ({
      m: 0.6 + (i % 7) * 0.14 + Math.random() * 0.05,   // mass-like parameter → frequencies
      ph: Math.random() * TAU, ph2: Math.random() * TAU,
      lane: i % 2 ? 1 : -1, born: at ? S.t : -9, from: at || null,
      kick: { x: 0, y: 0 }, x: 0, y: 0,
    });
    const setCount = n => { while (ions.length < n) ions.push(mkIon(ions.length)); ions.length = n; };

    function path(mode, o, t) {
      const cx = W / 2, cy = H / 2, A = W * 0.43, B = H * 0.40, v = 1 / Math.sqrt(o.m);
      switch (mode) {
        case "penning": {           // slow magnetron ellipse + fast mass-dependent cyclotron loops
          const wm = 0.35 * t + o.ph, wc = (7 + 5 / o.m) * t + o.ph2, rc = Math.min(W, H) * 0.06;
          return [cx + A * 0.9 * Math.cos(wm) + rc * Math.cos(wc), cy + B * 0.85 * Math.sin(wm) + rc * Math.sin(wc)];
        }
        case "flower": {            // PI-ICR-like rosette projection, one petal set per mass
          const k = 3 + (Math.round(o.m * 7) % 4), th = 0.5 * v * t + o.ph, r = Math.cos(k * th);
          const rr = 0.35 + 0.65 * Math.abs(r);
          return [cx + A * 0.95 * rr * Math.cos(th), cy + B * 0.95 * rr * Math.sin(th)];
        }
        case "paul": {              // secular Lissajous with RF micromotion ripple
          const wx = 0.9 * v * t + o.ph, wy = 1.27 * v * t + o.ph2, mm = 1 + 0.12 * Math.cos(28 * t + o.ph);
          return [cx + A * 0.95 * Math.cos(wx) * mm, cy + B * 0.95 * Math.sin(wy) * mm];
        }
        case "mrtof": {             // bunches bounce between two mirrors; light ions lap faster
          const u = (0.25 * v * t + o.ph / TAU) % 1, tri = u < 0.5 ? u * 2 : 2 - u * 2;
          const s = 0.5 - 0.5 * Math.cos(Math.PI * tri);             // slows near the mirrors
          const y = cy + o.lane * (B * 0.78 + B * 0.12 * Math.sin(3 * TAU * u + o.ph2));
          return [cx - A + 2 * A * s, y];
        }
        default: {                  // storage ring: stadium orbit + betatron oscillation
          const L = 2 * (2 * A * 0.55) + TAU * B * 0.8, d = ((0.18 * v * t + o.ph / TAU) % 1) * L;
          const sx = A * 0.55, r = B * 0.8, beta = Math.min(W, H) * 0.025 * Math.sin(9 * d / r + o.ph2);
          let x, y, nx, ny;
          if (d < 2 * sx) { x = cx - sx + d; y = cy - r; nx = 0; ny = -1; }
          else if (d < 2 * sx + Math.PI * r) { const a = -Math.PI / 2 + (d - 2 * sx) / r; x = cx + sx + r * Math.cos(a); y = cy + r * Math.sin(a); nx = Math.cos(a); ny = Math.sin(a); }
          else if (d < 4 * sx + Math.PI * r) { x = cx + sx - (d - 2 * sx - Math.PI * r); y = cy + r; nx = 0; ny = 1; }
          else { const a = Math.PI / 2 + (d - 4 * sx - Math.PI * r) / r; x = cx - sx + r * Math.cos(a); y = cy + r * Math.sin(a); nx = Math.cos(a); ny = Math.sin(a); }
          return [x * 1 + nx * beta, y + ny * beta];
        }
      }
    }

    const color = (o, i, a) => {
      if (S.palette === "mono") return `hsla(${200 + o.m * 30},90%,62%,${a})`;
      if (S.palette === "isotope") return `hsla(${(o.m - 0.6) / 0.9 * 280},95%,58%,${a})`;
      return `hsla(${(i / ions.length) * 330 + S.t * 25},90%,58%,${a})`;
    };

    function size() {
      const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function step(dt) {
      S.t += dt * S.speed; if (S.mix < 1) S.mix = Math.min(1, S.mix + dt * 1.2);
      if (S.trails) { ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = `rgba(0,0,0,${reduce ? 0.02 : 0.09})`; ctx.fillRect(0, 0, W, H); }
      else ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ions.forEach((o, i) => {
        let [x, y] = path(S.mode, o, S.t);
        if (S.mix < 1 && S.prev) { const [px, py] = path(S.prev, o, S.t), k = ease(S.mix); x = lerp(px, x, k); y = lerp(py, y, k); }
        if (o.from) { const k = ease((S.t - o.born) / 1.4); x = lerp(o.from[0], x, k); y = lerp(o.from[1], y, k); if (k >= 1) o.from = null; }
        if (ptr) {                    // pointer acts as a repulsive electrode
          const dx = x - ptr[0], dy = y - ptr[1], d2 = dx * dx + dy * dy + 300;
          if (d2 < 22000) { o.kick.x += dx / d2 * 900 * dt * 60; o.kick.y += dy / d2 * 900 * dt * 60; }
        }
        o.kick.x *= 0.93; o.kick.y *= 0.93; x += o.kick.x; y += o.kick.y;
        const r = 1.6 + 1.6 / o.m;
        if (o.x || o.y) { ctx.strokeStyle = color(o, i, 0.55); ctx.lineWidth = r * 0.9; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(x, y); ctx.stroke(); }
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, color(o, i, 0.95)); g.addColorStop(1, color(o, i, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
        o.x = x; o.y = y;
      });
      ctx.globalCompositeOperation = "source-over";
    }

    function loop(ts) {
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
      step(dt); raf = S.playing ? requestAnimationFrame(loop) : 0;
    }
    const play = on => { S.playing = on; root.querySelector("[data-act=play]").setAttribute("aria-pressed", String(on));
      if (on && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
    const still = () => { ctx.clearRect(0, 0, W, H); ions.forEach(o => { o.x = o.y = 0; });
      for (let k = 0; k < 160; k++) step(1 / 60); };   // static long-exposure frame

    // Controls
    root.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.mode === S.mode) return;
      S.prev = S.mode; S.mode = b.dataset.mode; S.mix = 0; root.dataset.mode = S.mode;
      root.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (!S.playing) still();
    }));
    const on = (sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
    on("[name=speed]", "input", e => { S.speed = +e.target.value; });
    on("[name=ions]", "input", e => { S.count = +e.target.value; setCount(S.count); if (!S.playing) still(); });
    on("[name=palette]", "change", e => { S.palette = e.target.value; if (!S.playing) still(); });
    on("[data-act=trails]", "click", e => { S.trails = !S.trails; e.currentTarget.setAttribute("aria-pressed", String(S.trails)); });
    on("[data-act=play]", "click", () => play(!S.playing));
    on("[data-act=shot]", "click", () => {           /* high-res PNG: render 3 extra frames at 3× */
      const oW = cv.width, oH = cv.height, oD = dpr; dpr = 3; cv.width = W * 3; cv.height = H * 3; ctx.setTransform(3, 0, 0, 3, 0, 0);
      ctx.fillStyle = "#070912"; ctx.fillRect(0, 0, W, H); for (let k = 0; k < 90; k++) step(1 / 60);
      const done = () => { dpr = oD; cv.width = oW; cv.height = oH; ctx.setTransform(oD, 0, 0, oD, 0, 0); };
      if (window.zgExport) zgExport.png(cv, "ion-trace"); else { const a = document.createElement("a"); a.download = "ion-trace.png"; a.href = cv.toDataURL("image/png"); a.click(); }
      setTimeout(done, 50);
    });
    on("[data-act=video]", "click", e => { const b = e.currentTarget; if (!S.playing) play(true); window.zgExport && zgExport.record(cv, 8, "ion-trace-" + S.mode, r => { b.disabled = r; b.classList.toggle("is-rec", r); }); });
    const stage = root.querySelector(".ionhero-stage");
    stage.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); ptr = [e.clientX - r.left, e.clientY - r.top]; });
    stage.addEventListener("pointerleave", () => { ptr = null; });
    stage.addEventListener("click", e => {          // inject a bunch of new ions at the click point
      if (e.target.closest("a,button")) return;
      const r = cv.getBoundingClientRect(), at = [e.clientX - r.left, e.clientY - r.top];
      for (let k = 0; k < 6 && ions.length < 160; k++) ions.push(mkIon(ions.length, at));
      const s = root.querySelector("[name=ions]"); if (s) s.value = S.count = ions.length;
      if (!S.playing) still();
    });
    // Pause when off-screen or tab hidden (saves battery)
    new IntersectionObserver(([en]) => { if (!reduce) play(en.isIntersecting && !root.dataset.paused); }).observe(root);
    on("[data-act=play]", "click", () => { root.dataset.paused = S.playing ? "" : "1"; });
    new ResizeObserver(() => { size(); if (!S.playing) still(); }).observe(cv);

    size(); setCount(S.count);
    root.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.mode === S.mode)));
    if (S.playing) play(true); else { root.querySelector("[data-act=play]").setAttribute("aria-pressed", "false"); still(); }
  }
  const go = () => document.querySelectorAll("[data-ionhero]").forEach(init);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
})();
