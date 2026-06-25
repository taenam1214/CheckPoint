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
