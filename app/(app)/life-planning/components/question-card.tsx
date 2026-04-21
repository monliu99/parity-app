"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QuestionCardProps {
  question: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  progress: { current: number; total: number };
  isLast: boolean;
}

export function QuestionCard({
  question,
  answer,
  onAnswerChange,
  onNext,
  onBack,
  progress,
  isLast,
}: QuestionCardProps) {
  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-5">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {progress.current} of {progress.total}
          </span>
        </div>

        {/* Main question */}
        <div className="space-y-3">
          <label htmlFor="answer-input" className="text-sm text-muted-foreground">
            {question}
          </label>

          <Textarea
            id="answer-input"
            value={answer ?? ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Share your thoughts together…"
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            onClick={onNext}
            disabled={!answer?.trim()}
            size="sm"
            className="gap-1"
          >
            {isLast ? "Finish" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
