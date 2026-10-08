"""Reproducible, offline adapters for archived public facility collections.

Run against the release's sources directory. Only selected public fields are
published. Exact source IDs are mapped once each; originals remain outside Git.
No city centroid becomes an exact campus coordinate.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import zipfile

from bs4 import BeautifulSoup
import pycountry
from shapely.geometry import shape, Point
import maintenance as m

DAY = "2026-10-03"
CYC = "https://nucleus.iaea.org/sites/accelerators/Pages/Cyclotron.aspx"
RR = "https://nucleus.iaea.org/rrdb/"


def text(value):
    return re.sub(r"\s+", " ", BeautifulSoup(str(value or ""), "html.parser").get_text(" ")).replace("\u200b", "").strip()


def norm(value):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", text(value)).encode("ascii", "ignore").decode().lower())


def country(name):
    aliases = {"Korea, Republic of": "KR", "Korea, Democratic People's Republic of": "KP", "Iran, Islamic Republic of": "IR", "Russia": "RU", "Taiwan": "TW", "Viet Nam": "VN", "Bolivia": "BO", "Venezuela": "VE", "United States of America": "US", "Czech Republic": "CZ", "Slovak Republic": "SK", "United Republic of Tanzania": "TZ", "Dubai": "AE", "United Arab Emirate": "AE", "Dem. P.R. of Korea": "KP", "North Korea": "KP", "South Korea": "KR", "Myanmar (Burma)": "MM", "Macedonia": "MK", "Northern Ireland": "GB", "Taiwan, China": "TW", "Netherlands, Kingdom of the": "NL"}
    try:
        return aliases.get(name) or pycountry.countries.lookup(name).alpha_2
    except LookupError:
        return ""


def base(ident, name, c, city, categories, refs, urls):
    return {"id": ident, "name": {"en": name, "zh": name}, "country": c, "country_code": country(c), "city": city,
            "categories": categories, "techniques": [], "capabilities": [], "status": "unknown",
            "site_id": ident + "-site-provisional", "site_mapping_status": "unresolved",
            "source_records": refs, "source_urls": urls, "source_checked": DAY,
            "coordinate_precision": "unknown", "verification_status": "unmapped", "coordinate_verified": False,
            "latitude": None, "longitude": None, "machines": [], "instruments": [],
            "description": {"en": "Public source record; facility status and location require review.", "zh": "公开来源记录；设施状态与位置仍需核实。"}}


def ingest(source):
    records, mapping = [], []
    raw = json.loads((source / "cyclotrons_rest.json").read_text())["d"]["results"]
    groups = defaultdict(list)
    for r in raw:
        name = text(r["Title"])
        # Unspecified facilities cannot be merged merely because they share a city.
        key = (norm(name), norm(r["City"]), norm(r["Country"]), norm(r.get("Address")))
        if norm(name) in ("", "unspecified", "unknown", "na"):
            key += (str(r["ID"]),)
        groups[key].append(r)
    for rows in groups.values():
        first = min(rows, key=lambda r: r["ID"])
        ident = f"iaea-cyclotron-{first['ID']}"
        name = text(first["Title"])
        if norm(name) in ("", "unspecified", "unknown", "na"):
            name = f"Unspecified cyclotron facility in {text(first['City']) or text(first['Country'])} (IAEA {first['ID']})"
        refs = [f"iaea-cyclotron:{r['ID']}" for r in rows]
        f = base(ident, name, text(first["Country"]), text(first["City"]), ["cyclotron", "radionuclide"], refs, [CYC])
        f["address"] = text(first.get("Address"))
        website = first.get("Facility_x0020_Website")
        if isinstance(website, dict):
            website = website.get("Url")
        if website and str(website).startswith(("https://", "http://")):
            f["official_url"] = website
        for r in rows:
            machine = {"id": f"iaea-cyclotron-machine-{r['ID']}", "source_id": f"iaea-cyclotron:{r['ID']}", "manufacturer": text(r.get("Manufacturer")), "model": text(r.get("Model")), "proton_energy_mev": text(r.get("Proton_x0020_Energy_x0020__x0028")), "installation_year": text(r.get("Year_x0020_of_x0020_installation"))}
            f["machines"].append(machine)
            mapping.append({"source_id": machine["source_id"], "facility_id": ident, "machine_id": machine["id"], "decision": "same normalized institution, city, country and address; unspecified names kept separate"})
            if r.get("PET_x0020_radionuclides"):
                f["capabilities"].append("PET radionuclide production")
            if r.get("SPECT_x0020_radionuclides"):
                f["capabilities"].append("SPECT radionuclide production")
            use = text(r.get("Research_x0020_utilizations"))
            if use:
                f["capabilities"].append(use)
        f["capabilities"] = sorted(set(f["capabilities"]))
        f["techniques"] = ["cyclotron"]
        f["description"] = {"en": "IAEA-listed cyclotron facility. Source installation records are shown separately; current operating status has not been independently confirmed.", "zh": "IAEA 登记的回旋加速器设施。各设备安装记录分别保留；当前运行状态尚未独立核实。"}
        records.append(f)
    reactors = json.loads((source / "rrdb_reactors").read_text())["data"]
    status = {"1O": "operational", "2C": "under-construction", "3P": "planned", "4S": "permanent-shutdown", "7X": "extended-shutdown", "6U": "decommissioning", "6D": "decommissioned"}
    for r in reactors:
        ident = f"iaea-reactor-{r['rreactorId']}"
        sid = "iaea-rrdb:" + str(r["rreactorId"])
        f = base(ident, text(r["facName"]) or ident, text(r["country"]), text(r["closestCity"]), ["research-reactor"], [sid], [RR + "home"])
        f["country_code"] = r["isoCode"]
        f["status"] = status.get(r["statusShtDesc"], "unknown")
        f["source_status"] = r["statusLngDesc"]
        f["techniques"] = ["research-reactor"]
        f["machines"] = [{"id": ident + "-machine", "source_id": sid, "iaea_code": r["iaeaCode"], "reactor_type": r["typeLngDesc"], "thermal_power_kw": r["therPowSte"]}]
        for k in ["isotopeProduction", "neutronScattering", "neutronRadiography", "activationAnalysis", "nuclearDataProvision", "teaching", "training", "materials", "neutronCaptureTherapy"]:
            if r.get(k):
                f["capabilities"].append(k)
        if r.get("neutronScattering") or r.get("neutronRadiography"):
            f["categories"].append("neutron")
        if r.get("neutronCaptureTherapy"):
            f["categories"].append("bnct")
        f["description"] = {"en": "IAEA research-reactor program. Status and capabilities are source-reported; campus identity and coordinates remain unresolved.", "zh": "IAEA 研究堆项目。状态与用途按来源记录显示；园区身份与坐标仍待核实。"}
        records.append(f)
        mapping.append({"source_id": sid, "facility_id": ident, "machine_id": ident + "-machine", "decision": "one named reactor program; campus association not inferred"})
    return records, mapping, {"iaea-cyclotron": len(raw), "iaea-rrdb": len(reactors)}


def preserve_identities(previous, incoming):
    old = {e["source_id"]: e["facility_id"] for e in previous}
    new = {e["source_id"]: e["facility_id"] for e in incoming}
    if set(old) - set(new):
        raise ValueError("source records disappeared from refresh; review archived collection before import")
    if any(new[sid] != fid for sid, fid in old.items()):
        raise ValueError("facility identity mapping changed; explicit reconciliation is required")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--core", type=Path, required=True, help="reviewed public core records")
    parser.add_argument("--dry-run", action="store_true")
    a = parser.parse_args()
    fs, mapping, counts = ingest(a.sources)
    core = json.loads(a.core.read_text())["facilities"]
    fs.extend(core)
    for f in core:
        for sid in f["source_records"]:
            source = sid.split(":", 1)[0]
            counts[source] = counts.get(source, 0) + 1
            mapping.append({"source_id": sid, "facility_id": f["id"], "machine_id": None, "decision": "reviewed official or historical NuPECC program association"})
    # Reviewed corrections survive adapter refreshes. New IDs and their mappings
    # must enter through the transactional individual import first.
    previous = m.read(m.ROOT / "data/facilities/source-mappings.json", {"mappings": []})["mappings"]
    indexed = {f["id"]: f for f in fs}
    for f in m.read(m.ROOT / "data/facilities/overrides.json", {"facilities": []})["facilities"]:
        if f["id"] in indexed and set(indexed[f["id"]]["source_records"]) - set(f["source_records"]):
            raise ValueError("reviewed override omits new source identities: " + f["id"])
        indexed[f["id"]] = f
        present = {e["source_id"] for e in mapping}
        for e in previous:
            if e["facility_id"] == f["id"] and e["source_id"] not in present:
                mapping.append(e)
                key = e["source_id"].split(":", 1)[0]
                counts[key] = counts.get(key, 0) + 1
    fs = list(indexed.values())
    preserve_identities(previous, mapping)
    boundaries = json.loads((a.sources / "boundaries.geojson").read_text())
    polygons = {str(f["properties"].get("ISO_A2_EH")): shape(f["geometry"]) for f in boundaries["features"]}
    continents = {str(f["properties"].get("ISO_A2_EH")): f["properties"].get("CONTINENT") for f in boundaries["features"]}
    for f in fs:
        if not f.get("country_code"):
            f["country_code"] = country(f["country"])
        standardized = pycountry.countries.get(alpha_2=f["country_code"])
        if standardized and f["country"] != standardized.name:
            f["source_country_label"] = f["country"]
            f["country"] = standardized.name
        f["continent"] = continents.get(f["country_code"], "Unresolved")
        if f.get("coordinate_verified") and not polygons.get(f["country_code"], shape({"type":"Polygon","coordinates":[]})).covers(Point(f["longitude"], f["latitude"])):
            raise ValueError("core geographic anomaly: " + f["id"])
        m.validate_facility(f)
    assigned = [e["source_id"] for e in mapping]
    if len(assigned) != len(set(assigned)) or len(assigned) != sum(counts.values()):
        raise ValueError("unexplained source loss or duplicate mapping")
    coverage = {"source_counts": counts, "source_records": len(assigned), "assigned_records": len(assigned), "unexplained_source_loss": 0,
                "facilities_programs": len(fs), "machines": sum(len(f["machines"]) for f in fs),
                "confirmed_campuses": len({f["site_id"] for f in fs if f["site_mapping_status"] == "confirmed"}),
                "unresolved_campus_associations": sum(f["site_mapping_status"] != "confirmed" for f in fs),
                "note": "Facility/program counts include historical reactors and unresolved source-reported facilities. Campus IDs marked provisional are not confirmed campuses."}
    payload = {"schema_version": 1, "facilities": sorted(fs, key=lambda f:f["id"])}
    similar = defaultdict(list)
    for f in fs:
        similar[(norm(f["name"]["en"]), f["country_code"], norm(f["city"]))].append(f["id"])
    reviews = {"checked_at": DAY, "possible_related_records": [ids for key, ids in similar.items() if key[0] and len(ids) > 1], "unresolved_countries": [f["id"] for f in fs if not f["country_code"]], "decision": "Possible related records are flagged for review, not automatically merged across addresses or collections."}
    changes = {"data/facilities/facilities.json": m.serialized("x.json", payload), "data/facilities/source-mappings.json": m.serialized("x.json", {"mappings": mapping}), "data/facilities/coverage.json": m.serialized("x.json", coverage)}
    changes["data/facilities/reconciliation-review.json"] = m.serialized("x.json", reviews)
    print(json.dumps(coverage, indent=2))
    m.transaction(changes, dry_run=a.dry_run)


if __name__ == "__main__":
    main()
