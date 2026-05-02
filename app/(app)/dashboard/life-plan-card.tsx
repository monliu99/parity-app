import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface RoadmapAction {
  month: number;
  title: string;
  description: string;
}

interface LifePlanHeroProps {
  visionStatement: string | null;
  currentAction: RoadmapAction | null;
  progressCompleted: number;
  progressTotal: number;
  insight: string | null;
}

function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <svg
        width="36"
        height="36"
        className="-rotate-90"
        role="img"
        aria-label={`${completed} of ${total} roadmap actions completed`}
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-border"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-primary"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">
        {completed} of {total}
      </span>
    </div>
  );
}

export function LifePlanHero({
  visionStatement,
  currentAction,
  progressCompleted,
  progressTotal,
  insight,
}: LifePlanHeroProps) {
  if (!visionStatement) {
    return (
      <Card className="shadow-card overflow-hidden">
        <CardContent className="px-5 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Your Shared Vision
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create a shared vision to get the most out of Parity.
          </p>
          <Link href="/life-planning" className="text-sm text-primary font-medium hover:underline">
            Start your shared vision →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Your Shared Vision
              </p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{visionStatement}</p>
          </div>
          <ProgressRing completed={progressCompleted} total={progressTotal} />
        </div>

        {/* Current action */}
        {currentAction && (
          <div className="mx-5 mb-4 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-primary font-medium mb-1">This month</p>
            <p className="text-sm text-foreground font-medium">{currentAction.title}</p>
            {currentAction.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{currentAction.description}</p>
            )}
          </div>
        )}

        {/* AI insight + link */}
        <div className="px-5 pb-4 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
          {insight ? (
            <p className="text-xs text-muted-foreground italic leading-relaxed flex-1">{insight}</p>
          ) : (
            <div className="flex-1" />
          )}
          <Link href="/life-planning" className="text-xs text-primary hover:underline shrink-0">
            Update vision →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
