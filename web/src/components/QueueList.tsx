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
  if (decisions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No pending decisions
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {decisions.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className={cn(
            "flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50",
            selectedId === d.id && "bg-muted",
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

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{d.agentName}</span>
            <span className="text-border">·</span>
            {/* Confidence bar */}
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 rounded-full bg-muted">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    d.confidence >= 0.8
                      ? "bg-emerald-500"
                      : d.confidence >= 0.6
                        ? "bg-amber-500"
                        : "bg-red-500",
                  )}
                  style={{ width: `${d.confidence * 100}%` }}
                />
              </div>
              <span>{Math.round(d.confidence * 100)}%</span>
            </div>
            <span className="text-border">·</span>
            <span>{timeAgo(d.createdAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
