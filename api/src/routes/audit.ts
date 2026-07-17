import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod/v4";
import { db, schema } from "../db/index.js";
import { eq, desc, and } from "drizzle-orm";

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
});

export async function auditRoutes(app: FastifyInstance) {
  // GET /api/audit — chronological audit log, filterable
  app.get("/api/audit", async (request, reply) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    const { event_type, decision_id } = parsed.data;

    try {
      const conditions = [];
      if (event_type) conditions.push(eq(auditLog.eventType, event_type));
      if (decision_id) conditions.push(eq(auditLog.decisionId, decision_id));

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
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.createdAt));

      return rows;
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch audit log" });
    }
  });

  // GET /api/audit/export?format=csv — CSV export
  app.get("/api/audit/export", async (_request, reply: FastifyReply) => {
    try {
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
