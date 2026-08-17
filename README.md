# Thomas Gao — Civil Engineering Portfolio

An interactive portfolio for a University of Waterloo civil engineering student
working between field practice and software. The homepage builds a twelve-storey
tower in WebGL; every few lifts a marker opens a chapter of the resume. Nine
standalone case-study pages sit behind it.

Static site. No build step, no framework, no third-party requests at runtime.

## Run locally

```sh
python3 tools/serve.py "$PWD" 4173
```

Then open <http://127.0.0.1:4173/>.

A plain `python3 -m http.server` also works if your terminal has permission to
read this folder; `tools/serve.py` exists because that module evaluates
`os.getcwd()` at import time, which fails under some sandboxes, and because it
serves the correct MIME type for `.avif` and `.woff2`.

### Previewing from Claude Code

macOS restricts access to `~/Downloads`, and Claude Code's preview launcher does
not hold that permission — it cannot open a file in this folder at all. The
workaround is to serve a copy from outside the protected directory:

```sh
./tools/sync-preview.sh          # prints the mirror path
```

Point `.claude/launch.json` at that path. **The mirror is a copy, so re-run
`sync-preview.sh` after editing** or the preview will show stale files.
`.claude/launch.json` is git-ignored because it holds absolute paths specific to
one machine. None of this affects your own terminal, which reads the folder
normally.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Homepage. All content is real HTML — it reads as a document with JavaScript off. |
| `assets/css/site.css` | Homepage styles. Light palette only. |
| `assets/css/fonts.css` | Self-hosted IBM Plex faces (generated). |
| `assets/js/site.js` | Homepage controller — chapters, routing, session state, marker layout. |
| `assets/js/building-scene.js` | Three.js construction sequence and milestone markers. Imported lazily by `site.js`. |
| `assets/js/vendor/three.module.min.js` | Vendored Three.js 0.160.0. |
| `projects/` | Nine case studies plus two redirect stubs for the merged solar URLs. |
| `projects/project-detail.css` | Shared case-study styles. |
| `projects/projectsearch-demo.js` | Four-record search demonstration on the ProjectSearch page. |
| `assets/projects/`, `assets/photography/`, `assets/profile/` | Imagery, each with AVIF + JPEG derivatives at two widths. |
| `assets/og-image.jpg`, `assets/og/` | Social cards — one for the site, one per case study (generated). |
| `assets/fallback-tower.svg` | Flat elevation shown when WebGL is unavailable (generated). |
| `assets/favicon.svg` | Icon (generated). |
| `tools/` | Regeneration scripts — see below. |
| `docs/projectsearch-sync.md` | Notes on what the ProjectSearch section was sourced from. |

## Regenerating assets

```sh
./tools/build-images.sh          # AVIF + JPEG derivatives for every image
python3 tools/fetch-fonts.py     # re-download the IBM Plex latin subset
python3 tools/make-og-image.py   # rebuild every 1200x630 Open Graph card
python3 tools/make-fallback-tower.py  # rebuild the no-WebGL elevation
python3 tools/build-sitemap.py   # rebuild sitemap.xml from pages on disk
```

`tools/update-project-pages.py` and `tools/simplify-project-css.py` were one-off
migrations; they are kept for reference and are safe no-ops now.

## Guided chapters

The tower rises through six selectable milestones:

1. Education
2. ProjectSearch
3. Experience
4. Projects
5. Photography
6. Skills

Hash routes such as `#projects` and `#photography` open a chapter directly, so
links from the case-study pages land in the right place. Moving between chapters
pushes history, so Back and Forward step through chapters rather than leaving the
site.

### Resuming after a case study

Clicking through to a case study is a real navigation, so Back reloads the
homepage from scratch. A snapshot in `sessionStorage` (`tg.portfolio.v1`) is what
lets it come back to the same tower rather than a finished one: build stage,
which markers are unlocked and which have been read, the open chapter, its scroll
offset, and the selected ProjectSearch query. The opening curtain is skipped on a
resumed load.

The rules that fall out of it:

- **Back from a case study** restores the build exactly where it was — mid-build
  stays mid-build, with *Continue construction* still waiting.
- **A lift still animating** when the reader left counts as finished, rather than
  replaying a camera move they already watched.
- **"All projects" from a case study** asks for `#projects`, which may be past
  the current lift. That is a deliberate jump, not a resume, so it tops the tower
  out as it always did — the same as any shared `#hash` link.
- **Home / Back to the start** clears the snapshot; starting over means being
  forgotten.
- `sessionStorage`, not `localStorage`: the memory lasts exactly as long as the
  tab, so a visitor returning tomorrow still breaks ground.

**Home** in the top bar (and *Back to the start*) returns to the title card and
resets the build. **Skip the build** on the title card jumps straight to the
topped-out view with every chapter unlocked, for readers who don't want to play
through the sequence. Once topped out, chapters page with the panel buttons or
the left/right arrow keys.

## Design and accessibility

- IBM Plex Sans and IBM Plex Mono, self-hosted, latin subset only.
- Warm paper, drafting-blue, and nature-green palette. **Light mode only** —
  there is no dark theme and no theme switch anywhere on the site.
- 11px type floor. Body copy in the chapter panels is 14px.
- Every image ships AVIF and JPEG at two widths with `srcset`/`sizes`, and
  carries intrinsic `width`/`height` so nothing shifts as it loads.
- Keyboard-accessible milestones; locked chapters are genuinely `disabled`
  rather than just unclickable.
- Escape closes a panel, focus returns to where it came from, and a polite live
  region announces build progress.
- `prefers-reduced-motion` skips the build sequence entirely and lands on the
  finished tower instead of playing a long camera move.
- The build narration is on screen as well as in the live region — the same
  sentence, with the visible copy `aria-hidden` so it is not announced twice.
- The chapter rail marks the open chapter with `aria-current`.
- three.js is imported on idle rather than up front. Nothing of the model is
  visible behind the opaque title card, so 670 KB used to be spent before the
  reader had decided they wanted it. If it never arrives — no WebGL, a blocked
  CDN-free vendor file, a six-second timeout — the scene layer shows
  `assets/fallback-tower.svg`, a flat elevation of the same building, so the
  fallback reads as a decision rather than a failure.
- Scrolling the title card scrolls the title card. The build only starts once
  the card has been read to the end, which matters on phones where it overflows.
- Case-study pages have a print stylesheet.

## Content and privacy notes

- Biography, education, experience, skills, and project claims are grounded in
  the included resume and documented case studies.
- The two Green Infrastructure Partners co-op terms are grouped under one
  employer heading with sequential dates, since GIP is the same company in both.
- The EIT credential is unconfirmed and intentionally omitted.
- **Scope figures added to the experience and case studies are estimates, not
  records.** See [docs/scope-figures.md](docs/scope-figures.md) for the list that
  still needs confirming, along with the LinkedIn URL and the Singapore exchange
  host institution.
- Photography originals remain in Google Drive; the site serves downsized
  derivatives with EXIF metadata removed.
- Employer/client field photographs and performance plots still require the
  appropriate release before public deployment. Existing project images remain
  anonymized or illustrative where noted.
- The residence redevelopment poster is explicitly team-attributed. ProjectSearch
  is described conservatively as being evaluated for engineering workflows, and
  its on-page search is labelled as a four-record demonstration rather than the
  deployed index.
- The Travers Solar case study combines the former capacity-testing and
  PV-temperature pages and cites the co-authored paper in *Processes* 2026,
  14(7), 1078. Quoted metrics are the archived analysis outputs; the published
  article remains the citable record.
- `uploads/` holds working source material and is git-ignored — it is not part of
  the published site.

## Deployment

See [docs/deploy.md](docs/deploy.md).
