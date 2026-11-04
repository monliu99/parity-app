import { describe, expect, it } from "vitest";
import { isAdmin, parseAdminEmails } from "./admin";

describe("parseAdminEmails", () => {
  it("splits, trims, lowercases and drops blanks", () => {
    expect(parseAdminEmails(" Admin@Example.com, second@example.com ,, ")).toEqual([
      "admin@example.com",
      "second@example.com",
    ]);
  });

  it("returns an empty list when unset", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });
});

describe("isAdmin", () => {
  const list = "admin@example.com,second@example.com";

  it("matches listed emails case-insensitively", () => {
    expect(isAdmin("admin@example.com", list)).toBe(true);
    expect(isAdmin("SECOND@example.com", list)).toBe(true);
  });

  it("rejects unlisted, empty and missing emails", () => {
    expect(isAdmin("someone@example.com", list)).toBe(false);
    expect(isAdmin("", list)).toBe(false);
    expect(isAdmin(null, list)).toBe(false);
    expect(isAdmin(undefined, list)).toBe(false);
  });

  it("denies everyone when ADMIN_EMAILS is unset", () => {
    expect(isAdmin("admin@example.com", undefined)).toBe(false);
  });
});
