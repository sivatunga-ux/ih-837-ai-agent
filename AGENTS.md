## Cursor Cloud specific instructions

### Overview

This is the **Invent Health 837 Risk Analyzer** — a purely static, client-side-only web application. There is no backend, no database, no package manager, no build step, and no dependencies to install. All state lives in browser `localStorage`.

### Running the application

Serve the project root over HTTP (ES Modules require HTTP; `file://` will not work):

```bash
python3 -m http.server 5501
```

Then open `http://localhost:5501/Index.html` in Chrome.

The `.vscode/settings.json` configures VS Code Live Server on port **5501** — match that port for consistency.

### Lint / Test / Build

- **No linter, test framework, or build system is configured.** The project is vanilla JS served directly by the browser.
- To verify correctness, open the browser DevTools console and check for runtime errors while exercising the UI.

### Quick smoke test

1. Open the app in Chrome at `http://localhost:5501/Index.html`.
2. Click **Load Pro Samples** then **Load Inst Samples**.
3. Click **Run Validation** — KPI counters should update and the Runs page should show results.
4. Click **Create Work Actions** — the Workqueue should populate with action items.

### Key caveats

- The `encounters-data-analysis/` subdirectory contains only planning/specification markdown files — no executable code.
- All integrations (Slack, Teams, Jira) are **simulated** — they generate JSON payloads but never make real API calls.
- Clicking "Reset Demo" in the sidebar clears all `localStorage` data and resets the app to its initial state.
