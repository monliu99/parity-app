"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/format-month";

interface RoadmapItem {
  month: number;
  title: string;
  description: string;
  category: string;
}

interface RoadmapPreviewProps {
  roadmap: RoadmapItem[];
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function RoadmapPreview({ roadmap, onBack, onNext, isLoading }: RoadmapPreviewProps) {
  const immediate = roadmap.filter((r) => r.month <= 1);
  const shortTerm = roadmap.filter((r) => r.month > 1 && r.month <= 6);
  const midTerm = roadmap.filter((r) => r.month > 6);

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
    items: RoadmapItem[];
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

  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Here's your 12-month action plan:</p>
          <p className="text-xs text-muted-foreground">
            {roadmap.length >= 6
              ? "This is tailored to your situation — not a generic template."
              : "We've created a starter roadmap for you. You can customize this as you go."}
          </p>
          <p className="text-xs text-muted-foreground italic">
            Next, you'll be able to review and edit anything before saving.
          </p>
        </div>

        <div className="space-y-6">
          <RoadmapSection title={`IMMEDIATE (${formatMonth(1)})`} items={immediate} />
          <RoadmapSection title={`SHORT-TERM (${formatMonth(3)} – ${formatMonth(6)})`} items={shortTerm} />
          <RoadmapSection title={`MID-TERM (${formatMonth(7)} – ${formatMonth(12)})`} items={midTerm} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button onClick={onNext} disabled={isLoading} size="sm" className="gap-1">
            {isLoading ? "Loading..." : "Review & edit"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
