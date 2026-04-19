import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

const EMOJI_LABELS: Record<number, { emoji: string; label: string }> = {
  3: { emoji: "😄", label: "Great" },
  2: { emoji: "😐", label: "Okay" },
  1: { emoji: "😔", label: "Bad" },
};

function RatingBadge({ rating }: { rating: number }) {
  const { emoji, label } = EMOJI_LABELS[rating] ?? { emoji: "?", label: "Unknown" };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  );
}

function relativeDate(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function AdminFeedbackPage() {
  const feedback = await db.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const userIds = [...new Set(feedback.map((f) => f.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentCount = feedback.filter(
    (f) => f.createdAt.getTime() > sevenDaysAgo
  ).length;

  const avgRating =
    feedback.length > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
      : 0;

  // Group by page, sorted by count desc
  const byPage: Record<string, typeof feedback> = {};
  for (const f of feedback) {
    if (!byPage[f.page]) byPage[f.page] = [];
    byPage[f.page].push(f);
  }
  const pages = Object.entries(byPage).sort(([, a], [, b]) => b.length - a.length);

  const avgColor =
    avgRating >= 2.5
      ? "text-emerald-600"
      : avgRating >= 1.5
      ? "text-foreground"
      : "text-amber-600";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {feedback.length} total response{feedback.length !== 1 ? "s" : ""}
          {recentCount > 0 && ` · ${recentCount} in the last 7 days`}
        </p>
      </div>

      {/* Summary cards */}
      {feedback.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest font-medium text-muted-foreground mb-1">
              Total
            </p>
            <p className="text-3xl font-bold tabular-nums">{feedback.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest font-medium text-muted-foreground mb-1">
              Avg rating
            </p>
            <p className={cn("text-3xl font-bold tabular-nums", avgColor)}>
              {avgRating.toFixed(1)}
              <span className="text-base ml-1.5">{EMOJI_LABELS[Math.round(avgRating)]?.emoji}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest font-medium text-muted-foreground mb-1">
              Last 7 days
            </p>
            <p className="text-3xl font-bold tabular-nums">{recentCount}</p>
          </div>
        </div>
      )}

      {/* Per-page sections */}
      {feedback.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No feedback yet — try the widget on any page.
        </p>
      ) : (
        <div className="space-y-6">
          {pages.map(([page, items]) => {
            const pageAvg =
              items.reduce((sum, f) => sum + f.rating, 0) / items.length;
            return (
              <div key={page} className="space-y-2">
                {/* Page header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
                    {page}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      avg {pageAvg.toFixed(1)} · {items.length} response{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Feedback rows */}
                <div className="space-y-1">
                  {items.map((f) => {
                    const submitter = userMap[f.userId];
                    return (
                      <div
                        key={f.id}
                        className="relative flex items-start justify-between p-3 rounded-lg bg-secondary"
                      >
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1 pr-4">
                          <RatingBadge rating={f.rating} />
                          {f.comment && (
                            <p className="text-sm text-foreground whitespace-pre-wrap">{f.comment}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {submitter?.name ?? submitter?.email ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {relativeDate(f.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
