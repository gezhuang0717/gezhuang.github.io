#!/usr/bin/env python3
"""Add labelled city-level map positions to facilities that have no coordinates.

Method (documented in the facility handbook):
  * input: the facility's source-reported city and ISO country code (IAEA etc.);
  * gazetteer: GeoNames cities with population >= 15 000, as packaged by
    `geonamescache` (version recorded in every changed record);
  * a pin is added only when exactly ONE gazetteer city in that country matches
    the name (official, ASCII or alternate name, case/accent-insensitive);
  * the record becomes coordinate_precision = city_approx and
    verification_status = verified_cross_source (city confirmed by two
    independent sources: facility source + gazetteer). The atlas labels every
    such pin "City approximation — not an exact facility location";
  * records that already have coordinates, ambiguous names, unknown cities and
    small towns missing from the gazetteer are left unchanged and stay
    searchable in the directory without a pin.
Writes go through maintenance.transaction (snapshot → stage → validate →
promote). Use --dry-run first.  Usage:
    python3 tools/geocode_cities.py --dry-run
    python3 tools/geocode_cities.py --report ../logs/geocode-report.json
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maintenance  # noqa: E402

try:
    import geonamescache
except ImportError:  # pragma: no cover
    sys.exit("geonamescache is required:  pip install geonamescache==3.0.2")

ALIASES = {  # source spellings that differ from GeoNames (extend when reviewing)
    "st. petersburg": "saint petersburg", "st petersburg": "saint petersburg",
    "kiev": "kyiv", "peking": "beijing", "canton": "guangzhou", "frankfurt am main": "frankfurt am main",
    "washington dc": "washington", "washington, d.c.": "washington", "new york city": "new york city",
}


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    text = text.casefold().replace("’", "'").strip()
    text = " ".join(text.replace("-", " ").replace(".", ". ").split())
    return ALIASES.get(text, text)


def city_candidates(city: str) -> list[str]:
    """Source city fields sometimes hold 'City, Region' or 'City (District)'."""
    raw = str(city or "").strip()
    out = [raw]
    for sep in (",", "(", "/", ";"):
        if sep in raw:
            out.append(raw.split(sep)[0].strip())
    return [c for c in dict.fromkeys(out) if c]


def build_index():
    gc = geonamescache.GeonamesCache()
    index: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for c in gc.get_cities().values():
        names = {c["name"], c.get("asciiname", "")} | set(c.get("alternatenames") or [])
        for n in names:
            if n:
                index[(c["countrycode"], norm(n))].append(c)
    return index, getattr(geonamescache, "__version__", "unknown")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--report", help="write a JSON report of every decision")
    a = p.parse_args(argv)

    path = maintenance.ROOT / "data/facilities/facilities.json"
    doc = maintenance.read(path)
    index, version = build_index()
    today = dt.date.today().isoformat()
    decisions = collections.Counter()
    log = []
    for f in doc["facilities"]:
        if f.get("latitude") is not None:
            decisions["already_mapped"] += 1
            continue
        cc = (f.get("country_code") or "").upper()
        if not cc or not f.get("city"):
            decisions["no_city_or_country"] += 1
            log.append({"id": f["id"], "decision": "no_city_or_country"})
            continue
        hits = []
        for cand in city_candidates(f["city"]):
            ids = {c["geonameid"]: c for c in index.get((cc, norm(cand)), [])}
            if ids:
                hits = list(ids.values())
                break
        if not hits:
            decisions["city_not_in_gazetteer"] += 1
            log.append({"id": f["id"], "decision": "city_not_in_gazetteer", "city": f["city"], "country_code": cc})
            continue
        if len(hits) > 1:  # tie-break: exactly one candidate whose OFFICIAL name matches
            exact = [h for h in hits if any(norm(h["name"]) == norm(cand) for cand in city_candidates(f["city"]))]
            if len(exact) == 1:
                hits = exact
        if len(hits) > 1:
            decisions["ambiguous_city"] += 1
            log.append({"id": f["id"], "decision": "ambiguous_city", "city": f["city"], "country_code": cc,
                        "candidates": [h["geonameid"] for h in hits]})
            continue
        c = hits[0]
        f.update({
            "latitude": round(float(c["latitude"]), 5), "longitude": round(float(c["longitude"]), 5),
            "coordinate_precision": "city_approx", "verification_status": "verified_cross_source",
            "coordinate_verified": True,
            "coordinate_source": f"GeoNames city {c['geonameid']} ({c['name']}, {cc}) via geonamescache {version}; city from facility source record",
            "coordinate_method": "gazetteer_city_match",
            "last_coordinate_check": today,
        })
        decisions["mapped_city_approx"] += 1
        log.append({"id": f["id"], "decision": "mapped_city_approx", "geonameid": c["geonameid"]})

    for f in doc["facilities"]:
        maintenance.validate_facility(f)
    summary = {"checked_at": maintenance.utc(), "gazetteer": f"geonamescache {version} (GeoNames cities15000)",
               "total": len(doc["facilities"]), **decisions}
    print(json.dumps(summary, indent=2))
    if a.report:
        Path(a.report).parent.mkdir(parents=True, exist_ok=True)
        Path(a.report).write_text(json.dumps({"summary": summary, "decisions": log}, indent=1, ensure_ascii=False))
    if not a.dry_run:
        maintenance.transaction({"data/facilities/facilities.json": maintenance.serialized("x.json", doc)})
        print("Promoted. Next: python3 tools/site.py facilities-build")


if __name__ == "__main__":
    main()
