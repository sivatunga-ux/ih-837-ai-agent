# Production Architecture Recommendations
## CMS Encounter Analytics Platform — 100M+ Records

---

## 1. Database Strategy: The Right Tool for Each Job

Healthcare encounter data has 3 distinct access patterns. No single database serves all three well. **Use purpose-built stores for each pattern.**

### 1.1 Recommended Data Stack

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ PostgreSQL   │  │ ClickHouse  │  │   DuckDB    │  │   Redis    │ │
│  │ (OLTP)       │  │ (OLAP)      │  │ (Embedded)  │  │ (Cache)    │ │
│  │              │  │             │  │             │  │            │ │
│  │ Claims CRUD  │  │ Analytics   │  │ Agent-local │  │ Hot query  │ │
│  │ Workflows    │  │ at 100M+    │  │ computation │  │ results    │ │
│  │ Audit trail  │  │ sub-second  │  │ file-based  │  │ Sessions   │ │
│  │ Edit rules   │  │ aggregation │  │ batch jobs  │  │ Facets     │ │
│  │ Task queue   │  │             │  │             │  │            │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                 │                │                │        │
│         │    ┌────────────┴─────┐          │                │        │
│         └───>│  CDC (Debezium)  │──────────┘                │        │
│              │  via Kafka       │                            │        │
│              └──────────────────┘                            │        │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why This Combination

| Database | Role | Why Not Just This One? |
|----------|------|----------------------|
| **PostgreSQL** | Source of truth — claims, workflows, audit, rules, tasks | Too slow for 100M-row aggregations (minutes vs seconds) |
| **ClickHouse** | Analytics warehouse — all aggregation queries hit this | No ACID transactions, not suited for CRUD/workflow state |
| **DuckDB** | Agent-local analytics — agents run complex computations without hitting the network | In-process only, single-writer, no concurrent multi-user |
| **Redis** | Cache layer — facet counts, hot query results, session state | Volatile, not a system of record |

### 1.3 DuckDB: Where It Fits

DuckDB is **not** the primary analytics database at 100M scale. It's the **agent computation engine**:

```
Agent receives batch of 10,000 claims
  → Loads into in-process DuckDB instance (Parquet files)
  → Runs comorbidity rules as SQL window functions
  → Produces anomaly results in <200ms
  → Writes results to PostgreSQL (state) + ClickHouse (analytics)
  → DuckDB instance disposed — zero operational overhead
```

**DuckDB strengths we use:**
- Zero deployment cost (embedded, no server)
- 100M-row aggregation on a single machine in <1 second
- Native Parquet read/write (pipeline intermediary format)
- SQL interface — same queries work in ClickHouse for production
- Perfect for batch agent jobs and data science exploration

**DuckDB limits we avoid:**
- Not a shared server (no multi-user concurrent access)
- Single-writer (agents write results elsewhere)
- No built-in replication or HA

### 1.4 ClickHouse for Production Analytics

For the **dashboard and API layer** serving 50+ concurrent users querying 100M+ records:

```sql
-- This query runs in <200ms on 100M rows in ClickHouse
SELECT
  toYYYYMM(service_date) AS month,
  billing_npi,
  count() AS claim_count,
  sum(total_charge) AS total_charge,
  avg(dx_count) AS avg_dx_per_claim,
  uniqExact(member_id) AS unique_members
FROM encounters
WHERE service_date >= '2024-01-01'
GROUP BY month, billing_npi
ORDER BY month, claim_count DESC
```

ClickHouse advantages at 100M+:
- Sub-second aggregation on billions of rows
- Columnar compression: 100M claims ≈ 15-20GB storage
- 50+ concurrent dashboard users without degradation
- Real-time ingestion (100K rows/second sustained)
- MergeTree engine with automatic partitioning by month

---

## 2. Frontend & Backend Stack

### 2.1 Recommended Production Stack

```
┌────────────────────────────────────────────────────────────────┐
│                      FRONTEND                                   │
│                                                                 │
│  Next.js 15 (React 19) + TypeScript                            │
│  ├── Shadcn/UI (component library — healthcare-professional)   │
│  ├── TanStack Table (sortable, filterable, 100K-row virtual)   │
│  ├── Recharts or Tremor (charts — bar, line, treemap, donut)   │
│  ├── TanStack Query (server state, caching, real-time)         │
│  └── Zustand (client state — filters, selections)              │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                      API LAYER                                  │
│                                                                 │
│  Node.js 22 + Fastify (or Python + FastAPI)                    │
│  ├── tRPC or REST (type-safe API contract)                     │
│  ├── Auth: NextAuth.js / Auth0 (RBAC + HIPAA)                 │
│  ├── Rate limiting + request validation                         │
│  └── OpenTelemetry (tracing every agent call)                  │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                    AGENT ORCHESTRATION                           │
│                                                                 │
│  Temporal.io (workflow engine)                                  │
│  ├── Durable execution — agent steps survive crashes           │
│  ├── Task queues — parallel worker scaling                     │
│  ├── Retry policies — automatic retry on transient failures    │
│  ├── Visibility — full audit of every workflow execution       │
│  └── Schedules — monthly analytics runs, daily ingestion       │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                 │
│                                                                 │
│  PostgreSQL 16 (OLTP) + ClickHouse 24 (OLAP)                  │
│  DuckDB (agent-local) + Redis 7 (cache)                        │
│  Kafka (CDC + event streaming)                                  │
│  S3 (EDI file storage + Parquet intermediary)                   │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Why These Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Frontend** | Next.js + Shadcn/UI | SSR for fast initial load, server components for data-heavy pages, Shadcn gives healthcare-professional look with zero lock-in |
| **API** | Fastify (Node) or FastAPI (Python) | Fastify: 30K req/sec, TypeScript end-to-end. FastAPI: Python ecosystem for data science agents |
| **Workflow** | Temporal.io | Durable execution (agent steps survive crashes), built-in task queues, retry, visibility. Production-proven in healthcare (Linus Health, cancer care networks) |
| **OLTP DB** | PostgreSQL 16 | ACID transactions for claims/workflows/audit. Mature, HIPAA-auditable, JSON support for flexible schema |
| **OLAP DB** | ClickHouse 24 | Sub-second on 100M+ rows, 50+ concurrent users, columnar compression, real-time ingestion |
| **Agent compute** | DuckDB | Embedded OLAP for batch agent jobs — zero ops, Parquet native, SQL interface |
| **Cache** | Redis 7 | Facet counts (TTL 5min), hot query results (TTL 1min), workflow state |
| **Streaming** | Kafka | CDC from PostgreSQL → ClickHouse, event-driven agent triggers |
| **Storage** | S3 | 837 EDI files, Parquet intermediary, audit archives |

---

## 3. Agent Architecture — How They Interact

### 3.1 Complete Agent Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         TEMPORAL WORKFLOWS                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PIPELINE WORKFLOW (per batch)                                    │    │
│  │                                                                  │    │
│  │  Ingest ──> Map ──> Validate ──> Template ──> Generate ──> Verify│    │
│  │  (A1)      (A2)    (A3)        (A4)         (A5)        (A6)    │    │
│  │                                                                  │    │
│  │  Workers: 5 parallel (each handles ~100 claims)                  │    │
│  │  Retry: 3 attempts per activity, exponential backoff             │    │
│  │  Timeout: 5 min per activity, 30 min per workflow                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ DX ANALYTICS WORKFLOW (monthly or on-demand)                     │    │
│  │                                                                  │    │
│  │  Load Data ──> Volume ──> Provider ──> Comorbidity ──> Prioritize│    │
│  │  (D0)         (D1)       (D2)         (D3)            (D4)      │    │
│  │                                                                  │    │
│  │  D0: Load claims from ClickHouse into DuckDB (agent-local)      │    │
│  │  D1-D4: Run analytics on DuckDB, write results to PostgreSQL    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ ANOMALY WORKFLOW (per detected anomaly)                          │    │
│  │                                                                  │    │
│  │  Detect ──> Score ──> Create Task ──> [Wait for Human] ──>      │    │
│  │                           │               │                      │    │
│  │                      Push to Queue    Assign/Defer/Resolve       │    │
│  │                           │               │                      │    │
│  │                      Notify (Email/   Update Status ──> Audit    │    │
│  │                       Slack/Teams)                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ EDIT UPDATE WORKFLOW (quarterly)                                  │    │
│  │                                                                  │    │
│  │  Upload Excel ──> Parse ──> Diff ──> Preview ──> [Approve] ──>  │    │
│  │                                                   Apply + Version│    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Agent Interaction Flows

#### Flow 1: Claims Ingestion (Daily)

```
External System            Temporal              PostgreSQL     ClickHouse    S3
     │                        │                      │              │          │
     │── Upload CSV/837 ──>   │                      │              │          │
     │                   Start Pipeline WF            │              │          │
     │                        │── A1: Ingest ────────>│ claims       │          │
     │                        │── A2: Map ───────────>│ mapped       │          │
     │                        │── A3: Validate ──────>│ validated    │          │
     │                        │── A4: Template ──────>│ templated    │          │
     │                        │── A5: Generate ──────>│              │          │── 837.edi
     │                        │── A6: Verify ────────>│ status=READY │          │
     │                        │                       │              │          │
     │                        │── CDC (Kafka) ────────┼─────────────>│ sync     │
     │                        │                       │              │          │
     │<── Pipeline Report ────│                       │              │          │
```

#### Flow 2: Dx Analytics (Monthly)

```
Scheduler                 Temporal              DuckDB(local)  PostgreSQL   ClickHouse
     │                        │                      │              │          │
     │── Trigger Monthly ──>  │                      │              │          │
     │                   Start Dx Analytics WF       │              │          │
     │                        │── D0: Load ──────────┼──────────────┼──< Query │
     │                        │                  Load Parquet       │          │
     │                        │── D1: Volume ───────>│ compute      │          │
     │                        │── D2: Provider ─────>│ compute      │          │
     │                        │── D3: Comorbidity ──>│ compute      │          │
     │                        │── D4: Prioritize                    │          │
     │                        │       │                             │          │
     │                        │       └── Write anomalies ─────────>│          │
     │                        │       └── Write analytics ─────────>│          │
     │                        │       └── Push tasks to queue ─────>│          │
     │                        │                                     │          │
     │<── Analytics Ready ────│                                     │          │
```

#### Flow 3: Anomaly Resolution (Human-in-the-Loop)

```
Dashboard (UI)            API                  Temporal              PostgreSQL
     │                      │                      │                      │
     │── View Worklist ────>│── GET /anomalies ───>│                      │
     │<── Anomaly List ─────│<─────────────────────┼── Query anomalies ──<│
     │                      │                      │                      │
     │── Assign to User ───>│── PUT /anomalies/id ────────────────────>  │ status=ASSIGNED
     │                      │                      │── Signal Workflow ─>  │
     │                      │                      │   (human task)        │
     │                      │                      │                      │
     │── Resolve ──────────>│── PUT /anomalies/id ────────────────────>  │ status=RESOLVED
     │                      │                      │── Complete Activity   │
     │                      │                      │                      │
     │                      │                      │── If CRR needed:     │
     │                      │                      │   Start Pipeline WF  │
     │                      │                      │   (generate CRR 837) │
```

---

## 4. Task Queue & Workflow Tracking

### 4.1 Why Temporal.io (Not a Custom Queue)

| Requirement | Custom Queue | Temporal.io |
|-------------|:------------:|:-----------:|
| Durable execution (survive crashes) | Build it | Built-in |
| Retry with backoff | Build it | Built-in (configurable per activity) |
| Human-in-the-loop tasks | Build it | Built-in signals + queries |
| Workflow visibility/audit | Build it | Built-in Web UI + API |
| Parallel task fan-out | Build it | Built-in (child workflows) |
| Scheduled runs (daily/monthly) | Cron + glue | Built-in schedules |
| Long-running workflows (wait days for human) | Fragile | First-class support |
| Workflow versioning | Complex | Built-in |

### 4.2 Task Queue Architecture

```
┌─── TEMPORAL TASK QUEUES ──────────────────────────────────────┐
│                                                                │
│  Queue: "pipeline-ingest"     Workers: 5     (A1)             │
│  Queue: "pipeline-validate"   Workers: 5     (A3)             │
│  Queue: "pipeline-generate"   Workers: 3     (A5)             │
│  Queue: "analytics-compute"   Workers: 2     (D1-D4)          │
│  Queue: "anomaly-detect"      Workers: 2     (Comorbidity)    │
│  Queue: "human-review"        Workers: N/A   (Wait for human) │
│  Queue: "notification"        Workers: 1     (Email/Slack)    │
│                                                                │
│  Scaling: Add workers to any queue independently              │
│  Monitoring: Temporal Web UI shows queue depth, latency        │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Anomaly Task Lifecycle in Temporal

```typescript
// Temporal Workflow Definition (TypeScript)
async function anomalyResolutionWorkflow(anomaly: Anomaly) {
  // Step 1: Score and prioritize
  const scored = await activities.scoreAnomaly(anomaly);
  
  // Step 2: Create task in PostgreSQL
  await activities.createTask(scored);
  
  // Step 3: Notify assignee (if auto-assigned)
  if (scored.priority === 1) {
    await activities.notifySlack(scored);
  }
  
  // Step 4: Wait for human action (can wait days/weeks)
  const resolution = await workflow.waitForSignal('resolve', {
    timeout: '30 days'
  });
  
  // Step 5: Process resolution
  if (resolution.action === 'CORRECTED') {
    // Generate CRR to fix the diagnosis
    await workflow.startChild(pipelineWorkflow, {
      args: [resolution.correctedClaim],
      taskQueue: 'pipeline-generate'
    });
  }
  
  // Step 6: Update status and audit
  await activities.updateAnomalyStatus(anomaly.id, resolution);
  await activities.writeAuditLog(anomaly.id, resolution);
}
```

---

## 5. API Design

### 5.1 Core API Endpoints

```
── PIPELINE ──────────────────────────────────────────────
POST   /api/v1/pipeline/run          Start pipeline for uploaded file
GET    /api/v1/pipeline/:id/status   Get pipeline execution status
GET    /api/v1/pipeline/:id/results  Get pipeline results + generated files
GET    /api/v1/pipeline/history      List past pipeline runs

── CLAIMS ────────────────────────────────────────────────
GET    /api/v1/claims                List/search claims (paginated)
GET    /api/v1/claims/:id            Get single claim with all related data
GET    /api/v1/claims/:id/837        Get the generated 837 EDI for a claim
POST   /api/v1/claims/search         Advanced search with filters + facets

── ANALYTICS ─────────────────────────────────────────────
GET    /api/v1/analytics/overview    KPIs + summary
GET    /api/v1/analytics/providers   Provider summary (billing + rendering)
GET    /api/v1/analytics/members     Member summary
GET    /api/v1/analytics/trending    Monthly trends
GET    /api/v1/analytics/dx          Diagnosis analytics
GET    /api/v1/analytics/dx/top      Top codes by qualifier
GET    /api/v1/analytics/dx/gaps     Comorbidity gap summary
GET    /api/v1/analytics/cpt         Procedure analytics (future)
POST   /api/v1/analytics/run         Trigger analytics refresh

── ANOMALIES ─────────────────────────────────────────────
GET    /api/v1/anomalies             List anomalies (filtered, paginated)
GET    /api/v1/anomalies/:id         Get single anomaly detail
PUT    /api/v1/anomalies/:id/assign  Assign to user
PUT    /api/v1/anomalies/:id/resolve Resolve with action
PUT    /api/v1/anomalies/:id/defer   Defer with reason
GET    /api/v1/anomalies/summary     Counts by status/severity/rule

── WORKFLOW ──────────────────────────────────────────────
GET    /api/v1/workflows             List active workflows (Temporal)
GET    /api/v1/workflows/:id         Get workflow execution detail
POST   /api/v1/workflows/:id/signal  Send signal to workflow (resolve/cancel)

── RULES ─────────────────────────────────────────────────
GET    /api/v1/rules                 List comorbidity rules
PUT    /api/v1/rules/:id             Update rule (toggle active, adjust severity)
POST   /api/v1/rules                 Add custom rule
POST   /api/v1/rules/upload          Upload CMS edit spreadsheet

── FILES ─────────────────────────────────────────────────
GET    /api/v1/files                 List generated 837 files
GET    /api/v1/files/:id/download    Download 837 EDI file
GET    /api/v1/files/:id/content     View 837 content (text)
```

---

## 6. Design Principles

### 6.1 Architecture Principles

| # | Principle | Implementation |
|---|-----------|---------------|
| 1 | **Agents are stateless** | All state in PostgreSQL/ClickHouse. Agents read, compute, write. Crash-safe via Temporal. |
| 2 | **Config over code** | Comorbidity rules, edit rules, qualifier values — all configurable. No deploy for rule changes. |
| 3 | **Right DB for the job** | OLTP (PostgreSQL) + OLAP (ClickHouse) + Agent-local (DuckDB) + Cache (Redis). |
| 4 | **Event-driven, not polling** | Kafka CDC streams changes. Temporal triggers workflows. No cron polling. |
| 5 | **Human-in-the-loop is first-class** | Temporal workflows natively wait for human signals. Anomaly resolution is a workflow, not a status flag. |
| 6 | **Audit everything** | Every agent step, every rule execution, every human action → immutable audit log. |
| 7 | **Scale horizontally** | Add workers to any Temporal queue. Partition ClickHouse by month. Read replicas for PostgreSQL. |
| 8 | **HIPAA by design** | Encryption at rest + in transit. Field-level RBAC. PHI masking in non-prod. BAA with all cloud providers. |

### 6.2 Data Flow Principles

```
WRITE PATH (ingestion):
  Upload → API → Temporal → Agent Workers → PostgreSQL → Kafka CDC → ClickHouse

READ PATH (analytics):
  Dashboard → API → ClickHouse (aggregations) + Redis (cached facets)

COMPUTE PATH (agents):
  Temporal → Agent Worker → DuckDB (local Parquet) → Results → PostgreSQL + ClickHouse

WORKFLOW PATH (anomalies):
  Detection → Temporal Workflow → Task Queue → Human Signal → Resolution → Audit
```

---

## 7. Deployment Architecture

```
┌─── Kubernetes (EKS / GKE) ──────────────────────────────────────┐
│                                                                   │
│  ┌── Frontend Pod(s) ───────────────┐                            │
│  │ Next.js 15 (SSR + Static)        │  Replicas: 2-4            │
│  │ CDN: CloudFront / Cloudflare     │                            │
│  └──────────────────────────────────┘                            │
│                                                                   │
│  ┌── API Pod(s) ────────────────────┐                            │
│  │ Fastify + tRPC                    │  Replicas: 3-6            │
│  │ OpenTelemetry instrumented        │  HPA: CPU 60% target      │
│  └──────────────────────────────────┘                            │
│                                                                   │
│  ┌── Temporal Server ───────────────┐                            │
│  │ Temporal + PostgreSQL backend     │  HA: 3 replicas           │
│  └──────────────────────────────────┘                            │
│                                                                   │
│  ┌── Agent Workers ─────────────────┐                            │
│  │ Pipeline Workers    (5 pods)      │  Scale: 2-10 based on     │
│  │ Analytics Workers   (2 pods)      │  queue depth               │
│  │ Anomaly Workers     (2 pods)      │                            │
│  │ Notification Workers(1 pod)       │  Each has DuckDB embedded  │
│  └──────────────────────────────────┘                            │
│                                                                   │
│  ┌── Data Layer ────────────────────┐                            │
│  │ PostgreSQL 16 (RDS/Aurora)  HA    │                            │
│  │ ClickHouse 24 (Cloud)       3-node│                            │
│  │ Redis 7 (ElastiCache)       HA    │                            │
│  │ Kafka (MSK)                 3-node│                            │
│  │ S3 (EDI files + Parquet)          │                            │
│  └──────────────────────────────────┘                            │
└───────────────────────────────────────────────────────────────────┘
```

---

## 8. Execution Plan

### Phase 1: Core Platform (8-10 weeks)

| Week | Deliverable |
|------|------------|
| 1-2 | PostgreSQL schema + ClickHouse tables + Kafka CDC pipeline |
| 3-4 | Fastify API (claims CRUD, search, file management) |
| 5-6 | Temporal setup + Pipeline Workflow (A1-A6 as activities) |
| 7-8 | Next.js frontend: Overview, Files, Hierarchy, Provider tabs |
| 9-10 | Integration testing, HIPAA audit, deployment to staging |

### Phase 2: Dx Analytics + Anomaly Workflow (6-8 weeks)

| Week | Deliverable |
|------|------------|
| 1-2 | Dx Analytics Agent (D1-D4) with DuckDB compute |
| 3-4 | Comorbidity Rule Engine (15 rules, configurable) |
| 5-6 | Anomaly Workflow in Temporal (detect → assign → resolve) |
| 7-8 | Frontend: Dx Analytics tabs, Action Tracker, Settings |

### Phase 3: Scale & Advanced (6-8 weeks)

| Week | Deliverable |
|------|------------|
| 1-2 | ClickHouse optimization for 100M+ (partitioning, materialized views) |
| 3-4 | CPT-Dx Association Agent + HCC Opportunity Agent |
| 5-6 | Provider Benchmarking + Trending with change detection |
| 7-8 | Performance testing at 100M scale, production hardening |

---

## 9. Cost Estimate (AWS, Production)

| Component | Spec | Monthly Cost |
|-----------|------|:------------:|
| EKS Cluster | 3 nodes, m6i.xlarge | ~$400 |
| API Pods | 3-6 × m6i.large | ~$300 |
| Agent Workers | 5-10 × m6i.large | ~$500 |
| RDS PostgreSQL | db.r6g.xlarge, Multi-AZ | ~$600 |
| ClickHouse Cloud | 100GB, 3 replicas | ~$500 |
| ElastiCache Redis | cache.r6g.large, HA | ~$250 |
| MSK Kafka | 3 brokers, kafka.m5.large | ~$500 |
| S3 | 500GB (EDI + Parquet) | ~$15 |
| Temporal Cloud | 1M actions/month | ~$200 |
| CloudWatch / Monitoring | Logs + metrics | ~$100 |
| **Total** | | **~$3,365/mo** |

At 100M records: storage scales linearly but compute stays flat for typical query patterns.
