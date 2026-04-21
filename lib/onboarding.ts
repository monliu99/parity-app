export interface OnboardingState {
  isEmpty: boolean;
  hasAccounts: boolean;
  hasLifePlan: boolean;
  hasGoals: boolean;
  currentStep: number;
}

export function getCurrentOnboardingStep(
  accountCount: number,
  lifePlanCount: number,
  goalCount: number,
  memberCount: number = 1
): number {
  if (accountCount === 0) return 1;
  if (lifePlanCount === 0) return 2;
  if (goalCount === 0) return 3;
  if (memberCount < 2) return 4;
  return 0;
}

export const TOTAL_ONBOARDING_STEPS = 4;

export const ONBOARDING_STEPS = [
  {
    step: 1,
    title: "Add your first account",
    description:
      "Track your checking, savings, and investments together in one place.",
    actionLabel: "Add Account",
    skipable: false,
  },
  {
    step: 2,
    title: "Start your life plan",
    description:
      "Design your shared future together. What does your ideal life look like?",
    actionLabel: "Start Life Plan",
    skipable: true,
  },
  {
    step: 3,
    title: "Set a shared goal",
    description:
      "Working toward something together? Create a goal to track your progress.",
    actionLabel: "Set Goal",
    skipable: true,
  },
  {
    step: 4,
    title: "Invite your partner",
    description:
      "Parity works best together. Share your invite link so your partner can join.",
    actionLabel: "Copy invite link",
    skipable: true,
  },
];
