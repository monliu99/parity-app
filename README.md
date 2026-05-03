# Parity

A shared financial operating system for couples. Parity gives partners a unified, real-time view of their financial picture and uses AI to surface what matters, prompt the right conversations, and reduce the mental load of managing money together.

**Production:** [withparity.vercel.app](https://withparity.vercel.app)

---

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui (base-ui v4)
- **Database:** Prisma 7 + Neon (PostgreSQL)
- **Auth:** NextAuth v5 (JWT, credentials provider)
- **AI:** Anthropic SDK (Claude Haiku) — categorization, insights, chat, budget, life planning, monthly review
- **Deployment:** Vercel

---

## Getting Started

```bash
npm install
npm run dev        # starts on localhost:3000
```

### Environment variables

Create a `.env.local` file:

```
AUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=
DATABASE_URL="postgresql://..."   # Neon connection string
```

### Demo accounts

| Email | Password | Role |
|---|---|---|
| `mo@parity.app` | `password` | Partner 1 |
| `andrew@parity.app` | `password` | Partner 2 |

Invite code: `DEMO42`

---

## Commands

```bash
npm run dev                           # Dev server on localhost:3000
npm run build                         # prisma generate + next build
npm run lint                          # ESLint
npx tsc --noEmit                      # Type check
npx prisma generate                   # Regenerate Prisma client after schema changes
npx prisma studio                     # DB browser UI at localhost:5555
npx tsx scripts/seed.ts               # Seed demo data
```

> **Note:** `prisma migrate dev` tends to hang in this environment. Apply schema changes via raw SQL in the Neon console, then run `prisma generate`.

---

## Project Structure

```
app/
  (auth)/          # login, signup — public, no nav
  (app)/           # protected pages with sidebar nav
    dashboard/     # AI synthesis + net worth + spending chart
    accounts/      # account management
    transactions/  # transaction list + AI categorization
    budget/        # AI-generated monthly budgets
    goals/         # roadmap actions + financial goals
    chat/          # AI chat with full financial context
    life-planning/ # tabbed page (Vision/Priorities/Insights) + wizard for first-timers
    review/        # monthly review — alignment score, signals, suggestions
    settings/      # partnership settings + invite code
    onboarding/    # 3-step wizard (account → txn → goal)
  admin/
    feedback/      # feedback review (gated to mo@parity.app)
  api/auth/        # NextAuth handler

lib/
  db.ts            # Prisma singleton (Neon adapter)
  partnership.ts   # getPartnership() — used by all protected pages
  onboarding.ts    # onboarding step logic
  ai/
    categorize.ts      # transaction categorization
    insights.ts        # dashboard synthesis (1h cache)
    chat.ts            # stateless chat with full context
    budget.ts          # budget suggestions + next-month plan
    life-planning.ts   # vision, priorities, roadmap, plan insights
    monthly-review.ts  # review signals, insights, suggestions
    goal-inference.ts  # auto-generate goals from roadmap

components/
  nav.tsx          # desktop sidebar
  mobile-nav.tsx   # mobile slide-out drawer
  feedback/
    feedback-widget.tsx   # floating feedback button (all app pages)
```

---

## Key Concepts

### Auth pattern
Two layers:
1. **Edge (`proxy.ts`):** redirects unauthenticated users to `/login`
2. **Server (`getPartnership()`):** confirms session + scopes all DB queries to `partnershipId`

> `proxy.ts` is Next.js 16's rename of `middleware.ts`. Do not create a `middleware.ts` — having both causes a server crash.

### Viewer-relative ownership
`ownerLabel` is stored from the *enterer's* perspective. To display "Mine" vs "Partner's", check `record.userId === currentUserId`. `JOINT` always displays as "Joint".

### Signup flow
Partner 1 signs up (no invite code) → creates User + Partnership. Partner 2 signs up with the 6-char invite code → joins the existing Partnership. Max 2 members enforced in `signup/actions.ts`. The signup page pre-fills the invite code from the `?invite=` URL param.

### Feedback
A floating widget on every authenticated page collects emoji ratings (😄/😐/😔) + page-specific questions. Responses stored in the `Feedback` table. Admin review at `/admin/feedback`.

---

## Data Model

```
User          id, email, name, passwordHash
Partnership   id, inviteCode (6-char uppercase)
Membership    userId + partnershipId (composite PK; max 2 per partnership)
Account       id, partnershipId, userId, name, type, balance, institution
Transaction   id, partnershipId, accountId, userId, ownerLabel, merchant, amount, category, date
Goal          id, partnershipId, userId, name, type (financial|action), targetAmount, currentAmount, month, completedAt, category
Budget        id, partnershipId, month (YYYY-MM), category, suggestedAmount, userAmount
LifePlan      id, partnershipId, vision, priorities (JSON), roadmap (JSON), lastReviewedAt
LifePlanSnapshot  id, lifePlanId, month, alignmentScore, signals (JSON), priorities (JSON)
ReviewHistory id, partnershipId, month, insight, decisionsCreated, completedAt
Decision      id, partnershipId, title, context, outcome, category
Feedback      id, userId, partnershipId, rating (1-3), comment, page, createdAt
```

---

## Deployment

```bash
vercel --prod    # deploy to production
```

Both `NEXTAUTH_URL` and `AUTH_URL` must be set to `https://withparity.vercel.app` in Vercel env vars — never a per-deployment preview URL.
