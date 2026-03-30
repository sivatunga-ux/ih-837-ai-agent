import { SEARCH_FIELDS, getFieldsByCategory, PAGINATION, DEFAULT_SORT, API_CONTRACT } from "./searchConfig.js";
import { SAMPLE_CLAIMS } from "./sampleData.js";
import { ClaimsSearchEngine } from "./searchEngine.js";

// ── Init ──
const engine = new ClaimsSearchEngine({ fields: SEARCH_FIELDS, pageSize: PAGINATION.defaultPageSize });
engine.loadData(SAMPLE_CLAIMS);

let currentQuery = "";
let currentFilters = {};
let currentSort = { ...DEFAULT_SORT };
let currentPage = 1;
let currentPageSize = PAGINATION.defaultPageSize;
let selectedClaimId = null;

const FACET_KEYS = SEARCH_FIELDS.filter(f => f.facetable).map(f => f.key);

// ── Helpers ──

function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(str ?? "")));
  return d.innerHTML;
}

function fmt$(n) {
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); setTimeout(() => { el.style.display = "none"; }, 250); }, 2400);
}

let debounceTimer = null;
function debounce(fn, ms) {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── Build Search Panel ──

function buildSearchPanel() {
  const panel = document.getElementById("searchPanel");
  const cats = getFieldsByCategory();
  const catOrder = ["Member", "Demographics", "Claim", "Billing Provider", "Rendering Provider", "Clinical", "Payer"];

  let html = "";

  html += `<div class="globalSearchBox">
    <input type="text" class="globalSearchInput" id="globalSearch" placeholder="Search across all fields…" autocomplete="off" />
  </div>`;

  html += `<div class="searchActions">
    <button class="btnSearch" id="btnSearch">Search</button>
    <button class="btnClear" id="btnClear">Clear All</button>
  </div>`;

  html += `<div class="searchGroups">`;

  for (const cat of catOrder) {
    const fields = cats[cat];
    if (!fields) continue;

    html += `<div class="searchGroup" data-cat="${esc(cat)}">
      <div class="searchGroupHeader">
        <span>${esc(cat)}</span>
        <span class="chevron"></span>
      </div>
      <div class="searchGroupBody">`;

    for (const f of fields) {
      html += `<div class="searchField">`;
      html += `<label for="sf_${esc(f.key)}">${esc(f.label)}</label>`;

      if (f.type === "select" && f.options) {
        html += `<select id="sf_${esc(f.key)}" data-key="${esc(f.key)}">`;
        html += `<option value="">All</option>`;
        for (const opt of f.options) {
          html += `<option value="${esc(opt.value)}">${esc(opt.label)}</option>`;
        }
        html += `</select>`;
      } else if (f.type === "date") {
        html += `<input type="date" id="sf_${esc(f.key)}" data-key="${esc(f.key)}" />`;
      } else if (f.type === "range") {
        html += `<div class="rangeInputs">
          <input type="number" id="sf_${esc(f.key)}_min" data-key="${esc(f.key)}" data-range="min" placeholder="Min" step="any" />
          <span class="rangeSep">–</span>
          <input type="number" id="sf_${esc(f.key)}_max" data-key="${esc(f.key)}" data-range="max" placeholder="Max" step="any" />
        </div>`;
      } else {
        html += `<input type="text" id="sf_${esc(f.key)}" data-key="${esc(f.key)}" placeholder="${esc(f.placeholder || "")}" autocomplete="off" />`;
      }

      html += `</div>`;
    }

    html += `</div></div>`;
  }

  html += `</div>`;
  panel.innerHTML = html;

  document.getElementById("globalSearch").addEventListener("input", debounce(onSearchInput, 200));
  document.getElementById("globalSearch").addEventListener("keydown", e => { if (e.key === "Enter") executeSearch(); });
  document.getElementById("btnSearch").addEventListener("click", executeSearch);
  document.getElementById("btnClear").addEventListener("click", clearAll);

  panel.querySelectorAll(".searchGroupHeader").forEach(hdr => {
    hdr.addEventListener("click", () => {
      hdr.parentElement.classList.toggle("collapsed");
    });
  });

  panel.querySelectorAll(".searchField input, .searchField select").forEach(el => {
    el.addEventListener("input", debounce(onFilterInput, 200));
    el.addEventListener("change", onFilterInput);
  });
}

// ── Gather Filters ──

function gatherFilters() {
  const filters = {};
  const panel = document.getElementById("searchPanel");

  panel.querySelectorAll(".searchField input[data-key], .searchField select[data-key]").forEach(el => {
    const key = el.dataset.key;
    const rangeType = el.dataset.range;

    if (rangeType) {
      if (!filters[key] || typeof filters[key] !== "object") filters[key] = {};
      const val = el.value.trim();
      if (val !== "") filters[key][rangeType] = parseFloat(val);
      if (Object.keys(filters[key]).length === 0) delete filters[key];
    } else {
      const val = el.value.trim();
      if (val) filters[key] = val;
    }
  });

  return filters;
}

// ── Search Execution ──

function clearAll() {
  document.getElementById("globalSearch").value = "";
  const panel = document.getElementById("searchPanel");
  panel.querySelectorAll(".searchField input, .searchField select").forEach(el => { el.value = ""; });
  currentQuery = "";
  currentFilters = {};
  currentPage = 1;
  selectedClaimId = null;
  closeDetail();
  executeSearch();
  showToast("Filters cleared");
}

function onSearchInput() {
  currentQuery = document.getElementById("globalSearch").value;
  currentPage = 1;
  executeSearch();
}

function onFilterInput() {
  currentFilters = gatherFilters();
  currentPage = 1;
  executeSearch();
}

function executeSearch() {
  currentQuery = document.getElementById("globalSearch").value;
  currentFilters = gatherFilters();

  const result = engine.search({
    query: currentQuery,
    filters: currentFilters,
    sort: currentSort,
    page: currentPage,
    pageSize: currentPageSize,
    facetKeys: FACET_KEYS
  });

  renderResultsHeader(result);
  renderFacetsBar(result.facets);
  renderResultsBody(result);
  renderPagination(result);
}

// ── Render Results Header ──

function renderResultsHeader(result) {
  const el = document.getElementById("resultsHeader");
  const start = (result.page - 1) * result.pageSize + 1;
  const end = Math.min(start + result.pageSize - 1, result.total);

  let html = `<div class="resultsInfo">`;
  if (result.total > 0) {
    html += `Showing <strong>${start}–${end}</strong> of <strong>${result.total.toLocaleString()}</strong> results`;
  } else {
    html += `<strong>No results found</strong>`;
  }
  html += `<span class="took">(${result.took}ms)</span>`;
  html += `</div>`;

  html += `<div class="resultsControls">`;

  html += `<span class="controlLabel">Sort</span>`;
  html += `<select class="controlSelect" id="sortSelect">`;
  const sortableFields = SEARCH_FIELDS.filter(f => f.sortable);
  for (const f of sortableFields) {
    const descSel = (currentSort.field === f.key && currentSort.direction === "desc") ? " selected" : "";
    const ascSel = (currentSort.field === f.key && currentSort.direction === "asc") ? " selected" : "";
    html += `<option value="${esc(f.key)}|desc"${descSel}>${esc(f.label)} ↓</option>`;
    html += `<option value="${esc(f.key)}|asc"${ascSel}>${esc(f.label)} ↑</option>`;
  }
  html += `</select>`;

  html += `<span class="controlLabel">Per page</span>`;
  html += `<select class="controlSelect" id="pageSizeSelect">`;
  for (const sz of PAGINATION.pageSizeOptions) {
    const sel = sz === currentPageSize ? " selected" : "";
    html += `<option value="${sz}"${sel}>${sz}</option>`;
  }
  html += `</select>`;

  html += `</div>`;
  el.innerHTML = html;

  document.getElementById("sortSelect").addEventListener("change", e => {
    const [field, direction] = e.target.value.split("|");
    currentSort = { field, direction };
    currentPage = 1;
    executeSearch();
  });

  document.getElementById("pageSizeSelect").addEventListener("change", e => {
    currentPageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    executeSearch();
  });
}

// ── Render Facets ──

function renderFacetsBar(facets) {
  const el = document.getElementById("facetsBar");
  if (!facets || Object.keys(facets).length === 0) {
    el.innerHTML = "";
    return;
  }

  const facetFieldLabels = {};
  for (const f of SEARCH_FIELDS) facetFieldLabels[f.key] = f.label;

  let html = "";
  for (const fk of FACET_KEYS) {
    const buckets = facets[fk];
    if (!buckets || Object.keys(buckets).length === 0) continue;

    const entries = Object.entries(buckets).slice(0, 6);

    html += `<div class="facetGroup">`;
    html += `<span class="facetGroupLabel">${esc(facetFieldLabels[fk] || fk)}</span>`;
    for (const [value, count] of entries) {
      const isActive = currentFilters[fk] && String(currentFilters[fk]).toLowerCase() === value.toLowerCase();
      html += `<span class="facetChip${isActive ? " active" : ""}" data-fkey="${esc(fk)}" data-fval="${esc(value)}">
        ${esc(value)} <span class="facetCount">${count}</span>
      </span>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;

  el.querySelectorAll(".facetChip").forEach(chip => {
    chip.addEventListener("click", () => {
      const fkey = chip.dataset.fkey;
      const fval = chip.dataset.fval;

      if (chip.classList.contains("active")) {
        delete currentFilters[fkey];
        const input = document.querySelector(`[data-key="${fkey}"]`);
        if (input) input.value = "";
      } else {
        currentFilters[fkey] = fval;
        const input = document.querySelector(`[data-key="${fkey}"]`);
        if (input) input.value = fval;
      }

      currentPage = 1;
      executeSearch();
    });
  });
}

// ── Render Results Table ──

function renderResultsBody(result) {
  const el = document.getElementById("resultsBody");

  if (result.total === 0) {
    el.innerHTML = `<div class="noResults">
      <div class="noResultsIcon">🔍</div>
      <div class="noResultsText">No claims found</div>
      <div class="noResultsSub">Try adjusting your search criteria or clearing filters</div>
    </div>`;
    return;
  }

  const cols = [
    { key: "claimId",          label: "Claim ID",   sortField: "claimId" },
    { key: "claimType",        label: "Type",        sortField: "claimType" },
    { key: "claimStatus",      label: "Status",      sortField: "claimStatus" },
    { key: "memberName",       label: "Member",      sortField: "lastName" },
    { key: "serviceDateFrom",  label: "Service Date",sortField: "serviceDateFrom" },
    { key: "renderingName",    label: "Provider",    sortField: "renderingName" },
    { key: "totalCharge",      label: "Charge",      sortField: "totalCharge" },
    { key: "dxCode",           label: "Primary Dx",  sortField: null }
  ];

  let html = `<table class="resultsTable"><thead><tr>`;
  for (const col of cols) {
    const isActive = col.sortField && currentSort.field === col.sortField;
    const arrow = isActive ? (currentSort.direction === "asc" ? "▲" : "▼") : "⇅";
    const cls = isActive ? " sortActive" : "";
    const sortAttr = col.sortField ? `data-sort="${esc(col.sortField)}"` : "";
    html += `<th class="${cls}" ${sortAttr}>${esc(col.label)}<span class="sortArrow">${arrow}</span></th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const claim of result.results) {
    const isSelected = claim.id === selectedClaimId;
    const memberName = `${claim.subscriber.lastName}, ${claim.subscriber.firstName}`;
    const typeClass = claim.claimType === "837P" ? "prof" : "inst";
    const primaryDx = claim.diagnoses && claim.diagnoses.length > 0 ? claim.diagnoses[0].code : "—";

    html += `<tr class="claimRow${isSelected ? " selected" : ""}" data-id="${esc(claim.id)}">`;
    html += `<td><span class="claimId">${esc(claim.id)}</span></td>`;
    html += `<td><span class="typeBadge ${typeClass}">${esc(claim.claimType)}</span></td>`;
    html += `<td><span class="statusBadge ${esc(claim.claimStatus)}">${esc(claim.claimStatus)}</span></td>`;
    html += `<td><span class="memberName">${esc(memberName)}</span><span class="memberId">${esc(claim.subscriber.memberId)}</span></td>`;
    html += `<td>${esc(claim.serviceDateFrom)}</td>`;
    html += `<td class="truncate" title="${esc(claim.renderingProvider?.name || "")}">${esc(claim.renderingProvider?.name || "—")}</td>`;
    html += `<td class="chargeAmount text-right">${fmt$(claim.totalChargeAmount)}</td>`;
    html += `<td><span class="mono">${esc(primaryDx)}</span></td>`;
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  el.innerHTML = html;

  el.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const sortField = th.dataset.sort;
      if (currentSort.field === sortField) {
        currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentSort = { field: sortField, direction: "asc" };
      }
      currentPage = 1;
      executeSearch();
    });
  });

  el.querySelectorAll(".claimRow").forEach(row => {
    row.addEventListener("click", () => {
      selectedClaimId = row.dataset.id;
      selectClaim(selectedClaimId);
      el.querySelectorAll(".claimRow").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
    });
  });
}

// ── Render Pagination ──

function renderPagination(result) {
  const el = document.getElementById("pagination");
  if (result.totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  const page = result.page;
  const total = result.totalPages;

  let pages = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < total - 2) pages.push("…");
    pages.push(total);
  }

  let html = `<button class="pageBtn" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>← Prev</button>`;

  for (const p of pages) {
    if (p === "…") {
      html += `<span class="pageEllipsis">…</span>`;
    } else {
      html += `<button class="pageBtn${p === page ? " active" : ""}" data-page="${p}">${p}</button>`;
    }
  }

  html += `<button class="pageBtn" data-page="${page + 1}" ${page === total ? "disabled" : ""}>Next →</button>`;
  html += `<span class="pageInfo">Page ${page} of ${total}</span>`;

  el.innerHTML = html;

  el.querySelectorAll(".pageBtn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      currentPage = parseInt(btn.dataset.page, 10);
      executeSearch();
      document.getElementById("resultsBody").scrollTop = 0;
    });
  });
}

// ── Detail Panel ──

let activeDetailTab = "summary";

function selectClaim(claimId) {
  const claim = engine.getById(claimId);
  if (!claim) return;

  const panel = document.getElementById("detailPanel");
  panel.classList.add("open");
  activeDetailTab = "summary";
  renderDetailPanel(claim);
}

function closeDetail() {
  const panel = document.getElementById("detailPanel");
  panel.classList.remove("open");
  selectedClaimId = null;
  panel.innerHTML = `<div class="detailEmpty">Select a claim to view details</div>`;
  document.querySelectorAll(".claimRow.selected").forEach(r => r.classList.remove("selected"));
}

function renderDetailPanel(claim) {
  const panel = document.getElementById("detailPanel");
  const tabs = ["Summary", "Member", "Providers", "Clinical", "Payer"];

  let html = `<div class="detailHeader">
    <div>
      <div class="detailHeaderTitle">Claim Detail</div>
      <div class="detailHeaderId">${esc(claim.id)} · ${esc(claim.patientControlNumber)}</div>
    </div>
    <button class="detailCloseBtn" id="detailClose" title="Close">✕</button>
  </div>`;

  html += `<div class="detailTabs">`;
  for (const t of tabs) {
    const key = t.toLowerCase();
    html += `<div class="detailTab${key === activeDetailTab ? " active" : ""}" data-tab="${key}">${t}</div>`;
  }
  html += `</div>`;

  html += `<div class="detailBody">`;
  html += renderDetailTabContent(claim, activeDetailTab);
  html += `</div>`;

  panel.innerHTML = html;

  document.getElementById("detailClose").addEventListener("click", closeDetail);

  panel.querySelectorAll(".detailTab").forEach(tab => {
    tab.addEventListener("click", () => {
      activeDetailTab = tab.dataset.tab;
      renderDetailPanel(claim);
    });
  });
}

function renderDetailTabContent(claim, tab) {
  switch (tab) {
    case "summary": return renderSummaryTab(claim);
    case "member": return renderMemberTab(claim);
    case "providers": return renderProvidersTab(claim);
    case "clinical": return renderClinicalTab(claim);
    case "payer": return renderPayerTab(claim);
    default: return "";
  }
}

function renderSummaryTab(claim) {
  const memberName = `${claim.subscriber.firstName} ${claim.subscriber.lastName}`;
  return `
    <div class="detailCard">
      <div class="detailCardTitle">Claim Info</div>
      ${detailRow("Claim ID", claim.id)}
      ${detailRow("PCN", claim.patientControlNumber)}
      ${detailRow("Type", `<span class="typeBadge ${claim.claimType === "837P" ? "prof" : "inst"}">${esc(claim.claimType)}</span>`)}
      ${detailRow("Status", `<span class="statusBadge ${esc(claim.claimStatus)}">${esc(claim.claimStatus)}</span>`)}
      ${detailRow("Total Charge", fmt$(claim.totalChargeAmount))}
      ${detailRow("Place of Svc", claim.facilityCode)}
    </div>
    <div class="detailCard">
      <div class="detailCardTitle">Dates</div>
      ${detailRow("Service From", claim.serviceDateFrom)}
      ${detailRow("Service To", claim.serviceDateTo)}
    </div>
    <div class="detailCard">
      <div class="detailCardTitle">Key Parties</div>
      ${detailRow("Member", memberName)}
      ${detailRow("Member ID", claim.subscriber.memberId, true)}
      ${detailRow("Rendering", claim.renderingProvider?.name || "—")}
      ${detailRow("Billing", claim.billingProvider?.name || "—")}
      ${detailRow("Payer", claim.payer?.name || "—")}
    </div>`;
}

function renderMemberTab(claim) {
  const s = claim.subscriber;
  return `
    <div class="detailCard">
      <div class="detailCardTitle">Subscriber / Member</div>
      ${detailRow("Member ID", s.memberId, true)}
      ${detailRow("Last Name", s.lastName)}
      ${detailRow("First Name", s.firstName)}
      ${detailRow("Middle", s.middleName)}
      ${detailRow("DOB", s.dateOfBirth)}
      ${detailRow("Gender", s.gender)}
    </div>
    <div class="detailCard">
      <div class="detailCardTitle">Address</div>
      ${detailRow("Street", s.addressLine1)}
      ${detailRow("City", s.city)}
      ${detailRow("State", s.state)}
      ${detailRow("ZIP", s.zipCode, true)}
    </div>`;
}

function renderProvidersTab(claim) {
  const b = claim.billingProvider || {};
  const r = claim.renderingProvider || {};
  return `
    <div class="detailCard">
      <div class="detailCardTitle">Billing Provider</div>
      ${detailRow("Name", b.name)}
      ${detailRow("NPI", b.npi, true)}
      ${detailRow("Tax ID", b.taxId, true)}
      ${detailRow("Entity Type", b.entityType === "2" ? "Organization" : "Individual")}
      ${detailRow("City", b.city)}
      ${detailRow("State", b.state)}
    </div>
    <div class="detailCard">
      <div class="detailCardTitle">Rendering Provider</div>
      ${detailRow("Name", r.name)}
      ${detailRow("NPI", r.npi, true)}
      ${detailRow("Taxonomy", r.taxonomy, true)}
      ${detailRow("Entity Type", r.entityType === "1" ? "Individual" : "Organization")}
    </div>`;
}

function renderClinicalTab(claim) {
  let html = `<div class="detailCard">
    <div class="detailCardTitle">Diagnoses (${claim.diagnoses.length})</div>
    <table class="detailTable">
      <thead><tr><th>#</th><th>Code</th><th>Qualifier</th></tr></thead>
      <tbody>`;

  for (const dx of claim.diagnoses) {
    html += `<tr><td>${dx.sequence}</td><td class="mono">${esc(dx.code)}</td><td>${esc(dx.qualifier)}</td></tr>`;
  }

  html += `</tbody></table></div>`;

  html += `<div class="detailCard">
    <div class="detailCardTitle">Service Lines (${claim.serviceLines.length})</div>
    <table class="detailTable">
      <thead><tr><th>#</th><th>CPT</th><th>Charge</th><th>Units</th>${claim.claimType === "837I" ? "<th>Rev</th>" : ""}</tr></thead>
      <tbody>`;

  for (const sl of claim.serviceLines) {
    html += `<tr>
      <td>${sl.lineNumber}</td>
      <td class="mono">${esc(sl.procedureCode)}</td>
      <td>${fmt$(sl.chargeAmount)}</td>
      <td>${sl.unitCount}</td>
      ${claim.claimType === "837I" ? `<td class="mono">${esc(sl.revenueCode)}</td>` : ""}
    </tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}

function renderPayerTab(claim) {
  const p = claim.payer || {};
  return `
    <div class="detailCard">
      <div class="detailCardTitle">Payer Information</div>
      ${detailRow("Payer Name", p.name)}
      ${detailRow("Payer ID", p.id, true)}
    </div>`;
}

function detailRow(label, value, mono) {
  return `<div class="detailRow">
    <span class="detailLabel">${esc(label)}</span>
    <span class="detailValue${mono ? " mono" : ""}">${value ?? "—"}</span>
  </div>`;
}

// ── Stats Badge ──

function renderStats() {
  const el = document.getElementById("stats");
  const stats = engine.getStats();
  const facetCount = FACET_KEYS.length;
  const fieldCount = SEARCH_FIELDS.length;

  el.innerHTML = `
    <span class="statItem"><span class="statNum">${stats.totalClaims}</span> claims indexed</span>
    <span class="statItem"><span class="statNum">${fieldCount}</span> search fields</span>
    <span class="statItem"><span class="statNum">${facetCount}</span> facets</span>`;
}

// ── Init ──

document.addEventListener("DOMContentLoaded", () => {
  buildSearchPanel();
  renderStats();
  executeSearch();
  showToast(`Loaded ${SAMPLE_CLAIMS.length} claims • Ready to search`);
});
