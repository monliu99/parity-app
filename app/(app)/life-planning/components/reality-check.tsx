"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RealityCheckStepProps {
  realityCheck: string;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

export function RealityCheckStep({ realityCheck, onBack, onNext, isLoading }: RealityCheckStepProps) {
  const lines = realityCheck.split("\n").filter((line) => line.trim());

  return (
    <div className="max-w-xl">
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Let's ground this in reality:</p>

          {!realityCheck ? (
            <p className="text-sm">{isLoading ? "Analyzing…" : ""}</p>
          ) : (
            <div className="space-y-2">
              {lines.map((line, i) => {
                const isBullet = line.trimStart().startsWith("-") || line.trimStart().startsWith("•");
                const content = isBullet ? line.replace(/^\s*[-•]\s*/, "") : line;
                return (
                  <p key={i} className={`text-sm leading-relaxed ${isBullet ? "flex gap-2" : ""}`}>
                    {isBullet && <span className="text-muted-foreground flex-shrink-0">•</span>}
                    <span className={isBullet ? "text-muted-foreground" : ""}>
                      {renderInlineMarkdown(content)}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {realityCheck && (
            <p className="text-xs text-muted-foreground">
              No judgment — just clarity on what's possible.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button onClick={onNext} disabled={!realityCheck || isLoading} size="sm" className="gap-1">
            {isLoading ? "Thinking..." : "Continue"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
