# Installation manual — step by step

This takes the site from the zip file to a live page at `https://<username>.github.io`.
Commands are typed in a terminal: **Terminal** on macOS, **PowerShell** or **Git Bash** on Windows, any shell on Linux.

---

## 1. Install the tools

You need **Git** and **Hugo extended** (version 0.163 or newer). Go is *not* needed for this setup.

### macOS
1. Install Homebrew if you do not have it: paste the command from <https://brew.sh> into Terminal.
2. Install both tools:
   ```bash
   brew install git hugo
   ```

### Windows
1. Install Git: download from <https://git-scm.com/download/win> and accept the defaults. This also gives you **Git Bash**, which you should use for the commands below.
2. Install Hugo extended:
   ```powershell
   winget install Hugo.Hugo.Extended
   ```
3. Close and reopen the terminal so the new programs are found.

### Linux (Ubuntu/Debian)
Distribution packages are often too old, so install the official package:
```bash
sudo apt install git
wget https://github.com/gohugoio/hugo/releases/download/v0.167.0/hugo_extended_0.167.0_linux-amd64.deb
sudo dpkg -i hugo_extended_0.167.0_linux-amd64.deb
```

### Check
```bash
git --version
hugo version
```
The Hugo line must contain **`+extended`** and a version of **0.163.0 or higher**.

---

## 2. Unpack the site and add the themes

1. Unpack `zg-hugo.tar.gz` (double-click it, or `tar xzf zg-hugo.tar.gz`).
2. Go into the folder and run the setup script once (or clone with `git clone --recursive https://github.com/gezhuang0717/gezhuang0717.github.io`):
   ```bash
   cd zg-hugo
   bash setup.sh
   ```
   This downloads the three themes (Congo, Blowfish, PaperMod) into `themes/`.

---

## 3. Preview on your computer

```bash
hugo server --configDir sites/congo --themesDir themes
```
Open <http://localhost:1313>. The page reloads automatically whenever you save a file.
Stop the server with **Ctrl + C**.

Try the other looks by replacing `congo` with `blowfish` or `papermod`.

---

## 4. Create the GitHub repository

1. Sign in at <https://github.com> (create an account if needed).
2. Click **New repository**.
3. Name it exactly **`<username>.github.io`**, where `<username>` is your GitHub user name. This gives the site the address `https://<username>.github.io`.
4. Leave it **Public**, do **not** add a README, and click **Create repository**.

> Any other repository name also works, but the site then lives at `https://<username>.github.io/<repo-name>/`.

---

## 5. Push the site

In the `zg-hugo` folder:
```bash
git add .
git commit -m "First version of personal website"
git remote add origin https://github.com/<username>/<username>.github.io.git
git push -u origin main
```
If Git asks for a password, use a **personal access token** (GitHub → Settings → Developer settings → Personal access tokens) or sign in through the browser window Git opens.

---

## 6. Turn on GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab. The workflow *Deploy Hugo site* runs on every push; wait for the green tick (about 1 minute).
4. Visit `https://<username>.github.io`.

---

## 7. Choose the live theme

Open `.github/workflows/hugo.yml` and change:
```yaml
  THEME: congo      # congo | blowfish | papermod
```
Commit and push. The site rebuilds with the new theme.

---

## 8. Optional: custom domain

1. Buy a domain and add a DNS **CNAME** record pointing `www.yourdomain.org` to `<username>.github.io`.
2. Create `static/CNAME` containing one line: `www.yourdomain.org`.
3. In **Settings → Pages**, enter the domain and tick **Enforce HTTPS**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `TOCSS: failed to transform` or SCSS errors | You installed standard Hugo; install the **extended** edition. |
| `module "congo" not found` / empty page | Themes are missing. Run `git submodule update --init --recursive`. |
| Error mentioning a minimum Hugo version | Update Hugo (`brew upgrade hugo`, `winget upgrade Hugo.Hugo.Extended`, or the newer `.deb`). |
| Site shows without styling online | Check that Pages source is **GitHub Actions**, not "Deploy from a branch". |
| Action fails at checkout | The themes were not committed as submodules; rerun `bash setup.sh` in a fresh clone, then commit `.gitmodules`. |

Further reading: [Hugo installation](https://gohugo.io/installation/) · [Hugo on GitHub Pages](https://gohugo.io/host-and-deploy/host-on-github-pages/) · [GitHub Pages docs](https://docs.github.com/en/pages)
