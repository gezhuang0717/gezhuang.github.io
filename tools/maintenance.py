"""Validated maintenance and recovery commands for the existing site CLI.

Canonical data stays in Hugo. Generated public exports never contain local
paths, private source documents, or raw ingestion evidence.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import uuid

import yaml

ROOT = Path(os.environ.get("SITE_ROOT", Path(__file__).resolve().parents[1]))
PRIVATE = ("23rd RIKEN Program Advisory Committee", "19th RIBF Program Advisory Committee")
CATEGORIES = {
    "core-nuclear", "rare-isotope", "penning-trap", "mr-tof", "storage-ring",
    "electrostatic", "cyclotron", "radionuclide", "accelerator-neutron",
    "spallation", "neutron", "research-reactor", "synchrotron", "xfel", "bnct", "nuclear-rd", "historical",
}
PRECISIONS = {"facility_exact", "campus_exact", "address_geocoded_verified", "city_approx", "country_only", "unknown"}
VERIFICATIONS = {"verified_primary", "verified_cross_source", "probable_needs_review", "conflict", "unmapped"}


def read(path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8")) if path.suffix == ".json" else yaml.safe_load(path.read_text(encoding="utf-8"))


def serialized(path, value):
    return (json.dumps(value, ensure_ascii=False, indent=2) if Path(path).suffix == ".json" else yaml.safe_dump(value, allow_unicode=True, sort_keys=False)) + "\n"


def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def remove_tree(path):
    """exFAT removes paired AppleDouble entries along with their parent file."""
    def missing_only(function, target, error):
        if not isinstance(error, FileNotFoundError):
            raise error
    if Path(path).exists():
        shutil.rmtree(path, onexc=missing_only)


def recover(root=ROOT):
    """Restore an interrupted promotion before another write is allowed."""
    base = root / ".maintenance/transactions"
    for journal in sorted(base.glob("*/journal.json")) if base.exists() else []:
        state = json.loads(journal.read_text())
        if state["status"] not in ("preparing", "promoting"):
            continue
        for entry in state["files"]:
            target = root / entry["path"]
            if entry["existed"]:
                target.parent.mkdir(parents=True, exist_ok=True)
                backup = journal.parent / "backup" / entry["path"]
                restore = target.with_name(target.name + ".recover")
                restore.write_bytes(backup.read_bytes())
                os.replace(restore, target)
            elif target.exists():
                target.unlink()
        state["status"] = "recovered"
        journal.write_text(json.dumps(state, indent=2))


def transaction(changes, *, root=ROOT, dry_run=False, fail_after=None):
    """Stage all bytes, snapshot originals, promote, and undo on failure.

The durable journal also repairs a process interrupted between replacements.
Only validated callers supply changes. A directory lock rejects concurrent
writers; an interrupted writer leaves the lock for explicit `recover`.
"""
    normalized = {}
    for relative, value in changes.items():
        relative = Path(relative)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("transaction target must stay inside the website")
        normalized[str(relative)] = value.encode("utf-8") if isinstance(value, str) else value
    report = [{"path": p, "old_sha256": digest((root / p).read_bytes()) if (root / p).exists() else None,
               "new_sha256": digest(b)} for p, b in normalized.items()]
    report = [e for e in report if e["old_sha256"] != e["new_sha256"]]
    if dry_run or not report:
        return report
    root.mkdir(parents=True, exist_ok=True)
    control = root / ".maintenance"
    control.mkdir(exist_ok=True)
    lock = control / "writer.lock"
    try:
        lock.mkdir()
    except FileExistsError as exc:
        raise ValueError("maintenance writer is locked; inspect and use recover after an interruption") from exc
    (lock / "owner.json").write_text(json.dumps({"pid": os.getpid(), "created": utc()}))
    tx = control / "transactions" / (dt.datetime.now().strftime("%Y%m%dT%H%M%S") + "_" + uuid.uuid4().hex[:8])
    tx.mkdir(parents=True)
    state = {"status": "preparing", "created": utc(), "files": []}
    journal = tx / "journal.json"
    try:
        for e in report:
            p = e["path"]
            target = root / p
            existed = target.exists()
            if existed:
                backup = tx / "backup" / p
                backup.parent.mkdir(parents=True, exist_ok=True)
                backup.write_bytes(target.read_bytes())
            stage = tx / "stage" / p
            stage.parent.mkdir(parents=True, exist_ok=True)
            stage.write_bytes(normalized[p])
            state["files"].append({"path": p, "existed": existed, **e})
        state["status"] = "promoting"
        journal.write_text(json.dumps(state, indent=2))
        for i, e in enumerate(state["files"], 1):
            target = root / e["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(tx / "stage" / e["path"], target)
            if fail_after == i:
                raise RuntimeError("simulated interruption for recovery validation")
        state["status"] = "committed"
        journal.write_text(json.dumps(state, indent=2))
    except BaseException:
        if journal.exists():
            recover(root)
        raise
    finally:
        remove_tree(lock)
    return report


def canonical_url(value):
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
    url = urlsplit(str(value or "").strip())
    query = [(k, v) for k, v in parse_qsl(url.query) if not k.startswith("utm_") and k not in ("fbclid", "gclid")]
    return urlunsplit((url.scheme.lower(), url.netloc.lower(), url.path.rstrip("/"), urlencode(query), ""))


def item_identity(e):
    if e.get("item_id"):
        return str(e["item_id"])
    if e.get("doi"):
        return "doi:" + str(e["doi"]).lower().replace("https://doi.org/", "")
    if e.get("arxiv"):
        return "arxiv:" + re.sub(r"v\d+$", "", str(e["arxiv"]).replace("https://arxiv.org/abs/", ""))
    url = canonical_url(e.get("url"))
    if re.search(r"doi\.org/", url):
        return "doi:" + url.split("doi.org/", 1)[1].lower()
    if re.search(r"arxiv\.org/abs/", url):
        return "arxiv:" + re.sub(r"v\d+$", "", url.split("arxiv.org/abs/", 1)[1])
    return url or (str(e.get("date")) + ":" + str(e.get("title", "")).casefold())


def validate_daily(e, facility_ids=None):
    if e.get("type") not in ("log", "news", "paper", "job", "event") or not str(e.get("title", "")).strip():
        raise ValueError("Daily entry requires valid type and title")
    dt.date.fromisoformat(str(e.get("date", "")))
    for key in ("published", "event_start", "event_end", "deadline"):
        if e.get(key):
            dt.date.fromisoformat(str(e[key])[:10])
    if e.get("event_start") and e.get("event_end") and str(e["event_end"]) < str(e["event_start"]):
        raise ValueError("event end precedes start")
    if e.get("lang") not in (None, "en", "zh", "fi", "de", "ja"):
        raise ValueError("invalid Daily language")
    if facility_ids is not None and set(e.get("facility_ids", [])) - facility_ids:
        raise ValueError("Daily references unknown facility")
    if any(marker.casefold() in json.dumps(e, ensure_ascii=False).casefold() for marker in PRIVATE):
        raise ValueError("private talk is prohibited in public data")


def validate_facility(f):
    for key in ("id", "name", "country", "categories", "source_records", "source_urls", "coordinate_precision", "verification_status"):
        if key not in f:
            raise ValueError(f"facility missing {key}")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", f["id"]):
        raise ValueError("invalid stable facility ID")
    if not isinstance(f["name"], dict) or not f["name"].get("en"):
        raise ValueError("facility requires English name")
    if not f["source_records"] or not f["source_urls"]:
        raise ValueError("facility has no source provenance")
    if not set(f["categories"]) <= CATEGORIES or not f["categories"]:
        raise ValueError("invalid facility category")
    if f["coordinate_precision"] not in PRECISIONS or f["verification_status"] not in VERIFICATIONS:
        raise ValueError("invalid coordinate evidence status")
    lat, lon = f.get("latitude"), f.get("longitude")
    if (lat is None) != (lon is None):
        raise ValueError("latitude and longitude must be supplied together")
    if lat is not None and (not -90 <= float(lat) <= 90 or not -180 <= float(lon) <= 180 or (float(lat) == 0 and float(lon) == 0)):
        raise ValueError("invalid or null-island coordinates")
    if f.get("coordinate_verified"):
        if lat is None or not f.get("coordinate_source") or not f.get("last_coordinate_check"):
            raise ValueError("verified coordinate lacks evidence")
        if f["verification_status"] not in ("verified_primary", "verified_cross_source") or f["coordinate_precision"] in ("unknown", "country_only"):
            raise ValueError("coordinate is not eligible for verified mapping")


def facilities(root=ROOT):
    doc = read(root / "data/facilities/facilities.json", {"facilities": []})
    if not isinstance(doc, dict) or not isinstance(doc.get("facilities"), list):
        raise ValueError("facilities database must contain facilities list")
    seen = set()
    for f in doc["facilities"]:
        validate_facility(f)
        if f["id"] in seen:
            raise ValueError("duplicate stable facility ID")
        seen.add(f["id"])
    return doc["facilities"]


def strict_check(root=ROOT):
    for name, key in (("publications", "papers"), ("talks", "talks")):
        doc = read(root / f"data/{name}.yaml")
        if not isinstance(doc, dict) or not isinstance(doc.get(key), list):
            raise ValueError(f"data/{name}.yaml requires the canonical {key!r} list; display headings belong in content")
        if any(m.casefold() in json.dumps(doc, ensure_ascii=False).casefold() for m in PRIVATE):
            raise ValueError(f"private PAC record in {name} database")
    fs = facilities(root)
    ids = {f["id"] for f in fs}
    for path in list((root / "data/daily/manual").glob("*.yaml")) + list((root / "data/daily/auto").glob("*.json")):
        if path.name.startswith("._"):
            continue
        doc = read(path)
        if not isinstance(doc, dict) or not isinstance(doc.get("entries"), list):
            raise ValueError(f"{path.name} requires entries list")
        seen = set()
        for e in doc["entries"]:
            validate_daily(e, ids)
            key = (item_identity(e), e.get("lang", ""))
            if key in seen:
                raise ValueError(f"duplicate Daily identity and language in {path.name}")
            seen.add(key)
    return {"facilities": len(fs)}


def merge_daily(incoming, root=ROOT, dry_run=False):
    ids = {f["id"] for f in facilities(root)}
    groups = {}
    for e in incoming:
        validate_daily(e, ids)
        path = f"data/daily/manual/{str(e['date'])[:7]}.yaml"
        if path not in groups:
            groups[path] = read(root / path, {"entries": []})
        current = groups[path]["entries"]
        key = (item_identity(e), e.get("lang", ""))
        if not any((item_identity(c), c.get("lang", "")) == key for c in current):
            current.append(e)
        current.sort(key=lambda x: (str(x["date"]), str(x["title"])), reverse=True)
    return transaction({p: serialized(p, d) for p, d in groups.items()}, root=root, dry_run=dry_run)


def cmd_facility(a):
    fs = facilities()
    if a.action == "facility-check":
        print(json.dumps({"valid": True, "facilities": len(fs)}))
        return
    incoming = read(a.file)
    incoming = incoming.get("facilities", [incoming]) if isinstance(incoming, dict) else incoming
    indexed = {f["id"]: f for f in fs}
    overrides = read(ROOT / "data/facilities/overrides.json", {"facilities": []})
    reviewed = {f["id"]: f for f in overrides["facilities"]}
    for f in incoming:
        validate_facility(f)
        if f["id"] in indexed and not a.update:
            raise ValueError(f"{f['id']} already exists; use --update for a reviewed replacement")
        if f["id"] in indexed and set(indexed[f["id"]]["source_records"]) - set(f["source_records"]):
            raise ValueError("replacement would lose source identities; preserve them or review mappings separately")
        indexed[f["id"]] = f
        reviewed[f["id"]] = f
    mappings = read(ROOT / "data/facilities/source-mappings.json", {"mappings": []})["mappings"]
    assigned = {e["source_id"]: e["facility_id"] for e in mappings}
    for f in incoming:
        for sid in f["source_records"]:
            if sid in assigned and assigned[sid] != f["id"]:
                raise ValueError("source identity already belongs to another facility: " + sid)
            if sid not in assigned:
                mappings.append({"source_id": sid, "facility_id": f["id"], "machine_id": next((x["id"] for x in f.get("machines", []) if x.get("source_id") == sid), None), "decision": "reviewed individual facility import"})
                assigned[sid] = f["id"]
    output = {"schema_version": 1, "facilities": sorted(indexed.values(), key=lambda f: f["id"])}
    coverage = read(ROOT / "data/facilities/coverage.json", {})
    from collections import Counter
    coverage.update(source_counts=dict(Counter(e["source_id"].split(":", 1)[0] for e in mappings)), source_records=len(mappings), assigned_records=len(mappings), unexplained_source_loss=0, facilities_programs=len(indexed), machines=sum(len(f.get("machines", [])) for f in indexed.values()), confirmed_campuses=len({f.get("site_id") for f in indexed.values() if f.get("site_mapping_status") == "confirmed"}), unresolved_campus_associations=sum(f.get("site_mapping_status") != "confirmed" for f in indexed.values()))
    changes = {"data/facilities/facilities.json": serialized("x.json", output), "data/facilities/overrides.json": serialized("x.json", {"facilities": list(reviewed.values())}), "data/facilities/source-mappings.json": serialized("x.json", {"mappings": mappings}), "data/facilities/coverage.json": serialized("x.json", coverage)}
    print(json.dumps(transaction(changes, dry_run=a.dry_run), indent=2))


def cmd_geo(a):
    from shapely.geometry import shape, Point
    boundaries = read(a.boundaries)
    polygons = {}
    for f in boundaries["features"]:
        props = f["properties"]
        for k in ("NAME", "ADMIN", "NAME_LONG", "SOVEREIGNT", "ISO_A2", "ISO_A3", "ISO_A2_EH", "ISO_A3_EH"):
            if props.get(k):
                polygons[str(props[k]).casefold()] = shape(f["geometry"])
    problems = []
    used = {}
    for f in facilities():
        if f.get("latitude") is None:
            continue
        key = str(f.get("country_code") or f["country"]).casefold()
        point = Point(float(f["longitude"]), float(f["latitude"]))
        polygon = polygons.get(key)
        if polygon is None:
            problems.append({"id": f["id"], "issue": "country_not_resolved"})
        elif not polygon.covers(point):
            # Coastal campuses and coarse boundary artifacts need explicit review.
            problems.append({"id": f["id"], "issue": "outside_country_or_coastal_boundary", "verified": bool(f.get("coordinate_verified"))})
        pair = (round(point.x, 5), round(point.y, 5))
        if pair in used and used[pair].get("site_id") != f.get("site_id"):
            problems.append({"id": f["id"], "issue": "unrelated_shared_coordinate", "other": used[pair]["id"]})
        used[pair] = f
    report = {"checked_at": utc(), "boundary_sha256": digest(Path(a.boundaries).read_bytes()), "anomalies": problems,
              "note": "Country checks are anomaly screening, not proof of an exact facility address."}
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    if any(e.get("verified") for e in problems):
        raise ValueError("verified map point has unresolved geographic anomaly")


def cmd_build(a):
    fs = facilities()
    public = [{k: v for k, v in f.items() if k not in ("raw_record", "local_source_path")} for f in fs]
    mapped = [f for f in public if f.get("coordinate_verified") and f.get("latitude") is not None]
    counts = {"facilities": len(fs), "sites": len({f.get("site_id", f["id"]) for f in fs}),
              "machines": sum(len(f.get("machines", [])) for f in fs), "verified_mapped": len(mapped),
              "unmapped": len(fs) - len(mapped), "categories": {c: sum(c in f["categories"] for f in fs) for c in sorted(CATEGORIES)}}
    counts.update(read(ROOT / "data/facilities/coverage.json", {}))
    features = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [f["longitude"], f["latitude"]]}, "properties": f} for f in mapped]
    changes = {"static/data/facilities.json": serialized("x.json", {"schema_version": 1, "coverage": counts, "facilities": public}),
               "static/data/facilities.geojson": serialized("x.json", {"type": "FeatureCollection", "features": features})}
    # Stable pages are derived from the canonical database, including unmapped records.
    # Hugo content adapters generate pages without thousands of tiny source files
    # (important for exFAT storage). Stable URLs still exist for every record.
    for lang in ("en", "zh", "fi", "de", "ja"):
        changes[f"content/{lang}/facilities/_content.gotmpl"] = '''{{ range hugo.Data.facilities.facilities.facilities }}
{{ $page := dict "path" .id "title" (or (index .name "LANG") .name.en) "params" (dict "facility_id" .id "facility_record" . "showDate" false) "content" (dict "mediaType" "text/markdown" "value" "{{< facility-detail >}}") }}
{{ $.AddPage $page }}
{{ end }}
'''.replace('LANG', lang)
    report = transaction(changes, dry_run=a.dry_run)
    print(json.dumps(report if a.dry_run else counts, indent=2))


def cmd_snapshot(a):
    dest = ROOT / ".maintenance/snapshots" / (dt.datetime.now().strftime("%Y%m%dT%H%M%S") + "_" + re.sub(r"[^a-zA-Z0-9_-]", "_", a.label))
    dest.mkdir(parents=True, exist_ok=False)
    manifest = {"created": utc(), "label": a.label, "files": []}
    for item in ("site.yaml", "content", "data", "layouts", "assets", "static", "tools", ".github", "docs", "react", "manuals"):
        base = ROOT / item
        paths = [base] if base.is_file() else base.rglob("*")
        for p in paths:
            if not p.is_file() or any(x.startswith("._") or x in ("__pycache__", "node_modules", "dist", "public") for x in p.parts):
                continue
            target = dest / p.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            b = p.read_bytes()
            target.write_bytes(b)
            manifest["files"].append({"path": str(p.relative_to(ROOT)), "sha256": digest(b)})
    manifest["git_state"] = subprocess.run(["git", "status", "--short"], cwd=ROOT, text=True, capture_output=True).stdout
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(dest)


def cmd_versions(a):
    subprocess.run(["git", "tag", "--list", "site-v*"], cwd=ROOT, check=True)


def cmd_release(a):
    strict_check()
    report = read(a.validation)
    if not report or report.get("release_gate") != "PASS":
        raise ValueError("release tag requires a validation manifest with release_gate PASS")
    if subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip():
        raise ValueError("commit changes before tagging a release")
    subprocess.run(["git", "tag", "-a", "site-v" + a.version, "-m", "Validated website release " + a.version], cwd=ROOT, check=True)


def cmd_rollback(a):
    subprocess.run(["git", "rev-parse", "--verify", a.to + "^{commit}"], cwd=ROOT, check=True, capture_output=True)
    print(f"Preview: git worktree add ../preview-{a.to} {a.to}\nInspect: git diff {a.to}..HEAD\nPublished recovery: git revert <reviewed-bad-commit>\nNo history is changed by rollback-plan.")


def cmd_recover(a):
    lock = ROOT / ".maintenance/writer.lock"
    owner = read(lock / "owner.json", {})
    if owner.get("pid"):
        try:
            os.kill(owner["pid"], 0)
        except ProcessLookupError:
            pass
        else:
            raise ValueError("writer process is still running; recovery would conflict with it")
    recover()
    if lock.exists():
        remove_tree(lock)
    print("Interrupted transactions restored; inspect git diff before continuing.")


def register(sub):
    for name in ("facility-add", "facilities-import"):
        p = sub.add_parser(name, help="validate and transactionally add/update facility JSON or YAML")
        p.add_argument("file")
        p.add_argument("--update", action="store_true")
        p.add_argument("--dry-run", action="store_true")
        p.set_defaults(func=cmd_facility, action=name)
    p = sub.add_parser("facility-check", help="validate facility identities and coordinate evidence")
    p.set_defaults(func=cmd_facility, action="facility-check")
    p = sub.add_parser("geo-validate", help="screen coordinates against a supplied country boundary GeoJSON")
    p.add_argument("--boundaries", required=True)
    p.add_argument("--out")
    p.set_defaults(func=cmd_geo)
    p = sub.add_parser("facilities-build", help="generate public JSON, GeoJSON and detail pages")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=cmd_build)
    p = sub.add_parser("snapshot", help="snapshot editable sources with SHA256 manifest")
    p.add_argument("--label", required=True)
    p.set_defaults(func=cmd_snapshot)
    p = sub.add_parser("versions", help="list release tags")
    p.set_defaults(func=cmd_versions)
    p = sub.add_parser("release", help="tag a clean validated commit")
    p.add_argument("--version", required=True)
    p.add_argument("--validation", required=True)
    p.set_defaults(func=cmd_release)
    p = sub.add_parser("rollback-plan", help="print a non-destructive previous-version preview plan")
    p.add_argument("--to", required=True)
    p.set_defaults(func=cmd_rollback)
    p = sub.add_parser("recover", help="restore interrupted promotion; run only after inspecting writer ownership")
    p.set_defaults(func=cmd_recover)
