const PROJECTS = [
  {
    group: 'featured', filters: ['software'], year: '2026',
    eyebrow: 'Software · Solar research', title: 'Automated Solar Capacity Testing',
    description: 'Python workflow for ASTM E2848 capacity testing, combining physical operating filters, rolling stability checks, and anomaly detection.',
    facts: ['11,520 records', '780 retained', 'ASTM E2848'],
    tags: ['Python', 'SCADA', 'Isolation Forest'],
    image: './assets/projects/solar-capacity-selection.jpg',
    imageAlt: 'RC197 operating-point subset highlighted within the filtered solar capacity-testing dataset',
    sourceLabel: 'Analysis output',
    href: './projects/solar-capacity-testing.html',
    status: 'Research case study'
  },
  {
    group: 'featured', filters: ['software'], year: '2026',
    eyebrow: 'Machine learning · Energy', title: 'PV Temperature Residual Learning',
    description: 'A physical temperature baseline paired with gradient-boosted residual learning and leave-one-day-out validation.',
    facts: ['3,077 test rows', '1.96°C MAE', 'R² 0.921'],
    tags: ['Python', 'Gradient boosting', 'Feature engineering'],
    image: './assets/projects/pv-temperature-parity.jpg',
    imageAlt: 'Measured versus predicted PV module temperatures for baseline and residual models',
    href: './projects/pv-temperature-residual-learning.html',
    status: 'Validated model'
  },
  {
    group: 'featured', filters: ['building'], year: '2026',
    eyebrow: 'Building science', title: 'Envelope Thermal-Bridge Studies',
    description: '2D Flixo studies of roof-to-wall and balcony-slab junctions across existing, partial, interior, and exterior insulation scenarios.',
    facts: ['2 junction families', 'Multiple scenarios', '2D heat flow'],
    tags: ['Flixo', 'Ubakus', 'Envelope design'],
    image: './assets/projects/thermal-bridge-full.jpg',
    imageAlt: 'Flixo roof-to-wall junction model with insulation and structural layers',
    href: './projects/envelope-thermal-bridge-studies.html',
    status: 'Anonymized client work'
  },
  {
    group: 'featured', filters: ['field'], year: '2025',
    eyebrow: 'Field · Transit infrastructure', title: 'Deep Foundations & Support of Excavation',
    description: 'Construction coordination for diaphragm walls, caissons, soldier-pile-and-lagging systems, testing, slurry operations, and tremie concrete.',
    facts: ['Deep foundations', 'SOE systems', 'Field coordination'],
    tags: ['SOE', 'RFIs / RFQs', 'As-builts'],
    image: './assets/projects/deep-foundations-pape.jpg',
    imageAlt: 'Excavation and concrete support-wall detail photographed during foundation work at Pape Station in Toronto',
    sourceLabel: 'Pape Station field photo',
    href: './projects/deep-foundations-soe.html',
    status: 'Infrastructure delivery'
  },
  {
    group: 'featured', filters: ['field'], year: '2024–25',
    eyebrow: 'Transportation · Field + design', title: 'Highway Design & Pavement QC',
    description: 'Civil 3D design support for two highway redesigns plus field and laboratory quality control on Superpave and CIREAM work.',
    facts: ['2 highways', 'Field + laboratory', 'CIREAM / Superpave'],
    tags: ['Civil 3D', 'AASHTO T283', 'Marshall'],
    image: './assets/projects/highway-design-qc.jpg',
    imageAlt: 'Thomas Gao beside a newly placed asphalt lift during highway paving work',
    href: './projects/highway-design-pavement-qc.html',
    status: 'Transportation delivery'
  },
  {
    group: 'academic', filters: ['academic', 'building'], year: '2025',
    eyebrow: 'Academic · Site design', title: 'Residence Site Redevelopment',
    description: 'Civil 3D grading and site-design leadership for a student-residence concept, with research contributions to the final team poster.',
    facts: ['Civil 3D lead', 'Final DWG', 'Team poster'],
    tags: ['Grading', 'Site planning', 'Accessibility'],
    image: './assets/projects/residence-site-poster.jpg',
    imageAlt: 'Final residence redevelopment poster with site analysis, building render, and proposed plan',
    href: './projects/residence-site-redevelopment.html',
    status: 'Documented team role'
  },
  {
    group: 'academic', filters: ['academic', 'software'], year: '2026',
    eyebrow: 'Academic · GIS', title: 'Grand River Watershed Analysis',
    description: 'ArcGIS Pro workflow using a 30 m DEM, D8 flow processing, stream extraction, basin delineation, land use, soils, and drainage density.',
    facts: ['30 m DEM', 'D8 workflow', 'UTM 17N'],
    tags: ['ArcGIS Pro', 'Hydrology', 'Terrain'],
    image: './assets/projects/grand-river-subwatersheds.jpg',
    imageAlt: 'Map of the Grand River watershed and its color-coded subwatersheds',
    href: './projects/grand-river-watershed-analysis.html',
    status: 'Academic analysis'
  },
  {
    group: 'academic', filters: ['academic', 'software'], year: '2025',
    eyebrow: 'Academic · Geotechnical', title: 'Soil Characterization in MATLAB',
    description: 'Semilog liquid-limit regression paired with spreadsheet sieve analysis across standard sieve sizes.',
    facts: ['63 mm → 75 μm', 'Flow curve', 'Sieve analysis'],
    tags: ['MATLAB', 'Regression', 'Atterberg limits'],
    image: './assets/projects/soil-characterization-matlab.jpg',
    imageAlt: 'Thomas Gao authored MATLAB code for a liquid-limit semilog regression',
    href: './projects/soil-characterization-matlab.html',
    status: 'Laboratory analysis'
  },
  {
    group: 'tools', filters: ['software'], year: '2026',
    eyebrow: 'Software · Knowledge systems', title: 'Engineering Retrieval & Report-Drafting Prototype',
    description: 'A deployed, citation-first RAG service for engineering documents and CAD metadata, built on Vertex AI and containerized for Google Cloud.',
    facts: ['Vertex AI', 'Dockerized', 'Google Cloud'],
    tags: ['RAG', 'Vertex AI', 'Docker'],
    image: './assets/projects/rag-retrieve-generate.jpg',
    imageAlt: 'Project-authored slide showing the RAG workflow from connecting source files through retrieval to cited generation',
    sourceLabel: 'Project-authored slide',
    href: './projects/engineering-retrieval-prototype.html',
    status: 'Deployed prototype'
  }
];

const GROUPS = [
  { id: 'featured', index: '04.1', title: 'Flagship case studies', copy: 'Five projects where field judgment, analysis, and software meet measurable engineering work.' },
  { id: 'academic', index: '04.2', title: 'Academic & design', copy: 'Course and team work backed by drawings, models, maps, code, and documented roles.' },
  { id: 'tools', index: '04.3', title: 'Deployed engineering software', copy: 'A working knowledge system built, containerized, and deployed around real engineering-document workflows.' }
];

const FILTERS = [
  ['all', 'All', 9], ['field', 'Field', 2], ['building', 'Building', 2],
  ['software', 'Software', 5], ['academic', 'Academic', 3]
];

const escapeAttr = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function renderCard(project) {
  const filters = project.filters.join(' ');
  const facts = project.facts.map(fact => `<span>${escapeAttr(fact)}</span>`).join('');
  const tags = project.tags.map(tag => `<span>${escapeAttr(tag)}</span>`).join('');
  return `
    <article class="card" data-project-card data-project-category="${filters}">
      <a class="card-link" href="${escapeAttr(project.href)}" aria-label="View ${escapeAttr(project.title)} case study">
        <div class="media">
          <img src="${escapeAttr(project.image)}" alt="${escapeAttr(project.imageAlt)}" loading="lazy" decoding="async" />
          <span class="media-label">${escapeAttr(project.sourceLabel || 'Project source')}</span>
        </div>
        <div class="body">
          <div class="meta"><span>${escapeAttr(project.eyebrow)}</span><span>${escapeAttr(project.year)}</span></div>
          <h4>${escapeAttr(project.title)}</h4>
          <p class="description">${escapeAttr(project.description)}</p>
          <div class="facts">${facts}</div>
          <div class="tags">${tags}</div>
          <div class="foot">
            <span class="status"><i></i>${escapeAttr(project.status)}</span>
            <span class="cta">View project <b aria-hidden="true">↗</b></span>
          </div>
        </div>
      </a>
    </article>`;
}

class ProjectCards extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = 'true';
    const toolbar = FILTERS.map(([id, label, count], index) =>
      `<button type="button" data-filter="${id}" aria-pressed="${index === 0 ? 'true' : 'false'}">${label}<span>${count}</span></button>`
    ).join('');
    const groups = GROUPS.map(group => {
      const cards = PROJECTS.filter(project => project.group === group.id).map(renderCard).join('');
      return `
        <section class="project-group" data-group="${group.id}">
          <header><div><span>${group.index}</span><h3>${group.title}</h3></div><p>${group.copy}</p></header>
          <div class="grid">${cards}</div>
        </section>`;
    }).join('');

    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        :host{display:block;color:var(--fg);font-family:var(--sans)}
        *{box-sizing:border-box}
        button{font:inherit}
        .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 clamp(38px,6vw,68px);padding-bottom:18px;border-bottom:1px solid var(--line)}
        .toolbar button{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:color-mix(in oklab,var(--bg) 62%,transparent);color:var(--muted);padding:10px 13px;cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;transition:background .2s ease,color .2s ease,border-color .2s ease;backdrop-filter:blur(3px)}
        .toolbar button span{opacity:.72}
        .toolbar button:hover,.toolbar button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:color-mix(in oklab,var(--accent) 8%,var(--bg))}
        .toolbar button:focus-visible,.card-link:focus-visible{outline:3px solid color-mix(in oklab,var(--accent) 60%,transparent);outline-offset:3px}
        .project-group{display:grid;gap:clamp(20px,3vw,34px);margin-bottom:clamp(58px,9vw,108px)}
        .project-group:last-child{margin-bottom:0}
        .project-group>header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:18px;padding-top:16px;border-top:2px solid var(--accent)}
        .project-group>header>div{display:flex;align-items:baseline;gap:14px}
        .project-group>header span{font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--accent)}
        .project-group h3{margin:0;font-size:clamp(22px,3vw,36px);font-weight:600;letter-spacing:-.025em}
        .project-group>header p{margin:0;max-width:520px;color:var(--muted);font-size:14px;line-height:1.55}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(16px,2.2vw,26px);align-items:stretch}
        .project-group[data-group="tools"] .grid{grid-template-columns:minmax(min(100%,300px),620px)}
        .card{border:1px solid var(--line);background:color-mix(in oklab,var(--panel) 78%,transparent);backdrop-filter:blur(3px);min-width:0;transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}
        .card:hover{transform:translateY(-4px);border-color:color-mix(in oklab,var(--accent) 56%,var(--line));box-shadow:0 14px 32px color-mix(in oklab,var(--fg) 8%,transparent)}
        .card[hidden],.project-group[hidden]{display:none}
        .card-link{display:flex;flex-direction:column;height:100%;color:inherit;text-decoration:none}
        .media{position:relative;aspect-ratio:16/10;overflow:hidden;border-bottom:1px solid var(--line);background:color-mix(in oklab,var(--bg) 90%,var(--panel))}
        .media img{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(.9) contrast(.98);transition:transform .45s cubic-bezier(.2,.7,.2,1),filter .25s ease}
        .card:hover .media img{transform:scale(1.025);filter:saturate(1) contrast(1)}
        .media-label{position:absolute;right:10px;bottom:10px;background:color-mix(in oklab,var(--bg) 76%,transparent);border:1px solid var(--line);padding:5px 7px;color:var(--muted);font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;backdrop-filter:blur(6px)}
        .body{display:grid;gap:14px;padding:clamp(18px,2.2vw,27px);flex:1}
        .meta{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase}
        .meta span:first-child{color:var(--accent)}
        h4{margin:0;font-size:clamp(20px,2vw,27px);font-weight:600;letter-spacing:-.018em;line-height:1.1}
        .description{margin:0;color:var(--muted);font-size:14.5px;line-height:1.62}
        .facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line)}
        .facts span{padding:9px 8px;color:var(--fg);font-family:var(--mono);font-size:9px;line-height:1.4;text-align:center;text-transform:uppercase;letter-spacing:.06em;border-right:1px solid var(--line)}
        .facts span:last-child{border-right:0}
        .tags{display:flex;flex-wrap:wrap;gap:6px}
        .tags span{padding:5px 8px;border:1px solid var(--line);color:var(--muted);font-family:var(--mono);font-size:9.5px}
        .foot{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:auto;padding-top:13px;border-top:1px solid var(--line)}
        .status{display:flex;align-items:center;gap:8px;color:var(--muted);font-family:var(--mono);font-size:8.5px;letter-spacing:.09em;text-transform:uppercase}
        .status i{display:block;width:6px;height:6px;background:var(--accent);flex:0 0 auto}
        .cta{white-space:nowrap;color:var(--accent);font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase}
        .cta b{display:inline-block;font-size:12px;font-weight:400;transition:transform .2s ease}
        .card:hover .cta b{transform:translate(2px,-2px)}
        @media(max-width:560px){.facts{grid-template-columns:1fr}.facts span{border-right:0;border-bottom:1px solid var(--line);text-align:left}.facts span:last-child{border-bottom:0}.media-label{display:none}}
        @media(prefers-reduced-motion:reduce){.card,.toolbar button,.media img,.cta b{transition:none!important}.card:hover{transform:none}.card:hover .media img{transform:none}}
      </style>
      <div class="toolbar" role="toolbar" aria-label="Filter projects">${toolbar}</div>
      ${groups}`;

    this.shadowRoot.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => this.filter(button.dataset.filter));
    });
  }

  filter(category) {
    const cards = [...this.shadowRoot.querySelectorAll('[data-project-card]')];
    cards.forEach(card => {
      const categories = card.dataset.projectCategory.split(' ');
      card.hidden = category !== 'all' && !categories.includes(category);
    });
    this.shadowRoot.querySelectorAll('[data-filter]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === category));
    });
    this.shadowRoot.querySelectorAll('[data-group]').forEach(group => {
      group.hidden = ![...group.querySelectorAll('[data-project-card]')].some(card => !card.hidden);
    });
  }
}

customElements.define('project-cards', ProjectCards);
