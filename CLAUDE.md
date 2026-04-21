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
User, Partnership, Membership (max 2), Account, Transaction, Goal
```

**Viewer-relative ownership:** `ownerLabel` is from the *enterer's* perspective. Check `record.userId === currentUserId` to display correctly.

### AI features
All use Anthropic SDK directly (no streaming), currently `claude-haiku-4-5-20251001`:
- `lib/ai/categorize.ts` — Transaction categorization
- `lib/ai/insights.ts` — Dashboard synthesis
- `lib/ai/chat.ts` — Q&A ("Ask Parity")
- `lib/ai/budget.ts` — Budget suggestions and insights

### Design system
**Type scale:** 4 tiers only. Hero (`text-3xl`), Title (`text-2xl`), Body (`text-sm`), Meta (`text-xs`). Same line = same tier.

**Colors:** Positive: `text-emerald-600`. Warning: `text-amber-700` (never `text-red-*`).

**UI components:** No `asChild` — use `render={<element />}`. `Select.onValueChange` passes `string | null` — guard with `(v) => v && setState(v)`.

## Current State

**Original MVP (Phase 1):** Live at [withparity.vercel.app](https://withparity.vercel.app). Dashboard, goals, transactions, budget, AI chat.

**Current focus (on `alignment` branch):** Building new MVP centered on **financial alignment for relationship harmony**. Three core features:
1. **Life Planning** — Design your shared life together (entry for Aligners/Planners)
2. **Shared Goals** — Track progress toward your dreams as "ours" not "mine + yours"
3. **Monthly Review** — 15-minute guided check-in to stay on track

**Hypothesis:** Couples will find Parity elucidating — it helps them discover and articulate a shared vision they couldn't articulate alone, and enables conversations they were previously avoiding.
