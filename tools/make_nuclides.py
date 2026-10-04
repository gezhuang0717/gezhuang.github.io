#!/usr/bin/env python3
"""Fill data/nuclides.yaml to 366 entries (one per day of the year).

Keeps every hand-written entry and adds data-driven ones from ICRP-107 decay data
(package `radioactivedecay`) and stable isotopes (package `periodictable`).
Each generated fact: half-life (or stability/abundance), decay mode and daughter,
Z/N, and a short everyday comparison of the half-life, in en/zh/fi/de/ja.
Run:  pip install radioactivedecay periodictable && python3 tools/make_nuclides.py
"""
import math
import re
from pathlib import Path

import periodictable as pt
import radioactivedecay as rd
import yaml

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/nuclides.yaml"
SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
LANGS = ["en", "zh", "fi", "de", "ja"]


def sym(A, el, meta=""):
    return f"{str(A).translate(SUP)}{'ᵐ' if meta else ''}{el}"


UNITS = [(3.15576e7, {"en": "years", "zh": "年", "fi": "vuotta", "de": "Jahre", "ja": "年"}),
         (86400, {"en": "days", "zh": "天", "fi": "päivää", "de": "Tage", "ja": "日"}),
         (3600, {"en": "hours", "zh": "小时", "fi": "tuntia", "de": "Stunden", "ja": "時間"}),
         (60, {"en": "minutes", "zh": "分钟", "fi": "minuuttia", "de": "Minuten", "ja": "分"}),
         (1, {"en": "seconds", "zh": "秒", "fi": "sekuntia", "de": "Sekunden", "ja": "秒"}),
         (1e-3, {"en": "ms", "zh": "毫秒", "fi": "ms", "de": "ms", "ja": "ミリ秒"})]


def fmt_t(sec, L):
    for f, u in UNITS:
        if sec >= f or f == 1e-3:
            v = sec / f
            if v >= 1e6:
                e = int(math.floor(math.log10(v)))
                num = f"{v / 10**e:.2g}×10{str(e).translate(SUP)}"
            else:
                num = f"{v:.3g}"
            if L in ("de", "fi"):
                num = num.replace(".", ",")
            return f"{num}{'' if L in ('zh', 'ja') else ' '}{u[L]}"


Y = 3.15576e7  # one year in seconds
BUCKETS = [  # (upper limit in s, true-for-the-whole-range comparisons per language)
 (1, {"en": ["under a second — blink and it is gone", "less than one second", "over in under a second"],
      "zh": ["不到一秒——眨眼就没了", "不到一秒钟", "一秒之内就结束了"],
      "fi": ["alle sekunnin — silmänräpäyksessä poissa", "alle yhden sekunnin", "ohi alle sekunnissa"],
      "de": ["unter einer Sekunde – ein Wimpernschlag", "weniger als eine Sekunde", "in unter einer Sekunde vorbei"],
      "ja": ["1秒未満——まばたきの間に消える", "1秒に満たない", "1秒もたたずに終わる"]}),
 (60, {"en": ["under a minute — gone before you finish this card", "less than a minute", "under a minute, yet an MR-TOF can still weigh it"],
       "zh": ["不到一分钟——读完这张卡片前就没了", "不到一分钟", "不到一分钟，但 MR-TOF 仍能称出它的质量"],
       "fi": ["alle minuutin — poissa ennen kuin luet tämän kortin", "alle minuutin", "alle minuutin, mutta MR-TOF ehtii silti punnita sen"],
       "de": ["unter einer Minute – weg, bevor du diese Karte gelesen hast", "weniger als eine Minute", "unter einer Minute, und doch kann ein MR-TOF es wiegen"],
       "ja": ["1分未満——このカードを読み終える前に消える", "1分に満たない", "1分未満だが MR-TOF なら質量を測れる"]}),
 (3600, {"en": ["under an hour — shorter than a lecture", "less than an hour", "under an hour, enough for a Penning-trap measurement"],
         "zh": ["不到一小时——比一节课还短", "不到一小时", "不到一小时，足够做一次彭宁阱测量"],
         "fi": ["alle tunnin — lyhyempi kuin luento", "alle tunnin", "alle tunnin, riittää Penning-loukkumittaukseen"],
         "de": ["unter einer Stunde – kürzer als eine Vorlesung", "weniger als eine Stunde", "unter einer Stunde, genug für eine Penning-Fallen-Messung"],
         "ja": ["1時間未満——講義1コマより短い", "1時間に満たない", "1時間未満だがペニングトラップ測定には十分"]}),
 (86400, {"en": ["under a day — gone by tomorrow's coffee", "less than one day", "shorter than a day at the lab"],
          "zh": ["不到一天——明天喝咖啡时就没了", "不到一天", "比实验室的一天还短"],
          "fi": ["alle vuorokauden — poissa huomisen kahviin mennessä", "alle vuorokauden", "lyhyempi kuin vuorokausi labrassa"],
          "de": ["unter einem Tag – bis zum Kaffee morgen verschwunden", "weniger als ein Tag", "kürzer als ein Tag im Labor"],
          "ja": ["1日未満——明日のコーヒーの頃には消えている", "1日に満たない", "研究室の1日より短い"]}),
 (7*86400, {"en": ["under a week — gone before next week's group meeting", "less than a week", "shorter than a week of beam time"],
            "zh": ["不到一周——下周组会前就没了", "不到一周", "比一周的束流时间还短"],
            "fi": ["alle viikon — poissa ennen ensi viikon ryhmäpalaveria", "alle viikon", "lyhyempi kuin viikon suihkuaika"],
            "de": ["unter einer Woche – vor dem nächsten Gruppentreffen verschwunden", "weniger als eine Woche", "kürzer als eine Woche Strahlzeit"],
            "ja": ["1週間未満——来週のグループミーティング前に消える", "1週間に満たない", "1週間のビームタイムより短い"]}),
 (30.44*86400, {"en": ["under a month — shorter than waiting for a referee report", "less than a month", "under a month, still fine for shipping to a hospital"],
                "zh": ["不到一个月——比等审稿意见还短", "不到一个月", "不到一个月，仍来得及运往医院"],
                "fi": ["alle kuukauden — lyhyempi kuin arvioijan lausunnon odotus", "alle kuukauden", "alle kuukauden, ehtii silti sairaalaan"],
                "de": ["unter einem Monat – kürzer als das Warten auf ein Gutachten", "weniger als ein Monat", "unter einem Monat, reicht noch für den Versand an eine Klinik"],
                "ja": ["1か月未満——査読結果を待つより短い", "1か月に満たない", "1か月未満だが病院への輸送には間に合う"]}),
 (Y, {"en": ["under a year — gone before next summer's sauna season", "less than one year", "shorter than one year of a PhD"],
      "zh": ["不到一年——明年夏天桑拿季前就没了", "不到一年", "比读博的一年还短"],
      "fi": ["alle vuoden — poissa ennen ensi kesän saunakautta", "alle vuoden", "lyhyempi kuin yksi tohtorikoulutusvuosi"],
      "de": ["unter einem Jahr – vor der nächsten Sommer-Saunasaison verschwunden", "weniger als ein Jahr", "kürzer als ein Jahr Promotion"],
      "ja": ["1年未満——来夏のサウナシーズン前に消える", "1年に満たない", "博士課程の1年より短い"]}),
 (100*Y, {"en": ["under a century — within a human lifetime", "less than a hundred years", "shorter than a century"],
          "zh": ["不到一个世纪——在一个人的一生之内", "不到一百年", "比一个世纪还短"],
          "fi": ["alle vuosisadan — ihmiseliniän sisällä", "alle sata vuotta", "lyhyempi kuin vuosisata"],
          "de": ["unter einem Jahrhundert – innerhalb eines Menschenlebens", "weniger als hundert Jahre", "kürzer als ein Jahrhundert"],
          "ja": ["1世紀未満——人の一生のうち", "100年に満たない", "1世紀より短い"]}),
 (1e4*Y, {"en": ["under ten thousand years — the time scale of human civilisation", "less than 10 000 years", "shorter than the time since the last ice age"],
          "zh": ["不到一万年——人类文明的时间尺度", "不到一万年", "比末次冰期结束至今还短"],
          "fi": ["alle kymmenentuhatta vuotta — ihmiskunnan sivilisaation aikaskaala", "alle 10 000 vuotta", "lyhyempi kuin aika viime jääkaudesta"],
          "de": ["unter zehntausend Jahren – die Zeitskala menschlicher Zivilisation", "weniger als 10 000 Jahre", "kürzer als die Zeit seit der letzten Eiszeit"],
          "ja": ["1万年未満——人類文明の時間スケール", "1万年に満たない", "最終氷期の終わりから今までより短い"]}),
 (6.6e7*Y, {"en": ["shorter than the time since the dinosaurs died out", "less than 66 million years", "geological, but younger than the last dinosaurs"],
            "zh": ["比恐龙灭绝至今的时间还短", "不到6600万年", "属于地质时间，但比最后的恐龙还年轻"],
            "fi": ["lyhyempi kuin aika dinosaurusten sukupuutosta", "alle 66 miljoonaa vuotta", "geologinen, mutta lyhyempi kuin aika viimeisistä dinosauruksista"],
            "de": ["kürzer als die Zeit seit dem Aussterben der Dinosaurier", "weniger als 66 Millionen Jahre", "geologisch, aber kürzer als die Zeit seit den letzten Dinosauriern"],
            "ja": ["恐竜絶滅から今までより短い", "6600万年に満たない", "地質学的だが最後の恐竜の時代よりは最近"]}),
 (4.54e9*Y, {"en": ["shorter than the age of the Earth", "less than 4.5 billion years", "billions of years, still shorter than the Earth's age"],
             "zh": ["比地球的年龄还短", "不到45亿年", "长达数十亿年，但仍短于地球年龄"],
             "fi": ["lyhyempi kuin Maan ikä", "alle 4,5 miljardia vuotta", "miljardeja vuosia, silti lyhyempi kuin Maan ikä"],
             "de": ["kürzer als das Alter der Erde", "weniger als 4,5 Milliarden Jahre", "Milliarden Jahre, aber kürzer als das Erdalter"],
             "ja": ["地球の年齢より短い", "45億年に満たない", "数十億年だが地球の年齢よりは短い"]}),
 (1e60, {"en": ["longer than the age of the Earth", "older than the Solar System's lifetime so far", "practically forever"],
         "zh": ["比地球的年龄还长", "比太阳系迄今的年龄还长", "几乎是永恒"],
         "fi": ["pidempi kuin Maan ikä", "pidempi kuin aurinkokunnan tähänastinen ikä", "käytännössä ikuisesti"],
         "de": ["länger als das Alter der Erde", "länger als das bisherige Alter des Sonnensystems", "praktisch ewig"],
         "ja": ["地球の年齢より長い", "太陽系の年齢より長い", "事実上永遠"]}),
]
T = {
 "unstable": {"en": "{s} (Z = {Z}, N = {N}) has a half-life of {t} — {c}. It decays by {m} to {d}.",
              "zh": "{s}（Z = {Z}，N = {N}）的半衰期为 {t}——{c}。它经 {m} 衰变为 {d}。",
              "fi": "{s} (Z = {Z}, N = {N}): puoliintumisaika {t} — {c}. Hajoaa ({m}) ytimeksi {d}.",
              "de": "{s} (Z = {Z}, N = {N}) hat eine Halbwertszeit von {t} – {c}. Es zerfällt per {m} zu {d}.",
              "ja": "{s}（Z = {Z}、N = {N}）の半減期は {t}——{c}。{m} 崩壊で {d} になります。"},
 "stable": {"en": "{s} (Z = {Z}, N = {N}) is stable and makes up {a} % of natural {el}{magic}.",
            "zh": "{s}（Z = {Z}，N = {N}）是稳定核，占天然 {el} 的 {a}%{magic}。",
            "fi": "{s} (Z = {Z}, N = {N}) on stabiili; sen osuus luonnon {el}:stä on {a} %{magic}.",
            "de": "{s} (Z = {Z}, N = {N}) ist stabil und macht {a} % des natürlichen {el} aus{magic}.",
            "ja": "{s}（Z = {Z}、N = {N}）は安定核で、天然の {el} の {a}% を占めます{magic}。"},
 "magic": {"en": " — magic number {k} gives extra binding", "zh": "——魔数 {k} 带来额外的结合能", "fi": " — maaginen luku {k} lisää sidosta",
           "de": " – die magische Zahl {k} sorgt für zusätzliche Bindung", "ja": "——魔法数 {k} が結合を強めています"},
}
MAGIC = {2, 8, 20, 28, 50, 82, 126}
MODE = {"β-": "β⁻", "β+": "β⁺", "β+ & EC": "β⁺/EC", "EC": "EC", "α": "α", "IT": "IT", "SF": "SF"}


def parse(nuc):
    m = re.match(r"([A-Za-z]+)-(\d+)(m*)", nuc)
    return m.group(1), int(m.group(2)), m.group(3)


def main():
    doc = yaml.safe_load(OUT.read_text())
    items = [x for x in doc["nuclides"] if not x.get("generated")]
    have = {x["sym"] for x in items}
    cands = []
    for nuc in rd.DEFAULTDATA.nuclides:
        el, A, meta = parse(nuc)
        if meta:
            continue
        n = rd.Nuclide(nuc)
        hl = n.half_life("s")
        if not (hl and math.isfinite(hl)) or hl < 1e-3 or not n.progeny():
            continue
        cands.append(("u", el, A, n.Z, hl, n.decay_modes()[0], n.progeny()[0]))
    for e in pt.elements:
        if not 1 <= e.number <= 83:
            continue
        for iso in e:  # iterating an element yields isotope objects
            ab = getattr(iso, "abundance", 0) or 0
            if ab >= 1:
                cands.append(("s", e.symbol, iso.isotope, e.number, ab, None, None))
    cands.sort(key=lambda c: (c[3], c[2]))
    need = 366 - len(items)
    picked, step, i = [], len(cands) / need, 0.0
    while len(picked) < need and int(i) < len(cands):
        c = cands[int(i)]
        if sym(c[2], c[1]) not in have:
            picked.append(c); have.add(sym(c[2], c[1]))
        i += step
    for c in cands:
        if len(picked) >= need:
            break
        if sym(c[2], c[1]) not in have:
            picked.append(c); have.add(sym(c[2], c[1]))
    for j, c in enumerate(picked):
        kind, el, A, Z, val, mode, daughter = c
        N, s, fact = A - Z, sym(A, el), {}
        if kind == "u":
            b = next(b for b in BUCKETS if val < b[0])
            dl, dA, dm = parse(daughter)
            for L in LANGS:
                fact[L] = T["unstable"][L].format(s=s, Z=Z, N=N, t=fmt_t(val, L), c=b[1][L][j % 3],
                                                  m=MODE.get(mode, mode), d=sym(dA, dl, dm))
        else:
            mg = [x for x in (Z, N) if x in MAGIC]
            for L in LANGS:
                a = f"{val:.3g}".replace(".", "," if L in ("fi", "de") else ".")
                fact[L] = T["stable"][L].format(s=s, Z=Z, N=N, a=a, el=el,
                                                magic=T["magic"][L].format(k=mg[0]) if mg else "")
        items.append({"sym": s, "generated": True, "fact": fact})
    doc["nuclides"] = items[:366]
    head = ("# \"Nuclide of the day\" — 366 entries, one per day of the year ({{< nuclide-of-the-day >}}).\n"
            "# Hand-written entries first (edit freely). Entries with generated: true come from\n"
            "# tools/make_nuclides.py (ICRP-107 decay data + IUPAC abundances); re-run it to refill.\n")
    OUT.write_text(head + yaml.safe_dump(doc, allow_unicode=True, sort_keys=False, width=200))
    print(len(doc["nuclides"]), "entries,", sum(1 for x in doc["nuclides"] if x.get("generated")), "generated")


if __name__ == "__main__":
    main()
