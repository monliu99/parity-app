export function formatMonth(month: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + (month - 1));
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
