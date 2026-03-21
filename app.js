/*************************
 * Invent Health • 837 Risk Analyzer Demo (no backend)
 * Extended workflow:
 *  - CPT fixes => Adjustment/Void payload
 *  - DX add/fix => Linked Chart Review with evidence (CCD + provider query + docs)
 *************************/

const LOGO_URL = "https://inventhealth.com/wp-content/uploads/2025/06/Option-3-2-e1748444120210.png";
const logoEl = document.getElementById("logoImg");
if (logoEl) logoEl.src = LOGO_URL;

/* ---------- Storage ---------- */
const STORE = {
  runs: "ih_ra837_runs_v5",
  actions: "ih_ra837_actions_v5",
  audit: "ih_ra837_audit_v5",
  notifs: "ih_ra837_notifs_v5",
  library: "ih_ra837_doclib_v5",
  loaded: "ih_ra837_loaded_inputs_v5"
};

const nowISO = () => new Date().toISOString();
const uid = () => Math.random().toString(16).slice(2, 10) + "_" + Date.now().toString(16);

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

let runs = loadJSON(STORE.runs, []);
let actions = loadJSON(STORE.actions, []);
let audit = loadJSON(STORE.audit, []);
let notifs = loadJSON(STORE.notifs, []);
let doclib = loadJSON(STORE.library, []);
let loadedInputs = loadJSON(STORE.loaded, []);

let selectedRunId = runs[0]?.id || null;
let selectedActionId = actions[0]?.id || null;

/* ---------- Constants & Rules ---------- */
const CHANGE_TYPE = {
  CPT_ADJUSTMENT: "CPT_ADJUSTMENT",
  DX_LINKED_CHART_REVIEW: "DX_LINKED_CHART_REVIEW",
  DX_CORRECTION_WITH_EVIDENCE: "DX_CORRECTION_WITH_EVIDENCE"
};

const NON_RISK_ELIGIBLE_CPTS = new Set(["36415", "81002", "93000"]);     // demo
const IHA_CPTS = new Set(["99341","99342","99344","99345","99347","99348","99349","99350","G0402","G0438","G0439"]);
const VALID_POS = new Set(["11","12","19","22","23","31","32","34","49","50","53","57","61"]);
const POS_FIX_MAP = { "00":"11", "99":"11", "":"11" };

// “Opportunity” CPT signals
const CPT_AMPUTATION = new Set(["27880","27882","27590","27592"]);
const CPT_TRANSPLANT = new Set(["50360","50365"]);

function isPharmacyLikeCPT(cpt) { return /^J\d{4}$/.test(cpt || "") || ["J3490","J3590","J9999"].includes(cpt); }

// Demo DX recommendations
const DX_RECOS = {
  AMP_STATUS_MISSING_Z89: { add: ["Z89.9"], reason: "Amputation procedure present; add Z89.* status with laterality if documented." },
  TX_STATUS_MISSING_Z94:  { add: ["Z94.0"], reason: "Transplant procedure present; add Z94.* status if supported." },
  ESRD_DEPENDENCE_MISSING_Z992: { add: ["Z99.2"], reason: "ESRD present; add Z99.2 dialysis dependence if supported." }
};

// Demo “RAF impact” scoring
const SIGNAL_IMPACT = {
  AMP_STATUS_MISSING_Z89: { raf: 0.18, roi: 1400, label: "Amputation status (Z89.*)" },
  TX_STATUS_MISSING_Z94:  { raf: 0.22, roi: 1800, label: "Transplant status (Z94.*)" },
  ESRD_DEPENDENCE_MISSING_Z992: { raf: 0.32, roi: 2600, label: "Dialysis dependence (Z99.2)" }
};

/* ---------- UI helpers ---------- */
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 2200);
}
function addAudit(eventType, details) {
  audit.unshift({ id: uid(), ts: nowISO(), eventType, details });
  saveJSON(STORE.audit, audit);
  renderAudit();
}
function addNotif(title, text) {
  notifs.unshift({ id: uid(), ts: nowISO(), title, text });
  saveJSON(STORE.notifs, notifs);
  renderNotifications();
}
function esc(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ---------- X12 helpers ---------- */
function splitSegs(x12) { return (x12 || "").split("~").map(s => s.trim()).filter(Boolean); }
function joinSegs(segs) { return segs.join("~\n") + "~\n"; }

function getSubscriberId(segs) {
  for (const s of segs) {
    if (s.startsWith("NM1*IL*")) {
      const p = s.split("*");
      if ((p[8] || "") === "MI") return (p[9] || "").trim();
    }
  }
  return "";
}
function getRenderingNPI(segs) {
  for (const s of segs) {
    if (s.startsWith("NM1*82*")) {
      const p = s.split("*");
      if ((p[8] || "") === "XX") return (p[9] || "").trim();
    }
  }
  return "";
}
function getDOS(segs) {
  for (const s of segs) if (s.startsWith("DTP*472*D8*")) return (s.split("*")[3] || "").trim();
  return "";
}
function isYYYYMMDD(s) {
  if (!/^\d{8}$/.test(s || "")) return false;
  const y = +s.slice(0,4), m = +s.slice(4,6), d = +s.slice(6,8);
  const dt = new Date(Date.UTC(y, m-1, d));
  return dt.getUTCFullYear()===y && (dt.getUTCMonth()+1)===m && dt.getUTCDate()===d;
}
function getClaimPOS(segs) {
  for (const s of segs) {
    if (s.startsWith("CLM*")) {
      const parts = s.split("*");
      const clm05 = parts[5] || "";
      return (clm05.split(":")[0] || "").trim();
    }
  }
  return "";
}
function getCPTs(segs) {
  const out = [];
  for (const s of segs) {
    if (s.startsWith("SV1*") && s.includes("HC:")) {
      const p = s.split("*");
      const proc = (p[1] || "");
      if (proc.startsWith("HC:")) out.push(proc.slice(3).trim());
    }
  }
  return out;
}
function getICDs(segs) {
  const out = [];
  for (const s of segs) {
    if (s.startsWith("HI*")) {
      const parts = s.split("*").slice(1);
      for (const c of parts) {
        const idx = c.indexOf(":");
        if (idx > 0) {
          const qual = c.slice(0, idx);
          const code = c.slice(idx + 1).trim();
          if (qual === "ABK" && code) out.push(code);
        }
      }
    }
  }
  return out;
}
function titleCase(str) {
  const t = (str || "").toLowerCase();
  return t.replace(/\b[a-z]/g, m => m.toUpperCase());
}

/* ---------- NEW: simple ICD validity demo ---------- */
function isValidICD10Demo(dx) {
  // Not a real ICD validator. For demo:
  // - allow A00-Z99 patterns with optional dot + up to 4 chars
  return /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/.test(dx || "");
}

/* ---------- Validations / Findings ---------- */
function validate837(x12) {
  const segs = splitSegs(x12);
  const findings = [];

  const memberId = getSubscriberId(segs);
  const dos = getDOS(segs);
  const npi = getRenderingNPI(segs);
  const pos = getClaimPOS(segs);
  const cpts = getCPTs(segs);
  const icds = getICDs(segs);

  // Rejection-style issues
  if (!memberId) findings.push({ level:"FATAL", type:"837_REJECTION", code:"MISSING_SUBSCRIBER_ID", msg:"Subscriber ID missing in NM1*IL (MI qualifier not populated)." });
  if (!dos) findings.push({ level:"FATAL", type:"837_REJECTION", code:"MISSING_DOS", msg:"Missing Date of Service (DTP*472*D8)." });
  else if (!isYYYYMMDD(dos)) findings.push({ level:"FATAL", type:"837_REJECTION", code:"INVALID_DOS", msg:`Invalid DOS format/value: ${dos}` });
  if (!npi) findings.push({ level:"FATAL", type:"837_REJECTION", code:"MISSING_RENDERING_NPI", msg:"Rendering provider NPI missing in NM1*82*...*XX*NPI." });

  // Data quality
  if (!pos || !VALID_POS.has(pos)) findings.push({ level:"WARN", type:"837_QUALITY", code:"INVALID_POS", msg:`Invalid or non-standard POS "${pos}".` });

  // RA eligibility blocks
  const nonEligible = cpts.filter(c => NON_RISK_ELIGIBLE_CPTS.has(c));
  if (nonEligible.length) findings.push({ level:"RA_BLOCK", type:"RISK_ELIGIBILITY", code:"NON_RISK_ELIGIBLE_CPT", msg:`Non-risk-eligible CPT(s): ${nonEligible.join(", ")}.` });

  if (cpts.length && cpts.every(isPharmacyLikeCPT)) findings.push({ level:"RA_BLOCK", type:"RISK_ELIGIBILITY", code:"PHARMACY_ONLY_SERVICES", msg:"All service lines appear pharmacy/drug-only (J-code bucket)." });

  // Program rule: remove dx from IHA/AWV (demo)
  const ihaHit = cpts.some(c => IHA_CPTS.has(c));
  if (ihaHit && icds.length) findings.push({ level:"WARN", type:"PROGRAM_RULE", code:"IHA_DIAGNOSES_PRESENT", msg:"IHA/AWV visit includes diagnosis codes. Demo rule: remove HI diagnosis segment(s)." });

  // NEW: invalid dx format -> DX correction workflow
  const invalid = icds.filter(dx => !isValidICD10Demo(dx));
  if (invalid.length) findings.push({ level:"WARN", type:"DIAGNOSIS_QUALITY", code:"INVALID_DIAGNOSIS", msg:`Diagnosis code(s) look invalid (demo validator): ${invalid.join(", ")}.` });

  // “Prospective gaps”
  const hasAmputationCPT = cpts.some(c => CPT_AMPUTATION.has(c));
  const hasTransplantCPT = cpts.some(c => CPT_TRANSPLANT.has(c));
  const hasZ89 = icds.some(dx => dx.startsWith("Z89"));
  const hasZ94 = icds.some(dx => dx.startsWith("Z94"));
  const hasN186 = icds.includes("N18.6");
  const hasZ992 = icds.includes("Z99.2");

  if (hasAmputationCPT && !hasZ89) findings.push({ level:"SIGNAL", type:"PROSPECTIVE_GAP", code:"AMP_STATUS_MISSING_Z89", msg:"Amputation procedure present but Z89.* status not found." });
  if (hasTransplantCPT && !hasZ94) findings.push({ level:"SIGNAL", type:"PROSPECTIVE_GAP", code:"TX_STATUS_MISSING_Z94", msg:"Transplant procedure present but Z94.* status not found." });
  if (hasN186 && !hasZ992) findings.push({ level:"SIGNAL", type:"PROSPECTIVE_GAP", code:"ESRD_DEPENDENCE_MISSING_Z992", msg:"ESRD (N18.6) found but Z99.2 dialysis dependence not found." });

  return { segs, findings, memberId };
}

/* ---------- Repairs (auditable, demo-safe) ---------- */
function applyRepairs(x12) {
  let segs = splitSegs(x12);
  const repairs = [];

  // Fix POS
  const pos = getClaimPOS(segs);
  if (!pos || !VALID_POS.has(pos)) {
    const replacement = POS_FIX_MAP[pos] || POS_FIX_MAP[""];
    const idx = segs.findIndex(s => s.startsWith("CLM*"));
    if (idx >= 0) {
      const before = segs[idx];
      const parts = before.split("*");
      const clm05 = parts[5] || "";
      const rest = clm05.includes(":") ? clm05.split(":").slice(1).join(":") : "B:1";
      parts[5] = `${replacement}:${rest}`;
      segs[idx] = parts.join("*");
      repairs.push({ type:"FIX_POS", before, after:segs[idx], count:1, reason:`Mapped POS "${pos}" → "${replacement}".` });
    }
  }

  // Normalize provider name casing
  for (let i=0;i<segs.length;i++){
    if (segs[i].startsWith("NM1*82*")) {
      const before = segs[i];
      const p = before.split("*");
      const last = p[3] || "";
      const first = p[4] || "";
      const fixedLast = titleCase(last);
      const fixedFirst = titleCase(first);
      if ((last && fixedLast !== last) || (first && fixedFirst !== first)) {
        p[3] = fixedLast; p[4] = fixedFirst;
        segs[i] = p.join("*");
        repairs.push({ type:"NORMALIZE_PROVIDER_NAME", before, after:segs[i], count:1, reason:"Normalized provider name casing." });
      }
    }
  }

  // Remove dx from IHA claims
  const cpts = getCPTs(segs);
  const ihaHit = cpts.some(c => IHA_CPTS.has(c));
  if (ihaHit) {
    const hiCount = segs.filter(s => s.startsWith("HI*")).length;
    if (hiCount) {
      const beforeSample = segs.find(s => s.startsWith("HI*")) || "";
      segs = segs.filter(s => !s.startsWith("HI*"));
      repairs.push({ type:"REMOVE_DX_FROM_IHA", before:beforeSample, after:"(HI segment removed)", count:hiCount, reason:"Demo rule: remove diagnosis codes from IHA/AWV claim." });
    }
  }

  return { repaired: joinSegs(segs), repairs };
}

/* ---------- Summary ---------- */
function summarize(repairs, findings) {
  const repairsByType = {};
  let repairsTotal = 0;
  for (const r of repairs) {
    repairsByType[r.type] = (repairsByType[r.type] || 0) + (r.count || 1);
    repairsTotal += (r.count || 1);
  }
  const fatal = findings.filter(f => f.level === "FATAL").length;
  const raBlocks = findings.filter(f => f.level === "RA_BLOCK").length;
  const signals = findings.filter(f => f.level === "SIGNAL").length;
  const warns = findings.filter(f => f.level === "WARN").length;
  return { repairsTotal, repairsByType, fatal, raBlocks, signals, warns };
}

function computeStatus(findings) {
  const hasFatal = findings.some(f => f.level === "FATAL");
  const hasRABlock = findings.some(f => f.level === "RA_BLOCK");
  if (hasFatal) return "FAIL";
  if (hasRABlock) return "RA_BLOCKED";
  return "PASS";
}

/* ---------- Batch ---------- */
async function runBatch(inputs) {
  const newRuns = [];
  for (const item of inputs) {
    const raw = item.text.includes("~") ? item.text : joinSegs(splitSegs(item.text));
    const rep = applyRepairs(raw);
    const v2 = validate837(rep.repaired);
    const status = computeStatus(v2.findings);

    const run = {
      id: uid(),
      name: item.name,
      createdAt: nowISO(),
      memberId: v2.memberId || "",
      raw,
      repaired: rep.repaired,
      findings: v2.findings,
      repairs: rep.repairs,
      status,
      step: "INGESTED → PARSED → VALIDATED → REPAIRED",
      summary: summarize(rep.repairs, v2.findings)
    };
    newRuns.push(run);

    addAudit("RUN_CREATED", {
      run: run.name,
      status: run.status,
      repairs: run.summary.repairsTotal,
      fatal: run.summary.fatal,
      raBlocks: run.summary.raBlocks,
      signals: run.summary.signals
    });
  }

  runs = [...newRuns, ...runs];
  saveJSON(STORE.runs, runs);

  selectedRunId = newRuns[0]?.id || selectedRunId;
  addNotif("Validation complete", `Processed ${newRuns.length} file(s).`);
  toast("Validation complete");

  renderAll();
}

/* ---------- Action classification (NEW) ---------- */
function classifyChangeType(finding) {
  // CPT-related blocks => adjustment workflow
  if (finding.code === "NON_RISK_ELIGIBLE_CPT" || finding.code === "PHARMACY_ONLY_SERVICES") {
    return CHANGE_TYPE.CPT_ADJUSTMENT;
  }
  // Prospective gaps => linked chart review
  if (finding.level === "SIGNAL" && finding.type === "PROSPECTIVE_GAP") {
    return CHANGE_TYPE.DX_LINKED_CHART_REVIEW;
  }
  // Invalid dx => correction with evidence
  if (finding.code === "INVALID_DIAGNOSIS") {
    return CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE;
  }
  // Default: if it impacts risk, treat as chart-review for demo
  if (finding.type === "RISK_ELIGIBILITY") return CHANGE_TYPE.CPT_ADJUSTMENT;
  return CHANGE_TYPE.DX_LINKED_CHART_REVIEW;
}

function actionPriority(finding) {
  if (finding.level === "FATAL") return "P0";
  if (finding.level === "RA_BLOCK") return "P0";
  if (finding.level === "SIGNAL") return "P1";
  return "P2";
}
function shouldCreateAction(finding, scope) {
  if (scope === "all") return true;
  if (scope === "fatal_ra") return (finding.level === "FATAL" || finding.level === "RA_BLOCK" || finding.level === "SIGNAL");
  if (scope === "ra_only") return finding.level === "RA_BLOCK";
  if (scope === "fatal_only") return finding.level === "FATAL";
  return false;
}

/* ---------- Actions ---------- */
function createActionsFromRuns() {
  const scope = document.getElementById("actionScope")?.value || "fatal_ra";
  const defaultOwner = document.getElementById("assignTo")?.value || "Risk Adjustment Team";
  const created = [];

  for (const run of runs) {
    for (const f of run.findings) {
      if (!shouldCreateAction(f, scope)) continue;

      const changeType = classifyChangeType(f);

      // default routing by changeType
      const owner =
        changeType === CHANGE_TYPE.CPT_ADJUSTMENT ? "Claims Ops" :
        changeType === CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE ? "Coding QA" :
        defaultOwner;

      created.push({
        id: uid(),
        createdAt: nowISO(),
        runId: run.id,
        runName: run.name,
        memberId: run.memberId || "UNKNOWN",
        title: `${f.code}: ${f.msg}`,
        finding: f,
        changeType,
        owner,
        status: "NEW",
        priority: actionPriority(f),
        notes: "",

        // Evidence tracking (NEW)
        evidence: {
          providerQueryGenerated: false,
          ccdAttached: false,
          docsAttachedCount: 0
        },

        // Change plan (NEW) - what we intend to adjust/submit
        changePlan: {
          cpt: { add: [], remove: [], replace: [] },  // replace entries: {from,to}
          dx:  { add: [], remove: [], fix: [] }       // fix entries: {from,to}
        },

        // Submissions (NEW)
        submissions: {
          adjustment: null,        // payload
          linkedChartReview: null  // payload
        },

        docs: []
      });
    }
    run.step = run.step + " → ACTIONS_CREATED";
  }

  if (!created.length) { toast("No actions created for selected scope."); return; }
  actions = [...created, ...actions];
  saveJSON(STORE.actions, actions);
  saveJSON(STORE.runs, runs);
  selectedActionId = created[0].id;

  addAudit("ACTIONS_CREATED", { count: created.length, scope });
  addNotif("Work actions created", `Created ${created.length} action(s) from findings.`);
  toast(`Created ${created.length} actions`);

  renderAll();
}

/* ---------- Integrations payloads (demo) ---------- */
function buildSlackPayload(action) {
  return {
    text:
`Invent Health • 837 Risk Analyzer
*${action.priority}* • ${action.status} • ${action.changeType}
Member: ${action.memberId}
Run: ${action.runName}
Finding: ${action.finding.code}
${action.finding.msg}
Owner: ${action.owner}`
  };
}
function buildTeamsPayload(action) {
  return {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          { type: "TextBlock", size: "Large", weight: "Bolder", text: "Invent Health • 837 Risk Analyzer" },
          { type: "TextBlock", text: `Priority: ${action.priority}   Status: ${action.status}`, wrap: true },
          { type: "TextBlock", text: `Change Type: ${action.changeType}`, wrap: true },
          { type: "TextBlock", text: `Member: ${action.memberId}`, wrap: true },
          { type: "TextBlock", text: `Finding: ${action.finding.code}`, wrap: true, weight: "Bolder" },
          { type: "TextBlock", text: action.finding.msg, wrap: true }
        ]
      }
    }]
  };
}
function buildTicketPayload(action) {
  return {
    system: "Jira/ServiceNow (Demo)",
    fields: {
      project: { key: "RA" },
      issueType: "Task",
      summary: `[${action.priority}] ${action.finding.code} • Member ${action.memberId}`,
      description:
        `Run: ${action.runName}\nOwner: ${action.owner}\nStatus: ${action.status}\nChangeType: ${action.changeType}\n\nFinding:\n${action.finding.msg}\n\nNotes:\n${action.notes || "(none)"}`,
      labels: ["ra837", "riskflow", action.finding.type, action.finding.level, action.changeType].filter(Boolean)
    }
  };
}

function buildProviderQueryText(action) {
  return `
PROVIDER QUERY REQUEST (Demo)

Member ID: ${action.memberId}
Source: 837 Ingestion (run: ${action.runName})
Finding: ${action.finding.code}
Details: ${action.finding.msg}

Requested documentation:
- Most recent progress note with assessment/plan
- Problem list and chronic condition monitoring evidence (MEAT)
- Discharge summary (if applicable)
- CCD / Continuity of Care Document
- Specialist note(s) supporting status conditions (e.g., amputee / transplant / dialysis)

Requested action:
- Confirm documentation supports the condition/status for RA submission.

Invent Health • 837 Risk Analyzer
`;
}

/* ---------- CCD/doc simulation ---------- */
function simulateCCD(memberId) {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument>
  <id extension="${uid()}" />
  <title>CCD (Demo)</title>
  <recordTarget><patientRole><id extension="${memberId}" /></patientRole></recordTarget>
  <component><structuredBody>
    <component><section>
      <title>Problems</title>
      <text>Diabetes mellitus; CKD/ESRD; status conditions (demo)</text>
    </section></component>
  </structuredBody></component>
</ClinicalDocument>`;
  return { name: `CCD_${memberId}.xml`, type: "xml", contentPreview: content.slice(0, 1200) };
}
function addDocToLibrary(memberId, fileName, type, contentPreview) {
  const doc = { id: uid(), memberId, name: fileName, type, createdAt: nowISO(), contentPreview };
  doclib.unshift(doc);
  saveJSON(STORE.library, doclib);
  return doc;
}
async function readFilePreview(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (["pdf","png","jpg","jpeg"].includes(ext)) {
    return `[Binary file demo preview not parsed] File: ${file.name}, Size: ${file.size} bytes`;
  }
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").slice(0, 8000));
    r.readAsText(file);
  });
}

/* ---------- NEW: Adjustment + Linked Chart Review payloads ---------- */
function buildAdjustmentPayload(action) {
  // Demo output: “what we would submit” (not a real 837)
  const plan = action.changePlan;
  return {
    type: "837_ADJUSTMENT",
    mode: "REPLACE", // could be VOID/REPLACE; demo
    memberId: action.memberId,
    sourceRun: action.runName,
    finding: { code: action.finding.code, msg: action.finding.msg },
    changes: {
      cpt: plan.cpt,
      dx: plan.dx
    },
    validationNotes: [
      "CPT change impacts risk eligibility and can require adjustment or void/rebill.",
      "Payload is demo JSON; replace with real 837 generator and payer/CMS rules."
    ],
    createdAt: nowISO()
  };
}

function buildLinkedChartReviewPayload(action) {
  const plan = action.changePlan;
  const docIds = action.docs.slice(0, 10);
  const docRefs = docIds.map(id => {
    const d = doclib.find(x => x.id === id);
    return d ? { name: d.name, type: d.type, createdAt: d.createdAt } : { id };
  });

  return {
    type: "LINKED_CHART_REVIEW_SUBMISSION",
    memberId: action.memberId,
    sourceRun: action.runName,
    finding: { code: action.finding.code, msg: action.finding.msg },
    diagnosisRecommendation: plan.dx,
    evidence: {
      providerQueryGenerated: action.evidence.providerQueryGenerated,
      ccdAttached: action.evidence.ccdAttached,
      attachedDocs: docRefs
    },
    auditReady: true,
    createdAt: nowISO()
  };
}

function getEvidenceChecklist(action) {
  const hasCCD = !!action.evidence.ccdAttached;
  const hasQuery = !!action.evidence.providerQueryGenerated;
  const hasDoc = (action.evidence.docsAttachedCount || 0) > 0;
  return { hasCCD, hasQuery, hasDoc, complete: hasCCD && hasQuery && hasDoc };
}

/* ---------- NEW: Suggest changes for CPT/DX ---------- */
function suggestChanges(action) {
  // Reset suggested changes each click (demo-friendly)
  action.changePlan.cpt = { add: [], remove: [], replace: [] };
  action.changePlan.dx  = { add: [], remove: [], fix: [] };

  // CPT adjustment cases
  if (action.changeType === CHANGE_TYPE.CPT_ADJUSTMENT) {
    if (action.finding.code === "NON_RISK_ELIGIBLE_CPT") {
      // suggest add E/M and remove non-eligible labs
      action.changePlan.cpt.add.push("99213");
      action.changePlan.cpt.remove.push("36415");
      action.changePlan.cpt.remove.push("81002");
    }
    if (action.finding.code === "PHARMACY_ONLY_SERVICES") {
      // suggest add an E/M (demo) to make it eligible
      action.changePlan.cpt.add.push("99213");
    }
    return { summary: "Suggested CPT change plan created (demo): add E/M, remove non-eligible lines.", type: "CPT" };
  }

  // DX linked chart review signals
  if (action.changeType === CHANGE_TYPE.DX_LINKED_CHART_REVIEW && DX_RECOS[action.finding.code]) {
    action.changePlan.dx.add.push(...DX_RECOS[action.finding.code].add);
    return { summary: `Suggested DX add plan: ${DX_RECOS[action.finding.code].add.join(", ")} (evidence required).`, type: "DX_ADD" };
  }

  // DX correction
  if (action.changeType === CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE) {
    // demo “fix”: remove bad token and suggest a plausible corrected one
    // (for real: use CCD, coding rules, and model.)
    action.changePlan.dx.fix.push({ from: "E11.9X", to: "E11.9" });
    return { summary: "Suggested DX correction (demo): E11.9X → E11.9 (requires evidence).", type: "DX_FIX" };
  }

  // Default: no-op
  return { summary: "No suggestions available for this action type.", type: "NONE" };
}

/* ---------- Rendering helpers ---------- */
function dotBadge(status) {
  if (status === "PASS") return `<span class="badge"><span class="dot dotOk"></span>PASS</span>`;
  if (status === "RA_BLOCKED") return `<span class="badge"><span class="dot dotWarn"></span>RA_BLOCKED</span>`;
  if (status === "FAIL") return `<span class="badge"><span class="dot dotBad"></span>FAIL</span>`;
  return `<span class="badge"><span class="dot"></span>${esc(status)}</span>`;
}
function table(headers, rows) {
  if (!rows.length) return `<div class="empty">No data</div>`;
  const th = headers.map(h => `<th>${esc(h)}</th>`).join("");
  const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<div class="tableWrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
function renderLineDiff(before, after) {
  const b = (before || "").split("\n");
  const a = (after || "").split("\n");
  const max = Math.max(b.length, a.length);
  let bHtml = "", aHtml = "";
  for (let i = 0; i < max; i++) {
    const bl = b[i] ?? "";
    const al = a[i] ?? "";
    if (bl === al) { bHtml += `${esc(bl)}\n`; aHtml += `${esc(al)}\n`; }
    else {
      bHtml += bl ? `<div class="lineRemoved">${esc(bl)}</div>` : "\n";
      aHtml += al ? `<div class="lineAdded">${esc(al)}</div>` : "\n";
    }
  }
  return { bHtml, aHtml };
}

/* ---------- Reports ---------- */
function buildTrends() {
  const last = runs.slice(0, 14).reverse(); // oldest → newest
  const points = last.map(r => ({
    name: r.name,
    files: 1,
    errorsFound: (r.summary.fatal + r.summary.raBlocks + r.summary.warns),
    errorsFixed: r.summary.repairsTotal,
    actions: actions.filter(a => a.runId === r.id).length
  }));
  return points;
}

function renderTrendChart() {
  const el = document.getElementById("trendChart");
  if (!el) return;
  const points = buildTrends();
  if (!points.length) { el.innerHTML = `<div class="empty">No runs yet. Run validation to see trending.</div>`; return; }
  const rows = points.map((p, i) => [
    `${i+1}`,
    `<span style="font-weight:900">${esc(p.name)}</span>`,
    `${p.errorsFound}`,
    `${p.errorsFixed}`,
    `${p.actions}`
  ]);
  el.innerHTML = table(["#", "Run", "Errors Found", "Errors Fixed", "Actions Sent"], rows);
}

function renderErrorBreakdown() {
  const el = document.getElementById("errorBreakdown");
  if (!el) return;
  const counts = {};
  for (const r of runs) for (const f of r.findings) counts[f.code] = (counts[f.code] || 0) + 1;

  const top = Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 12)
    .map(([code, n]) => [ `<span style="font-family:var(--mono)">${esc(code)}</span>`, `${n}` ]);

  el.innerHTML = top.length ? table(["Error Code", "Count"], top) : `<div class="empty">No findings yet.</div>`;
}

function renderRAFImpact() {
  const el = document.getElementById("rafImpact");
  if (!el) return;

  const signalCounts = {};
  for (const r of runs) {
    for (const f of r.findings) {
      if (f.level === "SIGNAL" && SIGNAL_IMPACT[f.code]) {
        signalCounts[f.code] = (signalCounts[f.code] || 0) + 1;
      }
    }
  }

  const closedCounts = {};
  for (const a of actions) {
    if (a.finding?.level === "SIGNAL" && SIGNAL_IMPACT[a.finding.code] && a.status === "CLOSED") {
      closedCounts[a.finding.code] = (closedCounts[a.finding.code] || 0) + 1;
    }
  }

  const rows = Object.keys(SIGNAL_IMPACT).map(code => {
    const identified = signalCounts[code] || 0;
    const closed = closedCounts[code] || 0;
    const raf = SIGNAL_IMPACT[code].raf;
    const roi = SIGNAL_IMPACT[code].roi;
    const estRAF = (identified * raf).toFixed(2);
    const estROI = (identified * roi).toLocaleString();
    return [
      `<b>${esc(SIGNAL_IMPACT[code].label)}</b><div class="hint">${esc(code)}</div>`,
      `${identified}`,
      `${closed}`,
      `${estRAF}`,
      `$${estROI}`
    ];
  });

  const totalIdentified = Object.values(signalCounts).reduce((a,b)=>a+b,0);
  const totalClosed = Object.values(closedCounts).reduce((a,b)=>a+b,0);

  const header = `
    <div class="row" style="justify-content:space-between">
      <div class="pill">Opportunities Identified: <b style="margin-left:6px">${totalIdentified}</b></div>
      <div class="pill">Opportunities Closed: <b style="margin-left:6px">${totalClosed}</b></div>
    </div>
    <div class="hint" style="margin-top:8px">Demo scoring estimates RAF/ROI impact from prospective gap signals.</div>
  `;

  el.innerHTML = header + `<div class="mt12">${table(["Opportunity", "Identified", "Closed", "Est RAF Δ", "Est ROI"], rows)}</div>`;
}

function renderProviderQuerySamples() {
  const el = document.getElementById("providerQuerySamples");
  if (!el) return;

  const samples = [
    {
      title: "Missing Amputee Status (Z89.*) — request MEAT evidence",
      text:
`Please confirm amputee status and laterality supported in documentation.
Attach: most recent progress note, problem list, specialist note (ortho/wound care), and prosthetic/rehab documentation.`
    },
    {
      title: "Missing Transplant Status (Z94.*) — request transplant follow-up documentation",
      text:
`Please provide transplant follow-up note(s), immunosuppression management, problem list status, and specialist documentation confirming transplant status.`
    },
    {
      title: "ESRD (N18.6) with missing dialysis dependence (Z99.2)",
      text:
`Please provide nephrology note and dialysis center documentation supporting dialysis dependence, start date, and ongoing treatment evidence.`
    },
    {
      title: "Non-risk eligible CPT only (lab/radiology)",
      text:
`Please provide an E/M visit or clinical documentation showing chronic condition evaluation/assessment/treatment for RA eligibility.`
    }
  ];

  const rows = samples.map(s => [
    `<b>${esc(s.title)}</b>`,
    `<button class="btn" data-openq="${esc(s.title)}">Open</button>`
  ]);

  el.innerHTML = table(["Sample", ""], rows);

  el.querySelectorAll("button[data-openq]").forEach(btn => {
    btn.onclick = () => {
      const t = btn.getAttribute("data-openq");
      const found = samples.find(x => x.title === t);
      openModal(`Provider Query Sample`, `${found.title}\n\n${found.text}`);
    };
  });
}

/* ---------- Runs / Workqueue / Docs / Audit rendering ---------- */
function renderLoaded() {
  const el1 = document.getElementById("loadedList");
  const el2 = document.getElementById("loadedList2");
  const render = (el) => {
    if (!el) return;
    el.innerHTML = "";
    if (!loadedInputs.length) { el.innerHTML = `<span class="hint">No samples/files loaded. Load samples or upload files.</span>`; return; }
    loadedInputs.forEach(item => {
      const chip = document.createElement("div");
      chip.className = "loadedChip";
      chip.textContent = item.name;
      el.appendChild(chip);
    });
  };
  render(el1); render(el2);
}

function renderKPIs() {
  document.getElementById("kpiRuns").textContent = String(runs.length);
  document.getElementById("kpiRepairs").textContent = String(runs.reduce((s,r)=>s+(r.summary?.repairsTotal||0),0));
  document.getElementById("kpiRABlocks").textContent = String(runs.reduce((s,r)=>s+(r.summary?.raBlocks||0),0));
  document.getElementById("kpiActions").textContent = String(actions.length);
}

function renderRuns() {
  const el = document.getElementById("runsTable");
  if (!el) return;
  if (!runs.length) { el.innerHTML = `<div class="empty">No runs yet. Load samples and run validation.</div>`; return; }

  const rows = runs.slice(0, 60).map(r => [
    `<b>${esc(r.name)}</b><div class="hint">Member: ${esc(r.memberId||"UNKNOWN")} • ${esc(r.createdAt.replace("T"," ").replace("Z",""))}</div>`,
    dotBadge(r.status),
    `${r.summary.fatal} fatal / ${r.summary.raBlocks} RA / ${r.summary.signals} signals`,
    `${r.summary.repairsTotal}`,
    `<button class="btn" data-openrun="${r.id}">Open</button>`
  ]);

  el.innerHTML = table(["Run", "Status", "Findings", "Fixed", ""], rows);

  el.querySelectorAll("button[data-openrun]").forEach(b => {
    b.onclick = () => { selectedRunId = b.getAttribute("data-openrun"); renderRunDetail(); setTab("runs"); };
  });
}

function renderRunDetail() {
  const meta = document.getElementById("runMeta");
  const sp = document.getElementById("runStatusPill");
  const stepP = document.getElementById("runStepPill");
  const findingsEl = document.getElementById("findingsTable");
  const repairsEl = document.getElementById("repairsTable");
  const beforeBox = document.getElementById("beforeBox");
  const afterBox = document.getElementById("afterBox");

  const r = runs.find(x => x.id === selectedRunId);
  if (!r) {
    meta.textContent = "Select a run";
    sp.textContent = "—"; stepP.textContent = "—";
    findingsEl.innerHTML = `<div class="empty">No run selected.</div>`;
    repairsEl.innerHTML = `<div class="empty">No run selected.</div>`;
    beforeBox.textContent = ""; afterBox.textContent = "";
    return;
  }

  meta.innerHTML = `<b>${esc(r.name)}</b> • Member: ${esc(r.memberId||"UNKNOWN")} • ${esc(r.createdAt.replace("T"," ").replace("Z",""))}`;
  sp.innerHTML = dotBadge(r.status);
  stepP.textContent = r.step;

  findingsEl.innerHTML = table(
    ["Level", "Category", "Code", "Message"],
    r.findings.map(f => [
      `<b>${esc(f.level)}</b>`,
      esc(f.type),
      `<span style="font-family:var(--mono)">${esc(f.code)}</span>`,
      esc(f.msg)
    ])
  );

  repairsEl.innerHTML = r.repairs.length
    ? table(["Repair", "Count", "Before", "After", "Reason"], r.repairs.map(x => [
        `<span style="font-family:var(--mono)">${esc(x.type)}</span>`,
        String(x.count || 1),
        `<span style="font-family:var(--mono)">${esc(x.before || "")}</span>`,
        `<span style="font-family:var(--mono)">${esc(x.after || "")}</span>`,
        esc(x.reason || "")
      ]))
    : `<div class="empty">No repairs applied.</div>`;

  const { bHtml, aHtml } = renderLineDiff(r.raw, r.repaired);
  beforeBox.innerHTML = bHtml;
  afterBox.innerHTML = aHtml;

  document.getElementById("btnDownloadAfter").onclick = () => {
    const blob = new Blob([r.repaired], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.name}_after_837.txt`.replace(/\s+/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 400);
  };
}

function renderActions() {
  const el = document.getElementById("actionsTable");
  if (!el) return;

  const filter = document.getElementById("actionFilter")?.value || "all";
  const list = actions.filter(a => filter === "all" ? true : a.status === filter);

  if (!list.length) { el.innerHTML = `<div class="empty">No actions yet. Create Work Actions from runs.</div>`; return; }

  const prettyType = (t) => {
    if (t === CHANGE_TYPE.CPT_ADJUSTMENT) return "CPT Adjustment";
    if (t === CHANGE_TYPE.DX_LINKED_CHART_REVIEW) return "Linked Chart Review";
    if (t === CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE) return "DX Correction (Evidence)";
    return t;
  };

  el.innerHTML = table(
    ["Action", "Workflow", "Status", "Priority", "Owner", ""],
    list.slice(0, 140).map(a => [
      `<b>${esc(a.finding.code)}</b><div class="hint">${esc(a.finding.level)} • ${esc(a.finding.type)}</div>`,
      `<span class="pill">${esc(prettyType(a.changeType))}</span>`,
      `<span class="pill">${esc(a.status)}</span>`,
      `<span class="pill">${esc(a.priority)}</span>`,
      esc(a.owner),
      `<button class="btn" data-openaction="${a.id}">Open</button>`
    ])
  );

  el.querySelectorAll("button[data-openaction]").forEach(b => {
    b.onclick = () => { selectedActionId = b.getAttribute("data-openaction"); renderActionDetail(); };
  });
}

function renderAttachedDocs(action) {
  const el = document.getElementById("attachedDocs");
  if (!el) return;
  el.innerHTML = "";
  if (!action.docs.length) { el.innerHTML = `<div class="empty">No docs attached to this action yet.</div>`; return; }

  const docs = action.docs.map(id => doclib.find(d => d.id === id)).filter(Boolean);
  for (const d of docs) {
    const row = document.createElement("div");
    row.className = "docItem";
    row.innerHTML = `
      <div>
        <div class="docName">${esc(d.name)}</div>
        <div class="docMeta">Member: ${esc(d.memberId)} • ${esc(d.createdAt.replace("T"," ").replace("Z",""))}</div>
      </div>
      <div class="docActions">
        <button class="btn" data-opendoc="${d.id}">Open</button>
        <button class="btn" data-detach="${d.id}">Detach</button>
      </div>
    `;
    el.appendChild(row);
  }

  el.querySelectorAll("button[data-opendoc]").forEach(b => {
    b.onclick = () => {
      const d = doclib.find(x => x.id === b.getAttribute("data-opendoc"));
      if (!d) return;
      openModal(`Document Preview: ${d.name}`, d.contentPreview || "(no preview)");
    };
  });

  el.querySelectorAll("button[data-detach]").forEach(b => {
    b.onclick = () => {
      const id = b.getAttribute("data-detach");
      action.docs = action.docs.filter(x => x !== id);
      action.evidence.docsAttachedCount = Math.max(0, (action.evidence.docsAttachedCount || 0) - 1);
      saveJSON(STORE.actions, actions);
      addAudit("DOC_DETACHED", { actionId: action.id, docId: id });
      toast("Doc detached");
      renderAttachedDocs(action);
      renderLibrary();
      renderActionDetail(); // refresh checklist
    };
  });
}

/* ---------- Modal ---------- */
function openModal(title, body) {
  const modal = document.getElementById("modal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").textContent = body;
  modal.style.display = "flex";
}
function closeModal() {
  document.getElementById("modal").style.display = "none";
}

/* ---------- NEW: UI snippets for workflow ---------- */
function prettyChangeType(t) {
  if (t === CHANGE_TYPE.CPT_ADJUSTMENT) return "CPT Adjustment → Submit Adjustment/Void";
  if (t === CHANGE_TYPE.DX_LINKED_CHART_REVIEW) return "DX Add → Linked Chart Review (Evidence required)";
  if (t === CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE) return "DX Fix → Linked Chart Review (Evidence required)";
  return t;
}

function renderEvidenceChecklist(action) {
  const { hasCCD, hasQuery, hasDoc, complete } = getEvidenceChecklist(action);
  const line = (ok, text) => `<div class="hint" style="margin-top:6px">${ok ? "✅" : "⬜️"} ${esc(text)}</div>`;
  return `
    <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:12px">
      <div class="cardHead">
        <h3>Evidence Checklist</h3>
        <div class="hint">Required before Linked Chart Review submission</div>
      </div>
      <div class="cardBody">
        ${line(hasCCD, "CCD attached")}
        ${line(hasQuery, "Provider query generated")}
        ${line(hasDoc, "At least 1 supporting document attached")}
        <div class="hint" style="margin-top:10px;font-weight:900;color:${complete ? "#16a34a" : "#b45309"}">
          ${complete ? "Ready to submit linked chart review." : "Not ready: complete the checklist to submit."}
        </div>
      </div>
    </div>
  `;
}

function summarizeChangePlan(action) {
  const cp = action.changePlan;
  const cptAdds = cp.cpt.add.length;
  const cptRem = cp.cpt.remove.length;
  const cptRep = cp.cpt.replace.length;
  const dxAdds = cp.dx.add.length;
  const dxFix = cp.dx.fix.length;
  const dxRem = cp.dx.remove.length;
  return `CPT: +${cptAdds}/-${cptRem}/~${cptRep} • DX: +${dxAdds}/fix${dxFix}/-${dxRem}`;
}

/* ---------- Action Detail (EXTENDED WORKFLOW IMPLEMENTATION) ---------- */
function renderActionDetail() {
  const empty = document.getElementById("actionEmpty");
  const box = document.getElementById("actionDetail");
  const payload = document.getElementById("actionPayload");

  const a = actions.find(x => x.id === selectedActionId);
  if (!a) {
    empty.style.display = "block";
    box.style.display = "none";
    if (payload) payload.textContent = "";
    return;
  }

  empty.style.display = "none";
  box.style.display = "block";

  // Base fields
  document.getElementById("adTitle").textContent = a.finding.code;
  document.getElementById("adMeta").textContent =
    `Member ${a.memberId} • Owner: ${a.owner} • Run: ${a.runName}`;

  // Add workflow pill into status pill
  document.getElementById("adStatusPill").textContent = `${a.status} • ${a.priority}`;

  document.getElementById("adStatus").value = a.status;
  document.getElementById("adPriority").value = a.priority;
  document.getElementById("adNotes").value = a.notes || "";

  renderAttachedDocs(a);

  // Default payload preview: Slack
  if (payload) payload.textContent = JSON.stringify(buildSlackPayload(a), null, 2);

  // Inject workflow block below payload preview if present
  const actionPayloadPre = document.getElementById("actionPayload");
  const container = actionPayloadPre?.parentElement;
  // Remove existing injected block if any
  const old = document.getElementById("workflowBlock");
  if (old) old.remove();

  // Create workflow block
  const block = document.createElement("div");
  block.id = "workflowBlock";
  block.className = "mt12";
  const evidence = getEvidenceChecklist(a);

  const showAdjustment = a.changeType === CHANGE_TYPE.CPT_ADJUSTMENT;
  const showChartReview = a.changeType !== CHANGE_TYPE.CPT_ADJUSTMENT;

  const recommendedDx = DX_RECOS[a.finding.code]?.add?.join(", ") || "—";

  block.innerHTML = `
    <div class="card" style="box-shadow:none;border:1px solid var(--line)">
      <div class="cardHead">
        <h3>Workflow</h3>
        <div class="hint"><b>${esc(prettyChangeType(a.changeType))}</b></div>
      </div>
      <div class="cardBody">
        <div class="hint"><b>Change Plan Summary:</b> ${esc(summarizeChangePlan(a))}</div>
        ${a.changeType === CHANGE_TYPE.DX_LINKED_CHART_REVIEW ? `<div class="hint" style="margin-top:8px"><b>Recommended DX (demo):</b> ${esc(recommendedDx)}</div>` : ""}

        <div class="row" style="margin-top:12px">
          <button class="btn" id="btnSuggestChanges">Suggest Fix/Add (AI demo)</button>
          ${showAdjustment ? `<button class="btn primary" id="btnGenAdjustment">Generate Adjustment Payload</button>` : ""}
          ${showChartReview ? `<button class="btn primary" id="btnGenChartReview">Create Linked Chart Review Submission</button>` : ""}
        </div>

        ${showChartReview ? renderEvidenceChecklist(a) : `
          <div class="hint" style="margin-top:12px">
            CPT change impacts eligibility → route to Claims Ops → submit Adjustment / Void-Rebill as needed.
          </div>
        `}
      </div>
    </div>
  `;

  container?.appendChild(block);

  // Handlers: Save core action
  document.getElementById("btnSaveAction").onclick = () => {
    a.status = document.getElementById("adStatus").value;
    a.priority = document.getElementById("adPriority").value;
    a.notes = document.getElementById("adNotes").value;
    saveJSON(STORE.actions, actions);
    addAudit("ACTION_UPDATED", { id: a.id, status: a.status, priority: a.priority });
    toast("Action saved");
    renderActions(); renderKPIs(); renderRAFImpact(); renderTrendChart();
  };

  // Notify / Ticket
  document.getElementById("btnNotifySlack").onclick = () => {
    const p = buildSlackPayload(a);
    payload.textContent = JSON.stringify(p, null, 2);
    addAudit("INTEGRATION_SLACK", { actionId: a.id, payload: p });
    addNotif("Slack notification (demo)", `${a.finding.code} payload created.`);
    toast("Slack payload generated");
  };
  document.getElementById("btnNotifyTeams").onclick = () => {
    const p = buildTeamsPayload(a);
    payload.textContent = JSON.stringify(p, null, 2);
    addAudit("INTEGRATION_TEAMS", { actionId: a.id, payload: p });
    addNotif("Teams notification (demo)", `${a.finding.code} payload created.`);
    toast("Teams payload generated");
  };
  document.getElementById("btnCreateTicket").onclick = () => {
    const p = buildTicketPayload(a);
    payload.textContent = JSON.stringify(p, null, 2);
    addAudit("INTEGRATION_TICKET", { actionId: a.id, payload: p });
    addNotif("Ticket created (demo)", `Ticket payload generated for ${a.finding.code}.`);
    toast("Ticket payload generated");
  };

  // Provider query marks evidence flag (NEW)
  document.getElementById("btnProviderQuery").onclick = () => {
    openModal("Provider Query (Demo)", buildProviderQueryText(a));
    a.evidence.providerQueryGenerated = true;
    saveJSON(STORE.actions, actions);
    addAudit("PROVIDER_QUERY_GENERATED", { actionId: a.id });
    addNotif("Provider query (demo)", `Provider query generated for member ${a.memberId}.`);
    toast("Provider query generated");
    renderActionDetail(); // refresh checklist
  };

  // Retrieve CCD marks evidence flag (NEW)
  document.getElementById("btnRetrieveCCD").onclick = () => {
    const memberId = a.memberId || "UNKNOWN";
    const ccd = simulateCCD(memberId);
    const doc = addDocToLibrary(memberId, ccd.name, ccd.type, ccd.contentPreview);
    a.docs.unshift(doc.id);
    a.evidence.ccdAttached = true;
    a.evidence.docsAttachedCount = (a.evidence.docsAttachedCount || 0) + 1;
    saveJSON(STORE.actions, actions);
    addAudit("CCD_RETRIEVED", { memberId, docId: doc.id, name: doc.name });
    addNotif("CCD retrieved (demo)", `CCD attached for member ${memberId}.`);
    toast("CCD attached");
    renderAttachedDocs(a);
    renderLibrary();
    renderActionDetail(); // refresh checklist
  };

  // Attach docs increments evidence count (NEW)
  document.getElementById("docUpload").onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const memberId = a.memberId || "UNKNOWN";
    for (const f of files) {
      const text = await readFilePreview(f);
      const doc = addDocToLibrary(memberId, f.name, (f.name.split(".").pop() || "").toLowerCase(), text);
      a.docs.unshift(doc.id);
      a.evidence.docsAttachedCount = (a.evidence.docsAttachedCount || 0) + 1;
      addAudit("DOC_ATTACHED", { actionId: a.id, docId: doc.id, name: doc.name });
    }
    saveJSON(STORE.actions, actions);
    addNotif("Docs attached", `Attached ${files.length} doc(s) to action ${a.finding.code}.`);
    toast("Docs attached");
    e.target.value = "";
    renderAttachedDocs(a);
    renderLibrary();
    renderActionDetail(); // refresh checklist
  };

  // NEW: Suggest changes button
  document.getElementById("btnSuggestChanges").onclick = () => {
    const s = suggestChanges(a);
    saveJSON(STORE.actions, actions);
    addAudit("AI_SUGGESTION_CREATED", { actionId: a.id, type: s.type, plan: a.changePlan });
    addNotif("AI suggestion created", `${a.finding.code}: ${s.summary}`);
    toast("Suggestion created");
    if (payload) payload.textContent = JSON.stringify({ suggestion: s, changePlan: a.changePlan }, null, 2);
    renderActionDetail(); // refresh summary
  };

  // NEW: Generate adjustment payload
  const btnAdj = document.getElementById("btnGenAdjustment");
  if (btnAdj) {
    btnAdj.onclick = () => {
      const p = buildAdjustmentPayload(a);
      a.submissions.adjustment = p;
      saveJSON(STORE.actions, actions);
      addAudit("ADJUSTMENT_PAYLOAD_GENERATED", { actionId: a.id, payload: p });
      addNotif("Adjustment payload generated", `Prepared adjustment payload for ${a.finding.code}.`);
      toast("Adjustment payload generated");
      payload.textContent = JSON.stringify(p, null, 2);
    };
  }

  // NEW: Create linked chart review submission (evidence required)
  const btnCR = document.getElementById("btnGenChartReview");
  if (btnCR) {
    btnCR.onclick = () => {
      const chk = getEvidenceChecklist(a);
      if (!chk.complete) {
        toast("Cannot submit: complete evidence checklist");
        addNotif("Submission blocked", `Missing evidence for linked chart review: CCD=${chk.hasCCD}, Query=${chk.hasQuery}, Doc=${chk.hasDoc}`);
        return;
      }
      const p = buildLinkedChartReviewPayload(a);
      a.submissions.linkedChartReview = p;
      a.status = "CLOSED"; // demo close on submission
      saveJSON(STORE.actions, actions);
      addAudit("LINKED_CHART_REVIEW_SUBMITTED", { actionId: a.id, payload: p });
      addNotif("Linked chart review submitted", `Submitted chart review for ${a.finding.code} and closed action.`);
      toast("Chart review submitted");
      payload.textContent = JSON.stringify(p, null, 2);
      renderActions();
      renderRAFImpact();
      renderTrendChart();
      renderActionDetail();
    };
  }
}

function renderNotifications() {
  const list = document.getElementById("notifyList");
  if (!list) return;
  list.innerHTML = "";
  if (!notifs.length) { list.innerHTML = `<div class="empty">No notifications.</div>`; return; }
  for (const n of notifs.slice(0, 50)) {
    const div = document.createElement("div");
    div.className = "notifyItem";
    div.innerHTML = `
      <div class="notifyTitle">${esc(n.title)}</div>
      <div class="notifyText">${esc(n.text)}</div>
      <div class="notifyTime">${esc(n.ts.replace("T"," ").replace("Z",""))}</div>
    `;
    list.appendChild(div);
  }
}

function renderAudit() {
  const el = document.getElementById("auditTable");
  if (!el) return;
  if (!audit.length) { el.innerHTML = `<div class="empty">No audit events yet.</div>`; return; }
  el.innerHTML = table(
    ["Time", "Event", "Details"],
    audit.slice(0, 160).map(a => [
      esc(a.ts.replace("T"," ").replace("Z","")),
      `<b>${esc(a.eventType)}</b>`,
      `<span style="font-family:var(--mono)">${esc(JSON.stringify(a.details).slice(0, 260))}${JSON.stringify(a.details).length>260 ? "…" : ""}</span>`
    ])
  );
}

function renderLibrary() {
  const el = document.getElementById("libraryTable");
  if (!el) return;
  if (!doclib.length) { el.innerHTML = `<div class="empty">No docs yet. Retrieve CCD or upload docs.</div>`; return; }
  el.innerHTML = table(
    ["Member", "Document", "Type", "Added", ""],
    doclib.slice(0, 140).map(d => [
      `<b>${esc(d.memberId)}</b>`,
      esc(d.name),
      esc(d.type),
      esc(d.createdAt.replace("T"," ").replace("Z","")),
      `<button class="btn" data-openlib="${d.id}">Open</button>`
    ])
  );
  el.querySelectorAll("button[data-openlib]").forEach(b => {
    b.onclick = () => {
      const d = doclib.find(x => x.id === b.getAttribute("data-openlib"));
      if (!d) return;
      openModal(`Document Preview: ${d.name}`, d.contentPreview || "(no preview)");
    };
  });
}

function renderRoutingTable() {
  const el = document.getElementById("routingTable");
  if (!el) return;
  const rows = [
    ["CPT_ADJUSTMENT", "Claims Ops", "Generate adjustment/void payload and submit"],
    ["DX_LINKED_CHART_REVIEW", "Risk Adjustment Team", "Provider query + CCD + attach docs → submit linked chart review"],
    ["DX_CORRECTION_WITH_EVIDENCE", "Coding QA + RA Team", "Suggest corrected DX → evidence → linked chart review"]
  ];
  el.innerHTML = table(["Change Type", "Default Route", "Demo Action"], rows);
}

/* ---------- Tabs ---------- */
function setTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tabPane").forEach(p => p.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${name}"]`)?.classList.add("active");
  document.getElementById(`tab-${name}`)?.classList.add("active");

  if (name === "reports") {
    renderTrendChart();
    renderRAFImpact();
    renderErrorBreakdown();
    renderProviderQuerySamples();
  }
}

/* ---------- Reset ---------- */
function resetDemo() {
  runs = []; actions = []; audit = []; notifs = []; doclib = []; loadedInputs = [];
  selectedRunId = null; selectedActionId = null;
  saveJSON(STORE.runs, runs);
  saveJSON(STORE.actions, actions);
  saveJSON(STORE.audit, audit);
  saveJSON(STORE.notifs, notifs);
  saveJSON(STORE.library, doclib);
  saveJSON(STORE.loaded, loadedInputs);
  toast("Demo reset");
  renderAll();
}

/* ---------- Samples ---------- */
const PRO_SAMPLES = [
  { name: "PRO_02_NonRiskEligibleCPT_RA_BLOCK", text:
`ST*837*0002~
NM1*IL*1*DOE*JOHN****MI*W123456789~
DMG*D8*19800101*M~
NM1*82*1*SMITH*JANE****XX*1234567893~
CLM*DEF456*100***11:B:1*Y*A*Y*I~
DTP*472*D8*20240110~
HI*ABK:E11.9~
SV1*HC:36415*10*UN*1~
SV1*HC:81002*20*UN*1~` },
  { name: "PRO_03_PharmacyOnlyServices_RA_BLOCK", text:
`ST*837*0003~
NM1*IL*1*DOE*JOHN****MI*W223456789~
DMG*D8*19751212*F~
NM1*82*1*SMITH*JANE****XX*1234567893~
CLM*PHARM001*250***11:B:1*Y*A*Y*I~
DTP*472*D8*20240112~
HI*ABK:E11.9~
SV1*HC:J3490*120*UN*1~
SV1*HC:J9999*130*UN*1~` },
  { name: "PRO_06_AmputationGap_Z89_SIGNAL", text:
`ST*837*0006~
NM1*IL*1*DOE*JOHN****MI*W523456789~
DMG*D8*19551111*M~
NM1*82*1*SMITH*JANE****XX*1234567893~
CLM*AMP001*500***11:B:1*Y*A*Y*I~
DTP*472*D8*20240210~
HI*ABK:E11.9~
SV1*HC:27880*500*UN*1~` },
  { name: "PRO_07_TransplantGap_Z94_SIGNAL", text:
`ST*837*0007~
NM1*IL*1*DOE*JOHN****MI*W623456789~
DMG*D8*19440202*F~
NM1*82*1*SMITH*JANE****XX*1234567893~
CLM*TX001*800***11:B:1*Y*A*Y*I~
DTP*472*D8*20240301~
HI*ABK:I12.0~
SV1*HC:50360*800*UN*1~` },
  { name: "PRO_09_InvalidDx_DXFix_Evidence", text:
`ST*837*0009~
NM1*IL*1*DOE*JOHN****MI*W823456789~
DMG*D8*19600101*M~
NM1*82*1*SMITH*JANE****XX*1234567893~
CLM*DXBAD*120***11:B:1*Y*A*Y*I~
DTP*472*D8*20240412~
HI*ABK:E11.9X*ABK:N18.6~
SV1*HC:99213*120*UN*1~` }
];

const INST_SAMPLES = [
  { name: "INST_02_RadiologyLabOnly_NonRiskEligible_RA_BLOCK", text:
`ST*837*1002~
NM1*IL*1*DOE*JAMES****MI*W900000002~
DMG*D8*19620202*F~
NM1*82*1*FACILITY*RAD****XX*1888888888~
CLM*INST002*420***22:B:1*Y*A*Y*I~
DTP*472*D8*20240410~
HI*ABK:E11.9~
SV1*HC:36415*20*UN*1~
SV1*HC:93000*400*UN*1~` }
];

/* ---------- Wiring ---------- */
function wireUI() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => setTab(btn.getAttribute("data-tab"));
  });

  document.getElementById("btnToggleSidebar").onclick = () => {
    const sb = document.getElementById("sidebar");
    sb.style.display = (sb.style.display === "none") ? "block" : "none";
  };

  const drawer = document.getElementById("drawer");
  document.getElementById("btnOpenNotifications").onclick = () => drawer.style.display = "block";
  document.getElementById("btnCloseDrawer").onclick = () => drawer.style.display = "none";

  document.getElementById("btnCloseModal").onclick = closeModal;
  document.getElementById("btnCloseModal2").onclick = closeModal;
  document.getElementById("btnCopyModal").onclick = async () => {
    try { await navigator.clipboard.writeText(document.getElementById("modalBody").textContent || ""); toast("Copied"); }
    catch { toast("Copy failed"); }
  };

  const loadPro = () => {
    loadedInputs = PRO_SAMPLES.map(s => ({ name: s.name, text: s.text }));
    saveJSON(STORE.loaded, loadedInputs);
    addAudit("SAMPLES_LOADED", { pack: "PRO", count: loadedInputs.length });
    toast("Pro samples loaded");
    renderLoaded();
  };
  const loadInst = () => {
    loadedInputs = INST_SAMPLES.map(s => ({ name: s.name, text: s.text }));
    saveJSON(STORE.loaded, loadedInputs);
    addAudit("SAMPLES_LOADED", { pack: "INSTITUTIONAL", count: loadedInputs.length });
    toast("Institutional samples loaded");
    renderLoaded();
  };

  document.getElementById("btnLoadProSamples").onclick = loadPro;
  document.getElementById("btnLoadProSamples2").onclick = loadPro;
  document.getElementById("btnLoadInstSamples").onclick = loadInst;
  document.getElementById("btnLoadInstSamples2").onclick = loadInst;

  document.getElementById("file837").onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const f of files) {
      const text = await readFilePreview(f);
      loadedInputs.push({ name: f.name, text });
    }
    saveJSON(STORE.loaded, loadedInputs);
    addAudit("FILES_UPLOADED", { count: files.length });
    addNotif("Files uploaded", `Loaded ${files.length} file(s) for validation.`);
    toast("Files loaded");
    e.target.value = "";
    renderLoaded();
  };

  const runHandler = () => {
    if (!loadedInputs.length) { toast("Load samples or upload files first."); return; }
    runBatch(loadedInputs);
    setTab("runs");
  };
  document.getElementById("btnRunBatch").onclick = runHandler;
  document.getElementById("btnRunBatch2").onclick = runHandler;

  const actionsHandler = () => {
    if (!runs.length) { toast("Run validation first."); return; }
    createActionsFromRuns();
    setTab("workqueue");
  };
  document.getElementById("btnCreateActions").onclick = actionsHandler;
  document.getElementById("btnCreateActions2").onclick = actionsHandler;

  document.getElementById("actionFilter").onchange = () => renderActions();
  document.getElementById("btnResetAll").onclick = resetDemo;

  document.getElementById("btnAddToLibrary").onclick = async () => {
    const memberId = (document.getElementById("docMemberId").value || "").trim() || "UNKNOWN";
    const up = document.getElementById("docLibraryUpload");
    const files = Array.from(up?.files || []);
    if (!files.length) { toast("Upload at least one doc."); return; }
    for (const f of files) {
      const text = await readFilePreview(f);
      addDocToLibrary(memberId, f.name, (f.name.split(".").pop() || "").toLowerCase(), text);
    }
    addAudit("LIBRARY_DOCS_ADDED", { memberId, count: files.length });
    addNotif("Library updated", `Added ${files.length} doc(s) for member ${memberId}.`);
    toast("Docs added");
    up.value = "";
    renderLibrary();
  };

  document.getElementById("btnSimulateCCD").onclick = () => {
    const memberId = (document.getElementById("docMemberId").value || "").trim() || "UNKNOWN";
    const ccd = simulateCCD(memberId);
    addDocToLibrary(memberId, ccd.name, ccd.type, ccd.contentPreview);
    addAudit("CCD_RETRIEVED", { memberId, demo: true });
    addNotif("CCD retrieved (demo)", `CCD added for member ${memberId}.`);
    toast("CCD added");
    renderLibrary();
  };
}

/* ---------- Main render ---------- */
function renderAll() {
  renderLoaded();
  renderKPIs();
  renderRuns();
  renderRunDetail();
  renderActions();
  renderActionDetail();
  renderLibrary();
  renderAudit();
  renderNotifications();
  renderRoutingTable();

  if (document.getElementById("tab-reports")?.classList.contains("active")) {
    renderTrendChart();
    renderRAFImpact();
    renderErrorBreakdown();
    renderProviderQuerySamples();
  }
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  wireUI();
  renderAll();
});