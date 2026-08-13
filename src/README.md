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
mocked WhatsApp sender: order in (manual `/api/test-orders` or the real
Shopify webhook) → domain decision → queue → mock send → logged message.
Swapping the mock for the real Cloud API client later touches exactly one
file (`channels/whatsapp/`), nothing else — the decision/idempotency/queue
logic (`api/services/confirmationIntake.ts`) is shared by every order
source, so it can't drift between the manual endpoint and the Shopify
webhook.

## Architecture

```
src/
├── config/env.ts              # validates process.env with zod, fails fast on boot
├── domain/confirmation.ts     # shouldConfirm(order) — pure, no I/O, unit tested
├── channels/whatsapp/         # mockSender.ts today; real Cloud API client later
├── integrations/shopify/      # HMAC verification + payload mapping (pure, unit tested)
├── queue/                     # BullMQ queue + worker (send-whatsapp-confirmation)
├── db/
│   ├── pool.ts                 # pg Pool
│   ├── migrations/             # node-pg-migrate, raw SQL via pgm.sql()
│   └── repositories/           # parameterized queries, no ORM
├── api/
│   ├── routes/                  # testOrders.ts (manual), shopifyWebhook.ts (real)
│   └── services/confirmationIntake.ts  # shared decision+idempotency+enqueue logic
└── observability/logger.ts     # pino structured logging
```

**Request flow, either entry point (`POST /api/test-orders` or the Shopify webhook):**
1. Validate/verify the request. Manual endpoint: zod schema. Webhook: HMAC-SHA256 signature over the raw body (`x-shopify-hmac-sha256`), then resolve the client from `x-shopify-shop-domain` — the signing secret is per-app, not per-store, so the domain header is what tells us *which* tenant this order belongs to.
2. `upsertOrder` — same `(client_id, external_order_id)` always resolves to the same row, so a duplicated intake call (or a Shopify retry — webhooks are at-least-once delivery) doesn't create a second order.
3. `confirmationIntake.intakeOrderForConfirmation`: `domain/shouldConfirm(order)` (pure decision, only `pending_confirmation` orders get confirmed) → claim `idempotency_keys` (`INSERT ... ON CONFLICT (key) DO NOTHING`; the UNIQUE constraint *is* the lock, no check-then-act race) → enqueue a BullMQ job if both pass.
4. The worker calls the (mocked) WhatsApp sender and writes a row to `messages`.

**Shopify webhook specifics (`POST /webhooks/shopify/orders/create`):**
- Assumes every order is COD (true for a Releasit-driven COD store like Dovi's) — no payment-gateway filtering.
- Phone is looked up with a fallback chain (`phone` → `shipping_address.phone` → `customer.phone` → `billing_address.phone`) since where COD-form apps put it varies by store. An order with no phone anywhere is not persisted — logged and acknowledged with `200`, since there's nothing to confirm without a contact number.
- Always returns `2xx` once the signature is valid, even for a skipped order — Shopify needs a fast ack and will retry (then eventually disable the webhook) on repeated non-2xx responses, so failures we can already explain (unknown shop, no phone) are not treated as delivery failures.

**Data model:** `clients` (tenant config, incl. `shopify_shop_domain`) → `orders` → `messages` (every send attempt, real or mocked) → `idempotency_keys` (dedup per order+event).

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
- **Client config auto-provisioned by seed migration, not by the API.** `POST /api/test-orders` 404s on an unknown `clientSlug`, and the Shopify webhook acks-but-skips an unknown `shopify_shop_domain`, on purpose — adding a client is a DB row added deliberately (migration/seed/future admin endpoint), never an implicit side effect of the first order that mentions it.
- **No payment-gateway filtering on the Shopify webhook.** Every order that arrives is treated as needing confirmation. Correct for a COD-only store; a client mixing COD and prepaid orders would need a per-client gateway allowlist — not built because Dovi doesn't need it yet.

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

## Connecting a real Shopify store

1. Don't trust Settings → Domains for the `.myshopify.com` value — a store can show more than one connected `.myshopify.com` domain (e.g. after a rename), and only one of them is what Shopify actually puts in the `X-Shopify-Shop-Domain` header. Create the webhook first (step 2), send a test notification, and read the `shopDomain` the server logs on the resulting `401` (signature not yet configured, but the domain in the log is real) — that's the value to use.
2. In Shopify Admin → Settings → Notifications → Webhooks, create a webhook for the **Order creation** event, format JSON, pointing at `https://<your-public-host>/webhooks/shopify/orders/create`. The signing secret shown on that page (shared across all webhooks configured that way) goes in `.env` as `SHOPIFY_WEBHOOK_SECRET`.
3. `UPDATE clients SET shopify_shop_domain = '<confirmed-domain>' WHERE slug = '<client-slug>';` using the domain confirmed in step 1.
4. `localhost` isn't reachable from Shopify — for live local testing, tunnel it (e.g. `ngrok http 3000`) and use the tunnel URL in step 2; if the tunnel restarts, the URL changes and the webhook needs re-editing. Otherwise this only starts receiving real traffic once deployed (Railway/Render, per `infraestructura_paso_a_paso.md`).

Confirmed working for Dovi (2026-08-12): domain is `f1zauf-q1.myshopify.com`, not `dovi-9909.myshopify.com` (also shown as connected).
