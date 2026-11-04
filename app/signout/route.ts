import { signOut } from "@/auth";

// Ends the session and returns to /login. getPartnership() sends sessions whose
// user no longer has a partnership here; redirecting them to /login directly
// would loop, because the proxy sends signed-in users from /login to /dashboard.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
