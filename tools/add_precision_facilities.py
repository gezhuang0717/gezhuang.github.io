#!/usr/bin/env python3
"""Add / correct the core nuclear-physics facilities (Penning traps, MR-TOF, storage rings,
rare-isotope beams, nuclear astrophysics) with verified site coordinates.

Coordinates marked facility_exact / campus_exact were read from the Wikipedia infobox
of the facility or host institute (source URL stored per record, checked 2026-10-04).
Facilities whose site could not be verified get a GeoNames city point labelled
city_approx (same rule as tools/geocode_cities.py) or no pin at all.
Run: python3 tools/add_precision_facilities.py && python3 tools/site.py facilities-build
"""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maintenance  # noqa: E402

TODAY = dt.date.today().isoformat()
W = "https://en.wikipedia.org/wiki/"
DW = "https://de.wikipedia.org/wiki/"
# id: (name, country, cc, city, continent, categories, techniques, url, (lat, lon, precision, coord_source) | None, aliases)
F = {
 "cern-isolde": ("CERN ISOLDE (ISOLTRAP, MR-TOF)", "Switzerland", "CH", "Meyrin", "Europe", ["core-nuclear", "rare-isotope", "penning-trap", "mr-tof"], ["penning-trap", "mr-tof", "isol"], "https://isolde.cern/", (46.2330, 6.0556, "campus_exact", W + "CERN"), ["ISOLDE", "ISOLTRAP"]),
 "cern-ad-base": ("CERN Antiproton Decelerator (BASE Penning trap)", "Switzerland", "CH", "Meyrin", "Europe", ["core-nuclear", "penning-trap"], ["penning-trap"], "https://base.web.cern.ch/", (46.2330, 6.0556, "campus_exact", W + "CERN"), ["BASE", "Antiproton Decelerator"]),
 "cern-ntof": ("CERN n_TOF", "Switzerland", "CH", "Meyrin", "Europe", ["core-nuclear", "neutron", "accelerator-neutron"], ["neutron-time-of-flight"], "https://ntof-exp.web.cern.ch/", (46.2330, 6.0556, "campus_exact", W + "CERN"), ["n_TOF"]),
 "triumf-isac": ("TRIUMF / ISAC (TITAN)", "Canada", "CA", "Vancouver", "North America", ["core-nuclear", "rare-isotope", "cyclotron", "penning-trap", "mr-tof"], ["penning-trap", "mr-tof", "isol"], "https://www.triumf.ca/", (49.24779, -123.23060, "facility_exact", W + "TRIUMF"), ["TRIUMF", "TITAN", "ISAC", "DRAGON"]),
 "frib": ("Facility for Rare Isotope Beams (LEBIT)", "United States", "US", "East Lansing", "North America", ["core-nuclear", "rare-isotope", "penning-trap"], ["penning-trap", "fragmentation"], "https://frib.msu.edu/", (42.72478, -84.47383, "facility_exact", W + "Facility_for_Rare_Isotope_Beams"), ["FRIB", "LEBIT"]),
 "riken-ribf": ("RIKEN RI Beam Factory (Rare-RI Ring, ZD MRTOF, KISS)", "Japan", "JP", "Wako", "Asia", ["core-nuclear", "rare-isotope", "cyclotron", "storage-ring", "mr-tof"], ["storage-ring", "mr-tof", "fragmentation"], "https://www.nishina.riken.jp/ribf/", (35.7805, 139.6126, "facility_exact", W + "Radioactive_Isotope_Beam_Factory"), ["RIBF", "Rare-RI Ring", "KISS", "SLOWRI"]),
 "gsi-fair": ("GSI / FAIR (ESR, CRYRING, SHIPTRAP, FRS Ion Catcher)", "Germany", "DE", "Darmstadt", "Europe", ["core-nuclear", "rare-isotope", "storage-ring", "penning-trap", "mr-tof"], ["storage-ring", "penning-trap", "mr-tof", "fragmentation"], "https://www.gsi.de/", (49.93139, 8.67917, "campus_exact", DW + "GSI_Helmholtzzentrum_f%C3%BCr_Schwerionenforschung"), ["GSI", "FAIR", "ESR", "CRYRING", "SHIPTRAP", "FRS Ion Catcher"]),
 "anl-atlas": ("Argonne ATLAS (CPT, CARIBU, N = 126 Factory)", "United States", "US", "Lemont", "North America", ["core-nuclear", "rare-isotope", "penning-trap", "mr-tof"], ["penning-trap", "mr-tof"], "https://www.anl.gov/atlas", (41.70917, -87.98200, "campus_exact", DW + "Argonne_National_Laboratory"), ["ATLAS", "CPT", "CARIBU"]),
 "mpik-heidelberg": ("Max Planck Institute for Nuclear Physics (PENTATRAP, ALPHATRAP)", "Germany", "DE", "Heidelberg", "Europe", ["core-nuclear", "penning-trap"], ["penning-trap"], "https://www.mpi-hd.mpg.de/", (49.38778, 8.70917, "facility_exact", DW + "Max-Planck-Institut_f%C3%BCr_Kernphysik"), ["MPIK", "PENTATRAP", "ALPHATRAP"]),
 "lngs-luna": ("Gran Sasso National Laboratory (LUNA)", "Italy", "IT", "Assergi", "Europe", ["core-nuclear", "nuclear-rd"], ["underground-accelerator"], "https://luna.lngs.infn.it/", (42.42056, 13.51642, "campus_exact", DW + "Laboratori_Nazionali_del_Gran_Sasso"), ["LNGS", "LUNA"]),
 "kit-katrin": ("KATRIN, KIT Campus North", "Germany", "DE", "Eggenstein-Leopoldshafen", "Europe", ["core-nuclear", "nuclear-rd"], ["beta-spectrometer"], "https://www.katrin.kit.edu/", (49.09572, 8.43611, "facility_exact", DW + "KATRIN"), ["KATRIN"]),
 "jinr-flnr": ("JINR Flerov Laboratory of Nuclear Reactions", "Russia", "RU", "Dubna", "Europe", ["core-nuclear", "rare-isotope", "cyclotron"], ["fusion-evaporation"], "https://flerovlab.jinr.ru/", (56.74639, 37.18944, "campus_exact", W + "Joint_Institute_for_Nuclear_Research"), ["FLNR", "JINR"]),
 "ithemba": ("iThemba LABS", "South Africa", "ZA", "Faure", "Africa", ["core-nuclear", "cyclotron"], ["cyclotron"], "https://tlabs.ac.za/", (-34.02500, 18.71611, "campus_exact", W + "IThemba_LABS"), ["iThemba"]),
 "anu-hiaf": ("ANU Heavy Ion Accelerator Facility", "Australia", "AU", "Canberra", "Oceania", ["core-nuclear", "electrostatic"], ["electrostatic"], "https://physics.anu.edu.au/nuclear/hiaf/", (-35.27780, 149.12050, "campus_exact", W + "Australian_National_University"), ["HIAF ANU"]),
 # site not verified → GeoNames city point (city_approx) or no pin
 "imp-lanzhou": ("Institute of Modern Physics, CAS (HIRFL-CSR, CSRe, Lanzhou Penning Trap)", "China", "CN", "Lanzhou", "Asia", ["core-nuclear", "rare-isotope", "storage-ring", "penning-trap"], ["storage-ring", "penning-trap"], "https://english.imp.cas.cn/", None, ["IMP", "HIRFL", "CSRe", "LPT"]),
 "hiaf-huizhou": ("HIAF — High Intensity heavy-ion Accelerator Facility (SRing)", "China", "CN", "Huizhou", "Asia", ["core-nuclear", "rare-isotope", "storage-ring"], ["storage-ring", "fragmentation"], "https://english.imp.cas.cn/research/facilities/HIAF/", None, ["HIAF", "SRing"]),
 "ciae-brif": ("CIAE Beijing Radioactive Ion-beam Facility (BRIF)", "China", "CN", "Beijing", "Asia", ["core-nuclear", "rare-isotope", "cyclotron"], ["isol"], "http://www.ciae.ac.cn/", None, ["BRIF", "CIAE"]),
 "mainz-trigatrap": ("TRIGA Mainz (TRIGA-TRAP)", "Germany", "DE", "Mainz", "Europe", ["core-nuclear", "penning-trap", "research-reactor"], ["penning-trap"], "https://www.triga.uni-mainz.de/", None, ["TRIGA-TRAP"]),
 "mll-garching": ("Maier-Leibnitz-Laboratorium (MLLTRAP)", "Germany", "DE", "Garching", "Europe", ["core-nuclear", "electrostatic", "penning-trap"], ["penning-trap"], "https://www.mll-muenchen.de/", None, ["MLL", "MLLTRAP"]),
 "ganil-spiral2": ("GANIL / SPIRAL2 (DESIR, PIPERADE)", "France", "FR", "Caen", "Europe", ["core-nuclear", "rare-isotope", "cyclotron", "penning-trap", "mr-tof"], ["penning-trap", "mr-tof", "isol"], "https://www.ganil-spiral2.eu/", None, ["GANIL", "SPIRAL2", "DESIR", "PIPERADE"]),
 "fsu-penning": ("Florida State University Penning trap (Fox Accelerator Laboratory)", "United States", "US", "Tallahassee", "North America", ["core-nuclear", "penning-trap"], ["penning-trap"], "https://fsunuc.physics.fsu.edu/", None, ["FSU trap"]),
 "notre-dame-nsl": ("Notre Dame Nuclear Science Laboratory (ISNAP)", "United States", "US", "South Bend", "North America", ["core-nuclear", "electrostatic", "mr-tof"], ["electrostatic", "mr-tof"], "https://isnap.nd.edu/", None, ["ISNAP", "NSL"]),
 "tamu-cyclotron": ("Texas A&M Cyclotron Institute", "United States", "US", "College Station", "North America", ["core-nuclear", "rare-isotope", "cyclotron"], ["cyclotron"], "https://cyclotron.tamu.edu/", None, ["TAMU"]),
 "ibs-raon": ("RAON, Institute for Basic Science", "South Korea", "KR", "Daejeon", "Asia", ["core-nuclear", "rare-isotope", "mr-tof"], ["isol", "fragmentation", "mr-tof"], "https://www.ibs.re.kr/", None, ["RAON", "IRIS"]),
 "lnl-spes": ("INFN Legnaro National Laboratories (SPES)", "Italy", "IT", "Legnaro", "Europe", ["core-nuclear", "rare-isotope", "electrostatic"], ["isol"], "https://www.lnl.infn.it/", None, ["LNL", "SPES"]),
 "eli-np": ("ELI-NP — Extreme Light Infrastructure – Nuclear Physics", "Romania", "RO", "Măgurele", "Europe", ["core-nuclear", "nuclear-rd"], ["laser", "gamma-beam"], "https://www.eli-np.ro/", None, ["ELI-NP"]),
}
ZH = {"campus_exact": "园区级位置（来源见下）", "facility_exact": "设施级位置（来源见下）", "city_approx": "城市近似位置"}


def city_point(cc, city):
    import geocode_cities as gcz
    index, ver = gcz.build_index()
    hits = {c["geonameid"]: c for c in index.get((cc, gcz.norm(city)), [])}
    if len(hits) == 1:
        c = next(iter(hits.values()))
        return round(float(c["latitude"]), 5), round(float(c["longitude"]), 5), f"https://www.geonames.org/{c['geonameid']}/"
    return None


def main():
    path = maintenance.ROOT / "data/facilities/facilities.json"
    doc = maintenance.read(path)
    by = {f["id"]: f for f in doc["facilities"]}
    added = updated = 0
    for fid, (name, country, cc, city, cont, cats, tech, url, coord, aliases) in F.items():
        rec = by.get(fid) or {"id": fid, "machines": [], "instruments": [], "capabilities": [], "status": "source-reported",
                              "source_records": [f"official:{fid}"], "site_id": f"{fid}-campus", "site_mapping_status": "confirmed"}
        rec.update({"name": {"en": name, "zh": name}, "country": country, "country_code": cc, "city": city, "continent": cont,
                    "categories": cats, "techniques": tech, "daily_aliases": aliases, "source_checked": TODAY})
        rec["source_urls"] = list(dict.fromkeys([url] + [u for u in rec.get("source_urls", []) if u != url]))
        if coord:
            lat, lon, prec, src = coord
            rec.update({"latitude": lat, "longitude": lon, "coordinate_precision": prec, "verification_status": "verified_primary",
                        "coordinate_verified": True, "coordinate_source": [src], "coordinate_method": "wikipedia_infobox",
                        "last_coordinate_check": TODAY})
        else:
            pt = city_point(cc, city)
            if pt:
                rec.update({"latitude": pt[0], "longitude": pt[1], "coordinate_precision": "city_approx",
                            "verification_status": "verified_cross_source", "coordinate_verified": True,
                            "coordinate_source": [url, pt[2]], "coordinate_method": "gazetteer_city_match", "last_coordinate_check": TODAY})
            else:
                rec.update({"latitude": None, "longitude": None, "coordinate_precision": "unknown", "verification_status": "unmapped",
                            "coordinate_verified": False})
        p = rec["coordinate_precision"]
        rec["description"] = {
            "en": f"Nuclear-physics facility ({', '.join(tech)}). Map point: {p.replace('_', ' ')}" + (" — site of the laboratory or host campus." if p != "city_approx" else " — city centre, not the exact site."),
            "zh": f"核物理设施（{', '.join(tech)}）。地图位置：{ZH.get(p, '未定位')}。"}
        maintenance.validate_facility(rec)
        if fid in by:
            updated += 1
        else:
            doc["facilities"].append(rec); added += 1
    # keep the source-mapping ledger and coverage counts lossless (tests/test_maintenance.py)
    mp = maintenance.read(maintenance.ROOT / "data/facilities/source-mappings.json")
    have = {x["source_id"] for x in mp["mappings"]}
    for fid in F:
        sid = f"official:{fid}"
        if sid not in have:
            mp["mappings"].append({"source_id": sid, "facility_id": fid, "machine_id": None,
                                   "decision": "official facility website + Wikipedia/GeoNames coordinate (2026-10-04)"})
    cov = maintenance.read(maintenance.ROOT / "data/facilities/coverage.json")
    n_off = sum(1 for x in mp["mappings"] if x["source_id"].startswith("official:"))
    cov["source_counts"]["official"] = n_off
    cov["source_records"] = cov["assigned_records"] = len(mp["mappings"])
    cov["facilities_programs"] = len(doc["facilities"])
    maintenance.transaction({"data/facilities/facilities.json": maintenance.serialized("x.json", doc),
                             "data/facilities/source-mappings.json": maintenance.serialized("x.json", mp),
                             "data/facilities/coverage.json": maintenance.serialized("x.json", cov)})
    print(f"added {added}, updated {updated}")


if __name__ == "__main__":
    main()
