-- AlterTable
ALTER TABLE "LifePlan" ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "realityCheck" JSONB,
ADD COLUMN     "visionAnswers" JSONB;

-- CreateTable
CREATE TABLE "LifePlanSnapshot" (
    "id" TEXT NOT NULL,
    "lifePlanId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "alignmentScore" INTEGER,
    "signals" JSONB NOT NULL,
    "priorities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifePlanSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LifePlanSnapshot_lifePlanId_month_key" ON "LifePlanSnapshot"("lifePlanId", "month");

-- AddForeignKey
ALTER TABLE "LifePlanSnapshot" ADD CONSTRAINT "LifePlanSnapshot_lifePlanId_fkey" FOREIGN KEY ("lifePlanId") REFERENCES "LifePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
