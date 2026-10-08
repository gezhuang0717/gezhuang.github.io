/* Shared export helpers for the site's canvases and data tables.
   window.zgExport.png(render, name)   render(scale) → canvas drawn at `scale`× resolution (high-quality PNG)
   window.zgExport.csv(header, rows, name)
   window.zgExport.record(canvas, seconds, name, onState)   WebM video of a live canvas (MediaRecorder)
   window.zgExport.button(label, onClick) → <button>                                                   */
(() => {
  if (window.zgExport) return;
  const save = (blob, name) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  window.zgExport = {
    save, stamp,
    png(render, name, scale = 4) {
      const c = typeof render === "function" ? render(scale) : render;
      c.toBlob(b => save(b, `${name}-${stamp()}.png`), "image/png");
    },
    csv(header, rows, name) {
      const q = v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const text = "﻿" + [header, ...rows].map(r => r.map(q).join(",")).join("\r\n");
      save(new Blob([text], { type: "text/csv;charset=utf-8" }), `${name}-${stamp()}.csv`);
    },
    record(canvas, seconds, name, onState) {
      if (!canvas.captureStream || !window.MediaRecorder) { alert("Video recording is not supported in this browser."); return; }
      const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
      const type = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(canvas.captureStream(60), { mimeType: type, videoBitsPerSecond: 25e6 }), parts = [];
      rec.ondataavailable = e => e.data.size && parts.push(e.data);
      rec.onstop = () => { save(new Blob(parts, { type: type || "video/webm" }), `${name}-${stamp()}.${type.includes("mp4") ? "mp4" : "webm"}`); onState && onState(false); };
      rec.start(); onState && onState(true);
      setTimeout(() => rec.state !== "inactive" && rec.stop(), seconds * 1000);
      return rec;
    },
  };
})();
