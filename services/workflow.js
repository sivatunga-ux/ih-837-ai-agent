import { CHANGE_TYPE, createActionModel } from "../data/models.js";

export const DX_RECOS = {
  AMP_STATUS_MISSING_Z89: { add: ["Z89.9"], reason: "Amputation procedure present; add Z89.* status with laterality if documented." },
  TX_STATUS_MISSING_Z94: { add: ["Z94.0"], reason: "Transplant procedure present; add Z94.* status if supported." },
  ESRD_DEPENDENCE_MISSING_Z992: { add: ["Z99.2"], reason: "ESRD present; add Z99.2 dialysis dependence if supported." }
};

export const SIGNAL_IMPACT = {
  AMP_STATUS_MISSING_Z89: { raf: 0.18, roi: 1400, label: "Amputation status (Z89.*)" },
  TX_STATUS_MISSING_Z94: { raf: 0.22, roi: 1800, label: "Transplant status (Z94.*)" },
  ESRD_DEPENDENCE_MISSING_Z992: { raf: 0.32, roi: 2600, label: "Dialysis dependence (Z99.2)" }
};

export function classifyChangeType(finding) {
  if (finding.code === "NON_RISK_ELIGIBLE_CPT" || finding.code === "PHARMACY_ONLY_SERVICES") {
    return CHANGE_TYPE.CPT_ADJUSTMENT;
  }
  if (finding.level === "SIGNAL" && finding.type === "PROSPECTIVE_GAP") {
    return CHANGE_TYPE.DX_LINKED_CHART_REVIEW;
  }
  if (finding.code === "INVALID_DIAGNOSIS") {
    return CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE;
  }
  if (finding.type === "RISK_ELIGIBILITY") return CHANGE_TYPE.CPT_ADJUSTMENT;
  return CHANGE_TYPE.DX_LINKED_CHART_REVIEW;
}

export function actionPriority(finding) {
  if (finding.level === "FATAL") return "P0";
  if (finding.level === "RA_BLOCK") return "P0";
  if (finding.level === "SIGNAL") return "P1";
  return "P2";
}

export function shouldCreateAction(finding, scope) {
  if (scope === "all") return true;
  if (scope === "fatal_ra") return (finding.level === "FATAL" || finding.level === "RA_BLOCK" || finding.level === "SIGNAL");
  if (scope === "ra_only") return finding.level === "RA_BLOCK";
  if (scope === "fatal_only") return finding.level === "FATAL";
  return false;
}

export function createActionsForRuns(runs, scope, defaultOwner, uid, nowISO) {
  const created = [];
  for (const run of runs) {
    for (const f of run.findings) {
      if (!shouldCreateAction(f, scope)) continue;
      const changeType = classifyChangeType(f);
      const owner =
        changeType === CHANGE_TYPE.CPT_ADJUSTMENT ? "Claims Ops" :
        changeType === CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE ? "Coding QA" :
        defaultOwner;

      created.push(createActionModel({
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
        priority: actionPriority(f)
      }));
    }
    run.step = run.step + " → ACTIONS_CREATED";
  }
  return created;
}

export function getEvidenceChecklist(action) {
  const hasCCD = !!action.evidence.ccdAttached;
  const hasQuery = !!action.evidence.providerQueryGenerated;
  const hasDoc = (action.evidence.docsAttachedCount || 0) > 0;
  return { hasCCD, hasQuery, hasDoc, complete: hasCCD && hasQuery && hasDoc };
}

export function suggestChanges(action) {
  action.changePlan.cpt = { add: [], remove: [], replace: [] };
  action.changePlan.dx = { add: [], remove: [], fix: [] };

  if (action.changeType === CHANGE_TYPE.CPT_ADJUSTMENT) {
    if (action.finding.code === "NON_RISK_ELIGIBLE_CPT") {
      action.changePlan.cpt.add.push("99213");
      action.changePlan.cpt.remove.push("36415");
      action.changePlan.cpt.remove.push("81002");
    }
    if (action.finding.code === "PHARMACY_ONLY_SERVICES") {
      action.changePlan.cpt.add.push("99213");
    }
    return { summary: "Suggested CPT change plan created (demo): add E/M, remove non-eligible lines.", type: "CPT" };
  }

  if (action.changeType === CHANGE_TYPE.DX_LINKED_CHART_REVIEW && DX_RECOS[action.finding.code]) {
    action.changePlan.dx.add.push(...DX_RECOS[action.finding.code].add);
    return { summary: `Suggested DX add plan: ${DX_RECOS[action.finding.code].add.join(", ")} (evidence required).`, type: "DX_ADD" };
  }

  if (action.changeType === CHANGE_TYPE.DX_CORRECTION_WITH_EVIDENCE) {
    action.changePlan.dx.fix.push({ from: "E11.9X", to: "E11.9" });
    return { summary: "Suggested DX correction (demo): E11.9X → E11.9 (requires evidence).", type: "DX_FIX" };
  }

  return { summary: "No suggestions available for this action type.", type: "NONE" };
}
