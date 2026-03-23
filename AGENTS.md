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

### Notes

- There are no automated tests, linters, or build scripts in this repo. Validation is manual via the browser.
- The `encounters-data-analysis/` folder contains only design/documentation markdown files — no executable code.
