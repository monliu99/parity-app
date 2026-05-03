import { getExistingLifePlan, getLatestSnapshot } from "./actions";
import { LifePlanningFlow } from "./components/life-planning-flow";
import { LifePlanPageView } from "./components/life-plan-page-view";

export default async function LifePlanningPage() {
  const [{ lifePlan }, { snapshot }] = await Promise.all([
    getExistingLifePlan(),
    getLatestSnapshot(),
  ]);

  if (!lifePlan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Design Your Shared Life</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Before we talk numbers, let's design the life you want together.
          </p>
        </div>
        <LifePlanningFlow existingLifePlan={null} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Shared Life Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vision, priorities, and plan-vs-reality insights.
        </p>
      </div>
      <LifePlanPageView lifePlan={lifePlan} snapshot={snapshot} />
    </div>
  );
}
