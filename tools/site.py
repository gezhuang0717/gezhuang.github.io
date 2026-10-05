#!/usr/bin/env python3
"""
site.py — one command-line tool for the whole personal website.

Run from the repository root:   python3 tools/site.py <command> [options]
Every command prints what it changed. `python3 tools/site.py <command> -h`
shows the options of a command.

INDIVIDUAL MODE (one item at a time)
  add          add one daily entry (science log, news, paper, job, event)
  remove       remove daily entries that match a date and a title fragment
  list         show daily entries for a day or month
  pub-add      add one publication by typing its fields
  pub-doi      add one publication by DOI (metadata fetched from Crossref)
  talk-add     add one talk
  post         create a blog post in one or more languages

BATCH MODE (many items at once)
  batch        import many daily entries from a CSV / YAML / JSON file
  pub-batch    import many publications from a CSV file
  fetch        download today's papers / jobs / news from the feeds in
               tools/feeds.yaml (the daily GitHub Action runs this)
  config       regenerate all theme configs from site.yaml
  export-react write one JSON with papers, talks and daily entries for the
               React version of the site
  check        validate all data files (run before pushing; CI runs it too)

Only dependency: PyYAML  (pip install pyyaml)
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import shutil
import sys
import textwrap
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import mistune
from pathlib import Path

try:
    import yaml
    import maintenance
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required:  pip install pyyaml   (or: python3 -m pip install --user pyyaml)")

ROOT = maintenance.ROOT
DATA = ROOT / "data"
MANUAL_DIR = DATA / "daily" / "manual"
AUTO_DIR = DATA / "daily" / "auto"
PUBS = DATA / "publications.yaml"
TALKS = DATA / "talks.yaml"
SITE = ROOT / "site.yaml"
FEEDS = ROOT / "tools" / "feeds.yaml"

TYPES = ["log", "news", "paper", "preprint", "job", "event"]
ROLES = ["first", "corresponding", "coauthor"]
THEMES = ["congo", "blowfish", "papermod"]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
USER_AGENT = "gezhuang0717.github.io daily updater (mailto:zhuang.z.ge@jyu.fi)"


# ───────────────────────────── YAML helpers ──────────────────────────────────
class _Dumper(yaml.SafeDumper):
    """Keeps key order, writes Unicode, indents lists under their key."""

    def increase_indent(self, flow=False, indentless=False):  # noqa: D401
        return super().increase_indent(flow, False)


def _str_presenter(dumper, value):
    style = "|" if "\n" in value else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style=style)


_Dumper.add_representer(str, _str_presenter)


def load_yaml(path: Path, default=None):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return default if data is None else data


def header_of(path: Path) -> str:
    """Return the leading comment block of a YAML file so rewrites keep it."""
    if not path.exists():
        return ""
    lines = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or not line.strip():
            lines.append(line)
        else:
            break
    return "\n".join(lines).rstrip() + "\n" if lines else ""


def dump_yaml(path: Path, data, header: str = ""):
    path.parent.mkdir(parents=True, exist_ok=True)
    body = yaml.dump(data, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=1000)
    maintenance.transaction({str(path.relative_to(ROOT)): header + body})


def today() -> str:
    return dt.date.today().isoformat()


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


# ───────────────────────────── daily entries ─────────────────────────────────
def clean_entry(raw: dict, default_date: str | None = None) -> dict:
    """Normalise one daily entry and raise ValueError if it is invalid."""
    e = {k: v for k, v in raw.items() if v not in (None, "", [])}
    e["date"] = str(e.get("date") or default_date or today()).strip()
    if not DATE_RE.match(e["date"]):
        raise ValueError(f"date must be YYYY-MM-DD, got {e['date']!r}")
    e["type"] = str(e.get("type", "log")).strip().lower()
    if e["type"] not in TYPES:
        raise ValueError(f"type must be one of {TYPES}, got {e['type']!r}")
    if not str(e.get("title", "")).strip():
        raise ValueError("title is required")
    e["title"] = str(e["title"]).strip()
    tags = e.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in re.split(r"[;,]", tags) if t.strip()]
    if tags:
        e["tags"] = [str(t) for t in tags]
    else:
        e.pop("tags", None)
    order = ["date", "type", "title", "summary", "url", "source", "tags", "lang"]
    return {k: e[k] for k in order if k in e} | {k: v for k, v in e.items() if k not in order}


def month_file(date: str) -> Path:
    return MANUAL_DIR / f"{date[:7]}.yaml"


MONTH_HEADER = (
    "# Daily entries written by hand (one file per month: YYYY-MM.yaml).\n"
    "# Fields: date (YYYY-MM-DD), type (log|news|paper|job|event), title,\n"
    "#         summary, url, source, tags (list), lang (optional)\n"
)


def save_entries(entries: list[dict]) -> list[str]:
    """Merge entries into the monthly manual files. Returns change messages."""
    report = maintenance.merge_daily(entries, root=ROOT)
    return [f"  updated {e['path']} ({e['new_sha256'][:12]})" for e in report]


def all_entries() -> list[dict]:
    out = []
    for path in sorted(p for p in MANUAL_DIR.glob("*.yaml") if not p.name.startswith("._")):
        for e in (load_yaml(path, {}) or {}).get("entries", []) or []:
            out.append({**e, "_origin": "manual", "_file": rel(path)})
    for path in sorted(p for p in AUTO_DIR.glob("*.json") if not p.name.startswith("._")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        for e in doc.get("entries", []):
            out.append({**e, "_origin": "auto", "_file": rel(path)})
    out.sort(key=lambda e: e.get("date", ""), reverse=True)
    return out


def cmd_add(a):
    e = clean_entry({"date": a.date, "type": a.type, "title": a.title, "summary": a.summary,
                     "url": a.url, "source": a.source, "tags": a.tags, "lang": a.lang,
                     "item_id": a.item_id, "facility_ids": a.facility_id,
                     "published": a.published, "event_start": a.event_start,
                     "event_end": a.event_end, "deadline": a.deadline})
    print(json.dumps(maintenance.merge_daily([e], root=ROOT, dry_run=a.dry_run), indent=2))


def cmd_remove(a):
    path = month_file(a.date)
    doc = load_yaml(path, {}) or {}
    entries = doc.get("entries", []) or []
    keep = [e for e in entries if not (e.get("date") == a.date and a.match.lower() in e.get("title", "").lower())]
    removed = len(entries) - len(keep)
    if removed == 0:
        print(f"Nothing matched '{a.match}' on {a.date} in {rel(path)}. (Automatic entries live in {rel(AUTO_DIR)}.)")
        return
    if not a.yes:
        print(f"Would remove {removed} entr{'y' if removed == 1 else 'ies'}; add --yes to confirm.")
        return
    dump_yaml(path, {"entries": keep}, header_of(path) or MONTH_HEADER)
    print(f"Removed {removed} entr{'y' if removed == 1 else 'ies'} from {rel(path)}")


def cmd_list(a):
    key = a.when or today()[:7]
    rows = [e for e in all_entries() if e.get("date", "").startswith(key)]
    if a.type:
        rows = [e for e in rows if e.get("type") == a.type]
    if not rows:
        print(f"No entries for {key}.")
    for e in rows:
        print(f"{e['date']}  {e['type']:<6} {e['title']}  [{e['_origin']}: {e['_file']}]")


def read_table(path: Path) -> list[dict]:
    """Read CSV, TSV, YAML or JSON into a list of dicts."""
    suffix = path.suffix.lower()
    if suffix in (".csv", ".tsv"):
        with path.open(encoding="utf-8-sig", newline="") as fh:
            return list(csv.DictReader(fh, delimiter="\t" if suffix == ".tsv" else ","))
    if suffix in (".yaml", ".yml"):
        doc = load_yaml(path, [])
    elif suffix == ".json":
        doc = json.loads(path.read_text(encoding="utf-8"))
    else:
        sys.exit(f"Unsupported file type {suffix}: use .csv, .tsv, .yaml or .json")
    if isinstance(doc, dict):
        doc = doc.get("entries") or doc.get("papers") or doc.get("talks") or []
    return list(doc)


def cmd_batch(a):
    rows = read_table(Path(a.file))
    good = [clean_entry(row) for row in rows]
    report = maintenance.merge_daily(good, root=ROOT, dry_run=a.dry_run)
    print(json.dumps({"dry_run": a.dry_run, "records": len(good), "changes": report}, indent=2))


# ───────────────────────────── automatic feeds ───────────────────────────────
def http_get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _text(el, path, ns):
    found = el.find(path, ns)
    return (found.text or "").strip() if found is not None and found.text else ""


def _short(text: str, n: int = 280) -> str:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()
    return text if len(text) <= n else text[: n - 1].rsplit(" ", 1)[0] + "…"


def _match(text: str, include: list[str], exclude: list[str]) -> bool:
    low = text.lower()
    if include and not any(k.lower() in low for k in include):
        return False
    return not any(k.lower() in low for k in exclude)


def fetch_arxiv(feed, day):
    q = urllib.parse.urlencode({"search_query": feed["query"], "sortBy": "submittedDate",
                                "sortOrder": "descending", "max_results": feed.get("max", 25)})
    root = ET.fromstring(http_get("https://export.arxiv.org/api/query?" + q))
    ns = {"a": "http://www.w3.org/2005/Atom"}
    since = (dt.date.fromisoformat(day) - dt.timedelta(days=feed.get("days", 3))).isoformat()
    out = []
    for item in root.findall("a:entry", ns):
        published = _text(item, "a:published", ns)[:10]
        if published and published < since:
            continue
        title = _short(_text(item, "a:title", ns), 300)
        summary = _text(item, "a:summary", ns)
        if not _match(title + " " + summary, feed.get("include", []), feed.get("exclude", [])):
            continue
        authors = [_text(x, "a:name", ns) for x in item.findall("a:author", ns)]
        lead = authors[0] + (" et al." if len(authors) > 1 else "") if authors else ""
        out.append({"date": day, "type": feed.get("type", "paper"), "title": title,
                    "summary": _short(f"{lead} — {summary}" if lead else summary),
                    "url": _text(item, "a:id", ns).replace("http://", "https://"),
                    "source": feed["name"], "tags": feed.get("tags", []), "published": published, "arxiv": _text(item, "a:id", ns).rsplit("/",1)[-1]})
    return out


def fetch_inspire_jobs(feed, day):
    q = urllib.parse.urlencode({"sort": "mostrecent", "size": feed.get("max", 50), "q": feed.get("query", "status:open")})
    doc = json.loads(http_get("https://inspirehep.net/api/jobs?" + q))
    since = (dt.date.fromisoformat(day) - dt.timedelta(days=feed.get("days", 3))).isoformat()
    cats = set(feed.get("categories", []))
    out = []
    for hit in doc.get("hits", {}).get("hits", []):
        md = hit.get("metadata", {})
        created = str(hit.get("created", md.get("created", "")))[:10]
        if created and created < since:
            continue
        if cats and not cats.intersection(md.get("arxiv_categories", [])):
            continue
        desc = md.get("description", "")
        position = md.get("position", "Position")
        inst = ", ".join(i.get("value", "") for i in md.get("institutions", []))
        if not _match(f"{position} {desc} {inst}", feed.get("include", []), feed.get("exclude", [])):
            continue
        extra = " · ".join(x for x in [", ".join(md.get("regions", [])),
                                        f"deadline {md['deadline_date']}" if md.get("deadline_date") else "",
                                        "/".join(md.get("ranks", []))] if x)
        out.append({"date": day, "type": "job", "title": f"{position} — {inst}" if inst else position,
                    "summary": _short(f"{extra}. {desc}" if extra else desc),
                    "url": f"https://inspirehep.net/jobs/{md.get('control_number', hit.get('id'))}",
                    "source": feed["name"], "tags": feed.get("tags", []), **({"published":created} if created else {}), **({"deadline":md["deadline_date"][:10]} if md.get("deadline_date") else {})})
    return out


def fetch_rss(feed, day):
    """RSS 2.0, RSS 1.0/RDF (e.g. APS Physics) and Atom feeds."""
    root = ET.fromstring(http_get(feed["url"]))

    def local(tag):
        return tag.rsplit("}", 1)[-1]

    def child(el, name):
        for c in el:
            if local(c.tag) == name:
                return c
        return None

    def ctext(el, *names):
        for n in names:
            c = child(el, n)
            if c is not None and (c.text or "").strip():
                return c.text.strip()
        return ""

    items = [el for el in root.iter() if local(el.tag) in ("item", "entry")]
    out = []
    for item in items[: feed.get("max", 30)]:
        title = ctext(item, "title")
        link = ctext(item, "link")
        if not link:
            le = child(item, "link")
            link = le.get("href", "") if le is not None else ""
        if not link:
            link = item.get("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about", "")
        desc = ctext(item, "description", "summary", "encoded")
        if not title or not _match(title + " " + desc, feed.get("include", []), feed.get("exclude", [])):
            continue
        published = ctext(item, "pubDate", "published", "date", "updated")
        if published:
            try:
                published = dt.datetime.fromisoformat(published.replace("Z", "+00:00")).date().isoformat()
            except ValueError:
                from email.utils import parsedate_to_datetime
                try:
                    published = parsedate_to_datetime(published).date().isoformat()
                except (ValueError, TypeError):
                    published = ""
        out.append({"date": day, "type": feed.get("type", "news"), "title": _short(title, 300),
                    "summary": _short(desc), "url": link, "source": feed["name"], "tags": feed.get("tags", []),
                    **({"published": published} if published else {})})
    return out


FETCHERS = {"arxiv": fetch_arxiv, "inspire_jobs": fetch_inspire_jobs, "rss": fetch_rss}


def known_urls() -> set[str]:
    return {e.get("url") for e in all_entries() if e.get("url")}


def cmd_fetch(a):
    day = a.date or today()
    dt.date.fromisoformat(day)
    cfg = load_yaml(FEEDS, {}) or {}
    seen = {(maintenance.item_identity(e), e.get("lang", "en")) for e in all_entries()}
    collected, report = [], []
    fs = maintenance.facilities(ROOT)
    for feed in cfg.get("feeds", []):
        if not feed.get("enabled", True):
            continue
        name = feed.get("name", feed.get("kind"))
        try:
            items = FETCHERS[feed["kind"]](feed, day)
            fresh = []
            for e in items:
                e["lang"] = "en"
                e["collected_at"] = day
                e["verification_status"] = "feed-collected"
                text = (e["title"] + " " + e.get("summary", "")).casefold()
                e["facility_ids"] = [f["id"] for f in fs if any(re.search(r"\b" + re.escape(alias.casefold()) + r"\b", text) for alias in f.get("daily_aliases", []))]
                maintenance.validate_daily(e, {f["id"] for f in fs})
                key = (maintenance.item_identity(e), "en")
                if key not in seen:
                    fresh.append(clean_entry(e)); seen.add(key)
            collected.extend(fresh[:feed.get("keep", 10)])
            report.append({"source": name, "status": "PASS", "matched": len(items), "new": len(fresh[:feed.get("keep",10)])})
        except Exception as err:
            report.append({"source": name, "status": "FAILED", "error": str(err)})
    health = {"checked_at": maintenance.utc(), "feeds": report}
    print(json.dumps(health, ensure_ascii=False, indent=2))
    if a.dry_run:
        print(f"Dry run: {len(collected)} new entries, no writes.")
        return
    path = AUTO_DIR / f"{day}.json"
    doc = json.loads(path.read_text()) if path.exists() else {"entries": []}
    doc["fetched"] = maintenance.utc()
    doc["entries"] += collected
    changes = {"data/daily/feed-health.json": maintenance.serialized("x.json", health)}
    if collected:
        changes[str(path.relative_to(ROOT))] = maintenance.serialized("x.json", doc)
    maintenance.transaction(changes, root=ROOT)
    print(f"Saved source health and {len(collected)} entries.")


# ───────────────────────────── publications / talks ──────────────────────────
PUB_ORDER = ["role", "position", "highlight", "year", "authors", "title", "journal", "volume", "pages",
             "doi", "arxiv", "url", "note", "themes"]


def clean_pub(raw: dict) -> dict:
    p = {k: v for k, v in raw.items() if v not in (None, "", [])}
    p["role"] = str(p.get("role", "coauthor")).strip().lower()
    if p["role"] not in ROLES:
        raise ValueError(f"role must be one of {ROLES}")
    if not str(p.get("title", "")).strip():
        raise ValueError("title is required")
    try:
        p["year"] = int(p.get("year"))
    except (TypeError, ValueError):
        raise ValueError("year must be a number") from None
    if "position" in p:
        p["position"] = int(p["position"])
    for key in ("volume", "pages", "doi", "arxiv"):
        if key in p:
            p[key] = str(p[key]).strip()
    if "doi" in p:
        p["doi"] = re.sub(r"^https?://(dx\.)?doi\.org/", "", p["doi"])
    if isinstance(p.get("themes"), str):
        p["themes"] = [t.strip() for t in re.split(r"[;,]", p["themes"]) if t.strip()]
    if str(p.get("highlight", "")).lower() in ("true", "yes", "1"):
        p["highlight"] = True
    else:
        p.pop("highlight", None)
    return {k: p[k] for k in PUB_ORDER if k in p} | {k: v for k, v in p.items() if k not in PUB_ORDER}


def save_pubs(new: list[dict]):
    doc = load_yaml(PUBS, {}) or {}
    papers = doc.get("papers", []) or []
    have = {(str(p.get("doi", "")).lower(), p.get("title", "").lower()) for p in papers}
    added = 0
    for p in new:
        key = (str(p.get("doi", "")).lower(), p["title"].lower())
        dup = (p.get("doi") and any(h[0] == key[0] for h in have)) or any(h[1] == key[1] for h in have)
        if dup:
            print(f"  skip (already present): {p['title'][:70]}")
            continue
        papers.append(p)
        have.add(key)
        added += 1
        print(f"  + [{p['role']}] {p['year']} {p['title'][:70]}")
    rank = {r: i for i, r in enumerate(ROLES)}
    papers.sort(key=lambda p: (rank.get(p.get("role"), 9), -int(p.get("year", 0))))
    dump_yaml(PUBS, {"papers": papers}, header_of(PUBS))
    print(f"{added} publication(s) added to {rel(PUBS)}")


def cmd_pub_add(a):
    fields = {k: v for k, v in vars(a).items() if k not in ("func", "cmd")}
    save_pubs([clean_pub(fields)])


def cmd_pub_doi(a):
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", a.doi.strip())
    msg = json.loads(http_get("https://api.crossref.org/works/" + urllib.parse.quote(doi)))["message"]
    authors = msg.get("author", [])

    def short(au):
        given = au.get("given", "")
        initials = " ".join(f"{p[0]}." for p in re.split(r"[\s]+", given) if p)
        return f"{initials} {au.get('family', '')}".strip()

    names = [short(x) for x in authors]
    me = next((i for i, x in enumerate(authors) if x.get("family", "").lower() == "ge"
               and x.get("given", "").lower().startswith("z")), None)
    role = a.role or ("first" if me == 0 else "coauthor")
    if me is None:
        raise ValueError("DOI metadata does not identify Z. Ge; verify collaboration identity before manual import")
    if me is not None:
        names[me] = "**Z. Ge**"
    shown = names[: (me + 1 if me is not None and me < 3 else 1)] if names else []
    author_str = ", ".join(shown) + (" *et al.*" if len(names) > len(shown) else "")
    year = (msg.get("published-print") or msg.get("published-online") or msg.get("issued"))["date-parts"][0][0]
    pub = clean_pub({"role": role, "year": year, "authors": author_str,
                     "title": (msg.get("title") or [""])[0], "journal": (msg.get("short-container-title") or msg.get("container-title") or [""])[0],
                     "volume": msg.get("volume"), "pages": msg.get("article-number") or msg.get("page"),
                     "doi": doi, "arxiv": a.arxiv, "themes": a.themes, "highlight": a.highlight})
    print(yaml.dump(pub, Dumper=_Dumper, sort_keys=False, allow_unicode=True))
    if a.dry_run:
        print("Dry run: nothing written.")
        return
    save_pubs([pub])


def cmd_pub_batch(a):
    good = [clean_pub(row) for row in read_table(Path(a.file))]
    if a.dry_run:
        print(yaml.safe_dump({"papers": good}, allow_unicode=True)); return
    save_pubs(good)


def cmd_talk_add(a):
    doc = load_yaml(TALKS, {}) or {}
    talks = doc.get("talks", []) or []
    t = {k: v for k, v in {"kind": a.kind, "date": a.date, "title": a.title, "event": a.event,
                           "place": a.place, "url": a.url}.items() if v}
    if not t.get("url"):
        raise ValueError("public talk requires a source URL; retain pending records in local audit")
    if any(x.casefold() in json.dumps(t).casefold() for x in maintenance.PRIVATE):
        raise ValueError("private PAC talks cannot be published")
    t["public_status"] = "public_source"
    talks.append(t)
    talks.sort(key=lambda x: (x.get("kind") != "invited", str(x.get("date", ""))), reverse=False)
    inv = sorted([x for x in talks if x.get("kind") == "invited"], key=lambda x: str(x.get("date")), reverse=True)
    con = sorted([x for x in talks if x.get("kind") != "invited"], key=lambda x: str(x.get("date")), reverse=True)
    dump_yaml(TALKS, {"talks": inv + con}, header_of(TALKS))
    print(f"Added talk '{a.title}' to {rel(TALKS)}")


# ───────────────────────────── blog posts ────────────────────────────────────
def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return s or dt.datetime.now().strftime("post-%Y%m%d%H%M")


def cmd_post(a):
    slug = a.slug or slugify(a.title)
    langs = [x.strip() for x in a.langs.split(",") if x.strip()]
    for lang in langs:
        path = ROOT / "content" / lang / "posts" / f"{slug}.md"
        if path.exists():
            print(f"  exists, not touched: {rel(path)}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(f"""\
            ---
            title: "{a.title}"
            date: {a.date or today()}
            description: ""
            tags: [{", ".join(a.tags.split(",")) if a.tags else ""}]
            draft: false
            ---

            Write the post here (Markdown). Images: put them in static/img/ and use ![caption](/img/file.png).
            """), encoding="utf-8")
        print(f"  created {rel(path)}")


# ───────────────────────────── config generator ──────────────────────────────
def toml_value(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "[" + ", ".join(toml_value(x) for x in v) + "]"
    return json.dumps(str(v), ensure_ascii=False)


GEN_NOTE = "# GENERATED by `python3 tools/site.py config` from site.yaml — do not edit; edit site.yaml instead.\n"


def lang_key(lang: dict, theme: str) -> str:
    return (lang.get("theme_keys") or {}).get(theme, lang["code"])


def link_icon(icon: str, theme: str) -> str | None:
    if theme == "papermod":
        return {"google-scholar": "googlescholar", "link": None, "x-twitter": "x"}.get(icon, icon)
    return icon


def gen_congo_like(cfg: dict, theme: str):
    out = ROOT / "sites" / theme / "_default"
    if out.exists():
        maintenance.remove_tree(out)
    out.mkdir(parents=True)
    tcfg = cfg.get("themes", {}).get(theme, {})
    default = cfg["languages"][0]
    (out / "hugo.toml").write_text(GEN_NOTE + "\n".join([
        f'baseURL = {toml_value(cfg["base_url"])}',
        f'title = {toml_value(cfg["title"])}',
        f'theme = "{theme}"',
        f'defaultContentLanguage = "{lang_key(default, theme)}"',
        "defaultContentLanguageInSubdir = false",
        "enableRobotsTXT = true",
        "[outputs]",
        '  home = ["HTML", "RSS", "JSON"]',
    ]) + "\n", encoding="utf-8")
    (out / "markup.toml").write_text(GEN_NOTE + "[goldmark.renderer]\n  unsafe = true\n[highlight]\n  noClasses = false\n", encoding="utf-8")
    params = [GEN_NOTE,
              f'colorScheme = {toml_value(tcfg.get("colorScheme", "congo"))}',
              f'defaultAppearance = {toml_value(tcfg.get("defaultAppearance", "light"))}',
              f'autoSwitchAppearance = {toml_value(tcfg.get("autoSwitchAppearance", True))}',
              "enableSearch = false",
              f'zgRainbow = {toml_value(cfg.get("rainbow", True))}',
              "[header]", '  layout = "hybrid"' if theme == "congo" else '  layout = "fixed-fill-blur"',
              "[footer]", "  showCopyright = true", "  showThemeAttribution = true", "  showAppearanceSwitcher = false",  # day/night lives in the top bar (layouts/_partials/zg/top-controls.html)
             
              "[homepage]", f'  layout = {toml_value(tcfg.get("homepage_layout", "profile"))}',
              f'  showRecent = {toml_value(theme == "blowfish")}']
    if theme == "blowfish":
        params += ["  showRecentItems = 3", "  showMoreLink = true", "  cardView = false"]
    params += ["[article]", "  showDate = false", "  showReadingTime = false", "  showWordCount = false",
               "  showAuthor = false", "  showBreadcrumbs = false", "  showTableOfContents = false"]
    if theme == "blowfish":
        params += ["  showHero = false", "  showLikes = false", "  showViews = false"]
    params += ["[list]", "  showBreadcrumbs = false"]
    if theme == "blowfish":
        params += ["  showCards = false"]
    (out / "params.toml").write_text("\n".join(params) + "\n", encoding="utf-8")
    for i, lang in enumerate(cfg["languages"], 1):
        key = lang_key(lang, theme)
        links = [f'    {{ {link_icon(l["icon"], theme)} = {toml_value(l["url"])} }},' for l in cfg.get("links", [])]
        body = [GEN_NOTE,
                f'locale = {toml_value(lang["locale"])}',
                f'label = {toml_value(lang["name"])}',
                f"weight = {i}",
                f'title = {toml_value(lang.get("display_name", cfg["title"]))}',
                f'contentDir = "content/{lang["code"]}"',
                "[params]"]
        if theme == "blowfish":
            body += [f'  displayName = {toml_value(lang["code"].upper())}', f'  isoCode = {toml_value(lang["locale"])}',
                     "  rtl = false", '  dateFormat = "2006-01-02"']
        body += ["[params.author]", f'  name = {toml_value(lang.get("display_name", cfg["author"]))}', f'  image = {toml_value(cfg["image"])}',
                 f'  headline = {toml_value(lang["headline"])}', f'  bio = {toml_value(lang["bio"])}',
                 "  links = [", *links, "  ]"]
        (out / f"languages.{key}.toml").write_text("\n".join(body) + "\n", encoding="utf-8")
        menu = [GEN_NOTE]
        for w, item in enumerate(cfg["menu"], 1):
            label = item["label"].get(lang["code"], item["label"]["en"])
            menu += ["[[main]]", f"  name = {toml_value(label)}"]
            menu += [f'  url = {toml_value(item["url"])}'] if item.get("url") else [f'  pageRef = {toml_value(item["page"])}']
            menu += [f"  weight = {w * 10}"]
        (out / f"menus.{key}.toml").write_text("\n".join(menu) + "\n", encoding="utf-8")
    return out


def gen_papermod(cfg: dict):
    out = ROOT / "sites" / "papermod" / "_default"
    if out.exists():
        maintenance.remove_tree(out)
    out.mkdir(parents=True)
    t = cfg.get("themes", {}).get("papermod", {})
    default = cfg["languages"][0]
    L = [GEN_NOTE, f'baseURL = {toml_value(cfg["base_url"])}', f'title = {toml_value(cfg["title"])}',
         'theme = "hugo-PaperMod"', f'defaultContentLanguage = "{lang_key(default, "papermod")}"',
         "enableRobotsTXT = true", "[markup.goldmark.renderer]", "  unsafe = true",
         "[params]", '  env = "production"', f'  defaultTheme = {toml_value(t.get("defaultTheme", "auto"))}',
         "  ShowToc = false", "  hideMeta = true", "  ShowShareButtons = false", "  ShowPostNavLinks = false",
         "  disableSpecial1stPost = true", f'  zgRainbow = {toml_value(cfg.get("rainbow", True))}']
    for l in cfg.get("links", []):
        icon = link_icon(l["icon"], "papermod")
        if icon:
            L += ["  [[params.socialIcons]]", f"    name = {toml_value(icon)}", f'    url = {toml_value(l["url"])}']
    buttons = [m for m in cfg["menu"] if m.get("page") in ("research", "publications", "daily", "cv")]
    for i, lang in enumerate(cfg["languages"], 1):
        k = lang_key(lang, "papermod")
        L += [f"[languages.{k}]", f'  label = {toml_value(lang["name"])}', f'  locale = {toml_value(lang["locale"])}', f"  weight = {i}",
              f'  contentDir = "content/{lang["code"]}"', f'  title = {toml_value(lang.get("display_name", cfg["title"]))}',
              f"  [languages.{k}.params.profileMode]", "    enabled = true",
              f'    title = {toml_value(cfg["author"])}', f'    subtitle = {toml_value(lang["headline"] + "<br>" + lang["bio"])}',
              f'    imageUrl = {toml_value(cfg["image"])}', "    imageWidth = 160", "    imageHeight = 160",
              f'    imageTitle = {toml_value(cfg["author"])}']
        for b in buttons:
            L += [f"    [[languages.{k}.params.profileMode.buttons]]",
                  f'      name = {toml_value(b["label"].get(lang["code"], b["label"]["en"]))}',
                  f'      url = {toml_value(b["page"] + "/")}']
        for w, item in enumerate(cfg["menu"], 1):
            L += [f"  [[languages.{k}.menu.main]]",
                  f'    name = {toml_value(item["label"].get(lang["code"], item["label"]["en"]))}']
            L += [f'    url = {toml_value(item["url"])}'] if item.get("url") else [f'    pageRef = {toml_value(item["page"])}']
            L += [f"    weight = {w * 10}"]
    (out / "hugo.toml").write_text("\n".join(L) + "\n", encoding="utf-8")
    return out


def _cmd_config_direct(a):
    cfg = load_yaml(SITE)
    if cfg.get("live_theme") not in THEMES:
        sys.exit(f"site.yaml: live_theme must be one of {THEMES}")
    for theme in ("congo", "blowfish"):
        print(f"  wrote {rel(gen_congo_like(cfg, theme))}/  ({len(cfg['languages'])} languages)")
    print(f"  wrote {rel(gen_papermod(cfg))}/hugo.toml")
    # Chinese translation strings: i18n/zh.yaml is the source; theme-specific keys are copies.
    for lang in cfg["languages"]:
        src = ROOT / "i18n" / f"{lang['code']}.yaml"
        for key in set((lang.get("theme_keys") or {}).values()) - {lang["code"]}:
            dst = ROOT / "i18n" / f"{key}.yaml"
            shutil.copyfile(src, dst)
            print(f"  copied {rel(src)} → {rel(dst)}")
    # Stylesheet: one source (assets/css/extended/zg-rainbow.css, auto-loaded by PaperMod);
    # Congo and Blowfish load assets/css/custom.css, so it is written as a copy.
    css_src = ROOT / "assets" / "css" / "extended" / "zg-rainbow.css"
    plain = ROOT / "assets" / "css" / "extended" / "zz-plain.css"
    plain_css = ("/* GENERATED: rainbow: false in site.yaml */\nbody::before{display:none}\n"
                 "article h1,.post-title,.profile_inner h1,main h1{background:none;color:inherit;-webkit-text-fill-color:currentColor}\n"
                 ".prose h2,.post-content h2,article h2{border-image:none;border-bottom-color:currentColor}\n")
    if cfg.get("rainbow", True):
        plain.unlink(missing_ok=True)
    else:
        plain.write_text(plain_css, encoding="utf-8")
    custom = ROOT / "assets" / "css" / "custom.css"
    custom.write_text("/* GENERATED copy of assets/css/extended/zg-rainbow.css by `tools/site.py config` — edit that file instead. */\n"
                      + css_src.read_text(encoding="utf-8") + ("" if cfg.get("rainbow", True) else plain_css), encoding="utf-8")
    print(f"  wrote {rel(custom)} (rainbow: {cfg.get('rainbow', True)})")
    print(f"Live theme: {cfg['live_theme']} (the GitHub workflow reads it from site.yaml)")


def cmd_config(a):
    global ROOT
    original = ROOT
    staging = original / ".maintenance" / ("config-" + __import__("uuid").uuid4().hex[:8])
    staging.mkdir(parents=True)
    for item in ["assets/css/extended/zg-rainbow.css", *["i18n/"+l["code"]+".yaml" for l in load_yaml(SITE)["languages"]]]:
        dest = staging / item
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original / item, dest)
    try:
        ROOT = staging
        _cmd_config_direct(a)
        changes = {str(p.relative_to(staging)): p.read_bytes() for p in staging.rglob("*") if p.is_file() and not p.name.startswith("._")}
        ROOT = original
        maintenance.transaction(changes, root=original)
        plain = original / "assets/css/extended/zz-plain.css"
        if load_yaml(SITE).get("rainbow", True) and plain.exists():
            plain.unlink()
    finally:
        ROOT = original
        maintenance.remove_tree(staging)


# ───────────────────────────── export for React ──────────────────────────────
def cmd_export_react(a):
    pubs = (load_yaml(PUBS, {}) or {}).get("papers", [])
    talks = (load_yaml(TALKS, {}) or {}).get("talks", [])
    inline = mistune.create_markdown(renderer=mistune.HTMLRenderer(escape=True))
    for item in pubs + talks:
        rendered = inline(item["title"]).removeprefix("<p>").removesuffix("</p>\n").strip()
        item["title_html"] = re.sub(r"&lt;(/?)(sup|sub|em|strong|i|b)&gt;", r"<\1\2>", rendered)
    entries = [{k: v for k, v in e.items() if not k.startswith("_")} for e in all_entries()]
    cfg = load_yaml(SITE, {})
    maintenance.strict_check(ROOT)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    pages = {}
    for lang in cfg["languages"]:
        local = {}
        for page in (ROOT / "content" / lang["code"]).glob("*.md"):
            if page.name.startswith("._"):
                continue
            raw = page.read_text()
            parts = raw.split("---", 2)
            front = yaml.safe_load(parts[1]) if len(parts) == 3 else {}
            local[page.stem] = {"title": (front or {}).get("title", page.stem), "markdown": parts[2].strip() if len(parts) == 3 else raw}
            text = re.sub(r"\{\{[<%].*?[>%]\}\}", "", local[page.stem]["markdown"], flags=re.S)
            local[page.stem]["html"] = mistune.html(text)
        pages[lang["code"]] = local
    fs = maintenance.facilities(ROOT)
    payload = {"schema_version": 1, "generated": maintenance.utc(), "config": cfg,
               "links": cfg.get("links", []), "papers": pubs, "talks": talks,
               "daily": entries, "pages": pages, "gallery": load_yaml(DATA / "gallery.yaml", {})}
    out.write_text(maintenance.serialized("x.json", payload), encoding="utf-8")
    associated = {fid for e in entries for fid in e.get("facility_ids", [])}
    daily = {"entries": entries, "facilities": [{"id": f["id"], "name": f["name"]} for f in fs if f.get("daily_aliases") or f["id"] in associated],
             "health": maintenance.read(DATA / "daily/feed-health.json", {})}
    maintenance.transaction({"static/data/daily.json": maintenance.serialized("x.json", daily)}, root=ROOT)

    print(f"Wrote {len(pubs)} papers, {len(talks)} talks, {len(entries)} daily entries → {out}")


# ───────────────────────────── validation ────────────────────────────────────
def cmd_check(a):
    maintenance.strict_check(ROOT)
    problems = []
    for e in all_entries():
        try:
            clean_entry({k: v for k, v in e.items() if not k.startswith("_")})
        except ValueError as err:
            problems.append(f"{e['_file']}: {e.get('title', '?')!r}: {err}")
    for i, p in enumerate((load_yaml(PUBS, {}) or {}).get("papers", []), 1):
        try:
            clean_pub(p)
        except ValueError as err:
            problems.append(f"{rel(PUBS)} paper #{i}: {err}")
        for t in p.get("themes", []) or []:
            if t not in ("nz", "neutrino", "isotope-shift", "detectors"):
                problems.append(f"{rel(PUBS)} paper #{i}: unknown theme {t!r}")
    for i, t in enumerate((load_yaml(TALKS, {}) or {}).get("talks", []), 1):
        if t.get("kind") not in ("invited", "contributed") or not t.get("title"):
            problems.append(f"{rel(TALKS)} talk #{i}: needs kind invited|contributed and a title")
    cfg = load_yaml(SITE, {})
    for lang in cfg.get("languages", []):
        for item in cfg.get("menu", []):
            page = item.get("page")
            if not page:
                continue
            base = ROOT / "content" / lang["code"]
            if not ((base / f"{page}.md").exists() or (base / page / "_index.md").exists()):
                problems.append(f"menu item {page!r} has no page in content/{lang['code']}/")
        if not (ROOT / "i18n" / f"{lang['code']}.yaml").exists():
            problems.append(f"i18n/{lang['code']}.yaml missing")
    if problems:
        print("Problems found:\n  " + "\n  ".join(problems))
        sys.exit(1)
    n = len(all_entries())
    print(f"All data valid: {n} daily entries, "
          f"{len((load_yaml(PUBS, {}) or {}).get('papers', []))} papers, "
          f"{len((load_yaml(TALKS, {}) or {}).get('talks', []))} talks, {len(cfg.get('languages', []))} languages.")


# ───────────────────────────── command line ──────────────────────────────────
def main(argv=None):
    p = argparse.ArgumentParser(prog="site.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("add", help="add one daily entry")
    s.add_argument("type", choices=TYPES)
    s.add_argument("title")
    s.add_argument("--date", help="YYYY-MM-DD (default: today)")
    s.add_argument("--summary", "-s")
    s.add_argument("--url", "-u")
    s.add_argument("--source")
    s.add_argument("--tags", "-t", help="comma separated, e.g. trap,nuclear")
    s.add_argument("--lang", help="language of the text, e.g. zh (optional)")
    s.add_argument("--item-id", help="shared stable identity for translations")
    s.add_argument("--facility-id", action="append", help="repeat for multiple facility associations")
    for field in ("published", "event-start", "event-end", "deadline"):
        s.add_argument("--" + field, help="YYYY-MM-DD")
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(func=cmd_add)

    s = sub.add_parser("remove", help="remove hand-written daily entries")
    s.add_argument("date")
    s.add_argument("match", help="part of the title")
    s.add_argument("--yes", action="store_true", help="really remove")
    s.set_defaults(func=cmd_remove)

    s = sub.add_parser("list", help="list daily entries")
    s.add_argument("when", nargs="?", help="YYYY-MM or YYYY-MM-DD (default: this month)")
    s.add_argument("--type", choices=TYPES)
    s.set_defaults(func=cmd_list)

    s = sub.add_parser("batch", help="import daily entries from CSV/TSV/YAML/JSON")
    s.add_argument("file")
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(func=cmd_batch)

    s = sub.add_parser("fetch", help="download new papers/jobs/news from tools/feeds.yaml")
    s.add_argument("--date", help="date to file the entries under (default: today)")
    s.add_argument("--dry-run", action="store_true", help="show, do not write")
    s.set_defaults(func=cmd_fetch)

    s = sub.add_parser("pub-add", help="add one publication")
    s.add_argument("--role", choices=ROLES, required=True)
    s.add_argument("--year", required=True)
    s.add_argument("--title", required=True)
    s.add_argument("--authors", default="**Z. Ge** *et al.*")
    for f in ("journal", "volume", "pages", "doi", "arxiv", "url", "note"):
        s.add_argument(f"--{f}")
    s.add_argument("--themes", help="comma separated: nz,neutrino,isotope-shift,detectors")
    s.add_argument("--highlight", action="store_true")
    s.set_defaults(func=cmd_pub_add)

    s = sub.add_parser("pub-doi", help="add one publication from its DOI (needs internet)")
    s.add_argument("doi")
    s.add_argument("--role", choices=ROLES, help="default: first if Z. Ge is first author, else coauthor")
    s.add_argument("--arxiv")
    s.add_argument("--themes")
    s.add_argument("--highlight", action="store_true")
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(func=cmd_pub_doi)

    s = sub.add_parser("pub-batch", help="import publications from CSV/YAML/JSON")
    s.add_argument("file")
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(func=cmd_pub_batch)

    s = sub.add_parser("talk-add", help="add one talk")
    s.add_argument("--kind", choices=["invited", "contributed"], required=True)
    s.add_argument("--date", required=True, help="YYYY-MM-DD or YYYY-MM")
    s.add_argument("--title", required=True)
    s.add_argument("--event", required=True)
    s.add_argument("--place", default="")
    s.add_argument("--url")
    s.set_defaults(func=cmd_talk_add)

    s = sub.add_parser("post", help="create a blog post")
    s.add_argument("title")
    s.add_argument("--langs", default="en", help="comma separated, e.g. en,zh,fi,de,ja")
    s.add_argument("--slug")
    s.add_argument("--date")
    s.add_argument("--tags")
    s.set_defaults(func=cmd_post)

    s = sub.add_parser("config", help="regenerate theme configs from site.yaml")
    s.set_defaults(func=cmd_config)

    s = sub.add_parser("export-react", help="export data JSON for the React site")
    s.add_argument("--out", default=str(ROOT / "react" / "src" / "data" / "site.json"))
    s.set_defaults(func=cmd_export_react)

    s = sub.add_parser("check", help="validate data files")
    s.set_defaults(func=cmd_check)

    maintenance.register(sub)
    a = p.parse_args(argv)
    try:
        a.func(a)
    except (ValueError, OSError) as error:
        p.exit(1, f"Validation failed: {error}\n")


if __name__ == "__main__":
    main()
