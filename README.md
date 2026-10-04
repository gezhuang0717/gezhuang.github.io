# gezhuang.github.io

Personal academic site of Zhuang Ge, built with [Hugo](https://gohugo.io/). One set of content, three interchangeable themes.

| Theme | Config | Look |
|---|---|---|
| [Congo](https://github.com/jpanther/congo) | `sites/congo` | Light profile homepage, sapphire colours (same theme as mengkel.github.io) |
| [Blowfish](https://github.com/nunocoracao/blowfish) | `sites/blowfish` | Dark ocean scheme, gradient header, table of contents, recent posts |
| [PaperMod](https://github.com/adityatelange/hugo-PaperMod) | `sites/papermod` | Minimal profile card with buttons, auto light/dark |

The website manual is kept locally (not in this public repository).

Live site: <https://gezhuang0717.github.io/gezhuang.github.io/>

## Structure

```
content/          shared Markdown pages (edit these)
  _index.md       homepage bio
  research.md     research themes + first-author papers
  publications.md full publication list
  projects.md, talks.md, mentorship.md, cv.md
  posts/          blog
assets/img/       profile image (processed by Congo/Blowfish)
static/img/       profile image (PaperMod); put cv.pdf in static/
sites/<theme>/_default/  per-theme config (menus, colours, links)
themes/           git submodules (added by setup.sh)
```

## Local preview

Requires Hugo **extended** ≥ 0.163 and Git.

```bash
./setup.sh                                                   # once
hugo server --configDir sites/congo    --themesDir themes    # or blowfish / papermod
```

Open http://localhost:1313.

## Deploy to GitHub Pages

1. Pushes to `main` deploy to https://gezhuang0717.github.io/gezhuang.github.io/ (GitHub project site).
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Every push rebuilds the site. To switch theme, change `THEME:` in `.github/workflows/hugo.yml`.

## Common edits

- Bio: `content/_index.md`; headline and social links: `sites/<theme>/_default/languages.en.toml` (Congo/Blowfish) or `hugo.toml` (PaperMod).
- Colours: `colorScheme` in `params.toml` (Congo: congo, avocado, cherry, fire, ocean, sapphire, slate; Blowfish has 17 schemes).
- Replace `assets/img/zhuang-ge.png` and `static/img/zhuang-ge.png` with a photo.
- Add a blog post: `hugo new content posts/my-post.md --configDir sites/congo --themesDir themes`.
