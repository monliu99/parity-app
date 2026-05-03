"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import type { PlanInsight } from "@/lib/ai/life-planning";
import type { ReviewInsight, ReviewSuggestion } from "@/lib/ai/monthly-review";

interface ReviewPageProps {
  month: string;
  alignmentScore: number;
  signals: PlanInsight[];
  insight: ReviewInsight;
  suggestions: ReviewSuggestion[];
  onComplete: () => void;
}

function alignmentLabel(score: number): string {
  if (score >= 75) return "Your spending mostly reflects your priorities.";
  if (score >= 50) return "Your spending partially reflects your priorities.";
  return "Your spending has some misalignment with your priorities.";
}

export function ReviewPage({
  month,
  alignmentScore,
  signals,
  insight,
  suggestions,
  onComplete,
}: ReviewPageProps) {
  const [showPart2, setShowPart2] = useState(false);
  const [currentDecision, setCurrentDecision] = useState("");
  const [decisions, setDecisions] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const tensions = signals.filter((s) => s.status === "tension");
  const onTrack = signals.filter((s) => s.status !== "tension");

  const addDecision = () => {
    const trimmed = currentDecision.trim();
    if (!trimmed) return;
    setDecisions((prev) => [...prev, trimmed]);
    setCurrentDecision("");
  };

  const removeDecision = (index: number) => {
    setDecisions((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSuggestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    startTransition(async () => {
      const { completeReview, applyReviewSuggestions, logDecision } = await import("../actions");

      if (decisions.length > 0) {
        await Promise.all(
          decisions.map((title) =>
            logDecision({ title, context: "", outcome: title, category: "OTHER" })
          )
        );
      }

      await completeReview({
        month,
        insight: insight.insight,
        decisionsCount: decisions.length,
      });

      const selectedSuggestions = suggestions.filter((s) => selectedIds.has(s.id));
      if (selectedSuggestions.length > 0) {
        await applyReviewSuggestions(selectedSuggestions);
      }

      onComplete();
    });
  };

  const displayMonth = new Date(`${month}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-xl space-y-6">
      {/* Score hero */}
      <div className="bg-[#f0f4ee] border border-[#c8d9c0] rounded-xl p-6 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {displayMonth} alignment
        </p>
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold">{alignmentScore}%</span>
        </div>
        <p className="text-sm text-muted-foreground">{alignmentLabel(alignmentScore)}</p>
      </div>

      {/* Signal cards */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Tensions — left */}
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              Tensions
            </p>
            {tensions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">None this month</p>
            )}
            {tensions.map((s, i) => (
              <div key={i} className="border border-amber-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.description}</p>
                {s.priority && (
                  <p className="text-xs text-muted-foreground">↳ {s.priority}</p>
                )}
              </div>
            ))}
          </div>

          {/* On track — right */}
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              On track
            </p>
            {onTrack.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Keep going</p>
            )}
            {onTrack.map((s, i) => (
              <div key={i} className="border border-emerald-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.description}</p>
                {s.priority && (
                  <p className="text-xs text-muted-foreground">↳ {s.priority}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation starter */}
      {insight.insight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800">Worth discussing together</p>
          <p className="text-sm text-amber-900">{insight.insight}</p>
          {insight.frame && (
            <p className="text-xs text-amber-700 italic">{insight.frame}</p>
          )}
        </div>
      )}

      {/* Decisions */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium">What did you both decide?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentDecision}
            onChange={(e) => setCurrentDecision(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDecision()}
            placeholder="Type a decision and press Enter"
            className="flex-1 text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" variant="outline" onClick={addDecision} disabled={!currentDecision.trim()}>
            Add
          </Button>
        </div>
        {decisions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {decisions.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs bg-secondary px-3 py-1.5 rounded-full"
              >
                {d}
                <button
                  onClick={() => removeDecision(i)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Next button (Part 1 → Part 2) */}
      {!showPart2 && (
        <Button onClick={() => setShowPart2(true)} className="gap-2 w-full sm:w-auto">
          Next: Make adjustments
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Part 2: Take action */}
      {showPart2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-700">Part 2 · Take action</p>
            <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">optional</span>
          </div>

          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No adjustments suggested this month.</p>
          )}

          {suggestions.map((s) => (
            <label
              key={s.id}
              className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
                selectedIds.has(s.id) ? "bg-blue-50 border-blue-200" : "bg-card"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(s.id)}
                onChange={() => toggleSuggestion(s.id)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.explanation}</p>
              </div>
            </label>
          ))}

          <Button onClick={handleApply} disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Saving..." : "Apply & complete review"}
          </Button>
        </div>
      )}
    </div>
  );
}
