"use client";

import { Progress } from "@/components/ui/progress";
import type { PlanInsight } from "@/lib/ai/life-planning";

interface Snapshot {
  alignmentScore: number | null;
  signals: unknown;
  createdAt: Date;
}

interface InsightsTabProps {
  snapshot: Snapshot | null;
  lastReviewedAt: Date | null;
}

export function InsightsTab({ snapshot, lastReviewedAt }: InsightsTabProps) {
  if (!snapshot) {
    return (
      <div className="bg-card border rounded-xl p-6 text-center space-y-2">
        <p className="text-sm font-medium">No insights yet</p>
        <p className="text-xs text-muted-foreground">
          Complete your first monthly review to see how your spending aligns with your priorities.
        </p>
      </div>
    );
  }

  const alignmentScore = snapshot.alignmentScore ?? 0;
  const signals = (snapshot.signals as PlanInsight[]) ?? [];

  const statusColor = (status: PlanInsight["status"]) => {
    if (status === "aligned") return "text-emerald-600";
    if (status === "tension") return "text-amber-700";
    return "text-muted-foreground";
  };

  const statusLabel = (status: PlanInsight["status"]) => {
    if (status === "aligned") return "Aligned";
    if (status === "tension") return "Tension";
    return "Neutral";
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Spending alignment</p>
          <span className="text-2xl font-bold">{alignmentScore}%</span>
        </div>
        <Progress value={alignmentScore} className="h-2" />
        <p className="text-xs text-muted-foreground">
          How closely your spending reflects your stated priorities
        </p>
      </div>

      {signals.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Observations
          </p>
          {signals.map((signal, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{signal.title}</p>
                <span className={`text-xs font-medium ${statusColor(signal.status)}`}>
                  {statusLabel(signal.status)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{signal.description}</p>
              {signal.priority && (
                <p className="text-xs text-muted-foreground">↳ {signal.priority}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {lastReviewedAt && (
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(lastReviewedAt).toLocaleDateString()}. Insights refresh after each monthly review.
        </p>
      )}
    </div>
  );
}
