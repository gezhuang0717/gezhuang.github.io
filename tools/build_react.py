"""Build React using the audited subgraph of the preserved original pnpm lock."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--node", required=True)
    p.add_argument("--toolchain", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    nm = (a.toolchain / "node_modules").resolve()
    expected = "bed918bb626cd6cec4f4068787da2777d247a73faa21798325464c841579a562"
    if hashlib.sha256((ROOT / "react/pnpm-lock.yaml").read_bytes()).hexdigest() != expected:
        raise ValueError("original lockfile changed; re-audit the locked subgraph")
    subprocess.run([sys.executable, str(ROOT / "tools/site.py"), "export-react"], check=True)
    for rel in ("css", "js", "vendor", "data", "img"):
        dest = ROOT / "react/public" / rel
        if dest.exists():
            from maintenance import remove_tree
            remove_tree(dest)
        shutil.copytree(ROOT / "static" / rel, dest, ignore=shutil.ignore_patterns("._*", ".DS_Store"))
    cache = ROOT / ".maintenance"
    cache.mkdir(exist_ok=True)
    config = json.loads((ROOT / "react/tsconfig.app.json").read_text())
    config["compilerOptions"]["baseUrl"] = str(ROOT / "react")
    config["compilerOptions"]["paths"] = {"react": [str(nm / "@types/react")], "react/*": [str(nm / "@types/react/*")], "react-dom/*": [str(nm / "@types/react-dom/*")]}
    config["include"] = [str(ROOT / "react" / f) for f in config["include"]]
    (cache / "react-tsconfig.json").write_text(json.dumps(config, indent=2))
    subprocess.run([a.node, str(nm / "typescript/bin/tsc"), "-p", str(cache / "react-tsconfig.json")], check=True)
    env = {**os.environ, "SITE_NODE_MODULES": str(nm)}
    subprocess.run([a.node, str(nm / "vite/bin/vite.js"), "build", "--config", "vite.locked.config.mjs", "--outDir", str(a.output.resolve())], cwd=ROOT / "react", env=env, check=True)


if __name__ == "__main__":
    main()
