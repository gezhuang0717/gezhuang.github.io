#!/usr/bin/env python3
"""Build static/data/massmodels.json for the chart of nuclides (theory masses, drip lines, process paths).

Inputs (all in tools/data/):
  massmodels/<key>.txt   one nucleus per line: Z A ME(MeV) beta2   ('#' = comment)
                         frdm1995, hfb17, hfbd1m were extracted from TALYS-1.95 structure/masses/{moller,hfb,hfbd1m}
                         (copy on the PSSD: /Volumes/PSSD/codex/talys/TALYS-1.95-macos-arm64-v2/).
  paths/r-process-etfsi.csv  N,Z   r-process path digitised from ApJ 815, 82 (2015), Fig. 2 (doi:10.1088/0004-637X/815/2/82)
  paths/rp-process.txt       N Z   approximate rp-process path (Mulberry data set)

Add another model (e.g. FRDM2012, WS4): put <key>.txt in the same format into massmodels/ and add an entry to MODELS.
Run:  python3 tools/make_mass_models.py
"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
D = ROOT / "tools/data"
MODELS = {
    "frdm1995": {"name": "FRDM (1995)", "ref": "P. Möller, J.R. Nix, W.D. Myers, W.J. Swiatecki, At. Data Nucl. Data Tables 59, 185 (1995)", "url": "https://doi.org/10.1006/adnd.1995.1002"},
    "hfb17": {"name": "HFB-17 (Skyrme)", "ref": "S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. Lett. 102, 152503 (2009)", "url": "https://doi.org/10.1103/PhysRevLett.102.152503"},
    "hfbd1m": {"name": "HFB-D1M (Gogny)", "ref": "S. Goriely, S. Hilaire, M. Girod, S. Péru, Phys. Rev. Lett. 102, 242501 (2009)", "url": "https://doi.org/10.1103/PhysRevLett.102.242501"},
}

def read_model(path):
    rows = []
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        Z, A, me, b2 = line.split()[:4]
        Z, A = int(Z), int(A)
        rows.append([Z, A - Z, round(float(me) * 1000), round(float(b2) * 1000)])   # keV, beta2 × 1000
    return rows

def read_path(path, sep=None):
    pts = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line[0].isalpha():
            continue
        n, z = [int(float(x)) for x in line.replace(",", " ").split()[:2]]
        pts.append([z, n])
    return pts

out = {"models": {}, "paths": {}}
for key, meta in MODELS.items():
    f = D / "massmodels" / f"{key}.txt"
    if f.exists():
        out["models"][key] = {**meta, "rows": read_model(f)}
out["paths"]["r"] = {"name": "r-process path (ETFSI masses)", "ref": "digitised from ApJ 815, 82 (2015), Fig. 2", "url": "https://doi.org/10.1088/0004-637X/815/2/82",
                     "pts": read_path(D / "paths/r-process-etfsi.csv")}
out["paths"]["rp"] = {"name": "rp-process path (approximate)", "ref": "approximate path, Mulberry data set", "url": "", "pts": read_path(D / "paths/rp-process.txt")}
dst = ROOT / "static/data/massmodels.json"
dst.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
print(f"Wrote {dst.relative_to(ROOT)}: " + ", ".join(f"{k} {len(v['rows'])}" for k, v in out["models"].items())
      + f"; paths r {len(out['paths']['r']['pts'])}, rp {len(out['paths']['rp']['pts'])}; {dst.stat().st_size // 1024} kB")
