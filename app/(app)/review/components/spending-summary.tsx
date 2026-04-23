"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Minus, Plus } from "lucide-react";

interface SpendingSummaryProps {
  thisMonth: number;
  lastMonth: number;
  baseline: number;
  topCategories: { category: string; amount: number }[];
  onNext: () => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SpendingSummary({
  thisMonth,
  lastMonth,
  baseline,
  topCategories,
  onNext,
}: SpendingSummaryProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [quickDesc, setQuickDesc] = useState("");
  const [quickAmount, setQuickAmount] = useState("");

  const diff = lastMonth > 0 ? thisMonth - lastMonth : 0;
  const diffPct = lastMonth > 0 ? Math.round((diff / lastMonth) * 100) : 0;
  const vsBaseline = baseline > 0 ? thisMonth - baseline : 0;

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDesc || !quickAmount) return;

    startTransition(async () => {
      const { createTransaction } = await import("../../settings/transactions/actions");
      const formData = new FormData();
      formData.set("description", quickDesc);
      formData.set("amount", quickAmount);
      formData.set("category", "Other");
      formData.set("date", new Date().toISOString().split("T")[0]);
      formData.set("forPartner", "false");
      formData.set("partnerId", "");
      formData.set("accountId", "");
      await createTransaction(formData);
      setQuickDesc("");
      setQuickAmount("");
      setShowQuickAdd(false);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2">
            This month you spent
          </p>
          <p className="text-3xl font-bold tabular-nums">{formatCurrency(thisMonth)}</p>
        </div>

        {(lastMonth > 0 || baseline > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
            {lastMonth > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">vs last month</p>
                <div className="flex items-center gap-1.5">
                  {diff > 0 ? (
                    <ArrowUp className="h-3.5 w-3.5 text-amber-700" />
                  ) : diff < 0 ? (
                    <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={`text-sm font-semibold ${diff > 0 ? "text-amber-700" : diff < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {diffPct > 0 ? "+" : ""}{diffPct}%
                  </span>
                </div>
              </div>
            )}
            {baseline > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">vs baseline</p>
                <div className="flex items-center gap-1.5">
                  {vsBaseline > 0 ? (
                    <ArrowUp className="h-3.5 w-3.5 text-amber-700" />
                  ) : vsBaseline < 0 ? (
                    <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={`text-sm font-semibold ${vsBaseline > 0 ? "text-amber-700" : vsBaseline < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {formatCurrency(Math.abs(vsBaseline))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {topCategories.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">Top categories</p>
            {topCategories.map((c) => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-sm">{c.category}</span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick add */}
        {showQuickAdd ? (
          <form onSubmit={handleQuickAdd} className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">Quick add a transaction</p>
            <div className="flex gap-2">
              <Input
                placeholder="Description"
                value={quickDesc}
                onChange={(e) => setQuickDesc(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="$0"
                type="number"
                step="0.01"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Adding..." : "Add"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickAdd(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-2 border-t border-border/50"
          >
            <Plus className="h-3 w-3" />
            Quick-add transaction
          </button>
        )}
      </div>

      <Button onClick={onNext} className="w-full">
        Everything looks right
      </Button>
    </div>
  );
}
