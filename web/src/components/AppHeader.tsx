import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetDemo } from "../lib/api";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface AppHeaderProps {
  currentPage: "review" | "audit";
  pendingCount?: number;
}

export function AppHeader({ currentPage, pendingCount }: AppHeaderProps) {
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-bold tracking-tight text-foreground">
          Checkpoint
        </h1>
        <nav className="flex items-center gap-1">
          <a
            href="/"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              currentPage === "review"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Review Queue
            {pendingCount !== undefined && currentPage === "review" && (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold">
                {pendingCount}
              </span>
            )}
          </a>
          <a
            href="/audit"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              currentPage === "audit"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Audit Trail
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="text-xs"
        >
          {resetMutation.isPending ? "Resetting..." : "Reset Demo"}
        </Button>
      </div>
    </header>
  );
}
