# Parity Product Roadmap

## Vision

Parity is the shared operating system for couples managing a life together — not a budgeting app, not a splits calculator. The long-term product is an AI-native financial co-pilot that gives couples a unified view, surfaces what matters, and helps them make joint decisions with less friction and fewer arguments.

---

## Phase 0 — MVP (complete)

Built for demo / class project. Manual data entry, no bank integration.

- [x] Signup / login with invite-code partner linking
- [x] Manual account entry (Mine / Partner's, viewer-relative display)
- [x] Manual transaction entry with AI auto-categorization (Claude Haiku)
- [x] Joint and personal goals with progress tracking
- [x] Shared dashboard: net worth, spending by category, AI Spending Pulse, goals
- [x] Ask Parity: stateless natural language Q&A grounded in real financial data
- [x] Settings: invite code, partner status

---

## Phase 1 — Polish & Demo-Ready (✅ complete)

Made it look and feel like a real product. Focused on UX and visual design before any new features.

- [x] **UI design pass** — consistent spacing, typography, color system; feels like Wealthfront, not a homework project
- [x] **Landing page** — clear value prop, CTA to sign up
- [x] **Empty states** — every page has a warm, helpful empty state; transactions page detects missing accounts
- [x] **Mobile responsiveness** — slide-out drawer navigation on mobile (<768px), hamburger menu in header
- [x] **Onboarding flow** — 3-step wizard: add account → record transaction → set goal; progressive with skip option
- [x] **Transaction editing** — edit merchant, amount, date, notes; category preserved
- [x] **Goal editing** — edit name, target, date, type after creation
- [x] **Account balance updates** — inline quick-edit balance without opening full form
- [x] **Ask Parity conversation history** — messages retained within a session via React state
- [x] **Error handling** — global error boundaries (`app/error.tsx`, `app/(app)/error.tsx`), server action error responses
- [x] **Vercel deployment** — live at https://withparity.vercel.app (production env vars: AUTH_SECRET, AUTH_URL, NEXTAUTH_URL, ANTHROPIC_API_KEY, DATABASE_URL)
- [x] **Budget page** — Track tab with grouped progress bars (Needs Attention / On Track), transaction drilldown per category, AI one-sentence budget status; Plan tab with AI-generated next-month budget + discussion prompts; inline budget amount editing
- [x] **Dashboard (simplified)** — hero "Parity's take" AI synthesis card (single 2–3 sentence narrative across savings, spending, goals, budget); 3-card row (Net Worth, Cash Flow, Budget Status); month-over-month spending comparison chart. Personalized page title and partner names.
- [x] **Design system standardization** — 5-tier type scale (Display / Stat / Title / Body / Meta) documented in CLAUDE.md; same-visual-line-same-size rule; color conventions (amber for warnings, emerald for positives, never red)

---

## Phase 2 — Bank Integration (medium-term, ~1–2 months)

The single highest-leverage feature. Removes the biggest friction point: manual entry.

- [ ] **Plaid integration** — connect real bank/brokerage accounts; auto-sync balances and transactions
- [ ] **Auto-import transactions** — pull last 90 days on connect; ongoing sync
- [ ] **Deduplication** — handle overlapping manual + Plaid transactions
- [ ] **Manual + connected accounts coexist** — some couples will have mixed setups
- [ ] **Sync status indicator** — last synced time, error states, reconnect flow
- [ ] **Account privacy toggle** — opt specific accounts out of shared view (per-account visibility setting)

---

## Phase 3 — AI Depth (medium-term, alongside or after Phase 2)

Deeper AI integration that justifies Parity's positioning as AI-native.

- [ ] **Spending Pulse improvements** — trend detection and anomaly flagging (month-over-month comparisons now live on dashboard)
- [ ] **Proactive nudges** — "You're $200 ahead of last month's dining pace" (push or in-app)
- [ ] **Ask Parity: conversation memory** — multi-turn conversation with context retention across sessions
- [ ] **Scenario planning** — "If we cut dining by $200/month, how much faster do we hit our vacation goal?"
- [ ] **Goal pacing alerts** — "At current savings rate, you'll hit your emergency fund in 8 months, not 6"
- [x] **AI-powered budget suggestions** — based on spending history and stated goals; live in budget page (Plan tab)
- [ ] **Joint decision mode** — AI facilitates structured financial conversations ("You both spend differently on dining — here's what the data shows")

---

## Phase 4 — Expanded Financial Picture (long-term, 6–12 months)

Broaden scope beyond checking/savings into the full financial life of a couple.

- [ ] **Investment accounts** — brokerage, 401k, IRA; combined investment view
- [ ] **Net worth over time** — historical chart; track growth as a couple
- [ ] **Debt tracking** — mortgage, student loans, car loans; payoff timelines
- [ ] **Retirement modeling** — basic "are we on track?" projections given combined savings rate and target retirement age
- [ ] **Tax estimate** — rough combined tax liability; useful for couples with different filing situations
- [ ] **Estate / beneficiary basics** — prompts to ensure accounts are correctly set up (simple checklist, not legal advice)

---

## Phase 5 — Platform & Growth (long-term)

Features that make Parity a sticky, shareable product.

- [ ] **Mobile app** (React Native or PWA) — meets users where they are
- [ ] **Notifications** — weekly digest email, goal milestone alerts, large transaction alerts
- [ ] **Partner activity feed** — "Andrew added a transaction" (optional; some couples won't want this)
- [ ] **Couple financial health score** — a simple composite metric (net worth growth, goal progress, savings rate, debt reduction)
- [ ] **Benchmarking** — anonymized comparison to similar couples ("You save more than 68% of couples your age")
- [ ] **Financial advisor integration** — share a read-only view with an advisor
- [ ] **Referral / social proof** — invite other couples; shareable milestones ("We hit our $10K emergency fund!")

---

## Deprioritized (not on roadmap)

- Expense splitting / fairness algorithms — not the core value prop; creates adversarial dynamic
- Financial education content — too much like a generic fintech feature; not differentiated
- Crypto tracking — niche for now; revisit if Plaid coverage improves
- Bill pay / payments — out of scope; Parity is visibility and planning, not execution

---

## Decision Log

| Decision | Rationale |
|---|---|
| Manual entry for MVP | Plaid requires production approval + users; too slow for class demo |
| One partnership = max 2 members | MVP constraint; could expand to family accounts later |
| Stateless AI chat | Simpler to build; conversation history is Phase 1 enhancement |
| SQLite → Neon (PostgreSQL) for prod | SQLite can't run on Vercel (no persistent filesystem, native binary mismatch); migrated to Neon with `@prisma/adapter-neon` |
| `middleware.ts` → `proxy.ts` | Next.js 16 renamed the middleware file convention; required for routing to work |
| No expense splitting | Fairness tracking creates conflict, not alignment — against core thesis |
| bcrypt rounds 10 → 8 | `bcryptjs` (pure JS) at cost 10 takes 1–3s on Vercel's throttled CPU; cost 8 brings login under 1s on warm functions while remaining secure |
| `NEXTAUTH_URL` + `AUTH_URL` both required | NextAuth v5 uses `AUTH_URL`; older NextAuth config also reads `NEXTAUTH_URL`. Both must point to the stable production alias (`withparity.vercel.app`), never a per-deployment URL |
| Dashboard simplified from 7 regions to 3 | Too busy; diluted signal. Replaced Spending/Goals insight cards + recent activity + goals summary + 4-month stacked chart with a single hero AI synthesis narrative, three summary cards, and a MoM comparison chart. Other pages (accounts, goals, transactions) remain the home for their respective domains. |
| Type scale collapsed to 5 tiers | 12-role scale was drifting; same-line mismatches (e.g., label text-sm next to amount text-base) felt random. Enforced: one hero per page (Display), summary-card numbers (Stat), H1 (Title), everything else (Body sm), eyebrows/captions (Meta xs). Same-visual-line = same tier. |
| Amber replaces red for warnings | `text-amber-600`/`text-amber-500` across all pages (over-budget, spending up, account drops). Matches the tone ("observations, not accusations") and removes the alarm quality of red. |
