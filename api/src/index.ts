import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { client } from "./db/index.js";
import { healthRoutes } from "./routes/health.js";
import { decisionRoutes } from "./routes/decisions.js";
import { auditRoutes } from "./routes/audit.js";
import { demoRoutes } from "./routes/demo.js";

const app = Fastify({
  logger: true,
  bodyLimit: 1_048_576, // 1 MB
});

// CORS — restrict to known origin in production
await app.register(cors, {
  origin: env.NODE_ENV === "production"
    ? env.CORS_ORIGIN.split(",")
    : true,
});

// Routes
await app.register(healthRoutes);
await app.register(decisionRoutes);
await app.register(auditRoutes);
await app.register(demoRoutes);

// Global error handler
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.status(statusCode).send({
    error: statusCode >= 500 ? "Internal server error" : message,
    statusCode,
  });
});

// Start server
const port = parseInt(env.PORT, 10);

try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API server running on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully`);
  await app.close();
  await client.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
