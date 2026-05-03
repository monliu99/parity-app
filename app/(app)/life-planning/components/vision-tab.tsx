"use client";

import { useState, useTransition } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import type { RealityCheckCard } from "@/lib/ai/life-planning";
import { updateVisionStatement } from "../actions";

interface VisionTabProps {
  lifePlan: LifePlan;
  onRerunWizard: () => void;
}

export function VisionTab({ lifePlan, onRerunWizard }: VisionTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(lifePlan.visionStatement);
  const [currentVision, setCurrentVision] = useState(lifePlan.visionStatement);
  const [currentCards, setCurrentCards] = useState<RealityCheckCard[]>(
    (lifePlan.realityCheck as RealityCheckCard[] | null) ?? []
  );
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateVisionStatement(editValue);
      setCurrentVision(editValue);
      setCurrentCards([]);
      setIsEditing(false);
    });
  };

  return (
    <div className="space-y-6">
      {/* Vision statement — moss-green callout */}
      <div className="bg-[#f0f4ee] border border-[#c8d9c0] rounded-xl p-6 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Shared vision
        </p>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || !editValue.trim()}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditValue(currentVision);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">{currentVision}</p>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Reality check cards */}
      {isPending && (
        <p className="text-xs text-muted-foreground">Refreshing reality check…</p>
      )}
      {!isPending && currentCards.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Reality check
          </p>
          {currentCards.map((card, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 flex items-start gap-3">
              {card.status === "on-track" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(lifePlan.updatedAt).toLocaleDateString()}
        </p>
        <Button variant="outline" size="sm" onClick={onRerunWizard} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Re-run wizard
        </Button>
      </div>
    </div>
  );
}
