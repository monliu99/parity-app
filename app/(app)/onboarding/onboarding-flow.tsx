"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
} from "@/lib/onboarding";

interface OnboardingFlowProps {
  currentStep: number;
  inviteCode: string;
  partnershipId: string;
  children: React.ReactNode; // regular dashboard content shown when onboarding is done
}

export function OnboardingFlow({
  currentStep,
  inviteCode,
  partnershipId,
  children,
}: OnboardingFlowProps) {
  const storageKey = `parity_onboarding_${partnershipId}`;

  // displayedStep can be ahead of currentStep when user skips
  const [displayedStep, setDisplayedStep] = useState(currentStep);
  const [copied, setCopied] = useState(false);

  // On mount, restore any skipped-ahead state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const savedStep = parseInt(saved, 10);
      setDisplayedStep((prev) => Math.max(prev, savedStep));
    }
  }, [storageKey]);

  // If server advances (user completed a step elsewhere), always honour it
  useEffect(() => {
    setDisplayedStep((prev) => Math.max(prev, currentStep));
  }, [currentStep]);

  function handleSkip() {
    const next = displayedStep + 1;
    setDisplayedStep(next);
    localStorage.setItem(storageKey, String(next));
  }

  function handleCopyInvite() {
    const link = `${window.location.origin}/signup?invite=${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        handleSkip(); // advance past step 4 after copying
      }, 1500);
    });
  }

  // Onboarding complete (all data exists + partner joined) or user dismissed all steps
  if (currentStep === 0 || displayedStep > TOTAL_ONBOARDING_STEPS) {
    return <>{children}</>;
  }

  const stepInfo = ONBOARDING_STEPS.find((s) => s.step === displayedStep);
  if (!stepInfo) return <>{children}</>;

  if (displayedStep === 1) {
    return (
      <OnboardingStepCard
        step={1}
        total={TOTAL_ONBOARDING_STEPS}
        title={stepInfo.title}
        description={stepInfo.description}
        actionLabel={stepInfo.actionLabel}
        skipable={false}
        onSkip={handleSkip}
        actionHref="/settings/accounts"
      />
    );
  }

  if (displayedStep === 2) {
    return (
      <OnboardingStepCard
        step={2}
        total={TOTAL_ONBOARDING_STEPS}
        title={stepInfo.title}
        description={stepInfo.description}
        actionLabel={stepInfo.actionLabel}
        skipable={stepInfo.skipable}
        onSkip={handleSkip}
        actionHref="/life-planning"
      />
    );
  }

  if (displayedStep === 3) {
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

  if (displayedStep === 4) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
        <div className="shadow-card bg-background border rounded-lg p-8 w-full space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Step 4 of {TOTAL_ONBOARDING_STEPS}
              </span>
              <span className="text-muted-foreground">100%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-foreground w-full transition-all duration-500" />
            </div>
          </div>

          <div className="space-y-3 text-center">
            <h2 className="text-sm font-bold">Invite your partner</h2>
            <p className="text-muted-foreground">
              Parity works best together. Share your invite link so your
              partner can join.
            </p>
          </div>

          <div className="bg-secondary rounded-lg px-6 py-4 text-center">
            <p className="text-xs uppercase tracking-widest font-medium text-muted-foreground mb-2">
              Your invite code
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-widest text-foreground">
              {inviteCode}
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={handleCopyInvite} className="gap-2">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy invite link
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Send via iMessage, WhatsApp, or any messaging app
          </p>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              I&apos;ll invite them later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ── Step card ────────────────────────────────────────────────────────────────

interface OnboardingStepCardProps {
  step: number;
  total: number;
  title: string;
  description: string;
  actionLabel: string;
  skipable: boolean;
  onSkip: () => void;
  actionHref: string;
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
}: OnboardingStepCardProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
      <div className="shadow-card bg-background border rounded-lg p-8 w-full space-y-6">
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

        <div className="space-y-3 text-center">
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="flex justify-center">
          <a
            href={actionHref}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2"
          >
            {actionLabel}
          </a>
        </div>

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
