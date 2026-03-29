// analyticsEngine.js — Business analytics engine for pipeline results
// Self-contained ES module. No external dependencies.

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function uniqueCount(arr) {
  return new Set(arr).size;
}

function serviceMonth(dateStr) {
  if (!dateStr || dateStr.length < 6) return 'UNKNOWN';
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getFileSummary(pipelineResult) {
  return (pipelineResult.files || []).map((f) => {
    const fileClaims = (pipelineResult.claims || []).filter(
      (c) => c.fileName === f.fileName,
    );
    const totalCharge = round2(
      fileClaims.reduce((s, c) => s + (c.totalChargeAmount || 0), 0),
    );
    const totalPaid = round2(
      fileClaims.reduce((s, c) => s + (c.paidAmount || 0), 0),
    );
    return {
      fileName: f.fileName,
      claimCount: f.claimCount,
      totalCharge,
      totalPaid,
      segmentCount: f.segmentCount,
      generatedAt: f.generatedAt,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING PROVIDER SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getBillingProviderSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const byNPI = groupBy(claims, (c) => c.billingNPI || 'UNKNOWN');

  return Object.entries(byNPI)
    .map(([npi, group]) => {
      const totalCharge = round2(group.reduce((s, c) => s + (c.totalChargeAmount || 0), 0));
      const totalPaid = round2(group.reduce((s, c) => s + (c.paidAmount || 0), 0));
      return {
        billingNPI: npi,
        billingProviderName: group[0]?.billingProviderName || '',
        claimCount: group.length,
        totalCharge,
        totalPaid,
        uniqueMembers: uniqueCount(group.map((c) => c.memberID)),
        uniqueRenderingProviders: uniqueCount(
          group.map((c) => c.renderingNPI).filter(Boolean),
        ),
        avgChargePerClaim: round2(totalCharge / group.length),
      };
    })
    .sort((a, b) => b.claimCount - a.claimCount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERING PROVIDER SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getRenderingProviderSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const byNPI = groupBy(claims, (c) => c.renderingNPI || 'UNKNOWN');

  return Object.entries(byNPI)
    .map(([npi, group]) => {
      const totalCharge = round2(group.reduce((s, c) => s + (c.totalChargeAmount || 0), 0));
      const billingProviders = [
        ...new Set(group.map((c) => c.billingNPI).filter(Boolean)),
      ];
      return {
        renderingNPI: npi,
        renderingProviderName: group[0]?.renderingProviderName || '',
        claimCount: group.length,
        totalCharge,
        billingProviders,
        uniqueMembers: uniqueCount(group.map((c) => c.memberID)),
      };
    })
    .sort((a, b) => b.claimCount - a.claimCount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBER SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getMemberSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const byMember = groupBy(claims, (c) => c.memberID || 'UNKNOWN');

  return Object.entries(byMember)
    .map(([memberId, group]) => {
      const totalCharge = round2(group.reduce((s, c) => s + (c.totalChargeAmount || 0), 0));
      const totalPaid = round2(group.reduce((s, c) => s + (c.paidAmount || 0), 0));
      const dates = group
        .map((c) => c.serviceDateFrom)
        .filter(Boolean)
        .sort();
      return {
        memberID: memberId,
        memberName: group[0]?.memberName || '',
        dateOfBirth: group[0]?.memberDOB || '',
        gender: group[0]?.memberGender || '',
        claimCount: group.length,
        totalCharge,
        totalPaid,
        uniqueProviders: uniqueCount(
          [
            ...group.map((c) => c.billingNPI),
            ...group.map((c) => c.renderingNPI),
          ].filter(Boolean),
        ),
        dateRangeFrom: dates[0] || '',
        dateRangeTo: dates[dates.length - 1] || '',
      };
    })
    .sort((a, b) => b.claimCount - a.claimCount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTHLY TREND
// ═══════════════════════════════════════════════════════════════════════════════

export function getMonthlyTrend(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const byMonth = groupBy(claims, (c) => serviceMonth(c.serviceDateFrom));

  return Object.entries(byMonth)
    .map(([month, group]) => ({
      month,
      claimCount: group.length,
      totalCharge: round2(group.reduce((s, c) => s + (c.totalChargeAmount || 0), 0)),
      totalPaid: round2(group.reduce((s, c) => s + (c.paidAmount || 0), 0)),
      uniqueMembers: uniqueCount(group.map((c) => c.memberID)),
      uniqueProviders: uniqueCount(
        [
          ...group.map((c) => c.billingNPI),
          ...group.map((c) => c.renderingNPI),
        ].filter(Boolean),
      ),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSIS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getDiagnosisSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const dxCounts = {};

  for (const claim of claims) {
    for (const dx of claim.diagnoses || []) {
      const code = dx.code || 'UNKNOWN';
      if (!dxCounts[code]) dxCounts[code] = { code, count: 0, claimIds: [] };
      dxCounts[code].count++;
      dxCounts[code].claimIds.push(claim.id);
    }
  }

  return Object.values(dxCounts)
    .map((d) => ({
      diagnosisCode: d.code,
      frequency: d.count,
      claimCount: new Set(d.claimIds).size,
      percentOfClaims: round2((new Set(d.claimIds).size / Math.max(claims.length, 1)) * 100),
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCEDURE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getProcedureSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const procMap = {};

  for (const claim of claims) {
    for (const line of claim.serviceLines || []) {
      const code = line.procedureCode || 'UNKNOWN';
      if (!procMap[code]) {
        procMap[code] = { code, frequency: 0, totalCharge: 0, claimIds: [] };
      }
      procMap[code].frequency++;
      procMap[code].totalCharge += line.chargeAmount || 0;
      procMap[code].claimIds.push(claim.id);
    }
  }

  return Object.values(procMap)
    .map((p) => ({
      procedureCode: p.code,
      frequency: p.frequency,
      totalCharge: round2(p.totalCharge),
      avgCharge: round2(p.totalCharge / Math.max(p.frequency, 1)),
      claimCount: new Set(p.claimIds).size,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACILITY CODE (POS) SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

const POS_LABELS = {
  '11': 'Office',
  '12': 'Home',
  '22': 'Hospital Outpatient',
  '23': 'Emergency Room',
  '31': 'Skilled Nursing',
  '32': 'Nursing Facility',
  '49': 'Independent Clinic',
  '50': 'FQHC',
};

export function getFacilityCodeSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const byPOS = groupBy(claims, (c) => c.facilityCode || 'UNKNOWN');

  return Object.entries(byPOS)
    .map(([pos, group]) => ({
      facilityCode: pos,
      label: POS_LABELS[pos] || `POS ${pos}`,
      claimCount: group.length,
      totalCharge: round2(group.reduce((s, c) => s + (c.totalChargeAmount || 0), 0)),
      totalPaid: round2(group.reduce((s, c) => s + (c.paidAmount || 0), 0)),
      percentOfClaims: round2((group.length / Math.max(claims.length, 1)) * 100),
    }))
    .sort((a, b) => b.claimCount - a.claimCount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export function getValidationSummary(pipelineResult) {
  const claims = pipelineResult.claims || [];
  const total = claims.length;
  const passed = claims.filter((c) => c.status === 'PASS').length;
  const failed = claims.filter((c) => c.status === 'FAIL').length;

  const failureCounts = {};
  for (const claim of claims) {
    const vr = claim.validationResult;
    if (!vr || !vr.checks) continue;
    for (const chk of vr.checks) {
      if (chk.status === 'FAIL') {
        if (!failureCounts[chk.id]) {
          failureCounts[chk.id] = { id: chk.id, field: chk.field, count: 0 };
        }
        failureCounts[chk.id].count++;
      }
    }
  }

  const commonFailures = Object.values(failureCounts).sort(
    (a, b) => b.count - a.count,
  );

  return {
    total,
    passed,
    failed,
    passRate: round2((passed / Math.max(total, 1)) * 100),
    commonFailures,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export function search(pipelineResult, filters) {
  let claims = pipelineResult.claims || [];
  const {
    query,
    billingNPI,
    renderingNPI,
    memberId,
    dateFrom,
    dateTo,
  } = filters || {};

  if (billingNPI) {
    claims = claims.filter((c) => c.billingNPI === billingNPI);
  }

  if (renderingNPI) {
    claims = claims.filter((c) => c.renderingNPI === renderingNPI);
  }

  if (memberId) {
    claims = claims.filter((c) => c.memberID === memberId);
  }

  if (dateFrom) {
    const from = String(dateFrom).replace(/-/g, '');
    claims = claims.filter((c) => (c.serviceDateFrom || '') >= from);
  }

  if (dateTo) {
    const to = String(dateTo).replace(/-/g, '');
    claims = claims.filter((c) => (c.serviceDateFrom || '') <= to);
  }

  if (query) {
    const q = query.toUpperCase();
    claims = claims.filter((c) => {
      const fields = [
        c.id,
        c.pcn,
        c.billingNPI,
        c.billingProviderName,
        c.renderingNPI,
        c.renderingProviderName,
        c.memberID,
        c.memberName,
        c.facilityCode,
        c.contractId,
        c.fileName,
        ...(c.diagnoses || []).map((d) => d.code),
        ...(c.serviceLines || []).map((l) => l.procedureCode),
      ];
      return fields.some((f) => f && String(f).toUpperCase().includes(q));
    });
  }

  return claims.map((c) => ({
    id: c.id,
    pcn: c.pcn,
    status: c.status,
    billingNPI: c.billingNPI,
    billingProviderName: c.billingProviderName,
    renderingNPI: c.renderingNPI,
    renderingProviderName: c.renderingProviderName,
    memberID: c.memberID,
    memberName: c.memberName,
    serviceDateFrom: c.serviceDateFrom,
    facilityCode: c.facilityCode,
    totalChargeAmount: c.totalChargeAmount,
    paidAmount: c.paidAmount,
    fileName: c.fileName,
    diagnosisCodes: (c.diagnoses || []).map((d) => d.code),
    procedureCodes: (c.serviceLines || []).map((l) => l.procedureCode),
  }));
}
