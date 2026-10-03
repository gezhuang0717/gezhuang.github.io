# Editing manual — how to change the site

Every change follows the same loop:

1. Edit a file in a text editor (VS Code, Notepad++, TextEdit in plain-text mode).
2. Preview: `hugo server --configDir sites/congo --themesDir themes` → <http://localhost:1313>.
3. Publish:
   ```bash
   git add .
   git commit -m "Describe the change"
   git push
   ```
   GitHub rebuilds the live site in about a minute.

Page text lives in `content/` and is shared by all three themes. Look and menus live in `sites/<theme>/_default/`.

---

## Where things are

| What you want to change | File |
|---|---|
| Homepage bio and contact | `content/_index.md` |
| Research themes | `content/research.md` |
| Publication list | `content/publications.md` |
| Projects, talks, mentorship, CV | `content/projects.md`, `talks.md`, `mentorship.md`, `cv.md` |
| Blog posts | `content/posts/*.md` |
| Name, headline, social icons | Congo/Blowfish: `sites/<theme>/_default/languages.en.toml` · PaperMod: `sites/papermod/_default/hugo.toml` |
| Menu items | Congo/Blowfish: `sites/<theme>/_default/menus.en.toml` · PaperMod: `[[menu.main]]` blocks in `hugo.toml` |
| Colours and layout | `sites/<theme>/_default/params.toml` (PaperMod: `hugo.toml`) |
| Profile picture | `assets/img/zhuang-ge.png` **and** `static/img/zhuang-ge.png` |
| CV PDF | `static/cv.pdf` |

---

## Markdown basics

```markdown
## Section heading
**bold**, *italic*, [link text](https://example.org)
- bullet item
1. numbered item
Superscripts for isotopes: ¹⁰⁰Sn, or <sup>100</sup>Sn
```
Each file starts with a header between `---` lines (title, description). Keep it.

---

## Common tasks

### Add a new publication
Open `content/publications.md` and add a line at the top of the right list:
```markdown
1. **Z. Ge** *et al.*, Title of the paper, [Phys. Rev. C **115**, 012345 (2027)](https://doi.org/10.1103/xxxx) · [arXiv:2701.01234](https://arxiv.org/abs/2701.01234)
```
If it belongs to a research theme, add the same line under that heading in `content/research.md`.

### Change the photo
1. Save a square photo (at least 400 × 400 px) as `zhuang-ge.png`.
2. Copy it over both `assets/img/zhuang-ge.png` and `static/img/zhuang-ge.png`.
   To use `.jpg`, also change `image = "img/zhuang-ge.png"` (Congo/Blowfish) or `imageUrl` (PaperMod).

### Add the CV PDF to the menu
1. Put the file at `static/cv.pdf`.
2. In `menus.en.toml` replace the CV entry with:
   ```toml
   [[main]]
     name = "CV"
     url = "/cv.pdf"
     weight = 70
   ```

### Add a blog post
```bash
hugo new content posts/my-new-post.md --configDir sites/congo --themesDir themes
```
Write the text, then change `draft = true` to `draft = false` (or delete the line) before publishing.

### Add a new page (e.g. Teaching)
1. Create `content/teaching.md`:
   ```markdown
   ---
   title: "Teaching"
   showDate: false
   ---
   Text here.
   ```
2. Add a menu item (Congo/Blowfish `menus.en.toml`):
   ```toml
   [[main]]
     name = "Teaching"
     pageRef = "teaching"
     weight = 45
   ```
   `weight` sets the order: smaller numbers appear further left.

### Add or change social links
Congo/Blowfish, in `languages.en.toml` under `[params.author]`:
```toml
links = [
  { email = "mailto:zhuang.z.ge@jyu.fi" },
  { orcid = "https://orcid.org/0000-0001-8586-6134" },
  { google-scholar = "https://scholar.google.com/citations?user=YOUR_ID" },
  { github = "https://github.com/YOUR_NAME" },
]
```
Available icons include `github`, `google-scholar`, `orcid`, `researchgate`, `linkedin`, `x-twitter`, `bluesky`, `mastodon`, `youtube`, `email`, `link`.

PaperMod, in `hugo.toml`:
```toml
[[params.socialIcons]]
  name = "googlescholar"
  url = "https://scholar.google.com/citations?user=YOUR_ID"
```

### Change colours
- **Congo** `params.toml`: `colorScheme = "sapphire"` → `congo`, `avocado`, `cherry`, `fire`, `ocean`, `slate`.
- **Blowfish** `params.toml`: `colorScheme = "ocean"` → `blowfish`, `forest`, `fire`, `neon`, `noir`, `autumn`, `princess`, `terminal`, `github`, `marvel`, `one-light`, `slate`, `congo`, `avocado`, `bloody`, `burufugu`.
  Light or dark by default: `defaultAppearance = "light"` or `"dark"`.
- **PaperMod** `hugo.toml`: `defaultTheme = "auto"` → `light` or `dark`.

### Change the homepage layout
- **Congo** `[homepage] layout`: `profile` (photo + bio) or `page` (plain text).
- **Blowfish** `[homepage] layout`: `profile`, `page`, `hero`, `card`, `background`, `landing`.
  `showRecent = true` lists the latest blog posts under the bio.
- **PaperMod**: `profileMode.enabled = true` shows the profile card; edit `subtitle` and the `buttons` list.

### Switch the live theme
In `.github/workflows/hugo.yml` change `THEME: congo` to `blowfish` or `papermod`, then push.

### Update the themes
```bash
git submodule update --remote --merge
git add themes && git commit -m "Update themes" && git push
```
Preview first; theme updates occasionally rename settings.

---

## Keeping the publication list current

The lists were compiled from INSPIRE-HEP, Crossref and the JYU profile. To refresh:
- First-author papers on INSPIRE: <https://inspirehep.net/literature?q=fa%20Ge%2C%20Zhuang>
- All papers on INSPIRE: <https://inspirehep.net/literature?q=a%20Ge%2C%20Zhuang>
- ORCID record: <https://orcid.org/0000-0001-8586-6134>
- JYU research portal: <https://www.jyu.fi/en/people/zhuang-ge>

INSPIRE can export BibTeX (*cite all*); paste new entries into the Markdown format shown above.

---

## Theme documentation

[Congo docs](https://jpanther.github.io/congo/docs/) · [Blowfish docs](https://blowfish.page/docs/) · [PaperMod wiki](https://github.com/adityatelange/hugo-PaperMod/wiki) · [Hugo content docs](https://gohugo.io/content-management/)
