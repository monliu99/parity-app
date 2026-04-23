-- DropTable
DROP TABLE IF EXISTS "BudgetVariable";
DROP TABLE IF EXISTS "BudgetFixed";

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "merchant" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_partnershipId_idx" ON "Transaction"("partnershipId");
CREATE INDEX "Transaction_partnershipId_date_idx" ON "Transaction"("partnershipId", "date");
CREATE INDEX "Transaction_partnershipId_category_idx" ON "Transaction"("partnershipId", "category");
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;
