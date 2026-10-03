---
title: "Personal Website Manual"
subtitle: "Install, edit, update and deploy https://gezhuang0717.github.io"
author: "Zhuang Ge"
date: "October 2026"
---

# 1. What you have

| Item | Value |
|---|---|
| Live site | <https://gezhuang0717.github.io> |
| Source repository | <https://github.com/gezhuang0717/gezhuang0717.github.io> |
| Site generator | Hugo extended (version pinned to 0.167.0 in the deploy workflow) |
| Themes | Congo (live), Blowfish, PaperMod, all installed as git submodules |
| Deployment | GitHub Actions workflow `.github/workflows/hugo.yml`, runs on every push to `main` |

How it works: you edit plain Markdown text files, push them to GitHub, and GitHub Actions builds the HTML with Hugo and publishes it to GitHub Pages about one minute later. Nothing needs to run on your computer except when you want to preview.

You can edit in two ways:

- **In the browser only** (no installation): edit files directly on github.com. Section 4.
- **On your Mac** (recommended for larger changes): clone, preview locally, push. Sections 3 and 5.

## 1.1 Repository layout

```
gezhuang0717.github.io/
├── content/                 ← YOUR TEXT (shared by all themes)
│   ├── _index.md            homepage bio and contact
│   ├── research.md          research themes + first-author papers
│   ├── publications.md      all publications
│   ├── projects.md
│   ├── talks.md
│   ├── mentorship.md
│   ├── cv.md
│   └── posts/               blog posts, one file each
├── assets/img/zhuang-ge.png profile picture (Congo, Blowfish)
├── static/                  files copied as-is to the site
│   └── img/zhuang-ge.png    profile picture (PaperMod)
├── sites/                   ← LOOK AND MENUS, one folder per theme
│   ├── congo/_default/      hugo.toml, params.toml, languages.en.toml, menus.en.toml
│   ├── blowfish/_default/   same files
│   └── papermod/_default/   hugo.toml (everything in one file)
├── themes/                  theme code (git submodules, do not edit)
├── .github/workflows/hugo.yml  build-and-deploy workflow
├── docs/                    this manual and short guides
├── setup.sh                 downloads the themes after cloning
└── README.md
```

Rule of thumb: **text lives in `content/`, appearance lives in `sites/<theme>/`**. You never need to touch `themes/`.

# 2. One-time setup on your Mac

## 2.1 Install the tools

Open **Terminal** (Applications → Utilities → Terminal).

1. Install Homebrew if `brew --version` reports "command not found". Paste the install command shown on <https://brew.sh> and follow the prompts.
2. Install Git and Hugo:

   ```bash
   brew install git hugo
   ```

3. Check the versions:

   ```bash
   git --version
   hugo version
   ```

   The Hugo line must contain `+extended` and a version of at least **0.163.0**.

On Windows use `winget install Git.Git Hugo.Hugo.Extended`; on Linux install the `hugo_extended_*.deb` from <https://github.com/gohugoio/hugo/releases>.

## 2.2 Connect Git to GitHub

Tell Git who you are (once per computer):

```bash
git config --global user.name  "Zhuang Ge"
git config --global user.email "zhuang.z.ge@jyu.fi"
```

GitHub no longer accepts your account password for `git push`. The simplest option is the GitHub CLI, which signs you in through the browser:

```bash
brew install gh
gh auth login        # choose GitHub.com → HTTPS → Login with a web browser
```

## 2.3 Download the site

```bash
cd ~/Documents
git clone --recursive https://github.com/gezhuang0717/gezhuang0717.github.io
cd gezhuang0717.github.io
```

`--recursive` also downloads the three themes. If you forgot it, run `bash setup.sh`.

# 3. The daily workflow on your Mac

Every change follows the same four steps.

**Step 1 — get the latest version** (important if you also edit on github.com):

```bash
cd ~/Documents/gezhuang0717.github.io
git pull
```

**Step 2 — start the live preview:**

```bash
hugo server --configDir sites/congo --themesDir themes
```

Open <http://localhost:1313>. Leave this Terminal window running; the page reloads every time you save a file.

**Step 3 — edit** files in `content/` (or `sites/congo/_default/`) with any plain-text editor. Recommended: Visual Studio Code (<https://code.visualstudio.com>), then `code .` opens the whole folder. Save and check the preview.

**Step 4 — publish.** Open a second Terminal window (the first is busy with the preview):

```bash
cd ~/Documents/gezhuang0717.github.io
git add .
git commit -m "Add new PRC paper"      # short description of the change
git push
```

Then watch **Actions** on GitHub (<https://github.com/gezhuang0717/gezhuang0717.github.io/actions>). When *Deploy Hugo site* shows a green tick (about 1 minute), the live site is updated. Reload it with Cmd+Shift+R to bypass the browser cache.

Stop the preview with **Ctrl+C**.

# 4. Editing without installing anything

For a quick fix (a typo, one new paper):

1. Open <https://github.com/gezhuang0717/gezhuang0717.github.io>.
2. Click into `content/`, then the file, e.g. `publications.md`.
3. Click the **pencil icon** (Edit this file).
4. Make the change. Use the **Preview** tab to check the formatting.
5. Click **Commit changes…**, write a short message, keep "Commit directly to the main branch", and click **Commit changes**.
6. The site rebuilds automatically; check the **Actions** tab for the green tick.

To upload a file (photo, CV PDF): open the folder on github.com, click **Add file → Upload files**, drag the file in, and commit.

If you later work on your Mac again, run `git pull` first so you have these web edits.

# 5. How to change things

## 5.1 Markdown in two minutes

Each content file starts with a header between two `---` lines. Keep it; change only `title` or `description` if needed.

```markdown
---
title: "Research"
description: "One-line summary shown in search results."
showDate: false
---

## Section heading
### Sub-heading
Normal paragraph with **bold**, *italic* and a [link](https://doi.org/...).

- bullet item
- another item

1. numbered item
2. next item
```

Isotopes: type the Unicode superscripts directly (¹⁰⁰Sn, ⁹⁷Tc, β⁻) or use HTML: `<sup>100</sup>Sn`.

## 5.2 Where each thing lives

| You want to change | Edit this file |
|---|---|
| Homepage text, contact line | `content/_index.md` |
| Research themes | `content/research.md` |
| Publications | `content/publications.md` |
| Projects / Talks / Mentorship / CV | `content/projects.md`, `talks.md`, `mentorship.md`, `cv.md` |
| Blog | `content/posts/*.md` |
| Name, headline under the photo, social icons | `sites/congo/_default/languages.en.toml` |
| Menu (order, names, new items) | `sites/congo/_default/menus.en.toml` |
| Colours, homepage layout, header style | `sites/congo/_default/params.toml` |
| Site title, base settings | `sites/congo/_default/hugo.toml` |
| Profile photo | `assets/img/zhuang-ge.png` and `static/img/zhuang-ge.png` |
| Which theme is live | `THEME:` in `.github/workflows/hugo.yml` |

If you switch the live theme to Blowfish or PaperMod, edit the matching folder under `sites/` instead of `sites/congo/`.

## 5.3 Add a new publication

Open `content/publications.md`. First-author papers are a numbered list, newest first. Insert the new line at the top and renumber (Markdown renumbers automatically if you simply start every line with `1.`):

```markdown
1. **Z. Ge** *et al.*, Title of the paper, [Phys. Rev. C **115**, 012345 (2027)](https://doi.org/10.1103/xxxx) · [arXiv:2701.01234](https://arxiv.org/abs/2701.01234)
```

For a co-authored paper add a bullet under the right year in *Selected co-authored papers*:

```markdown
- A. Author, **Z. Ge** *et al.*, Title, [Journal **Vol**, Page (Year)](https://doi.org/...)
```

If it belongs to a research theme, copy the same line under that heading in `content/research.md`.

Tip: INSPIRE-HEP gives you the reference data. Search `fa Ge, Zhuang` on <https://inspirehep.net> for first-author papers.

## 5.4 Add a talk

In `content/talks.md`, add at the top of *Invited talks* or *Contributed talks*:

```markdown
- **2027** — *Talk title*. Conference name, dates, City, Country ([slides](https://...))
```

## 5.5 Replace the profile picture

1. Prepare a square photo, at least 400 × 400 pixels, saved as PNG named `zhuang-ge.png`.
2. Replace both `assets/img/zhuang-ge.png` and `static/img/zhuang-ge.png`.
3. To use a JPG instead, name it `zhuang-ge.jpg` and change `image = "img/zhuang-ge.png"` in `sites/congo/_default/languages.en.toml` accordingly.

## 5.6 Put your CV PDF online

1. Copy the PDF to `static/cv.pdf`.
2. In `sites/congo/_default/menus.en.toml`, replace the CV block with:

   ```toml
   [[main]]
     name = "CV"
     url = "/cv.pdf"
     weight = 70
   ```

The PDF is then at <https://gezhuang0717.github.io/cv.pdf>. To keep the HTML CV page as well, use `name = "CV (PDF)"` and a different weight instead of replacing the block.

## 5.7 Write a blog post

```bash
hugo new content posts/low-q-decays.md --configDir sites/congo --themesDir themes
```

This creates `content/posts/low-q-decays.md` with a header. Write the text below it and set `draft = false` (or delete the draft line), otherwise the post is hidden on the live site. Images: put them next to the post by turning it into a folder (`content/posts/low-q-decays/index.md` plus `figure.png`) and reference them as `![Caption](figure.png)`.

## 5.8 Add a new page and menu item

1. Create `content/teaching.md`:

   ```markdown
   ---
   title: "Teaching"
   showDate: false
   ---
   Text here.
   ```

2. Add to `sites/congo/_default/menus.en.toml`:

   ```toml
   [[main]]
     name = "Teaching"
     pageRef = "teaching"
     weight = 45
   ```

`weight` sets the order (smaller is further left). Existing weights are 10, 20, … 70.

## 5.9 Social links under your name

In `sites/congo/_default/languages.en.toml`:

```toml
  links = [
    { email = "mailto:zhuang.z.ge@jyu.fi" },
    { orcid = "https://orcid.org/0000-0001-8586-6134" },
    { google-scholar = "https://scholar.google.com/citations?user=YOUR_ID" },
    { researchgate = "https://www.researchgate.net/profile/Zhuang-Ge" },
    { linkedin = "https://www.linkedin.com/in/zhuang-ge-847898202" },
    { github = "https://github.com/gezhuang0717" },
    { link = "https://www.jyu.fi/en/people/zhuang-ge" },
  ]
```

Order in the list is the order of the icons. Other icon names include `x-twitter`, `bluesky`, `mastodon`, `youtube`, `weibo`.

## 5.10 Colours and layout

In `sites/congo/_default/params.toml`:

- `colorScheme = "sapphire"`: alternatives `congo`, `avocado`, `cherry`, `fire`, `ocean`, `slate`.
- `defaultAppearance = "light"` or `"dark"`; `autoSwitchAppearance = true` follows the visitor's system setting.
- `[homepage] layout = "profile"` (photo + bio) or `"page"` (plain text). `showRecent = true` lists recent blog posts under the bio.

Blowfish has more schemes (`ocean`, `forest`, `fire`, `neon`, `noir`, `autumn`, `princess`, `terminal`, `github`, `marvel`, `one-light`, `slate`, …) and homepage layouts (`profile`, `page`, `hero`, `card`, `background`, `landing`).

## 5.11 Switch the live theme

1. Preview the alternative first:

   ```bash
   hugo server --configDir sites/blowfish --themesDir themes
   hugo server --configDir sites/papermod --themesDir themes
   ```

2. In `.github/workflows/hugo.yml` change `THEME: congo` to `blowfish` or `papermod`.
3. Commit and push.

All content files stay the same; only the look changes.

## 5.12 Custom domain (optional)

1. Buy a domain and create a DNS record: `CNAME` for `www.yourdomain.org` → `gezhuang0717.github.io`.
2. Create `static/CNAME` with the single line `www.yourdomain.org`, commit and push.
3. GitHub → repository **Settings → Pages → Custom domain**: enter the domain and tick **Enforce HTTPS**.

# 6. Keeping the software up to date

## 6.1 Update the themes

```bash
git submodule update --remote --merge
hugo server --configDir sites/congo --themesDir themes   # check nothing broke
git add themes
git commit -m "Update themes"
git push
```

Theme updates occasionally rename a setting; if the preview shows an error, read the message, check the theme's documentation, or roll back with `git checkout themes`.

## 6.2 Update Hugo

- On your Mac: `brew upgrade hugo`.
- On GitHub: change `HUGO_VERSION: 0.167.0` in `.github/workflows/hugo.yml` to the new version number from <https://github.com/gohugoio/hugo/releases>.

Keep the two roughly in step so the preview matches the live site.

# 7. Undoing a mistake

- **Not yet committed:** `git checkout -- content/research.md` restores the last committed version of that file; `git restore .` restores everything.
- **Committed and pushed:** find the commit with `git log --oneline`, then `git revert <commit-id>` and `git push`. This adds a new commit that undoes the old one; history is never lost.
- **On github.com:** open the file → **History** → pick an older version → copy its text back.

# 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Actions run has a red cross | Click it, open the failed step and read the last lines. Most often a typo in a `.toml` file (missing quote or bracket) or Markdown header. Fix and push again. |
| `TOCSS` / SCSS error locally | Standard Hugo installed instead of extended: `brew reinstall hugo` (Homebrew's Hugo is extended). |
| Blank or unstyled page locally | Themes missing: `git submodule update --init --recursive`. |
| `git push` rejected ("fetch first") | Someone (you on github.com) changed the repository. Run `git pull`, then `git push`. |
| `git push` asks for a password | Run `gh auth login`, or use a personal access token. |
| Changes not visible online | Wait for the green tick in Actions, then hard-reload (Cmd+Shift+R). |
| New post missing online | `draft = true` in its header; set it to `false`. |
| Pages shows a 404 | Settings → Pages → Source must be **GitHub Actions**. |

# 9. Command cheat sheet

| Task | Command |
|---|---|
| Get latest version | `git pull` |
| Preview (Congo) | `hugo server --configDir sites/congo --themesDir themes` |
| Preview (Blowfish) | `hugo server --configDir sites/blowfish --themesDir themes` |
| Preview (PaperMod) | `hugo server --configDir sites/papermod --themesDir themes` |
| New blog post | `hugo new content posts/NAME.md --configDir sites/congo --themesDir themes` |
| See what changed | `git status` / `git diff` |
| Publish | `git add . && git commit -m "message" && git push` |
| Update themes | `git submodule update --remote --merge` |
| Undo a pushed commit | `git revert <id> && git push` |

# 10. References

- Hugo documentation: <https://gohugo.io/documentation/>
- Congo theme documentation: <https://jpanther.github.io/congo/docs/>
- Blowfish theme documentation: <https://blowfish.page/docs/>
- PaperMod wiki: <https://github.com/adityatelange/hugo-PaperMod/wiki>
- GitHub Pages documentation: <https://docs.github.com/en/pages>
- Hosting Hugo on GitHub Pages: <https://gohugo.io/host-and-deploy/host-on-github-pages/>
- Markdown guide: <https://www.markdownguide.org/basic-syntax/>
- Git handbook: <https://git-scm.com/book/en/v2>
