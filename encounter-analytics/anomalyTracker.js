// anomalyTracker.js — Anomaly lifecycle management
// Detect, prioritize, assign, track, resolve anomalies.
// ES module. No external dependencies.

export class AnomalyTracker {
  constructor() {
    this.anomalies = [];
    this.nextId = 1;
  }

  // ── Ingest anomalies from analytics agent ─────────────────────────────

  addAnomalies(anomalyList) {
    for (const a of anomalyList) {
      const anomaly = { ...a };
      anomaly.id = `ANO-${String(this.nextId++).padStart(5, "0")}`;
      anomaly.status = "DETECTED";
      anomaly.priority = this.calculatePriority(anomaly);
      anomaly.detectedAt = new Date().toISOString();
      anomaly.assignedTo = null;
      anomaly.resolvedAt = null;
      anomaly.resolution = null;
      anomaly.resolutionNotes = null;
      anomaly.history = [
        { action: "DETECTED", at: anomaly.detectedAt, by: "DxAnalyticsAgent" },
      ];
      this.anomalies.push(anomaly);
    }
  }

  // ── Priority calculation ──────────────────────────────────────────────

  calculatePriority(anomaly) {
    const sevWeight =
      anomaly.severity === "HIGH" ? 3 : anomaly.severity === "MEDIUM" ? 2 : 1;
    const rafWeight =
      (anomaly.estimatedRAF || 0) > 0.3 ? 3 : (anomaly.estimatedRAF || 0) > 0.1 ? 2 : 1;
    const score = sevWeight * 3 + rafWeight * 2;
    if (score >= 12) return 1;
    if (score >= 8) return 2;
    return 3;
  }

  // ── Lifecycle actions ─────────────────────────────────────────────────

  assign(anomalyId, assignee) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return null;
    anomaly.assignedTo = assignee;
    anomaly.status = "ASSIGNED";
    anomaly.history.push({
      action: "ASSIGNED",
      at: new Date().toISOString(),
      by: assignee,
    });
    return anomaly;
  }

  resolve(anomalyId, resolution, notes) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return null;
    anomaly.status = "RESOLVED";
    anomaly.resolvedAt = new Date().toISOString();
    anomaly.resolution = resolution;
    anomaly.resolutionNotes = notes || null;
    anomaly.history.push({
      action: "RESOLVED",
      at: anomaly.resolvedAt,
      by: anomaly.assignedTo || "SYSTEM",
      resolution,
      notes,
    });
    return anomaly;
  }

  defer(anomalyId, reason) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return null;
    anomaly.status = "DEFERRED";
    anomaly.history.push({
      action: "DEFERRED",
      at: new Date().toISOString(),
      by: anomaly.assignedTo || "SYSTEM",
      reason,
    });
    return anomaly;
  }

  reopen(anomalyId) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return null;
    anomaly.status = "REOPENED";
    anomaly.resolvedAt = null;
    anomaly.resolution = null;
    anomaly.resolutionNotes = null;
    anomaly.history.push({
      action: "REOPENED",
      at: new Date().toISOString(),
      by: anomaly.assignedTo || "SYSTEM",
    });
    return anomaly;
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getWorklist(filters = {}) {
    let list = [...this.anomalies];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      list = list.filter(a => statuses.includes(a.status));
    }
    if (filters.priority != null) {
      list = list.filter(a => a.priority === filters.priority);
    }
    if (filters.severity) {
      list = list.filter(a => a.severity === filters.severity);
    }
    if (filters.ruleId) {
      list = list.filter(a => a.ruleId === filters.ruleId);
    }
    if (filters.providerId) {
      list = list.filter(
        a => a.billingProvider === filters.providerId || a.renderingProvider === filters.providerId
      );
    }
    if (filters.memberId) {
      list = list.filter(a => a.memberId === filters.memberId);
    }

    list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.detectedAt || "").localeCompare(b.detectedAt || "");
    });

    return list;
  }

  getSummary() {
    const byStatus = {};
    const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byPriority = { 1: 0, 2: 0, 3: 0 };
    const byRule = {};
    const byProvider = {};

    for (const a of this.anomalies) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (bySeverity[a.severity] != null) bySeverity[a.severity]++;
      if (byPriority[a.priority] != null) byPriority[a.priority]++;
      byRule[a.ruleId] = (byRule[a.ruleId] || 0) + 1;
      if (a.billingProvider) {
        byProvider[a.billingProvider] = (byProvider[a.billingProvider] || 0) + 1;
      }
    }

    return {
      total: this.anomalies.length,
      byStatus,
      bySeverity,
      byPriority,
      byRule,
      byProvider,
    };
  }

  getByMember(memberId) {
    return this.anomalies
      .filter(a => a.memberId === memberId)
      .sort((a, b) => a.priority - b.priority);
  }

  getByProvider(npi) {
    return this.anomalies
      .filter(a => a.billingProvider === npi || a.renderingProvider === npi)
      .sort((a, b) => a.priority - b.priority);
  }

  getByRule(ruleId) {
    return this.anomalies
      .filter(a => a.ruleId === ruleId)
      .sort((a, b) => a.priority - b.priority);
  }

  // ── Export ────────────────────────────────────────────────────────────

  export(format = "json") {
    if (format === "csv") {
      const headers = [
        "id", "ruleId", "ruleName", "severity", "priority", "status",
        "claimId", "memberId", "memberName", "billingProvider", "renderingProvider",
        "serviceDate", "description", "hcc", "estimatedRAF", "estimatedRevenue",
        "assignedTo", "resolvedAt", "resolution", "resolutionNotes", "detectedAt",
      ];

      const escapeCSV = (val) => {
        if (val == null) return "";
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const rows = this.anomalies.map(a =>
        headers.map(h => escapeCSV(a[h])).join(",")
      );

      return headers.join(",") + "\n" + rows.join("\n");
    }

    return JSON.stringify(this.anomalies, null, 2);
  }
}
