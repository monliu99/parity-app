"use client";

import { useState } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { VisionTab } from "./vision-tab";
import { PrioritiesTab } from "./priorities-tab";
import { InsightsTab } from "./insights-tab";

type TabId = "vision" | "priorities" | "insights";

interface Snapshot {
  alignmentScore: number | null;
  signals: unknown;
  createdAt: Date;
}

interface LifePlanTabsProps {
  lifePlan: LifePlan;
  snapshot: Snapshot | null;
  onRerunWizard: () => void;
}

export function LifePlanTabs({ lifePlan, snapshot, onRerunWizard }: LifePlanTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("vision");

  const tabs: { id: TabId; label: string }[] = [
    { id: "vision", label: "Vision" },
    { id: "priorities", label: "Priorities" },
    { id: "insights", label: "Insights" },
  ];

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "vision" && (
        <VisionTab lifePlan={lifePlan} onRerunWizard={onRerunWizard} />
      )}
      {activeTab === "priorities" && <PrioritiesTab lifePlan={lifePlan} />}
      {activeTab === "insights" && (
        <InsightsTab
          snapshot={snapshot}
          lastReviewedAt={lifePlan.lastReviewedAt ?? null}
        />
      )}
    </div>
  );
}
