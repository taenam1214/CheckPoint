import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import { ShieldCheck, ListChecks, ScrollText, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { resetDemo } from "../lib/api";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { cn } from "../lib/utils";

interface AppHeaderProps {
  currentPage: "review" | "audit";
  pendingCount?: number;
  reviewedCount?: number;
  onResetSuccess?: () => void;
}

export function AppHeader({ currentPage, pendingCount, reviewedCount, onResetSuccess }: AppHeaderProps) {
  const queryClient = useQueryClient();
  const location = useLocation();

  const resetMutation = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => {
      queryClient.invalidateQueries();
      onResetSuccess?.();
    },
  });

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-bold tracking-tight">Checkpoint</span>
        </Link>

        <Separator orientation="vertical" className="!h-5" />

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          <Link
            to="/"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              location.pathname === "/"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Review Queue
            {pendingCount !== undefined && pendingCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/10 px-1 text-[10px] font-semibold tabular-nums">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            to="/audit"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              location.pathname === "/audit"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Audit Trail
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {reviewedCount !== undefined && reviewedCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="tabular-nums font-medium">{reviewedCount}</span> reviewed
          </span>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="text-xs"
        >
          {resetMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {resetMutation.isPending ? "Resetting..." : "Reset Demo"}
        </Button>

        <Separator orientation="vertical" className="!h-5" />

        {/* Demo user avatar */}
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-primary-foreground">
          DU
        </div>
      </div>
    </header>
  );
}
