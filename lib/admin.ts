// Admin access comes from configuration, not source code. ADMIN_EMAILS is a
// comma-separated list of email addresses. It's server-only: never expose it
// with a NEXT_PUBLIC_ prefix, and pass client components a boolean instead.

/** Parses an ADMIN_EMAILS value into a normalised list. */
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** True if `email` is listed in ADMIN_EMAILS (case-insensitive). */
export function isAdmin(
  email: string | null | undefined,
  rawAdminEmails: string | undefined = process.env.ADMIN_EMAILS
): boolean {
  if (!email) return false;
  return parseAdminEmails(rawAdminEmails).includes(email.trim().toLowerCase());
}
