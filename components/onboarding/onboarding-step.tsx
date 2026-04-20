"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OnboardingStepProps {
  step: number;
  total: number;
  title: string;
  description: string;
  actionLabel: string;
  skipable: boolean;
  onComplete: () => void;
  onSkip: () => void;
  action: React.ReactNode;
}

export function OnboardingStep({
  step,
  total,
  title,
  description,
  actionLabel,
  skipable,
  onComplete,
  onSkip,
  action,
}: OnboardingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
      <Card className="shadow-card w-full">
        <CardContent className="pt-8 pb-6 space-y-6">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Step {step} of {total}
              </span>
              <span className="text-muted-foreground">
                {Math.round((step / total) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-500"
                style={{ width: `${(step / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="space-y-3 text-center">
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            {action}
          </div>

          {/* Skip button */}
          {skipable && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
