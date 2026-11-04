import { describe, expect, it } from "vitest";
import { InvalidInputError, assertId, assertMonthKey, optionalId } from "./validate";

describe("assertId", () => {
  it("accepts Prisma cuids and other plain url-safe ids", () => {
    expect(assertId("cmhk2x0ab0000l8rt5u3y9zqp")).toBe("cmhk2x0ab0000l8rt5u3y9zqp");
    expect(assertId("3f2b9c1e-8d4a-4b6e-9f00-123456789abc")).toBe("3f2b9c1e-8d4a-4b6e-9f00-123456789abc");
  });

  it("rejects values that could widen a Prisma where clause", () => {
    for (const bad of [{ not: "" }, { in: ["a", "b"] }, ["a"], 42, null, undefined, true]) {
      expect(() => assertId(bad)).toThrow(InvalidInputError);
    }
  });

  it("rejects empty, overlong and non-url-safe strings", () => {
    for (const bad of ["", " ", "a".repeat(65), "id with spaces", "abc'); DROP", "a/b"]) {
      expect(() => assertId(bad)).toThrow(InvalidInputError);
    }
  });

  it("names the field in the error", () => {
    expect(() => assertId({}, "goal id")).toThrow("Invalid goal id");
  });
});

describe("optionalId", () => {
  it("maps null, undefined and empty string to null", () => {
    expect(optionalId(null)).toBeNull();
    expect(optionalId(undefined)).toBeNull();
    expect(optionalId("")).toBeNull();
  });

  it("validates anything else like assertId", () => {
    expect(optionalId("cmhk2x0ab0000l8rt5u3y9zqp")).toBe("cmhk2x0ab0000l8rt5u3y9zqp");
    expect(() => optionalId({ not: "" })).toThrow(InvalidInputError);
  });
});

describe("assertMonthKey", () => {
  it("accepts YYYY-MM", () => {
    expect(assertMonthKey("2026-11")).toBe("2026-11");
    expect(assertMonthKey("2026-01")).toBe("2026-01");
  });

  it("rejects other shapes", () => {
    for (const bad of ["2026-13", "2026-00", "2026-1", "26-11", "2026-11-01", { not: "" }, 202611]) {
      expect(() => assertMonthKey(bad)).toThrow(InvalidInputError);
    }
  });
});
