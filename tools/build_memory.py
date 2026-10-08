"""Build a pinned Hugo theme in memory and retain a compressed output archive.

Avoids exFAT allocation overhead from 10,000+ tiny generated pages. This helper
uses ordinary HTTP, never browser automation. Browser QA is a separate step.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import urlopen
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hugo", required=True)
    p.add_argument("--theme", choices=["congo", "blowfish", "papermod"], required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--port", type=int, default=8125)
    p.add_argument("--keep", action="store_true", help="keep the memory preview running after collection")
    a = p.parse_args()
    a.output = a.output.resolve()
    a.output.mkdir(parents=True, exist_ok=True)
    base = f"http://127.0.0.1:{a.port}/"
    # Metadata is derived checkout debris, never a source file.
    subprocess.run([__import__('sys').executable, str(ROOT / "tools/clean_metadata.py")], check=True, cwd=ROOT)
    logfile = a.output / (a.theme + "-hugo.log")
    log = logfile.open("w")
    command = [a.hugo, "server", "--configDir", "sites/" + a.theme, "--themesDir", "themes", "--bind", "127.0.0.1", "--port", str(a.port), "--baseURL", base, "--renderToMemory", "--renderStaticToDisk=false", "--watch=false", "--disableLiveReload", "--cacheDir", str(a.output / "hugo-cache")]
    process = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    failures, receipts, assets = [], [], set()
    archive = a.output / (a.theme + "-preview.zip")

    def get(path):
        with urlopen(base + path.lstrip("/"), timeout=45) as response:
            return response.read()

    def sitemap(path):
        doc = ET.fromstring(get(path))
        locations = [e.text for e in doc.iter() if e.tag.endswith("}loc")]
        if doc.tag.endswith("sitemapindex"):
            return [u for loc in locations for u in sitemap(urlsplit(loc).path)]
        return [urlsplit(loc).path for loc in locations]

    try:
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("Hugo exited before preview; inspect " + str(logfile))
            try:
                get("sitemap.xml")
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise TimeoutError("Hugo preview readiness exceeded 180 seconds")
        paths = sorted(set(sitemap("sitemap.xml") + ["/", "/404.html"]))
        print(f"{a.theme}: ready; collecting {len(paths)} pages", flush=True)

        def fetch(path):
            try:
                data = get(path)
                if path.endswith("/"):
                    if b"23rd RIKEN PAC" in data or b"19th RIBF PAC" in data:
                        raise ValueError("privacy exclusion failed")
                    if not data.strip():
                        raise ValueError("empty page")
                return path, data, None
            except Exception as err:
                return path, None, str(err)

        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            with ThreadPoolExecutor(max_workers=12) as pool:
                for i, (path, data, error) in enumerate(pool.map(fetch, paths)):
                    if error:
                        failures.append({"path": path, "error": error}); continue
                    name = unquote(path.lstrip("/")) + ("index.html" if path.endswith("/") else "")
                    z.writestr(name, data)
                    receipts.append({"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
                    for raw in re.findall(rb'(?:src|href)=["\']([^"\']+)', data):
                        url = urlsplit(urljoin(base + path.lstrip("/"), html.unescape(raw.decode(errors="replace"))))
                        if url.netloc == urlsplit(base).netloc and url.path and not url.path.endswith("/") and url.path not in paths:
                            assets.add(url.path)
                    if (i + 1) % 2000 == 0:
                        print(f"{a.theme}: {i+1}/{len(paths)} pages", flush=True)
            for f in (ROOT / "static").rglob("*"):
                if f.is_file() and not any(x.startswith("._") for x in f.parts) and f.name != ".DS_Store":
                    assets.add("/" + f.relative_to(ROOT / "static").as_posix())
            for path in sorted(assets):
                _, data, error = fetch(path)
                if error:
                    failures.append({"path": path, "error": error}); continue
                z.writestr(unquote(path.lstrip("/")), data)
            z.writestr("BUILD_INFO.json", json.dumps({"theme": a.theme, "variant": "local preview", "base_url": base, "command": command, "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()}, indent=2))
        result = {"theme": a.theme, "pages": len(receipts), "assets": len(assets), "failures": failures, "archive": str(archive), "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "preview_base": base, "status": "PASS" if not failures else "FAIL", "receipts": receipts}
        (a.output / (a.theme + "-validation.json")).write_text(json.dumps(result, indent=2))
        print(json.dumps({k:v for k,v in result.items() if k != "receipts"}), flush=True)
        if failures:
            raise RuntimeError("generated page or asset checks failed")
        if a.keep:
            print(f"Preview ready on {base}; PID {process.pid}", flush=True)
            process.wait()
    finally:
        if process.poll() is None:
            process.terminate()
            try: process.wait(timeout=15)
            except subprocess.TimeoutExpired: process.kill()
        log.close()


if __name__ == "__main__":
    main()
