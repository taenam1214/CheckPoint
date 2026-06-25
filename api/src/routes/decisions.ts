import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { eq, asc, desc, sql } from "drizzle-orm";

const { decisions, agents, reviews, auditLog } = schema;

export async function decisionRoutes(app: FastifyInstance) {
  // GET /api/decisions — list decisions, optionally filtered by status
  app.get("/api/decisions", async (request) => {
    const { status } = request.query as { status?: string };

    const rows = await db
      .select({
        id: decisions.id,
        agentId: decisions.agentId,
        agentName: agents.name,
        agentWorkflow: agents.workflow,
        autonomyThreshold: agents.autonomyThreshold,
        status: decisions.status,
        proposedAction: decisions.proposedAction,
        confidence: decisions.confidence,
        riskTier: decisions.riskTier,
        context: decisions.context,
        similarCases: decisions.similarCases,
        createdAt: decisions.createdAt,
        resolvedAt: decisions.resolvedAt,
      })
      .from(decisions)
      .innerJoin(agents, eq(decisions.agentId, agents.id))
      .where(status ? eq(decisions.status, status as any) : undefined)
      .orderBy(
        // high > medium > low
        sql`CASE ${decisions.riskTier} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END`,
        asc(decisions.confidence),
        desc(decisions.createdAt),
      );

    return rows;
  });

  // GET /api/decisions/:id — single decision with full context
  app.get("/api/decisions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const rows = await db
      .select({
        id: decisions.id,
        agentId: decisions.agentId,
        agentName: agents.name,
        agentWorkflow: agents.workflow,
        autonomyThreshold: agents.autonomyThreshold,
        status: decisions.status,
        proposedAction: decisions.proposedAction,
        confidence: decisions.confidence,
        riskTier: decisions.riskTier,
        context: decisions.context,
        similarCases: decisions.similarCases,
        createdAt: decisions.createdAt,
        resolvedAt: decisions.resolvedAt,
      })
      .from(decisions)
      .innerJoin(agents, eq(decisions.agentId, agents.id))
      .where(eq(decisions.id, id));

    if (rows.length === 0) {
      return reply.status(404).send({ error: "Decision not found" });
    }

    return rows[0];
  });

  // POST /api/decisions/:id/review — submit a review verdict
  app.post("/api/decisions/:id/review", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { verdict, note } = request.body as {
      verdict: "approved" | "rejected" | "edited";
      note?: string;
    };

    if (!verdict || !["approved", "rejected", "edited"].includes(verdict)) {
      return reply
        .status(400)
        .send({ error: "verdict must be approved, rejected, or edited" });
    }

    // Check decision exists and is pending
    const [decision] = await db
      .select()
      .from(decisions)
      .where(eq(decisions.id, id));

    if (!decision) {
      return reply.status(404).send({ error: "Decision not found" });
    }
    if (decision.status !== "pending") {
      return reply
        .status(409)
        .send({ error: "Decision already resolved" });
    }

    const now = new Date();

    // Write review row
    const [review] = await db
      .insert(reviews)
      .values({
        decisionId: id,
        reviewerId: "demo-user",
        verdict,
        note: note || null,
        createdAt: now,
      })
      .returning();

    // Update decision status
    const newStatus = verdict === "edited" ? "approved" : verdict;
    const [updated] = await db
      .update(decisions)
      .set({ status: newStatus, resolvedAt: now })
      .where(eq(decisions.id, id))
      .returning();

    // Insert audit_log entry
    const eventType =
      verdict === "approved"
        ? "human_approved"
        : verdict === "rejected"
          ? "human_rejected"
          : "human_edited";

    await db.insert(auditLog).values({
      decisionId: id,
      eventType,
      snapshot: {
        decision_id: id,
        proposed_action: decision.proposedAction,
        confidence: decision.confidence,
        risk_tier: decision.riskTier,
        reviewer: "demo-user",
        verdict,
        note: note || null,
        resolved_at: now.toISOString(),
      },
      createdAt: now,
    });

    return { decision: updated, review };
  });
}
