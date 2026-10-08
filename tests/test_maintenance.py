import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import maintenance as m


@pytest.fixture
def site(tmp_path):
    (tmp_path / "data").mkdir()
    (tmp_path / "data/publications.yaml").write_text("papers: []\n")
    (tmp_path / "data/talks.yaml").write_text("talks: []\n")
    return tmp_path


def test_renamed_key_cannot_hide_talks(site):
    (site / "data/talks.yaml").write_text("Main talks: []\n")
    with pytest.raises(ValueError, match="canonical"):
        m.strict_check(site)


def test_private_pac_rejected(site):
    (site / "data/talks.yaml").write_text(yaml.safe_dump({"talks": [{"event": m.PRIVATE[0]}]}))
    with pytest.raises(ValueError, match="private"):
        m.strict_check(site)


def test_translation_pairs_preserved_and_doi_variants_deduplicated(site):
    en = {"date": "2026-10-03", "type": "paper", "title": "Public result", "doi": "10.1234/example", "lang": "en"}
    zh = {**en, "title": "公开结果", "lang": "zh"}
    variant = {"date": "2026-10-03", "type": "paper", "title": "Same result", "url": "https://doi.org/10.1234/example", "lang": "en"}
    m.merge_daily([en, zh, variant], root=site)
    assert len(m.read(site / "data/daily/manual/2026-10.yaml")["entries"]) == 2


def test_invalid_batch_leaves_canonical_unchanged(site):
    good = {"date": "2026-10-03", "type": "log", "title": "A"}
    with pytest.raises(ValueError):
        m.merge_daily([good, {**good, "date": "2026-02-30"}], root=site)
    assert not (site / "data/daily/manual/2026-10.yaml").exists()


def test_dry_run_writes_nothing(site):
    before = (site / "data/talks.yaml").read_bytes()
    report = m.transaction({"data/talks.yaml": "talks: [1]"}, root=site, dry_run=True)
    assert report and not (site / ".maintenance").exists()
    assert (site / "data/talks.yaml").read_bytes() == before


def test_promotion_failure_restores_old_and_removes_new(site):
    old = (site / "data/talks.yaml").read_bytes()
    with pytest.raises(RuntimeError):
        m.transaction({"data/talks.yaml": "talks: [1]", "data/new.json": "{}"}, root=site, fail_after=2)
    assert (site / "data/talks.yaml").read_bytes() == old
    assert not (site / "data/new.json").exists()
    assert not (site / ".maintenance/writer.lock").exists()


def test_killed_process_can_recover_repeatedly(site):
    code = '''import os,sys
sys.path.insert(0,sys.argv[1]);import maintenance as m
from pathlib import Path
real=m.os.replace
def replace(a,b):
    real(a,b);os._exit(23)
m.os.replace=replace
m.transaction({"data/talks.yaml":"talks: [1]","data/new.json":"{}"},root=Path(sys.argv[2]))
'''
    result = subprocess.run([sys.executable, "-c", code, str(Path(m.__file__).parent), str(site)])
    assert result.returncode == 23
    m.recover(site)
    m.recover(site)
    assert (site / "data/talks.yaml").read_text() == "talks: []\n"
    assert not (site / "data/new.json").exists()


def test_unknown_facility_reference_rejected():
    with pytest.raises(ValueError, match="unknown facility"):
        m.validate_daily({"date": "2026-10-03", "type": "event", "title": "Event", "facility_ids": ["missing"]}, set())


def test_verified_coordinate_requires_evidence():
    f = {"id": "demo", "name": {"en": "Demo"}, "country": "France", "categories": ["core-nuclear"], "source_records": ["test:1"], "source_urls": ["https://example.org"], "coordinate_precision": "unknown", "verification_status": "unmapped", "coordinate_verified": True, "latitude": 49, "longitude": 2}
    with pytest.raises(ValueError, match="evidence"):
        m.validate_facility(f)
    f.update(coordinate_verified=False, latitude=0, longitude=0)
    with pytest.raises(ValueError, match="null-island"):
        m.validate_facility(f)


def test_outside_country_verified_coordinate_blocks(monkeypatch, tmp_path):
    boundaries = {"features": [{"properties": {"ISO_A2": "FR"}, "geometry": {"type": "Polygon", "coordinates": [[[0,40],[5,40],[5,50],[0,50],[0,40]]]}}]}
    path = tmp_path / "boundaries.json"; path.write_text(json.dumps(boundaries))
    monkeypatch.setattr(m, "facilities", lambda: [{"id": "swapped", "country_code": "FR", "country": "France", "latitude": 2, "longitude": 49, "coordinate_verified": True, "site_id": "a"}])
    with pytest.raises(ValueError, match="geographic anomaly"):
        m.cmd_geo(argparse.Namespace(boundaries=str(path), out=str(tmp_path / "report.json")))


def test_public_source_mapping_is_lossless():
    root = Path(__file__).resolve().parents[1]
    coverage = m.read(root / "data/facilities/coverage.json")
    mapping = m.read(root / "data/facilities/source-mappings.json")["mappings"]
    fs = m.facilities(root)
    assert coverage["facilities_programs"] >= 1000
    assert coverage["unexplained_source_loss"] == 0
    assert len(mapping) == coverage["source_records"] == len({x["source_id"] for x in mapping})
    assert {x["source_id"] for x in mapping} == {sid for f in fs for sid in f["source_records"]}
    assert {x["facility_id"] for x in mapping} <= {f["id"] for f in fs}


def test_refresh_cannot_drop_or_reassign_sources():
    from ingest_facilities import preserve_identities
    previous = [{"source_id": "source:1", "facility_id": "a"}]
    with pytest.raises(ValueError, match="disappeared"):
        preserve_identities(previous, [])
    with pytest.raises(ValueError, match="mapping changed"):
        preserve_identities(previous, [{"source_id": "source:1", "facility_id": "b"}])
    preserve_identities(previous, previous)
