-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "suggestedAmount" DOUBLE PRECISION NOT NULL,
    "userAmount" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_partnershipId_month_category_key" ON "Budget"("partnershipId", "month", "category");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
