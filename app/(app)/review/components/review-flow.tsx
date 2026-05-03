"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { ReviewPage } from "./review-page";
import type { PlanInsight } from "@/lib/ai/life-planning";
import type { ReviewInsight } from "@/lib/ai/monthly-review";
import type { ReviewSuggestion } from "@/lib/ai/monthly-review";

type Step = "prompt" | "review" | "done";

interface ReviewData {
  month: string;
  alignmentScore: number;
  signals: PlanInsight[];
  insight: ReviewInsight;
  suggestions: ReviewSuggestion[];
}

interface ReviewFlowProps {
  shouldReview: boolean;
  reviewReason: string;
  urgency: "low" | "medium" | "high";
  currentMonth: string;
  pastReviews: Array<{ month: string; completedAt: Date; insight?: string | null }>;
}

export function ReviewFlow({
  shouldReview,
  reviewReason,
  currentMonth,
  pastReviews,
}: ReviewFlowProps) {
  const [step, setStep] = useState<Step>(shouldReview ? "prompt" : "done");
  const [isPending, startTransition] = useTransition();
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  if (step === "prompt") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <p className="text-sm">{reviewReason}</p>
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Your monthly money date. 15 minutes, no fights, just alignment.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-background px-2 py-1 rounded">Alignment score</span>
              <span className="text-xs bg-background px-2 py-1 rounded">Tensions vs on-track</span>
              <span className="text-xs bg-background px-2 py-1 rounded">Log decisions</span>
            </div>
          </div>
          <Button
            onClick={() => {
              startTransition(async () => {
                const { startReview } = await import("../actions");
                const result = await startReview(currentMonth);
                setReviewData({
                  month: result.month,
                  alignmentScore: result.alignmentScore,
                  signals: result.signals,
                  insight: result.insight,
                  suggestions: result.suggestions,
                });
                setStep("review");
              });
            }}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? "Loading..." : "Start Review"}
          </Button>
        </div>

        {pastReviews.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground mb-2">Past reviews</p>
            <div className="space-y-2">
              {pastReviews.slice(0, 3).map((review) => (
                <div
                  key={review.month}
                  className="flex items-center gap-2 text-sm bg-card border rounded-lg p-3"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    {new Date(review.month).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "review" && reviewData) {
    return (
      <ReviewPage
        month={reviewData.month}
        alignmentScore={reviewData.alignmentScore}
        signals={reviewData.signals}
        insight={reviewData.insight}
        suggestions={reviewData.suggestions}
        onComplete={() => setStep("done")}
      />
    );
  }

  // done state (also shown when no review needed yet)
  return (
    <div className="max-w-xl">
      {shouldReview ? (
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
                  setReviewData(null);
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
      ) : (
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <p className="text-sm">Everything looks on track.</p>
          <p className="text-xs text-muted-foreground">
            We'll notify you when it's time for your next check-in.
          </p>
          {pastReviews.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Past reviews</p>
              <div className="space-y-2">
                {pastReviews.slice(0, 3).map((review) => (
                  <div
                    key={review.month}
                    className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {new Date(review.month).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
