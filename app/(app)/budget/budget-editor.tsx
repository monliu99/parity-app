"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pencil, Check, X, Sparkles, RefreshCw, ChevronLeft, ChevronRight,
  MessageCircle, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { updateBudgetAmountAction, generateBudgetAction, generateNextMonthPlanAction } from "./actions";
import { CATEGORY_BADGE_CLASSES, DEFAULT_BADGE_CLASS } from "@/lib/category-colors";
import { Badge } from "@/components/ui/badge";
import type { NextMonthPlan } from "@/lib/ai/budget";
import type { TxRow } from "./page";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BudgetRow {
  id: string;
  category: string;
  suggestedAmount: number;
  userAmount: number | null;
  actual: number;
  reasoning?: string;
}

interface UnbudgetedCategory { category: string; actual: number; }

interface BudgetEditorProps {
  selectedMonth: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  isPastMonth: boolean;
  isCurrentMonth: boolean;
  budgetRows: BudgetRow[];
  unbudgeted: UnbudgetedCategory[];
  hasExistingBudget: boolean;
  nextMonthBudgetRows: BudgetRow[];
  hasNextMonthBudget: boolean;
  transactionsByCategory: Record<string, TxRow[]>;
  currentUserId: string;
  budgetInsight: string | null;
  daysLeft: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
function ownerDisplay(tx: TxRow, uid: string) {
  if (tx.ownerLabel === "JOINT") return "Joint";
  const mine = tx.userId === uid;
  if (tx.ownerLabel === "MINE") return mine ? "Mine" : "Partner's";
  if (tx.ownerLabel === "PARTNER") return mine ? "Partner's" : "Mine";
  return tx.ownerLabel;
}

// ─── Section divider — same pattern as transaction date groups ────────────────

function SectionDivider({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/50" />
      {action}
    </div>
  );
}

// ─── Inline editable budget amount ───────────────────────────────────────────

function EditableAmount({ budgetId, displayAmount, isEdited, readOnly }: {
  budgetId: string; displayAmount: number; isEdited: boolean; readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(displayAmount));
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    startTransition(async () => { await updateBudgetAmountAction(budgetId, parsed); setEditing(false); });
  }
  function reset() {
    startTransition(async () => { await updateBudgetAmountAction(budgetId, null); setValue(String(displayAmount)); setEditing(false); });
  }

  if (readOnly) return <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(displayAmount)}</span>;

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground">$</span>
        <input
          type="number"
          className="w-20 text-sm font-semibold tabular-nums bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
        />
        <button onClick={save} disabled={pending} className="text-primary hover:text-primary/80 p-0.5">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={isEdited ? reset : () => setEditing(false)} disabled={pending} className="text-muted-foreground hover:text-foreground p-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); setValue(String(displayAmount)); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setValue(String(displayAmount)); setEditing(true); } }}
      className="inline-flex items-center gap-1.5 cursor-pointer group/edit"
    >
      <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(displayAmount)}</span>
      {isEdited && <span className="text-xs text-primary font-medium">edited</span>}
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </span>
  );
}

// ─── Budget category row ──────────────────────────────────────────────────────
// Layout: [pill (flex-1, bg-secondary)] [budget col] [spent col] [used col]
//
// The pill contains ONLY the category name + bar. Numbers live outside the pill
// in the white card space, in fixed-width center-aligned columns so they line up
// perfectly across every row regardless of value length.
//
// Category name starts flush with the bar (no left chevron eating space).
// Chevron appears after the name. "Over budget" text is inline after the name.
// Drilldown expands below the full row.

function BudgetCategoryRow({ row, readOnly, muted, transactions, currentUserId, showReasoning }: {
  row: BudgetRow; readOnly: boolean; muted: boolean;
  transactions: TxRow[]; currentUserId: string; showReasoning?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const effective = row.userAmount ?? row.suggestedAmount;
  const pct = effective > 0 ? Math.round((row.actual / effective) * 100) : 0;
  const displayPct = Math.min(pct, 100);
  const over = row.actual > effective;
  const nearLimit = pct >= 80 && !over;

  // Bar color based on percentage: moss green (<80%), light amber (80-100%), dark amber (100%+)
  const barColor = pct >= 100
    ? "oklch(0.55 0.15 70)"  // dark amber
    : pct >= 80
      ? "oklch(0.85 0.08 70)"  // light amber
      : "oklch(0.515 0.092 155)";  // moss green

  const barOpacity = muted ? 0.35 : 1;
  const overAmount = row.actual - effective;
  const hasTx = transactions.length > 0;

  return (
    <div className="group/catrow">
      {/* Single shaded row — bg-secondary covers name, bar, AND number columns */}
      <div
        className={`grid gap-x-6 p-3 rounded-lg bg-secondary transition-colors ${hasTx ? "hover:bg-secondary/80 cursor-pointer" : ""}`}
        style={{ gridTemplateColumns: "140px 1fr auto", alignItems: "center" }}
        onClick={() => hasTx && setExpanded((e) => !e)}
      >
        {/* Left: category name column */}
        <div className="shrink-0 pr-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {row.category}
            </span>
            {hasTx && (
              expanded
                ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover/catrow:opacity-50 transition-opacity" />
            )}
          </div>
          {over && (
            <div className="mt-0.5">
              <span className="text-xs text-amber-700">↑ {fmt(overAmount)} over</span>
            </div>
          )}
        </div>

        {/* Middle: progress bar */}
        <div className="min-w-0">
          <div className="h-2 rounded-full bg-border/20 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${displayPct}%`, backgroundColor: barColor, opacity: barOpacity }}
            />
          </div>
          {showReasoning && row.reasoning && (
            <p className="text-xs text-muted-foreground italic mt-1">{row.reasoning}</p>
          )}
        </div>

        {/* Right: numbers column */}
        <div className="flex items-center gap-6 shrink-0">
          {/* Budget — editable, centered */}
          <div className="w-16 flex justify-center">
            <EditableAmount
              budgetId={row.id}
              displayAmount={effective}
              isEdited={row.userAmount !== null}
              readOnly={readOnly}
            />
          </div>
          {/* Spent */}
          <span className="text-sm font-semibold tabular-nums w-16 text-center text-foreground">
            {fmt(row.actual)}
          </span>
          {/* % used */}
          <span className={`text-sm font-semibold tabular-nums w-16 text-center ${over ? "text-amber-700" : nearLimit ? "text-amber-700" : "text-muted-foreground/50"}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Drilldown — spans full row width below */}
      {expanded && hasTx && (
        <div className="mt-2 space-y-1.5">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/60 hover:bg-secondary/80 transition-colors"
            >
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-sm font-medium truncate">{tx.merchant}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {shortDate(tx.date)} · {ownerDisplay(tx, currentUserId)} · {tx.accountName}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0 text-foreground">
                {fmtFull(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column header hints ──────────────────────────────────────────────────────
// Uses same flex layout as BudgetCategoryRow: flex-1 spacer (matches pill) + gap-3
// then fixed-width center-aligned headers matching number column widths.

function ColumnHeaders({ showSpent = true }: { showSpent?: boolean }) {
  return (
    // Matches the BudgetCategoryRow grid layout: 140px | 1fr | auto
    <div className="grid gap-x-6 px-3 pb-2" style={{ gridTemplateColumns: "140px 1fr auto", alignItems: "center" }}>
      {/* Left spacer for category name */}
      <div />
      {/* Middle spacer for progress bar */}
      <div />
      {/* Right: column headers */}
      <div className="flex items-center gap-6 shrink-0">
        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide w-16 text-center">budget</span>
        {showSpent && (
          <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide w-16 text-center">spent</span>
        )}
        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide w-16 text-center">used</span>
      </div>
    </div>
  );
}

// ─── Track tab ────────────────────────────────────────────────────────────────

function TrackTab({
  selectedMonth, budgetRows, unbudgeted, hasExistingBudget,
  isPastMonth, isCurrentMonth, transactionsByCategory, currentUserId,
  budgetInsight, daysLeft, onSwitchToPlan, onRegenerate, regenerating,
}: {
  selectedMonth: string; budgetRows: BudgetRow[]; unbudgeted: UnbudgetedCategory[];
  hasExistingBudget: boolean; isPastMonth: boolean; isCurrentMonth: boolean;
  transactionsByCategory: Record<string, TxRow[]>; currentUserId: string;
  budgetInsight: string | null; daysLeft: number;
  onSwitchToPlan: () => void; onRegenerate: () => void; regenerating: boolean;
}) {
  const [onTrackExpanded, setOnTrackExpanded] = useState(false);
  const label = monthLabel(selectedMonth);

  if (!hasExistingBudget) {
    if (isPastMonth) {
      return (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold text-muted-foreground">No budget was set for {label}.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="font-semibold">No budget for {label} yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Use the Plan tab to draft one with AI, or generate quickly now.
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={onSwitchToPlan} className="cursor-pointer">
              Plan with AI <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <Button variant="outline" onClick={onRegenerate} disabled={regenerating} className="cursor-pointer">
              {regenerating ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Quick Generate
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalBudgeted = budgetRows.reduce((s, r) => s + (r.userAmount ?? r.suggestedAmount), 0);
  const totalActual = budgetRows.reduce((s, r) => s + r.actual, 0);
  const totalPct = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0;
  const overBudget = totalActual > totalBudgeted;

  const attention = budgetRows
    .filter((r) => r.actual / (r.userAmount ?? r.suggestedAmount) >= 0.8)
    .sort((a, b) => (b.actual / (b.userAmount ?? b.suggestedAmount)) - (a.actual / (a.userAmount ?? a.suggestedAmount)));
  const onTrack = budgetRows
    .filter((r) => r.actual / (r.userAmount ?? r.suggestedAmount) < 0.8)
    .sort((a, b) => b.actual - a.actual);
  const allGood = attention.length === 0;

  return (
    <div className="space-y-4">

      {/* ── Summary cards — 2-col grid matching transactions page ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Budgeted</p>
            <p className="text-3xl font-bold tabular-nums text-foreground leading-none">{fmt(totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Spent</p>
            <p className={`text-3xl font-bold tabular-nums leading-none ${
              totalPct >= 100
                ? "text-amber-700"
                : totalPct >= 80
                  ? "text-amber-600"
                  : "text-moss"
            }`}>
              {fmt(totalActual)}
            </p>
            {isCurrentMonth && daysLeft > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{daysLeft}d left · {totalPct}% used</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── AI insight card — white shadow-card matching rest of app ── */}
      {budgetInsight && (
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">AI Insight</p>
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed text-foreground">{budgetInsight}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Category breakdown — single card with date-group-style section dividers ── */}
      <Card className="shadow-card">
        <CardContent className="pt-5 pb-5">

          <ColumnHeaders />

          {/* Needs Attention */}
          {!allGood && (
            <div>
              <SectionDivider label="Needs Attention" />
              <div className="space-y-2">
                {attention.map((row) => (
                  <BudgetCategoryRow
                    key={row.id}
                    row={row}
                    readOnly={isPastMonth}
                    muted={false}
                    transactions={transactionsByCategory[row.category] ?? []}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* On Track */}
          {onTrack.length > 0 && (
            <div className={!allGood ? "mt-3" : ""}>
              <SectionDivider
                label={allGood ? "All Categories" : "On Track"}
                action={
                  !allGood ? (
                    <button
                      onClick={() => setOnTrackExpanded((e) => !e)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {onTrackExpanded ? "Collapse" : `Show ${onTrack.length}`}
                      {onTrackExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  ) : undefined
                }
              />
              {(onTrackExpanded || allGood) && (
                <div className="space-y-2">
                  {onTrack.map((row) => (
                    <BudgetCategoryRow
                      key={row.id}
                      row={row}
                      readOnly={isPastMonth}
                      muted
                      transactions={transactionsByCategory[row.category] ?? []}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Outside budget categories ── */}
      {unbudgeted.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-5">
            <SectionDivider label="Outside Budget" />
            <div className="space-y-2">
              {unbudgeted.map((u) => (
                <div
                  key={u.category}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                >
                  <Badge className={`text-xs border-0 ${CATEGORY_BADGE_CLASSES[u.category] ?? DEFAULT_BADGE_CLASS}`}>
                    {u.category}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">{fmt(u.actual)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Plan tab ─────────────────────────────────────────────────────────────────

function PlanTab({ nextMonth, nextMonthBudgetRows, hasNextMonthBudget }: {
  nextMonth: string; nextMonthBudgetRows: BudgetRow[]; hasNextMonthBudget: boolean;
}) {
  const label = monthLabel(nextMonth);
  const [userContext, setUserContext] = useState("");
  const [generating, startGenerate] = useTransition();
  const [plan, setPlan] = useState<NextMonthPlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [promptsExpanded, setPromptsExpanded] = useState(true);
  const router = useRouter();

  const planRows: BudgetRow[] = plan
    ? plan.categoryBudgets.map((cb) => {
        const existing = nextMonthBudgetRows.find((r) => r.category === cb.category);
        return existing
          ? { ...existing, reasoning: cb.reasoning }
          : { id: `pending-${cb.category}`, category: cb.category, suggestedAmount: cb.suggestedAmount, userAmount: null, actual: 0, reasoning: cb.reasoning };
      })
    : nextMonthBudgetRows;

  function handleGenerate() {
    setSaved(false);
    startGenerate(async () => {
      const result = await generateNextMonthPlanAction(userContext || undefined);
      setPlan(result.plan ?? null);
    });
  }

  if (saved) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Check className="h-8 w-8 text-primary mb-3" />
          <p className="font-semibold">{label} budget saved</p>
          <p className="text-sm text-muted-foreground mt-1">You can track your progress here next month.</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => router.push(`/budget?month=${nextMonth}`)}>
            View {label} budget <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!plan && !hasNextMonthBudget) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-8 space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <p className="font-semibold">Plan your {label} budget</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Parity will analyze your recent spending, active goals, and seasonal patterns to suggest a budget — and surface questions worth discussing before you finalize.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Anything changing next month? <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. We're going to Italy, starting a gym membership..."
              className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="cursor-pointer">
            {generating ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {generating ? "Drafting..." : "Draft with AI"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const displayRows = plan ? planRows : nextMonthBudgetRows;

  return (
    <div className="space-y-4">

      {/* Parity's Read — shadow-card matching AI insight card in Track tab */}
      {plan && plan.contextSummary.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">Parity&apos;s Read</p>
            <div className="space-y-2.5">
              {plan.contextSummary.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm leading-relaxed">{bullet}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draft budget rows */}
      <Card className="shadow-card">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Draft · {label}</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerate
            </button>
          </div>

          <ColumnHeaders showSpent={false} />

          {generating && displayRows.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <p className="text-sm">Analyzing your spending history...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayRows.map((row) => (
                <BudgetCategoryRow
                  key={row.id}
                  row={row}
                  readOnly={row.id.startsWith("pending-")}
                  muted={false}
                  transactions={[]}
                  currentUserId=""
                  showReasoning
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discussion prompts */}
      {plan && plan.discussionPrompts.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-5">
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setPromptsExpanded((e) => !e)}
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Before You Agree</p>
              {promptsExpanded
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {promptsExpanded && (
              <div className="mt-3 space-y-3">
                {plan.discussionPrompts.map((prompt, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm">{prompt}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(plan || hasNextMonthBudget) && (
        <Button onClick={() => setSaved(true)} className="w-full cursor-pointer" disabled={generating}>
          <Check className="h-4 w-4 mr-1.5" />
          Looks good — save {label} budget
        </Button>
      )}

      {plan && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Add context and regenerate..."
            className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
          />
          <Button variant="outline" onClick={handleGenerate} disabled={generating} className="cursor-pointer shrink-0">
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function BudgetEditor({
  selectedMonth, prevMonth, nextMonth, today,
  isPastMonth, isCurrentMonth,
  budgetRows, unbudgeted, hasExistingBudget,
  nextMonthBudgetRows, hasNextMonthBudget,
  transactionsByCategory, currentUserId,
  budgetInsight, daysLeft,
}: BudgetEditorProps) {
  const [activeTab, setActiveTab] = useState<"track" | "plan">("track");
  const [regenerating, startRegenerate] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-sm text-muted-foreground mt-1">{monthLabel(selectedMonth)}</p>
        </div>
        <div className="flex items-center border border-border rounded-lg p-0.5 bg-secondary shrink-0">
          <button
            onClick={() => setActiveTab("track")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "track" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Track
          </button>
          <button
            onClick={() => setActiveTab("plan")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === "plan" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Plan Next Month
          </button>
        </div>
      </div>

      {/* Month nav — only on Track tab */}
      {activeTab === "track" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/budget?month=${prevMonth}`)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {monthLabel(prevMonth).split(" ")[0]}
          </button>
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold">{monthLabel(selectedMonth)}</span>
            {isCurrentMonth && <span className="ml-2 text-xs text-primary font-medium">current</span>}
            {isPastMonth && <span className="ml-2 text-xs text-muted-foreground">past · read-only</span>}
          </div>
          <button
            onClick={() => router.push(`/budget?month=${nextMonth}`)}
            disabled={nextMonth > today && !hasNextMonthBudget}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary disabled:opacity-30"
          >
            {monthLabel(nextMonth).split(" ")[0]}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === "track" ? (
        <TrackTab
          selectedMonth={selectedMonth}
          budgetRows={budgetRows}
          unbudgeted={unbudgeted}
          hasExistingBudget={hasExistingBudget}
          isPastMonth={isPastMonth}
          isCurrentMonth={isCurrentMonth}
          transactionsByCategory={transactionsByCategory}
          currentUserId={currentUserId}
          budgetInsight={budgetInsight}
          daysLeft={daysLeft}
          onSwitchToPlan={() => setActiveTab("plan")}
          onRegenerate={() => startRegenerate(async () => { await generateBudgetAction(selectedMonth); })}
          regenerating={regenerating}
        />
      ) : (
        <PlanTab
          nextMonth={nextMonth}
          nextMonthBudgetRows={nextMonthBudgetRows}
          hasNextMonthBudget={hasNextMonthBudget}
        />
      )}
    </div>
  );
}
