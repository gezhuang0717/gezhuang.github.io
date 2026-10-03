"""Apply the reviewed October 2026 professional content corrections.

This dated migration is reproducible but intentionally not a live scraper.
See docs/content-review.md for sources, exclusions and evidence limits.
"""
from pathlib import Path
import re
import maintenance as m

ROOT = m.ROOT
GROUP_EN = '''I work at IGISOL/JYFLTRAP in the University of Jyväskylä Accelerator Laboratory.

## Members and collaborators

- **Dr. Brian Kootte** — Postdoctoral Researcher ([university profile](https://www.jyu.fi/en/people/brian-kootte)).
- **Miikka Winter** — Doctoral Researcher ([university profile](https://www.jyu.fi/fi/henkilot/miikka-winter)).

## Former members and continuing collaborators

- **Dr. Marlom Ramalho** — former JYFLTRAP/IGISOL postdoctoral researcher (2024); his [public profile](https://www.nucleonicinsight.com/about.html) lists a subsequent Oskar Huttunen Fellowship at the University of York.

## Teaching

- **FYSS3552** — *Lasers and Traps in Nuclear Physics Studies*, University of Jyväskylä doctoral course.

## Editorial work

- Guest editor, *Sensors* special issue [Detectors and Sensors in Nuclear Physics and Nuclear Astrophysics](https://www.mdpi.com/journal/sensors/special_issues/8I8CN6PDV1).

The member roles above were checked against public profiles on 3 October 2026. This selected list is not the full IGISOL staff directory; see the [IGISOL group](https://www.jyu.fi/en/research-groups/exotic-nuclei-and-beams-igisol).
'''
GROUP_ZH = '''我在于韦斯屈莱大学加速器实验室的 IGISOL/JYFLTRAP 开展研究。

## 成员与合作者

- **Brian Kootte 博士** — 博士后研究员（[大学主页](https://www.jyu.fi/en/people/brian-kootte)）。
- **Miikka Winter** — 博士研究人员（[大学主页](https://www.jyu.fi/fi/henkilot/miikka-winter)）。

## 原成员与持续合作伙伴

- **Marlom Ramalho 博士** — 曾于 2024 年在 JYFLTRAP/IGISOL 任博士后；其[公开个人主页](https://www.nucleonicinsight.com/about.html)列出随后在约克大学担任 Oskar Huttunen 基金会研究员的经历。

## 教学

- **FYSS3552** —《核物理研究中的激光与离子阱》，于韦斯屈莱大学博士课程。

## 编辑工作

- *Sensors* 期刊特刊 [Detectors and Sensors in Nuclear Physics and Nuclear Astrophysics](https://www.mdpi.com/journal/sensors/special_issues/8I8CN6PDV1) 客座编辑。

上述成员职位于 2026 年 10 月 3 日按公开主页核对。本精选名单并非 IGISOL 全体人员名录；完整信息见 [IGISOL 研究组](https://www.jyu.fi/en/research-groups/exotic-nuclei-and-beams-igisol)。
'''
changes = {}
for lang in ('en', 'zh', 'fi', 'de', 'ja'):
    path = ROOT / 'content' / lang / 'group.md'
    raw = path.read_text(); front = raw.split('---', 2)[1]
    body = GROUP_ZH if lang == 'zh' else GROUP_EN
    if lang not in ('en', 'zh'):
        body = '**English fallback:** The October 2026 member update is awaiting translation.\n\n' + body
    changes[str(path.relative_to(ROOT))] = '---' + front + '---\n\n' + body
    path = ROOT / 'content' / lang / '_index.md'
    raw = path.read_text()
    paragraphs = raw.split('\n\n')
    replacement = ('我讲授博士课程《核物理研究中的激光与离子阱》。公开论文与主要报告见本网站对应栏目；成员与合作者的现状见[团队页面](group/)。' if lang == 'zh' else 'I teach the doctoral course *Lasers and Traps in Nuclear Physics Studies*. The website lists selected public publications and main talks; see the [Group page](group/) for members and collaborators.')
    if lang not in ('en', 'zh'):
        replacement = '**English fallback:** ' + replacement
    paragraphs = [replacement if ('90' in line and ('论文' in line or 'paper' in line or 'Publikation' in line or 'julkaisu' in line or '論文' in line)) else line for line in paragraphs]
    raw = '\n\n'.join(paragraphs)
    note = ('\n\nMASSPASS 项目期为 **2023 年 9 月 1 日至 2027 年 8 月 31 日**，由芬兰研究理事会资助。职位与项目信息依据[大学个人主页](https://www.jyu.fi/en/people/zhuang-ge)及[项目主页](https://www.jyu.fi/en/projects/mass-measurements-of-exotic-nz-nuclei-up-to-100sn-and-the-vicinity-for-nuclear-physics-and-nuclear)，核对日期：2026 年 10 月 3 日。\n' if lang == 'zh' else '\n\n' + ('**English fallback:** ' if lang not in ('en','zh') else '') + 'MASSPASS runs from **1 September 2023 to 31 August 2027**, funded by the Research Council of Finland. Position and project information follow the [university profile](https://www.jyu.fi/en/people/zhuang-ge) and [project page](https://www.jyu.fi/en/projects/mass-measurements-of-exotic-nz-nuclei-up-to-100sn-and-the-vicinity-for-nuclear-physics-and-nuclear), checked on 3 October 2026.\n')
    if 'checked on 3 October 2026' not in raw and '核对日期：2026 年 10 月 3 日' not in raw:
        raw += note
    changes[str(path.relative_to(ROOT))] = raw
    path = ROOT / 'content' / lang / 'cv.md'
    raw = path.read_text()
    lines = raw.splitlines()
    for i,line in enumerate(lines):
        if 'group/' in line:
            lines[i] = '- 研究人员指导与合作情况见[团队](../group/)。' if lang == 'zh' else '- ' + ('**English fallback:** ' if lang not in ('en','zh') else '') + 'Supervision and collaboration with early-career researchers (see [Group](../group/)).'
    changes[str(path.relative_to(ROOT))] = '\n'.join(lines) + '\n'
m.transaction(changes)
