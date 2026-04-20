/**
 * Seed script — populates Neon with demo data for UI development.
 * Run with: npx tsx scripts/seed.ts
 *
 * Creates:
 *   - 2 users: mo@parity.app / alex@parity.app (password: "password" for both)
 *   - 1 partnership
 *   - 7 accounts (2 joint, 3 Mo's, 2 Alex's)
 *   - 30 transactions over the last 60 days
 *   - 4 goals at various progress levels
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local explicitly
config({ path: resolve(process.cwd(), ".env.local") });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function specificDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  const deletedBudgets = await db.budget.deleteMany({});
  const deletedTxns = await db.transaction.deleteMany({});
  const deletedGoals = await db.goal.deleteMany({});
  const deletedAccounts = await db.account.deleteMany({});
  const deletedMemberships = await db.membership.deleteMany({});
  const deletedPartnerships = await db.partnership.deleteMany({});
  const deletedUsers = await db.user.deleteMany({});

  console.log("  ✓ Cleared existing data:");
  console.log("    - budgets:", deletedBudgets.count);
  console.log("    - transactions:", deletedTxns.count);
  console.log("    - goals:", deletedGoals.count);
  console.log("    - accounts:", deletedAccounts.count);
  console.log("    - memberships:", deletedMemberships.count);
  console.log("    - partnerships:", deletedPartnerships.count);
  console.log("    - users:", deletedUsers.count);

  const passwordHash = await bcrypt.hash("password", 8);

  // Users
  const mo = await db.user.create({
    data: { email: "mo@parity.app", name: "Mo", passwordHash },
  });
  const alex = await db.user.create({
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
      { userId: alex.id, partnershipId: partnership.id },
    ],
  });

  console.log("  ✓ Created partnership (invite code: DEMO42)");

  // Joint Accounts (userId: null)
  const jointChecking = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Joint Checking",
      type: "CHECKING",
      balance: 15200.00,
      institution: "Chase",
    },
  });
  const jointSavings = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Joint Savings",
      type: "SAVINGS",
      balance: 35000.00,
      institution: "Ally",
    },
  });

  // Individual Accounts
  const moChecking = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: mo.id,
      ownerLabel: "MINE",
      name: "Chase Checking",
      type: "CHECKING",
      balance: 8420.50,
      institution: "Chase",
    },
  });
  const moSavings = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: mo.id,
      ownerLabel: "MINE",
      name: "Marcus Savings",
      type: "SAVINGS",
      balance: 24000.00,
      institution: "Goldman Sachs",
    },
  });
  const moInvestment = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: mo.id,
      ownerLabel: "MINE",
      name: "Fidelity Brokerage",
      type: "INVESTMENT",
      balance: 41800.00,
      institution: "Fidelity",
    },
  });
  const alexChecking = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: alex.id,
      ownerLabel: "PARTNER",
      name: "BofA Checking",
      type: "CHECKING",
      balance: 6150.75,
      institution: "Bank of America",
    },
  });
  const alexSavings = await db.account.create({
    data: {
      partnershipId: partnership.id,
      userId: alex.id,
      ownerLabel: "PARTNER",
      name: "Ally Savings",
      type: "SAVINGS",
      balance: 18500.00,
      institution: "Ally",
    },
  });

  console.log("  ✓ Created 7 accounts (2 joint, 3 Mo's, 2 Alex's)");

  // March 2026 transactions
  const marchTxns = [
    // Groceries (budget: 350, actual: ~420 — over budget)
    { merchant: "Whole Foods", amount: 142.50, category: "Groceries", date: specificDate(2026, 3, 5), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Trader Joe's", amount: 78.30,  category: "Groceries", date: specificDate(2026, 3, 12), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Costco", amount: 198.60, category: "Groceries", date: specificDate(2026, 3, 19), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Dining (budget: 300, actual: ~250 — under budget)
    { merchant: "Sweetgreen", amount: 24.50, category: "Dining", date: specificDate(2026, 3, 3), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Chipotle", amount: 22.80, category: "Dining", date: specificDate(2026, 3, 10), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Shake Shack", amount: 32.00, category: "Dining", date: specificDate(2026, 3, 17), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    { merchant: "Cafe Mogador", amount: 48.00, category: "Dining", date: specificDate(2026, 3, 24), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Joe's Pizza", amount: 26.40, category: "Dining", date: specificDate(2026, 3, 28), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Via Carota", amount: 85.00, category: "Dining", date: specificDate(2026, 3, 31), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    // Transport (budget: 150, actual: ~180 — over budget)
    { merchant: "Uber", amount: 28.40, category: "Transport", date: specificDate(2026, 3, 7), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Lyft", amount: 34.20, category: "Transport", date: specificDate(2026, 3, 14), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "NJ Transit", amount: 89.00, category: "Transport", date: specificDate(2026, 3, 21), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Uber", amount: 31.50, category: "Transport", date: specificDate(2026, 3, 26), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    // Subscriptions (budget: 120, actual: ~95 — under budget)
    { merchant: "Netflix", amount: 22.99, category: "Subscriptions", date: specificDate(2026, 3, 1), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    { merchant: "Spotify", amount: 16.99, category: "Subscriptions", date: specificDate(2026, 3, 5), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "NYT", amount: 17.00, category: "Subscriptions", date: specificDate(2026, 3, 10), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Peloton", amount: 44.00, category: "Subscriptions", date: specificDate(2026, 3, 15), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    // Shopping (budget: 300, actual: ~280 — under budget)
    { merchant: "Amazon", amount: 72.40, category: "Shopping", date: specificDate(2026, 3, 8), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Target", amount: 86.20, category: "Shopping", date: specificDate(2026, 3, 18), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    { merchant: "Best Buy", amount: 118.00, category: "Shopping", date: specificDate(2026, 3, 25), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    // Health (budget: 350, actual: ~320 — under budget)
    { merchant: "Equinox", amount: 280.00, category: "Health", date: specificDate(2026, 3, 2), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "CVS", amount: 38.50, category: "Health", date: specificDate(2026, 3, 11), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    // Housing (budget: 4000, actual: ~3890 — under budget)
    { merchant: "Rent", amount: 3800.00, category: "Housing", date: specificDate(2026, 3, 1), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "ConEd", amount: 89.50, category: "Housing", date: specificDate(2026, 3, 15), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Entertainment (budget: 200, actual: ~180 — under budget)
    { merchant: "AMC", amount: 42.00, category: "Entertainment", date: specificDate(2026, 3, 9), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Spotify", amount: 9.99, category: "Entertainment", date: specificDate(2026, 3, 22), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Movie Theater", amount: 56.00, category: "Entertainment", date: specificDate(2026, 3, 29), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Travel (budget: 1500, actual: ~1400 — under budget)
    { merchant: "Delta", amount: 480.00, category: "Travel", date: specificDate(2026, 3, 13), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Airbnb", amount: 520.00, category: "Travel", date: specificDate(2026, 3, 13), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Enterprise", amount: 198.50, category: "Travel", date: specificDate(2026, 3, 14), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Hotel", amount: 205.00, category: "Travel", date: specificDate(2026, 3, 14), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Income
    { merchant: "Payroll", amount: 5200.00, category: "Income", date: specificDate(2026, 3, 15), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Payroll", amount: 4800.00, category: "Income", date: specificDate(2026, 3, 15), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Freelance", amount: 1200.00, category: "Income", date: specificDate(2026, 3, 28), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
  ];

  for (const tx of marchTxns) {
    await db.transaction.create({
      data: {
        partnershipId: partnership.id,
        accountId: tx.accountId,
        userId: tx.userId,
        ownerLabel: tx.ownerLabel,
        merchant: tx.merchant,
        amount: tx.amount,
        category: tx.category,
        date: tx.date,
      },
    });
  }

  console.log(`  ✓ Created ${marchTxns.length} March 2026 transactions`);

  // April 2026 transactions (current month — partial month)
  const aprilTxns = [
    // Groceries (budget: 350, actual: ~285 so far — on track)
    { merchant: "Whole Foods", amount: 95.20, category: "Groceries", date: specificDate(2026, 4, 2), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Trader Joe's", amount: 78.40, category: "Groceries", date: specificDate(2026, 4, 9), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Costco", amount: 68.00, category: "Groceries", date: specificDate(2026, 4, 16), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Dining (budget: 350, actual: ~265 so far — on track)
    { merchant: "Sweetgreen", amount: 22.50, category: "Dining", date: specificDate(2026, 4, 3), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Chipotle", amount: 18.80, category: "Dining", date: specificDate(2026, 4, 10), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Cote", amount: 78.00, category: "Dining", date: specificDate(2026, 4, 12), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Modern Pizza", amount: 28.20, category: "Dining", date: specificDate(2026, 4, 17), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Via Carota", amount: 72.50, category: "Dining", date: specificDate(2026, 4, 18), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    // Transport (budget: 100, actual: ~68 so far — on track)
    { merchant: "Uber", amount: 20.30, category: "Transport", date: specificDate(2026, 4, 5), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "NJ Transit", amount: 35.00, category: "Transport", date: specificDate(2026, 4, 11), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    // Subscriptions (budget: 120, actual: ~100 so far — on track)
    { merchant: "Netflix", amount: 15.99, category: "Subscriptions", date: specificDate(2026, 4, 1), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    { merchant: "Spotify", amount: 10.99, category: "Subscriptions", date: specificDate(2026, 4, 6), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "NYT", amount: 17.00, category: "Subscriptions", date: specificDate(2026, 4, 6), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Peloton", amount: 40.00, category: "Subscriptions", date: specificDate(2026, 4, 15), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    // Shopping (budget: 200, actual: ~165 — on track)
    { merchant: "Amazon", amount: 72.50, category: "Shopping", date: specificDate(2026, 4, 4), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Target", amount: 58.00, category: "Shopping", date: specificDate(2026, 4, 14), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Health (budget: 350, actual: ~280 so far — on track)
    { merchant: "Equinox", amount: 220.00, category: "Health", date: specificDate(2026, 4, 2), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    // Housing (budget: 4000, actual: ~3890 so far — on track)
    { merchant: "Rent", amount: 3100.00, category: "Housing", date: specificDate(2026, 4, 1), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "ConEd", amount: 95.50, category: "Housing", date: specificDate(2026, 4, 14), accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Entertainment (budget: 300, actual: ~156 so far — on track)
    { merchant: "Concert Tickets", amount: 108.00, category: "Entertainment", date: specificDate(2026, 4, 7), accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Netflix", amount: 15.99, category: "Entertainment", date: specificDate(2026, 4, 13), accountId: alexChecking.id, userId: mo.id, ownerLabel: "MINE" },
    // Income
    { merchant: "Payroll", amount: 5200.00, category: "Income", date: specificDate(2026, 4, 15), accountId: moChecking.id, userId: mo.id, ownerLabel: "MINE" },
    { merchant: "Payroll", amount: 4800.00, category: "Income", date: specificDate(2026, 4, 15), accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
  ];

  for (const tx of aprilTxns) {
    await db.transaction.create({
      data: {
        partnershipId: partnership.id,
        accountId: tx.accountId,
        userId: tx.userId,
        ownerLabel: tx.ownerLabel,
        merchant: tx.merchant,
        amount: tx.amount,
        category: tx.category,
        date: tx.date,
      },
    });
  }

  console.log(`  ✓ Created ${aprilTxns.length} April 2026 transactions`);

  // Goals
  const emergencyFund = await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Emergency Fund",
      targetAmount: 30000,
      currentAmount: 24000,
      targetDate: new Date("2025-09-01"),
      notes: "6 months of expenses",
    },
  });

  const italyTrip = await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Italy Trip",
      targetAmount: 8000,
      currentAmount: 3200,
      targetDate: new Date("2025-10-15"),
      notes: "2 weeks in October",
    },
  });

  const downPayment = await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Down Payment",
      targetAmount: 120000,
      currentAmount: 42500,
      targetDate: new Date("2027-06-01"),
    },
  });

  await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: mo.id,
      ownerLabel: "PERSONAL",
      name: "New MacBook Pro",
      targetAmount: 3500,
      currentAmount: 3500,
      targetDate: new Date("2025-06-01"),
    },
  });

  console.log("  ✓ Created 4 goals");

  // Goal allocations with different splits
  await (db.goalAllocation.createMany as Function)({
    data: [
      // Emergency Fund: 50/50 (fair split)
      { goalId: emergencyFund.id, userId: mo.id, percentage: 50 },
      { goalId: emergencyFund.id, userId: alex.id, percentage: 50 },
      // Italy Trip: 70/30 (Mo paying more - it was his idea)
      { goalId: italyTrip.id, userId: mo.id, percentage: 70 },
      { goalId: italyTrip.id, userId: alex.id, percentage: 30 },
      // Down Payment: 30/70 (Andrew earning more, contributing more)
      { goalId: downPayment.id, userId: mo.id, percentage: 30 },
      { goalId: downPayment.id, userId: alex.id, percentage: 70 },
    ],
  });

  console.log("  ✓ Created goal allocations (50/50, 70/30, 30/70)");

  // Goal contributions - adjust to match allocations
  await (db.goalContribution.createMany as Function)({
    data: [
      // Emergency Fund: 50/50 split of $24K → $12K each
      { goalId: emergencyFund.id, userId: mo.id, amount: 12000 },
      { goalId: emergencyFund.id, userId: alex.id, amount: 12000 },
      // Italy Trip: 70/30 split of $3.2K → Mo $2,240, Alex $960
      { goalId: italyTrip.id, userId: mo.id, amount: 2240 },
      { goalId: italyTrip.id, userId: alex.id, amount: 960 },
      // Down Payment: 30/70 split of $42.5K → Mo $12,750, Alex $29,750
      { goalId: downPayment.id, userId: mo.id, amount: 12750 },
      { goalId: downPayment.id, userId: alex.id, amount: 29750 },
    ],
  });

  console.log("  ✓ Created goal contributions matching allocations");

  // Budgets — pre-set targets for March and April 2026
  await db.budget.createMany({
    data: [
      // March 2026 — slightly tight targets (they were traveling)
      { partnershipId: partnership.id, month: "2026-03", category: "Groceries",     suggestedAmount: 350 },
      { partnershipId: partnership.id, month: "2026-03", category: "Dining",        suggestedAmount: 300 },
      { partnershipId: partnership.id, month: "2026-03", category: "Transport",     suggestedAmount: 150 },
      { partnershipId: partnership.id, month: "2026-03", category: "Subscriptions", suggestedAmount: 120 },
      { partnershipId: partnership.id, month: "2026-03", category: "Shopping",      suggestedAmount: 300 },
      { partnershipId: partnership.id, month: "2026-03", category: "Health",        suggestedAmount: 350 },
      { partnershipId: partnership.id, month: "2026-03", category: "Housing",       suggestedAmount: 4000 },
      { partnershipId: partnership.id, month: "2026-03", category: "Entertainment", suggestedAmount: 200 },
      { partnershipId: partnership.id, month: "2026-03", category: "Travel",        suggestedAmount: 1500 },
      // April 2026 — tighter after March travel splurge
      { partnershipId: partnership.id, month: "2026-04", category: "Groceries",     suggestedAmount: 350 },
      { partnershipId: partnership.id, month: "2026-04", category: "Dining",        suggestedAmount: 350 },
      { partnershipId: partnership.id, month: "2026-04", category: "Transport",     suggestedAmount: 100 },
      { partnershipId: partnership.id, month: "2026-04", category: "Subscriptions", suggestedAmount: 120 },
      { partnershipId: partnership.id, month: "2026-04", category: "Shopping",      suggestedAmount: 200 },
      { partnershipId: partnership.id, month: "2026-04", category: "Health",        suggestedAmount: 350 },
      { partnershipId: partnership.id, month: "2026-04", category: "Housing",       suggestedAmount: 4000 },
      { partnershipId: partnership.id, month: "2026-04", category: "Entertainment", suggestedAmount: 300 },
    ],
  });

  console.log("  ✓ Created budgets for 2026-03 and 2026-04");
  console.log("\n✅ Seed complete!");
  console.log("\nLogin credentials:");
  console.log("  mo@parity.app    / password");
  console.log("  andrew@parity.app / password");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
