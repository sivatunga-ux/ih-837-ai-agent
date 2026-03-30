// app.js — Encounter Analytics Dashboard
// Imports pipeline, analytics, and sample data. Renders all 10 tabs.

import { SAMPLE_CLAIMS, BILLING_PROVIDERS, RENDERING_PROVIDERS, MEMBERS } from "./sampleClaims.js";
import { runPipeline } from "./pipeline.js";
import * as analytics from "./analyticsEngine.js";
import { DxAnalyticsAgent, generateMemberHistory, COMORBIDITY_RULES, CONDITION_SIGNIFICANCE_REGISTRY } from "./dxAnalytics.js";
import { AnomalyTracker } from "./anomalyTracker.js";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

let pipelineResult = null;
let activeTab = "overview";
let dxAnalytics = null;
let anomalyTracker = null;
let dxResults = null;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}

function fmtCur(n) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n == null) return "—";
  return Number(n).toFixed(1) + "%";
}

function fmtDate(raw) {
  if (!raw || raw.length < 8) return raw || "—";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════

let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 3500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function showModal(title, body) {
  $("#modalTitle").textContent = title;
  $("#modalBody").textContent = body;
  $("#modal").style.display = "flex";
}

function hideModal() {
  $("#modal").style.display = "none";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SORTABLE TABLE HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function renderSortableTable(containerId, columns, rows, options = {}) {
  let sortCol = null;
  let sortDir = "desc";
  const container = document.getElementById(containerId);
  if (!container) return;

  function draw() {
    let sorted = [...rows];
    if (sortCol !== null) {
      const col = columns[sortCol];
      sorted.sort((a, b) => {
        let va = a[col.key], vb = b[col.key];
        if (col.numeric) { va = Number(va) || 0; vb = Number(vb) || 0; }
        else { va = String(va || "").toUpperCase(); vb = String(vb || "").toUpperCase(); }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    const limitedRows = options.limit ? sorted.slice(0, options.limit) : sorted;

    let html = '<div class="tableWrap"><table><thead><tr>';
    columns.forEach((col, i) => {
      let cls = "";
      if (sortCol === i) cls = sortDir === "asc" ? "sorted-asc" : "sorted-desc";
      html += `<th class="${cls}" data-col="${i}">${esc(col.label)}</th>`;
    });
    html += "</tr></thead><tbody>";

    for (const row of limitedRows) {
      const trClass = options.onRowClick ? "clickable" : "";
      const rowId = row._id || "";
      html += `<tr class="${trClass}" data-row-id="${esc(rowId)}">`;
      columns.forEach(col => {
        const val = row[col.key];
        const cls = col.numeric ? "num" : (col.mono ? "mono" : "");
        let display = val;
        if (col.format === "currency") display = fmtCur(val);
        else if (col.format === "number") display = fmt(val);
        else if (col.format === "percent") display = fmtPct(val);
        else if (col.format === "date") display = fmtDate(val);
        else if (col.format === "pill") {
          display = val === "PASS"
            ? '<span class="pill pass">PASS ✓</span>'
            : '<span class="pill fail">FAIL ✗</span>';
        } else {
          display = esc(display);
        }
        html += `<td class="${cls}">${display}</td>`;
      });
      html += "</tr>";
    }

    html += "</tbody></table></div>";
    container.innerHTML = html;

    container.querySelectorAll("thead th").forEach(th => {
      th.addEventListener("click", () => {
        const ci = parseInt(th.dataset.col, 10);
        if (sortCol === ci) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortCol = ci; sortDir = "desc"; }
        draw();
      });
    });

    if (options.onRowClick) {
      container.querySelectorAll("tbody tr").forEach(tr => {
        tr.addEventListener("click", () => options.onRowClick(tr.dataset.rowId));
      });
    }
  }

  draw();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BAR CHART HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function renderBarChart(items, options = {}) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const color = options.color || "blue";
  const formatVal = options.formatValue || fmt;

  return `<div class="barChart">${items.map(item => {
    const pct = Math.max((item.value / maxVal) * 100, 0.5);
    return `<div class="barRow">
      <div class="label" title="${esc(item.label)}">${esc(item.label)}</div>
      <div class="barWrap"><div class="bar ${color}" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="val">${formatVal(item.value)}</div>
    </div>`;
  }).join("")}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function renderOverview() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet. Run the pipeline first.</div></div>';
  const s = pipelineResult.summary;
  const claims = pipelineResult.claims;
  const passRate = ((s.passed / Math.max(s.total, 1)) * 100);
  const avgCharge = s.totalCharge / Math.max(s.total, 1);
  const uniqueMembers = new Set(claims.map(c => c.memberID)).size;
  const uniqueProviders = new Set(claims.map(c => c.billingNPI)).size;
  const totalDuration = pipelineResult.pipelineSteps.reduce((a, p) => a + p.duration, 0);

  const kpis = [
    { icon: "📋", value: fmt(s.total), label: "Total Claims", change: `${s.passed} passed`, changeClass: "up" },
    { icon: "💰", value: fmtCur(s.totalCharge), label: "Total Charge", change: fmtCur(avgCharge) + " avg/claim", changeClass: "neutral" },
    { icon: "💵", value: fmtCur(s.totalPaid), label: "Total Paid", change: fmtPct((s.totalPaid / Math.max(s.totalCharge, 1)) * 100) + " pay rate", changeClass: "neutral" },
    { icon: "✅", value: fmtPct(passRate), label: "Pass Rate", change: `${s.failed} failed`, changeClass: s.failed > 0 ? "down" : "up" },
    { icon: "📁", value: fmt(pipelineResult.files.length), label: "Files Generated", change: `50 claims/file max`, changeClass: "neutral" },
    { icon: "👥", value: fmt(uniqueMembers), label: "Unique Members", change: `of ${MEMBERS.length} total`, changeClass: "neutral" },
    { icon: "🏥", value: fmt(uniqueProviders), label: "Unique Billing Providers", change: `of ${BILLING_PROVIDERS.length} total`, changeClass: "neutral" },
    { icon: "⚡", value: totalDuration + "ms", label: "Pipeline Duration", change: `${pipelineResult.pipelineSteps.length} steps`, changeClass: "neutral" },
  ];

  let html = `<div class="kpiGrid">${kpis.map(k => `
    <div class="kpiCard">
      <div class="kpiIcon">${k.icon}</div>
      <div class="kpiValue">${esc(k.value)}</div>
      <div class="kpiLabel">${esc(k.label)}</div>
      <div class="kpiChange ${k.changeClass}">${esc(k.change)}</div>
    </div>`).join("")}</div>`;

  const statusData = [
    { label: "PASS", value: s.passed },
    { label: "FAIL", value: s.failed },
  ];
  html += `<div class="twoCol">`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Claims by Status</div></div><div class="cardBody">${renderBarChart(statusData, { color: "green" })}</div></div>`;

  const posSummary = analytics.getFacilityCodeSummary(pipelineResult);
  const posData = posSummary.map(p => ({ label: `${p.facilityCode} — ${p.label}`, value: p.claimCount }));
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Claims by Place of Service</div></div><div class="cardBody">${renderBarChart(posData, { color: "blue" })}</div></div>`;
  html += `</div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Pipeline Execution Summary</div></div><div class="cardBody">`;
  html += `<div class="timelineBar">${pipelineResult.pipelineSteps.map(step => {
    const pct = Math.max((step.duration / Math.max(totalDuration, 1)) * 100, 5);
    return `<div class="segment" style="flex:${pct}" title="${step.agent}: ${step.duration}ms">${step.agent.split("-")[0]}</div>`;
  }).join("")}</div>`;
  html += `<div id="overviewPipelineTable"></div></div></div>`;

  return html;
}

function postRenderOverview() {
  if (!pipelineResult) return;
  renderSortableTable("overviewPipelineTable",
    [
      { key: "agent", label: "Agent" },
      { key: "duration", label: "Duration (ms)", numeric: true, format: "number" },
      { key: "claimsProcessed", label: "Claims Processed", numeric: true, format: "number" },
    ],
    pipelineResult.pipelineSteps.map(s => ({ ...s, _id: s.agent }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: FILES & 837 OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

function renderFiles() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';
  const fileSummary = analytics.getFileSummary(pipelineResult);

  let html = `<div class="card"><div class="cardHead"><div class="cardTitle">Generated 837P EDI Files</div></div><div class="cardBody noPad"><div id="filesTable"></div></div></div>`;
  return html;
}

function postRenderFiles() {
  if (!pipelineResult) return;
  const fileSummary = analytics.getFileSummary(pipelineResult);
  const fv = pipelineResult.fileValidations || [];

  const rows = fileSummary.map((f, i) => {
    const validation = fv[i];
    const status = validation ? validation.status : "—";
    return {
      _id: String(i),
      fileName: f.fileName,
      claimCount: f.claimCount,
      segmentCount: f.segmentCount,
      totalCharge: f.totalCharge,
      generatedAt: f.generatedAt ? new Date(f.generatedAt).toLocaleString() : "—",
      status,
    };
  });

  renderSortableTable("filesTable",
    [
      { key: "fileName", label: "File Name", mono: true },
      { key: "claimCount", label: "Claims", numeric: true, format: "number" },
      { key: "segmentCount", label: "Segments", numeric: true, format: "number" },
      { key: "totalCharge", label: "Total Charge", numeric: true, format: "currency" },
      { key: "generatedAt", label: "Generated At" },
      { key: "status", label: "Validation", format: "pill" },
    ],
    rows,
    {
      onRowClick: (rowId) => {
        const idx = parseInt(rowId, 10);
        const file = pipelineResult.files[idx];
        if (file) showModal(file.fileName, file.ediContent);
      }
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: HIERARCHY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function renderHierarchy() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';
  const claims = pipelineResult.claims.filter(c => c.status === "PASS");
  const files = pipelineResult.files;

  let html = '<div style="padding:4px 0">';

  files.forEach((file, fi) => {
    const fileClaims = claims.filter(c => c.fileIndex === fi);
    const fileId = `file-${fi}`;

    html += `<div class="treeNodeRoot">`;
    html += `<button class="treeToggle" data-tree="${fileId}"><span class="arrow open">▶</span> 📁 ${esc(file.fileName)} <span class="pill info">${fileClaims.length} claims</span> <span class="pill purple">${fmt(file.segmentCount)} segments</span></button>`;
    html += `<div class="treeChildren" id="${fileId}">`;

    const byBilling = {};
    for (const c of fileClaims) {
      const k = c.billingNPI || "UNKNOWN";
      if (!byBilling[k]) byBilling[k] = [];
      byBilling[k].push(c);
    }

    for (const [npi, bClaims] of Object.entries(byBilling)) {
      const bId = `${fileId}-bp-${npi}`;
      const bName = bClaims[0]?.billingProviderName || npi;
      html += `<div class="treeNode">`;
      html += `<button class="treeToggle" data-tree="${bId}"><span class="arrow open">▶</span> 🏥 ${esc(bName)} <span class="hint">(NPI: ${esc(npi)})</span> <span class="pill info">${bClaims.length} claims</span></button>`;
      html += `<div class="treeChildren" id="${bId}">`;

      const byMember = {};
      for (const c of bClaims) {
        const mk = c.memberID || "UNKNOWN";
        if (!byMember[mk]) byMember[mk] = [];
        byMember[mk].push(c);
      }

      for (const [memberId, mClaims] of Object.entries(byMember)) {
        const mId = `${bId}-m-${memberId}`;
        const mName = mClaims[0]?.memberName || memberId;
        html += `<div class="treeNode">`;
        html += `<button class="treeToggle" data-tree="${mId}"><span class="arrow open">▶</span> 👤 ${esc(mName)} <span class="hint">(MBI: ${esc(memberId)})</span> <span class="pill info">${mClaims.length} claims</span></button>`;
        html += `<div class="treeChildren" id="${mId}">`;

        for (const claim of mClaims) {
          const cId = `${mId}-clm-${claim.id}`;
          const statusPill = claim.status === "PASS" ? '<span class="pill pass">PASS ✓</span>' : '<span class="pill fail">FAIL ✗</span>';
          html += `<div class="treeNode">`;
          html += `<button class="treeToggle" data-tree="${cId}"><span class="arrow">▶</span> 📋 ${esc(claim.id)} | DOS: ${fmtDate(claim.serviceDateFrom)} | ${fmtCur(claim.totalChargeAmount)} | ${statusPill}</button>`;
          html += `<div class="treeChildren collapsed" id="${cId}">`;

          for (const line of claim.serviceLines || []) {
            const dxPointers = (line.diagnosisPointers || "1").split(":").map(p => {
              const dx = (claim.diagnoses || [])[parseInt(p, 10) - 1];
              return dx ? dx.code : "?";
            }).join(", ");
            html += `<div class="treeNode"><div class="treeLeaf" data-claim-id="${esc(claim.id)}" data-line="${line.lineNumber}">💊 SV1: ${esc(line.procedureCode)}${line.modifier1 ? ":" + esc(line.modifier1) : ""} | ${fmtCur(line.chargeAmount)} | ${line.unitCount} ${line.unitType || "UN"} | Dx: ${esc(dxPointers)}</div></div>`;
          }

          html += `</div></div>`;
        }

        html += `</div></div>`;
      }

      html += `</div></div>`;
    }

    html += `</div></div>`;
  });

  html += "</div>";
  return `<div class="card"><div class="cardHead"><div class="cardTitle">837P File Hierarchy — File → Billing Provider → Member → Claim → Service Lines</div></div><div class="cardBody">${html}</div></div>`;
}

function postRenderHierarchy() {
  document.querySelectorAll("[data-tree]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.tree);
      if (!target) return;
      const arrow = btn.querySelector(".arrow");
      target.classList.toggle("collapsed");
      if (arrow) arrow.classList.toggle("open");
    });
  });

  document.querySelectorAll(".treeLeaf[data-claim-id]").forEach(leaf => {
    leaf.addEventListener("click", (e) => {
      e.stopPropagation();
      const claimId = leaf.dataset.claimId;
      const claim = pipelineResult.claims.find(c => c.id === claimId);
      if (claim) showClaimDetail(claim);
    });
  });
}

function showClaimDetail(claim) {
  const lines = [];
  lines.push(`Claim ID: ${claim.id}`);
  lines.push(`PCN: ${claim.pcn}`);
  lines.push(`Status: ${claim.status}`);
  lines.push(`Service Date: ${fmtDate(claim.serviceDateFrom)}`);
  lines.push(`Facility Code: ${claim.facilityCode}`);
  lines.push(`Total Charge: ${fmtCur(claim.totalChargeAmount)}`);
  lines.push(`Paid Amount: ${fmtCur(claim.paidAmount)}`);
  lines.push(`File: ${claim.fileName || "N/A"}`);
  lines.push("");
  lines.push(`── Member ──`);
  lines.push(`  Name: ${claim.memberName}`);
  lines.push(`  MBI: ${claim.memberID}`);
  lines.push(`  DOB: ${fmtDate(claim.memberDOB)}`);
  lines.push(`  Gender: ${claim.memberGender}`);
  lines.push("");
  lines.push(`── Billing Provider ──`);
  lines.push(`  Name: ${claim.billingProviderName}`);
  lines.push(`  NPI: ${claim.billingNPI}`);
  lines.push("");
  lines.push(`── Rendering Provider ──`);
  lines.push(`  Name: ${claim.renderingProviderName}`);
  lines.push(`  NPI: ${claim.renderingNPI}`);
  lines.push("");
  lines.push(`── Diagnoses ──`);
  for (const dx of claim.diagnoses || []) {
    lines.push(`  [${dx.sequence}] ${dx.qualifier}: ${dx.code}`);
  }
  lines.push("");
  lines.push(`── Service Lines ──`);
  for (const sl of claim.serviceLines || []) {
    lines.push(`  Line ${sl.lineNumber}: ${sl.procedureCode}${sl.modifier1 ? ":" + sl.modifier1 : ""} | Charge: ${fmtCur(sl.chargeAmount)} | Units: ${sl.unitCount} ${sl.unitType || "UN"} | Dx Ptrs: ${sl.diagnosisPointers}`);
  }

  if (claim.validationResult) {
    lines.push("");
    lines.push(`── Validation (${claim.validationResult.passed} pass / ${claim.validationResult.failed} fail) ──`);
    for (const chk of claim.validationResult.checks || []) {
      const icon = chk.status === "PASS" ? "✓" : "✗";
      lines.push(`  ${icon} ${chk.id} [${chk.field}]: ${chk.detail}`);
    }
  }

  showModal(`Claim Detail — ${claim.id}`, lines.join("\n"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PROVIDER ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function renderProviders() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  let html = '';
  const bp = analytics.getBillingProviderSummary(pipelineResult);
  const top10bp = bp.slice(0, 10).map(p => ({ label: p.billingProviderName, value: p.claimCount }));
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 10 Billing Providers by Claim Volume</div></div><div class="cardBody">${renderBarChart(top10bp, { color: "blue" })}</div></div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Billing Provider Summary</div></div><div class="cardBody noPad"><div id="billingProviderTable"></div></div></div>`;

  const rp = analytics.getRenderingProviderSummary(pipelineResult);
  const top10rp = rp.slice(0, 10).map(p => ({ label: p.renderingProviderName, value: p.claimCount }));
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 10 Rendering Providers by Claim Volume</div></div><div class="cardBody">${renderBarChart(top10rp, { color: "teal" })}</div></div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Rendering Provider Summary</div></div><div class="cardBody noPad"><div id="renderingProviderTable"></div></div></div>`;

  return html;
}

function postRenderProviders() {
  if (!pipelineResult) return;
  const bp = analytics.getBillingProviderSummary(pipelineResult);
  renderSortableTable("billingProviderTable",
    [
      { key: "billingNPI", label: "NPI", mono: true },
      { key: "billingProviderName", label: "Name" },
      { key: "claimCount", label: "Claims", numeric: true, format: "number" },
      { key: "totalCharge", label: "Total Charge", numeric: true, format: "currency" },
      { key: "totalPaid", label: "Total Paid", numeric: true, format: "currency" },
      { key: "uniqueMembers", label: "Members", numeric: true, format: "number" },
      { key: "uniqueRenderingProviders", label: "Rendering", numeric: true, format: "number" },
      { key: "avgChargePerClaim", label: "Avg Charge", numeric: true, format: "currency" },
    ],
    bp.map(p => ({ ...p, _id: p.billingNPI }))
  );

  const rp = analytics.getRenderingProviderSummary(pipelineResult);
  renderSortableTable("renderingProviderTable",
    [
      { key: "renderingNPI", label: "NPI", mono: true },
      { key: "renderingProviderName", label: "Name" },
      { key: "claimCount", label: "Claims", numeric: true, format: "number" },
      { key: "totalCharge", label: "Total Charge", numeric: true, format: "currency" },
      { key: "billingProviderStr", label: "Billing Provider(s)" },
      { key: "uniqueMembers", label: "Members", numeric: true, format: "number" },
    ],
    rp.map(p => ({ ...p, billingProviderStr: p.billingProviders.join(", "), _id: p.renderingNPI }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: MEMBER ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function renderMembers() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  const ms = analytics.getMemberSummary(pipelineResult);
  const top20count = ms.slice(0, 20).map(m => ({ label: m.memberName, value: m.claimCount }));
  const top20charge = [...ms].sort((a, b) => b.totalCharge - a.totalCharge).slice(0, 20).map(m => ({ label: m.memberName, value: m.totalCharge }));

  let html = `<div class="twoCol">`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 20 Members by Claim Count</div></div><div class="cardBody">${renderBarChart(top20count, { color: "blue" })}</div></div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 20 Members by Total Charge</div></div><div class="cardBody">${renderBarChart(top20charge, { color: "amber", formatValue: fmtCur })}</div></div>`;
  html += `</div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Member Summary</div></div><div class="cardBody noPad"><div id="memberTable"></div></div></div>`;

  return html;
}

function postRenderMembers() {
  if (!pipelineResult) return;
  const ms = analytics.getMemberSummary(pipelineResult);
  renderSortableTable("memberTable",
    [
      { key: "memberID", label: "Member ID", mono: true },
      { key: "memberName", label: "Name" },
      { key: "dateOfBirth", label: "DOB", format: "date" },
      { key: "gender", label: "Gender" },
      { key: "claimCount", label: "Claims", numeric: true, format: "number" },
      { key: "totalCharge", label: "Total Charge", numeric: true, format: "currency" },
      { key: "totalPaid", label: "Total Paid", numeric: true, format: "currency" },
      { key: "uniqueProviders", label: "Providers", numeric: true, format: "number" },
      { key: "dateRangeFrom", label: "From", format: "date" },
      { key: "dateRangeTo", label: "To", format: "date" },
    ],
    ms.map(m => ({ ...m, _id: m.memberID }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: MONTHLY TRENDING
// ═══════════════════════════════════════════════════════════════════════════════

function renderTrending() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  const trend = analytics.getMonthlyTrend(pipelineResult);

  const claimData = trend.map(t => ({ label: t.month, value: t.claimCount }));
  const chargeData = trend.map(t => ({ label: t.month, value: t.totalCharge }));
  const memberData = trend.map(t => ({ label: t.month, value: t.uniqueMembers }));

  let html = `<div class="card"><div class="cardHead"><div class="cardTitle">Claims per Month</div></div><div class="cardBody">${renderBarChart(claimData, { color: "blue" })}</div></div>`;
  html += `<div class="twoCol">`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Total Charge per Month</div></div><div class="cardBody">${renderBarChart(chargeData, { color: "green", formatValue: fmtCur })}</div></div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Unique Members per Month</div></div><div class="cardBody">${renderBarChart(memberData, { color: "purple" })}</div></div>`;
  html += `</div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Monthly Breakdown</div></div><div class="cardBody noPad"><div id="trendingTable"></div></div></div>`;

  return html;
}

function postRenderTrending() {
  if (!pipelineResult) return;
  const trend = analytics.getMonthlyTrend(pipelineResult);
  renderSortableTable("trendingTable",
    [
      { key: "month", label: "Month" },
      { key: "claimCount", label: "Claims", numeric: true, format: "number" },
      { key: "totalCharge", label: "Total Charge", numeric: true, format: "currency" },
      { key: "totalPaid", label: "Total Paid", numeric: true, format: "currency" },
      { key: "uniqueMembers", label: "Members", numeric: true, format: "number" },
      { key: "uniqueProviders", label: "Providers", numeric: true, format: "number" },
      { key: "avgCharge", label: "Avg Charge", numeric: true, format: "currency" },
    ],
    trend.map(t => ({
      ...t,
      avgCharge: t.claimCount > 0 ? Math.round((t.totalCharge / t.claimCount) * 100) / 100 : 0,
      _id: t.month,
    }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CLINICAL ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function renderClinical() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  const dx = analytics.getDiagnosisSummary(pipelineResult);
  const proc = analytics.getProcedureSummary(pipelineResult);
  const pos = analytics.getFacilityCodeSummary(pipelineResult);

  const dxData = dx.slice(0, 15).map(d => ({ label: d.diagnosisCode, value: d.frequency }));
  const procFreqData = proc.slice(0, 12).map(p => ({ label: p.procedureCode, value: p.frequency }));
  const procChargeData = [...proc].sort((a, b) => b.totalCharge - a.totalCharge).slice(0, 12).map(p => ({ label: p.procedureCode, value: p.totalCharge }));

  let html = `<div class="card"><div class="cardHead"><div class="cardTitle">Top 15 Diagnosis Codes by Frequency</div></div><div class="cardBody">${renderBarChart(dxData, { color: "red" })}</div></div>`;
  html += `<div class="twoCol">`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 12 Procedure Codes by Frequency</div></div><div class="cardBody">${renderBarChart(procFreqData, { color: "blue" })}</div></div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 12 Procedure Codes by Total Charge</div></div><div class="cardBody">${renderBarChart(procChargeData, { color: "amber", formatValue: fmtCur })}</div></div>`;
  html += `</div>`;
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Place of Service (Facility Code) Distribution</div></div><div class="cardBody noPad"><div id="posClinicalTable"></div></div></div>`;

  return html;
}

function postRenderClinical() {
  if (!pipelineResult) return;
  const pos = analytics.getFacilityCodeSummary(pipelineResult);
  renderSortableTable("posClinicalTable",
    [
      { key: "facilityCode", label: "POS Code", mono: true },
      { key: "label", label: "Description" },
      { key: "claimCount", label: "Claims", numeric: true, format: "number" },
      { key: "totalCharge", label: "Total Charge", numeric: true, format: "currency" },
      { key: "totalPaid", label: "Total Paid", numeric: true, format: "currency" },
      { key: "percentOfClaims", label: "% of Claims", numeric: true, format: "percent" },
    ],
    pos.map(p => ({ ...p, _id: p.facilityCode }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CROSS-FILE SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

function renderSearch() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  let html = `<div class="card"><div class="cardHead"><div class="cardTitle">Cross-File Claim Search</div></div>`;
  html += `<div class="searchPanel">
    <label>Free-text Query<input type="text" id="searchQuery" placeholder="Claim ID, name, code..." /></label>
    <label>Billing NPI<input type="text" id="searchBillingNPI" placeholder="1234567890" /></label>
    <label>Rendering NPI<input type="text" id="searchRenderingNPI" placeholder="1234567890" /></label>
    <label>Member ID<input type="text" id="searchMemberId" placeholder="MBI..." /></label>
    <label>Date From<input type="date" id="searchDateFrom" /></label>
    <label>Date To<input type="date" id="searchDateTo" /></label>
    <div class="searchActions"><button class="btn primary" id="btnSearch">Search</button><button class="btn" id="btnClearSearch">Clear</button></div>
  </div>`;
  html += `<div class="cardBody noPad"><div id="searchResults"><div class="empty" style="padding:20px"><div class="hint">Enter search criteria above and click Search</div></div></div></div></div>`;

  return html;
}

function postRenderSearch() {
  if (!pipelineResult) return;

  const btnSearch = document.getElementById("btnSearch");
  const btnClear = document.getElementById("btnClearSearch");

  function doSearch() {
    const filters = {
      query: document.getElementById("searchQuery")?.value || "",
      billingNPI: document.getElementById("searchBillingNPI")?.value || "",
      renderingNPI: document.getElementById("searchRenderingNPI")?.value || "",
      memberId: document.getElementById("searchMemberId")?.value || "",
      dateFrom: document.getElementById("searchDateFrom")?.value || "",
      dateTo: document.getElementById("searchDateTo")?.value || "",
    };

    const results = analytics.search(pipelineResult, filters);
    if (results.length === 0) {
      document.getElementById("searchResults").innerHTML = '<div class="empty" style="padding:20px"><div class="hint">No matching claims found</div></div>';
      return;
    }

    renderSortableTable("searchResults",
      [
        { key: "fileName", label: "File" },
        { key: "id", label: "Claim ID", mono: true },
        { key: "memberName", label: "Member" },
        { key: "billingProviderName", label: "Billing Provider" },
        { key: "renderingProviderName", label: "Rendering Provider" },
        { key: "serviceDateFrom", label: "Service Date", format: "date" },
        { key: "totalChargeAmount", label: "Charge", numeric: true, format: "currency" },
        { key: "status", label: "Status", format: "pill" },
      ],
      results.map(r => ({ ...r, _id: r.id })),
      {
        onRowClick: (rowId) => {
          const claim = pipelineResult.claims.find(c => c.id === rowId);
          if (claim) showClaimDetail(claim);
        }
      }
    );

    showToast(`Found ${results.length} matching claims`);
  }

  if (btnSearch) btnSearch.addEventListener("click", doSearch);
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      ["searchQuery", "searchBillingNPI", "searchRenderingNPI", "searchMemberId", "searchDateFrom", "searchDateTo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      document.getElementById("searchResults").innerHTML = '<div class="empty" style="padding:20px"><div class="hint">Enter search criteria above and click Search</div></div>';
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: VALIDATION REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function renderValidation() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  const vs = analytics.getValidationSummary(pipelineResult);
  const claims = pipelineResult.claims;
  const totalChecks = claims.reduce((s, c) => s + (c.validationResult?.checks?.length || 0), 0);
  const checksPerClaim = vs.total > 0 ? Math.round(totalChecks / vs.total) : 0;

  const kpis = [
    { icon: "✅", value: fmtPct(vs.passRate), label: "Pass Rate", change: `${vs.passed} of ${vs.total}`, changeClass: "up" },
    { icon: "🔍", value: fmt(totalChecks), label: "Total Checks Run", change: `across ${vs.total} claims`, changeClass: "neutral" },
    { icon: "📊", value: fmt(checksPerClaim), label: "Checks Per Claim", change: "validation rules", changeClass: "neutral" },
    { icon: "❌", value: fmt(vs.failed), label: "Failed Claims", change: `${vs.commonFailures.length} unique failures`, changeClass: vs.failed > 0 ? "down" : "up" },
  ];

  let html = `<div class="kpiGrid">${kpis.map(k => `
    <div class="kpiCard">
      <div class="kpiIcon">${k.icon}</div>
      <div class="kpiValue">${esc(k.value)}</div>
      <div class="kpiLabel">${esc(k.label)}</div>
      <div class="kpiChange ${k.changeClass}">${esc(k.change)}</div>
    </div>`).join("")}</div>`;

  // Build per-check pass/fail summary
  const checkMap = {};
  for (const claim of claims) {
    for (const chk of claim.validationResult?.checks || []) {
      if (!checkMap[chk.id]) {
        checkMap[chk.id] = { id: chk.id, field: chk.field, detail: chk.detail, passCount: 0, failCount: 0 };
      }
      if (chk.status === "PASS") checkMap[chk.id].passCount++;
      else checkMap[chk.id].failCount++;
    }
  }

  const checkRows = Object.values(checkMap).map(c => ({
    ...c,
    total: c.passCount + c.failCount,
    passRate: ((c.passCount / Math.max(c.passCount + c.failCount, 1)) * 100),
    _id: c.id,
  }));

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Validation Check Results</div></div><div class="cardBody noPad"><div id="validationCheckTable"></div></div></div>`;

  if (vs.failed > 0) {
    html += `<div class="card"><div class="cardHead"><div class="cardTitle">Failed Claims</div></div><div class="cardBody noPad"><div id="failedClaimsTable"></div></div></div>`;
  }

  return html;
}

function postRenderValidation() {
  if (!pipelineResult) return;
  const claims = pipelineResult.claims;

  const checkMap = {};
  for (const claim of claims) {
    for (const chk of claim.validationResult?.checks || []) {
      if (!checkMap[chk.id]) {
        checkMap[chk.id] = { id: chk.id, field: chk.field, detail: chk.detail, passCount: 0, failCount: 0 };
      }
      if (chk.status === "PASS") checkMap[chk.id].passCount++;
      else checkMap[chk.id].failCount++;
    }
  }

  const checkRows = Object.values(checkMap).map(c => ({
    ...c,
    passRate: Math.round((c.passCount / Math.max(c.passCount + c.failCount, 1)) * 1000) / 10,
    _id: c.id,
  }));

  renderSortableTable("validationCheckTable",
    [
      { key: "id", label: "Check ID", mono: true },
      { key: "field", label: "Field" },
      { key: "passCount", label: "Pass", numeric: true, format: "number" },
      { key: "failCount", label: "Fail", numeric: true, format: "number" },
      { key: "passRate", label: "Pass Rate", numeric: true, format: "percent" },
    ],
    checkRows
  );

  const failedClaims = claims.filter(c => c.status === "FAIL");
  if (failedClaims.length > 0) {
    renderSortableTable("failedClaimsTable",
      [
        { key: "id", label: "Claim ID", mono: true },
        { key: "memberName", label: "Member" },
        { key: "billingProviderName", label: "Billing Provider" },
        { key: "serviceDateFrom", label: "Service Date", format: "date" },
        { key: "totalChargeAmount", label: "Charge", numeric: true, format: "currency" },
        { key: "failedChecks", label: "Failed Checks" },
      ],
      failedClaims.map(c => {
        const failed = (c.validationResult?.checks || []).filter(ch => ch.status === "FAIL").map(ch => ch.id).join(", ");
        return { ...c, failedChecks: failed, _id: c.id };
      }),
      {
        onRowClick: (rowId) => {
          const claim = pipelineResult.claims.find(c => c.id === rowId);
          if (claim) showClaimDetail(claim);
        }
      }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PIPELINE TRACE
// ═══════════════════════════════════════════════════════════════════════════════

function renderPipelineTrace() {
  if (!pipelineResult) return '<div class="empty"><div>No data yet.</div></div>';

  const steps = pipelineResult.pipelineSteps;
  const totalDuration = steps.reduce((a, s) => a + s.duration, 0);

  let html = `<div class="card"><div class="cardHead"><div class="cardTitle">Pipeline Execution Timeline</div></div><div class="cardBody">`;
  html += `<div class="timelineBar">${steps.map(step => {
    const pct = Math.max((step.duration / Math.max(totalDuration, 1)) * 100, 5);
    return `<div class="segment" style="flex:${pct}" title="${step.agent}: ${step.duration}ms">${step.agent}</div>`;
  }).join("")}</div>`;
  html += `<div class="hint mb-16">Total: ${totalDuration}ms across ${steps.length} pipeline agents</div>`;
  html += `</div></div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Step-by-Step Pipeline Trace</div></div><div class="cardBody noPad"><div id="pipelineTraceTable"></div></div></div>`;

  return html;
}

function postRenderPipelineTrace() {
  if (!pipelineResult) return;
  const steps = pipelineResult.pipelineSteps;
  const totalDuration = steps.reduce((a, s) => a + s.duration, 0);

  renderSortableTable("pipelineTraceTable",
    [
      { key: "step", label: "#", numeric: true },
      { key: "agent", label: "Agent" },
      { key: "duration", label: "Duration (ms)", numeric: true, format: "number" },
      { key: "pctOfTotal", label: "% of Total", numeric: true, format: "percent" },
      { key: "claimsProcessed", label: "Claims / Items", numeric: true, format: "number" },
      { key: "status", label: "Status" },
    ],
    steps.map((s, i) => ({
      step: i + 1,
      agent: s.agent,
      duration: s.duration,
      pctOfTotal: Math.round((s.duration / Math.max(totalDuration, 1)) * 1000) / 10,
      claimsProcessed: s.claimsProcessed,
      status: "COMPLETE",
      _id: s.agent,
    }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DX OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function renderDxOverview() {
  if (!dxResults) return '<div class="empty"><div>Run the pipeline first to see Dx analytics</div></div>';

  const vol = dxResults.volume;
  const qual = dxResults.qualifiers;
  const chronicGapCount = dxResults.chronicGaps.length;
  const totalAnomalies = dxResults.anomalies.total;
  const resolved = anomalyTracker ? anomalyTracker.anomalies.filter(a => a.status === "RESOLVED").length : 0;
  const resolutionRate = totalAnomalies > 0 ? (resolved / totalAnomalies) * 100 : 0;
  const comorbGaps = dxResults.comorbidityGaps.anomalies.length;
  const singleDxFlagged = vol.singleDxPct > 30;

  const histVol = dxAnalytics.history.length > 0
    ? dxAnalytics.history.reduce((s, c) => s + (c.diagnoses || []).length, 0)
    : null;
  const trendLabel = histVol !== null ? `vs ${fmt(histVol)} historical` : "current batch";

  const kpis = [
    { icon: "🔢", value: fmt(vol.totalDx), label: "Total Dx", change: trendLabel, changeClass: "neutral" },
    { icon: "🧬", value: fmt(vol.uniqueDx), label: "Unique Codes", change: `${vol.maxDxOnClaim} max/claim`, changeClass: "neutral" },
    { icon: "📊", value: String(vol.avgDxPerClaim), label: "Avg Dx/Claim", change: `median ${vol.medianDxPerClaim}`, changeClass: "neutral" },
    { icon: "⚠️", value: fmt(vol.singleDxClaims), label: "Single-Dx Claims", change: fmtPct(vol.singleDxPct) + (singleDxFlagged ? " ⚠ flagged" : ""), changeClass: singleDxFlagged ? "down" : "up" },
    { icon: "🔗", value: fmt(comorbGaps), label: "Comorbidity Gaps", change: `${COMORBIDITY_RULES.filter(r => r.active).length} rules active`, changeClass: comorbGaps > 0 ? "down" : "up" },
    { icon: "📅", value: fmt(chronicGapCount), label: "Chronic Gaps", change: "from member history", changeClass: chronicGapCount > 0 ? "down" : "up" },
    { icon: "🚨", value: fmt(totalAnomalies), label: "Total Anomalies", change: `P1:${dxResults.anomalies.p1.length} P2:${dxResults.anomalies.p2.length} P3:${dxResults.anomalies.p3.length}`, changeClass: totalAnomalies > 0 ? "down" : "up" },
    { icon: "✅", value: fmtPct(resolutionRate), label: "Resolution Rate", change: `${resolved} resolved`, changeClass: "neutral" },
  ];

  let html = `<div class="kpiGrid">${kpis.map(k => `
    <div class="kpiCard">
      <div class="kpiIcon">${k.icon}</div>
      <div class="kpiValue">${esc(k.value)}</div>
      <div class="kpiLabel">${esc(k.label)}</div>
      <div class="kpiChange ${k.changeClass}">${esc(k.change)}</div>
    </div>`).join("")}</div>`;

  const qualMax = Math.max(qual.abk, qual.abf, 1);
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Qualifier Breakdown (ABK vs ABF)</div></div><div class="cardBody">`;
  html += renderBarChart([
    { label: `ABK (Principal) — ${qual.abk}`, value: qual.abk },
    { label: `ABF (Other) — ${qual.abf}`, value: qual.abf },
  ], { color: "blue" });
  html += `</div></div>`;

  const distData = vol.dxDistribution.map(d => ({ label: `${d.count} Dx`, value: d.claims }));
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Dx per Claim Distribution</div></div><div class="cardBody">${renderBarChart(distData, { color: "teal" })}</div></div>`;

  const catData = dxResults.categories.map(c => ({ label: `${c.chapter} — ${c.name}`, value: c.count }));
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">ICD-10 Chapter Breakdown</div></div><div class="cardBody">${renderBarChart(catData, { color: "purple" })}</div></div>`;

  const topPrincipal = dxResults.topPrincipal.map(d => ({ label: `${d.code} — ${d.name}`, value: d.count }));
  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top 20 Principal Dx (ABK)</div></div><div class="cardBody">${renderBarChart(topPrincipal, { color: "red" })}</div></div>`;

  return html;
}

function postRenderDxOverview() {}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GAPS & ANOMALIES
// ═══════════════════════════════════════════════════════════════════════════════

function renderDxGaps() {
  if (!dxResults) return '<div class="empty"><div>Run the pipeline first to see Dx analytics</div></div>';

  const anomalies = dxResults.anomalies;
  const totalRAFImpact = [...anomalies.p1, ...anomalies.p2, ...anomalies.p3]
    .reduce((s, a) => s + (a.estimatedRevenue || 0), 0);

  const kpis = [
    { icon: "🚨", value: fmt(anomalies.total), label: "Total Anomalies", change: "all priorities", changeClass: "neutral" },
    { icon: "🔴", value: fmt(anomalies.bySeverity.HIGH || 0), label: "HIGH Severity", change: "immediate review", changeClass: "down" },
    { icon: "🟡", value: fmt(anomalies.bySeverity.MEDIUM || 0), label: "MEDIUM Severity", change: "review recommended", changeClass: "neutral" },
    { icon: "🟢", value: fmt(anomalies.bySeverity.LOW || 0), label: "LOW Severity", change: "informational", changeClass: "up" },
    { icon: "💰", value: fmtCur(totalRAFImpact), label: "Est. RAF Impact", change: "potential revenue", changeClass: "neutral" },
  ];

  let html = `<div class="kpiGrid">${kpis.map(k => `
    <div class="kpiCard">
      <div class="kpiIcon">${k.icon}</div>
      <div class="kpiValue">${esc(k.value)}</div>
      <div class="kpiLabel">${esc(k.label)}</div>
      <div class="kpiChange ${k.changeClass}">${esc(k.change)}</div>
    </div>`).join("")}</div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Comorbidity Rule Summary</div></div><div class="cardBody noPad"><div id="dxRuleSummaryTable"></div></div></div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Top Chronic Gap Conditions</div></div><div class="cardBody noPad"><div id="dxChronicGapTable"></div></div></div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Anomaly List (first 50)</div></div><div class="cardBody noPad"><div id="dxAnomalyListTable"></div></div></div>`;

  return html;
}

function postRenderDxGaps() {
  if (!dxResults) return;

  const allAnomalies = [...dxResults.anomalies.p1, ...dxResults.anomalies.p2, ...dxResults.anomalies.p3];
  const gapsByRule = {};
  for (const a of allAnomalies) {
    if (!gapsByRule[a.ruleId]) gapsByRule[a.ruleId] = { count: 0, revenue: 0 };
    gapsByRule[a.ruleId].count++;
    gapsByRule[a.ruleId].revenue += a.estimatedRevenue || 0;
  }

  const ruleRows = COMORBIDITY_RULES.map(r => ({
    ruleId: r.id,
    ruleName: r.name,
    severity: r.severity,
    gapsFound: gapsByRule[r.id]?.count || 0,
    estRevenue: Math.round((gapsByRule[r.id]?.revenue || 0) * 100) / 100,
    active: r.active ? "Yes" : "No",
    _id: r.id,
  }));

  renderSortableTable("dxRuleSummaryTable",
    [
      { key: "ruleId", label: "Rule ID", mono: true },
      { key: "ruleName", label: "Rule Name" },
      { key: "severity", label: "Severity" },
      { key: "gapsFound", label: "Gaps Found", numeric: true, format: "number" },
      { key: "estRevenue", label: "Est. Revenue Impact", numeric: true, format: "currency" },
      { key: "active", label: "Active" },
    ],
    ruleRows
  );

  const chronicGaps = dxResults.chronicGaps;
  const condMap = {};
  for (const g of chronicGaps) {
    const key = g.code;
    if (!condMap[key]) condMap[key] = { condition: g.missingCondition, code: g.code, hcc: g.hcc || "—", members: 0, totalTimes: 0 };
    condMap[key].members++;
    condMap[key].totalTimes += g.timesInHistory;
  }
  const condRows = Object.values(condMap).map(c => ({
    ...c,
    avgTimes: c.members > 0 ? Math.round((c.totalTimes / c.members) * 10) / 10 : 0,
    _id: c.code,
  })).sort((a, b) => b.members - a.members);

  renderSortableTable("dxChronicGapTable",
    [
      { key: "condition", label: "Condition" },
      { key: "code", label: "Code", mono: true },
      { key: "hcc", label: "HCC" },
      { key: "members", label: "Members Affected", numeric: true, format: "number" },
      { key: "avgTimes", label: "Avg Times in History", numeric: true },
    ],
    condRows
  );

  const anomalyRows = allAnomalies.slice(0, 50).map((a, i) => ({
    ...a,
    id: a.ruleId + "-" + (a.claimId || i),
    rule: a.ruleName,
    member: a.memberName || a.memberId || "—",
    provider: a.billingProvider || "—",
    serviceDate: a.serviceDate || "—",
    estRAF: a.estimatedRAF || 0,
    _id: String(i),
    _triggerDx: (a.triggerDx || []).join(", "),
    _expectedDx: a.expectedDx || "—",
    _description: a.description || "—",
  }));

  const container = document.getElementById("dxAnomalyListTable");
  if (!container) return;

  let thtml = '<div class="tableWrap"><table><thead><tr>';
  const cols = ["ID", "Rule", "Member", "Provider", "Service Date", "Severity", "Priority", "Est. RAF", "Status"];
  for (const c of cols) thtml += `<th>${esc(c)}</th>`;
  thtml += "</tr></thead><tbody>";

  for (const row of anomalyRows) {
    const sevColor = row.severity === "HIGH" ? "red" : row.severity === "MEDIUM" ? "amber" : "green";
    thtml += `<tr class="clickable" data-anomaly-idx="${esc(row._id)}">`;
    thtml += `<td class="mono">${esc(row.id)}</td>`;
    thtml += `<td>${esc(row.rule)}</td>`;
    thtml += `<td>${esc(row.member)}</td>`;
    thtml += `<td class="mono">${esc(row.provider)}</td>`;
    thtml += `<td>${fmtDate(row.serviceDate)}</td>`;
    thtml += `<td><span class="pill ${sevColor}">${esc(row.severity)}</span></td>`;
    thtml += `<td>P${row.priority}</td>`;
    thtml += `<td class="num">${row.estRAF.toFixed(3)}</td>`;
    thtml += `<td>${esc(row.status)}</td>`;
    thtml += `</tr>`;
    thtml += `<tr class="anomalyDetail collapsed" id="anomalyDetail-${esc(row._id)}"><td colspan="9" style="background:#f8fafc;padding:12px 16px;font-size:13px">`;
    thtml += `<strong>Trigger Dx:</strong> ${esc(row._triggerDx)}<br>`;
    thtml += `<strong>Expected Dx:</strong> ${esc(row._expectedDx)}<br>`;
    thtml += `<strong>Description:</strong> ${esc(row._description)}`;
    thtml += `</td></tr>`;
  }

  thtml += "</tbody></table></div>";
  container.innerHTML = thtml;

  container.querySelectorAll("tr.clickable[data-anomaly-idx]").forEach(tr => {
    tr.addEventListener("click", () => {
      const detail = document.getElementById("anomalyDetail-" + tr.dataset.anomalyIdx);
      if (detail) detail.classList.toggle("collapsed");
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PROVIDER QUALITY (DX)
// ═══════════════════════════════════════════════════════════════════════════════

function renderDxProviders() {
  if (!dxResults) return '<div class="empty"><div>Run the pipeline first to see Dx analytics</div></div>';

  const pq = dxResults.providerQuality;
  const sorted = [...pq].sort((a, b) => a.completenessScore - b.completenessScore);
  const chartData = sorted.map(p => ({ label: `${p.npi} — ${p.name}`, value: p.completenessScore }));

  let html = `<div class="card"><div class="cardHead"><div class="cardTitle">Billing Provider Scorecard</div></div><div class="cardBody noPad"><div id="dxProviderScorecardTable"></div></div></div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Provider Completeness Scores (sorted)</div></div><div class="cardBody">${renderBarChart(chartData, { color: "blue" })}</div></div>`;

  const underReporters = dxResults.underReporters;
  if (underReporters.length > 0) {
    html += `<div class="card"><div class="cardHead"><div class="cardTitle">⚠️ Under-Reporters (Avg Dx &lt; 2.0)</div></div><div class="cardBody noPad"><div id="dxUnderReporterTable"></div></div></div>`;
  }

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Rendering Provider Summary</div></div><div class="cardBody noPad"><div id="dxRenderingProviderTable"></div></div></div>`;

  return html;
}

function postRenderDxProviders() {
  if (!dxResults) return;

  const pq = dxResults.providerQuality;
  const comorbGaps = dxResults.comorbidityGaps.anomalies;
  const gapsByProvider = {};
  for (const a of comorbGaps) {
    gapsByProvider[a.billingProvider] = (gapsByProvider[a.billingProvider] || 0) + 1;
  }

  const rows = [...pq].sort((a, b) => a.completenessScore - b.completenessScore).map(p => ({
    npi: p.npi,
    name: p.name,
    claims: p.claims,
    avgDxPerClaim: p.avgDxPerClaim,
    singleDxPct: p.singleDxPct,
    completenessScore: p.completenessScore,
    gapCount: gapsByProvider[p.npi] || 0,
    _id: p.npi,
  }));

  const container = document.getElementById("dxProviderScorecardTable");
  if (container) {
    let thtml = '<div class="tableWrap"><table><thead><tr>';
    const cols = ["NPI", "Name", "Claims", "Avg Dx/Claim", "Single-Dx%", "Completeness Score", "Gap Count"];
    for (const c of cols) thtml += `<th>${esc(c)}</th>`;
    thtml += "</tr></thead><tbody>";
    for (const row of rows) {
      const scoreColor = row.completenessScore > 80 ? "#22c55e" : row.completenessScore >= 60 ? "#eab308" : "#ef4444";
      thtml += `<tr>`;
      thtml += `<td class="mono">${esc(row.npi)}</td>`;
      thtml += `<td>${esc(row.name)}</td>`;
      thtml += `<td class="num">${fmt(row.claims)}</td>`;
      thtml += `<td class="num">${row.avgDxPerClaim}</td>`;
      thtml += `<td class="num">${fmtPct(row.singleDxPct)}</td>`;
      thtml += `<td class="num"><span style="display:inline-block;padding:2px 10px;border-radius:4px;color:#fff;font-weight:600;background:${scoreColor}">${row.completenessScore}</span></td>`;
      thtml += `<td class="num">${fmt(row.gapCount)}</td>`;
      thtml += `</tr>`;
    }
    thtml += "</tbody></table></div>";
    container.innerHTML = thtml;
  }

  const underReporters = dxResults.underReporters;
  if (underReporters.length > 0) {
    renderSortableTable("dxUnderReporterTable",
      [
        { key: "npi", label: "NPI", mono: true },
        { key: "name", label: "Name" },
        { key: "claims", label: "Claims", numeric: true, format: "number" },
        { key: "avgDxPerClaim", label: "Avg Dx/Claim", numeric: true },
        { key: "singleDxPct", label: "Single-Dx%", numeric: true, format: "percent" },
        { key: "completenessScore", label: "Score", numeric: true },
      ],
      underReporters.map(p => ({ ...p, _id: p.npi }))
    );
  }

  const rq = dxResults.renderingQuality;
  renderSortableTable("dxRenderingProviderTable",
    [
      { key: "npi", label: "NPI", mono: true },
      { key: "name", label: "Name" },
      { key: "claims", label: "Claims", numeric: true, format: "number" },
      { key: "avgDxPerClaim", label: "Avg Dx/Claim", numeric: true },
      { key: "singleDxPct", label: "Single-Dx%", numeric: true, format: "percent" },
      { key: "completenessScore", label: "Score", numeric: true },
    ],
    rq.map(p => ({ ...p, _id: p.npi }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ACTION TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

function renderDxActions() {
  if (!dxResults || !anomalyTracker) return '<div class="empty"><div>Run the pipeline first to see Dx analytics</div></div>';

  const summary = anomalyTracker.getSummary();
  const openCount = (summary.byStatus.DETECTED || 0) + (summary.byStatus.ASSIGNED || 0);
  const resolvedCount = summary.byStatus.RESOLVED || 0;

  let html = `<div class="card" style="margin-bottom:12px"><div class="cardBody" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:14px;font-weight:600">`;
  html += `<span style="color:#ef4444">🔴 P1: ${summary.byPriority[1] || 0}</span>`;
  html += `<span style="color:#eab308">🟡 P2: ${summary.byPriority[2] || 0}</span>`;
  html += `<span style="color:#22c55e">🟢 P3: ${summary.byPriority[3] || 0}</span>`;
  html += `<span>| Open: ${openCount}</span>`;
  html += `<span>| Resolved: ${resolvedCount}</span>`;
  html += `</div></div>`;

  html += `<div class="card" style="margin-bottom:12px"><div class="cardBody" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">`;
  html += `<button class="btn dxFilterBtn active" data-filter="all">All</button>`;
  html += `<button class="btn dxFilterBtn" data-filter="open">Open</button>`;
  html += `<button class="btn dxFilterBtn" data-filter="p1">P1</button>`;
  html += `<button class="btn dxFilterBtn" data-filter="p2">P2</button>`;
  html += `<button class="btn dxFilterBtn" data-filter="p3">P3</button>`;

  const providers = new Set();
  const rules = new Set();
  for (const a of anomalyTracker.anomalies) {
    if (a.billingProvider) providers.add(a.billingProvider);
    rules.add(a.ruleId);
  }

  html += `<select id="dxFilterProvider" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:13px"><option value="">All Providers</option>`;
  for (const p of [...providers].sort()) html += `<option value="${esc(p)}">${esc(p)}</option>`;
  html += `</select>`;

  html += `<select id="dxFilterRule" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:13px"><option value="">All Rules</option>`;
  for (const r of [...rules].sort()) html += `<option value="${esc(r)}">${esc(r)}</option>`;
  html += `</select>`;

  html += `</div></div>`;

  html += `<div class="card"><div class="cardHead"><div class="cardTitle">Worklist</div></div><div class="cardBody noPad"><div id="dxWorklistTable"></div></div></div>`;

  html += `<div class="card"><div class="cardHead"><button class="treeToggle" data-tree="resolvedSection"><span class="arrow">▶</span> Resolved Items (${resolvedCount})</button></div><div class="treeChildren collapsed" id="resolvedSection"><div id="dxResolvedTable" style="padding:0"></div></div></div>`;

  return html;
}

let _dxActionFilter = "all";
let _dxProviderFilter = "";
let _dxRuleFilter = "";

function renderWorklistTable() {
  if (!anomalyTracker) return;

  const filters = {};
  if (_dxActionFilter === "open") {
    filters.status = ["DETECTED", "ASSIGNED"];
  } else if (_dxActionFilter === "p1") {
    filters.priority = 1;
  } else if (_dxActionFilter === "p2") {
    filters.priority = 2;
  } else if (_dxActionFilter === "p3") {
    filters.priority = 3;
  }
  if (_dxProviderFilter) filters.providerId = _dxProviderFilter;
  if (_dxRuleFilter) filters.ruleId = _dxRuleFilter;

  const worklist = anomalyTracker.getWorklist(filters).filter(a => a.status !== "RESOLVED");
  const container = document.getElementById("dxWorklistTable");
  if (!container) return;

  const statusPill = (status) => {
    const colors = { DETECTED: "#94a3b8", ASSIGNED: "#3b82f6", RESOLVED: "#22c55e", DEFERRED: "#eab308" };
    const bg = colors[status] || "#94a3b8";
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;font-size:12px;font-weight:600;background:${bg}">${esc(status)}</span>`;
  };

  const prioIcon = (p) => p === 1 ? "🔴" : p === 2 ? "🟡" : "🟢";

  let thtml = '<div class="tableWrap"><table><thead><tr>';
  const cols = ["", "ID", "Rule", "Member", "Provider", "Service Date", "Severity", "Est. RAF ($)", "Status", "Actions"];
  for (const c of cols) thtml += `<th>${esc(c)}</th>`;
  thtml += "</tr></thead><tbody>";

  for (const a of worklist) {
    thtml += `<tr>`;
    thtml += `<td>${prioIcon(a.priority)}</td>`;
    thtml += `<td class="mono">${esc(a.id)}</td>`;
    thtml += `<td>${esc(a.ruleName || a.ruleId)}</td>`;
    thtml += `<td>${esc(a.memberName || a.memberId || "—")}</td>`;
    thtml += `<td class="mono">${esc(a.billingProvider || "—")}</td>`;
    thtml += `<td>${fmtDate(a.serviceDate || "")}</td>`;
    thtml += `<td>${esc(a.severity)}</td>`;
    thtml += `<td class="num">${fmtCur(a.estimatedRevenue || 0)}</td>`;
    thtml += `<td>${statusPill(a.status)}</td>`;
    thtml += `<td style="white-space:nowrap">`;
    thtml += `<button class="btn dxActionBtn" data-action="assign" data-id="${esc(a.id)}" style="font-size:11px;padding:2px 6px;margin:1px">Assign</button>`;
    thtml += `<button class="btn dxActionBtn" data-action="resolve" data-id="${esc(a.id)}" style="font-size:11px;padding:2px 6px;margin:1px">Resolve</button>`;
    thtml += `<button class="btn dxActionBtn" data-action="defer" data-id="${esc(a.id)}" style="font-size:11px;padding:2px 6px;margin:1px">Defer</button>`;
    thtml += `</td>`;
    thtml += `</tr>`;
  }

  thtml += "</tbody></table></div>";
  container.innerHTML = thtml;

  container.querySelectorAll(".dxActionBtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "assign") {
        anomalyTracker.assign(id, "Current User");
        showToast(`Assigned ${id}`);
      } else if (action === "resolve") {
        anomalyTracker.resolve(id, "CORRECTED");
        showToast(`Resolved ${id}`);
      } else if (action === "defer") {
        anomalyTracker.defer(id, "Deferred by user");
        showToast(`Deferred ${id}`);
      }
      renderWorklistTable();
      renderResolvedTable();
      updateActionSummary();
    });
  });
}

function renderResolvedTable() {
  if (!anomalyTracker) return;
  const resolved = anomalyTracker.getWorklist({ status: "RESOLVED" });
  const container = document.getElementById("dxResolvedTable");
  if (!container) return;

  if (resolved.length === 0) {
    container.innerHTML = '<div style="padding:16px;color:#94a3b8">No resolved items yet</div>';
    return;
  }

  renderSortableTable("dxResolvedTable",
    [
      { key: "id", label: "ID", mono: true },
      { key: "ruleName", label: "Rule" },
      { key: "memberName", label: "Member" },
      { key: "severity", label: "Severity" },
      { key: "resolution", label: "Resolution" },
    ],
    resolved.map(a => ({ ...a, memberName: a.memberName || a.memberId || "—", _id: a.id }))
  );
}

function updateActionSummary() {
  if (!anomalyTracker) return;
  const summary = anomalyTracker.getSummary();
  const openCount = (summary.byStatus.DETECTED || 0) + (summary.byStatus.ASSIGNED || 0);
  const resolvedCount = summary.byStatus.RESOLVED || 0;

  const toggleBtn = document.querySelector('[data-tree="resolvedSection"]');
  if (toggleBtn) {
    const arrow = toggleBtn.querySelector(".arrow");
    const arrowHTML = arrow ? arrow.outerHTML : '<span class="arrow">▶</span>';
    toggleBtn.innerHTML = `${arrowHTML} Resolved Items (${resolvedCount})`;
  }
}

function postRenderDxActions() {
  if (!dxResults || !anomalyTracker) return;

  _dxActionFilter = "all";
  _dxProviderFilter = "";
  _dxRuleFilter = "";

  renderWorklistTable();
  renderResolvedTable();

  document.querySelectorAll(".dxFilterBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".dxFilterBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _dxActionFilter = btn.dataset.filter;
      renderWorklistTable();
    });
  });

  const provSelect = document.getElementById("dxFilterProvider");
  if (provSelect) {
    provSelect.addEventListener("change", () => {
      _dxProviderFilter = provSelect.value;
      renderWorklistTable();
    });
  }

  const ruleSelect = document.getElementById("dxFilterRule");
  if (ruleSelect) {
    ruleSelect.addEventListener("change", () => {
      _dxRuleFilter = ruleSelect.value;
      renderWorklistTable();
    });
  }

  document.querySelectorAll("[data-tree]").forEach(btn => {
    if (btn.closest("#mainContent")) {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.tree);
        if (!target) return;
        const arrow = btn.querySelector(".arrow");
        target.classList.toggle("collapsed");
        if (arrow) arrow.classList.toggle("open");
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

const tabRenderers = {
  overview: { render: renderOverview, postRender: postRenderOverview },
  files: { render: renderFiles, postRender: postRenderFiles },
  hierarchy: { render: renderHierarchy, postRender: postRenderHierarchy },
  providers: { render: renderProviders, postRender: postRenderProviders },
  members: { render: renderMembers, postRender: postRenderMembers },
  trending: { render: renderTrending, postRender: postRenderTrending },
  clinical: { render: renderClinical, postRender: postRenderClinical },
  search: { render: renderSearch, postRender: postRenderSearch },
  validation: { render: renderValidation, postRender: postRenderValidation },
  pipeline: { render: renderPipelineTrace, postRender: postRenderPipelineTrace },
  dxOverview: { render: renderDxOverview, postRender: postRenderDxOverview },
  dxGaps: { render: renderDxGaps, postRender: postRenderDxGaps },
  dxProviders: { render: renderDxProviders, postRender: postRenderDxProviders },
  dxActions: { render: renderDxActions, postRender: postRenderDxActions },
};

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tabBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  const renderer = tabRenderers[tab];
  const main = document.getElementById("mainContent");
  if (renderer) {
    main.innerHTML = renderer.render();
    if (renderer.postRender) renderer.postRender();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function executePipeline() {
  const btn = document.getElementById("btnRunPipeline");
  const status = document.getElementById("pipelineStatus");

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running…';
  status.className = "statusBadge running";
  status.textContent = "Processing 500 claims…";

  await new Promise(r => setTimeout(r, 50));

  try {
    const t0 = performance.now();
    pipelineResult = runPipeline(SAMPLE_CLAIMS);
    const elapsed = Math.round(performance.now() - t0);

    status.className = "statusBadge done";
    status.textContent = `✓ Done in ${elapsed}ms — ${pipelineResult.summary.passed} passed, ${pipelineResult.summary.failed} failed`;

    const history = generateMemberHistory(SAMPLE_CLAIMS, 24);
    dxAnalytics = new DxAnalyticsAgent(SAMPLE_CLAIMS, history);
    dxResults = dxAnalytics.getFullAnalytics();
    anomalyTracker = new AnomalyTracker();
    anomalyTracker.addAnomalies([...dxResults.anomalies.p1, ...dxResults.anomalies.p2, ...dxResults.anomalies.p3]);

    showToast(`Pipeline complete: ${pipelineResult.files.length} files generated, ${pipelineResult.summary.total} claims processed in ${elapsed}ms`);
    switchTab(activeTab);
  } catch (err) {
    status.className = "statusBadge error";
    status.textContent = "Pipeline error";
    showToast("Pipeline error: " + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Run Pipeline (500 Claims)";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tabBar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tabBtn");
    if (btn && btn.dataset.tab) switchTab(btn.dataset.tab);
  });

  document.getElementById("btnRunPipeline").addEventListener("click", executePipeline);
  document.getElementById("btnCloseModal").addEventListener("click", hideModal);
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });
});
