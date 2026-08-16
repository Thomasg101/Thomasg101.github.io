# Thomas Gao — Civil Engineering Portfolio

An interactive portfolio for a University of Waterloo civil engineering student working between field practice and software. The current site promotes the guided construction design from `portfolio-design/` and fills it with resume-backed experience, project case studies, and Thomas's photography.

## Run locally

Open `Thomas Gao - Portfolio.dc.html` directly, or serve the folder for the most reliable browser behaviour:

```sh
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/Thomas%20Gao%20-%20Portfolio.dc.html`.

The page loads Google Fonts, React, Babel, and Three.js from pinned web URLs. If the 3D scene cannot load, the guided portfolio still becomes available through its built-in fallback.

## Main files

| Path | Purpose |
| --- | --- |
| `Thomas Gao - Portfolio.dc.html` | Main guided single-page portfolio. |
| `building-scene.js` | Three.js construction sequence and milestone markers. |
| `support.js` | Shared x-dc page runtime. |
| `projects/` | Nine standalone project case studies, plus two redirect stubs for the merged solar URLs. |
| `projects/projectsearch-demo.js` | Four-record search demonstration on the ProjectSearch case page. |
| `assets/projects/` | Project imagery, plots, maps, diagrams, and team-attributed work. |
| `assets/profile/` | Edited hero portrait and optimized web derivative. |
| `assets/photography/` | Five optimized, metadata-free portfolio photographs. |
| `Thomas-Gao-Resume.pdf` | Resume linked from the site. |
| `portfolio-design/` | Original dropped design retained as the source reference. |
| `legacy-portfolio/` | Previous root homepage and scene, retained for recovery. |

## Guided chapters

The tower rises through six selectable milestones:

1. Education
2. ProjectSearch
3. Experience
4. Projects
5. Photography
6. Skills

The final topped-out view links to email, GitHub, and the resume. Hash routes such as `#projects` and `#photography` open a chapter directly, so links from the case-study pages return to the correct view.

A **Home** control in the top bar (and *Back to the start* in the topped-out view) returns to the title card and resets the site so the build can be replayed. Once topped out, an open chapter can be paged with the panel's previous/next buttons or the left and right arrow keys.

## Design and accessibility

- IBM Plex Sans and IBM Plex Mono with a warm paper, drafting-blue, and nature-green palette.
- Light, dark, and automatic themes with a persistent preference.
- Responsive desktop and mobile layouts, keyboard-accessible milestone controls, Escape-to-close panels, focus return, semantic dialog state, descriptive image text, and reduced-motion handling.
- The hero portrait uses the provided headshot with restrained editorial cleanup and a grass/nature foreground confined to the lower portion of the composition.

## Content and privacy notes

- Biography, education, experience, skills, and project claims are grounded in the included resume and documented case studies.
- The unresolved placeholder LinkedIn profile and unconfirmed EIT credential are intentionally omitted.
- Photography originals remain in Google Drive; the site uses downsized JPEG derivatives with EXIF metadata removed.
- Employer/client field photographs and performance plots still require the appropriate release before public deployment. Existing project images remain anonymized or illustrative where noted.
- The residence redevelopment poster remains explicitly team-attributed. ProjectSearch is described conservatively as being evaluated for engineering workflows, and its on-page search is labelled as a four-record demonstration rather than the deployed index.
- The Travers Solar case study combines the former capacity-testing and PV-temperature pages and cites the co-authored paper in *Processes* 2026, 14(7), 1078. Quoted metrics are the archived analysis outputs; the published article remains the citable record.
