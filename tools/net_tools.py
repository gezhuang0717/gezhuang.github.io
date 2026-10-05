#!/usr/bin/env python3
"""Network helpers that run on GitHub Actions (the runner has open internet; local sandboxes may not).

  python3 tools/net_tools.py links  [--out reports/linkcheck.csv]   check every external link used by the site
  python3 tools/net_tools.py probe  URL [URL …] [--out reports/probe] download URLs, save them, print a summary
  python3 tools/net_tools.py models [--out tools/data/massmodels]    fetch theory mass tables (FRDM2012, WS4, HFB-24, …)

Run through the workflow .github/workflows/net-tools.yml (Actions → "Network tools" → Run workflow).
Reports are uploaded as a workflow artifact (never published on the website).
"""
import argparse, csv, concurrent.futures as cf, json, pathlib, re, sys, time, urllib.parse
import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 gezhuang0717.github.io-linkcheck"}
URL_RE = re.compile(r"https?://[^\s\"'<>()\]\[{}|\\^`]+")


def collect_links():
    """URL → set of files that use it."""
    found = {}
    globs = ["content/**/*.md", "data/**/*.yaml", "data/**/*.yml", "data/**/*.json", "layouts/**/*.html", "site.yaml", "tools/feeds.yaml"]
    for g in globs:
        for f in ROOT.glob(g):
            if "daily/auto" in str(f) or f.name.startswith("._"):
                continue
            try:
                text = f.read_text(errors="ignore")
            except Exception:
                continue
            for u in URL_RE.findall(text):
                u = u.rstrip(".,;:)").replace("&amp;", "&")
                if "{{" in u or "localhost" in u or u.endswith("://"):
                    continue
                found.setdefault(u, set()).add(str(f.relative_to(ROOT)))
    return found


def check(url):
    t0 = time.time()
    for method in ("head", "get"):
        try:
            r = requests.request(method, url, headers=UA, timeout=20, allow_redirects=True, stream=(method == "get"))
            code = r.status_code
            if method == "head" and code in (403, 405, 400, 404, 429, 500, 501, 503):
                continue           # many servers refuse HEAD; retry with GET
            return url, code, r.url, round(time.time() - t0, 1), ""
        except Exception as e:  # noqa: BLE001
            err = type(e).__name__ + ": " + str(e)[:160]
    return url, 0, "", round(time.time() - t0, 1), err


def cmd_links(a):
    links = collect_links()
    out = pathlib.Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    with cf.ThreadPoolExecutor(16) as ex:
        for url, code, final, dt, err in ex.map(check, sorted(links)):
            rows.append([("OK" if 200 <= code < 400 else "BROKEN" if code in (404, 410) or code == 0 else "CHECK"), code, url, final if final != url else "", dt, err, "; ".join(sorted(links[url]))])
    rows.sort(key=lambda r: (r[0] != "BROKEN", r[0] != "CHECK", r[2]))
    with out.open("w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["status", "http", "url", "redirected_to", "seconds", "error", "used_in"]); w.writerows(rows)
    n = {s: sum(1 for r in rows if r[0] == s) for s in ("OK", "CHECK", "BROKEN")}
    print(f"{len(rows)} links: {n}")
    for r in rows:
        if r[0] != "OK":
            print(f"{r[0]:6} {r[1]:>3} {r[2]}  ← {r[6][:120]} {r[5]}")


def cmd_probe(a):
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for i, url in enumerate(a.urls):
        try:
            r = requests.get(url, headers=UA, timeout=60, allow_redirects=True)
            name = f"{i:02d}_" + re.sub(r"[^A-Za-z0-9._-]+", "_", urllib.parse.urlparse(r.url).path.strip("/") or "index")[-80:]
            (out / name).write_bytes(r.content)
            head = r.content[:600].decode("utf-8", "replace").replace("\n", "⏎")
            hrefs = sorted(set(re.findall(r'href="([^"]+)"', r.text)))[:80] if "html" in r.headers.get("content-type", "") else []
            print(f"== {url} → {r.status_code} {r.url} {len(r.content)} B {r.headers.get('content-type')}\n   {head[:400]}\n   links: {hrefs}")
        except Exception as e:  # noqa: BLE001
            print(f"== {url} → ERROR {e}")


# theory mass tables: (key, url, parser) — parser returns list of (Z, A, ME_MeV, beta2 or None)
def parse_columns(text, zc, ac, mec, b2c=None, skip=0):
    rows = []
    for line in text.splitlines()[skip:]:
        p = line.split()
        try:
            Z, A, me = int(p[zc]), int(p[ac]), float(p[mec])
            b2 = float(p[b2c]) if b2c is not None else None
        except (ValueError, IndexError):
            continue
        rows.append((Z, A, me, b2))
    return rows


def cmd_models(a):
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    spec = json.loads((ROOT / "tools/data/massmodels/sources.json").read_text())
    for m in spec:
        try:
            r = requests.get(m["url"], headers=UA, timeout=120)
            r.raise_for_status()
            text = r.text
            if m.get("pre"):                         # data inside <pre> … </pre> of an HTML page
                text = "\n".join(re.findall(r"<pre[^>]*>(.*?)</pre>", text, flags=re.S | re.I))
            rows = parse_columns(text, *m["cols"], skip=m.get("skip", 0))
            rows = [r for r in rows if m.get("zmin", 0) <= r[0] <= 130 and r[1] >= r[0]]
            if len(rows) < 500:
                print(f"{m['key']}: only {len(rows)} rows parsed — check the format"); continue
            with (out / f"{m['key']}.txt").open("w") as fh:
                fh.write(f"# {m['key']}: Z A ME(MeV) beta2 — downloaded from {m['url']} by tools/net_tools.py models\n")
                for Z, A, me, b2 in sorted(rows):
                    fh.write(f"{Z} {A} {me:.3f} {b2 if b2 is not None else 0:.3f}\n")
            print(f"{m['key']}: {len(rows)} nuclei")
        except Exception as e:  # noqa: BLE001
            print(f"{m['key']}: FAILED {e}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("links"); s.add_argument("--out", default="reports/linkcheck.csv")
    s = sub.add_parser("probe"); s.add_argument("urls", nargs="+"); s.add_argument("--out", default="reports/probe")
    s = sub.add_parser("models"); s.add_argument("--out", default="tools/data/massmodels")
    a = ap.parse_args()
    {"links": cmd_links, "probe": cmd_probe, "models": cmd_models}[a.cmd](a)
