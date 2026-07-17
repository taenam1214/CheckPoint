import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod/v4";
import { db, schema } from "../db/index.js";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";

const { auditLog, decisions, agents } = schema;

const VALID_EVENT_TYPES = [
  "decision_created",
  "human_approved",
  "human_rejected",
  "human_edited",
  "auto_approved",
  "exported",
] as const;

const auditQuerySchema = z.object({
  event_type: z.enum(VALID_EVENT_TYPES).optional(),
  decision_id: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const exportQuerySchema = z.object({
  event_type: z.enum(VALID_EVENT_TYPES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function buildConditions(params: { event_type?: string; decision_id?: string; from?: string; to?: string }) {
  const conditions = [];
  if (params.event_type) conditions.push(eq(auditLog.eventType, params.event_type));
  if (params.decision_id) conditions.push(eq(auditLog.decisionId, params.decision_id));
  if (params.from) conditions.push(gte(auditLog.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(auditLog.createdAt, new Date(params.to)));
  return conditions;
}

export async function auditRoutes(app: FastifyInstance) {
  // GET /api/audit — paginated, filterable audit log
  app.get("/api/audit", async (request, reply) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    const { event_type, decision_id, limit: pageLimit, offset: pageOffset, from, to } = parsed.data;

    try {
      const conditions = buildConditions({ event_type, decision_id, from, to });
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult, rows] = await Promise.all([
        db
          .select({ count: count() })
          .from(auditLog)
          .innerJoin(decisions, eq(auditLog.decisionId, decisions.id))
          .innerJoin(agents, eq(decisions.agentId, agents.id))
          .where(whereClause),
        db
          .select({
            id: auditLog.id,
            decisionId: auditLog.decisionId,
            eventType: auditLog.eventType,
            snapshot: auditLog.snapshot,
            createdAt: auditLog.createdAt,
            proposedAction: decisions.proposedAction,
            agentName: agents.name,
          })
          .from(auditLog)
          .innerJoin(decisions, eq(auditLog.decisionId, decisions.id))
          .innerJoin(agents, eq(decisions.agentId, agents.id))
          .where(whereClause)
          .orderBy(desc(auditLog.createdAt))
          .limit(pageLimit)
          .offset(pageOffset),
      ]);

      return {
        data: rows,
        total: totalResult[0]?.count ?? 0,
        limit: pageLimit,
        offset: pageOffset,
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch audit log" });
    }
  });

  // GET /api/audit/export?format=csv — filtered CSV export
  app.get("/api/audit/export", async (request, reply: FastifyReply) => {
    const parsed = exportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    const { event_type, from, to } = parsed.data;

    try {
      const conditions = buildConditions({ event_type, from, to });
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: auditLog.id,
          decisionId: auditLog.decisionId,
          eventType: auditLog.eventType,
          snapshot: auditLog.snapshot,
          createdAt: auditLog.createdAt,
          proposedAction: decisions.proposedAction,
          agentName: agents.name,
        })
        .from(auditLog)
        .innerJoin(decisions, eq(auditLog.decisionId, decisions.id))
        .innerJoin(agents, eq(decisions.agentId, agents.id))
        .where(whereClause)
        .orderBy(desc(auditLog.createdAt));

      // Log the export as an audit event
      if (rows.length > 0) {
        await db.insert(auditLog).values({
          decisionId: rows[0].decisionId,
          eventType: "exported",
          snapshot: {
            export_format: "csv",
            row_count: rows.length,
            exported_at: new Date().toISOString(),
            exported_by: "demo-user",
            filters: { event_type: event_type || null, from: from || null, to: to || null },
          },
        });
      }

      // Build CSV
      const header = "id,decision_id,event_type,agent,proposed_action,reviewer,verdict,timestamp";
      const csvRows = rows.map((r) => {
        const snap = (r.snapshot ?? {}) as Record<string, unknown>;
        const reviewer = String(snap.reviewer ?? "");
        const verdict = String(snap.verdict ?? "");
        const action = escapeCsv(r.proposedAction ?? "");
        const agent = escapeCsv(r.agentName ?? "");
        return `${r.id},${r.decisionId},${r.eventType},${agent},${action},${reviewer},${verdict},${r.createdAt.toISOString()}`;
      });

      const csv = [header, ...csvRows].join("\n");

      reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="checkpoint-audit-${new Date().toISOString().slice(0, 10)}.csv"`)
        .send(csv);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to export audit log" });
    }
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
