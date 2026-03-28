import { APP_NAME } from "../data/constants.js";
import { SAMPLE_ENCOUNTERS } from "../data/samples.js";
import { validate837 } from "../rules/validation.js";
import { summarizeFindingsForCoder } from "../agent/advisory.js";
import { buildReviewModel } from "./review.js";

const appNameEl = document.getElementById("appName");
const inputEl = document.getElementById("encounterInput");
const outputEl = document.getElementById("findingsOutput");
const advisoriesEl = document.getElementById("advisoryOutput");
const runBtn = document.getElementById("validate");
const loadBtn = document.getElementById("loadSample");
const reviewSummaryEl = document.getElementById("reviewSummary");
const reviewPartiesEl = document.getElementById("reviewParties");
const reviewClaimEl = document.getElementById("reviewClaim");
const reviewLinesEl = document.getElementById("reviewLines");

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

function toName(value) {
  if (!value) return "N/A";
  return [value.first, value.last].filter(Boolean).join(" ") || value.last || "N/A";
}

function renderReview(rawText) {
  const model = buildReviewModel(rawText);

  if (reviewSummaryEl) {
    reviewSummaryEl.innerHTML = [
      `<span class="review-chip">Segments: ${model.totalSegments}</span>`,
      `<span class="review-chip">Service lines: ${model.claim.serviceLines.length}</span>`,
      `<span class="review-chip">Claim total: ${model.claim.totalCharge || "N/A"}</span>`,
      `<span class="review-chip">Computed lines total: ${model.claim.computedLineTotal.toFixed(2)}</span>`,
    ].join("");
  }

  if (reviewPartiesEl) {
    reviewPartiesEl.textContent = [
      `Submitter: ${toName(model.submitter)} (${model.submitter?.id || "N/A"})`,
      `Receiver: ${toName(model.receiver)} (${model.receiver?.id || "N/A"})`,
      `Billing provider: ${toName(model.billingProvider)} (${model.billingProvider?.id || "N/A"})`,
      `Subscriber: ${toName(model.subscriber)} (${model.subscriber?.id || "N/A"})`,
      `Patient: ${toName(model.patient)} (${model.patient?.id || "N/A"})`,
      `Payer: ${toName(model.payer)} (${model.payer?.id || "N/A"})`,
    ].join("\n");
  }

  if (reviewClaimEl) {
    reviewClaimEl.textContent = [
      `Claim ID: ${model.claim.claimId || "N/A"}`,
      `Total charge: ${model.claim.totalCharge || "N/A"}`,
      `Place of service: ${model.claim.placeOfService || "N/A"}`,
      `Clearinghouse trace: ${model.claim.clearinghouseTrace || "N/A"}`,
      `Diagnoses: ${model.claim.diagnoses.join(", ") || "N/A"}`,
    ].join("\n");
  }

  if (reviewLinesEl) {
    if (!model.claim.serviceLines.length) {
      reviewLinesEl.textContent = "No service lines found.";
    } else {
      reviewLinesEl.textContent = model.claim.serviceLines
        .map(
          (line) =>
            `#${line.lineNumber || "?"} CPT/HCPCS ${line.procedureCode || "N/A"} | Charge ${line.charge || "N/A"} | DOS ${line.date || "N/A"}`,
        )
        .join("\n");
    }
  }
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
    renderReview(input);
  });
}

if (loadBtn && inputEl) {
  loadBtn.addEventListener("click", () => {
    inputEl.value = SAMPLE_ENCOUNTERS[0]?.text ?? "";
    renderReview(inputEl.value);
  });
}

if (inputEl) {
  renderReview(inputEl.value);
}
