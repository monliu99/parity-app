import "dotenv/config";
import { db } from "../lib/db";

async function main() {
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
