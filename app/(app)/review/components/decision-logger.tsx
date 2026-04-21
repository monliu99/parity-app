"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DecisionLoggerProps {
  onDecisionLogged: () => void;
  onNext: () => void;
}

export function DecisionLogger({ onDecisionLogged, onNext }: DecisionLoggerProps) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("SPENDING");
  const [outcome, setOutcome] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;

    startTransition(async () => {
      const { logDecision } = await import("../actions");
      await logDecision({
        title: title.trim(),
        context: "Monthly review",
        outcome: outcome.trim() || title.trim(),
        category,
      });
      onDecisionLogged();
      setTitle("");
      setOutcome("");
      setCategory("SPENDING");
    });
  };

  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Log any decisions you made (optional):
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="decision-title">What did you decide?</Label>
            <Input
              id="decision-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 'Dining budget is now $400'"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-category">Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger id="decision-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SPENDING">Spending</SelectItem>
                <SelectItem value="TIMING">Timing</SelectItem>
                <SelectItem value="PRIORITY">Priority</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-outcome">Additional context</Label>
            <Input
              id="decision-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Any additional context?"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || isPending}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Log decision
          </Button>

          <Button size="sm" onClick={onNext} className="gap-1">
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
