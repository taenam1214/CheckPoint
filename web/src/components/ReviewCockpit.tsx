import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchDecisions, submitReview, dripDecision } from "../lib/api";
import { QueueList } from "./QueueList";
import { DecisionDetail } from "./DecisionDetail";
import { AppHeader } from "./AppHeader";
import { QueueSkeleton } from "./QueueSkeleton";
import { DetailSkeleton } from "./DetailSkeleton";

export function ReviewCockpit() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ["decisions", "pending"],
    queryFn: () => fetchDecisions("pending"),
  });

  // Auto-select first when selection is invalid
  useEffect(() => {
    if (decisions.length > 0 && !decisions.find((d) => d.id === selectedId)) {
      setSelectedId(decisions[0].id);
    }
  }, [decisions, selectedId]);

  const selectedDecision = decisions.find((d) => d.id === selectedId) || null;
  const selectedIndex = decisions.findIndex((d) => d.id === selectedId);

  const reviewMutation = useMutation({
    mutationFn: ({
      decisionId,
      verdict,
      note,
    }: {
      decisionId: string;
      verdict: "approved" | "rejected" | "edited";
      note?: string;
    }) => submitReview(decisionId, verdict, note),
    onSuccess: (_data, variables) => {
      // Auto-advance: select the next item (or previous if at end)
      const nextIndex = selectedIndex < decisions.length - 1
        ? selectedIndex + 1
        : Math.max(0, selectedIndex - 1);
      const nextId = decisions[nextIndex]?.id || null;

      queryClient.invalidateQueries({ queryKey: ["decisions"] });

      // Fire toast
      const verdictLabels = {
        approved: "Decision approved",
        rejected: "Decision rejected",
        edited: "Decision edited & approved",
      };
      toast.success(verdictLabels[variables.verdict]);

      // Set next selection after refetch — use a small delay to let data refresh
      setTimeout(() => setSelectedId(nextId), 100);
    },
  });

  const handleAction = useCallback(
    (verdict: "approved" | "rejected" | "edited", note?: string) => {
      if (!selectedId) return;
      reviewMutation.mutate({ decisionId: selectedId, verdict, note });
    },
    [selectedId, reviewMutation],
  );

  // Auto-drip: add a new pending decision every 8 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await dripDecision();
        queryClient.invalidateQueries({ queryKey: ["decisions"] });
      } catch {
        // Silently ignore — drip pool may be exhausted
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "j": {
          // Move down
          const next = Math.min(selectedIndex + 1, decisions.length - 1);
          setSelectedId(decisions[next]?.id || null);
          break;
        }
        case "k": {
          // Move up
          const prev = Math.max(selectedIndex - 1, 0);
          setSelectedId(decisions[prev]?.id || null);
          break;
        }
        case "a": {
          e.preventDefault();
          handleAction("approved");
          break;
        }
        case "r": {
          e.preventDefault();
          handleAction("rejected");
          break;
        }
        case "e": {
          // Only trigger edit mode — actual submit handled by component
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, decisions, handleAction]);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader
          currentPage="review"
          onResetSuccess={() => toast.success("Demo reset complete")}
        />
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-border bg-background">
            <QueueSkeleton />
          </aside>
          <main className="flex-1 overflow-hidden bg-background">
            <DetailSkeleton />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        currentPage="review"
        pendingCount={decisions.length}
        onResetSuccess={() => toast.success("Demo reset complete")}
      />

      {/* Two-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — queue */}
        <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-border bg-background">
          <QueueList
            decisions={decisions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        {/* Right pane — detail */}
        <main className="flex-1 overflow-hidden bg-background">
          {selectedDecision ? (
            <DecisionDetail
              decision={selectedDecision}
              onAction={handleAction}
              isSubmitting={reviewMutation.isPending}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a decision to review
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
