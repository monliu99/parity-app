# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Parity Is

**Parity improves relationship harmony by enabling couples to collectively own their finances.**

It's a relationship app that uses money as the topic — not a finance app. Target users: couples facing life transitions (moving in together, marriage, buying a home, having a baby) who want to align on their financial future together.

**Core value:** Make implicit financial assumptions explicit. AI facilitates the conversation, surfaces what you're missing, and frames everything as "you both" (never blame).

**AI tone:** Neutral, invisible, observational. "you" / "you both". Under 15 words per insight.

## Commands

```bash
npm run dev              # Start dev server on localhost:3000
npm run build            # prisma generate + next build
npm run lint             # ESLint
npx tsc --noEmit         # Type check without building
npx prisma generate      # Regenerate Prisma client after schema changes
npx tsx scripts/seed.ts  # Seed Neon DB with demo data
```

**Seed credentials:** `mo@parity.app` / `password` and `andrew@parity.app` / `password` (invite code: `DEMO42`).

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui (base-ui v4) + Prisma 7 (Neon/PostgreSQL) + NextAuth v5 beta + Anthropic SDK

### Key files
- `auth.ts` — NextAuth v5 config. Import `{ auth, signIn, signOut, handlers }` from here.
- `proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts`. Do NOT create a `middleware.ts`.
- `lib/partnership.ts` — `getPartnership()` used by all protected pages. Returns `{ partnership, userId }`.
- `app/generated/prisma/` — Import Prisma client from here, not `@prisma/client`.

### Auth pattern
Two layers: Edge (`proxy.ts`) + Server (`getPartnership()`). Always scope queries to `partnershipId`.

### Data model
```
User, Partnership, Membership (max 2), Account, Transaction, Budget, Goal
```

**Viewer-relative ownership:** `ownerLabel` is from the *enterer's* perspective. Check `record.userId === currentUserId` to display correctly.

### Pages (app/(app)/)
- `/dashboard` — Financial overview: synthesis card, net worth, spending trends (MoM bar chart), budget status, goals progress, account highlights
- `/accounts` — Account management (joint/personal)
- `/transactions` — Transaction list with month grouping, colored category badges
- `/goals` — Shared goal tracking
- `/budget` — AI-generated budget suggestions per category with user overrides
- `/chat` — AI Q&A ("Ask Parity")
- `/settings` — Partnership management
- `/life-planning` — Tabbed page (Vision / Priorities / Insights) for returning users; wizard flow for first-timers. Vision editable inline, priorities reorderable, Insights tab shows spending alignment score + signals from last review.
- `/review` — Monthly review: alignment score, tension/on-track signals, decision logging, AI goal adjustment suggestions
- `/onboarding` — 3-step wizard (account → transaction → goal)

### Dashboard components
- `synthesis-card.tsx` — AI narrative insight ("Parity's take")
- `spending-trends-chart.tsx` — MoM grouped bar chart, top 8 categories
- `life-plan-card.tsx` — Collapsible shared vision with current roadmap action

### AI features
All use Anthropic SDK directly (no streaming), currently `claude-haiku-4-5-20251001`:
- `lib/ai/categorize.ts` — Transaction categorization (11 categories)
- `lib/ai/insights.ts` — Dashboard synthesis (narrative) + spending insights (structured)
- `lib/ai/chat.ts` — Q&A with full transaction context (60-day window)
- `lib/ai/life-planning.ts` — Vision, reality check, priorities, roadmap generation; `generateRealityCheckCards()`, `generatePlanInsights()`
- `lib/ai/monthly-review.ts` — Review signal detection, insight + suggestion generation
- `lib/ai/goal-inference.ts` — Auto-generate goals from life plan roadmap

### Design system
**Type scale:** 4 tiers only. Hero (`text-3xl`), Title (`text-2xl`), Body (`text-sm`), Meta (`text-xs`). Same line = same tier.

**Colors:** Positive: `text-emerald-600`. Warning: `text-amber-700` (never `text-red-*`).

**Category colors:** `lib/category-colors.ts` — badge classes and chart hex values for all 11 spending categories.

**UI components:** No `asChild` — use `render={<element />}`. `Select.onValueChange` passes `string | null` — guard with `(v) => v && setState(v)`.

### Navigation
- **Desktop:** `components/nav.tsx` — sidebar with Dashboard, Accounts, Transactions, Budget, Goals, Ask Parity
- **Mobile:** `components/mobile-nav.tsx` — slide-out Sheet with same nav items

## Current State

**All features shipped on `main`.** Transaction-centric model. Budget is AI-generated suggestions (not manual). Life plan connects vision to trackable goals. Monthly review closes the loop with alignment scoring.

**Core features:**
1. **Dashboard** — Net worth, spending trends (MoM chart), budget status, goals, AI synthesis
2. **Accounts + Transactions** — Full CRUD with colored categories, AI auto-categorization
3. **Budget** — AI-generated per-category suggestions with user overrides
4. **Life Planning** — Tabbed page: Vision (editable + reality check cards), Priorities (reorderable), Insights (alignment score + signals). First-timers see the wizard; returning users see the tabbed view with a "Re-run wizard" escape hatch. Completing a monthly review writes a `LifePlanSnapshot` that populates the Insights tab.
5. **Goals** — Two sections: Roadmap Actions (from life plan) + Financial Goals. Auto-generated or manual.
6. **Monthly Review** — Alignment score, tension/on-track signals, decision logging, AI-suggested goal adjustments.
7. **Chat** — Context-aware AI Q&A
