import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Inbox, Search } from "lucide-react";
import { cn } from "../lib/utils";
import type { Decision } from "../lib/api";

const RISK_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
} as const;

const RISK_DOT = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
} as const;

const RISK_BORDER = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-emerald-500",
} as const;

type RiskFilter = "all" | "high" | "medium" | "low";

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000,
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface QueueListProps {
  decisions: Decision[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function QueueList({ decisions, selectedId, onSelect }: QueueListProps) {
  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  // Force re-render every 15s so relative timestamps stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    let result = decisions;
    if (riskFilter !== "all") {
      result = result.filter((d) => d.riskTier === riskFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (d) =>
          d.proposedAction.toLowerCase().includes(q) ||
          d.agentName.toLowerCase().includes(q) ||
          d.context.summary.toLowerCase().includes(q),
      );
    }
    return result;
  }, [decisions, riskFilter, searchText]);

  if (decisions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <Inbox className="h-10 w-10 stroke-[1.5]" />
        <div className="text-center">
          <p className="text-sm font-medium">All caught up</p>
          <p className="mt-0.5 text-xs">No pending decisions to review</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search + filter bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-3 py-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search decisions..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "high", "medium", "low"] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setRiskFilter(tier)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                riskFilter === tier
                  ? tier === "all"
                    ? "bg-foreground text-background"
                    : tier === "high"
                      ? "bg-red-100 text-red-700"
                      : tier === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tier === "all" ? "All" : tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {filtered.length} of {decisions.length}
          </span>
        </div>
      </div>

      {/* Queue items */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Search className="h-6 w-6" />
            <p className="text-xs">No matching decisions</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((d) => (
              <motion.button
                key={d.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, x: -60, height: 0 }}
                transition={{
                  layout: { type: "spring", stiffness: 500, damping: 40 },
                  opacity: { duration: 0.2 },
                  height: { duration: 0.25 },
                  x: { duration: 0.2 },
                }}
                onClick={() => onSelect(d.id)}
                className={cn(
                  "flex flex-col gap-1 border-b border-l-3 border-border px-4 py-3 text-left transition-colors",
                  RISK_BORDER[d.riskTier],
                  selectedId === d.id
                    ? "bg-muted ring-1 ring-inset ring-border shadow-sm"
                    : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">
                    {d.proposedAction}
                  </p>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                      RISK_COLORS[d.riskTier],
                    )}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", RISK_DOT[d.riskTier])}
                    />
                    {d.riskTier}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {d.agentName}
                  </span>
                  <span className="text-border">·</span>
                  {/* Confidence bar */}
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-muted">
                      <motion.div
                        className={cn(
                          "h-1.5 rounded-full",
                          d.confidence >= 0.8
                            ? "bg-emerald-500"
                            : d.confidence >= 0.6
                              ? "bg-amber-500"
                              : "bg-red-500",
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${d.confidence * 100}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                      />
                    </div>
                    <span>{Math.round(d.confidence * 100)}%</span>
                  </div>
                  <span className="text-border">·</span>
                  <span>{timeAgo(d.createdAt)}</span>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
