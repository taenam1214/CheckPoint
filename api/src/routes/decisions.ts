import type { FastifyInstance } from "fastify";
import { z } from "zod/v4";
import { db, schema } from "../db/index.js";
import { eq, asc, desc, sql } from "drizzle-orm";

const { decisions, agents, reviews, auditLog } = schema;

// ─── Validation schemas ─────────────────────────────────────
const statusQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "auto_approved"]).optional(),
});

const reviewBodySchema = z.object({
  verdict: z.enum(["approved", "rejected", "edited"]),
  note: z.string().max(2000).optional(),
});

const uuidParamSchema = z.object({
  id: z.uuid(),
});

// ─── Routes ─────────────────────────────────────────────────
export async function decisionRoutes(app: FastifyInstance) {
  // GET /api/decisions — list decisions, optionally filtered by status
  app.get("/api/decisions", async (request, reply) => {
    const parsed = statusQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    const { status } = parsed.data;

    try {
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
        .where(status ? eq(decisions.status, status) : undefined)
        .orderBy(
          sql`CASE ${decisions.riskTier} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END`,
          asc(decisions.confidence),
          desc(decisions.createdAt),
        );

      return rows;
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch decisions" });
    }
  });

  // GET /api/decisions/:id — single decision with full context
  app.get("/api/decisions/:id", async (request, reply) => {
    const paramsParsed = uuidParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid decision ID format" });
    }

    const { id } = paramsParsed.data;

    try {
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
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch decision" });
    }
  });

  // POST /api/decisions/:id/review — submit a review verdict
  app.post("/api/decisions/:id/review", async (request, reply) => {
    const paramsParsed = uuidParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid decision ID format" });
    }

    const bodyParsed = reviewBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: bodyParsed.error.issues,
      });
    }

    const { id } = paramsParsed.data;
    const { verdict, note } = bodyParsed.data;

    try {
      // Check decision exists and is pending
      const [decision] = await db
        .select()
        .from(decisions)
        .where(eq(decisions.id, id));

      if (!decision) {
        return reply.status(404).send({ error: "Decision not found" });
      }
      if (decision.status !== "pending") {
        return reply.status(409).send({ error: "Decision already resolved" });
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
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to submit review" });
    }
  });
}
