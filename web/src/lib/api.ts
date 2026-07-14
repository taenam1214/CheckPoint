const API_BASE = "http://localhost:3000";

export interface Decision {
  id: string;
  agentId: string;
  agentName: string;
  agentWorkflow: string;
  autonomyThreshold: number;
  status: string;
  proposedAction: string;
  confidence: number;
  riskTier: "low" | "medium" | "high";
  context: {
    summary: string;
    facts: { label: string; value: string; flag?: string }[];
    policy_note: string;
  };
  similarCases: { ref: string; summary: string; resolved: string }[];
  createdAt: string;
  resolvedAt: string | null;
}

export async function fetchDecisions(status?: string): Promise<Decision[]> {
  const url = status
    ? `${API_BASE}/api/decisions?status=${status}`
    : `${API_BASE}/api/decisions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch decisions");
  return res.json();
}

export async function fetchDecision(id: string): Promise<Decision> {
  const res = await fetch(`${API_BASE}/api/decisions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch decision");
  return res.json();
}

export async function submitReview(
  decisionId: string,
  verdict: "approved" | "rejected" | "edited",
  note?: string,
) {
  const res = await fetch(`${API_BASE}/api/decisions/${decisionId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verdict, note }),
  });
  if (!res.ok) throw new Error("Failed to submit review");
  return res.json();
}

// ─── Audit ───────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  decisionId: string;
  eventType: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  proposedAction: string;
  agentName: string;
}

export async function fetchAuditLog(params?: {
  event_type?: string;
  decision_id?: string;
}): Promise<AuditEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.event_type) searchParams.set("event_type", params.event_type);
  if (params?.decision_id) searchParams.set("decision_id", params.decision_id);
  const qs = searchParams.toString();
  const url = `${API_BASE}/api/audit${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch audit log");
  return res.json();
}

export function getAuditExportUrl(): string {
  return `${API_BASE}/api/audit/export?format=csv`;
}

export async function fetchReviewedCount(): Promise<number> {
  const entries = await fetchAuditLog();
  return entries.filter(
    (e) =>
      e.eventType === "human_approved" ||
      e.eventType === "human_rejected" ||
      e.eventType === "human_edited",
  ).length;
}

// ─── Demo ────────────────────────────────────────────────────

export async function resetDemo(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/demo/reset`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset demo");
  return res.json();
}

export async function dripDecision(): Promise<{ dripped: string }> {
  const res = await fetch(`${API_BASE}/api/demo/drip`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to drip decision");
  return res.json();
}
