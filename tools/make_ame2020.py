#!/usr/bin/env python3
"""Build static/data/ame2020.json (ground-state mass excesses, AME2020) from tools/data/ame2020/mass_1.mas20.txt.

Rows: [Z, A, element, ME keV, σ keV, estimated(1/0)].  Source: W.J. Huang et al., Chin. Phys. C 45 (2021) 030002;
M. Wang et al., Chin. Phys. C 45 (2021) 030003.  Used by the games (PI-ICR / frequencies) as the 'AME2020' option.
"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
rows = []
for line in (ROOT / "tools/data/ame2020/mass_1.mas20.txt").read_text().splitlines()[36:]:
    if len(line) < 60:
        continue
    try:
        Z, A, el = int(line[9:14]), int(line[14:19]), line[20:23].strip()
    except ValueError:
        continue
    me, er = line[28:42].strip(), line[42:54].strip()
    est = "#" in me
    try:
        me, er = float(me.replace("#", "")), float(er.replace("#", ""))
    except ValueError:
        continue
    rows.append([Z, A, el, round(me, 4), round(er, 4), int(est)])
out = ROOT / "static/data/ame2020.json"
out.write_text(json.dumps({"source": "AME2020 mass_1.mas20 (Huang et al., Wang et al., Chin. Phys. C 45, 030002/030003, 2021)", "rows": rows}, separators=(",", ":")))
print(len(rows), "nuclides →", out, out.stat().st_size, "B")
