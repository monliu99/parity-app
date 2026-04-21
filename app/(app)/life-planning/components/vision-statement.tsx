"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Edit } from "lucide-react";

interface VisionStatementProps {
  vision: string;
  onEdit: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function VisionStatement({ vision, onEdit, onNext, isLoading }: VisionStatementProps) {
  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Here's your shared vision:</p>
          <div className="bg-secondary/50 rounded-lg p-4">
            <p className="text-sm leading-relaxed">{vision || "Generating your vision…"}</p>
          </div>
          {vision && (
            <p className="text-xs text-muted-foreground">
              This is just a starting point. You can adjust it as you grow together.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="gap-1"
            disabled={!vision}
          >
            <Edit className="h-4 w-4" />
            Edit answers
          </Button>

          <Button
            onClick={onNext}
            disabled={!vision || isLoading}
            size="sm"
            className="gap-1"
          >
            {isLoading ? "Thinking..." : "Continue"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
