-- Performance indexes for production query patterns

-- decisions: filtered by status (queue page), sorted by risk/confidence
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_agent_id ON decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_decisions_risk_tier ON decisions(risk_tier);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);

-- audit_log: filtered by event_type, joined by decision_id, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_audit_log_decision_id ON audit_log(decision_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- reviews: looked up by decision_id
CREATE INDEX IF NOT EXISTS idx_reviews_decision_id ON reviews(decision_id);
