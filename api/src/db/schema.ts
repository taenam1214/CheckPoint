import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  workflow: text("workflow").notNull(),
  autonomyThreshold: real("autonomy_threshold").notNull().default(0.85),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const decisions = pgTable("decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "auto_approved"],
  })
    .notNull()
    .default("pending"),
  proposedAction: text("proposed_action").notNull(),
  confidence: real("confidence").notNull(),
  riskTier: text("risk_tier", { enum: ["low", "medium", "high"] }).notNull(),
  context: jsonb("context").notNull(),
  similarCases: jsonb("similar_cases").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id),
  reviewerId: text("reviewer_id").notNull().default("demo-user"),
  verdict: text("verdict", {
    enum: ["approved", "rejected", "edited"],
  }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id),
  eventType: text("event_type").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
