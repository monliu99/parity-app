"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LifePlan } from "@/app/generated/prisma/client";
import { LifePlanTabs } from "./life-plan-tabs";
import { LifePlanningFlow } from "./life-planning-flow";

interface Snapshot {
  alignmentScore: number | null;
  signals: unknown;
  createdAt: Date;
}

interface LifePlanPageViewProps {
  lifePlan: LifePlan;
  snapshot: Snapshot | null;
}

export function LifePlanPageView({ lifePlan, snapshot }: LifePlanPageViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"tabs" | "wizard">("tabs");

  if (view === "wizard") {
    return (
      <LifePlanningFlow
        existingLifePlan={lifePlan}
        forceIntro
        onComplete={() => {
          setView("tabs");
          router.refresh();
        }}
      />
    );
  }

  return (
    <LifePlanTabs
      lifePlan={lifePlan}
      snapshot={snapshot}
      onRerunWizard={() => setView("wizard")}
    />
  );
}