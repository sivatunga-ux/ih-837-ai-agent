# Claims Search Platform — Scalable Architecture

## 1. Overview

The current Claims Search prototype is a **client-side-only** application that stores data in the browser's `localStorage` and ships with ~250 sample claims. While this is sufficient for demonstrating UX and search behavior, a production system must meet significantly higher demands:

| Requirement        | Target                          |
| ------------------ | ------------------------------- |
| Total claims       | 10 M+                          |
| Concurrent users   | 100+                           |
| Search latency     | < 200 ms (p95)                 |
| Availability       | 99.9 % (multi-AZ)             |
| Compliance         | HIPAA, SOC 2                   |

This document describes the **target-state architecture** that scales the prototype to production.

---

## 2. System Architecture

```
                                ┌──────────────────────────────────────────────┐
                                │              Monitoring Stack                │
                                │         Prometheus  ·  Grafana               │
                                └──────────────────┬───────────────────────────┘
                                                   │ metrics / logs
                                                   ▼
┌──────────┐      ┌──────────────┐      ┌─────────────────────┐
│  Client   │─────▶│   AWS ALB /  │─────▶│    API Gateway       │
│ (Browser) │      │   NLB (L7)  │      │  (rate-limit, auth)  │
└──────────┘      └──────────────┘      └────────┬────────────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                          │ Search Svc-1 │ │ Search Svc-2 │ │ Search Svc-N │
                          │  (stateless) │ │  (stateless) │ │  (stateless) │
                          └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                                 │                │                │
                 ┌───────────────┼────────────────┼────────────────┘
                 │               │                │
          ┌──────▼──────┐ ┌─────▼──────┐  ┌──────▼──────┐
          │ Elastic-     │ │ PostgreSQL │  │   Redis     │
          │ search /     │ │ (primary + │  │  (cache)    │
          │ OpenSearch   │ │  replicas) │  └─────────────┘
          │ (3+ nodes)   │ └─────┬──────┘
          └──────▲───────┘       │
                 │               │  WAL stream
                 │        ┌──────▼──────┐
                 │        │  Debezium   │
                 │        │  (CDC)      │
                 │        └──────┬──────┘
                 │               │
                 │        ┌──────▼──────┐
                 │        │   Kafka     │
                 │        │  (topics)   │
                 │        └──────┬──────┘
                 │               │
                 │        ┌──────▼──────┐
                 └────────│  ES Bulk    │
                          │  Indexer    │
                          └─────────────┘

          ┌─────────────┐
          │  S3 Bucket  │  ← EDI 837 raw file storage
          └─────────────┘
```

### Component Responsibilities

| Component | Role |
| --- | --- |
| **Load Balancer** (ALB/NLB) | TLS termination, health checks, traffic distribution |
| **API Gateway** | Authentication, rate limiting, request routing |
| **Search Service** | Stateless query execution; horizontally auto-scaled |
| **Elasticsearch / OpenSearch** | Full-text search, faceted aggregations, typeahead |
| **PostgreSQL** | OLTP source of truth for all claims data |
| **Kafka + Debezium** | Change Data Capture pipeline from PostgreSQL to Elasticsearch |
| **Redis** | Caching layer for hot queries and facet counts |
| **S3** | Durable storage for raw EDI 837 files |
| **Prometheus + Grafana** | Metrics collection, dashboards, alerting |

---

## 3. Data Layer

### 3.1 PostgreSQL (Source of Truth)

PostgreSQL serves as the authoritative OLTP store. Core tables:

```
claims
├── claim_id          PK, UUID
├── claim_type        VARCHAR(10)    -- 837P / 837I
├── member_id         VARCHAR(20)
├── subscriber_name   VARCHAR(120)
├── provider_npi      VARCHAR(10)
├── provider_name     VARCHAR(120)
├── payer_name        VARCHAR(120)
├── status            VARCHAR(20)
├── total_charge      NUMERIC(12,2)
├── service_date_from DATE
├── service_date_to   DATE
├── state             CHAR(2)
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

subscribers       (member_id FK)
providers         (npi FK)
payers            (payer_id FK)
diagnoses         (claim_id FK, icd_code, sequence)
service_lines     (claim_id FK, cpt_code, charge, units)
```

**Partitioning**: Range-partition `claims` by `service_date_from` on a monthly basis.

```sql
CREATE TABLE claims (
    ...
) PARTITION BY RANGE (service_date_from);

CREATE TABLE claims_2024_01 PARTITION OF claims
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- one partition per month
```

**Indexes**:

```sql
CREATE INDEX idx_claims_member    ON claims (member_id);
CREATE INDEX idx_claims_npi       ON claims (provider_npi);
CREATE INDEX idx_claims_type      ON claims (claim_type);
CREATE INDEX idx_claims_status    ON claims (status);
CREATE INDEX idx_claims_svc_date  ON claims (service_date_from, service_date_to);
CREATE INDEX idx_claims_state     ON claims (state);
```

**Estimated storage**: ~1 KB per claim × 10 M claims = **~10 GB** base data (before indexes and overhead).

**Read replicas**: 1–2 read replicas in separate AZs for reporting workloads and failover.

### 3.2 Elasticsearch / OpenSearch (Search)

Elasticsearch powers all search, faceting, and typeahead functionality.

**Index naming**: `claims-YYYY-MM` (time-based indices aligned with PostgreSQL partitions).

**Shard strategy**:

- 3 primary shards per index
- 1 replica per primary shard
- Target: < 30 GB per shard

**Estimated index size**: ~2 KB per document × 10 M = **~20 GB** across all indices.

**Sample mapping** (key fields):

```json
{
  "mappings": {
    "properties": {
      "claimId":          { "type": "keyword" },
      "claimType":        { "type": "keyword" },
      "subscriberName":   {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "memberId":         { "type": "keyword" },
      "providerNpi":      { "type": "keyword" },
      "providerName":     {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "payerName":        {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "status":           { "type": "keyword" },
      "state":            { "type": "keyword" },
      "totalCharge":      { "type": "scaled_float", "scaling_factor": 100 },
      "serviceDateFrom":  { "type": "date", "format": "yyyy-MM-dd" },
      "serviceDateTo":    { "type": "date", "format": "yyyy-MM-dd" },
      "diagnosisCodes":   { "type": "keyword" },
      "diagnosisDescriptions": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "subscriberNameSuggest": {
        "type": "completion"
      }
    }
  }
}
```

**Index Lifecycle Management (ILM)**:

| Phase | Trigger | Action |
| --- | --- | --- |
| **Hot** | Current + 1 month | Full replicas, on SSD |
| **Warm** | > 3 months old | Read-only, reduced replicas, force-merge |
| **Cold** | > 12 months old | Frozen tier or searchable snapshot |
| **Delete** | > 7 years (retention policy) | Delete index |

### 3.3 Redis (Cache)

| Cache Key Pattern | TTL | Purpose |
| --- | --- | --- |
| `facets:{hash}` | 5 min | Pre-computed facet counts for common filter combos |
| `query:{hash}` | 1 min | Frequent search result pages |
| `session:{userId}` | 30 min | User session state and preferences |
| `suggest:{prefix}` | 10 min | Typeahead suggestion results |

Cache invalidation: TTL-based expiry; CDC events trigger selective cache busting for updated claims.

---

## 4. API Design

### 4.1 Search Endpoint

```
POST /api/v1/claims/search
Content-Type: application/json
Authorization: Bearer <JWT>
```

**Request body**:

```json
{
  "query": "smith diabetes",
  "filters": {
    "claimType": "837P",
    "state": "CA",
    "serviceDateFrom": "2024-01-01",
    "serviceDateTo": "2024-12-31"
  },
  "facets": [
    "claimType",
    "claimStatus",
    "state",
    "diagnosisCode",
    "payerName"
  ],
  "sort": {
    "field": "serviceDateFrom",
    "direction": "desc"
  },
  "page": 1,
  "pageSize": 25
}
```

**Response body**:

```json
{
  "results": [
    {
      "claimId": "CLM-2024-000123",
      "claimType": "837P",
      "subscriberName": "John Smith",
      "memberId": "MEM-00456",
      "providerName": "Dr. Jane Doe",
      "providerNpi": "1234567890",
      "payerName": "Blue Cross CA",
      "status": "Accepted",
      "totalCharge": 1250.00,
      "serviceDateFrom": "2024-06-15",
      "serviceDateTo": "2024-06-15",
      "state": "CA",
      "diagnosisCodes": ["E11.9"],
      "highlight": {
        "subscriberName": ["John <em>Smith</em>"],
        "diagnosisDescriptions": ["Type 2 <em>diabetes</em> mellitus"]
      }
    }
  ],
  "total": 4328,
  "facets": {
    "claimType":    { "837P": 3102, "837I": 1226 },
    "claimStatus":  { "Accepted": 2890, "Rejected": 1438 },
    "state":        { "CA": 4328 },
    "diagnosisCode": { "E11.9": 312, "E11.65": 198 },
    "payerName":    { "Blue Cross CA": 1540, "Aetna": 987 }
  },
  "took": 42,
  "page": 1,
  "pageSize": 25,
  "totalPages": 174
}
```

### 4.2 Other Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/claims/:id` | Fetch a single claim with full detail |
| `POST` | `/api/v1/claims/export` | Async CSV/Excel export; returns a job ID |
| `GET` | `/api/v1/claims/export/:jobId` | Poll export job status / download |
| `POST` | `/api/v1/claims/aggregate` | Custom aggregations (totals, averages by group) |
| `GET` | `/api/v1/claims/suggest?q=smi` | Typeahead suggestions (completion suggester) |

---

## 5. Search Strategy for Millions of Records

### 5.1 Indexing Pipeline

```
PostgreSQL  ──WAL──▶  Debezium  ──▶  Kafka topic  ──▶  ES Bulk Indexer
                      (CDC)          `claims.changes`    (batched writes)
```

- **Debezium** captures row-level changes from the PostgreSQL WAL in near real-time.
- **Kafka** decouples ingestion rate from indexing rate and provides replay capability.
- **ES Bulk Indexer** consumes batches (500–1000 docs) and writes via the Elasticsearch `_bulk` API.
- **Lag target**: < 5 seconds from PostgreSQL commit to Elasticsearch searchable.

### 5.2 Query Optimization

All search queries are translated into Elasticsearch `bool` queries:

```json
{
  "bool": {
    "must": [
      {
        "multi_match": {
          "query": "smith diabetes",
          "fields": [
            "subscriberName^3",
            "providerName^2",
            "diagnosisDescriptions",
            "payerName"
          ],
          "type": "cross_fields",
          "operator": "and"
        }
      }
    ],
    "filter": [
      { "term":  { "claimType": "837P" } },
      { "term":  { "state": "CA" } },
      { "range": { "serviceDateFrom": { "gte": "2024-01-01" } } },
      { "range": { "serviceDateTo":   { "lte": "2024-12-31" } } }
    ]
  }
}
```

**Key principles**:

- **Structured filters** go in `filter` context — cached by Elasticsearch, no scoring overhead.
- **Free-text** uses `multi_match` with field boosting (`subscriberName^3`) and `cross_fields` type.
- **Date ranges** always use `range` in filter context.
- **Pagination**: Use offset-based pagination for pages 1–400 (`from` / `size`). For offsets beyond 10,000, switch to `search_after` with a Point-In-Time (PIT) to avoid the deep pagination penalty.

### 5.3 Facets (Aggregations)

```json
{
  "aggs": {
    "claimType":   { "terms": { "field": "claimType",          "size": 20, "shard_size": 100 } },
    "claimStatus": { "terms": { "field": "status",             "size": 20, "shard_size": 100 } },
    "state":       { "terms": { "field": "state",              "size": 60, "shard_size": 200 } },
    "diagnosisCode": { "terms": { "field": "diagnosisCodes",   "size": 20, "shard_size": 100 } },
    "payerName":   { "terms": { "field": "payerName.keyword",  "size": 20, "shard_size": 100 } }
  }
}
```

- `shard_size` is set higher than `size` to improve accuracy of term counts across shards.
- Facet results are cached in Redis (5-minute TTL) keyed by the filter combination hash.

### 5.4 Typeahead

Two approaches, chosen per field type:

| Approach | Use Case | Latency |
| --- | --- | --- |
| **Completion suggester** | Subscriber name, provider name | < 10 ms |
| **Edge-ngram analyzer** | Diagnosis descriptions, free text | < 50 ms |

```json
{
  "suggest": {
    "name-suggest": {
      "prefix": "smi",
      "completion": {
        "field": "subscriberNameSuggest",
        "size": 10,
        "fuzzy": { "fuzziness": "AUTO" }
      }
    }
  }
}
```

---

## 6. Scaling Strategy

| Dimension | Prototype | Production |
| --- | --- | --- |
| **Data store** | localStorage | PostgreSQL + Elasticsearch |
| **Records** | 250 | 10 M+ |
| **Search latency** | < 10 ms (in-memory) | < 200 ms (p95) |
| **Indexing** | In-memory JS | CDC → Kafka → Bulk API |
| **Caching** | None | Redis (facets, hot queries) |
| **Concurrency** | 1 user | 100+ concurrent users |
| **Availability** | N/A | 99.9 % (multi-AZ) |
| **Deployment** | Static files | Kubernetes (EKS / GKE) |
| **Search fields** | Hardcoded | Config-driven field registry |
| **Auth** | None | OAuth 2.0 + JWT + RBAC |

### Horizontal Scaling Targets

| Component | Min Instances | Auto-Scale Trigger |
| --- | --- | --- |
| Search Service | 3 | CPU > 60 % or p95 latency > 150 ms |
| Elasticsearch data nodes | 3 | Disk > 75 % or search latency > 300 ms |
| PostgreSQL read replicas | 2 | Connection count > 80 % capacity |
| Redis | 1 primary + 2 replicas | Memory > 70 % |
| Kafka brokers | 3 | Consumer lag > 10 s |

---

## 7. Adding New Search Fields

The system is designed so that adding a searchable field requires **zero application code changes**:

### Step-by-Step Process

1. **Add column to PostgreSQL**

   ```sql
   ALTER TABLE claims ADD COLUMN rendering_provider VARCHAR(120);
   ```

2. **Update the field registry** (`searchConfig.js` or equivalent config file)

   ```js
   {
     field: 'renderingProvider',
     label: 'Rendering Provider',
     type: 'text',
     searchable: true,
     filterable: true,
     facetable: false,
     sortable: true
   }
   ```

3. **Update Elasticsearch index template**

   ```json
   {
     "renderingProvider": {
       "type": "text",
       "fields": { "keyword": { "type": "keyword" } }
     }
   }
   ```

4. **Re-index or wait for CDC**
   - For existing data: run a one-time re-index job.
   - For new data: Debezium automatically captures the new column.

5. **UI auto-generates controls**
   - Search input fields, filter dropdowns, sort options, and facet panels all render dynamically from the field registry.

### Why This Works

- The **API query builder** reads the field registry to construct Elasticsearch queries.
- The **search UI** reads the same registry to render controls.
- The **indexing pipeline** uses the Elasticsearch mapping, which is updated via the index template.
- No service redeployment is required — only a config update and (optionally) a re-index.

---

## 8. Backend Technology Recommendations

| Component | Recommended | Alternative |
| --- | --- | --- |
| **API Framework** | Node.js + Fastify | Python + FastAPI |
| **Search Engine** | Elasticsearch 8.x | OpenSearch 2.x |
| **Database** | PostgreSQL 15+ | Amazon Aurora PostgreSQL |
| **CDC** | Debezium (Kafka Connect) | Custom CDC via PostgreSQL logical replication |
| **Message Queue** | Apache Kafka | Amazon MSK / SQS + SNS |
| **Cache** | Redis 7+ | Amazon ElastiCache for Redis |
| **Authentication** | OAuth 2.0 + JWT | SAML 2.0 + OIDC |
| **Infrastructure** | Kubernetes (EKS / GKE) | AWS ECS / Fargate |
| **CI/CD** | GitHub Actions | GitLab CI / Jenkins |
| **Monitoring** | Prometheus + Grafana | Datadog / New Relic |
| **Log Aggregation** | ELK Stack / Loki | CloudWatch / Splunk |
| **Object Storage** | Amazon S3 | Google Cloud Storage |

### Rationale for Primary Choices

- **Fastify** over Express: 2–3× throughput, built-in schema validation, low overhead.
- **Elasticsearch 8.x**: Mature, widely adopted, rich aggregation framework, completion suggesters.
- **PostgreSQL 15+**: Native partitioning, logical replication for CDC, JSONB for semi-structured data.
- **Kafka**: Durable, replayable event log; decouples write path from indexing path.
- **Redis**: Sub-millisecond reads, native TTL support, cluster mode for HA.

---

## 9. Security Considerations

### 9.1 Authentication & Authorization

- **OAuth 2.0 / OIDC** for user authentication via an identity provider (e.g., Okta, Auth0).
- **JWT** access tokens with short expiry (15 min) and refresh token rotation.
- **RBAC** with field-level access control:

  | Role | Visible Fields | Actions |
  | --- | --- | --- |
  | Viewer | Non-PII fields only | Search, view |
  | Analyst | All fields, masked SSN | Search, view, export |
  | Admin | All fields, full access | Search, view, export, manage |

### 9.2 Data Protection

- **Encryption at rest**: AES-256 for PostgreSQL (TDE), S3 (SSE-S3/SSE-KMS), Elasticsearch (encrypted data directory).
- **Encryption in transit**: TLS 1.2+ for all inter-service communication.
- **PHI/PII handling**: Sensitive fields (SSN, DOB, full name) are stored encrypted and decrypted only at the API layer for authorized users.

### 9.3 Audit & Compliance

- **Audit logging**: Every search query, claim view, and data export is logged with user ID, timestamp, query parameters, and result count.
- **HIPAA compliance**:
  - Business Associate Agreement (BAA) with cloud provider.
  - Access controls enforced at every layer.
  - Minimum necessary standard for data access.
  - Regular risk assessments and penetration testing.
- **Data masking** in non-production environments: PII fields are replaced with synthetic data using tools like Faker or custom masking scripts.

### 9.4 Network Security

- VPC isolation with private subnets for databases and search clusters.
- Security groups restrict traffic to known service ports.
- WAF rules at the load balancer for common attack patterns (SQL injection, XSS).
- API rate limiting: 100 requests/min per user, 1000 requests/min per organization.

---

## 10. Implementation Phases

| Phase | Scope | Sprint Estimate | Key Deliverables |
| --- | --- | --- | --- |
| **1** | API + PostgreSQL + basic search | 4–6 sprints | REST API, DB schema, basic keyword search against PostgreSQL |
| **2** | Elasticsearch integration + CDC | 3–4 sprints | ES cluster, Debezium pipeline, full-text search, facets |
| **3** | Redis caching + performance tuning | 2–3 sprints | Cache layer, query optimization, load testing |
| **4** | Advanced features | 2–3 sprints | CSV/Excel export, custom aggregations, typeahead |
| **5** | Production hardening | 3–4 sprints | Monitoring, RBAC, HIPAA audit, HA deployment, disaster recovery |

### Phase Dependencies

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3
                │              │
                └──▶ Phase 4 ──┘
                               │
                               └──▶ Phase 5
```

Phases 3 and 4 can be parallelized after Phase 2 is complete. Phase 5 depends on both Phase 3 and Phase 4.

### Success Metrics

| Metric | Target |
| --- | --- |
| Search p50 latency | < 50 ms |
| Search p95 latency | < 200 ms |
| Indexing lag (CDC to searchable) | < 5 seconds |
| Availability | 99.9 % |
| Time to add a new search field | < 1 hour (config only) |
| Export throughput | 100 K records/min |
