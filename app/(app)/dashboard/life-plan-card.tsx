"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import Link from "next/link";

interface RoadmapAction {
  month?: string;
  action?: string;
  title?: string;
  description?: string;
}

interface LifePlanCardProps {
  visionStatement: string | null;
  roadmap: unknown;
  currentMonth: string;
}

function getCurrentMonthAction(roadmap: unknown, currentMonth: string): RoadmapAction | null {
  if (!roadmap || !Array.isArray(roadmap)) return null;
  return (
    roadmap.find(
      (item: any) =>
        item.month === currentMonth ||
        item.title?.toLowerCase().includes(currentMonth.toLowerCase())
    ) ?? null
  );
}

export function LifePlanCard({ visionStatement, roadmap, currentMonth }: LifePlanCardProps) {
  const [expanded, setExpanded] = useState(true);
  const action = getCurrentMonthAction(roadmap, currentMonth);

  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 pt-5 pb-4 flex items-start justify-between gap-3 text-left cursor-pointer"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Your Shared Vision
              </p>
            </div>
            {visionStatement ? (
              <p className="text-sm text-foreground leading-relaxed">{visionStatement}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Create your shared vision together.</p>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          )}
        </button>

        {expanded && action && (
          <div className="px-5 pb-4 border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground mb-1">This month&apos;s focus</p>
            <p className="text-sm font-medium">
              {action.action || action.title || action.description}
            </p>
          </div>
        )}

        {expanded && !visionStatement && (
          <div className="px-5 pb-4 border-t border-border/50 pt-3">
            <Link href="/life-planning" className="text-xs text-primary hover:underline">
              Start your life plan →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
