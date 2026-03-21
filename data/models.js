export const CHANGE_TYPE = {
  CPT_ADJUSTMENT: "CPT_ADJUSTMENT",
  DX_LINKED_CHART_REVIEW: "DX_LINKED_CHART_REVIEW",
  DX_CORRECTION_WITH_EVIDENCE: "DX_CORRECTION_WITH_EVIDENCE"
};

export function createEvidence() {
  return {
    providerQueryGenerated: false,
    ccdAttached: false,
    docsAttachedCount: 0
  };
}

export function createChangePlan() {
  return {
    cpt: { add: [], remove: [], replace: [] },
    dx: { add: [], remove: [], fix: [] }
  };
}

export function createSubmissions() {
  return {
    adjustment: null,
    linkedChartReview: null
  };
}

export function createActionModel(base) {
  return {
    ...base,
    notes: "",
    evidence: createEvidence(),
    changePlan: createChangePlan(),
    submissions: createSubmissions(),
    docs: []
  };
}
