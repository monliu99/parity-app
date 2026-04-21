"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface ScheduleNextProps {
  decisionsCount: number;
  onComplete: () => void;
  isLoading: boolean;
}

export function ScheduleNext({ decisionsCount, onComplete, isLoading }: ScheduleNextProps) {
  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">Review complete!</p>

        <div className="space-y-2">
          {decisionsCount > 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              <span>{decisionsCount} decision{decisionsCount > 1 ? "s" : ""} logged</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No decisions logged this time.</p>
          )}
        </div>

        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            We'll let you know when it's time for your next review. You can always come back here to check in anytime.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onComplete} disabled={isLoading}>
            {isLoading ? "Saving..." : "All done"}
          </Button>
        </div>
      </div>
    </div>
  );
}
