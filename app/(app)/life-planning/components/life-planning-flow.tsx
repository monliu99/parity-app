"use client";

import { useState, useTransition } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import {
  getLifePlanQuestions,
  submitVisionAnswers,
  submitRealityCheck,
  submitPriorities,
  generateFinalRoadmap,
  saveLifePlan,
} from "../actions";
import { QuestionCard } from "./question-card";
import { VisionStatement } from "./vision-statement";
import { RealityCheckStep } from "./reality-check";
import { PriorityRanking } from "./priority-ranking";
import { RoadmapPreview } from "./roadmap-preview";
import { ReviewEditPlan } from "./review-edit-plan";
import { Button } from "@/components/ui/button";

type Step = "intro" | "questions" | "vision" | "reality" | "priorities" | "roadmap" | "review" | "complete";

interface LifePlanningFlowProps {
  existingLifePlan: LifePlan | null;
  forceIntro?: boolean;
  onComplete?: () => void;
}

export function LifePlanningFlow({
  existingLifePlan,
  forceIntro,
  onComplete,
}: LifePlanningFlowProps) {
  const [step, setStep] = useState<Step>("intro");
  const [isPending, startTransition] = useTransition();

  // State for each step
  const [questions, setQuestions] = useState<Array<{ question: string; followUps: string[] }>>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visionStatement, setVisionStatement] = useState("");
  const [realityCheckResult, setRealityCheckResult] = useState("");
  const [priorities, setPriorities] = useState<
    Array<{ rank: number; area: string; description: string }>
  >([]);
  const [conflicts, setConflicts] = useState<
    Array<{ area: string; tension: string; suggestedFrame: string }>
  >([]);
  const [roadmap, setRoadmap] = useState<
    Array<{ month: number; title: string; description: string; category: string }>
  >([]);

  if (step === "intro") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <p className="text-sm">
            Let's start with the fun stuff. In about 15 minutes, you'll design your shared life together
            for the next 3-5 years.
          </p>

          <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium">We're planning for a specific timeframe:</p>
            <p className="text-xs text-muted-foreground">3-5 years from now — where you'll live, whether kids are in the picture, what work looks like, and what brings you joy.</p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Here's what we'll cover:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your shared vision (5 minutes)</li>
              <li>A quick reality check (5 minutes)</li>
              <li>What matters most right now (3 minutes)</li>
              <li>Your 12-month action plan (2 minutes)</li>
            </ul>
          </div>

          <Button
            onClick={() => {
              startTransition(async () => {
                const result = await getLifePlanQuestions();
                setQuestions(result);
                setStep("questions");
              });
            }}
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Let's go"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "questions") {
    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return (
      <QuestionCard
        question={currentQuestion.question}
        answer={answers[currentQuestionIndex.toString()]}
        onAnswerChange={(value) =>
          setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: value }))
        }
        onNext={() => {
          if (isLastQuestion) {
            startTransition(async () => {
              const result = await submitVisionAnswers(answers);
              setVisionStatement(result.vision);
              setStep("vision");
            });
          } else {
            setCurrentQuestionIndex((prev) => prev + 1);
          }
        }}
        onBack={() => {
          if (currentQuestionIndex === 0) {
            setStep("intro");
          } else {
            setCurrentQuestionIndex((prev) => prev - 1);
          }
        }}
        progress={{ current: currentQuestionIndex + 1, total: questions.length }}
        isLast={isLastQuestion}
      />
    );
  }

  if (step === "vision") {
    return (
      <VisionStatement
        vision={visionStatement}
        onEdit={() => setStep("questions")}
        onNext={() => {
          startTransition(async () => {
            const result = await submitRealityCheck(answers);
            setRealityCheckResult(result.realityCheck);
            setStep("reality");
          });
        }}
        isLoading={isPending}
      />
    );
  }

  if (step === "reality") {
    return (
      <RealityCheckStep
        realityCheck={realityCheckResult}
        onBack={() => setStep("vision")}
        onNext={() => {
          startTransition(async () => {
            const result = await submitPriorities(visionStatement, realityCheckResult, answers);
            setPriorities(result.priorities);
            setConflicts(result.conflicts);
            setStep("priorities");
          });
        }}
        isLoading={isPending}
      />
    );
  }

  if (step === "priorities") {
    return (
      <PriorityRanking
        priorities={priorities}
        conflicts={conflicts}
        onBack={() => setStep("reality")}
        onNext={(reordered) => {
          setPriorities(reordered);
          startTransition(async () => {
            const result = await generateFinalRoadmap(visionStatement, reordered);
            setRoadmap(result.roadmap);
            setStep("roadmap");
          });
        }}
        isLoading={isPending}
      />
    );
  }

  if (step === "roadmap") {
    return (
      <RoadmapPreview
        roadmap={roadmap}
        onBack={() => setStep("priorities")}
        onNext={() => setStep("review")}
        isLoading={isPending}
      />
    );
  }

  if (step === "review") {
    return (
      <ReviewEditPlan
        visionStatement={visionStatement}
        priorities={priorities}
        roadmap={roadmap}
        onBack={() => setStep("roadmap")}
        onSave={(editedData) => {
          startTransition(async () => {
            await saveLifePlan({
              visionStatement: editedData.vision,
              roadmap: editedData.roadmap,
              priorities: { priorities: editedData.priorities, conflicts },
              visionAnswers: answers,
              lifePlanId: existingLifePlan?.id,
            });
            if (onComplete) {
              onComplete();
            } else {
              window.location.href = "/life-planning";
            }
          });
        }}
        isLoading={isPending}
      />
    );
  }

  if (step === "complete") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-8 text-center space-y-4">
          <p className="text-3xl">🎉</p>
          <h2 className="text-xl font-semibold">You've got a plan!</h2>
          <p className="text-sm text-muted-foreground">
            Your shared vision is saved. You can update it anytime from the Life Planning page.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Button variant="outline" onClick={() => setStep("intro")}>
              Start Over
            </Button>
            <Button onClick={() => (window.location.href = "/goals")}>
              See Your Goals
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
