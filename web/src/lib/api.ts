const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ─── Types ──────────────────────────────────────────────────

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

export interface AuditEntry {
  id: string;
  decisionId: string;
  eventType: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  proposedAction: string;
  agentName: string;
}

// ─── Error class ────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Fetch helper ───────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        (body as { error?: string }).error || `Request failed (${res.status})`,
      );
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out");
    }
    throw new ApiError(0, "Network error — check your connection");
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Decisions ──────────────────────────────────────────────

export async function fetchDecisions(status?: string): Promise<Decision[]> {
  const url = status
    ? `${API_BASE}/api/decisions?status=${status}`
    : `${API_BASE}/api/decisions`;
  return apiFetch<Decision[]>(url);
}

export async function fetchDecision(id: string): Promise<Decision> {
  return apiFetch<Decision>(`${API_BASE}/api/decisions/${id}`);
}

export async function submitReview(
  decisionId: string,
  verdict: "approved" | "rejected" | "edited",
  note?: string,
) {
  return apiFetch(`${API_BASE}/api/decisions/${decisionId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verdict, note }),
  });
}

// ─── Audit ───────────────────────────────────────────────────

export async function fetchAuditLog(params?: {
  event_type?: string;
  decision_id?: string;
}): Promise<AuditEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.event_type) searchParams.set("event_type", params.event_type);
  if (params?.decision_id) searchParams.set("decision_id", params.decision_id);
  const qs = searchParams.toString();
  const url = `${API_BASE}/api/audit${qs ? `?${qs}` : ""}`;
  return apiFetch<AuditEntry[]>(url);
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
  return apiFetch<{ status: string }>(`${API_BASE}/api/demo/reset`, {
    method: "POST",
  });
}

export async function dripDecision(): Promise<{ dripped: string }> {
  return apiFetch<{ dripped: string }>(`${API_BASE}/api/demo/drip`, {
    method: "POST",
  });
}
