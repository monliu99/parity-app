"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface InsightDiscussionProps {
  insight: string;
  frame: string;
  onNext: () => void;
}

export function InsightDiscussion({ insight, frame, onNext }: InsightDiscussionProps) {
  const [notes, setNotes] = useState("");
  const [discussed, setDiscussed] = useState(false);

  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">One thing to discuss:</p>

        <div className="bg-secondary/50 rounded-lg p-4">
          <p className="text-sm leading-relaxed">{insight}</p>
        </div>

        {frame && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">How to bring it up:</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{frame}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="discussion-notes" className="text-sm text-muted-foreground">
            Any notes from your discussion?
          </label>
          <Textarea
            id="discussion-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you both decide?"
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={() => setDiscussed(!discussed)}>
            {discussed ? "✓ Discussed" : "Mark as discussed"}
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNotes("")}>
              Clear
            </Button>
            <Button size="sm" onClick={onNext} className="gap-1">
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
