/**
 * Backfill script — creates GoalContribution records for existing joint goals.
 * Run with: npx tsx scripts/backfill-goal-contributions.ts
 *
 * For each joint goal with existing savings, splits the currentAmount evenly
 * between partnership members and creates GoalContribution records.
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
  console.log("🔄 Backfilling goal contributions...");

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
  let totalContributionsCreated = 0;

  for (const partnership of partnerships) {
    // Skip if not exactly 2 members (can't split fairly)
    if (partnership.members.length !== 2) {
      console.log(`  ⏭️  Partnership ${partnership.inviteCode} has ${partnership.members.length} members, skipping`);
      continue;
    }

    const [member1, member2] = partnership.members;

    // Find joint goals with existing savings
    const jointGoals = await db.goal.findMany({
      where: {
        partnershipId: partnership.id,
        ownerLabel: "JOINT",
        currentAmount: { gt: 0 },
      },
    });

    if (jointGoals.length === 0) {
      continue;
    }

    console.log(
      `\n  📊 Partnership ${partnership.inviteCode}: ${jointGoals.length} joint goal(s) to backfill`
    );

    for (const goal of jointGoals) {
      // Check if contributions already exist for this goal
      const existingContributions = await db.goalContribution.count({
        where: { goalId: goal.id },
      });

      if (existingContributions > 0) {
        console.log(`    ⏭️  "${goal.name}" already has contributions, skipping`);
        continue;
      }

      // Split current amount evenly between members
      const amountPerMember = goal.currentAmount / 2;

      await db.goalContribution.createMany({
        data: [
          {
            goalId: goal.id,
            userId: member1.userId,
            amount: amountPerMember,
          },
          {
            goalId: goal.id,
            userId: member2.userId,
            amount: amountPerMember,
          },
        ],
      });

      totalGoalsUpdated++;
      totalContributionsCreated += 2;
      console.log(
        `    ✅ "${goal.name}": ${member1.user.name} & ${member2.user.name} each credited with ${amountPerMember.toFixed(2)}`
      );
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   - ${totalGoalsUpdated} goals updated`);
  console.log(`   - ${totalContributionsCreated} contribution records created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
