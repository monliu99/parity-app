"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Target, Check } from "lucide-react";
import { createGoalsFromRoadmap } from "../actions";
import { cn } from "@/lib/utils";

interface SuggestedGoal {
  title: string;
  description: string;
  targetAmount: number | null;
  targetDate: Date;
  category: string;
  skipReason?: string;
}

interface RoadmapToGoalsProps {
  lifePlanId: string;
  suggestions: SuggestedGoal[];
  onComplete: () => void;
  onCancel: () => void;
}

export function RoadmapToGoals({ lifePlanId, suggestions, onComplete, onCancel }: RoadmapToGoalsProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedGoals, setSelectedGoals] = useState<Set<number>>(
    new Set(suggestions.map((_, i) => i).filter((i) => !suggestions[i].skipReason))
  );
  const [amounts, setAmounts] = useState<Record<number, string>>(
    suggestions.reduce((acc, g, i) => {
      if (g.targetAmount) {
        acc[i] = g.targetAmount.toString();
      }
      return acc;
    }, {} as Record<number, string>)
  );
  const [success, setSuccess] = useState(false);

  const financialGoals = suggestions.filter((g) => g.category === "financial");

  const toggleGoal = (index: number) => {
    const newSelected = new Set(selectedGoals);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedGoals(newSelected);
  };

  const updateAmount = (index: number, value: string) => {
    setAmounts((prev) => ({ ...prev, [index]: value }));
  };

  const handleCreate = () => {
    const goalsToCreate = Array.from(selectedGoals).map((i) => ({
      title: suggestions[i].title,
      description: suggestions[i].description,
      targetAmount: amounts[i] ? parseInt(amounts[i], 10) : 0,
      targetDate: suggestions[i].targetDate.toISOString(),
    }));

    startTransition(async () => {
      await createGoalsFromRoadmap(goalsToCreate);
      setSuccess(true);
      setTimeout(() => onComplete(), 1500);
    });
  };

  if (success) {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold">Goals created!</h2>
          <p className="text-sm text-muted-foreground">
            {selectedGoals.size} goal{selectedGoals.size !== 1 ? "s" : ""} added to your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Turn your roadmap into goals</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          We found {financialGoals.length} item{financialGoals.length !== 1 ? "s" : ""} that can be tracked as goals.
          Review and adjust the amounts, then create your goals.
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4">
        {financialGoals.map((suggestion, index) => {
          const originalIndex = suggestions.indexOf(suggestion);
          const isSelected = selectedGoals.has(originalIndex);

          return (
            <div
              key={originalIndex}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                isSelected ? "bg-secondary/50 border-primary/20" : "bg-background border-border"
              )}
            >
              <Checkbox
                id={`goal-${originalIndex}`}
                checked={isSelected}
                onClick={() => toggleGoal(originalIndex)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`goal-${originalIndex}`}
                  className="text-sm font-medium cursor-pointer block"
                >
                  {suggestion.title}
                </label>
                <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={amounts[originalIndex] ?? ""}
                    onChange={(e) => updateAmount(originalIndex, e.target.value)}
                    placeholder="0"
                    className="h-7 w-32 text-sm"
                    disabled={!isSelected}
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {suggestion.targetDate.toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isPending || selectedGoals.size === 0}>
          {isPending ? "Creating..." : `Create ${selectedGoals.size} goal${selectedGoals.size !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
