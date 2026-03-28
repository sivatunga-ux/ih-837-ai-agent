import { APP_NAME } from "../data/constants.js";
import { PRO_SAMPLES } from "../data/samples.js";
import { summarize, validate837 } from "../rules/validation.js";
import { getAdvisoryRecommendations } from "../agent/advisory.js";

const appNameEl = document.getElementById("appName");
const inputEl = document.getElementById("claimInput");
const outputEl = document.getElementById("resultOutput");
const advisoriesEl = document.getElementById("advisoryOutput");
const runBtn = document.getElementById("runValidation");
const loadBtn = document.getElementById("loadSample");

if (appNameEl) appNameEl.textContent = APP_NAME;

function renderResult(payload) {
  const lines = [
    `Member ID: ${payload.memberId || "UNKNOWN"}`,
    `Status: ${payload.summary.status}`,
    `Fatal: ${payload.summary.fatal}`,
    `RA blocks: ${payload.summary.raBlocks}`,
    `Warnings: ${payload.summary.warns}`,
    "",
    "Findings:"
  ];

  payload.findings.forEach((finding, index) => {
    lines.push(
      `${index + 1}. [${finding.level}] ${finding.code} - ${finding.msg}`
    );
  });

  outputEl.textContent = lines.join("\n");
}

function renderAdvisories(findings) {
  const recommendations = getAdvisoryRecommendations(findings);
  if (!recommendations.length) {
    advisoriesEl.textContent = "No advisory recommendations.";
    return;
  }

  advisoriesEl.textContent = recommendations
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

runBtn.addEventListener("click", () => {
  const input = inputEl.value.trim();
  if (!input) {
    outputEl.textContent = "Paste claim text before running validation.";
    advisoriesEl.textContent = "No advisory recommendations.";
    return;
  }

  const result = validate837(input);
  const summary = summarize(result.findings);
  renderResult({
    ...result,
    summary
  });
  renderAdvisories(result.findings);
});

loadBtn.addEventListener("click", () => {
  inputEl.value = PRO_SAMPLES[0].text;
});
