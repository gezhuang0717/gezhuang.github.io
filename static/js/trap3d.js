/* 3D Penning trap — rotatable hyperbolic electrodes and a cloud of ions with
   magnetron (ν₋), reduced-cyclotron (ν₊) and axial (ν_z) motion.
   Options: frequency ratio, speed, radii, axial amplitude, trail length, number of ions and mass spread,
   buffer-gas cooling, dipole (ν₋) and quadrupole (ν_c, π-pulse) excitation, view presets, electrode/field/detector toggles. */
(() => {
  const root = document.querySelector("[data-trap3d]");
  if (!root) return;
  const cv = root.querySelector("canvas"), g = cv.getContext("2d");
  const q = n => root.querySelector(`[name="${n}"]`);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ink = (getComputedStyle(document.documentElement).getPropertyValue("--zg-ink") || "").trim() || "#1d2433";
  let yaw = 0.6, pitch = 0.35, zoom = 1, drag = null, t = 0, ions = [], pulse = null, dip = 0;

  function makeIons() {
    const n = +q("ions").value, spread = +q("spread").value / 100;
    ions = Array.from({ length: n }, (_, i) => ({
      m: 1 + spread * (i - (n - 1) / 2) / Math.max(1, n - 1) * 2,   /* relative mass */
      ph: Math.random() * 6.283, phz: Math.random() * 6.283, trail: [],
      rpN: +q("rp").value / 100, rmN: +q("rm").value / 100, az: +q("az").value / 100 * 0.7,  /* normalised radii 0…1 */
    }));
  }
  function P(x, y, z) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
    const d = 5 / (5 + y2), s = Math.min(cv.width, cv.height * 1.3) / 5.6 * zoom * d;
    return [cv.width / 2 + x1 * s, cv.height / 2 - z2 * s];
  }
  /* electrode meshes: ring r²/2 − z² = z0², caps z² − r²/2 = z0² */
  const mesh = [];
  for (let j = 0; j < 12; j++) {
    const ph = j / 12 * 6.283, ring = [], cu = [], cd = [];
    for (let i = 0; i <= 16; i++) {
      const zr = -0.9 + 1.8 * i / 16, rr = Math.sqrt(2 * (1 + zr * zr)), rc = i / 16 * 1.6, zc = Math.sqrt(1 + rc * rc / 2);
      ring.push([rr * Math.cos(ph), rr * Math.sin(ph), zr]); cu.push([rc * Math.cos(ph), rc * Math.sin(ph), zc]); cd.push([rc * Math.cos(ph), rc * Math.sin(ph), -zc]);
    }
    mesh.push(["ring", ring], ["cap", cu], ["cap", cd]);
  }
  for (let m = 0; m <= 4; m++) {
    const zr = -0.9 + m * 0.45, rr = Math.sqrt(2 * (1 + zr * zr)), rc = m * 0.4, zc = Math.sqrt(1 + rc * rc / 2), a = [], b = [], c = [];
    for (let k = 0; k <= 48; k++) { const p = k / 48 * 6.283; a.push([rr * Math.cos(p), rr * Math.sin(p), zr]); b.push([rc * Math.cos(p), rc * Math.sin(p), zc]); c.push([rc * Math.cos(p), rc * Math.sin(p), -zc]); }
    mesh.push(["ring", a], ["cap", b], ["cap", c]);
  }
  const line = (pts, style, w = 1) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => { const s = P(...p); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.stroke(); };

  function step(dt) {
    const ratio = +q("ratio").value, wm = 0.3, cool = q("cool").checked;
    ions.forEach(o => {
      const wp = wm * ratio / o.m, wz = Math.sqrt(2 * wm * wp);
      if (cool) { o.rpN *= 1 - 0.004 * dt * 60; o.az *= 1 - 0.003 * dt * 60; o.rmN = Math.min(1.3, o.rmN * (1 + 0.0004 * dt * 60)); }
      if (dip > 0) o.rmN = Math.min(1.3, o.rmN + 0.004 * dt * 60);
      if (pulse) {                     /* quadrupole at ν_c of the reference mass: full conversion only on resonance */
        if (o.p0 == null) { o.p0 = o.rpN; o.m0 = o.rmN; }
        const f = Math.min(1, (t - pulse.t0) / 8), eff = Math.exp(-Math.pow((o.m - 1) * 30, 2)), th = f * Math.PI / 2 * eff;
        o.rmN = o.m0 * Math.cos(th); o.rpN = Math.sqrt(o.p0 * o.p0 + Math.pow(o.m0 * Math.sin(th), 2));
      }
      const rp = o.rpN * 0.35, rm = o.rmN * 0.8;
      const x = rm * Math.cos(wm * t + o.ph) + rp * Math.cos(wp * t), y = rm * Math.sin(wm * t + o.ph) + rp * Math.sin(wp * t), z = o.az * Math.cos(wz * t + o.phz);
      o.trail.push([x, y, z]); const L = +q("trail").value; while (o.trail.length > L) o.trail.shift();
    });
    if (pulse && t - pulse.t0 > 8) { pulse = null; ions.forEach(o => { delete o.p0; delete o.m0; }); }
    if (dip > 0) dip -= dt;
    t += dt;
  }
  function draw() {
    g.clearRect(0, 0, cv.width, cv.height);
    if (q("auto").checked && !drag && !reduce) yaw += 0.004;
    if (q("electrodes").checked) mesh.forEach(([k, pts]) => line(pts, k === "ring" ? "rgba(214,140,40,.5)" : "rgba(90,120,220,.45)"));
    if (q("field").checked) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; line([[1.9 * Math.cos(a), 1.9 * Math.sin(a), -1.9], [1.9 * Math.cos(a), 1.9 * Math.sin(a), 1.9]], "rgba(120,120,140,.35)"); }
    line([[0, 0, -2], [0, 0, 2]], ink, 1.5); const b = P(0, 0, 2); g.fillStyle = ink; g.font = "13px system-ui"; g.fillText("B", b[0] + 6, b[1]);
    if (q("detector").checked) {            /* PI-ICR-like projection onto a detector plane below the trap */
      const zD = -2.1; line([[-1.4, -1.4, zD], [1.4, -1.4, zD], [1.4, 1.4, zD], [-1.4, 1.4, zD], [-1.4, -1.4, zD]], "rgba(229,72,77,.5)");
      ions.forEach((o, k) => { const p = o.trail[o.trail.length - 1]; if (!p) return; const s = P(p[0] * 1.3, p[1] * 1.3, zD); g.fillStyle = `hsla(${k / ions.length * 300},85%,50%,.8)`; g.beginPath(); g.arc(s[0], s[1], 3, 0, 6.283); g.fill(); });
    }
    ions.forEach((o, k) => {
      const hue = ions.length > 1 ? k / (ions.length - 1) * 300 : null;
      for (let n = 1; n < o.trail.length; n++) {
        const a = P(...o.trail[n - 1]), c = P(...o.trail[n]), f = n / o.trail.length;
        g.strokeStyle = `hsla(${hue ?? f * 300},85%,55%,${0.08 + 0.9 * f})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke();
      }
      const e = o.trail[o.trail.length - 1]; if (e) { const s = P(...e); g.fillStyle = hue == null ? "#e5484d" : `hsl(${hue},85%,45%)`; g.beginPath(); g.arc(s[0], s[1], 4.5, 0, 6.283); g.fill(); }
    });
  }
  function loop() { for (let k = 0; k < (reduce ? 1 : +q("speed").value); k++) step(0.02); draw(); requestAnimationFrame(loop); }

  cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (drag) { yaw = drag[2] + (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.5, Math.min(1.5, drag[3] + (e.clientY - drag[1]) * 0.01)); } });
  cv.addEventListener("pointerup", () => { drag = null; });
  cv.addEventListener("wheel", e => { e.preventDefault(); zoom = Math.max(0.5, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  root.addEventListener("click", e => {
    const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
    if (a === "pulse") pulse = { t0: t };
    if (a === "dipole") dip = 3;
    if (a === "reset") { yaw = 0.6; pitch = 0.35; zoom = 1; makeIons(); }
    if (a === "top") { pitch = 1.5; q("auto").checked = false; }
    if (a === "side") { pitch = 0; q("auto").checked = false; }
    if (a === "iso") { pitch = 0.35; yaw = 0.6; }
  });
  ["ions", "spread", "rp", "rm", "az"].forEach(n => q(n).addEventListener("input", makeIons));
  root.querySelectorAll("input[type=range]").forEach(r => { const o = r.parentElement.querySelector("output"); if (o) { const u = () => (o.textContent = r.value); r.addEventListener("input", u); u(); } });
  new ResizeObserver(() => { const w = Math.round(cv.getBoundingClientRect().width); if (w && Math.abs(w - cv.width) > 4) { cv.width = w; cv.height = Math.round(w * 0.78); } }).observe(cv);
  makeIons(); requestAnimationFrame(loop);
})();
