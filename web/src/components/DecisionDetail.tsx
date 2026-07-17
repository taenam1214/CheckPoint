import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, BookOpen, History, Check, X, Pencil, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { Decision } from "../lib/api";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const REJECTION_REASONS = [
  { value: "policy_violation", label: "Policy Violation" },
  { value: "insufficient_docs", label: "Insufficient Documentation" },
  { value: "fraud_risk", label: "Fraud Risk" },
  { value: "exceeds_authority", label: "Exceeds Authority" },
  { value: "data_mismatch", label: "Data Mismatch" },
  { value: "other", label: "Other" },
] as const;

const FLAG_STYLES: Record<string, string> = {
  stale: "bg-red-50 border-red-200 text-red-800",
  borderline: "bg-amber-50 border-amber-200 text-amber-800",
  high_ltv: "bg-red-50 border-red-200 text-red-800",
  exceeds_guideline: "bg-red-50 border-red-200 text-red-800",
  subprime: "bg-red-50 border-red-200 text-red-800",
  recent_bankruptcy: "bg-red-50 border-red-200 text-red-800",
  above_avg: "bg-amber-50 border-amber-200 text-amber-800",
  high_variance: "bg-red-50 border-red-200 text-red-800",
  new_policy: "bg-amber-50 border-amber-200 text-amber-800",
  frequent_claimant: "bg-amber-50 border-amber-200 text-amber-800",
  amount_spike: "bg-red-50 border-red-200 text-red-800",
  new_payee: "bg-red-50 border-red-200 text-red-800",
  structuring_pattern: "bg-red-50 border-red-200 text-red-800",
  high_risk_jurisdiction: "bg-red-50 border-red-200 text-red-800",
  negative_cashflow: "bg-red-50 border-red-200 text-red-800",
  employment_gap: "bg-amber-50 border-amber-200 text-amber-800",
  multiple_inquiries: "bg-amber-50 border-amber-200 text-amber-800",
  underwater: "bg-amber-50 border-amber-200 text-amber-800",
  variable_income: "bg-amber-50 border-amber-200 text-amber-800",
  first_international: "bg-amber-50 border-amber-200 text-amber-800",
  name_mismatch: "bg-amber-50 border-amber-200 text-amber-800",
  young_business: "bg-amber-50 border-amber-200 text-amber-800",
  high_utilization: "bg-amber-50 border-amber-200 text-amber-800",
  undeclared_asset: "bg-amber-50 border-amber-200 text-amber-800",
  after_hours: "bg-amber-50 border-amber-200 text-amber-800",
  price_discrepancy: "bg-amber-50 border-amber-200 text-amber-800",
  ofac_advisory: "bg-amber-50 border-amber-200 text-amber-800",
  aging_roof: "bg-amber-50 border-amber-200 text-amber-800",
};

const FLAG_LABELS: Record<string, string> = {
  stale: "STALE",
  borderline: "BORDERLINE",
  high_ltv: "HIGH LTV",
  exceeds_guideline: "EXCEEDS GUIDELINE",
  subprime: "SUBPRIME",
  recent_bankruptcy: "RECENT BK",
  above_avg: "ABOVE AVG",
  high_variance: "HIGH VARIANCE",
  new_policy: "NEW POLICY",
  frequent_claimant: "FREQUENT",
  amount_spike: "AMOUNT SPIKE",
  new_payee: "NEW PAYEE",
  structuring_pattern: "STRUCTURING",
  high_risk_jurisdiction: "HIGH-RISK JURISDICTION",
  negative_cashflow: "NEGATIVE CF",
  employment_gap: "GAP",
  multiple_inquiries: "MULTIPLE INQUIRIES",
  underwater: "UNDERWATER",
  variable_income: "VARIABLE",
  first_international: "FIRST INTL",
  name_mismatch: "MISMATCH",
  young_business: "YOUNG BIZ",
  high_utilization: "HIGH UTIL",
  undeclared_asset: "UNDECLARED",
  after_hours: "AFTER HOURS",
  price_discrepancy: "PRICE GAP",
  ofac_advisory: "OFAC ADVISORY",
  aging_roof: "AGING",
};

const RISK_COLORS = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-emerald-600",
} as const;

const RISK_TOP_BORDER = {
  high: "border-t-3 border-t-red-500",
  medium: "border-t-3 border-t-amber-500",
  low: "border-t-3 border-t-emerald-500",
} as const;

const RISK_BG = {
  high: "bg-risk-high-bg",
  medium: "bg-risk-medium-bg",
  low: "bg-background",
} as const;

interface DecisionDetailProps {
  decision: Decision;
  onAction: (verdict: "approved" | "rejected" | "edited", note?: string, reason?: string) => void;
  isSubmitting: boolean;
  rejectDialogOpen: boolean;
  onRejectDialogChange: (open: boolean) => void;
}

export function DecisionDetail({
  decision,
  onAction,
  isSubmitting,
  rejectDialogOpen,
  onRejectDialogChange,
}: DecisionDetailProps) {
  const [editMode, setEditMode] = useState(false);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const wouldAutoApprove = decision.confidence > decision.autonomyThreshold;

  function handleEdit() {
    if (editMode) {
      onAction("edited", note);
      setEditMode(false);
      setNote("");
    } else {
      setEditMode(true);
    }
  }

  function handleCancel() {
    setEditMode(false);
    setNote("");
  }

  return (
    <AnimatePresence mode="wait">
    <motion.div
      key={decision.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("flex h-full flex-col overflow-y-auto", RISK_BG[decision.riskTier])}
    >
      {/* Header with risk-colored top border */}
      <div className={cn("border-b border-border px-6 py-4", RISK_TOP_BORDER[decision.riskTier])}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold leading-snug text-foreground">
            {decision.proposedAction}
          </h2>
          <span
            className={cn(
              "shrink-0 text-sm font-semibold uppercase",
              RISK_COLORS[decision.riskTier],
            )}
          >
            {decision.riskTier} risk
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {decision.context.summary}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{decision.agentName}</span>
          <span className="text-border">·</span>
          <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
          <span className="text-border">·</span>
          <span className="select-all font-mono">{decision.id.slice(0, 8)}</span>
          <span className="text-border">·</span>
          <span>{new Date(decision.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        {/* Autonomy-graduation touch */}
        {wouldAutoApprove && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Would auto-approve at current threshold ({Math.round(decision.autonomyThreshold * 100)}%)
            — shown for spot-check.
          </div>
        )}
      </div>

      {/* Context facts */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Key Facts
        </h3>
        <div className="space-y-2">
          {decision.context.facts.map((fact, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                fact.flag
                  ? FLAG_STYLES[fact.flag] || "bg-amber-50 border-amber-200 text-amber-800"
                  : "border-border bg-background text-foreground",
              )}
            >
              <span className="text-muted-foreground">{fact.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{fact.value}</span>
                {fact.flag && (
                  <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    {FLAG_LABELS[fact.flag] || fact.flag}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Policy note */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Policy
        </h3>
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {decision.context.policy_note}
        </div>
      </div>

      {/* Similar cases */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Similar Cases
        </h3>
        <div className="space-y-1.5">
          {decision.similarCases.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {sc.ref}
                </span>
                <span className="text-foreground">{sc.summary}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  sc.resolved === "approved"
                    ? "text-emerald-600"
                    : sc.resolved === "rejected"
                      ? "text-red-600"
                      : "text-muted-foreground",
                )}
              >
                {sc.resolved}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit sheet */}
      <AnimatePresence>
      {editMode && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden border-b border-border bg-muted/30"
        >
        <div className="px-6 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Edit & Approve
          </h3>
          <textarea
            value={note}
            onChange={(e) => {
              if (e.target.value.length <= 2000) setNote(e.target.value);
            }}
            placeholder="Add a note or adjustment reason..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            maxLength={2000}
            autoFocus
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleEdit}
                disabled={isSubmitting || !note.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Confirm Edit & Approve
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
            <span className={cn(
              "text-[11px] tabular-nums",
              note.length > 1800 ? "text-red-500" : "text-muted-foreground",
            )}>
              {note.length}/2000
            </span>
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="mt-auto border-t border-border bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => onAction("approved")}
            disabled={isSubmitting || editMode}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve
            <kbd className="ml-1 rounded bg-emerald-700/50 px-1.5 py-0.5 text-[10px] font-mono">
              A
            </kbd>
          </Button>
          <Button
            onClick={() => onRejectDialogChange(true)}
            disabled={isSubmitting || editMode}
            variant="destructive"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Reject
            <kbd className="ml-1 rounded bg-red-700/50 px-1.5 py-0.5 text-[10px] font-mono text-white">
              R
            </kbd>
          </Button>
          <Button
            onClick={handleEdit}
            disabled={isSubmitting}
            variant="outline"
          >
            <Pencil className="h-4 w-4" />
            {editMode ? "Submit Edit" : "Edit & Approve"}
            <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              E
            </kbd>
          </Button>
        </div>
        {!editMode && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">J</kbd>
            {" / "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">K</kbd>
            {" navigate · "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">A</kbd>
            {" approve · "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">R</kbd>
            {" reject · "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">E</kbd>
            {" edit"}
          </p>
        )}
      </div>
      {/* Reject confirmation dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={(open) => {
        onRejectDialogChange(open);
        if (!open) setRejectReason("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject: <span className="font-medium text-foreground">{decision.proposedAction}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Rejection Reason</label>
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                onAction("rejected", undefined, rejectReason);
                onRejectDialogChange(false);
                setRejectReason("");
              }}
              disabled={isSubmitting || !rejectReason}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Confirm Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
    </AnimatePresence>
  );
}
