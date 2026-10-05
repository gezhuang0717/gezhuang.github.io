/* Explanation pop-ups for physics terms.
   Data comes from <script id="zg-gloss-data"> (built by layouts/_partials/zg/glossary.html from data/glossary.yaml).
   • the first occurrence of each term in the main text is underlined (dotted, rainbow on hover)
   • hover (desktop) or tap/click/Enter shows a card: name, short explanation, links to Wikipedia
     (page language + English), Baidu Baike on Chinese pages, and any extra sources
   • manual use in Markdown:  {{< term "penning-trap" >}}  or  <span class="zg-term" data-term="penning-trap">…</span>
   • skip a block:  data-noglossary                                                                            */
(() => {
  const el = document.getElementById("zg-gloss-data");
  if (!el || window.__zgGloss) return; window.__zgGloss = true;
  let terms, L;
  try { terms = JSON.parse(el.textContent); L = JSON.parse(el.dataset.labels || "{}"); } catch (e) { return; }
  const lang = el.dataset.lang || "en";
  const cjk = lang === "zh" || lang === "ja";
  const byId = Object.fromEntries(terms.map(t => [t.id, t]));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /* ---------- 1. underline the first occurrence of each term ---------- */
  const SKIP = "a,button,code,pre,kbd,samp,script,style,textarea,select,option,input,label,summary,canvas,svg," +
    "h1,h2,h3,h4,h5,h6,nav,header,footer,.zg-term,.zg-gloss-pop,[data-noglossary],.zg-hero,#zg-ion-hero";
  const BLOCK = "p,li,dd,dt,td,blockquote,figcaption";
  const pairs = [];
  terms.forEach((t, i) => (t.m || []).forEach(s => s && pairs.push([s, i])));
  pairs.sort((a, b) => b[0].length - a[0].length);
  if (pairs.length) {
    const alt = pairs.map(p => reEsc(p[0])).join("|");
    let re;
    try {
      re = cjk ? new RegExp(`(${alt})`, "giu")
               : new RegExp(`(?<![\\p{L}\\p{N}])(${alt})(\\p{L}*)`, "giu");
    } catch (e) { re = new RegExp(`(${alt})`, "gi"); }
    const lower = new Map(pairs.map(([s, i]) => [s.toLowerCase(), i]));
    const used = new Set();
    const root = document.querySelector("main") || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest(SKIP) || !p.closest(BLOCK)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (used.size === terms.length) break;
      const text = node.nodeValue; re.lastIndex = 0;
      const hits = []; let m;
      while ((m = re.exec(text))) {
        const i = lower.get(m[1].toLowerCase());
        if (i == null || used.has(i)) continue;
        used.add(i); hits.push([m.index, m[0].length, i]);
      }
      if (!hits.length) continue;
      const frag = document.createDocumentFragment(); let pos = 0;
      for (const [at, len, i] of hits) {
        frag.appendChild(document.createTextNode(text.slice(pos, at)));
        const sp = document.createElement("span");
        sp.className = "zg-term"; sp.dataset.term = terms[i].id; sp.textContent = text.slice(at, at + len);
        frag.appendChild(sp); pos = at + len;
      }
      frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    }
  }
  document.querySelectorAll(".zg-term[data-term]").forEach(sp => {
    if (!byId[sp.dataset.term]) { sp.classList.remove("zg-term"); return; }
    sp.tabIndex = 0; sp.setAttribute("role", "button"); sp.setAttribute("aria-haspopup", "dialog");
    if (!sp.textContent.trim()) sp.textContent = byId[sp.dataset.term].n;
  });

  /* ---------- 2. the pop-up card ---------- */
  const pop = document.createElement("div");
  pop.className = "zg-gloss-pop"; pop.setAttribute("role", "dialog"); pop.hidden = true;
  document.body.appendChild(pop);
  const wiki = (l, title) => `https://${l}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}&go=Go`;
  let cur = null, hideT = 0, showT = 0;

  function render(t) {
    const links = [];
    links.push([L.wiki || "Wikipedia", wiki(lang, t.w)]);
    if (lang !== "en") links.push([L.wikien || "English Wikipedia", wiki("en", t.we)]);
    if (lang === "zh") links.push([L.baike || "百度百科", `https://baike.baidu.com/search/word?word=${encodeURIComponent(t.nz || t.n)}`]);
    (t.s || []).forEach(s => links.push([s[0], s[1]]));
    const sub = lang !== "en" && t.ne && t.ne !== t.n ? `<span class="zg-gloss-en">${esc(t.ne)}</span>` : "";
    pop.innerHTML =
      `<button type="button" class="zg-gloss-x" aria-label="${esc(L.close || "Close")}">×</button>` +
      `<div class="zg-gloss-h">${esc(t.n)}${sub}</div>` +
      `<p class="zg-gloss-t">${esc(t.t)}</p>` +
      `<div class="zg-gloss-l">${links.map(([a, u]) =>
        `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(a)} ↗</a>`).join("")}</div>`;
    pop.querySelector(".zg-gloss-x").onclick = hide;
  }
  function place(anchor) {
    const r = anchor.getBoundingClientRect(), W = Math.min(340, innerWidth - 24);
    pop.style.width = W + "px";
    let x = r.left + scrollX + r.width / 2 - W / 2;
    x = Math.max(scrollX + 12, Math.min(x, scrollX + innerWidth - W - 12));
    const h = pop.offsetHeight;
    const below = r.bottom + 8 + h < innerHeight || r.top < h + 16;
    pop.style.left = x + "px";
    pop.style.top = (below ? r.bottom + scrollY + 8 : r.top + scrollY - h - 8) + "px";
    pop.dataset.side = below ? "below" : "above";
  }
  function show(sp) {
    clearTimeout(hideT);
    const t = byId[sp.dataset.term]; if (!t) return;
    if (cur === sp && !pop.hidden) return;
    cur = sp; render(t); pop.hidden = false; place(sp);
    document.querySelectorAll(".zg-term.on").forEach(e => e.classList.remove("on")); sp.classList.add("on");
  }
  function hide() {
    pop.hidden = true; if (cur) cur.classList.remove("on"); cur = null;
  }
  const hover = matchMedia("(hover: hover)").matches;
  document.addEventListener("mouseover", e => {
    if (!hover) return;
    const sp = e.target.closest && e.target.closest(".zg-term");
    if (sp) { clearTimeout(hideT); clearTimeout(showT); showT = setTimeout(() => show(sp), 180); }
    else if (e.target.closest && e.target.closest(".zg-gloss-pop")) clearTimeout(hideT);
  });
  document.addEventListener("mouseout", e => {
    if (!hover) return;
    const from = e.target.closest && (e.target.closest(".zg-term") || e.target.closest(".zg-gloss-pop"));
    if (!from) return;
    const to = e.relatedTarget;
    if (to && to.closest && (to.closest(".zg-gloss-pop") || to.closest(".zg-term") === cur)) return;
    clearTimeout(showT); hideT = setTimeout(hide, 280);
  });
  document.addEventListener("click", e => {
    const sp = e.target.closest && e.target.closest(".zg-term");
    if (sp) { e.preventDefault(); (cur === sp && !pop.hidden) ? hide() : show(sp); return; }
    if (!pop.hidden && !(e.target.closest && e.target.closest(".zg-gloss-pop"))) hide();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !pop.hidden) { const c = cur; hide(); c && c.focus(); }
    const sp = e.target.closest && e.target.closest(".zg-term");
    if (sp && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); show(sp); }
  });
  addEventListener("resize", () => { if (!pop.hidden && cur) place(cur); });
})();
