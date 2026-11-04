// Pure helpers for scripts/. No side effects on import, so they can be unit-tested.

/** Plain env lookup (process.env satisfies it; tests can pass a literal). */
export type Env = Readonly<Record<string, string | undefined>>;

/** Hostname of a database connection string, never including credentials. */
export function databaseHost(url: string | undefined): string {
  if (!url) return "<DATABASE_URL not set>";
  try {
    return new URL(url).hostname || "<no host>";
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

/** Destructive scripts run only when ALLOW_DB_RESET=1 is set explicitly. */
export function isDbResetAllowed(env: Env): boolean {
  return env.ALLOW_DB_RESET === "1";
}

/** Returns a required, non-blank environment variable or throws naming it. */
export function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} must be set for this script.`);
  }
  return value;
}
