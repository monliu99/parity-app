/**
 * Backfill script — creates GoalAllocation records for existing joint goals.
 * Run with: npx tsx scripts/backfill-goal-allocations.ts
 *
 * For each joint goal, creates 50/50 allocation records for partnership members.
 */

import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { resolve } from "path";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Backfilling goal allocations...");

  // Get all partnerships
  const partnerships = await db.partnership.findMany({
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  let totalGoalsUpdated = 0;
  let totalAllocationsCreated = 0;

  for (const partnership of partnerships) {
    // Skip if not exactly 2 members (can't split fairly)
    if (partnership.members.length !== 2) {
      console.log(`  ⏭️  Partnership ${partnership.inviteCode} has ${partnership.members.length} members, skipping`);
      continue;
    }

    const [member1, member2] = partnership.members;

    // Find joint goals
    const jointGoals = await db.goal.findMany({
      where: {
        partnershipId: partnership.id,
        ownerLabel: "JOINT",
      },
    });

    if (jointGoals.length === 0) {
      continue;
    }

    console.log(
      `\n  📊 Partnership ${partnership.inviteCode}: ${jointGoals.length} joint goal(s) to backfill`
    );

    for (const goal of jointGoals) {
      // Check if allocations already exist for this goal
      const existingAllocations = await db.goalAllocation.count({
        where: { goalId: goal.id },
      });

      if (existingAllocations > 0) {
        console.log(`    ⏭️  "${goal.name}" already has allocations, skipping`);
        continue;
      }

      // Create 50/50 allocation records
      await (db.goalAllocation.createMany as Function)({
        data: [
          {
            goalId: goal.id,
            userId: member1.userId,
            percentage: 50,
          },
          {
            goalId: goal.id,
            userId: member2.userId,
            percentage: 50,
          },
        ],
      });

      totalGoalsUpdated++;
      totalAllocationsCreated += 2;
      console.log(
        `    ✅ "${goal.name}": ${member1.user.name} & ${member2.user.name} at 50/50`
      );
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   - ${totalGoalsUpdated} goals updated`);
  console.log(`   - ${totalAllocationsCreated} allocation records created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
