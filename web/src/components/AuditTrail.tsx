import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Download, FileSearch, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fetchAuditLog, getAuditExportUrl } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AppHeader } from "./AppHeader";

const EVENT_LABELS: Record<string, { label: string; className: string }> = {
  decision_created: { label: "Created", className: "bg-blue-100 text-blue-700 border-blue-200" },
  human_approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  human_rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  human_edited: { label: "Edited", className: "bg-purple-100 text-purple-700 border-purple-200" },
  auto_approved: { label: "Auto-approved", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  exported: { label: "Exported", className: "bg-gray-100 text-gray-700 border-gray-200" },
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
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState<string>("all");

  const filterValue = eventFilter === "all" ? "" : eventFilter;

  const { data: entries = [], isLoading, isError, error } = useQuery({
    queryKey: ["audit", filterValue],
    queryFn: () =>
      fetchAuditLog(filterValue ? { event_type: filterValue } : undefined),
  });

  function handleExport() {
    window.open(getAuditExportUrl(), "_blank");
    toast.success("Audit log exported", {
      description: "Export event logged to the audit trail",
    });
    // Refetch audit log to show the new "exported" entry
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        currentPage="audit"
        onResetSuccess={() => toast.success("Demo reset complete")}
      />

      {/* Filters & export */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Filter:
          </span>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="decision_created">Created</SelectItem>
              <SelectItem value="human_approved">Approved</SelectItem>
              <SelectItem value="human_rejected">Rejected</SelectItem>
              <SelectItem value="human_edited">Edited</SelectItem>
              <SelectItem value="exported">Exported</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs tabular-nums text-muted-foreground">
            {entries.length} entries
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Failed to load audit log</p>
              <p className="mt-0.5 text-xs">{error instanceof Error ? error.message : "Unknown error"}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["audit"] })}
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <FileSearch className="h-10 w-10 stroke-[1.5]" />
            <div className="text-center">
              <p className="text-sm font-medium">No audit entries found</p>
              <p className="mt-0.5 text-xs">Try adjusting your filter</p>
            </div>
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
                  className: "bg-gray-100 text-gray-700 border-gray-200",
                };
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border hover:bg-muted/30 animate-fade-in"
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-medium", eventInfo.className)}
                      >
                        {eventInfo.label}
                      </Badge>
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
