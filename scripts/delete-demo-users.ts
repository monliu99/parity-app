/**
 * Deletes the class demo couple (greenie@ / goldie@) and everything in their
 * partnership. DESTRUCTIVE: prints the target host and refuses to run without
 * ALLOW_DB_RESET=1.
 */
import { guardDestructive } from "./lib/env";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

guardDestructive("delete-demo-users");
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // Find the membership/partnership for these users first
  const users = await db.user.findMany({
    where: { email: { in: ["greenie@parity.app", "goldie@parity.app"] } },
    include: { memberships: true },
  });

  const partnershipIds = [...new Set(users.flatMap((u) => u.memberships.map((m) => m.partnershipId)))];

  // Delete partnerships first (cascades to accounts, goals, transactions, contributions, etc.)
  if (partnershipIds.length > 0) {
    const pr = await db.partnership.deleteMany({ where: { id: { in: partnershipIds } } });
    console.log(`Deleted ${pr.count} partnership(s)`);
  }

  // Now delete the users
  const ur = await db.user.deleteMany({
    where: { email: { in: ["greenie@parity.app", "goldie@parity.app"] } },
  });
  console.log(`Deleted ${ur.count} demo users`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
