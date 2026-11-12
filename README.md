# Thomas Gao — Portfolio

A portfolio for a University of Waterloo civil engineering student working across
structural analysis, building envelope, and software for engineering teams.

The homepage draws one building in WebGL and reads it three ways as you scroll:
as a frame on its foundations (structure), as an exterior thermogram (envelope),
and as a wireframe and point cloud with photo pins (code). The resume content
follows on a plain surface, and nine standalone case-study pages sit behind it.

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
| `index.html` | Homepage. All content is real HTML and reads as a document with JavaScript or WebGL off. |
| `assets/css/site.css` | Homepage styles. The palette and type decisions are documented at the top. |
| `assets/css/fonts.css` | Self-hosted Archivo (variable) and IBM Plex Mono (generated). |
| `assets/js/main.js` | Page controller: maps scroll position to the model, wires the three controls. |
| `assets/js/scene.js` | The Three.js building: geometry, the single shader, camera. Knows nothing about the page. |
| `assets/js/vendor/three.module.min.js` | Vendored Three.js 0.160.0. |
| `projects/` | Nine case studies plus two redirect stubs for the merged solar URLs. |
| `projects/project-detail.css` | Shared case-study styles, on the homepage palette. |
| `projects/projectsearch-demo.js` | Four-record search demonstration on the ProjectSearch page. |
| `assets/projects/`, `assets/photography/`, `assets/profile/` | Imagery, each with AVIF + JPEG derivatives at two widths. |
| `assets/og-image.jpg`, `assets/og/` | Social cards: one for the site, one per case study (generated). |
| `assets/favicon.svg`, `favicon.ico` | Wide-flange section mark (generated). |
| `tools/` | Regeneration scripts, see below. |
| `docs/projectsearch-sync.md` | Notes on what the ProjectSearch section was sourced from. |

## Regenerating assets

```sh
./tools/build-images.sh          # AVIF + JPEG derivatives for every image
python3 tools/fetch-fonts.py     # re-download Archivo + Plex Mono, latin subset
python3 tools/make-og-image.py   # rebuild every 1200x630 Open Graph card
python3 tools/build-sitemap.py   # rebuild sitemap.xml from pages on disk
```

`tools/update-project-pages.py` and `tools/simplify-project-css.py` were one-off
migrations; they are kept for reference and are safe no-ops now.

## How the homepage works

The page is an ordinary scrolling document; scrolling is never taken over and
nothing is gated behind an animation. Each section carries a `data-scene`
name, and `main.js` holds one preset per name (camera, cladding on or off,
foundations, thermal view, dissolve, ground colour). Between two sections the
presets are blended by scroll position, so the reader sets the pace.

| Section | `data-scene` | What the model does |
| --- | --- | --- |
| Hero | `hero` | Complete building. The only timed animation on the site: a 1.5 s assembly on load. |
| Structure | `structure` | Cladding flies off; caissons, pile caps and shoring grow down. Slider applies lateral drift. |
| Envelope | `envelope` | Cladding returns and a thermogram sweeps up it. Switch toggles as-built / retrofit. |
| Code | `code` | Solid dissolves to outlines and points. Query chips select a photo pin. |
| Work, experience, education, photos | `cover` | Opaque surface over the model; rendering pauses while it is covered. |
| Contact | `contact` | The building reassembles in daylight. |

- **Wide screens (900 px and up):** the model fills the window behind the text
  and sits right of the text column. Text fades near the top and bottom of the
  window so the ground can change colour with nothing on it.
- **Narrow screens:** the model is pinned to the top 44% of the screen and the
  text scrolls beneath it, so the controls and the thing they control are
  always visible together. Dragging the model sideways turns it.
- Anchors `#structure`, `#envelope`, `#code`, `#projects`, `#experience`,
  `#education`, `#skills`, `#photography`, `#projectsearch` and `#contact` all
  resolve, so links from the case-study pages land in the right place.
- The thermal and drift views are labelled on the page as illustrative. They
  are a drawing of the idea, not analysis output.

## Design and accessibility

- Archivo (one variable file, set wide for headings) and IBM Plex Mono for the
  search query only. Self-hosted, latin subset.
- Palette: concrete, paper, graphite, red oxide by day; night, the infrared
  ramp and a pale phosphor blue for the thermal and data readings.
- Every image ships AVIF and JPEG with intrinsic `width`/`height`.
- All controls are native elements (range input, radio group, buttons) with
  visible focus; the retrofit note and search result are live regions.
- The model and its labels are `aria-hidden`; the same facts are in the text.
- `prefers-reduced-motion` skips the opening assembly, the idle camera drift
  and the point twinkle, and snaps between states instead of easing.
- Without WebGL or JavaScript the sections fall back to solid grounds and the
  page reads top to bottom.
- Case-study pages have a print stylesheet; the homepage prints as text.

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
