export function buildSlackPayload(action) {
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

export function buildTeamsPayload(action) {
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

export function buildTicketPayload(action) {
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

export function buildProviderQueryText(action) {
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

export function buildAdjustmentPayload(action, nowISO) {
  const plan = action.changePlan;
  return {
    type: "837_ADJUSTMENT",
    mode: "REPLACE",
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

export function buildLinkedChartReviewPayload(action, doclib, nowISO) {
  const plan = action.changePlan;
  const docIds = action.docs.slice(0, 10);
  const docRefs = docIds.map((id) => {
    const d = doclib.find((x) => x.id === id);
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
