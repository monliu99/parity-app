/**
 * Creates a single class demo couple for live presentation.
 * Safe to run anytime — skips if demo@parity.app already exists.
 *
 * Credentials:
 *   demo@parity.app   / password  (Jamie)
 *   goldie@parity.app  / password  (Goldie)
 *   Invite code: CLASS2026
 *
 * Run with: npx tsx scripts/seed-class-demo.ts
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

function vary(base: number, monthIdx: number): number {
  return Math.round(base * [1.0, 0.91, 1.09][monthIdx]);
}

async function main() {
  const existing = await db.user.findUnique({ where: { email: "greenie@parity.app" } });
  if (existing) {
    console.log("Demo account already exists — skipping. Delete greenie@parity.app to recreate.");
    return;
  }

  console.log("Creating class demo couple...\n");
  const hash = await bcrypt.hash("password", 8);

  const jamie = await db.user.create({ data: { email: "greenie@parity.app",   name: "Greenie",   passwordHash: hash } });
  const alex  = await db.user.create({ data: { email: "goldie@parity.app", name: "Goldie", passwordHash: hash } });

  const partnership = await db.partnership.create({ data: { inviteCode: "CLASS2026" } });

  await db.membership.createMany({
    data: [
      { userId: jamie.id, partnershipId: partnership.id },
      { userId: alex.id,  partnershipId: partnership.id },
    ],
  });

  // Accounts — mix of joint, Jamie's, and Alex's
  const accounts = await Promise.all([
    db.account.create({ data: { partnershipId: partnership.id, userId: null,     ownerLabel: "JOINT",   name: "Joint Checking",       type: "CHECKING",   balance: 12400,  institution: "Chase" } }),
    db.account.create({ data: { partnershipId: partnership.id, userId: null,     ownerLabel: "JOINT",   name: "Joint Savings",         type: "SAVINGS",    balance: 28000,  institution: "Ally" } }),
    db.account.create({ data: { partnershipId: partnership.id, userId: jamie.id, ownerLabel: "MINE",    name: "Jamie's Checking",      type: "CHECKING",   balance: 7800,   institution: "Chase" } }),
    db.account.create({ data: { partnershipId: partnership.id, userId: jamie.id, ownerLabel: "MINE",    name: "Jamie's Savings",       type: "SAVINGS",    balance: 22000,  institution: "Marcus" } }),
    db.account.create({ data: { partnershipId: partnership.id, userId: jamie.id, ownerLabel: "MINE",    name: "Fidelity Brokerage",    type: "INVESTMENT", balance: 38500,  institution: "Fidelity" } }),
    db.account.create({ data: { partnershipId: partnership.id, userId: alex.id,  ownerLabel: "PARTNER", name: "Alex's Checking",       type: "CHECKING",   balance: 6200,   institution: "Bank of America" } }),
    db.account.create({ data: { partnershipId: partnership.id, userId: alex.id,  ownerLabel: "PARTNER", name: "Alex's Savings",        type: "SAVINGS",    balance: 15500,  institution: "Ally" } }),
  ]);

  const jointAcct = accounts[0];

  // 3 months of transactions
  const txTemplates = [
    // Shared
    { amount: 3200, category: "Housing",            description: "Rent",                  merchant: "Property Manager", day: 1,  userIdx: 0 },
    { amount: 130,  category: "Housing",            description: "Utilities",              merchant: "ConEd",            day: 5,  userIdx: 1 },
    { amount: 75,   category: "Housing",            description: "Internet",               merchant: "Spectrum",         day: 8,  userIdx: 0 },
    { amount: 90,   category: "Subscriptions",      description: "Streaming + Spotify",    merchant: "Various",          day: 3,  userIdx: 0 },
    { amount: 240,  category: "Insurance",          description: "Renters insurance",      merchant: "Lemonade",         day: 1,  userIdx: 1 },
    { amount: 620,  category: "Groceries + Dining", description: "Groceries",              merchant: "Whole Foods",      day: 7,  userIdx: 1 },
    { amount: 280,  category: "Groceries + Dining", description: "Groceries",              merchant: "Trader Joe's",     day: 18, userIdx: 0 },
    // Jamie's
    { amount: 190,  category: "Groceries + Dining", description: "Lunch + coffee",         merchant: "Various",          day: 13, userIdx: 0 },
    { amount: 145,  category: "Transport",          description: "Subway + Uber",          merchant: "MTA",              day: 2,  userIdx: 0 },
    { amount: 220,  category: "Fun + Entertainment",description: "Concerts, drinks",       merchant: "Various",          day: 16, userIdx: 0 },
    { amount: 95,   category: "Personal Care",      description: "Haircut + grooming",     merchant: "Various",          day: 20, userIdx: 0 },
    { amount: 310,  category: "Shopping",           description: "Clothes + misc",         merchant: "Various",          day: 22, userIdx: 0 },
    // Alex's
    { amount: 520,  category: "Groceries + Dining", description: "Takeout + dining out",   merchant: "Various",          day: 12, userIdx: 1 },
    { amount: 175,  category: "Transport",          description: "Gas + parking",          merchant: "Shell",            day: 9,  userIdx: 1 },
    { amount: 160,  category: "Fun + Entertainment",description: "Movies, outings",        merchant: "Various",          day: 14, userIdx: 1 },
    { amount: 120,  category: "Personal Care",      description: "Self care",              merchant: "Sephora",          day: 21, userIdx: 1 },
    { amount: 85,   category: "Healthcare",         description: "Pharmacy + copays",      merchant: "CVS",              day: 11, userIdx: 1 },
  ];

  const now = new Date();
  const txData: any[] = [];

  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    for (const tx of txTemplates) {
      txData.push({
        partnershipId: partnership.id,
        userId: tx.userIdx === 0 ? jamie.id : alex.id,
        accountId: jointAcct.id,
        amount: vary(tx.amount, monthsAgo),
        category: tx.category,
        date: new Date(month.getFullYear(), month.getMonth(), tx.day),
        description: tx.description,
        merchant: tx.merchant,
      });
    }
  }

  await db.transaction.createMany({ data: txData });

  // Goals
  const emergencyFund = await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Emergency Fund",
      targetAmount: 30000,
      currentAmount: 22000,
      targetDate: new Date("2026-10-01"),
      notes: "6 months of shared expenses",
    },
  });

  const europeTrip = await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Europe Trip",
      targetAmount: 10000,
      currentAmount: 4200,
      targetDate: new Date("2026-12-01"),
      notes: "3 weeks — Italy, France, Spain",
    },
  });

  const downPayment = await db.goal.create({
    data: {
      partnershipId: partnership.id,
      userId: null,
      ownerLabel: "JOINT",
      name: "Down Payment",
      targetAmount: 100000,
      currentAmount: 31000,
      targetDate: new Date("2028-06-01"),
      notes: "First home together",
    },
  });

  await (db.goalAllocation.createMany as any)({
    data: [
      { goalId: emergencyFund.id, userId: jamie.id, percentage: 50 },
      { goalId: emergencyFund.id, userId: alex.id,  percentage: 50 },
      { goalId: europeTrip.id,    userId: jamie.id, percentage: 60 },
      { goalId: europeTrip.id,    userId: alex.id,  percentage: 40 },
      { goalId: downPayment.id,   userId: jamie.id, percentage: 50 },
      { goalId: downPayment.id,   userId: alex.id,  percentage: 50 },
    ],
  });

  await (db.goalContribution.createMany as any)({
    data: [
      { goalId: emergencyFund.id, userId: jamie.id, amount: 11000 },
      { goalId: emergencyFund.id, userId: alex.id,  amount: 11000 },
      { goalId: europeTrip.id,    userId: jamie.id, amount: 2520 },
      { goalId: europeTrip.id,    userId: alex.id,  amount: 1680 },
      { goalId: downPayment.id,   userId: jamie.id, amount: 15500 },
      { goalId: downPayment.id,   userId: alex.id,  amount: 15500 },
    ],
  });

  console.log("✅ Class demo account created!\n");
  console.log("  Login:      greenie@parity.app   /  password  (Greenie)");
  console.log("  Partner:    goldie@parity.app /  password  (Goldie)");
  console.log("  Invite code: CLASS2026\n");
  console.log(`  Accounts: ${accounts.length} | Transactions: ${txData.length} | Goals: 3`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
