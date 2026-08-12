# COD Confirmation System — `src/`

## Problem

COD (cash-on-delivery) sellers in LatAm lose 20–40% of orders to no-shows: an
order goes out for delivery, nobody confirms it beforehand, the courier finds
no one home. That's dead freight and a lost sale. Confirming every order by
hand doesn't scale past a handful of orders/day.

## Solution

A multi-tenant service that receives an order, decides deterministically
whether it needs confirming, sends a WhatsApp utility-template message, and
logs every attempt with a DB-backed idempotency key so the same event never
double-sends — even across restarts or duplicate webhook deliveries.

This first slice (vertical delgado) proves the full path end to end with a
mocked WhatsApp sender: `POST /api/test-orders` → domain decision → queue →
mock send → logged message. Swapping the mock for the real Cloud API client
later touches exactly one file (`channels/whatsapp/`), nothing else.

## Architecture

```
src/
├── config/env.ts              # validates process.env with zod, fails fast on boot
├── domain/confirmation.ts     # shouldConfirm(order) — pure, no I/O, unit tested
├── channels/whatsapp/         # mockSender.ts today; real Cloud API client later
├── queue/                     # BullMQ queue + worker (send-whatsapp-confirmation)
├── db/
│   ├── pool.ts                 # pg Pool
│   ├── migrations/             # node-pg-migrate, raw SQL via pgm.sql()
│   └── repositories/           # parameterized queries, no ORM
├── api/                        # Express app, routes, server entrypoint
└── observability/logger.ts     # pino structured logging
```

**Request flow (`POST /api/test-orders`):**
1. Validate body (zod).
2. Look up client by `slug` — client config lives in the `clients` table, never in code (multi-tenant from day 1).
3. `upsertOrder` — same `(client_id, external_order_id)` always resolves to the same row, so a duplicated intake call doesn't create a second order.
4. `domain/shouldConfirm(order)` — pure decision, only `pending_confirmation` orders get confirmed.
5. `idempotency_keys` — `INSERT ... ON CONFLICT (key) DO NOTHING`. The UNIQUE constraint *is* the lock: if the key `order:{id}:confirm_send` already exists, the send is skipped. No in-memory Set, no check-then-act race.
6. Enqueue a BullMQ job. The worker calls the (mocked) WhatsApp sender and writes a row to `messages`.

**Data model:** `clients` (tenant config) → `orders` → `messages` (every send attempt, real or mocked) → `idempotency_keys` (dedup per order+event).

## Metrics

`messages.status` + `messages.cost_estimate` are the raw material for:
- Confirmation rate (`mocked_sent` / total orders needing confirmation).
- Cost per confirmation (real once WhatsApp is live — 0 in mock mode).
- No-shows before/after, once `orders.status` transitions are wired to real webhook events.

Nothing here is computed after the fact — every attempt is logged at the moment it happens.

## Trade-offs

- **Raw `pg` + `node-pg-migrate` over an ORM (Drizzle/Prisma).** Migrations are hand-written SQL wrapped in `pgm.sql(...)`, repositories are hand-written parameterized queries. More boilerplate than a query builder, but every statement that hits the DB is visible and easy to reason about — worth it while still building fluency with SQL and Postgres. Revisit if repository boilerplate becomes the bottleneck.
- **Worker runs in-process with the API** (`server.ts` calls `startConfirmationWorker()` directly) instead of as a separate process. Fine at this volume; split into its own process once API and worker need to scale independently.
- **Serial integer IDs, not UUIDs.** Simpler to read and debug locally. If order IDs ever need to be client-facing (e.g. exposed in a tracking link), switch to UUIDs for those rows specifically.
- **Client config auto-provisioned by seed migration, not by the API.** `POST /api/test-orders` 404s on an unknown `clientSlug` on purpose — adding a client is a DB row added deliberately (migration/seed/future admin endpoint), never an implicit side effect of the first order that mentions it.

## Running locally

```bash
npm run db:up          # postgres + redis via docker compose
npm run migrate:up      # creates schema, seeds a "dovi" test client
npm run test             # domain unit tests (vitest)
npm run dev               # starts API + in-process worker on :3000

curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/test-orders \
  -H "Content-Type: application/json" \
  -d '{"clientSlug":"dovi","externalOrderId":"TEST-001","customerPhone":"+573001234567","customerName":"Juan Pérez","total":89900}'
```
