import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Filter, Download, FileSearch, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { fetchAuditLog, getAuditExportUrl } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { PageTransition } from "./PageTransition";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AppHeader } from "./AppHeader";

const PAGE_SIZE = 50;

const EVENT_LABELS: Record<string, { label: string; className: string }> = {
  decision_created: { label: "Created", className: "bg-blue-100 text-blue-700 border-blue-200" },
  human_approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  human_rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  human_edited: { label: "Edited", className: "bg-purple-100 text-purple-700 border-purple-200" },
  auto_approved: { label: "Auto-approved", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  exported: { label: "Exported", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

function formatSnapshotKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

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
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filterEventType = eventFilter === "all" ? undefined : eventFilter;
  const fromISO = dateFrom ? new Date(dateFrom + "T00:00:00Z").toISOString() : undefined;
  const toISO = dateTo ? new Date(dateTo + "T23:59:59Z").toISOString() : undefined;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["audit", filterEventType, page, fromISO, toISO],
    queryFn: () =>
      fetchAuditLog({
        event_type: filterEventType,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        from: fromISO,
        to: toISO,
      }),
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  function handleExport() {
    window.open(getAuditExportUrl({ event_type: filterEventType, from: fromISO, to: toISO }), "_blank");
    toast.success("Audit log exported", {
      description: "Export event logged to the audit trail",
    });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  }

  function handleFilterChange(value: string) {
    setEventFilter(value);
    setPage(0);
  }

  return (
    <PageTransition className="flex h-screen flex-col">
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
          <Select value={eventFilter} onValueChange={handleFilterChange}>
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
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            placeholder="To"
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            {total} entries
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
                <th className="w-8 px-2 py-2"></th>
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Agent</th>
                <th className="px-4 py-2">Proposed Action</th>
                <th className="px-4 py-2">Reviewer</th>
                <th className="px-4 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const snap = entry.snapshot as Record<string, unknown>;
                const eventInfo = EVENT_LABELS[entry.eventType] || {
                  label: entry.eventType,
                  className: "bg-gray-100 text-gray-700 border-gray-200",
                };
                const isExpanded = expandedId === entry.id;
                return (
                  <>
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                    className={cn(
                      "border-b border-border cursor-pointer hover:bg-muted/30",
                      isExpanded && "bg-muted/20",
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <td className="px-2 py-2">
                      <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </motion.div>
                    </td>
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
                  </motion.tr>
                  <AnimatePresence>
                  {isExpanded && (
                    <motion.tr
                      key={`${entry.id}-detail`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-b border-border bg-muted/10"
                    >
                      <td colSpan={7} className="px-10 py-3">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                          {Object.entries(snap).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="font-medium text-muted-foreground whitespace-nowrap">
                                {formatSnapshotKey(key)}:
                              </span>
                              <span className="text-foreground truncate">
                                {formatSnapshotValue(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  )}
                  </AnimatePresence>
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">
            Showing {showingFrom}–{showingTo} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs tabular-nums text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="icon-xs"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
