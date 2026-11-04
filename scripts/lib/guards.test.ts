import { describe, expect, it } from "vitest";
import { databaseHost, isDbResetAllowed, requireEnv } from "./guards";

describe("databaseHost", () => {
  it("returns only the hostname, never credentials", () => {
    const host = databaseHost("postgresql://user:secret@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require");
    expect(host).toBe("ep-example.us-east-2.aws.neon.tech");
    expect(host).not.toContain("secret");
  });

  it("labels a missing or unparseable URL", () => {
    expect(databaseHost(undefined)).toBe("<DATABASE_URL not set>");
    expect(databaseHost("not a url")).toBe("<unparseable DATABASE_URL>");
  });
});

describe("isDbResetAllowed", () => {
  it("is true only for ALLOW_DB_RESET=1", () => {
    expect(isDbResetAllowed({ ALLOW_DB_RESET: "1" })).toBe(true);
    expect(isDbResetAllowed({})).toBe(false);
    expect(isDbResetAllowed({ ALLOW_DB_RESET: "true" })).toBe(false);
    expect(isDbResetAllowed({ ALLOW_DB_RESET: "0" })).toBe(false);
  });
});

describe("requireEnv", () => {
  it("returns the value when set", () => {
    expect(requireEnv({ SEED_PASSWORD: "s3cret" }, "SEED_PASSWORD")).toBe("s3cret");
  });

  it("throws naming the variable when missing or blank", () => {
    expect(() => requireEnv({}, "SEED_PASSWORD")).toThrow("SEED_PASSWORD must be set");
    expect(() => requireEnv({ SEED_PASSWORD: "  " }, "SEED_PASSWORD")).toThrow("SEED_PASSWORD must be set");
  });
});
