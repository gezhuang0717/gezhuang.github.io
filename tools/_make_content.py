#!/usr/bin/env python3
"""One-off generator used to create the first multilingual content (2026-10-03).
After that, edit content/<lang>/*.md directly; this script is kept only as a record
and will refuse to overwrite existing files unless --force is given."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FORCE = "--force" in sys.argv

MASSPASS = "https://www.jyu.fi/en/projects/mass-measurements-of-exotic-nz-nuclei-up-to-100sn-and-the-vicinity-for-nuclear-physics-and-nuclear"
IDS = ("[ORCID 0000-0001-8586-6134](https://orcid.org/0000-0001-8586-6134) · "
       "[Scopus 56915277300](https://www.scopus.com/authid/detail.uri?authorId=56915277300) · "
       "[ResearcherID L-1172-2015](https://www.webofscience.com/wos/author/record/1631872) · "
       "[INSPIRE-HEP](https://inspirehep.net/authors/2600261) · "
       "[ResearchGate](https://www.researchgate.net/profile/Zhuang-Ge)")
SENSORS = "https://www.mdpi.com/journal/sensors/special_issues/8I8CN6PDV1"

P = {}  # P[lang][path] = text

# ───────────────────────────────── English ───────────────────────────────────
P["en"] = {
"_index.md": f"""---
title: "Zhuang Ge"
description: "Academy Research Fellow, University of Jyväskylä — Penning-trap and MR-TOF mass spectrometry of exotic nuclei."
---

I am an **Academy Research Fellow and Principal Investigator** at the Department of Physics, University of Jyväskylä, Finland. My field is **nuclear physics and nuclear astrophysics**: I measure the masses, Q-values and decays of exotic nuclei with ion traps.

I work in the Exotic Nuclei and Beams (IGISOL) group with the JYFLTRAP Penning trap and multi-reflection time-of-flight (MR-TOF) mass spectrometry. As PI of the Academy Fellowship project [MASSPASS]({MASSPASS}), I lead mass measurements of exotic *N* = *Z* nuclei up to doubly magic ¹⁰⁰Sn at IGISOL and RIKEN.

I received PhDs from Saitama University / RIKEN Nishina Center (Japan) and from the University of Chinese Academy of Sciences / Institute of Modern Physics. I have worked at the storage-ring facilities of RIKEN, GSI and IMP and at IGISOL — as a postdoctoral researcher at JYFLTRAP (2019–2021) and in the FRS/Super-FRS group at GSI (2021–2023) — before returning to Jyväskylä as Academy Research Fellow in 2023.

My group has two postdocs and a PhD student, and I teach the PhD course *Lasers and Traps in Nuclear Physics Studies*. I have co-authored more than 90 peer-reviewed papers, including in *Nature*, *Physical Review Letters*, *Physics Letters B* and *The Astrophysical Journal*.

**Contact:** zhuang.z.ge@jyu.fi
""",
"research.md": f"""---
title: "Research"
description: "Ion-trap mass spectrometry for neutrino physics, nuclear structure and nuclear astrophysics."
showDate: false
---

I use high-precision ion-trap and storage-ring mass spectrometry to answer questions in neutrino physics, nuclear structure and nuclear astrophysics. Papers under each theme come from the shared publication database; the full list is on the [Publications](../publications/) page.

## Exotic N = Z nuclei up to ¹⁰⁰Sn — MASSPASS

Academy Fellowship project (PI). Mass measurements of exotic *N* = *Z* nuclei up to ¹⁰⁰Sn and their vicinity at IGISOL (Jyväskylä) and RIKEN (Japan), probing shell evolution towards the heaviest self-conjugate doubly magic nucleus and the nuclear physics input to the rp-process. [Project page]({MASSPASS})

{{{{< pubs theme="nz" >}}}}

## Q-values for neutrino-mass determination

Direct Penning-trap measurements of decay energies (Q-values) identify ultra-low-Q β⁻ and electron-capture transitions for future direct neutrino-mass experiments, and rule out candidates that do not qualify.

{{{{< pubs theme="neutrino" >}}}}

## Atomic masses for isotope-shift studies

{{{{< pubs theme="isotope-shift" >}}}}

## Storage rings, MR-TOF and MCP detectors

PhD work at the RIKEN Rare-RI Ring: secondary-ion identification for isochronous mass measurements and timing / position-sensitive micro-channel-plate (MCP) detectors. Later work extends to MR-TOF spectrometers at IGISOL and the FRS Ion Catcher at GSI, and detector concepts for HIAF.

{{{{< pubs theme="detectors" >}}}}
""",
"publications.md": """---
title: "Publications"
description: "First-author, corresponding-author and selected co-authored papers."
showDate: false
---

More than 90 peer-reviewed papers. Full lists: [ORCID](https://orcid.org/0000-0001-8586-6134) · [INSPIRE-HEP](https://inspirehep.net/authors/2600261) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=56915277300)

## First-author papers

{{< pubs role="first" numbered="true" >}}

## Corresponding-author papers

{{< pubs role="corresponding" >}}

## Highlights from co-authored papers

{{< pubs role="coauthor" highlight="only" >}}

## Selected co-authored papers

{{< pubs role="coauthor" highlight="exclude" group="year" >}}
""",
"talks.md": """---
title: "Talks"
description: "Invited talks and conference presentations, with links to the meetings."
showDate: false
---

## Invited talks

{{< talks kind="invited" >}}

## Conference talks

{{< talks kind="contributed" >}}
""",
"daily/_index.md": """---
title: "Daily"
description: "Science log, news, new papers and jobs in nuclear physics and ion-trap techniques — click a day in the calendar."
showDate: false
---

A running log of my own work plus new papers, news and open positions in nuclear physics and ion-trap techniques. Colours mark the type; click a day to see its entries, or filter and search. New papers and jobs are collected automatically every day.

{{< daily-calendar >}}
""",
"projects.md": f"""---
title: "Projects"
description: "Research projects, instruments and research software."
showDate: false
---

## MASSPASS — Academy Fellowship (PI), 2023–2027
Mass measurements of exotic *N* = *Z* nuclei up to ¹⁰⁰Sn and the vicinity for nuclear physics and nuclear astrophysics, at IGISOL and RIKEN. Research Council of Finland. [Project page]({MASSPASS})

## Low-Q-value decays for neutrino-mass determination
Penning-trap Q-value measurements at JYFLTRAP to find and verify ultra-low-Q β⁻ and electron-capture transitions.

## MR-TOF mass spectrometry
Design, ion-optical simulation and analysis pipelines for multi-reflection time-of-flight spectrometers.

## RFQ cooler-bunchers and beam preparation
Ion-optical design of radiofrequency quadrupole coolers for cold, bunched radioactive beams.

## Detectors for storage rings
Timing and position-sensitive MCP detectors for the Rare-RI Ring (RIKEN) and concepts for HIAF.

## Research software
Penning-trap particle simulation, MR-TOF calibration and 2D MCP position calibration tools in Python.
""",
"group.md": f"""---
title: "Group"
description: "Group members, teaching and editorial work."
showDate: false
---

I lead a research group at IGISOL/JYFLTRAP funded by the Research Council of Finland and the University of Jyväskylä.

## Members

- **Dr. Brian Kootte** — Postdoctoral Researcher ([profile](https://www.jyu.fi/en/people/brian-koote))
- **Dr. Marlom de Oliveira Ramalho** — Postdoctoral Researcher ([profile](https://www.jyu.fi/en/people/marlom-de-oliveira-ramalho))
- **Miikka Winter** — PhD student

## Teaching

- **FYSS3552** — *Lasers and Traps in Nuclear Physics Studies*, PhD course, University of Jyväskylä

## Editorial

- Guest editor, *Sensors* special issue [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS})
""",
"cv.md": f"""---
title: "CV"
description: "Academic curriculum vitae."
showDate: false
---

## Current position

- **2023–** Academy Research Fellow (Principal Investigator), Department of Physics, University of Jyväskylä, Finland

## Previous positions

- **2021–2023** Postdoctoral Researcher, FRS/Super-FRS group, GSI Helmholtz Centre for Heavy Ion Research, Darmstadt, Germany
- **2019–2021** Postdoctoral Researcher, Department of Physics, University of Jyväskylä, Finland (JYFLTRAP)
- **2018–2019** Research Assistant, Institute of Modern Physics, Chinese Academy of Sciences, China
- **2018** Senior Visiting Scientist, RIKEN, Japan
- **2015–2018** International Program Associate, RIKEN Nishina Center for Accelerator-Based Science, Japan

## Education

- **PhD (2018)**, Saitama University and RIKEN Nishina Center, Japan — *Time- and position-sensitive foil-MCP detector for mass measurements at the Rare-RI Ring: study of IMS and Bρ-TOF methods*
- **PhD (2019)**, University of Chinese Academy of Sciences and Institute of Modern Physics, CAS, China — *Design and test of high-resolution beam-line systems and mass measurements of N = Z nuclei*
- **BSc (2012)**, Nuclear Science and Technology, Xi'an Jiaotong University, China

## Fellowships and funding

- **2023–2027** Academy Research Fellowship and project MASSPASS (PI), Research Council of Finland
- **2023** WINNINGNormandy Fellowship, GANIL — EU Horizon 2020 Marie Skłodowska-Curie Actions
- **2018–2021** Senior Visiting Scientist, RIKEN RI Beam Factory, Japan

## Teaching and supervision

- Supervision of two postdoctoral researchers and one PhD student (see [Group](../group/))
- Lecturer, FYSS3552 *Lasers and Traps in Nuclear Physics Studies*

## Service

- Guest editor, *Sensors* special issue [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS})

## Publications and talks

See [Publications](../publications/) and [Talks](../talks/).

## Identifiers

{IDS}
""",
"posts/_index.md": """---
title: "Blog"
description: "Notes on ion traps, mass measurements and instrumentation."
---
""",
"posts/welcome.md": """---
title: "Welcome"
date: 2026-10-03
description: "The new website."
tags: ["news"]
---

This site collects my research on Penning-trap and MR-TOF mass spectrometry of exotic nuclei. The [Daily](../../daily/) page keeps a calendar of my science log together with new papers, news and jobs in nuclear physics and ion-trap techniques.
""",
}

# ───────────────────────────────── 中文 ──────────────────────────────────────
P["zh"] = {
"_index.md": f"""---
title: "葛壮"
description: "芬兰于韦斯屈莱大学芬兰科学院研究员——利用彭宁阱和多次反射飞行时间质谱测量奇特原子核。"
---

我是芬兰**于韦斯屈莱大学物理系芬兰科学院研究员（Academy Research Fellow）和项目负责人（PI）**，研究方向为**原子核物理与核天体物理**：利用离子阱精确测量奇特原子核的质量、衰变能（Q 值）和衰变性质。

我所在的研究组为奇特原子核与束流（IGISOL）组，使用 JYFLTRAP 彭宁阱和多次反射飞行时间（MR-TOF）质谱仪。作为芬兰科学院项目 [MASSPASS]({MASSPASS}) 的负责人，我在 IGISOL 和日本理化学研究所（RIKEN）开展直至双幻数核 ¹⁰⁰Sn 的 *N* = *Z* 奇特核质量测量。

我分别获得日本埼玉大学/理化学研究所仁科加速器中心和中国科学院大学/中国科学院近代物理研究所的博士学位，曾在 RIKEN、GSI 和近代物理研究所的储存环装置以及 IGISOL 工作：2019–2021 年在 JYFLTRAP 任博士后，2021–2023 年在德国 GSI 的 FRS/Super-FRS 组任博士后，2023 年回到于韦斯屈莱大学担任芬兰科学院研究员。

我的研究组目前有两名博士后和一名博士研究生，我讲授博士课程《核物理研究中的激光与离子阱》。已合作发表经同行评审论文 90 余篇，包括 *Nature*、*Physical Review Letters*、*Physics Letters B* 和 *The Astrophysical Journal* 等期刊。

**联系方式：** zhuang.z.ge@jyu.fi
""",
"research.md": f"""---
title: "研究"
description: "面向中微子物理、原子核结构和核天体物理的离子阱质谱研究。"
showDate: false
---

我利用高精度离子阱和储存环质谱回答中微子物理、原子核结构和核天体物理中的问题。各研究方向下的论文来自统一的论文数据库，完整列表见[论文](../publications/)页面。

## 直至 ¹⁰⁰Sn 的 N = Z 奇特核——MASSPASS

芬兰科学院研究员项目（负责人）。在 IGISOL（于韦斯屈莱）和 RIKEN（日本）测量直至 ¹⁰⁰Sn 的 *N* = *Z* 奇特核及其附近核素的质量，研究通向最重自共轭双幻数核的壳演化以及 rp 过程所需的核物理输入。[项目主页]({MASSPASS})

{{{{< pubs theme="nz" >}}}}

## 用于确定中微子质量的 Q 值

利用彭宁阱直接测量衰变能（Q 值），寻找可用于未来直接中微子质量实验的超低 Q 值 β⁻ 衰变和电子俘获跃迁，并排除不合适的候选核。

{{{{< pubs theme="neutrino" >}}}}

## 用于同位素移位研究的原子质量

{{{{< pubs theme="isotope-shift" >}}}}

## 储存环、MR-TOF 与 MCP 探测器

博士阶段在 RIKEN Rare-RI Ring 储存环开展等时性质量测量的次级离子鉴别，以及定时/位置灵敏微通道板（MCP）探测器研制；之后扩展到 IGISOL 和 GSI FRS Ion Catcher 的 MR-TOF 谱仪以及 HIAF 的探测器方案。

{{{{< pubs theme="detectors" >}}}}
""",
"publications.md": """---
title: "论文"
description: "第一作者、通讯作者及部分合作论文。"
showDate: false
---

已发表经同行评审论文 90 余篇。完整列表：[ORCID](https://orcid.org/0000-0001-8586-6134) · [INSPIRE-HEP](https://inspirehep.net/authors/2600261) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=56915277300)

## 第一作者论文

{{< pubs role="first" numbered="true" >}}

## 通讯作者论文

{{< pubs role="corresponding" >}}

## 代表性合作论文

{{< pubs role="coauthor" highlight="only" >}}

## 部分合作论文

{{< pubs role="coauthor" highlight="exclude" group="year" >}}
""",
"talks.md": """---
title: "报告"
description: "邀请报告和会议报告，附会议链接。"
showDate: false
---

## 邀请报告

{{< talks kind="invited" >}}

## 会议报告

{{< talks kind="contributed" >}}
""",
"daily/_index.md": """---
title: "每日"
description: "科研日志、新闻、新论文和核物理与离子阱技术相关职位——点击日历中的日期查看。"
showDate: false
---

这里记录我的科研日志，并汇集核物理和离子阱技术方面的新论文、新闻和招聘信息。颜色表示类型；点击日期查看当天记录，也可以按类型筛选或搜索。新论文和职位每天自动收集。

{{< daily-calendar >}}
""",
"projects.md": f"""---
title: "项目"
description: "研究项目、实验装置和科研软件。"
showDate: false
---

## MASSPASS——芬兰科学院研究员项目（负责人），2023–2027
在 IGISOL 和 RIKEN 测量直至 ¹⁰⁰Sn 的 *N* = *Z* 奇特核及其附近核素的质量，服务于原子核物理和核天体物理研究。芬兰研究理事会资助。[项目主页]({MASSPASS})

## 用于确定中微子质量的低 Q 值衰变
利用 JYFLTRAP 彭宁阱测量 Q 值，寻找并验证超低 Q 值 β⁻ 衰变和电子俘获跃迁。

## 多次反射飞行时间（MR-TOF）质谱
MR-TOF 谱仪的设计、离子光学模拟和数据分析流程。

## RFQ 冷却聚束器与束流准备
射频四极（RFQ）冷却聚束器的离子光学设计，为实验提供冷却、聚束的放射性束流。

## 储存环探测器
为 RIKEN Rare-RI Ring 研制的定时与位置灵敏 MCP 探测器，以及 HIAF 探测器方案。

## 科研软件
用 Python 编写的彭宁阱粒子模拟、MR-TOF 刻度和二维 MCP 位置刻度工具。
""",
"group.md": f"""---
title: "团队"
description: "研究组成员、教学和编辑工作。"
showDate: false
---

我在 IGISOL/JYFLTRAP 领导一个由芬兰研究理事会和于韦斯屈莱大学资助的研究组。

## 成员

- **Brian Kootte 博士**——博士后研究员（[主页](https://www.jyu.fi/en/people/brian-koote)）
- **Marlom de Oliveira Ramalho 博士**——博士后研究员（[主页](https://www.jyu.fi/en/people/marlom-de-oliveira-ramalho)）
- **Miikka Winter**——博士研究生

## 教学

- **FYSS3552**——《核物理研究中的激光与离子阱》，于韦斯屈莱大学博士课程

## 编辑工作

- *Sensors* 期刊特刊 [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS}) 客座编辑
""",
"cv.md": f"""---
title: "简历"
description: "学术简历。"
showDate: false
---

## 现任职位

- **2023–** 芬兰科学院研究员（项目负责人），芬兰于韦斯屈莱大学物理系

## 工作经历

- **2021–2023** 博士后研究员，德国亥姆霍兹重离子研究中心（GSI）FRS/Super-FRS 组
- **2019–2021** 博士后研究员，芬兰于韦斯屈莱大学物理系（JYFLTRAP）
- **2018–2019** 研究助理，中国科学院近代物理研究所
- **2018** 高级访问科学家，日本理化学研究所（RIKEN）
- **2015–2018** 国际项目研究助理（International Program Associate），日本理化学研究所仁科加速器中心

## 教育背景

- **博士（2018）**，日本埼玉大学与理化学研究所仁科加速器中心——《用于 Rare-RI Ring 质量测量的定时与位置灵敏箔-MCP 探测器：等时性质谱与 Bρ-TOF 方法研究》
- **博士（2019）**，中国科学院大学、中国科学院近代物理研究所——《高分辨束流线系统的设计与测试及 N = Z 原子核质量测量》
- **学士（2012）**，西安交通大学核科学与核技术专业

## 人才项目与科研资助

- **2023–2027** 芬兰科学院研究员（Academy Research Fellow）及 MASSPASS 项目（负责人），芬兰研究理事会
- **2023** WINNINGNormandy 研究员（GANIL），欧盟“地平线 2020”玛丽·居里行动
- **2018–2021** 日本理化学研究所 RI 束流工厂高级访问科学家

## 教学与指导

- 指导两名博士后和一名博士研究生（见[团队](../group/)）
- 讲授 FYSS3552《核物理研究中的激光与离子阱》

## 学术服务

- *Sensors* 期刊特刊 [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS}) 客座编辑

## 论文与报告

见[论文](../publications/)和[报告](../talks/)。

## 学术标识

{IDS}
""",
"posts/_index.md": """---
title: "博客"
description: "关于离子阱、质量测量和实验仪器的笔记。"
---
""",
"posts/welcome.md": """---
title: "欢迎"
date: 2026-10-03
description: "新网站上线。"
tags: ["news"]
---

本网站介绍我在奇特原子核彭宁阱和 MR-TOF 质谱方面的研究。[每日](../../daily/)页面以日历形式记录我的科研日志，并汇集核物理与离子阱技术方面的新论文、新闻和招聘信息。
""",
}

# ───────────────────────────────── Suomi ─────────────────────────────────────
P["fi"] = {
"_index.md": f"""---
title: "Zhuang Ge"
description: "Akatemiatutkija, Jyväskylän yliopisto — eksoottisten ytimien Penning-loukku- ja MR-TOF-massaspektrometria."
---

Olen **akatemiatutkija ja vastuullinen johtaja** Jyväskylän yliopiston fysiikan laitoksella. Tutkimusalani on **ydinfysiikka ja ydinastrofysiikka**: mittaan eksoottisten atomiytimien massoja, Q-arvoja ja hajoamisia ioniloukuilla.

Työskentelen Eksoottiset ytimet ja suihkut (IGISOL) -ryhmässä JYFLTRAP-Penning-loukun ja monikertaheijastavan lentoaikamassaspektrometrian (MR-TOF) parissa. Akatemiahankkeen [MASSPASS]({MASSPASS}) johtajana mittaan eksoottisten *N* = *Z* -ytimien massoja kaksoismaagiseen ¹⁰⁰Sn-ytimeen asti IGISOLissa ja RIKENissä.

Olen väitellyt tohtoriksi Saitaman yliopistossa / RIKEN Nishina Centerissä (Japani) sekä Kiinan tiedeakatemian yliopistossa / Institute of Modern Physicsissä. Olen työskennellyt RIKENin, GSI:n ja IMP:n varastorengaslaitteistoilla sekä IGISOLissa — tutkijatohtorina JYFLTRAPilla (2019–2021) ja GSI:n FRS/Super-FRS-ryhmässä (2021–2023) — ennen paluutani Jyväskylään akatemiatutkijaksi vuonna 2023.

Ryhmääni kuuluu kaksi tutkijatohtoria ja väitöskirjatutkija, ja opetan jatko-opintokurssia *Lasers and Traps in Nuclear Physics Studies*. Olen yhteiskirjoittajana yli 90 vertaisarvioidussa julkaisussa, mm. *Nature*-, *Physical Review Letters*-, *Physics Letters B*- ja *The Astrophysical Journal* -lehdissä.

**Yhteystiedot:** zhuang.z.ge@jyu.fi
""",
"research.md": f"""---
title: "Tutkimus"
description: "Ioniloukkumassaspektrometria neutriinofysiikan, ydinrakenteen ja ydinastrofysiikan tarpeisiin."
showDate: false
---

Käytän tarkkaa ioniloukku- ja varastorengasmassaspektrometriaa neutriinofysiikan, ydinrakenteen ja ydinastrofysiikan kysymyksiin. Kunkin aiheen julkaisut tulevat yhteisestä julkaisutietokannasta; koko luettelo on [Julkaisut](../publications/)-sivulla.

## Eksoottiset N = Z -ytimet ¹⁰⁰Sn:ään asti — MASSPASS

Akatemiatutkijan hanke (johtaja). Eksoottisten *N* = *Z* -ytimien ja niiden naapurien massamittaukset ¹⁰⁰Sn:ään asti IGISOLissa (Jyväskylä) ja RIKENissä (Japani): kuorirakenteen kehitys kohti raskainta itsekonjugoitua kaksoismaagista ydintä sekä rp-prosessin ydinfysikaalinen syöte. [Hankkeen sivu]({MASSPASS})

{{{{< pubs theme="nz" >}}}}

## Q-arvot neutriinon massan määrittämiseen

Hajoamisenergioiden (Q-arvojen) suorat Penning-loukkumittaukset paljastavat erittäin pienen Q-arvon β⁻- ja elektronisieppaussiirtymiä tuleviin neutriinon massan mittauksiin ja sulkevat pois sopimattomat ehdokkaat.

{{{{< pubs theme="neutrino" >}}}}

## Atomimassat isotooppisiirtymätutkimuksiin

{{{{< pubs theme="isotope-shift" >}}}}

## Varastorenkaat, MR-TOF ja MCP-ilmaisimet

Väitöstyö RIKENin Rare-RI Ringillä: sekundääri-ionien tunnistus isokronisiin massamittauksiin sekä ajoitus- ja paikkaherkät mikrokanavalevyilmaisimet (MCP). Myöhemmin MR-TOF-spektrometrit IGISOLissa ja GSI:n FRS Ion Catcherilla sekä HIAF-ilmaisinkonseptit.

{{{{< pubs theme="detectors" >}}}}
""",
"publications.md": """---
title: "Julkaisut"
description: "Julkaisut ensimmäisenä ja vastaavana kirjoittajana sekä valittuja yhteisjulkaisuja."
showDate: false
---

Yli 90 vertaisarvioitua julkaisua. Täydelliset luettelot: [ORCID](https://orcid.org/0000-0001-8586-6134) · [INSPIRE-HEP](https://inspirehep.net/authors/2600261) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=56915277300)

## Julkaisut ensimmäisenä kirjoittajana

{{< pubs role="first" numbered="true" >}}

## Julkaisut vastaavana kirjoittajana

{{< pubs role="corresponding" >}}

## Poimintoja yhteisjulkaisuista

{{< pubs role="coauthor" highlight="only" >}}

## Valittuja yhteisjulkaisuja

{{< pubs role="coauthor" highlight="exclude" group="year" >}}
""",
"talks.md": """---
title: "Esitelmät"
description: "Kutsuesitelmät ja konferenssiesitelmät linkkeineen."
showDate: false
---

## Kutsuesitelmät

{{< talks kind="invited" >}}

## Konferenssiesitelmät

{{< talks kind="contributed" >}}
""",
"daily/_index.md": """---
title: "Päivittäin"
description: "Tutkimusloki, uutiset, uudet artikkelit ja työpaikat ydinfysiikassa ja ioniloukkutekniikoissa."
showDate: false
---

Oma tutkimuslokini sekä uudet artikkelit, uutiset ja avoimet paikat ydinfysiikassa ja ioniloukkutekniikoissa. Värit kertovat tyypin; napsauta päivää nähdäksesi merkinnät tai suodata ja hae. Uudet artikkelit ja työpaikat kerätään automaattisesti joka päivä.

{{< daily-calendar >}}
""",
"projects.md": f"""---
title: "Projektit"
description: "Tutkimushankkeet, laitteet ja tutkimusohjelmistot."
showDate: false
---

## MASSPASS — akatemiatutkijan hanke (johtaja), 2023–2027
Eksoottisten *N* = *Z* -ytimien massamittaukset ¹⁰⁰Sn:ään asti IGISOLissa ja RIKENissä ydinfysiikan ja ydinastrofysiikan tarpeisiin. Suomen Akatemia. [Hankkeen sivu]({MASSPASS})

## Pienen Q-arvon hajoamiset neutriinon massan määrittämiseen
Q-arvojen mittaukset JYFLTRAP-Penning-loukulla erittäin pienen Q-arvon siirtymien löytämiseksi ja varmistamiseksi.

## MR-TOF-massaspektrometria
Monikertaheijastavien lentoaikaspektrometrien suunnittelu, ionioptinen simulointi ja analyysiketjut.

## RFQ-jäähdytin-kasaajat ja suihkun valmistelu
Radiotaajuisten kvadrupolijäähdyttimien ionioptinen suunnittelu kylmiä, kasattuja radioaktiivisia suihkuja varten.

## Ilmaisimet varastorenkaisiin
Ajoitus- ja paikkaherkät MCP-ilmaisimet Rare-RI Ringille (RIKEN) ja HIAF-konseptit.

## Tutkimusohjelmistot
Penning-loukun hiukkassimulointi, MR-TOF-kalibrointi ja 2D-MCP-paikkakalibrointi Pythonilla.
""",
"group.md": f"""---
title: "Ryhmä"
description: "Ryhmän jäsenet, opetus ja toimitustyö."
showDate: false
---

Johdan IGISOL/JYFLTRAP-tutkimusryhmää, jota rahoittavat Suomen Akatemia ja Jyväskylän yliopisto.

## Jäsenet

- **FT Brian Kootte** — tutkijatohtori ([profiili](https://www.jyu.fi/en/people/brian-koote))
- **FT Marlom de Oliveira Ramalho** — tutkijatohtori ([profiili](https://www.jyu.fi/en/people/marlom-de-oliveira-ramalho))
- **Miikka Winter** — väitöskirjatutkija

## Opetus

- **FYSS3552** — *Lasers and Traps in Nuclear Physics Studies*, jatko-opintokurssi, Jyväskylän yliopisto

## Toimitustyö

- Vierailevana toimittajana *Sensors*-lehden teemanumerossa [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS})
""",
"cv.md": f"""---
title: "CV"
description: "Akateeminen ansioluettelo."
showDate: false
---

## Nykyinen tehtävä

- **2023–** Akatemiatutkija (vastuullinen johtaja), fysiikan laitos, Jyväskylän yliopisto

## Aiemmat tehtävät

- **2021–2023** Tutkijatohtori, FRS/Super-FRS-ryhmä, GSI Helmholtz Centre for Heavy Ion Research, Darmstadt, Saksa
- **2019–2021** Tutkijatohtori, fysiikan laitos, Jyväskylän yliopisto (JYFLTRAP)
- **2018–2019** Tutkimusavustaja, Institute of Modern Physics, Kiinan tiedeakatemia
- **2018** Vieraileva vanhempi tutkija, RIKEN, Japani
- **2015–2018** International Program Associate, RIKEN Nishina Center, Japani

## Koulutus

- **FT (2018)**, Saitaman yliopisto ja RIKEN Nishina Center, Japani — *Time- and position-sensitive foil-MCP detector for mass measurements at the Rare-RI Ring*
- **FT (2019)**, Kiinan tiedeakatemian yliopisto ja Institute of Modern Physics — *Design and test of high-resolution beam-line systems and mass measurements of N = Z nuclei*
- **LuK (2012)**, ydintiede ja -tekniikka, Xi'an Jiaotong University, Kiina

## Apurahat ja rahoitus

- **2023–2027** Akatemiatutkijan tehtävä ja MASSPASS-hanke (johtaja), Suomen Akatemia
- **2023** WINNINGNormandy-apuraha, GANIL — EU:n Horisontti 2020, Marie Skłodowska-Curie -toimet
- **2018–2021** Vieraileva vanhempi tutkija, RIKEN RI Beam Factory, Japani

## Opetus ja ohjaus

- Kahden tutkijatohtorin ja yhden väitöskirjatutkijan ohjaus (ks. [Ryhmä](../group/))
- Luennoitsija, FYSS3552 *Lasers and Traps in Nuclear Physics Studies*

## Luottamustehtävät

- Vieraileva toimittaja, *Sensors*-lehden teemanumero [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS})

## Julkaisut ja esitelmät

Ks. [Julkaisut](../publications/) ja [Esitelmät](../talks/).

## Tunnisteet

{IDS}
""",
"posts/_index.md": """---
title: "Blogi"
description: "Muistiinpanoja ioniloukuista, massamittauksista ja laitteista."
---
""",
"posts/welcome.md": """---
title: "Tervetuloa"
date: 2026-10-03
description: "Uusi verkkosivusto."
tags: ["news"]
---

Tällä sivustolla esittelen eksoottisten ytimien Penning-loukku- ja MR-TOF-massaspektrometriaan liittyvää tutkimustani. [Päivittäin](../../daily/)-sivun kalenterissa on tutkimuslokini sekä uudet artikkelit, uutiset ja työpaikat ydinfysiikassa ja ioniloukkutekniikoissa.
""",
}

# ───────────────────────────────── Deutsch ───────────────────────────────────
P["de"] = {
"_index.md": f"""---
title: "Zhuang Ge"
description: "Academy Research Fellow, Universität Jyväskylä — Penning-Fallen- und MR-TOF-Massenspektrometrie exotischer Kerne."
---

Ich bin **Academy Research Fellow und Projektleiter (PI)** am Fachbereich Physik der Universität Jyväskylä, Finnland. Mein Fachgebiet ist **Kernphysik und nukleare Astrophysik**: Ich messe Massen, Q-Werte und Zerfälle exotischer Atomkerne mit Ionenfallen.

Ich arbeite in der Gruppe Exotische Kerne und Strahlen (IGISOL) mit der Penning-Falle JYFLTRAP und der Multireflexions-Flugzeit-Massenspektrometrie (MR-TOF). Als Leiter des Akademie-Projekts [MASSPASS]({MASSPASS}) messe ich Massen exotischer *N* = *Z*-Kerne bis zum doppelt magischen ¹⁰⁰Sn an IGISOL und RIKEN.

Ich wurde an der Universität Saitama / RIKEN Nishina Center (Japan) sowie an der Universität der Chinesischen Akademie der Wissenschaften / Institute of Modern Physics promoviert. Ich habe an den Speicherring-Anlagen von RIKEN, GSI und IMP sowie an IGISOL gearbeitet — als Postdoc an JYFLTRAP (2019–2021) und in der FRS/Super-FRS-Gruppe der GSI (2021–2023) — bevor ich 2023 als Academy Research Fellow nach Jyväskylä zurückkehrte.

Zu meiner Gruppe gehören zwei Postdocs und ein Doktorand; ich unterrichte den Doktorandenkurs *Lasers and Traps in Nuclear Physics Studies*. Ich bin Ko-Autor von mehr als 90 begutachteten Publikationen, u. a. in *Nature*, *Physical Review Letters*, *Physics Letters B* und *The Astrophysical Journal*.

**Kontakt:** zhuang.z.ge@jyu.fi
""",
"research.md": f"""---
title: "Forschung"
description: "Ionenfallen-Massenspektrometrie für Neutrinophysik, Kernstruktur und nukleare Astrophysik."
showDate: false
---

Mit hochpräziser Ionenfallen- und Speicherring-Massenspektrometrie untersuche ich Fragen der Neutrinophysik, der Kernstruktur und der nuklearen Astrophysik. Die Publikationen zu jedem Thema stammen aus der gemeinsamen Publikationsdatenbank; die vollständige Liste steht unter [Publikationen](../publications/).

## Exotische N = Z-Kerne bis ¹⁰⁰Sn — MASSPASS

Projekt der Academy Research Fellowship (Leitung). Massenmessungen exotischer *N* = *Z*-Kerne und ihrer Nachbarn bis ¹⁰⁰Sn an IGISOL (Jyväskylä) und RIKEN (Japan): Schalenentwicklung hin zum schwersten selbstkonjugierten doppelt magischen Kern und kernphysikalische Eingangsdaten für den rp-Prozess. [Projektseite]({MASSPASS})

{{{{< pubs theme="nz" >}}}}

## Q-Werte zur Bestimmung der Neutrinomasse

Direkte Penning-Fallen-Messungen von Zerfallsenergien (Q-Werten) identifizieren β⁻- und Elektroneneinfang-Übergänge mit extrem kleinem Q-Wert für zukünftige direkte Neutrinomassen-Experimente und schließen ungeeignete Kandidaten aus.

{{{{< pubs theme="neutrino" >}}}}

## Atommassen für Isotopieverschiebungs-Studien

{{{{< pubs theme="isotope-shift" >}}}}

## Speicherringe, MR-TOF und MCP-Detektoren

Promotion am RIKEN Rare-RI Ring: Identifikation von Sekundärionen für isochrone Massenmessungen sowie zeit- und ortsauflösende Mikrokanalplatten-Detektoren (MCP). Später MR-TOF-Spektrometer an IGISOL und am FRS Ion Catcher der GSI sowie Detektorkonzepte für HIAF.

{{{{< pubs theme="detectors" >}}}}
""",
"publications.md": """---
title: "Publikationen"
description: "Erstautor-, korrespondierende und ausgewählte Ko-Autor-Publikationen."
showDate: false
---

Mehr als 90 begutachtete Publikationen. Vollständige Listen: [ORCID](https://orcid.org/0000-0001-8586-6134) · [INSPIRE-HEP](https://inspirehep.net/authors/2600261) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=56915277300)

## Erstautorschaften

{{< pubs role="first" numbered="true" >}}

## Als korrespondierender Autor

{{< pubs role="corresponding" >}}

## Höhepunkte aus Ko-Autorschaften

{{< pubs role="coauthor" highlight="only" >}}

## Ausgewählte Ko-Autorschaften

{{< pubs role="coauthor" highlight="exclude" group="year" >}}
""",
"talks.md": """---
title: "Vorträge"
description: "Eingeladene Vorträge und Konferenzbeiträge mit Links zu den Tagungen."
showDate: false
---

## Eingeladene Vorträge

{{< talks kind="invited" >}}

## Konferenzvorträge

{{< talks kind="contributed" >}}
""",
"daily/_index.md": """---
title: "Täglich"
description: "Forschungslog, Nachrichten, neue Artikel und Stellen in Kernphysik und Ionenfallentechnik."
showDate: false
---

Mein laufendes Forschungslog sowie neue Artikel, Nachrichten und offene Stellen in der Kernphysik und Ionenfallentechnik. Farben kennzeichnen den Typ; Tag anklicken, um die Einträge zu sehen, oder filtern und suchen. Neue Artikel und Stellen werden täglich automatisch gesammelt.

{{< daily-calendar >}}
""",
"projects.md": f"""---
title: "Projekte"
description: "Forschungsprojekte, Instrumente und Forschungssoftware."
showDate: false
---

## MASSPASS — Academy Research Fellowship (Leitung), 2023–2027
Massenmessungen exotischer *N* = *Z*-Kerne bis ¹⁰⁰Sn an IGISOL und RIKEN für Kernphysik und nukleare Astrophysik. Forschungsrat Finnland. [Projektseite]({MASSPASS})

## Zerfälle mit kleinem Q-Wert für die Neutrinomasse
Q-Wert-Messungen an der Penning-Falle JYFLTRAP, um Übergänge mit extrem kleinem Q-Wert zu finden und zu bestätigen.

## MR-TOF-Massenspektrometrie
Entwurf, ionenoptische Simulation und Auswerteketten für Multireflexions-Flugzeitspektrometer.

## RFQ-Kühler-Bündler und Strahlpräparation
Ionenoptischer Entwurf von Radiofrequenz-Quadrupol-Kühlern für kalte, gebündelte radioaktive Strahlen.

## Detektoren für Speicherringe
Zeit- und ortsauflösende MCP-Detektoren für den Rare-RI Ring (RIKEN) und Konzepte für HIAF.

## Forschungssoftware
Teilchensimulation für Penning-Fallen, MR-TOF-Kalibrierung und 2D-MCP-Ortskalibrierung in Python.
""",
"group.md": f"""---
title: "Gruppe"
description: "Gruppenmitglieder, Lehre und Herausgebertätigkeit."
showDate: false
---

Ich leite eine Forschungsgruppe an IGISOL/JYFLTRAP, finanziert vom Forschungsrat Finnland und der Universität Jyväskylä.

## Mitglieder

- **Dr. Brian Kootte** — Postdoc ([Profil](https://www.jyu.fi/en/people/brian-koote))
- **Dr. Marlom de Oliveira Ramalho** — Postdoc ([Profil](https://www.jyu.fi/en/people/marlom-de-oliveira-ramalho))
- **Miikka Winter** — Doktorand

## Lehre

- **FYSS3552** — *Lasers and Traps in Nuclear Physics Studies*, Doktorandenkurs, Universität Jyväskylä

## Herausgebertätigkeit

- Gastherausgeber, *Sensors*-Sonderheft [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS})
""",
"cv.md": f"""---
title: "Lebenslauf"
description: "Akademischer Lebenslauf."
showDate: false
---

## Aktuelle Position

- **seit 2023** Academy Research Fellow (Projektleiter), Fachbereich Physik, Universität Jyväskylä, Finnland

## Frühere Positionen

- **2021–2023** Postdoc, FRS/Super-FRS-Gruppe, GSI Helmholtzzentrum für Schwerionenforschung, Darmstadt
- **2019–2021** Postdoc, Fachbereich Physik, Universität Jyväskylä (JYFLTRAP)
- **2018–2019** Wissenschaftlicher Assistent, Institute of Modern Physics, Chinesische Akademie der Wissenschaften
- **2018** Senior Visiting Scientist, RIKEN, Japan
- **2015–2018** International Program Associate, RIKEN Nishina Center, Japan

## Ausbildung

- **Promotion (2018)**, Universität Saitama und RIKEN Nishina Center, Japan — *Time- and position-sensitive foil-MCP detector for mass measurements at the Rare-RI Ring*
- **Promotion (2019)**, Universität der Chinesischen Akademie der Wissenschaften und Institute of Modern Physics — *Design and test of high-resolution beam-line systems and mass measurements of N = Z nuclei*
- **Bachelor (2012)**, Kernwissenschaft und Kerntechnik, Xi'an Jiaotong University, China

## Stipendien und Förderung

- **2023–2027** Academy Research Fellowship und Projekt MASSPASS (Leitung), Forschungsrat Finnland
- **2023** WINNINGNormandy-Fellowship, GANIL — EU Horizont 2020, Marie-Skłodowska-Curie-Maßnahmen
- **2018–2021** Senior Visiting Scientist, RIKEN RI Beam Factory, Japan

## Lehre und Betreuung

- Betreuung von zwei Postdocs und einem Doktoranden (siehe [Gruppe](../group/))
- Dozent, FYSS3552 *Lasers and Traps in Nuclear Physics Studies*

## Gremien und Dienste

- Gastherausgeber, *Sensors*-Sonderheft [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS})

## Publikationen und Vorträge

Siehe [Publikationen](../publications/) und [Vorträge](../talks/).

## Kennungen

{IDS}
""",
"posts/_index.md": """---
title: "Blog"
description: "Notizen zu Ionenfallen, Massenmessungen und Instrumentierung."
---
""",
"posts/welcome.md": """---
title: "Willkommen"
date: 2026-10-03
description: "Die neue Website."
tags: ["news"]
---

Diese Website stellt meine Forschung zur Penning-Fallen- und MR-TOF-Massenspektrometrie exotischer Kerne vor. Die Seite [Täglich](../../daily/) enthält einen Kalender mit meinem Forschungslog sowie neuen Artikeln, Nachrichten und Stellen in Kernphysik und Ionenfallentechnik.
""",
}

# ───────────────────────────────── 日本語 ────────────────────────────────────
P["ja"] = {
"_index.md": f"""---
title: "葛 壮（Zhuang Ge）"
description: "ユヴァスキュラ大学 フィンランド・アカデミー研究員 — ペニングトラップと MR-TOF によるエキゾチック原子核の質量分析。"
---

フィンランド・**ユヴァスキュラ大学物理学科のアカデミー研究員（Academy Research Fellow）・研究代表者（PI）**です。専門は**原子核物理学と原子核天体物理学**で、イオントラップを用いてエキゾチック原子核の質量・Q 値・崩壊を精密に測定しています。

エキゾチック原子核・ビーム（IGISOL）グループに所属し、ペニングトラップ JYFLTRAP と多重反射飛行時間型（MR-TOF）質量分析を用いています。アカデミー研究員プロジェクト [MASSPASS]({MASSPASS}) の代表として、IGISOL と理化学研究所（RIKEN）で二重魔法数核 ¹⁰⁰Sn までの *N* = *Z* エキゾチック核の質量測定を進めています。

埼玉大学・理化学研究所仁科加速器科学研究センター（日本）と中国科学院大学・中国科学院近代物理研究所で博士号を取得しました。RIKEN、GSI、IMP の蓄積リング施設と IGISOL で研究を行い、JYFLTRAP（2019–2021 年）と GSI の FRS/Super-FRS グループ（2021–2023 年）での博士研究員を経て、2023 年にアカデミー研究員としてユヴァスキュラに戻りました。

研究グループには博士研究員 2 名と博士課程学生 1 名が在籍し、博士課程講義 *Lasers and Traps in Nuclear Physics Studies* を担当しています。*Nature*、*Physical Review Letters*、*Physics Letters B*、*The Astrophysical Journal* などに 90 編以上の査読付き論文を共著で発表しています。

**連絡先：** zhuang.z.ge@jyu.fi
""",
"research.md": f"""---
title: "研究"
description: "ニュートリノ物理・原子核構造・原子核天体物理のためのイオントラップ質量分析。"
showDate: false
---

高精度のイオントラップおよび蓄積リング質量分析により、ニュートリノ物理、原子核構造、原子核天体物理の問題に取り組んでいます。各テーマの論文は共通の論文データベースから表示され、全リストは[論文](../publications/)ページにあります。

## ¹⁰⁰Sn までの N = Z エキゾチック核 — MASSPASS

アカデミー研究員プロジェクト（代表）。IGISOL（ユヴァスキュラ）と RIKEN（日本）で ¹⁰⁰Sn までの *N* = *Z* エキゾチック核とその近傍核の質量を測定し、最も重い自己共役二重魔法数核へ向かう殻構造の変化と rp 過程の核物理入力を調べています。[プロジェクトページ]({MASSPASS})

{{{{< pubs theme="nz" >}}}}

## ニュートリノ質量決定のための Q 値

ペニングトラップで崩壊エネルギー（Q 値）を直接測定し、将来のニュートリノ質量直接測定実験に向けた超低 Q 値の β⁻ 崩壊・電子捕獲遷移を探索し、適さない候補を除外します。

{{{{< pubs theme="neutrino" >}}}}

## 同位体シフト研究のための原子質量

{{{{< pubs theme="isotope-shift" >}}}}

## 蓄積リング・MR-TOF・MCP 検出器

博士課程では RIKEN の稀少 RI リング（Rare-RI Ring）で等時性質量測定のための二次イオン識別と、時間・位置検出型マイクロチャンネルプレート（MCP）検出器の開発を行いました。その後、IGISOL と GSI FRS Ion Catcher の MR-TOF 分光器、HIAF 向け検出器構想へと展開しています。

{{{{< pubs theme="detectors" >}}}}
""",
"publications.md": """---
title: "論文"
description: "筆頭著者・責任著者論文と主な共著論文。"
showDate: false
---

査読付き論文 90 編以上。全リスト：[ORCID](https://orcid.org/0000-0001-8586-6134) · [INSPIRE-HEP](https://inspirehep.net/authors/2600261) · [Scopus](https://www.scopus.com/authid/detail.uri?authorId=56915277300)

## 筆頭著者論文

{{< pubs role="first" numbered="true" >}}

## 責任著者論文

{{< pubs role="corresponding" >}}

## 主な共著論文（ハイライト）

{{< pubs role="coauthor" highlight="only" >}}

## 共著論文（抜粋）

{{< pubs role="coauthor" highlight="exclude" group="year" >}}
""",
"talks.md": """---
title: "講演"
description: "招待講演と学会発表（会議へのリンク付き）。"
showDate: false
---

## 招待講演

{{< talks kind="invited" >}}

## 学会発表

{{< talks kind="contributed" >}}
""",
"daily/_index.md": """---
title: "デイリー"
description: "研究ログ、ニュース、新着論文、原子核物理・イオントラップ技術の求人 — カレンダーの日付をクリック。"
showDate: false
---

自分の研究ログに加え、原子核物理とイオントラップ技術に関する新着論文・ニュース・求人を集めています。色は種類を表し、日付をクリックするとその日の記録が表示されます。種類での絞り込みや検索もできます。新着論文と求人は毎日自動で収集されます。

{{< daily-calendar >}}
""",
"projects.md": f"""---
title: "プロジェクト"
description: "研究プロジェクト、装置、研究用ソフトウェア。"
showDate: false
---

## MASSPASS — アカデミー研究員プロジェクト（代表）、2023–2027
原子核物理・原子核天体物理のための、IGISOL と RIKEN における ¹⁰⁰Sn までの *N* = *Z* エキゾチック核の質量測定。フィンランド研究評議会。[プロジェクトページ]({MASSPASS})

## ニュートリノ質量決定のための低 Q 値崩壊
JYFLTRAP ペニングトラップによる Q 値測定で、超低 Q 値遷移を探索・検証します。

## MR-TOF 質量分析
多重反射飛行時間型分光器の設計、イオン光学シミュレーション、解析パイプライン。

## RFQ クーラー・バンチャーとビーム準備
冷却・バンチ化された放射性ビームのための高周波四重極（RFQ）クーラーのイオン光学設計。

## 蓄積リング用検出器
Rare-RI Ring（RIKEN）用の時間・位置検出型 MCP 検出器と HIAF 向けの構想。

## 研究用ソフトウェア
Python によるペニングトラップ粒子シミュレーション、MR-TOF 較正、2 次元 MCP 位置較正ツール。
""",
"group.md": f"""---
title: "グループ"
description: "グループメンバー、教育、編集活動。"
showDate: false
---

フィンランド研究評議会とユヴァスキュラ大学の支援を受け、IGISOL/JYFLTRAP で研究グループを率いています。

## メンバー

- **Brian Kootte 博士** — 博士研究員（[プロフィール](https://www.jyu.fi/en/people/brian-koote)）
- **Marlom de Oliveira Ramalho 博士** — 博士研究員（[プロフィール](https://www.jyu.fi/en/people/marlom-de-oliveira-ramalho)）
- **Miikka Winter** — 博士課程学生

## 教育

- **FYSS3552** — *Lasers and Traps in Nuclear Physics Studies*（ユヴァスキュラ大学 博士課程講義）

## 編集活動

- *Sensors* 誌特集号 [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS}) ゲストエディター
""",
"cv.md": f"""---
title: "経歴"
description: "研究者としての経歴。"
showDate: false
---

## 現職

- **2023–** アカデミー研究員（研究代表者）、ユヴァスキュラ大学 物理学科（フィンランド）

## 職歴

- **2021–2023** 博士研究員、GSI ヘルムホルツ重イオン研究所 FRS/Super-FRS グループ（ドイツ・ダルムシュタット）
- **2019–2021** 博士研究員、ユヴァスキュラ大学 物理学科（JYFLTRAP）
- **2018–2019** 研究助手、中国科学院近代物理研究所
- **2018** 上級訪問研究員、理化学研究所（RIKEN）
- **2015–2018** 国際プログラム・アソシエイト、理化学研究所 仁科加速器科学研究センター

## 学歴

- **博士（2018）**、埼玉大学・理化学研究所仁科加速器科学研究センター — *Time- and position-sensitive foil-MCP detector for mass measurements at the Rare-RI Ring*
- **博士（2019）**、中国科学院大学・中国科学院近代物理研究所 — *Design and test of high-resolution beam-line systems and mass measurements of N = Z nuclei*
- **学士（2012）**、西安交通大学 原子核科学・技術専攻（中国）

## フェローシップ・研究費

- **2023–2027** アカデミー研究員および MASSPASS プロジェクト（代表）、フィンランド研究評議会
- **2023** WINNINGNormandy フェローシップ（GANIL）— EU ホライズン 2020 マリー・スクウォドフスカ＝キュリー・アクション
- **2018–2021** 理化学研究所 RI ビームファクトリー 上級訪問研究員

## 教育・指導

- 博士研究員 2 名・博士課程学生 1 名の指導（[グループ](../group/)参照）
- FYSS3552 *Lasers and Traps in Nuclear Physics Studies* 講師

## 学術活動

- *Sensors* 誌特集号 [Detectors & Sensors in Nuclear Physics and Nuclear Astrophysics]({SENSORS}) ゲストエディター

## 論文と講演

[論文](../publications/)と[講演](../talks/)をご覧ください。

## 研究者 ID

{IDS}
""",
"posts/_index.md": """---
title: "ブログ"
description: "イオントラップ、質量測定、装置開発に関するメモ。"
---
""",
"posts/welcome.md": """---
title: "ようこそ"
date: 2026-10-03
description: "新しいウェブサイト。"
tags: ["news"]
---

このサイトでは、エキゾチック原子核のペニングトラップおよび MR-TOF 質量分析に関する研究を紹介します。[デイリー](../../daily/)ページのカレンダーには、研究ログと原子核物理・イオントラップ技術に関する新着論文・ニュース・求人がまとめられています。
""",
}

written = 0
for lang, pages in P.items():
    for rel_path, text in pages.items():
        path = ROOT / "content" / lang / rel_path
        if path.exists() and not FORCE:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        written += 1
print(f"wrote {written} content files")
