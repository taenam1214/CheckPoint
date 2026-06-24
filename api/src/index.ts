import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes);

const port = parseInt(process.env.PORT || "3000", 10);

try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API server running on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
