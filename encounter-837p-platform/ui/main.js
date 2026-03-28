import { APP_NAME } from "../data/constants.js";
import { SAMPLE_ENCOUNTERS } from "../data/samples.js";
import { validate837 } from "../rules/validation.js";
import { summarizeFindingsForCoder } from "../agent/advisory.js";

const appNameEl = document.getElementById("appName");
const inputEl = document.getElementById("encounterInput");
const outputEl = document.getElementById("findingsOutput");
const advisoriesEl = document.getElementById("advisoryOutput");
const runBtn = document.getElementById("validate");
const loadBtn = document.getElementById("loadSample");

if (appNameEl) appNameEl.textContent = APP_NAME;

function renderResult(payload) {
  if (!outputEl) return;
  const lines = [
    `Findings: ${payload.findings.length}`,
    ""
  ];

  if (!payload.findings.length) {
    lines.push("No deterministic findings.");
  } else {
    payload.findings.forEach((finding, index) => {
      lines.push(
        `${index + 1}. [${finding.level}] ${finding.code} - ${finding.msg}`
      );
    });
  }

  outputEl.textContent = lines.join("\n");
}

function renderAdvisories(findings) {
  if (!advisoriesEl) return;
  const advisory = summarizeFindingsForCoder({ findings });
  if (!advisory) {
    advisoriesEl.textContent = "No advisory recommendations.";
    return;
  }

  advisoriesEl.textContent = [
    `Severity: ${advisory.severity}`,
    `Recommendation: ${advisory.recommendation}`,
    `Rationale: ${advisory.rationale}`,
  ].join("\n");
}

if (runBtn && inputEl) {
  runBtn.addEventListener("click", () => {
  const input = inputEl.value.trim();
  if (!input) {
    if (outputEl) outputEl.textContent = "Paste claim text before running validation.";
    if (advisoriesEl) advisoriesEl.textContent = "No advisory recommendations.";
    return;
  }

  const result = validate837(input);
  renderResult(result);
  renderAdvisories(result.findings);
});
}

if (loadBtn && inputEl) {
  loadBtn.addEventListener("click", () => {
    inputEl.value = SAMPLE_ENCOUNTERS[0]?.text ?? "";
  });
}
