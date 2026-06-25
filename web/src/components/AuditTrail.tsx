import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog, getAuditExportUrl } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  decision_created: { label: "Created", color: "bg-blue-100 text-blue-700" },
  human_approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
  human_rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  human_edited: { label: "Edited", color: "bg-purple-100 text-purple-700" },
  auto_approved: { label: "Auto-approved", color: "bg-cyan-100 text-cyan-700" },
  exported: { label: "Exported", color: "bg-gray-100 text-gray-700" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditTrail() {
  const [eventFilter, setEventFilter] = useState<string>("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit", eventFilter],
    queryFn: () =>
      fetchAuditLog(eventFilter ? { event_type: eventFilter } : undefined),
  });

  function handleExport() {
    window.open(getAuditExportUrl(), "_blank");
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">Checkpoint</h1>
          <span className="text-xs text-muted-foreground">Audit Trail</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Review Queue
          </a>
        </div>
      </header>

      {/* Filters & export */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filter:
          </span>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All events</option>
            <option value="decision_created">Created</option>
            <option value="human_approved">Approved</option>
            <option value="human_rejected">Rejected</option>
            <option value="human_edited">Edited</option>
            <option value="exported">Exported</option>
          </select>
          <span className="text-xs text-muted-foreground">
            {entries.length} entries
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading audit log...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No audit entries found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-muted/50">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Agent</th>
                <th className="px-4 py-2">Proposed Action</th>
                <th className="px-4 py-2">Reviewer</th>
                <th className="px-4 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const snap = entry.snapshot as Record<string, unknown>;
                const eventInfo = EVENT_LABELS[entry.eventType] || {
                  label: entry.eventType,
                  color: "bg-gray-100 text-gray-700",
                };
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          eventInfo.color,
                        )}
                      >
                        {eventInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground">
                      {entry.agentName}
                    </td>
                    <td className="max-w-[300px] truncate px-4 py-2 text-xs text-foreground">
                      {entry.proposedAction}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {(snap.reviewer as string) || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {snap.verdict ? (
                        <span
                          className={cn(
                            "font-medium",
                            snap.verdict === "approved"
                              ? "text-emerald-600"
                              : snap.verdict === "rejected"
                                ? "text-red-600"
                                : "text-purple-600",
                          )}
                        >
                          {snap.verdict as string}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
