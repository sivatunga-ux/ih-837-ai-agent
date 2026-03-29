# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is the **Invent Health 837 Risk Analyzer** — a client-side-only demo web app for healthcare 837 encounter claim validation and risk adjustment workflows. All state is stored in the browser's `localStorage`; there is no backend, database, or build step.

### Technology

- Vanilla JavaScript with native ES modules (`<script type="module">`)
- No package manager, no `node_modules`, no bundler, no transpiler
- No lint or test tooling is configured in the repo

### Running the app

The app must be served over HTTP (not `file://`) because it uses ES module imports. Start any static file server on port **5501** (the port configured in `.vscode/settings.json`):

```sh
python3 -m http.server 5501 --directory /workspace
```

Then open `http://localhost:5501/Index.html` in a browser.

### Hello-world smoke test

1. Click **Load Pro Samples** then **Load Inst Samples** on the 837 Ingestion page.
2. Click **Run Validation** — KPIs (Runs, Errors Fixed, RA Blocks) should update.
3. Click **Create Work Actions** — navigates to the Workqueue with created actions.

### Claims Search prototype

A standalone app in `claims-search/`. Access at `http://localhost:5501/claims-search/index.html` (same static server as main app). It imports `searchConfig.js`, `searchEngine.js`, and `sampleData.js` as ES modules. The app auto-generates 250 deterministic sample claims at load time and renders a three-column search UI (search panel / results table / detail panel).

### Encounter Analytics standalone module

A standalone ES module suite in `encounter-analytics/`. Three files — no dependency on the main app:

- `sampleClaims.js` — 500 deterministic sample claims (seeded PRNG) with valid NPIs, MBIs, EINs
- `pipeline.js` — 6-agent 837P pipeline (ingest → map → validate → template → generate → output-validate)
- `analyticsEngine.js` — 10 analytics/aggregation functions over pipeline results

Test all three via Node.js (no browser needed):

```sh
node --input-type=module -e "
  import { SAMPLE_CLAIMS } from './encounter-analytics/sampleClaims.js';
  import { runPipeline } from './encounter-analytics/pipeline.js';
  import { getMonthlyTrend } from './encounter-analytics/analyticsEngine.js';
  const r = runPipeline(SAMPLE_CLAIMS);
  console.log(r.summary);
  console.log(getMonthlyTrend(r));
"
```

### Notes

- There are no automated tests, linters, or build scripts in this repo. Validation is manual via the browser.
- The `encounters-data-analysis/` folder contains only design/documentation markdown files — no executable code.
