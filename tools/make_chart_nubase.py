#!/usr/bin/env python3
"""Build static/data/nubase2020.json for the Lab chart of nuclides.

Input: tools/data/nubase_4.mas20.txt — NUBASE2020 (F.G. Kondev et al., Chin. Phys. C 45, 030001 (2021)),
the official AMDC file (https://www-nds.iaea.org/amdc/). Its ground-state mass excesses are the
AME2020 values (M. Wang et al., Chin. Phys. C 45, 030003 (2021)).
Output rows (ground states): [Z, N, El, ME_keV, dME_keV, est(0/1), log10 T½[s] (99 stable, -99 unknown, -98 p-unstable),
T½ text, Jπ, discovery year, decay modes, isomers[[s, Ex_keV, T½ text, Jπ], ...]]
Run: python3 tools/make_chart_nubase.py
"""
import json, math, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools/data/nubase_4.mas20.txt"
OUT = ROOT / "static/data/nubase2020.json"
UNIT = {"ys": 1e-24, "zs": 1e-21, "as": 1e-18, "fs": 1e-15, "ps": 1e-12, "ns": 1e-9, "us": 1e-6, "ms": 1e-3, "s": 1,
        "m": 60, "h": 3600, "d": 86400, "y": 3.15576e7, "ky": 3.15576e10, "My": 3.15576e13, "Gy": 3.15576e16,
        "Ty": 3.15576e19, "Py": 3.15576e22, "Ey": 3.15576e25, "Zy": 3.15576e28, "Yy": 3.15576e31}


def num(s):
    s = s.strip().replace("#", "")
    try:
        return float(s)
    except ValueError:
        return None


def main():
    gs, iso = {}, {}
    for line in SRC.read_text().splitlines():
        if line.startswith("#") or len(line) < 40:
            continue
        line = line.ljust(209)
        A = int(line[0:3]); Z = int(line[4:7]); i = int(line[7])
        name = line[11:16].strip(); el = re.sub(r"^\d+", "", name)
        me, dme = num(line[18:31]), num(line[31:42])
        est = 1 if "#" in line[18:31] else 0
        t, unit = line[69:78].strip(), line[78:80].strip()
        if t.startswith("stbl"):
            lg, ttxt = 99, "stable"
        elif t.startswith("p-unst"):
            lg, ttxt = -98, "particle unstable"
        else:
            v = num(t.replace(">", "").replace("<", "").replace("~", ""))
            lg = round(math.log10(v * UNIT[unit]), 3) if v and unit in UNIT else -99
            ttxt = (t + " " + unit).strip()
        jpi = line[88:102].strip()
        year = line[114:118].strip()
        br = line[119:209].strip()
        if i == 0:
            gs[(Z, A - Z)] = [Z, A - Z, el, me, dme, est, lg, ttxt, jpi, int(year) if year.isdigit() else None, br, []]
        elif i in (1, 2, 3, 4, 5, 6) and line[16] in "mnpqrx":
            iso.setdefault((Z, A - Z), []).append([line[16], num(line[42:54]), ttxt, jpi])
    for k, v in iso.items():
        if k in gs:
            gs[k][11] = v
    rows = sorted(gs.values())
    OUT.write_text(json.dumps({"source": "NUBASE2020 (Kondev et al., Chin. Phys. C 45, 030001, 2021) / AME2020 (Wang et al., Chin. Phys. C 45, 030003, 2021)",
                               "rows": rows}, separators=(",", ":"), ensure_ascii=False))
    print(len(rows), "ground states,", sum(len(v) for v in iso.values()), "isomers,", OUT.stat().st_size // 1024, "kB")


if __name__ == "__main__":
    main()
