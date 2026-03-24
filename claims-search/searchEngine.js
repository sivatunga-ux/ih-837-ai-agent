/**
 * Client-side search engine for 837 claims data.
 * Mirrors the API a production Elasticsearch/OpenSearch backend would provide.
 */

export class ClaimsSearchEngine {
  constructor(config) {
    this.fields = config.fields;
    this.pageSize = config.pageSize || 25;
    this.data = [];
    this.index = {};
    this.fieldIndex = {};
  }

  loadData(claims) {
    this.data = claims;
    this.buildIndex();
  }

  buildIndex() {
    this.index = {};
    this.fieldIndex = {};
    const indexableFields = this.fields.filter(f => f.indexed);

    for (let i = 0; i < this.data.length; i++) {
      const claim = this.data[i];
      for (const field of indexableFields) {
        const value = this.extractFieldValue(claim, field.key);
        if (value == null || value === "") continue;

        const tokens = this.tokenize(String(value));

        for (const token of tokens) {
          if (!this.index[token]) this.index[token] = new Set();
          this.index[token].add(i);
        }

        if (!this.fieldIndex[field.key]) this.fieldIndex[field.key] = {};
        for (const token of tokens) {
          if (!this.fieldIndex[field.key][token])
            this.fieldIndex[field.key][token] = new Set();
          this.fieldIndex[field.key][token].add(i);
        }
      }
    }
  }

  extractFieldValue(claim, fieldKey) {
    const FIELD_PATHS = {
      memberId: c => c.subscriber?.memberId,
      lastName: c => c.subscriber?.lastName,
      firstName: c => c.subscriber?.firstName,
      dateOfBirth: c => c.subscriber?.dateOfBirth,
      gender: c => c.subscriber?.gender,
      city: c => c.subscriber?.city,
      state: c => c.subscriber?.state,
      zipCode: c => c.subscriber?.zipCode,
      claimId: c => c.patientControlNumber || c.id,
      claimType: c => c.claimType,
      claimStatus: c => c.claimStatus,
      totalCharge: c => c.totalChargeAmount,
      serviceDateFrom: c => c.serviceDateFrom,
      serviceDateTo: c => c.serviceDateTo,
      facilityCode: c => c.facilityCode,
      billingNPI: c => c.billingProvider?.npi,
      billingName: c => c.billingProvider?.name,
      billingTaxId: c => c.billingProvider?.taxId,
      renderingNPI: c => c.renderingProvider?.npi,
      renderingName: c =>
        c.renderingProvider?.name ||
        (
          (c.renderingProvider?.lastName || "") +
          " " +
          (c.renderingProvider?.firstName || "")
        ).trim(),
      renderingTaxonomy: c => c.renderingProvider?.taxonomy,
      diagnosisCode: c =>
        (c.diagnoses || []).map(d => d.code).join(" "),
      procedureCode: c =>
        (c.serviceLines || []).map(l => l.procedureCode).join(" "),
      revenueCode: c =>
        (c.serviceLines || [])
          .map(l => l.revenueCode)
          .filter(Boolean)
          .join(" "),
      payerName: c => c.payer?.name,
      payerId: c => c.payer?.id,
    };
    return FIELD_PATHS[fieldKey] ? FIELD_PATHS[fieldKey](claim) : undefined;
  }

  tokenize(text) {
    return (text || "")
      .toLowerCase()
      .split(/[\s,.\-\/]+/)
      .filter(t => t.length > 0);
  }

  /**
   * @param {Object} params
   * @param {string}  [params.query]     Free-text search string
   * @param {Object}  [params.filters]   { fieldKey: value | { min, max } }
   * @param {Object}  [params.sort]      { field, direction: 'asc'|'desc' }
   * @param {number}  [params.page]      1-based page number
   * @param {number}  [params.pageSize]  Results per page
   * @param {string[]} [params.facetKeys] Fields to compute facet counts for
   * @returns {{ results, total, page, pageSize, totalPages, facets, took }}
   */
  search({ query, filters, sort, page, pageSize, facetKeys } = {}) {
    const startTime = performance.now();
    page = page || 1;
    pageSize = pageSize || this.pageSize;

    let matchingIndices = null;

    // 1. Free-text query across all indexed fields
    if (query && query.trim()) {
      const tokens = this.tokenize(query);
      for (const token of tokens) {
        const matches = new Set();
        for (const indexedToken in this.index) {
          if (indexedToken.startsWith(token) || indexedToken.includes(token)) {
            for (const idx of this.index[indexedToken]) matches.add(idx);
          }
        }
        if (matchingIndices === null) matchingIndices = matches;
        else
          matchingIndices = new Set(
            [...matchingIndices].filter(x => matches.has(x)),
          );
      }
    }

    // 2. Structured filters
    if (filters && Object.keys(filters).length > 0) {
      for (const [fieldKey, filterValue] of Object.entries(filters)) {
        if (!filterValue || filterValue === "") continue;

        const field = this.fields.find(f => f.key === fieldKey);
        if (!field) continue;

        let fieldMatches = new Set();

        if (field.type === "range" && typeof filterValue === "object") {
          for (let i = 0; i < this.data.length; i++) {
            const val = Number(this.extractFieldValue(this.data[i], fieldKey));
            if (!isNaN(val)) {
              if (filterValue.min != null && val < filterValue.min) continue;
              if (filterValue.max != null && val > filterValue.max) continue;
              fieldMatches.add(i);
            }
          }
        } else if (field.type === "date") {
          const filterStr = String(filterValue).toLowerCase();
          for (let i = 0; i < this.data.length; i++) {
            const val = String(
              this.extractFieldValue(this.data[i], fieldKey) || "",
            ).toLowerCase();
            if (val.includes(filterStr)) fieldMatches.add(i);
          }
        } else if (field.type === "select") {
          const filterLower = String(filterValue).toLowerCase();
          for (let i = 0; i < this.data.length; i++) {
            const val = String(
              this.extractFieldValue(this.data[i], fieldKey) || "",
            ).toLowerCase();
            if (val === filterLower) fieldMatches.add(i);
          }
        } else {
          const tokens = this.tokenize(String(filterValue));
          for (const token of tokens) {
            const fIdx = this.fieldIndex[fieldKey] || {};
            for (const indexedToken in fIdx) {
              if (indexedToken.startsWith(token) || indexedToken === token) {
                for (const idx of fIdx[indexedToken]) fieldMatches.add(idx);
              }
            }
          }
        }

        if (matchingIndices === null) matchingIndices = fieldMatches;
        else
          matchingIndices = new Set(
            [...matchingIndices].filter(x => fieldMatches.has(x)),
          );
      }
    }

    if (matchingIndices === null) {
      matchingIndices = new Set(this.data.map((_, i) => i));
    }

    let resultIndices = [...matchingIndices];

    // 3. Sorting
    if (sort && sort.field) {
      resultIndices.sort((a, b) => {
        const va = this.extractFieldValue(this.data[a], sort.field) || "";
        const vb = this.extractFieldValue(this.data[b], sort.field) || "";
        const cmp = String(va).localeCompare(String(vb), undefined, {
          numeric: true,
        });
        return sort.direction === "desc" ? -cmp : cmp;
      });
    }

    // 4. Facets
    const facets = {};
    if (facetKeys && facetKeys.length > 0) {
      for (const fk of facetKeys) {
        facets[fk] = {};
        for (const idx of resultIndices) {
          const val = this.extractFieldValue(this.data[idx], fk);
          if (val != null && val !== "") {
            const values = String(val).split(/\s+/).filter(Boolean);
            for (const v of values) {
              facets[fk][v] = (facets[fk][v] || 0) + 1;
            }
          }
        }
        const sorted = Object.entries(facets[fk])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);
        facets[fk] = Object.fromEntries(sorted);
      }
    }

    // 5. Pagination
    const total = resultIndices.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageIndices = resultIndices.slice(start, end);
    const results = pageIndices.map(i => this.data[i]);

    const took = Math.round(performance.now() - startTime);

    return { results, total, page, pageSize, totalPages, facets, took };
  }

  getById(id) {
    return this.data.find(
      c => c.id === id || c.patientControlNumber === id,
    );
  }

  getStats() {
    return {
      totalClaims: this.data.length,
      indexedTerms: Object.keys(this.index).length,
      indexedFields: Object.keys(this.fieldIndex).length,
    };
  }
}
