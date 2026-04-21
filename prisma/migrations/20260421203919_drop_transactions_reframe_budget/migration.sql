/*
  Warnings:

  - You are about to drop the `Budget` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_partnershipId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_accountId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_partnershipId_fkey";

-- DropTable
DROP TABLE "Budget";

-- DropTable
DROP TABLE "Transaction";

-- CreateTable
CREATE TABLE "GoalContribution" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalAllocation" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,

    CONSTRAINT "GoalAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetFixed" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetFixed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetVariable" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnershipId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "page" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifePlan" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "visionStatement" TEXT NOT NULL,
    "roadmap" JSONB NOT NULL,
    "priorities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "outcome" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionHistory" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "previousOutcome" TEXT,
    "newOutcome" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHistory" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" TEXT NOT NULL,
    "insight" TEXT,
    "decisionsCreated" INTEGER NOT NULL DEFAULT 0,
    "mood" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReviewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoalContribution_goalId_idx" ON "GoalContribution"("goalId");

-- CreateIndex
CREATE INDEX "GoalContribution_userId_idx" ON "GoalContribution"("userId");

-- CreateIndex
CREATE INDEX "GoalAllocation_goalId_idx" ON "GoalAllocation"("goalId");

-- CreateIndex
CREATE INDEX "GoalAllocation_userId_idx" ON "GoalAllocation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalAllocation_goalId_userId_key" ON "GoalAllocation"("goalId", "userId");

-- CreateIndex
CREATE INDEX "BudgetFixed_partnershipId_idx" ON "BudgetFixed"("partnershipId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetFixed_partnershipId_category_key" ON "BudgetFixed"("partnershipId", "category");

-- CreateIndex
CREATE INDEX "BudgetVariable_partnershipId_idx" ON "BudgetVariable"("partnershipId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVariable_partnershipId_userId_category_key" ON "BudgetVariable"("partnershipId", "userId", "category");

-- CreateIndex
CREATE INDEX "Feedback_page_createdAt_idx" ON "Feedback"("page", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "LifePlan_partnershipId_idx" ON "LifePlan"("partnershipId");

-- CreateIndex
CREATE INDEX "Decision_partnershipId_idx" ON "Decision"("partnershipId");

-- CreateIndex
CREATE INDEX "Decision_createdAt_idx" ON "Decision"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionHistory_decisionId_idx" ON "DecisionHistory"("decisionId");

-- CreateIndex
CREATE INDEX "ReviewHistory_partnershipId_idx" ON "ReviewHistory"("partnershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHistory_partnershipId_month_key" ON "ReviewHistory"("partnershipId", "month");

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAllocation" ADD CONSTRAINT "GoalAllocation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAllocation" ADD CONSTRAINT "GoalAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetFixed" ADD CONSTRAINT "BudgetFixed_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetVariable" ADD CONSTRAINT "BudgetVariable_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetVariable" ADD CONSTRAINT "BudgetVariable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifePlan" ADD CONSTRAINT "LifePlan_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHistory" ADD CONSTRAINT "DecisionHistory_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHistory" ADD CONSTRAINT "ReviewHistory_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
