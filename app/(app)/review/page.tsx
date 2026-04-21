import { checkReviewNeeded, getRecentReviews } from "./actions";
import { ReviewFlow } from "./components/review-flow";

export default async function ReviewPage() {
  const [{ shouldReview, reason, urgency }, { reviews }] = await Promise.all([
    checkReviewNeeded(),
    getRecentReviews(),
  ]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monthly Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your monthly money date. No fights, just alignment.
        </p>
      </div>

      <ReviewFlow
        shouldReview={shouldReview}
        reviewReason={reason}
        urgency={urgency}
        currentMonth={currentMonth}
        pastReviews={reviews}
      />
    </div>
  );
}
