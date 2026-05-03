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
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  return (
    <div
      className="flex flex-col items-center gap-0.5 shrink-0"
      role="img"
      aria-label={`${completed} of ${total} actions complete`}
    >
      <div className="relative">
        <svg width="44" height="44" className="-rotate-90">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-border"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-primary"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            strokeLinecap="round"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary"
          aria-hidden="true"
        >
          {completed}/{total}
        </span>
      </div>
      <span className="text-[9px] text-muted-foreground whitespace-nowrap" aria-hidden="true">
        actions done
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
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Your Shared Vision
            </p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{visionStatement}</p>
        </div>

        {/* Current action + progress ring */}
        {progressTotal > 0 && (
          <div className="mx-5 mb-4 flex items-center gap-3">
            {currentAction ? (
              <div className="flex-1 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-primary font-medium mb-1">This month</p>
                <p className="text-sm text-foreground font-medium">{currentAction.title}</p>
                {currentAction.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{currentAction.description}</p>
                )}
              </div>
            ) : (
              <div className="flex-1 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-emerald-600 font-medium">All actions complete ✓</p>
              </div>
            )}
            <ProgressRing completed={progressCompleted} total={progressTotal} />
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
