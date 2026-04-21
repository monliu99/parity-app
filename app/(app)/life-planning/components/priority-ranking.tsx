"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Priority {
  rank: number;
  area: string;
  description: string;
}

interface Conflict {
  area: string;
  tension: string;
  suggestedFrame: string;
}

interface PriorityRankingProps {
  priorities: Priority[];
  conflicts: Conflict[];
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function PriorityRanking({ priorities, conflicts, onBack, onNext, isLoading }: PriorityRankingProps) {
  // Fallback priorities if AI returns empty
  const defaultPriorities: Priority[] = [
    { rank: 1, area: "Housing", description: "Your living situation and home" },
    { rank: 2, area: "Emergency Fund", description: "Financial safety net" },
    { rank: 3, area: "Experiences", description: "Travel, dining, and memories together" },
    { rank: 4, area: "Debt Repayment", description: "Paying down any outstanding debts" },
    { rank: 5, area: "Retirement", description: "Long-term financial security" },
  ];

  const [rankedPriorities, setRankedPriorities] = useState<Priority[]>(
    priorities.length > 0 ? priorities : defaultPriorities
  );
  const [viewedConflicts, setViewedConflicts] = useState<Set<number>>(new Set());

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPriorities = [...rankedPriorities];
    [newPriorities[index - 1], newPriorities[index]] = [newPriorities[index], newPriorities[index - 1]];
    setRankedPriorities(newPriorities.map((p, i) => ({ ...p, rank: i + 1 })));
  };

  const moveDown = (index: number) => {
    if (index === rankedPriorities.length - 1) return;
    const newPriorities = [...rankedPriorities];
    [newPriorities[index], newPriorities[index + 1]] = [newPriorities[index + 1], newPriorities[index]];
    setRankedPriorities(newPriorities.map((p, i) => ({ ...p, rank: i + 1 })));
  };

  return (
    <div className="max-w-xl space-y-4">
      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">Something to consider:</p>
          {conflicts.map((conflict, i) => (
            <div key={i} className="text-sm space-y-1">
              <p className="text-amber-800 dark:text-amber-300">{conflict.tension}</p>
              <p className="text-xs text-muted-foreground">{conflict.suggestedFrame}</p>
            </div>
          ))}
        </div>
      )}

      {/* Priorities */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Drag to rank what matters most right now:
        </p>

        {rankedPriorities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No priorities generated. You can still continue to your roadmap.
          </p>
        ) : (
          <div className="space-y-2">
            {rankedPriorities.map((priority, index) => (
            <div
              key={priority.area}
              className="flex items-center gap-2 bg-secondary rounded-lg p-3"
            >
              <span className="text-xs font-bold text-muted-foreground w-6">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{priority.area}</p>
                <p className="text-xs text-muted-foreground truncate">{priority.description}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className={cn(
                    "p-1 rounded hover:bg-background disabled:opacity-30",
                    index === 0 && "cursor-not-allowed"
                  )}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === rankedPriorities.length - 1}
                  className={cn(
                    "p-1 rounded hover:bg-background disabled:opacity-30",
                    index === rankedPriorities.length - 1 && "cursor-not-allowed"
                  )}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button onClick={onNext} disabled={isLoading} size="sm" className="gap-1">
            {isLoading ? "Generating plan..." : "See my roadmap"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
