import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async (_request, reply) => {
    try {
      const result = await db.execute(sql`SELECT 1 AS ok`);
      return { status: "ok", db: result.length > 0 ? "connected" : "error" };
    } catch (err) {
      app.log.error(err);
      return reply.status(503).send({ status: "error", db: "disconnected" });
    }
  });
}
