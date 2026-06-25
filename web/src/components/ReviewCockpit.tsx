import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDecisions, submitReview } from "../lib/api";
import { QueueList } from "./QueueList";
import { DecisionDetail } from "./DecisionDetail";
import { AppHeader } from "./AppHeader";

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
    onSuccess: () => {
      // Auto-advance: select the next item (or previous if at end)
      const nextIndex = selectedIndex < decisions.length - 1
        ? selectedIndex + 1
        : Math.max(0, selectedIndex - 1);
      const nextId = decisions[nextIndex]?.id || null;

      queryClient.invalidateQueries({ queryKey: ["decisions"] });

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
          // We just pass through here; the DecisionDetail handles "e" for opening edit
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, decisions, handleAction]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader currentPage="review" pendingCount={decisions.length} />

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
