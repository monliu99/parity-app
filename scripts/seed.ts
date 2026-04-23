/**
 * Seed script — populates Neon with demo data for UI development.
 * Run with: npx tsx scripts/seed.ts
 *
 * Creates:
 *   - 2 users: mo@parity.app / andrew@parity.app (password: "password" for both)
 *   - 1 partnership (invite code: DEMO42)
 *   - 7 accounts (2 joint, 3 Mo's, 2 Andrew's)
 *   - 4 goals at various progress levels
 *   - ~24 transactions across 3 months for both partners
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await db.transaction.deleteMany({});
  await db.goalContribution.deleteMany({});
  await db.goalAllocation.deleteMany({});
  await db.goal.deleteMany({});
  await db.account.deleteMany({});
  await db.membership.deleteMany({});
  await db.partnership.deleteMany({});
  await db.user.deleteMany({});

  console.log("  ✓ Cleared existing data");

  const passwordHash = await bcrypt.hash("password", 8);

  // Users
  const mo = await db.user.create({
    data: { email: "mo@parity.app", name: "Mo", passwordHash },
  });
  const andrew = await db.user.create({
    data: { email: "andrew@parity.app", name: "Andrew", passwordHash },
  });

  console.log("  ✓ Created users: mo@parity.app, andrew@parity.app (password: password)");

  // Partnership
  const partnership = await db.partnership.create({
    data: { inviteCode: "DEMO42" },
  });

  await db.membership.createMany({
    data: [
      { userId: mo.id, partnershipId: partnership.id },
      { userId: andrew.id, partnershipId: partnership.id },
    ],
  });

  console.log("  ✓ Created partnership (invite code: DEMO42)");

  // Accounts
  const jointChecking: any = { id: "" };
  const created_jointChecking = await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: null, ownerLabel: "JOINT", name: "Joint Checking", type: "CHECKING", balance: 15200, institution: "Chase" } });
  jointChecking.id = created_jointChecking.id;
  await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: null, ownerLabel: "JOINT", name: "Joint Savings", type: "SAVINGS", balance: 35000, institution: "Ally" } });
  await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: mo.id, ownerLabel: "MINE", name: "Chase Checking", type: "CHECKING", balance: 8420, institution: "Chase" } });
  await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: mo.id, ownerLabel: "MINE", name: "Marcus Savings", type: "SAVINGS", balance: 24000, institution: "Goldman Sachs" } });
  await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: mo.id, ownerLabel: "MINE", name: "Fidelity Brokerage", type: "INVESTMENT", balance: 41800, institution: "Fidelity" } });
  await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: andrew.id, ownerLabel: "PARTNER", name: "BofA Checking", type: "CHECKING", balance: 6150, institution: "Bank of America" } });
  await (db.account.create as Function)({ data: { partnershipId: partnership.id, userId: andrew.id, ownerLabel: "PARTNER", name: "Ally Savings", type: "SAVINGS", balance: 18500, institution: "Ally" } });

  console.log("  ✓ Created 7 accounts (2 joint, 3 Mo's, 2 Andrew's)");

  // Goals
  const emergencyFund = await db.goal.create({
    data: { partnershipId: partnership.id, userId: null, ownerLabel: "JOINT", name: "Emergency Fund", targetAmount: 30000, currentAmount: 24000, targetDate: new Date("2026-09-01"), notes: "6 months of expenses" },
  });
  const italyTrip = await db.goal.create({
    data: { partnershipId: partnership.id, userId: null, ownerLabel: "JOINT", name: "Italy Trip", targetAmount: 8000, currentAmount: 3200, targetDate: new Date("2026-10-15"), notes: "2 weeks in October" },
  });
  const downPayment = await db.goal.create({
    data: { partnershipId: partnership.id, userId: null, ownerLabel: "JOINT", name: "Down Payment", targetAmount: 120000, currentAmount: 42500, targetDate: new Date("2027-06-01") },
  });
  await db.goal.create({
    data: { partnershipId: partnership.id, userId: mo.id, ownerLabel: "PERSONAL", name: "New MacBook Pro", targetAmount: 3500, currentAmount: 3500, targetDate: new Date("2026-06-01") },
  });

  console.log("  ✓ Created 4 goals");

  await (db.goalAllocation.createMany as Function)({
    data: [
      { goalId: emergencyFund.id, userId: mo.id, percentage: 50 },
      { goalId: emergencyFund.id, userId: andrew.id, percentage: 50 },
      { goalId: italyTrip.id, userId: mo.id, percentage: 70 },
      { goalId: italyTrip.id, userId: andrew.id, percentage: 30 },
      { goalId: downPayment.id, userId: mo.id, percentage: 30 },
      { goalId: downPayment.id, userId: andrew.id, percentage: 70 },
    ],
  });
  await (db.goalContribution.createMany as Function)({
    data: [
      { goalId: emergencyFund.id, userId: mo.id, amount: 12000 },
      { goalId: emergencyFund.id, userId: andrew.id, amount: 12000 },
      { goalId: italyTrip.id, userId: mo.id, amount: 2240 },
      { goalId: italyTrip.id, userId: andrew.id, amount: 960 },
      { goalId: downPayment.id, userId: mo.id, amount: 12750 },
      { goalId: downPayment.id, userId: andrew.id, amount: 29750 },
    ],
  });

  console.log("  ✓ Created goal allocations and contributions");

  // Transactions — 3 months of demo data
  const now = new Date();
  const txData: any[] = [];

  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);

    // Shared expenses (Mo enters, joint checking)
    txData.push(
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: 3800, category: "Housing", date: new Date(month.getFullYear(), month.getMonth(), 1), description: "Rent", merchant: "Property Manager" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: 120, category: "Housing", date: new Date(month.getFullYear(), month.getMonth(), 5), description: "Utilities", merchant: "ConEd" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: 280, category: "Insurance", date: new Date(month.getFullYear(), month.getMonth(), 1), description: "Renters insurance", merchant: "Lemonade" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: 95, category: "Subscriptions", date: new Date(month.getFullYear(), month.getMonth(), 3), description: "Shared subscriptions", merchant: "Various" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: 65, category: "Housing", date: new Date(month.getFullYear(), month.getMonth(), 8), description: "Internet", merchant: "Spectrum" },
    );

    // Mo's variable spending (varies slightly each month)
    const moGroceries = [820, 780, 850][monthsAgo];
    const moTransport = [145, 160, 130][monthsAgo];
    const moFun = [180, 220, 195][monthsAgo];
    txData.push(
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: moGroceries, category: "Groceries + Dining", date: new Date(month.getFullYear(), month.getMonth(), 12), description: "Groceries + eating out", merchant: "Various" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: moTransport, category: "Transport", date: new Date(month.getFullYear(), month.getMonth(), 10), description: "Subway + Uber", merchant: "MTA" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: moFun, category: "Fun + Entertainment", date: new Date(month.getFullYear(), month.getMonth(), 15), description: "Movies, drinks, etc.", merchant: "Various" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: 100, category: "Personal Care", date: new Date(month.getFullYear(), month.getMonth(), 20), description: "Haircut + grooming", merchant: "Barber" },
      { partnershipId: partnership.id, userId: mo.id, accountId: jointChecking.id, amount: [240, 180, 320][monthsAgo], category: "Shopping", date: new Date(month.getFullYear(), month.getMonth(), 18), description: "Misc shopping", merchant: "Amazon" },
    );

    // Andrew's variable spending
    const andrewGroceries = [1100, 1250, 980][monthsAgo];
    const andrewTransport = [190, 170, 210][monthsAgo];
    const andrewFun = [300, 280, 340][monthsAgo];
    txData.push(
      { partnershipId: partnership.id, userId: andrew.id, accountId: jointChecking.id, amount: andrewGroceries, category: "Groceries + Dining", date: new Date(month.getFullYear(), month.getMonth(), 11), description: "Groceries + takeout", merchant: "Various" },
      { partnershipId: partnership.id, userId: andrew.id, accountId: jointChecking.id, amount: andrewTransport, category: "Transport", date: new Date(month.getFullYear(), month.getMonth(), 9), description: "Gas + parking", merchant: "Shell" },
      { partnershipId: partnership.id, userId: andrew.id, accountId: jointChecking.id, amount: andrewFun, category: "Fun + Entertainment", date: new Date(month.getFullYear(), month.getMonth(), 14), description: "Concerts, games, etc.", merchant: "Ticketmaster" },
      { partnershipId: partnership.id, userId: andrew.id, accountId: jointChecking.id, amount: 100, category: "Personal Care", date: new Date(month.getFullYear(), month.getMonth(), 22), description: "Personal care", merchant: "CVS" },
    );
  }

  await db.transaction.createMany({ data: txData });

  console.log(`  ✓ Created ${txData.length} transactions across 3 months`);
  console.log("\n✅ Seed complete!");
  console.log("\nLogin credentials:");
  console.log("  mo@parity.app       / password");
  console.log("  andrew@parity.app   / password");
  console.log("  Invite code: DEMO42");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
