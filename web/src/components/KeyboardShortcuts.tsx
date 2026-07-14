import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { key: "J", desc: "Next decision" },
  { key: "K", desc: "Previous decision" },
  { key: "A", desc: "Approve" },
  { key: "R", desc: "Reject" },
  { key: "E", desc: "Edit & approve" },
  { key: "?", desc: "Toggle this help" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      {/* Hint badge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm transition-opacity hover:text-foreground"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ?
          </kbd>
          <span>Shortcuts</span>
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-56 rounded-lg border border-border bg-background p-4 shadow-lg animate-fade-in">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              Keyboard Shortcuts
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{s.desc}</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
