"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitFeedback } from "@/lib/feedback/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// --- Question types ---

type TextQuestion = {
  type: "text";
  question: string;
  placeholder?: string;
};

type YesNoQuestion = {
  type: "yesno";
  question: string;
  elaboratePrompt: string;
};

type Question = TextQuestion | YesNoQuestion;

// --- Emoji rating ---

const EMOJI_OPTIONS = [
  { value: 3, emoji: "😄", label: "Great" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 1, emoji: "😔", label: "Bad" },
];

// --- Per-page Q1 (Q2 is always the couple-gap question below) ---

const COUPLE_GAP_QUESTION: TextQuestion = {
  type: "text",
  question: "What would make this more useful for you and your partner?",
  placeholder: "Features, information, or ways it could fit your life together…",
};

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/accounts": "Accounts",
  "/transactions": "Transactions",
  "/budget": "Budget",
  "/goals": "Goals",
  "/chat": "Ask Parity",
  "/settings": "Settings",
};

const PAGE_Q1: Record<string, Question> = {
  "/dashboard": {
    type: "yesno",
    question: "Did the AI insight help you see something new about your finances?",
    elaboratePrompt: "Tell us what it showed you — or what it missed.",
  },
  "/accounts": {
    type: "text",
    question: "What account information are you missing to feel on top of things together?",
    placeholder: "Balances, history, a missing account type…",
  },
  "/transactions": {
    type: "text",
    question: "What are you trying to understand about your spending that this page doesn't show?",
    placeholder: "A view, filter, or pattern you wished existed…",
  },
  "/budget": {
    type: "yesno",
    question: "Are the AI-suggested budget amounts close to what you'd actually set?",
    elaboratePrompt: "Tell us why — what should it know about your spending habits?",
  },
  "/goals": {
    type: "text",
    question: "What goals or milestones are you tracking that Parity doesn't support yet?",
    placeholder: "A goal type, timeline, or tracking feature you need…",
  },
  "/chat": {
    type: "yesno",
    question: "Did Parity answer the question you came here to ask?",
    elaboratePrompt: "What did you ask, and what would a great answer look like?",
  },
  "/settings": {
    type: "text",
    question: "What settings or partnership features are you missing?",
    placeholder: "Notifications, sharing controls, account linking…",
  },
};

const DEFAULT_Q1: Question = {
  type: "text",
  question: "What are you trying to do here that isn't working?",
  placeholder: "Describe what you were looking for or trying to accomplish…",
};

function getQuestions(pathname: string): Question[] {
  const q1 = PAGE_Q1[pathname] ?? DEFAULT_Q1;
  return [q1, COUPLE_GAP_QUESTION];
}

// --- Format answers for storage ---

function formatAnswers(
  questions: Question[],
  yesNoSelections: Record<number, boolean | null>,
  elaborations: string[]
): string {
  return questions
    .map((q, i) => {
      if (q.type === "yesno") {
        const selected = yesNoSelections[i];
        if (selected === null || selected === undefined) return null;
        const label = selected ? "Yes" : "No";
        const detail = elaborations[i]?.trim();
        return `${q.question}\n${label}${detail ? ` — ${detail}` : ""}`;
      } else {
        const answer = elaborations[i]?.trim();
        if (!answer) return null;
        return `${q.question}\n${answer}`;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

// --- Widget ---

export function FeedbackWidget() {
  const pathname = usePathname();
  const questions = useMemo(() => getQuestions(pathname), [pathname]);
  const pageName = PAGE_NAMES[pathname] ?? "this page";

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [yesNoSelections, setYesNoSelections] = useState<Record<number, boolean | null>>({});
  const [elaborations, setElaborations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  function reset() {
    setRating(0);
    setYesNoSelections({});
    setElaborations([]);
    setError("");
    setDone(false);
    setLoading(false);
  }

  function setElaboration(i: number, value: string) {
    setElaborations((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function selectYesNo(i: number, value: boolean) {
    setYesNoSelections((prev) => ({ ...prev, [i]: value }));
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError("Please select how Parity is working for you");
      return;
    }
    setLoading(true);
    setError("");

    const comment = formatAnswers(questions, yesNoSelections, elaborations);

    const result = await submitFeedback({
      rating,
      comment: comment || undefined,
      page: pathname,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => {
      setOpen(false);
      setTimeout(reset, 300);
    }, 1500);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(reset, 300);
      }}
    >
      <DialogTrigger
        render={
          <button className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg text-sm font-medium hover:bg-primary/90 transition-colors" />
        }
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        Feedback
      </DialogTrigger>

      <DialogContent showCloseButton={!done} className="sm:max-w-md">
        {done ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Thanks — we&apos;ll take a look! 🙏
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>How&apos;s {pageName} working for you?</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-5 py-2">
              {/* Emoji rating */}
              <div className="flex gap-3 justify-center">
                {EMOJI_OPTIONS.map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={cn(
                      "flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border transition-colors focus:outline-none",
                      rating === value
                        ? "border-primary bg-primary/8"
                        : "border-border hover:border-primary/50 hover:bg-secondary"
                    )}
                  >
                    <span className="text-2xl leading-none">{emoji}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Questions */}
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{q.question}</p>

                  {q.type === "yesno" ? (
                    <>
                      <div className="flex gap-2">
                        {[true, false].map((val) => (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() => selectYesNo(i, val)}
                            className={cn(
                              "flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors focus:outline-none",
                              yesNoSelections[i] === val
                                ? "border-primary bg-primary/8 text-foreground"
                                : "border-border hover:border-primary/50 hover:bg-secondary text-muted-foreground"
                            )}
                          >
                            {val ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                      {yesNoSelections[i] !== undefined && yesNoSelections[i] !== null && (
                        <textarea
                          value={elaborations[i] ?? ""}
                          onChange={(e) => setElaboration(i, e.target.value)}
                          placeholder={q.elaboratePrompt}
                          rows={2}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                      )}
                    </>
                  ) : (
                    <textarea
                      value={elaborations[i] ?? ""}
                      onChange={(e) => setElaboration(i, e.target.value)}
                      placeholder={q.placeholder ?? "Share your thoughts…"}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  )}
                </div>
              ))}

              {error && <p className="text-xs text-amber-600">{error}</p>}
            </div>

            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? "Sending…" : "Send feedback"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
