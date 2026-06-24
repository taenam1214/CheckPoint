import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    const result = await db.execute(sql`SELECT 1 AS ok`);
    return { status: "ok", db: result.length > 0 ? "connected" : "error" };
  });
}
