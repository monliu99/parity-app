/**
 * Seed script — populates Neon with demo data for UI development.
 * Run with: npx tsx scripts/seed.ts
 *
 * Creates test couples:
 *   - Mo & Andrew (demo, with goals)
 *   - Bryce & Emily (merged accounts, 2 kids, student debt payoff)
 *   - Holly1 & Holly2
 *   - Adam1 & Adam2
 *   - Arushi1 & Arushi2
 *   - Tom1 & Tom2
 *   - Alex & Elena (Yale SOM professor + Yelp PM)
 *
 * All passwords: "password"
 * Feedback data is preserved across re-seeds.
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

// ── Types ──

type AccountDef = {
  name: string;
  type: string;
  balance: number;
  institution: string;
  owner: number | null; // null = joint, 0 = partner 1, 1 = partner 2
};

type TxDef = {
  amount: number;
  category: string;
  description: string;
  merchant: string;
  day: number;
  enterBy?: number;
};

type CoupleDef = {
  emails: [string, string];
  names: [string, string];
  inviteCode: string;
  accounts: AccountDef[];
  shared: TxDef[];
  partner0: TxDef[];
  partner1: TxDef[];
};

// Vary amount by month to simulate natural spending fluctuation
function vary(base: number, monthIdx: number): number {
  const m = [1.0, 0.92, 1.08][monthIdx];
  return Math.round(base * m);
}

// ── Couple Profiles ──

const COUPLES: CoupleDef[] = [
  // ── Couple 1: Mo & Andrew (established, saving for home) ──
  {
    emails: ["mo@parity.app", "andrew@parity.app"],
    names: ["Mo", "Andrew"],
    inviteCode: "DEMO42",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 15200, institution: "Chase", owner: null },
      { name: "Joint Savings", type: "SAVINGS", balance: 35000, institution: "Ally", owner: null },
      { name: "Chase Checking", type: "CHECKING", balance: 8420, institution: "Chase", owner: 0 },
      { name: "Marcus Savings", type: "SAVINGS", balance: 24000, institution: "Goldman Sachs", owner: 0 },
      { name: "Fidelity Brokerage", type: "INVESTMENT", balance: 41800, institution: "Fidelity", owner: 0 },
      { name: "BofA Checking", type: "CHECKING", balance: 6150, institution: "Bank of America", owner: 1 },
      { name: "Ally Savings", type: "SAVINGS", balance: 18500, institution: "Ally", owner: 1 },
    ],
    shared: [
      { amount: 3800, category: "Housing", description: "Rent", merchant: "Property Manager", day: 1, enterBy: 0 },
      { amount: 120, category: "Housing", description: "Utilities", merchant: "ConEd", day: 5, enterBy: 0 },
      { amount: 280, category: "Insurance", description: "Renters insurance", merchant: "Lemonade", day: 1, enterBy: 0 },
      { amount: 95, category: "Subscriptions", description: "Shared subscriptions", merchant: "Various", day: 3, enterBy: 0 },
      { amount: 65, category: "Housing", description: "Internet", merchant: "Spectrum", day: 8, enterBy: 0 },
    ],
    partner0: [
      { amount: 820, category: "Groceries + Dining", description: "Groceries + eating out", merchant: "Various", day: 12 },
      { amount: 145, category: "Transport", description: "Subway + Uber", merchant: "MTA", day: 10 },
      { amount: 180, category: "Fun + Entertainment", description: "Movies, drinks, etc.", merchant: "Various", day: 15 },
      { amount: 100, category: "Personal Care", description: "Haircut + grooming", merchant: "Barber", day: 20 },
      { amount: 240, category: "Shopping", description: "Misc shopping", merchant: "Amazon", day: 18 },
    ],
    partner1: [
      { amount: 1100, category: "Groceries + Dining", description: "Groceries + takeout", merchant: "Various", day: 11 },
      { amount: 190, category: "Transport", description: "Gas + parking", merchant: "Shell", day: 9 },
      { amount: 300, category: "Fun + Entertainment", description: "Concerts, games, etc.", merchant: "Ticketmaster", day: 14 },
      { amount: 100, category: "Personal Care", description: "Personal care", merchant: "CVS", day: 22 },
    ],
  },

  // ── Couple 2: Bryce & Emily (merged accounts, 2 kids, prioritizing student debt) ──
  {
    emails: ["bryce@parity.app", "emily@parity.app"],
    names: ["Bryce", "Emily"],
    inviteCode: "BRYCE",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 6800, institution: "Chase", owner: null },
      { name: "Joint Savings", type: "SAVINGS", balance: 12000, institution: "Ally", owner: null },
      { name: "Bryce's 401k", type: "INVESTMENT", balance: 62000, institution: "Fidelity", owner: 0 },
      { name: "Emily's 401k", type: "INVESTMENT", balance: 48000, institution: "Vanguard", owner: 1 },
    ],
    shared: [
      { amount: 2400, category: "Housing", description: "Mortgage", merchant: "Wells Fargo", day: 1, enterBy: 0 },
      { amount: 180, category: "Housing", description: "Utilities", merchant: "ConEd", day: 5, enterBy: 1 },
      { amount: 85, category: "Housing", description: "Internet", merchant: "Spectrum", day: 8, enterBy: 0 },
      { amount: 75, category: "Subscriptions", description: "Family subscriptions", merchant: "Various", day: 3, enterBy: 0 },
      { amount: 350, category: "Groceries + Dining", description: "Groceries", merchant: "Costco", day: 6, enterBy: 1 },
      { amount: 280, category: "Groceries + Dining", description: "Groceries + kids snacks", merchant: "Trader Joe's", day: 14, enterBy: 0 },
      { amount: 180, category: "Healthcare", description: "Pediatrician + prescriptions", merchant: "CVS", day: 10, enterBy: 1 },
      { amount: 120, category: "Insurance", description: "Life insurance", merchant: "Haven Life", day: 1, enterBy: 0 },
      { amount: 600, category: "Shopping", description: "Student loan payment", merchant: "Navient", day: 15, enterBy: 0 },
      { amount: 350, category: "Fun + Entertainment", description: "Kids activities + family outings", merchant: "Various", day: 20, enterBy: 1 },
    ],
    partner0: [
      { amount: 160, category: "Transport", description: "Gas", merchant: "Shell", day: 9 },
      { amount: 100, category: "Personal Care", description: "Gym", merchant: "Equinox", day: 1 },
      { amount: 120, category: "Shopping", description: "Kids clothes", merchant: "Target", day: 18 },
    ],
    partner1: [
      { amount: 140, category: "Transport", description: "Gas", merchant: "BP", day: 11 },
      { amount: 90, category: "Personal Care", description: "Self care", merchant: "Various", day: 22 },
      { amount: 200, category: "Groceries + Dining", description: "School lunches + takeout", merchant: "Various", day: 16 },
    ],
  },

  // ── Couple 3: Holly1 & Holly2 ──

  {
    emails: ["holly1@parity.app", "holly2@parity.app"],
    names: ["Holly1", "Holly2"],
    inviteCode: "HOLLY",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 8500, institution: "Chase", owner: null },
      { name: "Joint Savings", type: "SAVINGS", balance: 22000, institution: "Ally", owner: null },
      { name: "Checking", type: "CHECKING", balance: 5200, institution: "Chase", owner: 0 },
      { name: "Savings", type: "SAVINGS", balance: 15000, institution: "Marcus", owner: 0 },
      { name: "Checking", type: "CHECKING", balance: 4800, institution: "BofA", owner: 1 },
      { name: "Savings", type: "SAVINGS", balance: 12000, institution: "Capital One", owner: 1 },
    ],
    shared: [
      { amount: 2800, category: "Housing", description: "Rent", merchant: "Property Manager", day: 1, enterBy: 0 },
      { amount: 130, category: "Housing", description: "Utilities", merchant: "ConEd", day: 5, enterBy: 1 },
      { amount: 75, category: "Housing", description: "Internet", merchant: "Spectrum", day: 8, enterBy: 0 },
      { amount: 55, category: "Subscriptions", description: "Shared subscriptions", merchant: "Various", day: 3, enterBy: 0 },
    ],
    partner0: [
      { amount: 520, category: "Groceries + Dining", description: "Groceries", merchant: "Whole Foods", day: 10 },
      { amount: 130, category: "Transport", description: "Subway + Uber", merchant: "MTA", day: 1 },
      { amount: 180, category: "Fun + Entertainment", description: "Going out", merchant: "Various", day: 15 },
      { amount: 90, category: "Personal Care", description: "Self care", merchant: "Various", day: 18 },
    ],
    partner1: [
      { amount: 450, category: "Groceries + Dining", description: "Groceries + takeout", merchant: "Various", day: 12 },
      { amount: 170, category: "Transport", description: "Gas + parking", merchant: "Shell", day: 9 },
      { amount: 120, category: "Fun + Entertainment", description: "Entertainment", merchant: "Various", day: 14 },
      { amount: 80, category: "Shopping", description: "Misc", merchant: "Amazon", day: 22 },
    ],
  },

  // ── Couple 4: Adam1 & Adam2 ──
  {
    emails: ["adam1@parity.app", "adam2@parity.app"],
    names: ["Adam1", "Adam2"],
    inviteCode: "ADAM",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 9800, institution: "Chase", owner: null },
      { name: "Joint Savings", type: "SAVINGS", balance: 18000, institution: "Ally", owner: null },
      { name: "Checking", type: "CHECKING", balance: 4500, institution: "Chase", owner: 0 },
      { name: "Savings", type: "SAVINGS", balance: 8000, institution: "Ally", owner: 0 },
      { name: "Checking", type: "CHECKING", balance: 5100, institution: "BofA", owner: 1 },
      { name: "Savings", type: "SAVINGS", balance: 10000, institution: "Capital One", owner: 1 },
    ],
    shared: [
      { amount: 3000, category: "Housing", description: "Rent", merchant: "Property Manager", day: 1, enterBy: 1 },
      { amount: 140, category: "Housing", description: "Utilities", merchant: "ConEd", day: 5, enterBy: 1 },
      { amount: 70, category: "Housing", description: "Internet", merchant: "Verizon", day: 8, enterBy: 0 },
      { amount: 50, category: "Subscriptions", description: "Shared subscriptions", merchant: "Various", day: 3, enterBy: 0 },
    ],
    partner0: [
      { amount: 550, category: "Groceries + Dining", description: "Groceries", merchant: "Whole Foods", day: 11 },
      { amount: 90, category: "Transport", description: "Subway", merchant: "MTA", day: 1 },
      { amount: 150, category: "Fun + Entertainment", description: "Going out", merchant: "Various", day: 16 },
      { amount: 75, category: "Shopping", description: "Misc shopping", merchant: "Amazon", day: 20 },
    ],
    partner1: [
      { amount: 480, category: "Groceries + Dining", description: "Groceries + takeout", merchant: "Various", day: 12 },
      { amount: 200, category: "Transport", description: "Gas + insurance", merchant: "Shell", day: 9 },
      { amount: 110, category: "Fun + Entertainment", description: "Entertainment", merchant: "Various", day: 14 },
      { amount: 85, category: "Personal Care", description: "Personal care", merchant: "Various", day: 22 },
    ],
  },

  // ── Couple 5: Arushi1 & Arushi2 ──
  {
    emails: ["arushi1@parity.app", "arushi2@parity.app"],
    names: ["Arushi1", "Arushi2"],
    inviteCode: "ARUSHI",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 12000, institution: "Chase", owner: null },
      { name: "Joint Savings", type: "SAVINGS", balance: 55000, institution: "Ally", owner: null },
      { name: "Checking", type: "CHECKING", balance: 7200, institution: "Chase", owner: 0 },
      { name: "Savings", type: "SAVINGS", balance: 20000, institution: "Marcus", owner: 0 },
      { name: "Checking", type: "CHECKING", balance: 6800, institution: "BofA", owner: 1 },
      { name: "Savings", type: "SAVINGS", balance: 18000, institution: "Fidelity", owner: 1 },
    ],
    shared: [
      { amount: 3500, category: "Housing", description: "Rent", merchant: "Property Manager", day: 1, enterBy: 0 },
      { amount: 150, category: "Housing", description: "Utilities", merchant: "ConEd", day: 5, enterBy: 1 },
      { amount: 80, category: "Housing", description: "Internet", merchant: "Spectrum", day: 8, enterBy: 0 },
      { amount: 65, category: "Subscriptions", description: "Shared subscriptions", merchant: "Various", day: 3, enterBy: 0 },
      { amount: 320, category: "Insurance", description: "Renters + auto insurance", merchant: "Lemonade", day: 1, enterBy: 1 },
    ],
    partner0: [
      { amount: 750, category: "Groceries + Dining", description: "Groceries + dining out", merchant: "Various", day: 11 },
      { amount: 140, category: "Transport", description: "Subway + Uber", merchant: "MTA", day: 1 },
      { amount: 200, category: "Shopping", description: "Shopping", merchant: "Various", day: 20 },
      { amount: 95, category: "Personal Care", description: "Personal care", merchant: "Various", day: 18 },
    ],
    partner1: [
      { amount: 650, category: "Groceries + Dining", description: "Groceries + takeout", merchant: "Various", day: 12 },
      { amount: 220, category: "Transport", description: "Gas + parking", merchant: "Shell", day: 9 },
      { amount: 160, category: "Fun + Entertainment", description: "Entertainment", merchant: "Various", day: 16 },
      { amount: 120, category: "Shopping", description: "Misc", merchant: "Amazon", day: 22 },
    ],
  },

  // ── Couple 6: Tom1 & Tom2 ──
  {
    emails: ["tom1@parity.app", "tom2@parity.app"],
    names: ["Tom1", "Tom2"],
    inviteCode: "TOM",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 4200, institution: "Chase", owner: null },
      { name: "Checking", type: "CHECKING", balance: 2800, institution: "Chase", owner: 0 },
      { name: "Savings", type: "SAVINGS", balance: 5500, institution: "Ally", owner: 0 },
      { name: "Checking", type: "CHECKING", balance: 2100, institution: "Wells Fargo", owner: 1 },
      { name: "Savings", type: "SAVINGS", balance: 3200, institution: "Capital One", owner: 1 },
    ],
    shared: [
      { amount: 2200, category: "Housing", description: "Rent", merchant: "Property Manager", day: 1, enterBy: 0 },
      { amount: 110, category: "Housing", description: "Utilities", merchant: "ConEd", day: 5, enterBy: 0 },
      { amount: 55, category: "Housing", description: "Internet", merchant: "Verizon", day: 8, enterBy: 1 },
      { amount: 35, category: "Subscriptions", description: "Shared subscriptions", merchant: "Various", day: 3, enterBy: 0 },
    ],
    partner0: [
      { amount: 380, category: "Groceries + Dining", description: "Groceries", merchant: "Trader Joe's", day: 12 },
      { amount: 127, category: "Transport", description: "Subway", merchant: "MTA", day: 1 },
      { amount: 140, category: "Fun + Entertainment", description: "Going out", merchant: "Various", day: 16 },
      { amount: 65, category: "Shopping", description: "Misc shopping", merchant: "Amazon", day: 20 },
    ],
    partner1: [
      { amount: 290, category: "Groceries + Dining", description: "Groceries + takeout", merchant: "Various", day: 11 },
      { amount: 150, category: "Transport", description: "Gas + insurance", merchant: "Geico", day: 10 },
      { amount: 95, category: "Fun + Entertainment", description: "Entertainment", merchant: "Various", day: 14 },
      { amount: 40, category: "Personal Care", description: "Gym", merchant: "Planet Fitness", day: 1 },
    ],
  },

  // ── Couple 7: Alex & Elena (Yale SOM professor + Yelp PM, dual-income, established) ──
  {
    emails: ["alex@parity.app", "elena@parity.app"],
    names: ["Alex", "Elena"],
    inviteCode: "ALEX",
    accounts: [
      { name: "Joint Checking", type: "CHECKING", balance: 18400, institution: "Chase", owner: null },
      { name: "Joint Savings", type: "SAVINGS", balance: 62000, institution: "Ally", owner: null },
      { name: "Alex's Checking", type: "CHECKING", balance: 9200, institution: "Chase", owner: 0 },
      { name: "TIAA Retirement", type: "INVESTMENT", balance: 215000, institution: "TIAA", owner: 0 },
      { name: "Fidelity Brokerage", type: "INVESTMENT", balance: 58000, institution: "Fidelity", owner: 0 },
      { name: "Elena's Checking", type: "CHECKING", balance: 8600, institution: "Bank of America", owner: 1 },
      { name: "Vanguard 401k", type: "INVESTMENT", balance: 142000, institution: "Vanguard", owner: 1 },
      { name: "Marcus Savings", type: "SAVINGS", balance: 24500, institution: "Goldman Sachs", owner: 1 },
    ],
    shared: [
      { amount: 4200, category: "Housing", description: "Mortgage", merchant: "Wells Fargo", day: 1, enterBy: 0 },
      { amount: 165, category: "Housing", description: "Utilities", merchant: "Eversource", day: 5, enterBy: 1 },
      { amount: 85, category: "Housing", description: "Internet", merchant: "Spectrum", day: 8, enterBy: 0 },
      { amount: 110, category: "Subscriptions", description: "Streaming + cloud", merchant: "Various", day: 3, enterBy: 1 },
      { amount: 310, category: "Insurance", description: "Home + auto insurance", merchant: "Geico", day: 1, enterBy: 0 },
      { amount: 480, category: "Groceries + Dining", description: "Weekly groceries", merchant: "Whole Foods", day: 7, enterBy: 1 },
      { amount: 220, category: "Fun + Entertainment", description: "Date nights + concerts", merchant: "Various", day: 18, enterBy: 0 },
    ],
    partner0: [
      { amount: 380, category: "Groceries + Dining", description: "Lunches on campus + dinners", merchant: "Various", day: 13 },
      { amount: 240, category: "Transport", description: "Metro-North + parking", merchant: "MTA", day: 2 },
      { amount: 180, category: "Shopping", description: "Books + research materials", merchant: "Amazon", day: 17 },
      { amount: 95, category: "Personal Care", description: "Haircut + grooming", merchant: "Barber", day: 20 },
      { amount: 320, category: "Fun + Entertainment", description: "Faculty dinners + events", merchant: "Various", day: 22 },
    ],
    partner1: [
      { amount: 520, category: "Groceries + Dining", description: "Takeout + coffee", merchant: "Various", day: 12 },
      { amount: 140, category: "Transport", description: "Rideshare", merchant: "Uber", day: 9 },
      { amount: 280, category: "Shopping", description: "Misc shopping", merchant: "Amazon", day: 15 },
      { amount: 160, category: "Personal Care", description: "Self care + skincare", merchant: "Sephora", day: 21 },
      { amount: 90, category: "Healthcare", description: "Pharmacy + copays", merchant: "CVS", day: 14 },
    ],
  },
];

// ── Seed Logic ──

async function seedCouple(c: CoupleDef) {
  const passwordHash = await bcrypt.hash("password", 8);

  const users = [
    await db.user.create({ data: { email: c.emails[0], name: c.names[0], passwordHash } }),
    await db.user.create({ data: { email: c.emails[1], name: c.names[1], passwordHash } }),
  ];

  const partnership = await db.partnership.create({ data: { inviteCode: c.inviteCode } });

  await db.membership.createMany({
    data: [
      { userId: users[0].id, partnershipId: partnership.id },
      { userId: users[1].id, partnershipId: partnership.id },
    ],
  });

  const accounts = await Promise.all(
    c.accounts.map((a) =>
      (db.account.create as Function)({
        data: {
          partnershipId: partnership.id,
          userId: a.owner !== null ? users[a.owner].id : null,
          ownerLabel: a.owner === null ? "JOINT" : a.owner === 0 ? "MINE" : "PARTNER",
          name: a.name,
          type: a.type,
          balance: a.balance,
          institution: a.institution,
        },
      })
    )
  );

  // Generate 3 months of transactions with natural variation
  const now = new Date();
  const txData: any[] = [];
  const jointAccountId = accounts[0].id;

  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);

    const allTx = [
      ...c.shared.map((tx) => ({ ...tx, userIdx: tx.enterBy ?? 0 })),
      ...c.partner0.map((tx) => ({ ...tx, userIdx: 0 })),
      ...c.partner1.map((tx) => ({ ...tx, userIdx: 1 })),
    ];

    for (const tx of allTx) {
      txData.push({
        partnershipId: partnership.id,
        userId: users[tx.userIdx].id,
        accountId: jointAccountId,
        amount: vary(tx.amount, monthsAgo),
        category: tx.category,
        date: new Date(month.getFullYear(), month.getMonth(), tx.day),
        description: tx.description,
        merchant: tx.merchant,
      });
    }
  }

  await db.transaction.createMany({ data: txData });

  console.log(
    `  ✓ ${c.names[0]} & ${c.names[1]} — ${accounts.length} accounts, ${txData.length} transactions (invite: ${c.inviteCode})`
  );

  return { users, partnership, accounts };
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data (preserves Feedback table)
  await db.transaction.deleteMany({});
  await db.goalContribution.deleteMany({});
  await db.goalAllocation.deleteMany({});
  await db.goal.deleteMany({});
  await db.account.deleteMany({});
  await db.membership.deleteMany({});
  await db.partnership.deleteMany({});
  await db.user.deleteMany({});
  console.log("  ✓ Cleared existing data\n");

  // Seed all couples
  for (const c of COUPLES) {
    await seedCouple(c);
  }

  // Add goals for Mo & Andrew only
  const mo = await db.user.findUnique({ where: { email: "mo@parity.app" } });
  const andrew = await db.user.findUnique({ where: { email: "andrew@parity.app" } });
  const partnership = await db.partnership.findUnique({ where: { inviteCode: "DEMO42" } });

  if (mo && andrew && partnership) {
    const emergencyFund = await db.goal.create({
      data: {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Emergency Fund",
        targetAmount: 30000,
        currentAmount: 24000,
        targetDate: new Date("2026-09-01"),
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
        targetDate: new Date("2026-10-15"),
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
        targetDate: new Date("2026-06-01"),
      },
    });

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

    console.log("\n  ✓ Mo & Andrew goals created");
  }

  console.log("\n✅ Seed complete!");
  console.log("\nLogin credentials (all passwords: password):");
  for (const c of COUPLES) {
    console.log(
      `  ${c.emails[0].padEnd(25)} ${c.emails[1].padEnd(25)} (${c.names[0]} & ${c.names[1]})`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
