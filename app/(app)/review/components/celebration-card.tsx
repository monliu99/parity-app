"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface CelebrationCardProps {
  celebration: string;
  onNext: () => void;
}

export function CelebrationCard({ celebration, onNext }: CelebrationCardProps) {
  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <p className="text-3xl text-center">🎉</p>
        <p className="text-sm text-muted-foreground text-center">First, let's celebrate:</p>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4">
          <p className="text-sm text-center font-medium text-emerald-800 dark:text-emerald-300">
            {celebration}
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={onNext} className="gap-1">
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
