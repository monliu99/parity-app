/**
 * Rotates the shared password of the seeded demo accounts (emails ending in
 * @parity.app).
 *
 * The new password is written to a private file instead of being printed:
 *   ~/.config/parity/demo-password   (override with DEMO_PASSWORD_FILE)
 *
 * Rotate (writes to the database):
 *   ROTATE_DEMO_PASSWORDS=1 npx tsx scripts/rotate-demo-passwords.ts
 *   Uses NEW_DEMO_PASSWORD if set, otherwise generates a random one.
 *
 * Verify (read-only):
 *   npx tsx scripts/rotate-demo-passwords.ts --verify
 *   Checks every demo account accepts the saved password. Set
 *   OLD_DEMO_PASSWORD to also confirm the previous password works on none.
 */
import { announceTarget } from "./lib/env";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEMO_EMAIL_SUFFIX = "@parity.app";
const passwordFile =
  process.env.DEMO_PASSWORD_FILE || join(homedir(), ".config", "parity", "demo-password");
const verifyOnly = process.argv.includes("--verify");

announceTarget("rotate-demo-passwords");

neonConfig.webSocketConstructor = ws;
const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
});

async function rotate() {
  if (process.env.ROTATE_DEMO_PASSWORDS !== "1") {
    console.error(
      "Refusing to run: this changes every demo account's password. " +
        "Check the host above, then re-run with ROTATE_DEMO_PASSWORDS=1."
    );
    process.exit(1);
  }

  const password = process.env.NEW_DEMO_PASSWORD || randomBytes(18).toString("base64url");
  if (password.length < 12) {
    console.error("NEW_DEMO_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  // Save the password before touching any hashes, so it can't be lost.
  mkdirSync(dirname(passwordFile), { recursive: true, mode: 0o700 });
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });

  const passwordHash = await bcrypt.hash(password, 8);
  const { count } = await db.user.updateMany({
    where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    data: { passwordHash },
  });
  console.log(
    `Rotated the password for ${count} demo account(s). ` +
      `It is saved in ${passwordFile} (not printed).`
  );
}

async function verify() {
  const password = readFileSync(passwordFile, "utf8").trim();
  const oldPassword = process.env.OLD_DEMO_PASSWORD;
  const users = await db.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    select: { email: true, passwordHash: true },
  });

  let problems = 0;
  for (const user of users) {
    const acceptsNew = await bcrypt.compare(password, user.passwordHash);
    const acceptsOld = oldPassword ? await bcrypt.compare(oldPassword, user.passwordHash) : false;
    if (!acceptsNew || acceptsOld) {
      problems++;
      console.log(`  ✗ ${user.email}: accepts saved password=${acceptsNew}, accepts old=${acceptsOld}`);
    }
  }

  const oldNote = oldPassword ? " and none accept the old one" : "";
  console.log(
    problems === 0
      ? `Checked ${users.length} demo account(s): all accept the saved password${oldNote}.`
      : `Checked ${users.length} demo account(s): ${problems} problem(s).`
  );
  if (problems > 0) process.exitCode = 1;
}

(verifyOnly ? verify() : rotate())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
