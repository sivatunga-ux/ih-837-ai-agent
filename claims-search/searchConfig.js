export const SEARCH_FIELDS = [
  // ── Member / Subscriber ──
  { key: "memberId",       label: "Member ID",          category: "Member",     type: "text",   indexed: true,  facetable: false, sortable: true,  apiField: "subscriber.member_id",    placeholder: "e.g. W123456789" },
  { key: "lastName",       label: "Last Name",          category: "Member",     type: "text",   indexed: true,  facetable: false, sortable: true,  apiField: "subscriber.last_name",    placeholder: "e.g. Smith" },
  { key: "firstName",      label: "First Name",         category: "Member",     type: "text",   indexed: true,  facetable: false, sortable: true,  apiField: "subscriber.first_name",   placeholder: "e.g. John" },
  { key: "dateOfBirth",    label: "Date of Birth",      category: "Member",     type: "date",   indexed: true,  facetable: false, sortable: true,  apiField: "subscriber.dob",          placeholder: "YYYY-MM-DD" },
  { key: "gender",         label: "Gender",             category: "Member",     type: "select", indexed: true,  facetable: true,  sortable: true,  apiField: "subscriber.gender",       options: [{ value: "M", label: "Male" }, { value: "F", label: "Female" }, { value: "U", label: "Unknown" }] },
  { key: "city",           label: "City",               category: "Demographics", type: "text", indexed: true,  facetable: true,  sortable: true,  apiField: "subscriber.city" },
  { key: "state",          label: "State",              category: "Demographics", type: "text", indexed: true,  facetable: true,  sortable: true,  apiField: "subscriber.state",        placeholder: "e.g. CA" },
  { key: "zipCode",        label: "ZIP Code",           category: "Demographics", type: "text", indexed: true,  facetable: true,  sortable: false, apiField: "subscriber.zip_code",     placeholder: "e.g. 90210" },

  // ── Claim ──
  { key: "claimId",        label: "Claim ID / PCN",     category: "Claim",      type: "text",   indexed: true,  facetable: false, sortable: true,  apiField: "claim.patient_control_number" },
  { key: "claimType",      label: "Claim Type",         category: "Claim",      type: "select", indexed: true,  facetable: true,  sortable: true,  apiField: "claim.claim_type",        options: [{ value: "837P", label: "837P Professional" }, { value: "837I", label: "837I Institutional" }] },
  { key: "claimStatus",    label: "Claim Status",       category: "Claim",      type: "select", indexed: true,  facetable: true,  sortable: true,  apiField: "claim.status",            options: [{ value: "DRAFT", label: "Draft" }, { value: "READY", label: "Ready" }, { value: "CONVERTED", label: "Converted" }, { value: "SUBMITTED", label: "Submitted" }, { value: "ACCEPTED", label: "Accepted" }, { value: "REJECTED", label: "Rejected" }] },
  { key: "totalCharge",    label: "Total Charge",       category: "Claim",      type: "range",  indexed: false, facetable: false, sortable: true,  apiField: "claim.total_charge_amount", placeholder: "Min-Max" },
  { key: "serviceDateFrom", label: "Service Date From", category: "Claim",      type: "date",   indexed: true,  facetable: false, sortable: true,  apiField: "claim.service_date_from" },
  { key: "serviceDateTo",  label: "Service Date To",    category: "Claim",      type: "date",   indexed: true,  facetable: false, sortable: true,  apiField: "claim.service_date_to" },
  { key: "facilityCode",   label: "Place of Service",   category: "Claim",      type: "text",   indexed: true,  facetable: true,  sortable: true,  apiField: "claim.facility_code",     placeholder: "e.g. 11" },

  // ── Provider: Billing ──
  { key: "billingNPI",     label: "Billing NPI",        category: "Billing Provider", type: "text", indexed: true,  facetable: false, sortable: true, apiField: "billing_provider.npi",    placeholder: "10-digit NPI" },
  { key: "billingName",    label: "Billing Provider Name", category: "Billing Provider", type: "text", indexed: true, facetable: true, sortable: true, apiField: "billing_provider.name" },
  { key: "billingTaxId",   label: "Billing Tax ID",     category: "Billing Provider", type: "text", indexed: true,  facetable: false, sortable: false, apiField: "billing_provider.tax_id" },

  // ── Provider: Rendering ──
  { key: "renderingNPI",   label: "Rendering NPI",      category: "Rendering Provider", type: "text", indexed: true,  facetable: false, sortable: true, apiField: "rendering_provider.npi", placeholder: "10-digit NPI" },
  { key: "renderingName",  label: "Rendering Provider Name", category: "Rendering Provider", type: "text", indexed: true, facetable: true, sortable: true, apiField: "rendering_provider.name" },
  { key: "renderingTaxonomy", label: "Rendering Taxonomy", category: "Rendering Provider", type: "text", indexed: true, facetable: true, sortable: false, apiField: "rendering_provider.taxonomy" },

  // ── Diagnosis ──
  { key: "diagnosisCode",  label: "Diagnosis Code",     category: "Clinical",   type: "text",   indexed: true,  facetable: true,  sortable: false, apiField: "diagnoses[].code",        placeholder: "e.g. E11.9" },

  // ── Procedure / Service Line ──
  { key: "procedureCode",  label: "Procedure / CPT",    category: "Clinical",   type: "text",   indexed: true,  facetable: true,  sortable: false, apiField: "service_lines[].procedure_code", placeholder: "e.g. 99213" },
  { key: "revenueCode",    label: "Revenue Code",       category: "Clinical",   type: "text",   indexed: true,  facetable: true,  sortable: false, apiField: "service_lines[].revenue_code",   placeholder: "e.g. 0120" },

  // ── Payer ──
  { key: "payerName",      label: "Payer Name",         category: "Payer",      type: "text",   indexed: true,  facetable: true,  sortable: true,  apiField: "payer.name" },
  { key: "payerId",        label: "Payer ID",           category: "Payer",      type: "text",   indexed: true,  facetable: false, sortable: true,  apiField: "payer.id" }
];

// Group fields by category for UI rendering
export function getFieldsByCategory() {
  const cats = {};
  for (const f of SEARCH_FIELDS) {
    if (!cats[f.category]) cats[f.category] = [];
    cats[f.category].push(f);
  }
  return cats;
}

// Get a field definition by key
export function getField(key) {
  return SEARCH_FIELDS.find(f => f.key === key);
}

// ── Search API Contract ──
// This describes the REST API that a production backend would expose.
export const API_CONTRACT = {
  search: {
    method: "POST",
    endpoint: "/api/v1/claims/search",
    description: "Full-text and structured search across claims",
    requestBody: {
      query: "string — free-text search across all indexed fields",
      filters: "object — key/value pairs for structured field filters",
      facets: "string[] — field keys to return facet counts for",
      sort: "{ field: string, direction: 'asc'|'desc' }",
      page: "number — 1-based page number",
      pageSize: "number — results per page (default 25, max 200)",
      dateRange: "{ from: string, to: string } — optional global date filter"
    },
    responseBody: {
      results: "Claim[] — array of matching claim records",
      total: "number — total matching records",
      page: "number — current page",
      pageSize: "number — results per page",
      facets: "object — { fieldKey: { value: count }[] }",
      took: "number — query time in ms"
    }
  },
  getById: {
    method: "GET",
    endpoint: "/api/v1/claims/:id",
    description: "Get a single claim with all related records"
  },
  export: {
    method: "POST",
    endpoint: "/api/v1/claims/export",
    description: "Export search results as CSV/JSON/EDI"
  },
  aggregate: {
    method: "POST",
    endpoint: "/api/v1/claims/aggregate",
    description: "Aggregate queries (sum charges, count by status, etc.)"
  }
};

// Default pagination config
export const PAGINATION = {
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
  maxPageSize: 200
};

// Default sort
export const DEFAULT_SORT = { field: "serviceDateFrom", direction: "desc" };
