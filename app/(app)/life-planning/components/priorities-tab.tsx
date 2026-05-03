"use client";

import { useState, useTransition, useEffect } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { reorderPriorities } from "../actions";

interface Priority {
  rank: number;
  area: string;
  description: string;
}

interface ValueConflict {
  area: string;
  tension: string;
  suggestedFrame: string;
}

interface PrioritiesTabProps {
  lifePlan: LifePlan;
}

export function PrioritiesTab({ lifePlan }: PrioritiesTabProps) {
  const raw = lifePlan.priorities as unknown as
    | { priorities: Priority[]; conflicts?: ValueConflict[] }
    | undefined;

  const [priorities, setPriorities] = useState<Priority[]>(raw?.priorities ?? []);
  const conflicts: ValueConflict[] = raw?.conflicts ?? [];
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) setPriorities(raw?.priorities ?? []);
  }, [raw?.priorities, isDirty]);
  const [isPending, startTransition] = useTransition();

  const move = (index: number, direction: "up" | "down") => {
    const next = [...priorities];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setPriorities(next.map((p, i) => ({ ...p, rank: i + 1 })));
    setIsDirty(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      await reorderPriorities(priorities);
      setIsDirty(false);
    });
  };

  if (priorities.length === 0) {
    return <p className="text-sm text-muted-foreground">No priorities saved yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-6 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Your priorities
        </p>
        {priorities.map((priority, index) => (
          <div key={priority.area} className="flex items-start gap-3 py-2">
            <span className="text-xs font-bold text-muted-foreground w-5 mt-0.5 flex-shrink-0">
              {priority.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{priority.area}</p>
              <p className="text-xs text-muted-foreground">{priority.description}</p>
            </div>
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => move(index, "up")}
                disabled={index === 0 || isPending}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => move(index, "down")}
                disabled={index === priorities.length - 1 || isPending}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {isDirty && (
          <div className="pt-3 border-t mt-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save order"}
            </Button>
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Potential tensions
          </p>
          {conflicts.map((conflict, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-medium text-amber-700">{conflict.area}</p>
              <p className="text-xs text-muted-foreground">{conflict.tension}</p>
              <p className="text-xs text-muted-foreground italic">{conflict.suggestedFrame}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
