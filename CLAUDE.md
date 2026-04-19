# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Parity Is

**Parity** is an AI-native tool for managing a life together — not just a financial app. The core insight: couples don't lack budgeting tools, they lack a shared operating system for joint decisions. Parity gives couples a real-time, unified view of their financial picture and uses AI to surface what matters, prompt the right conversations, and reduce the mental load of managing money together.

**Target users:** Committed couples aged 25–40, combined household income ~$140K+, digitally fluent, actively navigating shared financial decisions.

**Core thesis:** AI-powered shared visibility and alignment — not budgeting, not splitting, not surveillance. The AI is framed around the couple as a unit: curious, forward-looking, never accusatory.

**AI tone (enforced in all prompts):** Use "you" / "you both". Observations, not judgments. Forward-looking ("at this pace…"). Never accusatory. Under 15 words per insight.

## Commands

```bash
npm run dev                           # Start dev server on localhost:3000
npm run build                         # prisma generate + next build
npm run lint                          # ESLint
npx tsc --noEmit                      # Type check without building
npx prisma migrate dev --name <name>  # Create and apply a migration (see note)
npx prisma generate                   # Regenerate Prisma client after schema changes
npx prisma studio                     # Open DB browser UI at localhost:5555
npx tsx scripts/seed.ts               # Seed Neon DB with demo data
```

**Prisma migrate note:** `prisma migrate dev` tends to hang in this environment. If it does, apply schema changes directly via a raw SQL script or Neon console, then run `prisma generate` separately.

**Seed credentials:** `mo@parity.app` / `password` and `andrew@parity.app` / `password` (invite code: `DEMO42`).

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui (base-ui v4) + Prisma 7 (Neon/PostgreSQL) + NextAuth v5 beta + Anthropic SDK

> **IMPORTANT — Next.js 16:** This is NOT the Next.js you know from training data. APIs and conventions have changed. Read `node_modules/next/dist/docs/` before writing Next.js-specific code.

### Key files

- `auth.ts` — Full NextAuth v5 config (credentials provider, JWT, bcrypt). Import `{ auth, signIn, signOut, handlers }` from here.
- `auth.config.ts` — Edge-safe config (no DB imports). Used by `proxy.ts` only.
- `proxy.ts` — **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** Do NOT create a `middleware.ts` — having both causes a server crash.
- `lib/db.ts` — Prisma singleton using `PrismaNeon` adapter. Connects to Neon via `DATABASE_URL`.
- `lib/partnership.ts` — `getPartnership()` used by all protected server components/actions. Returns `{ partnership, userId }` and redirects to `/login` if unauthenticated.
- `lib/onboarding.ts` — Onboarding state utilities: `getCurrentOnboardingStep()`, `shouldShowOnboarding()`.
- `app/generated/prisma/` — Generated Prisma client. **Import from here, not `@prisma/client`.**
- `prisma.config.ts` — Prisma config; loads `.env` via `dotenv/config`.

### Route groups

- `app/(auth)/` — `login`, `signup` (public, no nav)
- `app/(app)/` — Protected pages: `dashboard`, `accounts`, `transactions`, `goals`, `chat`, `settings`, `budget`, `onboarding`. Layout at `app/(app)/layout.tsx` has responsive sidebar (`hidden md:flex`) and mobile header with hamburger menu.
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handler. Must use `export const { GET, POST } = handlers`.

### Key components

- `components/nav.tsx` — Desktop sidebar navigation with logo, main nav items, profile section with settings/sign out.
- `components/mobile-nav.tsx` — Mobile slide-out drawer using Sheet component. Reuses same nav items and profile section.
- `app/(app)/dashboard/spending-trends-chart.tsx` — 4-month stacked area chart showing spending trends over time.
- `app/(app)/onboarding/onboarding-flow.tsx` — 3-step wizard (account → transaction → goal) for new users.
- `components/onboarding/onboarding-step.tsx` — Reusable onboarding step card component.

### Auth pattern

Two layers of protection:
1. **Edge (`proxy.ts`):** Runs `authConfig.authorized` on every request — redirects unauthenticated users to `/login`, redirects logged-in users away from auth pages.
2. **Server (`getPartnership()`):** Called at the top of every protected page/action. Confirms session, fetches membership, and always scopes subsequent DB queries to `partnershipId`.

Never query across partnership boundaries — always filter by `partnershipId`.

### Data model

```
User          id, email, name, passwordHash
Partnership   id, inviteCode (6-char uppercase)
Membership    userId + partnershipId (composite PK; max 2 per partnership enforced in app)
Account       id, partnershipId, userId (owner), ownerLabel, name, type, balance, institution
Transaction   id, partnershipId, accountId, userId (enterer), ownerLabel (MINE|PARTNER|JOINT), merchant, amount, category, date, notes
Goal          id, partnershipId, userId (null=joint), ownerLabel (JOINT|PERSONAL), name, targetAmount, currentAmount, targetDate, notes
```

**Viewer-relative ownership:** `ownerLabel` is from the *enterer's* perspective. To display "Mine" vs "Partner's" correctly, check `record.userId === currentUserId`. If the enterer is you and `ownerLabel === "MINE"` → display "Mine". If the enterer is your partner and `ownerLabel === "MINE"` → display "Partner's". `JOINT` always displays as "Joint".

**Signup flow:** First partner signs up (no invite code) → creates User + Partnership. Second partner signs up with the invite code → joins existing Partnership. Max 2 members enforced in `signup/actions.ts`.

### AI features

All integrations use the Anthropic SDK directly (no streaming):

1. **`lib/ai/categorize.ts`** — `claude-haiku-4-5-20251001`. Called on every transaction save (in `transactions/actions.ts`). Returns one of 11 fixed categories. Fails silently → "Other".
2. **`lib/ai/insights.ts`** — `claude-haiku-4-5-20251001`. Called on dashboard load. Returns 2–3 insight strings as a JSON array. Cached 1 hour per `partnershipId` in a module-level `Map`.
3. **`lib/ai/chat.ts`** — `claude-haiku-4-5-20251001`. Stateless. Full context (all accounts, 60-day transactions capped at 100, all goals) sent each call. Invoked via `chat/actions.ts` server action.
4. **`lib/ai/budget.ts`** — `claude-haiku-4-5-20251001`. Three exported functions, each with its own in-memory cache:
   - `generateBudgetSuggestions(partnershipId, month, historicalByCategory)` — per-category budget amounts from 90-day spending history. 24h TTL. Called by `generateBudgetAction` in `budget/actions.ts`.
   - `generateNextMonthPlan(...)` — full next-month plan: `categoryBudgets`, `contextSummary` bullets, `discussionPrompts`. 6h TTL. Called by `generateNextMonthPlanAction`.
   - `getBudgetInsight(partnershipId, month, budgetRows, daysLeft)` — single-sentence budget status (≤20 words). 2h TTL. Called directly in `budget/page.tsx` (current month only; skipped for past months).

### Design system

**Type scale** — exactly 5 tiers. Emphasis within a tier comes from `font-medium|semibold|bold` and color, never from bumping to a bigger size.

| Tier | Class | Use |
|---|---|---|
| **Display** | `text-5xl font-bold tabular-nums` | Exactly ONE hero number per page (currently: dashboard net worth). Nothing else. |
| **Stat** | `text-3xl font-bold tabular-nums` | Summary card big numbers (transactions totals, budget totals) when the number stands alone on its own line with an eyebrow label above. |
| **Title** | `text-2xl font-bold` | Page H1 only. |
| **Body** | `text-sm` | Default for EVERYTHING else — list row labels + amounts, inline amounts, buttons, subtitles, AI insight bodies, form fields, empty-state text. Vary weight (`font-medium` / `font-semibold` / `font-bold`) and color (`text-foreground` / `text-muted-foreground` / `text-emerald-600` / `text-amber-600`) for emphasis. |
| **Meta** | `text-xs` | Eyebrow labels (`uppercase tracking-widest font-medium text-muted-foreground`), dates, counts, captions, helper text, badges (`text-xs border-0`). |

**Ironclad rule:** any two text elements on the same visual line must use the same tier. If a label and amount sit in one row, they're both `text-sm` (Body) or both `text-xs` (Meta). Stat-tier numbers always live on their own line with an eyebrow Meta label above.

**Page subtitle pattern:** `text-sm text-muted-foreground mt-1` (explicit, always under H1).

**Sign/outcome colors** — use across all pages:
- Positive / income / gain: `text-emerald-600`
- Negative / warning / over-budget: `text-amber-600` (never `text-red-*`)
- Near-limit / caution: `text-amber-500`
- Neutral text emphasis: `text-foreground`

**List rows** — use this pattern on all item rows (accounts, transactions, goals):
```
relative flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors group
```
Action buttons: `absolute right-1 top-1/2 -translate-y-1/2 ... opacity-0 group-hover:opacity-100 bg-secondary rounded-md` — always absolutely positioned so they never shift the amount column.

**Category colors** — single source of truth in `lib/category-colors.ts`. Exports `CATEGORY_BADGE_CLASSES` (Tailwind classes for badges) and `CATEGORY_CHART_COLORS` (hex for recharts). Import from there; never duplicate inline. Only transaction category badges are colorful — Joint/Personal/type badges use `bg-secondary text-secondary-foreground`.

**Fonts** — `font-heading italic` for the Parity logo (not inline `style` prop). Never use Playfair for numbers.

**AI insight cards** — plain `shadow-card` white, same as all other cards. No earthy background tint.

### UI component notes (base-ui v4 / shadcn)

- No `asChild` prop — use `render={<element />}` on `DialogTrigger` instead.
- `Select.onValueChange` passes `string | null` — guard with `(v) => v && setState(v)`.
- Components live in `components/ui/`: `badge`, `button`, `card`, `dialog`, `input`, `label`, `progress`, `select`, `separator`, `sheet`.

## Environment Variables

```
AUTH_SECRET=          # NextAuth v5 uses AUTH_SECRET (not NEXTAUTH_SECRET)
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=
DATABASE_URL="postgresql://..."  # Neon connection string
```

## Deployment

- **Production URL:** https://withparity.vercel.app
- **Vercel project:** `parity-app` (team: `monliu99s-projects`)
- Deploy to production: `vercel --prod`
- Env vars are managed via `vercel env add <NAME> production preview` — do NOT add sensitive vars to `development` target (Vercel blocks it); use `.env.local` locally instead.
- Both `NEXTAUTH_URL` and `AUTH_URL` must be set to `https://withparity.vercel.app` in Vercel — never a per-deployment URL (e.g. `parity-xyz-monliu99s-projects.vercel.app`), which gets garbage-collected and breaks auth callbacks.

## Current State (Phase 1 Complete)

**Phase 1 — Polish & Demo-Ready** is complete. The app is fully functional for demo, class presentation, or early user testing.

**Completed Phase 1 features:**
- ✅ Mobile responsiveness with slide-out drawer navigation
- ✅ 3-step onboarding wizard for new users
- ✅ Inline account balance quick-edit
- ✅ Global error boundaries and action error handling
- ✅ Dashboard enhancements: Cash Flow Summary, Spending Trends Chart (4-month), Budget Health widget, Recent Activity feed, Goal urgency indicators, Account highlights

**Next phase:** Phase 2 — Bank Integration (Plaid) when ready for production users.
