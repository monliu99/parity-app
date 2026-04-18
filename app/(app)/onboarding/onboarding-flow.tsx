"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
} from "@/lib/onboarding";

interface OnboardingFlowProps {
  currentStep: number;
}

export function OnboardingFlow({ currentStep }: OnboardingFlowProps) {
  const [showComplete, setShowComplete] = useState(false);

  const stepInfo = ONBOARDING_STEPS.find((s) => s.step === currentStep);
  if (!stepInfo) return null;

  function handleSkip() {
    if (currentStep < TOTAL_ONBOARDING_STEPS) {
      // Navigate to dashboard to advance to next step
      window.location.href = "/dashboard";
    } else {
      setShowComplete(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    }
  }

  if (showComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
          <p className="text-muted-foreground">
            Welcome to Parity. You can always add more accounts, transactions, and
            goals from the sidebar.
          </p>
        </div>
      </div>
    );
  }

  // Step 1: Add first account
  if (currentStep === 1) {
    return (
      <OnboardingStepCard
        step={1}
        total={TOTAL_ONBOARDING_STEPS}
        title={stepInfo.title}
        description={stepInfo.description}
        actionLabel={stepInfo.actionLabel}
        skipable={stepInfo.skipable}
        onSkip={handleSkip}
        actionHref="/accounts"
      />
    );
  }

  // Step 2: Add first transaction
  if (currentStep === 2) {
    return (
      <OnboardingStepCard
        step={2}
        total={TOTAL_ONBOARDING_STEPS}
        title={stepInfo.title}
        description={stepInfo.description}
        actionLabel={stepInfo.actionLabel}
        skipable={stepInfo.skipable}
        onSkip={handleSkip}
        actionHref="/transactions"
      />
    );
  }

  // Step 3: Set first goal
  if (currentStep === 3) {
    return (
      <OnboardingStepCard
        step={3}
        total={TOTAL_ONBOARDING_STEPS}
        title={stepInfo.title}
        description={stepInfo.description}
        actionLabel={stepInfo.actionLabel}
        skipable={stepInfo.skipable}
        onSkip={handleSkip}
        actionHref="/goals"
      />
    );
  }

  return null;
}

interface OnboardingStepCardProps {
  step: number;
  total: number;
  title: string;
  description: string;
  actionLabel: string;
  skipable: boolean;
  onSkip: () => void;
  actionHref?: string;
  disabled?: boolean;
}

function OnboardingStepCard({
  step,
  total,
  title,
  description,
  actionLabel,
  skipable,
  onSkip,
  actionHref,
  disabled,
}: OnboardingStepCardProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
      <div className="shadow-card bg-background border rounded-lg p-8 w-full space-y-6">
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
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {/* Action button */}
        <div className="flex justify-center">
          <a
            href={actionHref}
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            {...(disabled && { "aria-disabled": true })}
          >
            {actionLabel}
          </a>
        </div>

        {/* Skip button */}
        {skipable && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
