# Deploying to GitHub Pages

The site is static — no build step. Publishing is `git push`.

## One-time setup

1. **Create the repo.** A *user site* gives the cleanest URL. Name the repo
   exactly `Thomasg101.github.io`, which publishes at
   `https://thomasg101.github.io/`.

   ```sh
   gh repo create Thomasg101.github.io --public --source=. --remote=origin
   ```

   If you'd rather use a project repo (say `portfolio`), the URL becomes
   `https://thomasg101.github.io/portfolio/`. Every internal link on this site is
   relative, so that works without edits — but the absolute URLs in
   `<link rel="canonical">`, the `og:`/`twitter:` tags, `robots.txt`, and
   `sitemap.xml` would need the subpath added. See *Changing the site URL* below.

2. **Push.**

   ```sh
   git push -u origin main
   ```

3. **Turn on Pages.** Repository → Settings → Pages → Source: *Deploy from a
   branch*, branch `main`, folder `/ (root)`. First build takes a minute or two.

`.nojekyll` is already committed, so GitHub serves the files as-is instead of
running them through Jekyll.

## Adding a custom domain

`thomasgao.ca` is the recommendation — roughly CAD $15–20/year at Cloudflare,
Namecheap, or Porkbun, and it matches an all-Canadian employer list. `.ca`
requires Canadian presence, which you meet as a resident. `thomasgao.dev` is the
alternative if you'd rather lead with software (~USD $12–15/year).

Once you own one:

1. At the registrar, add these DNS records:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `thomasg101.github.io.` |

2. Add a `CNAME` file at the repo root containing just the domain:

   ```sh
   echo "thomasgao.ca" > CNAME
   ```

3. Repository → Settings → Pages → Custom domain → enter the domain, then tick
   **Enforce HTTPS** once the certificate is issued (usually within an hour).

4. Update the absolute URLs — see below.

## Changing the site URL

Absolute URLs appear in exactly four places. `https://thomasg101.github.io` is
the current value.

```sh
# 1 + 2: canonical and og:/twitter: tags in index.html and projects/*.html
grep -rl "thomasg101.github.io" index.html projects/*.html robots.txt \
  | xargs sed -i '' 's|https://thomasg101\.github\.io|https://thomasgao.ca|g'

# 3: the generator that writes sitemap.xml
sed -i '' 's|https://thomasg101\.github\.io|https://thomasgao.ca|' tools/build-sitemap.py

# 4: regenerate the sitemap itself
python3 tools/build-sitemap.py
```

Then confirm nothing was missed:

```sh
grep -rn "thomasg101.github.io" . --exclude-dir=.git
```

## After deploying

- Paste the URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  and [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) to
  confirm the card renders and to prime their caches. Both cache aggressively —
  if you change `og:image`, re-scrape there or the old card persists for weeks.
- Submit `sitemap.xml` in [Google Search Console](https://search.google.com/search-console).
- Re-run `python3 tools/build-sitemap.py` whenever you add or remove a case study.

## What is deliberately not published

`.gitignore` keeps these out of the repo, and therefore off the site:

- `uploads/` — working source material, including the resume source PDF
- `.DS_Store`, `.thumbnail` — macOS and authoring-tool artifacts

The previous `legacy-portfolio/` and `portfolio-design/` directories were removed
from the working tree but remain in git history. To recover either:

```sh
git checkout $(git log --diff-filter=D --format=%H -1 -- legacy-portfolio)~1 -- legacy-portfolio
```
