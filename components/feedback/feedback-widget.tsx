"use client";

import { useState } from "react";
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

// --- Q1: Unified value question ---
const Q1_OPTIONS = [
  { value: 3, label: "Yes" },
  { value: 2, label: "Not sure" },
  { value: 1, label: "No" },
];

// --- Q2: Action taken question ---
const Q2_OPTIONS = [
  "Just looked",
  "Discussed with my partner",
  "Made a change to our finances",
  "Want to act but need more guidance",
];

// --- Format answers for storage ---
function formatAnswers(
  q1Selection: number | null,
  q2Selection: string | null,
  q3Text: string
): string {
  const parts: string[] = [];

  const q1Label = Q1_OPTIONS.find((o) => o.value === q1Selection)?.label;
  if (q1Label) {
    parts.push(`Did this help you notice something new or have a conversation? ${q1Label}`);
  }

  if (q2Selection) {
    parts.push(`What did you do? ${q2Selection}`);
  }

  if (q3Text.trim()) {
    parts.push(`\nTell us more:\n${q3Text.trim()}`);
  }

  return parts.join("\n\n");
}

// --- Widget ---
export function FeedbackWidget() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [q1Selection, setQ1Selection] = useState<number | null>(null);
  const [q2Selection, setQ2Selection] = useState<string | null>(null);
  const [q3Text, setQ3Text] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  function reset() {
    setQ1Selection(null);
    setQ2Selection(null);
    setQ3Text("");
    setError("");
    setDone(false);
    setLoading(false);
  }

  async function handleSubmit() {
    if (q1Selection === null) {
      setError("Please answer the first question");
      return;
    }
    if (q2Selection === null) {
      setError("Please answer the second question");
      return;
    }

    setLoading(true);
    setError("");

    const comment = formatAnswers(q1Selection, q2Selection, q3Text);

    const result = await submitFeedback({
      rating: q1Selection,
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
              <DialogTitle>Feedback</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-5 py-2">
              {/* Q1: Unified value */}
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Did seeing this together help you notice something new or have a conversation you wouldn&apos;t have had otherwise?
                </p>
                <div className="flex gap-2">
                  {Q1_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setQ1Selection(value)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors focus:outline-none",
                        q1Selection === value
                          ? "border-primary bg-primary/8 text-foreground"
                          : "border-border hover:border-primary/50 hover:bg-secondary text-muted-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: Action taken */}
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  What did you do (or want to do) after seeing this?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Q2_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setQ2Selection(option)}
                      className={cn(
                        "py-1.5 px-3 rounded-lg border text-sm font-medium transition-colors focus:outline-none text-left",
                        q2Selection === option
                          ? "border-primary bg-primary/8 text-foreground"
                          : "border-border hover:border-primary/50 hover:bg-secondary text-muted-foreground"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3: Optional elaboration */}
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Tell us more about what happened (or what would have helped)
                  <span className="text-muted-foreground font-normal"> (optional)</span>
                </p>
                <textarea
                  value={q3Text}
                  onChange={(e) => setQ3Text(e.target.value)}
                  placeholder="Share any additional thoughts…"
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {error && <p className="text-xs text-amber-700">{error}</p>}
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
