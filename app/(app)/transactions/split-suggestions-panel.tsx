"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Lightbulb, X } from "lucide-react";
import { markAsJointAction } from "./actions";

interface SplitSuggestion {
  transactionId: string;
  merchant: string;
  amount: number;
  reason: string;
}

interface SplitSuggestionsPanelProps {
  suggestions: SplitSuggestion[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function SplitSuggestionsPanel({ suggestions }: SplitSuggestionsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();

  const visible = suggestions.filter((s) => !dismissed.has(s.transactionId));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  function markJoint(id: string) {
    startTransition(async () => {
      await markAsJointAction(id);
      dismiss(id);
    });
  }

  return (
    <Card className="shadow-card border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardContent className="pt-4 pb-4">
        {/* Header */}
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="text-sm font-semibold text-foreground">
              {visible.length} expense{visible.length !== 1 ? "s" : ""} may be shared
            </span>
            <span className="text-xs text-muted-foreground">— review to split fairly</span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Suggestions list */}
        {expanded && (
          <div className="mt-3 space-y-1.5">
            {visible.map((s) => (
              <div
                key={s.transactionId}
                className="relative flex items-center justify-between p-3 rounded-lg bg-background/60 border border-border/60"
              >
                {/* Left */}
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-sm font-medium truncate">{s.merchant}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(s.amount)} · {s.reason}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markJoint(s.transactionId)}
                    disabled={pending}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Mark as Joint
                  </Button>
                  <button
                    onClick={() => dismiss(s.transactionId)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
