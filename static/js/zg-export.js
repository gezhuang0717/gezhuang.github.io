/* Shared public export helpers. Browser viewport size never defines requested export dimensions.
   Existing API remains compatible: png(render,name,scale), csv(header,rows,name), record(canvas,seconds,name,onState).
   New API: pngSize(draw,name,{width_px,height_px}), json(name,obj), bundle(...), csvObjects(...).
   Video resolution is the actual canvas width x height; bitrate controls compression only. */
(() => {
  if (window.zgExport) return;
  const save = (blob, name) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const stable = obj => Array.isArray(obj) ? obj.map(stable) : obj && typeof obj === "object" ? Object.fromEntries(Object.keys(obj).sort().map(k => [k, stable(obj[k])])) : obj;
  const q = v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const csvText = rows => "\ufeff" + rows.map(r => r.map(q).join(",")).join("\r\n");
  window.zgExport = {
    save, stamp,
    png(render, name, scale = 4) { const c = typeof render === "function" ? render(scale) : render; c.toBlob(b => b && save(b, `${name}-${stamp()}.png`), "image/png"); },
    pngSize(draw, name, { width_px = 2000, height_px = 1500 } = {}) {
      if (!(width_px > 0 && height_px > 0)) throw new Error("positive export dimensions required");
      const c = document.createElement("canvas"); c.width = Math.round(width_px); c.height = Math.round(height_px);
      draw(c.getContext("2d"), c.width, c.height, c);
      c.toBlob(b => b && save(b, `${name}-${c.width}x${c.height}-${stamp()}.png`), "image/png"); return c;
    },
    csv(header, rows, name) { save(new Blob([csvText([header, ...rows])], { type: "text/csv;charset=utf-8" }), `${name}-${stamp()}.csv`); },
    csvObjects(rows, columns, name) { this.csv(columns, rows.map(r => columns.map(c => r[c])), name); },
    json(name, obj) { save(new Blob([JSON.stringify(stable(obj), null, 2) + "\n"], { type: "application/json" }), `${name}-${stamp()}.json`); },
    bundle({ view = {}, provenance = {}, render = {}, seed = null } = {}) { return { schema: "zg-figure-bundle-v1", view: stable(view), provenance: stable(provenance), render: stable(render), seed }; },
    record(canvas, seconds, name, onState, options = {}) {
      if (!canvas.captureStream || !window.MediaRecorder) { alert("Video recording is not supported in this browser."); return; }
      const fps = options.fps || 30, bitrate = options.bitrate || 12e6;
      const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"], type = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(canvas.captureStream(fps), { mimeType: type, videoBitsPerSecond: bitrate }), parts = [];
      rec.zgVideo = { width_px: canvas.width, height_px: canvas.height, fps, bitrate, mimeType: type || "video/webm" };
      rec.ondataavailable = ev => ev.data.size && parts.push(ev.data);
      rec.onstop = () => { save(new Blob(parts, { type: type || "video/webm" }), `${name}-${canvas.width}x${canvas.height}-${stamp()}.webm`); onState && onState(false); };
      rec.start(); onState && onState(true); setTimeout(() => rec.state !== "inactive" && rec.stop(), seconds * 1000); return rec;
    },
    button(label, onClick) { const b = document.createElement("button"); b.type = "button"; b.className = "zg-btn"; b.textContent = label; b.addEventListener("click", onClick); return b; }
  };
})();
