/**
 * Seed script — populates Neon with demo data for UI development.
 * Run with: npx tsx scripts/seed.ts
 *
 * Creates:
 *   - 2 users: mo@parity.app / alex@parity.app (password: "password" for both)
 *   - 1 partnership
 *   - 5 accounts (3 Mo's, 2 Alex's)
 *   - 30 transactions over the last 60 days
 *   - 4 goals at various progress levels
 */

import "dotenv/config";
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

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await db.budget.deleteMany();
  await db.transaction.deleteMany();
  await db.goal.deleteMany();
  await db.account.deleteMany();
  await db.membership.deleteMany();
  await db.partnership.deleteMany();
  await db.user.deleteMany();

  console.log("  ✓ Cleared existing data");

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

  // Accounts
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

  console.log("  ✓ Created 5 accounts");

  // Transactions — 30 spread over last 60 days across all categories
  const txns = [
    // Groceries
    { merchant: "Whole Foods", amount: 134.20, category: "Groceries", daysAgo: 2,  accountId: moChecking.id,  userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "Trader Joe's", amount: 89.50,  category: "Groceries", daysAgo: 9,  accountId: moChecking.id,  userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "Costco",       amount: 210.80, category: "Groceries", daysAgo: 18, accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Whole Foods",  amount: 96.40,  category: "Groceries", daysAgo: 32, accountId: moChecking.id,  userId: mo.id,   ownerLabel: "MINE" },
    // Dining
    { merchant: "Nobu",         amount: 220.00, category: "Dining", daysAgo: 5,  accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Sweetgreen",   amount: 28.50,  category: "Dining", daysAgo: 7,  accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "Chipotle",     amount: 24.80,  category: "Dining", daysAgo: 12, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "The Dutch",    amount: 180.00, category: "Dining", daysAgo: 22, accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    { merchant: "Blue Bottle",  amount: 18.00,  category: "Dining", daysAgo: 35, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    // Transport
    { merchant: "Uber",         amount: 32.40,  category: "Transport", daysAgo: 3,  accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "NJ Transit",   amount: 104.00, category: "Transport", daysAgo: 14, accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Lyft",         amount: 21.60,  category: "Transport", daysAgo: 28, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    // Subscriptions
    { merchant: "Netflix",      amount: 22.99,  category: "Subscriptions", daysAgo: 1,  accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    { merchant: "Spotify",      amount: 16.99,  category: "Subscriptions", daysAgo: 8,  accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "NYT",          amount: 17.00,  category: "Subscriptions", daysAgo: 15, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "Peloton",      amount: 44.00,  category: "Subscriptions", daysAgo: 22, accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    // Shopping
    { merchant: "Amazon",       amount: 87.30,  category: "Shopping", daysAgo: 6,  accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "Zara",         amount: 165.00, category: "Shopping", daysAgo: 20, accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "IKEA",         amount: 340.00, category: "Shopping", daysAgo: 40, accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Health
    { merchant: "Equinox",      amount: 280.00, category: "Health", daysAgo: 1,  accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "CVS Pharmacy", amount: 42.60,  category: "Health", daysAgo: 16, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    // Housing
    { merchant: "Rent",         amount: 3800.00, category: "Housing", daysAgo: 2,  accountId: moChecking.id,   userId: mo.id,   ownerLabel: "JOINT" },
    { merchant: "ConEd",        amount: 88.40,   category: "Housing", daysAgo: 10, accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Entertainment
    { merchant: "AMC Theaters", amount: 36.00,  category: "Entertainment", daysAgo: 11, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "JOINT" },
    { merchant: "Broadway Show",amount: 220.00, category: "Entertainment", daysAgo: 45, accountId: alexChecking.id, userId: alex.id, ownerLabel: "JOINT" },
    // Travel
    { merchant: "Delta Airlines",amount: 480.00, category: "Travel", daysAgo: 50, accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    { merchant: "Airbnb",        amount: 620.00, category: "Travel", daysAgo: 49, accountId: moChecking.id, userId: mo.id, ownerLabel: "JOINT" },
    // Income
    { merchant: "Payroll",      amount: 5200.00, category: "Income", daysAgo: 1,  accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
    { merchant: "Payroll",      amount: 4800.00, category: "Income", daysAgo: 1,  accountId: alexChecking.id, userId: alex.id, ownerLabel: "PARTNER" },
    { merchant: "Payroll",      amount: 5200.00, category: "Income", daysAgo: 15, accountId: moChecking.id,   userId: mo.id,   ownerLabel: "MINE" },
  ];

  for (const tx of txns) {
    await db.transaction.create({
      data: {
        partnershipId: partnership.id,
        accountId: tx.accountId,
        userId: tx.userId,
        ownerLabel: tx.ownerLabel,
        merchant: tx.merchant,
        amount: tx.amount,
        category: tx.category,
        date: daysAgo(tx.daysAgo),
      },
    });
  }

  console.log(`  ✓ Created ${txns.length} transactions`);

  // Goals
  await db.goal.createMany({
    data: [
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Emergency Fund",
        targetAmount: 30000,
        currentAmount: 24000,
        targetDate: new Date("2025-09-01"),
        notes: "6 months of expenses",
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Italy Trip",
        targetAmount: 8000,
        currentAmount: 3200,
        targetDate: new Date("2025-10-15"),
        notes: "2 weeks in October",
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Down Payment",
        targetAmount: 120000,
        currentAmount: 42500,
        targetDate: new Date("2027-06-01"),
      },
      {
        partnershipId: partnership.id,
        userId: mo.id,
        ownerLabel: "PERSONAL",
        name: "New MacBook Pro",
        targetAmount: 3500,
        currentAmount: 3500,
        targetDate: new Date("2025-06-01"),
      },
    ],
  });

  console.log("  ✓ Created 4 goals");

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
