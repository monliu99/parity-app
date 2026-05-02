# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the life plan to a hero card, add an activity feed, add a conditional review nudge, compact the financial metric cards, shift the color palette warmer, and wire a review-due badge into the sidebar.

**Architecture:** `app/(app)/dashboard/page.tsx` is a Next.js Server Component — all data fetching lives there and flows down as props. `getLifePlanInsight()` (new) in `lib/ai/insights.ts` replaces the standalone synthesis. Review-due state flows layout → Nav/MobileNav via a new `reviewDue` prop. No new client components are added.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui (base-ui v4), Prisma 7 (Neon/PostgreSQL), Anthropic SDK (`claude-haiku-4-5-20251001`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `app/globals.css` | Warmth shift — 8 CSS variable values |
| Modify | `lib/ai/insights.ts` | Add `getLifePlanInsight()`, remove `getDashboardSynthesis()` |
| Modify | `app/(app)/dashboard/life-plan-card.tsx` | Full hero card: vision, current action, progress ring, AI insight |
| Create | `app/(app)/dashboard/activity-feed.tsx` | Activity feed presentational component |
| Modify | `app/(app)/layout.tsx` | Query review-due, pass `reviewDue` prop to Nav + MobileNav |
| Modify | `components/nav.tsx` | Accept + render `reviewDue?: boolean` badge on Monthly Review |
| Modify | `components/mobile-nav.tsx` | Same badge |
| Modify | `app/(app)/dashboard/page.tsx` | Complete restructure: new hero, net worth, spending, activity feed |
| Delete | `app/(app)/dashboard/synthesis-card.tsx` | Insight moves into life plan hero |

---

## Task 1: CSS Warmth Shift

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update the 8 CSS variables**

In `app/globals.css`, find the `:root {` block and replace these 8 values (the hue shifts from 155 to 80):

```css
  /* Faint sage tint background — #F5F8F5 */
  --background: oklch(0.970 0.006 80);
```
```css
  --secondary: oklch(0.945 0.008 80);
```
```css
  --muted: oklch(0.945 0.008 80);
```
```css
  --border: oklch(0.895 0.012 80);
  --input: oklch(0.895 0.012 80);
```
```css
  --sidebar: oklch(0.950 0.010 80);
```
```css
  --sidebar-accent: oklch(0.930 0.012 80);
```
```css
  --sidebar-border: oklch(0.885 0.012 80);
```

Leave `--foreground`, `--card`, `--primary`, `--accent`, `--destructive`, `--ring`, `--chart-*`, `--earthy-*`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent-foreground`, `--sidebar-ring` unchanged.

- [ ] **Step 2: Run dev server and verify visual warmth**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Background should feel warm off-white (slightly beige) rather than cool sage. Sidebar slightly warmer. Primary moss green unchanged.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (CSS changes don't affect TS).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: shift CSS palette warmer — background/border/sidebar hue 155→80"
```

---

## Task 2: Life Plan AI Insight Function

**Files:**
- Modify: `lib/ai/insights.ts`

- [ ] **Step 1: Add `getLifePlanInsight` below the existing cache in `lib/ai/insights.ts`**

Add this after the existing `synthesisCache` declaration and before `getDashboardSynthesis`:

```typescript
const lifePlanInsightCache = new Map<string, { insight: string; expiresAt: number }>();

export async function getLifePlanInsight(
  partnershipId: string,
  visionStatement: string,
  netWorth: number,
  monthlyBaseline: number | null
): Promise<string> {
  const cached = lifePlanInsightCache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) return cached.insight;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: `You are Parity. Write one observation under 15 words connecting the couple's vision to their finances. Direct, warm, specific. No generic statements. Start with "You" or "You both".`,
      messages: [
        {
          role: "user",
          content: `Vision: "${visionStatement}"
Net worth: $${netWorth.toFixed(0)}
${monthlyBaseline ? `Monthly spending: $${monthlyBaseline.toFixed(0)}/mo` : "No spending data yet"}

Write the observation.`,
        },
      ],
    });
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    lifePlanInsightCache.set(partnershipId, {
      insight: text,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return text;
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/insights.ts
git commit -m "feat: add getLifePlanInsight for life plan hero card"
```

---

## Task 3: Life Plan Hero Card

**Files:**
- Modify: `app/(app)/dashboard/life-plan-card.tsx`

The card loses its collapsible toggle and becomes a full always-open hero. Props change substantially.

- [ ] **Step 1: Replace the entire contents of `life-plan-card.tsx`**

```typescript
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface RoadmapAction {
  month: number;
  title: string;
  description: string;
}

interface LifePlanHeroProps {
  visionStatement: string | null;
  currentAction: RoadmapAction | null;
  progressCompleted: number;
  progressTotal: number;
  insight: string | null;
}

function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <svg width="36" height="36" className="-rotate-90">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-border"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-primary"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xs text-muted-foreground tabular-nums">
        {completed} of {total}
      </span>
    </div>
  );
}

export function LifePlanHero({
  visionStatement,
  currentAction,
  progressCompleted,
  progressTotal,
  insight,
}: LifePlanHeroProps) {
  if (!visionStatement) {
    return (
      <Card className="shadow-card overflow-hidden">
        <CardContent className="px-5 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Your Shared Vision
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create a shared vision to get the most out of Parity.
          </p>
          <Link href="/life-planning" className="text-sm text-primary font-medium hover:underline">
            Start your shared vision →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Your Shared Vision
              </p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{visionStatement}</p>
          </div>
          <ProgressRing completed={progressCompleted} total={progressTotal} />
        </div>

        {/* Current action */}
        {currentAction && (
          <div className="mx-5 mb-4 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-primary font-medium mb-1">This month</p>
            <p className="text-sm text-foreground font-medium">{currentAction.title}</p>
            {currentAction.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{currentAction.description}</p>
            )}
          </div>
        )}

        {/* AI insight + link */}
        <div className="px-5 pb-4 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
          {insight ? (
            <p className="text-xs text-muted-foreground italic leading-relaxed flex-1">{insight}</p>
          ) : (
            <div className="flex-1" />
          )}
          <Link href="/life-planning" className="text-xs text-primary hover:underline shrink-0">
            Update vision →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors in `dashboard/page.tsx` because it still imports `LifePlanCard` (old name). That's fine — they'll be fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/dashboard/life-plan-card.tsx
git commit -m "feat: rework life plan card into always-open hero with progress ring"
```

---

## Task 4: Activity Feed Component

**Files:**
- Create: `app/(app)/dashboard/activity-feed.tsx`

- [ ] **Step 1: Create `app/(app)/dashboard/activity-feed.tsx`**

```typescript
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  type: "goal_contribution" | "transaction" | "review" | "goal_created" | "life_plan";
  description: string;
  createdAt: Date;
  avatarVariant: "primary" | "earthy";
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({
  name,
  variant,
}: {
  name: string;
  variant: "primary" | "earthy";
}) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        variant === "primary"
          ? "bg-primary/15 text-primary"
          : "bg-earthy-light text-earthy-foreground"
      }`}
    >
      {initial}
    </div>
  );
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Recent Activity
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 pb-5">
            <p className="text-sm text-muted-foreground">
              Start building your financial picture together.
            </p>
            <Link href="/transactions" className="text-xs text-primary hover:underline mt-2 inline-block">
              Add your first transaction →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                <Avatar name={item.userName} variant={item.avatarVariant} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors for this new file (the existing page.tsx errors from Task 3 remain — that's fine).

- [ ] **Step 3: Commit**

```bash
git add app/(app)/dashboard/activity-feed.tsx
git commit -m "feat: add ActivityFeed component with avatar initials and relative timestamps"
```

---

## Task 5: Review Badge — Layout + Nav + Mobile Nav

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/nav.tsx`
- Modify: `components/mobile-nav.tsx`

- [ ] **Step 1: Update `app/(app)/layout.tsx` to query review-due state**

Replace the full file contents:

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Nav from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let reviewDue = false;
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    select: { partnershipId: true },
  });
  if (membership) {
    const lastReview = await db.reviewHistory.findFirst({
      where: { partnershipId: membership.partnershipId, skipped: false },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (lastReview) {
      const daysSince = Math.floor(
        (Date.now() - lastReview.completedAt.getTime()) / 86400000
      );
      reviewDue = daysSince >= 30;
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <FeedbackWidget />
      <aside className="hidden md:flex w-56 bg-sidebar border-r border-border flex-shrink-0">
        <Nav
          user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }}
          reviewDue={reviewDue}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-lg tracking-tight text-foreground font-heading italic">
              Parity
            </span>
          </div>
          <MobileNav
            user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }}
            reviewDue={reviewDue}
          />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `reviewDue` prop to `components/nav.tsx`**

In `components/nav.tsx`, update the `NavProps` interface and `navLink` helper, then pass the badge to Monthly Review:

```typescript
interface NavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  reviewDue?: boolean;
}
```

Update the `navLink` helper to accept an optional `badge` param:

```typescript
  const navLink = (href: string, label: string, Icon: React.ElementType, badge?: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors relative",
        pathname === href
          ? "bg-primary/8 text-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-primary before:rounded-full"
          : "text-muted-foreground font-medium hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
      {badge && (
        <span className="ml-auto h-2 w-2 rounded-full bg-amber-400 shrink-0" />
      )}
    </Link>
  );
```

Update `export default function Nav({ user }: NavProps)` to `export default function Nav({ user, reviewDue }: NavProps)`.

Update the nav items render loop to pass `reviewDue` for the Monthly Review item:

Replace:
```typescript
        {mainNavItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
```
With:
```typescript
        {mainNavItems.map(({ href, label, icon: Icon }) =>
          navLink(href, label, Icon, href === "/review" && reviewDue)
        )}
```

- [ ] **Step 3: Add `reviewDue` prop to `components/mobile-nav.tsx`**

In `components/mobile-nav.tsx`, update `MobileNavProps`:

```typescript
interface MobileNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  reviewDue?: boolean;
}
```

Update `export function MobileNav({ user }: MobileNavProps)` to `export function MobileNav({ user, reviewDue }: MobileNavProps)`.

In the nav items render section, update the Link map to add the badge for Monthly Review:

```typescript
            {mainNavItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors relative",
                  pathname === href
                    ? "bg-primary/8 text-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-primary before:rounded-full"
                    : "text-muted-foreground font-medium hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {href === "/review" && reviewDue && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                )}
              </Link>
            ))}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (the dashboard/page.tsx errors from Task 3 may still be present — that's fine, they'll resolve in Task 6).

- [ ] **Step 5: Commit**

```bash
git add app/(app)/layout.tsx components/nav.tsx components/mobile-nav.tsx
git commit -m "feat: add review-due badge to sidebar and mobile nav"
```

---

## Task 6: Dashboard Page Restructure

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

This is the main wiring task. Replace the entire file.

- [ ] **Step 1: Replace `app/(app)/dashboard/page.tsx`**

```typescript
import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getLifePlanInsight } from "@/lib/ai/insights";
import { getRollingBaseline, getTopCategories } from "@/lib/transactions";
import { CATEGORY_CHART_COLORS, DEFAULT_CHART_COLOR } from "@/lib/category-colors";
import { getCurrentOnboardingStep } from "@/lib/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { LifePlanHero } from "./life-plan-card";
import { ActivityFeed, type ActivityItem } from "./activity-feed";
import { OnboardingFlow } from "@/app/(app)/onboarding/onboarding-flow";
import Link from "next/link";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthsSince(date: Date): number {
  const now = new Date();
  return (
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth())
  );
}

export default async function DashboardPage() {
  const { partnership, userId } = await getPartnership();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [
    accounts,
    goals,
    members,
    lifePlan,
    baseline,
    topCategories,
    lifePlanCount,
    recentTransactions,
    recentContributions,
    recentGoalsCreated,
    lastReview,
  ] = await Promise.all([
    db.account.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.goal.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.membership.findMany({
      where: { partnershipId: partnership.id },
      include: { user: true },
    }),
    db.lifePlan.findFirst({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
    }),
    getRollingBaseline(partnership.id),
    getTopCategories(partnership.id, currentMonth),
    db.lifePlan.count({ where: { partnershipId: partnership.id } }),
    db.transaction.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
    db.goalContribution.findMany({
      where: { goal: { partnershipId: partnership.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { name: true } },
        goal: { select: { name: true } },
      },
    }),
    db.goal.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.reviewHistory.findFirst({
      where: { partnershipId: partnership.id, skipped: false },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, month: true },
    }),
  ]);

  // Names
  const myName = members.find((m) => m.userId === userId)?.user.name ?? null;
  const partnerName =
    members.find((m) => m.userId !== userId)?.user.name ?? "Partner";
  const hasPartner = members.some((m) => m.userId !== userId);
  const myFirst = myName?.split(" ")[0] ?? null;
  const partnerFirst = partnerName.split(" ")[0];
  const pageTitle =
    hasPartner && myFirst ? `${myFirst} & ${partnerFirst}` : myFirst ?? "Dashboard";

  // Net worth — shared vs personal split
  const sharedAccounts = accounts.filter((a) => a.userId === null);
  const personalAccounts = accounts.filter((a) => a.userId !== null);
  const sharedTotal = sharedAccounts.reduce((sum, a) => sum + a.balance, 0);
  const personalTotal = personalAccounts.reduce((sum, a) => sum + a.balance, 0);
  const combinedNetWorth = sharedTotal + personalTotal;
  const sharedPct =
    combinedNetWorth > 0 ? Math.round((sharedTotal / combinedNetWorth) * 100) : 0;
  const personalPct = 100 - sharedPct;

  // Review nudge
  const daysSinceReview = lastReview
    ? Math.floor((Date.now() - lastReview.completedAt.getTime()) / 86400000)
    : null;
  const reviewDue = daysSinceReview !== null && daysSinceReview >= 30;

  // Onboarding state
  const currentStep = getCurrentOnboardingStep(
    accounts.length,
    lifePlanCount,
    goals.length,
    members.length
  );

  // Life plan: current action + AI insight
  const roadmapArray = Array.isArray(lifePlan?.roadmap) ? lifePlan.roadmap as Array<{ month: number; title: string; description: string }> : [];
  const currentMonthIndex = lifePlan
    ? Math.min(Math.max(0, monthsSince(lifePlan.createdAt)), 11)
    : 0;
  const currentAction =
    roadmapArray.find((item) => item.month === currentMonthIndex + 1) ?? null;
  const progressTotal = roadmapArray.length || 12;
  const progressCompleted = 0; // placeholder until Goals spec lands

  const insight =
    lifePlan?.visionStatement
      ? await getLifePlanInsight(
          partnership.id,
          lifePlan.visionStatement,
          combinedNetWorth,
          baseline?.average ?? null
        )
      : null;

  // Activity feed
  const activityItems: ActivityItem[] = [
    ...recentTransactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user.name,
      type: "transaction" as const,
      description: `Logged ${t.category}${t.merchant ? ` — ${t.merchant}` : ""} · ${formatCurrency(Math.abs(t.amount))}`,
      createdAt: t.createdAt,
      avatarVariant: (t.userId === userId ? "primary" : "earthy") as "primary" | "earthy",
    })),
    ...recentContributions.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name,
      type: "goal_contribution" as const,
      description: `Added ${formatCurrency(c.amount)} to ${c.goal.name}`,
      createdAt: c.createdAt,
      avatarVariant: (c.userId === userId ? "primary" : "earthy") as "primary" | "earthy",
    })),
    ...recentGoalsCreated.map((g) => {
      const member = members.find((m) => m.userId === g.userId);
      return {
        id: `goal-${g.id}`,
        userId: g.userId ?? partnership.id,
        userName: member?.user.name ?? "You both",
        type: "goal_created" as const,
        description: `Created goal: ${g.name}`,
        createdAt: g.createdAt,
        avatarVariant: (g.userId === userId ? "primary" : "earthy") as "primary" | "earthy",
      };
    }),
    ...(lifePlan
      ? [
          {
            id: `lifeplan-${lifePlan.id}`,
            userId: partnership.id,
            userName: "You both",
            type: "life_plan" as const,
            description: "Updated your shared life plan",
            createdAt: lifePlan.updatedAt,
            avatarVariant: "primary" as "primary" | "earthy",
          },
        ]
      : []),
    ...(lastReview
      ? [
          {
            id: `review-${lastReview.month}`,
            userId: partnership.id,
            userName: "You both",
            type: "review" as const,
            description: `Completed ${lastReview.month} review`,
            createdAt: lastReview.completedAt,
            avatarVariant: "primary" as "primary" | "earthy",
          },
        ]
      : []),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your financial picture, together.
        </p>
      </div>

      <OnboardingFlow
        currentStep={currentStep}
        inviteCode={partnership.inviteCode}
        partnershipId={partnership.id}
      >
        <>
          {/* Life Plan Hero */}
          <LifePlanHero
            visionStatement={lifePlan?.visionStatement ?? null}
            currentAction={currentAction}
            progressCompleted={progressCompleted}
            progressTotal={progressTotal}
            insight={insight}
          />

          {/* Review nudge (conditional) */}
          {reviewDue && daysSinceReview !== null && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-100">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-sm text-amber-800">
                It&apos;s been {daysSinceReview} days since your last review
              </span>
              <Link
                href="/review"
                className="text-sm font-semibold text-amber-700 hover:underline ml-auto shrink-0"
              >
                Start review →
              </Link>
            </div>
          )}

          {/* Net Worth + Spending — 2-col on sm+, stacked on mobile */}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 items-stretch">
            {/* Net Worth */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Net Worth
                  </p>
                  {combinedNetWorth > 0 ? (
                    <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                      {formatCurrency(combinedNetWorth)}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-tight mt-2">$0</p>
                  )}
                </div>

                {combinedNetWorth > 0 && (
                  <div className="px-5 pb-3">
                    {/* Split bar */}
                    <div className="h-2 rounded-full overflow-hidden flex mb-2">
                      <div
                        className="h-full bg-primary rounded-l-full"
                        style={{ width: `${sharedPct}%` }}
                      />
                      <div
                        className="h-full bg-earthy flex-1 rounded-r-full"
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Shared {sharedPct}%</span>
                      <span className="text-xs text-muted-foreground">Personal {personalPct}%</span>
                    </div>
                  </div>
                )}

                <div className="px-5 py-3 flex-1 flex items-end border-t border-border/50">
                  {combinedNetWorth > 0 ? (
                    <Link href="/accounts" className="text-xs text-primary hover:underline">
                      Details →
                    </Link>
                  ) : (
                    <Link href="/accounts" className="text-xs text-primary hover:underline">
                      Add your first account →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Spending */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Monthly Spending
                  </p>
                  {baseline ? (
                    <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                      {formatCurrency(baseline.average)}
                      <span className="text-base font-normal text-muted-foreground">/mo</span>
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-tight mt-2">—</p>
                  )}
                </div>

                {topCategories.length > 0 && (
                  <div className="px-5 pb-3 space-y-2">
                    <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                      {topCategories.slice(0, 3).map((c, i) => {
                        const pct =
                          baseline && baseline.average > 0
                            ? (c.amount / baseline.average) * 100
                            : 0;
                        const color =
                          CATEGORY_CHART_COLORS[c.category] ?? DEFAULT_CHART_COLOR;
                        return (
                          <div
                            key={c.category}
                            className={`h-full ${i === 0 ? "rounded-l-full" : ""} ${i === topCategories.slice(0, 3).length - 1 ? "rounded-r-full" : ""}`}
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {topCategories.slice(0, 3).map((c) => {
                        const pct =
                          baseline && baseline.average > 0
                            ? Math.round((c.amount / baseline.average) * 100)
                            : 0;
                        const color =
                          CATEGORY_CHART_COLORS[c.category] ?? DEFAULT_CHART_COLOR;
                        return (
                          <div key={c.category} className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-sm shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {c.category} {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="px-5 py-3 flex-1 flex items-end border-t border-border/50">
                  {baseline ? (
                    <Link href="/transactions" className="text-xs text-primary hover:underline">
                      Details →
                    </Link>
                  ) : (
                    <Link href="/transactions" className="text-xs text-primary hover:underline">
                      Add transactions →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed */}
          <ActivityFeed items={activityItems} />
        </>
      </OnboardingFlow>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Start dev server and verify the dashboard**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Verify:
- Life plan hero shows at the top (or CTA if no plan)
- Progress ring visible (shows 0 of 12)
- Net worth card shows shared/personal split bar
- Spending card is compact with 3-category bar
- Activity feed shows recent items with avatar initials
- No goals card, no standalone synthesis card
- Review nudge appears if >30 days since last review (check with demo data)

- [ ] **Step 4: Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "feat: restructure dashboard — life plan hero, activity feed, review nudge, compact cards"
```

---

## Task 7: Cleanup

**Files:**
- Delete: `app/(app)/dashboard/synthesis-card.tsx`
- Modify: `lib/ai/insights.ts` (remove `getDashboardSynthesis`)

- [ ] **Step 1: Delete synthesis-card.tsx**

```bash
rm app/(app)/dashboard/synthesis-card.tsx
```

- [ ] **Step 2: Remove `getDashboardSynthesis` from `lib/ai/insights.ts`**

Delete the `synthesisCache` declaration and the entire `getDashboardSynthesis` function. Keep `lifePlanInsightCache` and `getLifePlanInsight`. The file should now export only `getLifePlanInsight`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: successful build with no type errors or missing module errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove synthesis card and getDashboardSynthesis — insight now in life plan hero"
```
