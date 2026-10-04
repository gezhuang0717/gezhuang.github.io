#!/usr/bin/env python3
"""Publication gate: private source repository  →  public deployment repository.

    PRIVATE SOURCE REPOSITORY (this repo)
        ├── site.py check                 data files valid
        ├── privacy/public-content check  nothing private in content/, data/ or the built site
        ├── facility geo validation       identities, coordinate evidence, ranges
        ├── Hugo build                    live theme → public/
        ├── link check                    every internal link/asset in public/ resolves
        └── inspect generated public/     only web files, size limits, no source leftovers
                 │
                 ▼
          publication gate                all checks PASS + explicit --approve
                 │
                 ▼
    PUBLIC DEPLOYMENT REPOSITORY  gezhuang0717.github.io  (built HTML only)

Usage
    python3 tools/publish.py check                 # all checks, builds public/, writes gate report
    python3 tools/publish.py push --approve        # checks again, then pushes public/ as ONE commit  (two-repository mode only)
    python3 tools/publish.py push --approve --dry-run  (two-repository mode only)
Options for push:  --repo URL (default https://github.com/gezhuang0717/gezhuang0717.github.io)
                   --token-env NAME (CI: env var holding a token with contents:write on the public repo)
                   --fresh  (start the public history again with a single commit)
Commits to the public repository carry only the owner's name and a dated message.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html.parser
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
REPORT = ROOT / "public-gate-report.json"
PUBLIC_REPO = "https://github.com/gezhuang0717/gezhuang0717.github.io"
OWNER_NAME, OWNER_EMAIL = "Zhuang Ge", "gezhuang0717@users.noreply.github.com"
SITE_URL = "https://gezhuang0717.github.io/"

# ── privacy rules ────────────────────────────────────────────────────────────
ALLOWED_EMAILS = {"zhuang.z.ge@jyu.fi"}
PRIVATE_PATTERNS = {  # regex → reason
    r"(?i)co-authored-by|claude-session|generated with \[?claude": "tool attribution",
    r"/Volumes/|/Users/[A-Za-z]|/home/claude|/mnt/user-data|PSSD": "local file path",
    r"(?i)beam[- ]time proposal|as spokesperson|PAC (meeting|proposal)": "proposal / PAC material",
    r"(?i)\b(salary|personal identity code|henkilötunnus|passport no)": "personal data",
    r"(?<![\w.])\+\d{1,3}[ -]?\(?\d{1,4}\)?[ -]?\d{2,4}[ -]?\d{3,4}(?![\w.])|[Tt][Ee][Ll]:\+?\d": "phone number",
    r"(?i)(€|eur)\s?\d{1,3}([ ,.]\d{3})+|\d{1,3}([ ,.]\d{3})+\s?(€|eur\b)": "money amount",
    r"(?i)\bCONFIDENTIAL\b|\bDO NOT PUBLISH\b|\bINTERNAL ONLY\b": "confidential marker",
}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
WEB_SUFFIXES = {".html", ".xml", ".css", ".js", ".json", ".geojson", ".txt", ".svg", ".png", ".jpg", ".jpeg",
                ".gif", ".webp", ".avif", ".ico", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".webmanifest",
                ".pdf", ".map", ""}
FORBIDDEN_NAMES = re.compile(r"(?i)(manual|handoff|changelog|audit|snapshot|\.bundle$|\.docx$|\.tex$|\.py$|\.ya?ml$|\.toml$|\.md$|\.env$|\.git/)")
MAX_FILE_MB, MAX_SITE_MB = 50, 900
TEXT_SUFFIXES = {".html", ".xml", ".css", ".js", ".json", ".txt", ".svg", ".webmanifest"}


class Gate:
    def __init__(self):
        self.results: list[dict] = []

    def record(self, name, ok, detail="", items=None):
        self.results.append({"check": name, "status": "PASS" if ok else "FAIL", "detail": detail,
                             "items": (items or [])[:50]})
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))
        for it in (items or [])[:12]:
            print(f"         · {it}")
        return ok

    @property
    def ok(self):
        return all(r["status"] == "PASS" for r in self.results)


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=kw.pop("cwd", ROOT), text=True, capture_output=True, **kw)


def live_theme():
    import yaml
    return yaml.safe_load((ROOT / "site.yaml").read_text())["live_theme"]


# ── individual checks ───────────────────────────────────────────────────────
def check_data(g):
    r = run([sys.executable, "tools/site.py", "check"])
    return g.record("site.py check", r.returncode == 0, (r.stdout.strip().splitlines() or [r.stderr.strip()])[-1])


def scan_text(path: Path, text: str, rel: str, hits: list):
    for pat, why in PRIVATE_PATTERNS.items():
        for m in re.finditer(pat, text):
            hits.append(f"{rel}: {why}: “{m.group(0)[:60]}”")
            break
    for m in EMAIL_RE.finditer(text):
        e = m.group(0).lower()
        if e not in ALLOWED_EMAILS and not e.endswith((".png", ".jpg", ".svg", ".webp")) and "example" not in e \
                and not re.search(r"@\d+x\.", e):
            hits.append(f"{rel}: e-mail address “{e}”")
            break


def check_privacy_sources(g):
    hits = []
    for base in ("content", "data", "static", "layouts", "site.yaml"):
        p = ROOT / base
        files = [p] if p.is_file() else [f for f in p.rglob("*") if f.is_file()]
        for f in files:
            if f.suffix.lower() not in {".md", ".yaml", ".yml", ".json", ".html", ".js", ".css", ".toml", ".txt", ".gotmpl"}:
                continue
            if f.stat().st_size > 8_000_000:
                continue
            rel = str(f.relative_to(ROOT))
            if rel.startswith(("data/facilities/", "static/data/facilities", "static/vendor/")):
                continue  # third-party / source-registry records: checked in the built site instead
            scan_text(f, f.read_text(errors="ignore"), rel, hits)
    return g.record("privacy/public-content check (sources)", not hits, f"{len(hits)} finding(s)", hits)


def check_geo(g):
    r = run([sys.executable, "tools/maintenance.py", "facility-check"])
    ok = r.returncode == 0
    doc = json.loads((ROOT / "data/facilities/facilities.json").read_text())
    bad = []
    for f in doc["facilities"]:
        lat, lon = f.get("latitude"), f.get("longitude")
        if lat is None:
            if f.get("coordinate_verified"):
                bad.append(f"{f['id']}: verified flag without coordinates")
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            bad.append(f"{f['id']}: coordinates out of range")
        if not f.get("coordinate_source"):
            bad.append(f"{f['id']}: pin without coordinate_source")
    mapped = sum(1 for f in doc["facilities"] if f.get("latitude") is not None)
    detail = f"{len(doc['facilities'])} records, {mapped} pins" + ("" if ok else f"; facility-check: {(r.stdout + r.stderr).strip()[-200:]}")
    return g.record("facility geo validation", ok and not bad, detail, bad)


def build(g, base_url):
    theme = live_theme()
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    run([sys.executable, "tools/site.py", "config"])
    run([sys.executable, "tools/maintenance.py", "facilities-build"])
    r = run(["hugo", "--minify", "--configDir", f"sites/{theme}", "--themesDir", "themes",
             "--destination", str(PUBLIC), "--baseURL", base_url, "--cleanDestinationDir"])
    ok = r.returncode == 0 and (PUBLIC / "index.html").exists()
    if ok and (ROOT / "builds/react/index.html").exists():
        shutil.copytree(ROOT / "builds/react", PUBLIC / "react", dirs_exist_ok=True)
    pages = sum(1 for _ in PUBLIC.rglob("index.html")) if ok else 0
    return g.record("Hugo build", ok, f"theme {theme}, {pages} pages" if ok else (r.stderr or r.stdout)[-400:])


class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if v and k in ("href", "src", "poster") and tag in ("a", "link", "script", "img", "source", "video", "iframe"):
                self.urls.append(v)


def check_links(g, base_url):
    base_path = urllib.parse.urlparse(base_url).path or "/"
    missing, external = [], set()
    for f in PUBLIC.rglob("*.html"):
        p = Links()
        try:
            p.feed(f.read_text(errors="ignore"))
        except Exception:
            continue
        for u in p.urls:
            if u.startswith(("mailto:", "tel:", "javascript:", "data:", "#")):
                continue
            pu = urllib.parse.urlparse(u)
            if pu.scheme in ("http", "https") and not u.startswith(base_url):
                external.add(u)
                continue
            path = urllib.parse.unquote(pu.path if pu.scheme else u.split("#")[0].split("?")[0])
            if u.startswith(base_url):
                path = "/" + path[len(base_path):] if path.startswith(base_path) else path
            if not path:
                continue
            if path.startswith("/"):
                target = PUBLIC / path.lstrip("/")
                if base_path != "/" and path.startswith(base_path):
                    target = PUBLIC / path[len(base_path):]
            else:
                target = (f.parent / path)
            if target.is_dir() or path.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                missing.append(f"{f.relative_to(PUBLIC)} → {u}")
    missing = sorted(set(missing))
    return g.record("link check (internal)", not missing, f"{len(missing)} broken, {len(external)} external links not fetched", missing)


def inspect_public(g):
    bad, total = [], 0
    hits = []
    for f in PUBLIC.rglob("*"):
        if not f.is_file():
            continue
        rel = str(f.relative_to(PUBLIC))
        size = f.stat().st_size
        total += size
        if f.suffix.lower() not in WEB_SUFFIXES:
            bad.append(f"{rel}: unexpected file type")
        if FORBIDDEN_NAMES.search(rel) and not rel.endswith(".html"):
            bad.append(f"{rel}: source or private file name")
        if size > MAX_FILE_MB * 2**20:
            bad.append(f"{rel}: {size / 2**20:.0f} MB > {MAX_FILE_MB} MB")
        if f.suffix.lower() in TEXT_SUFFIXES and size < 8_000_000 and not rel.startswith("vendor/"):
            scan_text(f, f.read_text(errors="ignore"), "public/" + rel, hits)
    if total > MAX_SITE_MB * 2**20:
        bad.append(f"site is {total / 2**20:.0f} MB > {MAX_SITE_MB} MB")
    g.record("inspect generated public/ (files)", not bad, f"{total / 2**20:.1f} MB", bad)
    return g.record("privacy/public-content check (built site)", not hits, f"{len(hits)} finding(s)", hits)


def run_gate(base_url=SITE_URL) -> Gate:
    g = Gate()
    print("Publication gate")
    check_data(g)
    check_privacy_sources(g)
    check_geo(g)
    if build(g, base_url):
        check_links(g, base_url)
        inspect_public(g)
    rev = run(["git", "rev-parse", "--short", "HEAD"]).stdout.strip()
    REPORT.write_text(json.dumps({"checked_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                                  "source_commit": rev, "base_url": base_url, "gate": "OPEN" if g.ok else "CLOSED",
                                  "results": g.results}, indent=1, ensure_ascii=False))
    print(f"\nGate {'OPEN — ready to publish' if g.ok else 'CLOSED — fix the FAIL items above'}  (report: {REPORT.name})")
    return g


def push(a):
    g = run_gate(a.base_url)
    if not g.ok:
        sys.exit(1)
    if not a.approve:
        sys.exit("Gate open. Re-run with --approve to publish.")
    repo = a.repo
    tok = os.environ.get(a.token_env or "", "")
    if tok:
        repo = repo.replace("https://", f"https://x-access-token:{tok}@")
    work = Path(tempfile.mkdtemp(prefix="zg-publish-"))
    env = dict(os.environ, GIT_AUTHOR_NAME=OWNER_NAME, GIT_AUTHOR_EMAIL=OWNER_EMAIL,
               GIT_COMMITTER_NAME=OWNER_NAME, GIT_COMMITTER_EMAIL=OWNER_EMAIL)
    git = lambda *c, **k: subprocess.run(["git", *c], cwd=work, text=True, capture_output=True, env=env, **k)
    if a.fresh or git("clone", "--depth", "1", repo, ".").returncode != 0:
        shutil.rmtree(work); work.mkdir()
        git("init", "-q", "-b", "main"); git("remote", "add", "origin", repo)
        a.fresh = True
    for item in work.iterdir():
        if item.name != ".git":
            shutil.rmtree(item) if item.is_dir() else item.unlink()
    shutil.copytree(PUBLIC, work, dirs_exist_ok=True)
    (work / ".nojekyll").write_text("")
    wf = work / ".github/workflows"; wf.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "deploy/pages.yml", wf / "pages.yml")
    (work / "README.md").write_text("# gezhuang0717.github.io\n\nPublished website of Zhuang Ge — "
                                    "https://gezhuang0717.github.io\n\nThis repository holds only the generated site.\n")
    git("add", "-A")
    if git("diff", "--cached", "--quiet").returncode == 0:
        print("Public site already up to date."); return
    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    git("commit", "-q", "-m", f"Site update {stamp}")
    print(git("log", "--oneline", "-1").stdout.strip())
    if a.dry_run:
        print(f"Dry run: not pushed. Inspect {work}"); return
    r = git("push", *(["--force"] if a.fresh else []), "origin", "HEAD:main")
    print((r.stdout + r.stderr).strip().replace(tok, "***") if tok else (r.stdout + r.stderr).strip())
    sys.exit(r.returncode)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check"); c.add_argument("--base-url", default=SITE_URL)
    s = sub.add_parser("push")
    s.add_argument("--approve", action="store_true"); s.add_argument("--dry-run", action="store_true")
    s.add_argument("--fresh", action="store_true"); s.add_argument("--repo", default=PUBLIC_REPO)
    s.add_argument("--token-env"); s.add_argument("--base-url", default=SITE_URL)
    a = p.parse_args()
    if a.cmd == "check":
        sys.exit(0 if run_gate(a.base_url).ok else 1)
    push(a)


if __name__ == "__main__":
    main()
