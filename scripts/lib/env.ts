// Loads .env.local for scripts. Import this before anything reads process.env.
//
// Precedence: variables already set in the shell win over .env.local (dotenv's
// default). Never pass `override: true`, or an explicit DATABASE_URL would be
// silently replaced by whatever .env.local points at.
import { config } from "dotenv";
import { resolve } from "path";
import { databaseHost, isDbResetAllowed } from "./guards";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

/** Prints which database host a script is about to use. */
export function announceTarget(scriptName: string): void {
  console.log(`[${scriptName}] database host: ${databaseHost(process.env.DATABASE_URL)}`);
}

/** Exits unless ALLOW_DB_RESET=1. Call before the script touches the database. */
export function guardDestructive(scriptName: string): void {
  announceTarget(scriptName);
  if (!isDbResetAllowed(process.env)) {
    console.error(
      `[${scriptName}] Refusing to run: this script deletes data. ` +
        "Check the host above, then re-run with ALLOW_DB_RESET=1."
    );
    process.exit(1);
  }
}
