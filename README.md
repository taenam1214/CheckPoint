# Checkpoint — Agent Review & Approval Layer (MVP)

> **For Claude Code:** This is a build spec, not just documentation. Read it
> fully before writing any code. Follow the build phases in order. Respect the
> "Do NOT build" guardrails — scope creep is the main risk here. After reading,
> produce a short plan and confirm the tech choices before scaffolding.

---

## 1. What this is

Checkpoint is the **review, approval, and audit layer for AI agents operating in
regulated workflows**. When an AI agent proposes a consequential action (approve
a loan, deny a claim, move money), a human must sign off before it executes.
Today that handoff is a raw log dump or a thin "approve? [y/n]" Slack message
with no context — so the human has to half-redo the work to judge it.

Checkpoint is the purpose-built surface for that human: a fast review cockpit
that shows the proposed action plus the *minimum sufficient context* to judge it,
with one-tap approve / reject / edit — and every decision becomes an append-only,
exportable audit record for compliance.

**This is a web app.** The deliverable is a product demo for a YC application.

### The single most important framing
**We are NOT building real AI agents for this MVP.** We fake the agent with a
seeded simulator that produces a believable stream of pending decisions. ALL
engineering effort goes into the review cockpit and the audit trail. The agent
is scaffolding; the review experience is the product.

---

## 2. Demo goal (what success looks like)

A reviewer (demo persona: a lending ops analyst) opens the app and sees a live
queue of pending agent decisions sorted by risk. They can:

1. Scan the queue and immediately see which decisions are risky.
2. Open one high-stakes decision and, in ~2 seconds, see the one fact that makes
   it risky (e.g. "income doc is 60 days old").
3. Reject it with a single keystroke.
4. See that rejection land in an immutable audit trail as a defensible record.
5. Export the audit trail as a compliance artifact (CSV/PDF).

The 30-second arc — risky decision surfaced → rejected in one keystroke → logged
to audit — IS the pitch. Build everything in service of making that arc feel
obviously better than a Slack approval message.

---

## 3. Tech stack (decided — do not substitute without asking)

**Frontend**
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui (sharp components without hand-rolling)
- React Router for the two main views
- TanStack Query for server state (polling)

**Backend**
- Node + TypeScript, Fastify (or Express if simpler) — thin REST API
- Postgres (relational, with a real append-only audit table — this is load-bearing
  for the compliance story; do NOT use Firebase or a document store)
- Prisma or Drizzle for the schema/migrations + typed queries (pick Drizzle for
  speed and a thinner abstraction; Prisma is fine if preferred)

**Infra / hosting**
- Frontend → Vercel
- API + Postgres → Railway or Render
- Local dev → docker-compose for Postgres, or a single Railway dev DB

**Repo shape:** a monorepo with `/web` (frontend) and `/api` (backend), or two
top-level folders. Keep it simple — pnpm workspaces is fine but not required.

---

## 4. Data model

Four tables. This is the spine of the demo and what makes the compliance story
real. Use UUIDs for all primary keys. All timestamps `timestamptz`, default now().

### `agents`
| column              | type    | notes                                        |
|---------------------|---------|----------------------------------------------|
| id                  | uuid PK |                                              |
| name                | text    | e.g. "LoanPreApprovalBot"                    |
| workflow            | text    | e.g. "loan_pre_approval"                     |
| autonomy_threshold  | float   | confidence cutoff above which it could auto-execute (0–1) |
| created_at          | timestamptz |                                          |

### `decisions` — the heart of the app
| column           | type     | notes                                                |
|------------------|----------|------------------------------------------------------|
| id               | uuid PK  |                                                      |
| agent_id         | uuid FK  | → agents.id                                          |
| status           | text     | enum: `pending` / `approved` / `rejected` / `auto_approved` |
| proposed_action  | text     | human-readable, e.g. "Approve $42,000 personal loan for applicant #8841" |
| confidence       | float    | agent's self-reported confidence (0–1)               |
| risk_tier        | text     | enum: `low` / `medium` / `high`                      |
| context          | jsonb    | the 2–3 facts a reviewer needs (NOT a raw trace) — see shape below |
| similar_cases    | jsonb    | array of 2–3 past decisions + how they were resolved |
| created_at       | timestamptz |                                                   |
| resolved_at      | timestamptz | nullable                                          |

**`context` jsonb shape (hand-authored to be genuinely useful):**
```json
{
  "summary": "Personal loan pre-approval",
  "facts": [
    { "label": "Applicant income", "value": "$78,000 / yr" },
    { "label": "Debt-to-income", "value": "41%", "flag": "borderline" },
    { "label": "Requested amount", "value": "$42,000" },
    { "label": "Income document age", "value": "60 days", "flag": "stale" }
  ],
  "policy_note": "DTI above 40% requires manual review per policy LP-12."
}
```
The `flag` field drives the visual highlight that makes risk pop instantly.

**`similar_cases` jsonb shape:**
```json
[
  { "ref": "#8722", "summary": "DTI 39%, fresh docs", "resolved": "approved" },
  { "ref": "#8610", "summary": "DTI 43%, stale income doc", "resolved": "rejected" }
]
```

### `reviews` — each human action
| column       | type     | notes                                  |
|--------------|----------|----------------------------------------|
| id           | uuid PK  |                                        |
| decision_id  | uuid FK  | → decisions.id                         |
| reviewer_id  | text     | hardcoded demo user for MVP            |
| verdict      | text     | enum: `approved` / `rejected` / `edited` |
| note         | text     | nullable — reason / edit               |
| created_at   | timestamptz |                                     |

### `audit_log` — APPEND-ONLY
| column       | type     | notes                                            |
|--------------|----------|--------------------------------------------------|
| id           | uuid PK  |                                                  |
| decision_id  | uuid FK  | → decisions.id                                   |
| event_type   | text     | e.g. `decision_created`, `human_approved`, `human_rejected`, `auto_approved`, `exported` |
| snapshot     | jsonb    | immutable snapshot of the full decision + verdict at that moment |
| created_at   | timestamptz |                                               |

**Critical:** `audit_log` is append-only. The application code must ONLY ever
`INSERT` into it — never `UPDATE` or `DELETE`. Enforce at the app layer, and
ideally add a Postgres rule/trigger or revoke UPDATE/DELETE on the table for the
app role. This immutability is the thing we point at to prove it's a compliance
product, not just a queue.

---

## 5. API surface (thin REST)

```
GET    /api/decisions?status=pending&sort=risk   → list, sorted by risk tier then confidence
GET    /api/decisions/:id                         → single decision with full context
POST   /api/decisions/:id/review                  → body: { verdict, note? }
                                                     writes reviews row,
                                                     updates decision status + resolved_at,
                                                     INSERTs audit_log row,
                                                     returns updated decision
GET    /api/audit                                 → chronological audit_log, filterable by event_type / decision_id
GET    /api/audit/export?format=csv               → streamed CSV of audit_log (PDF optional later)
POST   /api/demo/reset                            → wipes decisions/reviews/audit_log, re-runs seed (demo hygiene)
POST   /api/demo/drip                             → inserts one new pending decision (for live-demo flair); can be on an interval
```

Keep handlers thin. Validate input with zod. Return typed JSON.

---

## 6. The agent simulator (fake it well)

A seed script + a tiny generator. **No LLM calls anywhere.**

- Seed 2–3 agents in the lending domain (lending is cleanest: concrete actions,
  legible dollar stakes).
- Generate ~40–60 decisions with realistic distribution:
  - Majority: low-risk, high-confidence (agent is usually right).
  - A meaningful slice: medium-risk.
  - A handful: high-risk / low-confidence — *obviously* the cases a human should
    catch (stale docs, DTI over policy, amount spikes).
- Hand-author the `context` and `similar_cases` blobs so they're genuinely useful,
  not lorem ipsum. The demo lives or dies on these reading like real cases.
- On `decision_created`, also INSERT the matching `audit_log` row.

**Live drip (optional flair):** a `setInterval` on the server (or the
`/api/demo/drip` endpoint) that inserts a pre-written pending decision every few
seconds so the queue visibly populates during the demo.

---

## 7. The review cockpit (over-invest here)

Two-pane layout. This is the screen the partner remembers.

**Left pane — the queue**
- Pending decisions sorted by risk tier (high → low), then by confidence ascending.
- Each row = compact card: proposed action, a risk pill (green/amber/red),
  confidence as a small inline bar, time waiting.
- Selected row highlighted; queue auto-advances after an action.

**Right pane — the decision detail (the thesis lives here)**
- Proposed action, prominent.
- **Minimum sufficient context**, rendered as clean labeled fields from
  `context.facts` — NOT a JSON dump. Flagged facts (`flag: "stale"` /
  `"borderline"`) get a visible highlight so risk pops in ~2 seconds.
- Policy note callout.
- Risk + confidence readout.
- Similar past cases with how each was resolved.
- Three primary actions: **Approve**, **Reject**, **Edit & approve**
  (edit opens a small sheet — not a modal — to adjust + add a note).

**Keyboard shortcuts (signals "built for someone who does this 200×/day"):**
- `J` / `K` — move down / up the queue
- `A` — approve
- `R` — reject
- `E` — edit & approve
- `Enter` — open focused decision

**Autonomy-graduation touch (no ML needed):** decisions with
`confidence > agent.autonomy_threshold` get distinct visual treatment and a note:
"Would auto-approve at current threshold — shown for spot-check." This
demonstrates the "agents earn autonomy over time" story for free.

**On action:** POST to `/api/decisions/:id/review` → writes review, updates
status, inserts audit row → queue advances to next item.

---

## 8. The audit trail view (the compliance kicker)

A second screen. Simpler, strategically vital — this is what separates us from
"agent observability" tools in the partner's mind (they show engineers traces;
we show auditors proof).

- Chronological, filterable table of every `audit_log` entry:
  timestamp · decision · what the agent proposed · reviewer · verdict · snapshot.
- Filter by `event_type` and by decision.
- **Export button** → generates CSV (and PDF later) — the artifact a compliance
  officer hands an auditor. Even a client-side CSV dump is fine for MVP; the point
  is to *show* the loop closing. Log the export itself as an `exported` audit event.

---

## 9. Build phases (execute in order)

**Phase 0 — Plan & confirm.** Read this whole file. Produce a short written plan,
confirm the stack (Section 3) and repo shape, then proceed.

**Phase 1 — Scaffold (do this before any features).**
- Monorepo: `/web` (Vite/React/TS + Tailwind + shadcn/ui) and `/api`
  (Fastify/TS + Drizzle + Postgres).
- docker-compose for local Postgres (or a Railway dev DB).
- Deploy a hello-world end-to-end (web → api → db) and confirm the pipeline works
  BEFORE building features. Do not skip this.

**Phase 2 — Data layer + seed.**
- Schema migrations for all four tables. Enforce `audit_log` append-only
  (revoke UPDATE/DELETE on the app role, or a trigger).
- Seed script + decision generator (Section 6). Hand-authored context blobs.
- Verify: DB is full of believable decisions; `audit_log` has matching
  `decision_created` rows.

**Phase 3 — Review cockpit (the big one).**
- Two-pane layout, queue list, decision detail.
- Approve / reject / edit flow writing real `reviews` + `audit_log` rows.
- Keyboard shortcuts. Auto-advance. Autonomy-graduation visual.

**Phase 4 — Audit trail view + export.**
- Chronological filterable table.
- CSV export, logged as an `exported` event.

**Phase 5 — Demo polish.**
- Live-drip endpoint/interval.
- Empty states, loading states.
- **"Reset demo" button** that re-seeds (matters more than it sounds — nothing
  kills a live demo like a queue you already emptied).
- Rehearse the 30-second arc; fix anything slow or ugly.

---

## 10. Do NOT build (guardrails against scope creep)

- ❌ Real AI / LLM agent integration (v2 talking point, not MVP).
- ❌ Auth beyond a single hardcoded demo user.
- ❌ Multi-tenancy / orgs / teams.
- ❌ Settings pages.
- ❌ Websockets if polling every few seconds is good enough (it is).
- ❌ Mobile / responsive layout (desktop demo only).
- ❌ Real document storage / file uploads.
- ❌ Any ML for "confidence" or "risk" — these are seeded values.

Every one of these is a v2 talking point, not an MVP requirement. A partner is
more impressed by one screen that nails the core insight than ten half-built ones.

---

## 11. Design direction

Clean, dense, professional — this is a tool for someone reviewing 200 decisions a
day, not a marketing site. Tight typography, fast interactions, obvious risk
signals (the red/amber/green pill and the flagged-fact highlight are the most
important visual elements). Think Linear / Stripe dashboard density, not a
consumer app. Use shadcn/ui defaults and resist over-styling — speed and clarity
over flourish.

---

## 12. Definition of done

- [ ] Queue populates (and visibly drips) with believable, risk-sorted decisions.
- [ ] Opening a high-risk decision surfaces the risky fact in ~2 seconds.
- [ ] Approve / reject / edit work via keyboard and write real DB rows.
- [ ] Every action produces an append-only audit entry.
- [ ] Audit trail view is filterable and exports a CSV.
- [ ] "Reset demo" cleanly re-seeds for repeat runs.
- [ ] The 30-second arc (risky decision → one-keystroke reject → audit record)
      runs smoothly start to finish.
