/**
 * Onboarding utilities
 *
 * Detects onboarding state for a partnership to determine if
 * new users should see the guided setup flow.
 *
 * NOTE: All functions in this file are server-side only.
 * Do not import from client components.
 */

export interface OnboardingState {
  isEmpty: boolean;
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasGoals: boolean;
  currentStep: number;
}

/**
 * Check if a partnership should see the onboarding flow.
 * Returns true if all three are missing (accounts, transactions, goals).
 *
 * @param accountCount - Number of accounts
 * @param transactionCount - Number of transactions
 * @param goalCount - Number of goals
 */
export function shouldShowOnboarding(
  accountCount: number,
  transactionCount: number,
  goalCount: number
): boolean {
  return accountCount === 0 && transactionCount === 0 && goalCount === 0;
}

/**
 * Get the current onboarding step based on what exists.
 *
 * @param accountCount - Number of accounts
 * @param transactionCount - Number of transactions
 * @param goalCount - Number of goals
 */
export function getCurrentOnboardingStep(
  accountCount: number,
  transactionCount: number,
  goalCount: number
): number {
  if (accountCount === 0) return 1;
  if (transactionCount === 0) return 2;
  if (goalCount === 0) return 3;
  return 0; // Complete
}

/**
 * Get the total number of steps in onboarding.
 */
export const TOTAL_ONBOARDING_STEPS = 3;

/**
 * Step metadata for rendering onboarding UI.
 * Safe to import in client components.
 */
export const ONBOARDING_STEPS = [
  {
    step: 1,
    title: "Add your first account",
    description:
      "Track your checking, savings, and credit cards together in one place.",
    actionLabel: "Add Account",
    skipable: false, // Accounts are foundational
  },
  {
    step: 2,
    title: "Record your first transaction",
    description:
      "Start tracking your spending. AI will categorize it automatically.",
    actionLabel: "Add Transaction",
    skipable: true,
  },
  {
    step: 3,
    title: "Set your first goal",
    description:
      "Working toward something? Create a goal to track your progress together.",
    actionLabel: "Set Goal",
    skipable: true,
  },
];
