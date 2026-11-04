// Runtime validation for server-action inputs.
//
// Server actions are public HTTP endpoints. Their arguments come from the
// client, and TypeScript parameter types are not enforced at runtime. A value
// that isn't a plain id string (an object, an array, an empty string) can
// change what a Prisma `where` clause matches, so every client-supplied id must
// pass through assertId before it reaches the database.

/** Thrown when a server action receives malformed input. */
export class InvalidInputError extends Error {
  constructor(message = "Invalid request") {
    super(message);
    this.name = "InvalidInputError";
  }
}

// Prisma's cuid ids are lowercase alphanumerics. This also allows uuids and
// other url-safe ids, but rejects anything that isn't a short plain string.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Returns `value` if it is a well-formed id string, otherwise throws. */
export function assertId(value: unknown, label = "id"): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new InvalidInputError(`Invalid ${label}`);
  }
  return value;
}

/** Like assertId, but treats null, undefined and "" as "no id". */
export function optionalId(value: unknown, label = "id"): string | null {
  if (value === null || value === undefined || value === "") return null;
  return assertId(value, label);
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Returns `value` if it is a "YYYY-MM" month key, otherwise throws. */
export function assertMonthKey(value: unknown): string {
  if (typeof value !== "string" || !MONTH_KEY_PATTERN.test(value)) {
    throw new InvalidInputError("Invalid month");
  }
  return value;
}
