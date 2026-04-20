-- Migration: Add GoalAllocation table for custom split percentages on joint goals
-- Run this in Neon console SQL editor

CREATE TABLE "GoalAllocation" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,

    CONSTRAINT "GoalAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoalAllocation_goalId_userId_key" ON "GoalAllocation"("goalId", "userId");
CREATE INDEX "GoalAllocation_goalId_idx" ON "GoalAllocation"("goalId");
CREATE INDEX "GoalAllocation_userId_idx" ON "GoalAllocation"("userId");

ALTER TABLE "GoalAllocation" ADD CONSTRAINT "GoalAllocation_goalId_fkey" FOREIGN KEY("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalAllocation" ADD CONSTRAINT "GoalAllocation_userId_fkey" FOREIGN KEY("userId") REFERENCES "User"("id") ON UPDATE CASCADE;
