import { useEffect, useRef, useState } from "react";
import site from "./data/site.json";

function IonTrace() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;
    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, r.width * dpr);
      c.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const color = () => getComputedStyle(document.documentElement).getPropertyValue("--trace").trim() || "#E0882A";
    const pos = (s: number, w: number) => {
      const rm = w * 0.3, rc = w * 0.11; // magnetron and reduced-cyclotron radii
      const wm = 1, wc = 17.3;          // illustrative frequency ratio
      return [w / 2 + rm * Math.cos(wm * s) + rc * Math.cos(wc * s), w / 2 + rm * Math.sin(wm * s) + rc * Math.sin(wc * s)];
    };
    const draw = () => {
      const w = c.getBoundingClientRect().width;
      ctx.clearRect(0, 0, w, w);
      const col = color();
      const span = reduce ? Math.PI * 2 : 3.2;
      const steps = 600;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < steps; i++) {
        const s0 = t - span + (span * i) / steps;
        const s1 = t - span + (span * (i + 1)) / steps;
        const [x0, y0] = pos(s0, w), [x1, y1] = pos(s1, w);
        ctx.globalAlpha = reduce ? 0.55 : (i / steps) ** 2 * 0.9;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const [hx, hy] = pos(t, w);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill();
      if (!reduce) { t += 0.006; raf = requestAnimationFrame(draw); }
    };
    draw();
    const ro = new ResizeObserver(() => { size(); if (reduce) draw(); });
    ro.observe(c);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}


const siteRoot = new URL(site.config.base_url).pathname;
const localPath = (url:string) => url.startsWith("/") && !url.startsWith("//") ? siteRoot+url.slice(1) : url;
const localHtml = (text:string) => text.replace(/(href|src)="(\/(?!\/)[^"]*)"/g, (_,attr,url) => `${attr}="${localPath(url)}"`);
type Lang = "en" | "zh" | "fi" | "de" | "ja";
const tabs = ["about", "research", "projects", "publications", "talks", "facilities", "daily", "group", "blog", "cv"];
const labels: Record<string, string> = {about:"简介",research:"研究",projects:"项目",publications:"论文",talks:"主要报告",facilities:"设施",daily:"每日",group:"团队",blog:"博客",cv:"简历"};
function prefix(lang:string){const l=site.config.languages.find(l=>l.code===lang);const keys=l&&"theme_keys" in l?l.theme_keys as Record<string,string>:{};return lang==="en"?siteRoot:siteRoot+(keys[site.config.live_theme]||lang)+"/";}
const nodeModules = new Map<string, Promise<void>>();
function script(src:string){
  if(!nodeModules.has(src))nodeModules.set(src,new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=()=>resolve();s.onerror=reject;document.head.append(s);}));
  return nodeModules.get(src)!;
}
function SharedView({tab,lang}:{tab:string;lang:Lang}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const root=ref.current!;root.innerHTML="";delete root.dataset.mounted;let active=true;
    const mount=async()=>{if(tab==="facilities"){await script(localPath("/vendor/leaflet/leaflet.js"));await script(localPath("/vendor/leaflet/markercluster.js"));await script(localPath("/js/atlas.js"));if(active)(window as unknown as {mountFacilityAtlas:(r:HTMLElement)=>void}).mountFacilityAtlas(root);}else{await script(localPath("/js/daily.js"));if(active)(window as unknown as {mountDaily:(r:HTMLElement)=>void}).mountDaily(root);}};
    mount().catch(()=>{if(active)root.textContent=lang==="zh"?"页面资源加载失败，请重新加载。":"Page resources could not load. Reload to retry.";});return()=>{active=false;};
  },[tab,lang]);
  return <div key={tab+lang} ref={ref} data-lang={lang} data-root={siteRoot} data-locale={prefix(lang)}/>;
}
export default function App(){
 const initialLang=new URLSearchParams(location.search).get("lang")||"en";
 const [lang,setLang]=useState<Lang>((["en","zh","fi","de","ja"].includes(initialLang)?initialLang:"en") as Lang);
 const [tab,setTab]=useState(tabs.includes(location.hash.slice(1))?location.hash.slice(1):"about");
 const cfg=site.config,zh=lang==="zh",language=cfg.languages.find(l=>l.code===lang)||cfg.languages[0];
 const pages=site.pages[lang]||site.pages.en;
 const go=(value:string)=>{setTab(value);history.replaceState(null,"","?lang="+lang+"#"+value);};
 const pageKey=tab==="about"?"_index":tab;
 const page=(pages as Record<string,{title:string;html?:string;markdown:string}>)[pageKey];
 const rowLink=(p:{doi?:string;arxiv?:string;url?:string})=>p.doi?"https://doi.org/"+p.doi:p.arxiv?"https://arxiv.org/abs/"+p.arxiv:p.url;
 return <div className="shell"><aside className="side"><div className="side-top"><div className="trace-box"><IonTrace/><div className="monogram">ZG</div></div><div><h1 className="name">{cfg.author}</h1><p className="role">{language.headline}</p></div></div><p><a href={"mailto:"+cfg.email}>{cfg.email}</a></p><div className="links">{cfg.links.map(l=><a className="chip" key={l.icon} href={l.url} rel="noopener">{l.icon}</a>)}</div><label className="language">{zh?"语言":"Language"}<select value={lang} onChange={e=>{const value=e.target.value as Lang;setLang(value);history.replaceState(null,"","?lang="+value+"#"+tab);}}>{cfg.languages.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select></label><p className="note">{zh?"内容来自 Hugo 的统一数据与页面。":"Content generated from the canonical Hugo data and pages."}</p></aside>
 <main><nav className="nav" aria-label={zh?"页面":"Sections"}>{tabs.map(t=><button key={t} aria-current={tab===t?"page":undefined} onClick={()=>go(t)}>{zh?labels[t]:t==="cv"?"CV":t}</button>)}</nav><section className="panel"><h2>{zh?labels[tab]:tab==="talks"?"Main talks":tab.charAt(0).toUpperCase()+tab.slice(1)}</h2>
 {tab==="publications"&&<><p>{site.papers.length} {zh?"篇公开论文":"public publication records"}</p><ol className="records">{site.papers.map(p=><li key={p.doi||p.title}><strong>{p.year}</strong> · <a href={rowLink(p)} dangerouslySetInnerHTML={{__html:p.title_html}}/><p>{p.authors.replace(/[*]/g,"")} · {"journal" in p?p.journal:""} · {p.role}</p></li>)}</ol></>}
 {tab==="talks"&&<><p>{site.talks.length} {zh?"条有公开来源的报告":"talks with public sources"}</p><ol className="records">{site.talks.map(t=><li key={t.date+t.title}><strong>{t.date}</strong> · <a href={t.url} dangerouslySetInnerHTML={{__html:t.title_html}}/><p>{t.event} · {t.place}</p></li>)}</ol></>}
 {(tab==="facilities"||tab==="daily")&&<SharedView key={tab+lang} tab={tab} lang={lang}/>}
 {page&&!["publications","talks","facilities","daily"].includes(tab)&&<div className="prose" dangerouslySetInnerHTML={{__html:localHtml(page.html||"")}}/>}
 {tab==="blog"&&<a href={prefix(lang)+"posts/"}>{zh?"阅读博客":"Read the blog"}</a>}
 {(tab==="about"||tab==="research")&&<div className="canonical-gallery">{site.gallery.images.filter(i=>tab==="research"||("home" in i&&i.home)).map((i,index)=><figure key={index}>{"file" in i?<img src={localPath("/img/gallery/"+i.file)} alt={i.caption[lang]||i.caption.en} loading="lazy"/>:"video" in i?<video controls preload="none" poster={localPath("/img/gallery/"+i.poster)}><source src={localPath("/img/gallery/"+i.video)}/></video>:null}<figcaption>{i.caption[lang]||i.caption.en}{"url" in i&&<><br/><a href={i.url}>{"source" in i?i.source:zh?"来源":"Source"}</a></>}</figcaption></figure>)}</div>}
 </section></main></div>;
}
