"use client";

import { useState, useTransition } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, Map, Plus, AlertTriangle } from "lucide-react";
import { RoadmapToGoals } from "./roadmap-to-goals";
import { suggestGoalsFromRoadmap, deleteLifePlan } from "../actions";

interface SavedLifePlanProps {
  lifePlan: LifePlan;
  onStartOver: () => void;
}

type ViewMode = "plan" | "create-goals" | "confirm-reset";

export function SavedLifePlan({ lifePlan, onStartOver }: SavedLifePlanProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const prioritiesData = lifePlan.priorities as
    | { priorities: Array<{ rank: number; area: string; description: string }> }
    | undefined;
  const roadmap = lifePlan.roadmap as
    | Array<{ month: number; title: string; description: string; category: string }>
    | undefined;

  const handleCreateGoals = () => {
    startTransition(async () => {
      const result = await suggestGoalsFromRoadmap(lifePlan.id);
      setSuggestions(result.suggestions);
      setViewMode("create-goals");
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "financial":
        return "text-emerald-600";
      case "experience":
        return "text-blue-600";
      case "logistical":
        return "text-amber-600";
      default:
        return "text-muted-foreground";
    }
  };

  const RoadmapSection = ({
    title,
    items,
  }: {
    title: string;
    items: Array<{ month: number; title: string; description: string; category: string }>;
  }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${getCategoryColor(item.category)}`}>
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!roadmap || roadmap.length === 0) {
    return null;
  }

  // Show create goals flow
  if (viewMode === "create-goals") {
    return (
      <RoadmapToGoals
        lifePlanId={lifePlan.id}
        suggestions={suggestions}
        onComplete={() => setViewMode("plan")}
        onCancel={() => setViewMode("plan")}
      />
    );
  }

  // Show confirmation dialog for reset
  if (viewMode === "confirm-reset") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold">Reset your life plan?</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently delete your current vision, priorities, and roadmap. You'll start fresh from the beginning.
              </p>
              <p className="text-xs text-muted-foreground">
                You can always create a new plan, but you won't be able to recover this one.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setViewMode("plan")}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                startTransition(async () => {
                  await deleteLifePlan(lifePlan.id);
                  onStartOver();
                });
              }}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Yes, delete it"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const immediate = roadmap.filter((r) => r.month <= 1);
  const shortTerm = roadmap.filter((r) => r.month > 1 && r.month <= 6);
  const midTerm = roadmap.filter((r) => r.month > 6);

  // Count financial items that could be goals
  const financialItemCount = roadmap.filter((r) => r.category === "financial").length;

  return (
    <div className="max-w-xl space-y-6">
      {/* Vision Statement */}
      <div className="bg-card border rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Your Shared Vision</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lifePlan.visionStatement}
        </p>
        <p className="text-xs text-muted-foreground">
          Created {new Date(lifePlan.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Priorities */}
      {prioritiesData?.priorities && prioritiesData.priorities.length > 0 && (
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Your Priorities</h2>
          </div>
          <div className="space-y-2">
            {prioritiesData.priorities.map((priority) => (
              <div key={priority.area} className="flex items-start gap-3">
                <span className="text-xs font-bold text-muted-foreground w-6 mt-0.5">
                  {priority.rank}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{priority.area}</p>
                  <p className="text-xs text-muted-foreground">{priority.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roadmap - same format as preview */}
      <div className="bg-card border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Your 12-Month Roadmap</h2>
        </div>

        <div className="space-y-6">
          <RoadmapSection title="IMMEDIATE (this month)" items={immediate} />
          <RoadmapSection title="SHORT-TERM (3-6 months)" items={shortTerm} />
          <RoadmapSection title="MID-TERM (6-12 months)" items={midTerm} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <Button
          variant="outline"
          onClick={handleCreateGoals}
          disabled={isPending}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          {isPending ? "Loading..." : "Create goals from roadmap"}
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setViewMode("confirm-reset")}>
            Reset Plan
          </Button>
          <Button onClick={() => (window.location.href = "/goals")}>
            See Your Goals
          </Button>
        </div>
      </div>
    </div>
  );
}
