"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, RotateCcw } from "lucide-react";
import { CelebrationCard } from "./celebration-card";
import { SpendingSummary } from "./spending-summary";
import { InsightDiscussion } from "./insight-discussion";
import { DecisionLogger } from "./decision-logger";
import { ScheduleNext } from "./schedule-next";

type Step = "prompt" | "celebration" | "spending" | "insight" | "decisions" | "schedule" | "done";

interface SpendingData {
  thisMonth: number;
  lastMonth: number;
  baseline: number;
  topCategories: { category: string; amount: number }[];
}

interface ReviewFlowProps {
  shouldReview: boolean;
  reviewReason: string;
  urgency: "low" | "medium" | "high";
  currentMonth: string;
  pastReviews: Array<{ month: string; completedAt: Date; insight?: string | null }>;
}

export function ReviewFlow({ shouldReview, reviewReason, urgency, currentMonth, pastReviews }: ReviewFlowProps) {
  const [step, setStep] = useState<Step>(shouldReview ? "prompt" : "done");
  const [isPending, startTransition] = useTransition();
  const [insight, setInsight] = useState<{ celebration: string; insight: string; frame: string } | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingData | null>(null);
  const [decisionsCount, setDecisionsCount] = useState(0);

  if (step === "prompt") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <p className="text-sm">{reviewReason}</p>

          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Your monthly money date. 15 minutes, no fights, just alignment.</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-background px-2 py-1 rounded">Celebrate wins</span>
              <span className="text-xs bg-background px-2 py-1 rounded">One thing to discuss</span>
              <span className="text-xs bg-background px-2 py-1 rounded">Log decisions</span>
            </div>
          </div>

          <Button
            onClick={() => {
              startTransition(async () => {
                const { startReview } = await import("../actions");
                const result = await startReview(currentMonth);
                setInsight(result.insight);
                setSpendingData(result.spendingSummary ?? null);
                setStep("celebration");
              });
            }}
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Start Review"}
          </Button>
        </div>

        {pastReviews.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground mb-2">Past reviews</p>
            <div className="space-y-2">
              {pastReviews.slice(0, 3).map((review) => (
                <div key={review.month} className="flex items-center gap-2 text-sm bg-card border rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{new Date(review.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "celebration") {
    return (
      <CelebrationCard
        celebration={insight?.celebration || "You're making progress together."}
        onNext={() => setStep("spending")}
      />
    );
  }

  if (step === "spending") {
    return (
      <SpendingSummary
        thisMonth={spendingData?.thisMonth ?? 0}
        lastMonth={spendingData?.lastMonth ?? 0}
        baseline={spendingData?.baseline ?? 0}
        topCategories={spendingData?.topCategories ?? []}
        onNext={() => setStep("insight")}
      />
    );
  }

  if (step === "insight") {
    return (
      <InsightDiscussion
        insight={insight?.insight || ""}
        frame={insight?.frame || ""}
        onNext={() => setStep("decisions")}
      />
    );
  }

  if (step === "decisions") {
    return (
      <DecisionLogger
        onDecisionLogged={() => setDecisionsCount((c) => c + 1)}
        onNext={() => setStep("schedule")}
      />
    );
  }

  if (step === "schedule") {
    return (
      <ScheduleNext
        decisionsCount={decisionsCount}
        onComplete={() => {
          startTransition(async () => {
            const { completeReview } = await import("../actions");
            await completeReview({
              month: currentMonth,
              insight: insight?.insight || "",
              decisionsCount,
            });
            setStep("done");
          });
        }}
        isLoading={isPending}
      />
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-8 text-center space-y-4">
          <p className="text-3xl">✨</p>
          <h2 className="text-xl font-semibold">You're all set!</h2>
          <p className="text-sm text-muted-foreground">
            Nice work checking in together. We'll let you know when it's time for the next one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => {
                startTransition(async () => {
                  const { deleteCurrentMonthReview } = await import("../actions");
                  await deleteCurrentMonthReview(currentMonth);
                  setStep("prompt");
                });
              }}
              disabled={isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart this month's review
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not ready for review yet
  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-emerald-600 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm">Everything looks on track.</p>
            <p className="text-xs text-muted-foreground">
              We'll notify you when it's time for your next check-in.
            </p>
          </div>
        </div>

        {pastReviews.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Past reviews</p>
            <div className="space-y-2">
              {pastReviews.slice(0, 3).map((review) => (
                <div key={review.month} className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{new Date(review.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
