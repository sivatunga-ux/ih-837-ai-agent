# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
This is a **client-side only** static web application (vanilla HTML/CSS/JS with ES modules). There is no backend, no database, no `package.json`, no build step, and no npm dependencies. All state is persisted in the browser's `localStorage`.

### Running the dev server
The app uses ES module `import` syntax (`type="module"`), so it **must** be served over HTTP — opening `Index.html` via `file://` will fail with CORS errors. Start a static file server from the repo root:

```
npx serve . -l 5501
```

The app will be available at `http://localhost:5501/`.

### Lint / Test / Build
- **No linter, test framework, or build system** exists in this project. There are no automated tests to run.
- Validation is done manually by loading sample 837 files and running the validation workflow in the browser.

### Key demo workflow (hello-world test)
1. Open `http://localhost:5501/` in a browser.
2. Click **Load Pro Samples** and/or **Load Inst Samples** to load sample 837 EDI files.
3. Click **Run Validation** to process the loaded files.
4. Click **Create Work Actions** to generate workflow actions from validation findings.
5. Navigate to **Workqueue**, **Runs**, **Reports**, and **Audit** tabs to verify full functionality.
6. Use **Reset Demo** (sidebar bottom) to clear all `localStorage` data and start fresh.

### Gotchas
- The `.vscode/settings.json` configures VS Code Live Server on port 5501; `npx serve` on the same port provides equivalent behavior outside VS Code.
- The logo image loads from an external URL (`inventhealth.com`); if the network is unavailable the app still works, just without the logo.
