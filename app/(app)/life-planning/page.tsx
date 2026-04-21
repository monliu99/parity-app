import { getExistingLifePlan } from "./actions";
import { LifePlanningFlow } from "./components/life-planning-flow";

export default async function LifePlanningPage() {
  const { lifePlan } = await getExistingLifePlan();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Design Your Shared Life</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Before we talk numbers, let's design the life you want together.
        </p>
      </div>

      <LifePlanningFlow existingLifePlan={lifePlan} />
    </div>
  );
}
