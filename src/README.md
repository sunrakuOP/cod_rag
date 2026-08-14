# COD Confirmation System — `src/`

## Problem

COD (cash-on-delivery) sellers in LatAm lose 20–40% of orders to no-shows: an
order goes out for delivery, nobody confirms it beforehand, the courier finds
no one home. That's dead freight and a lost sale. Confirming every order by
hand doesn't scale past a handful of orders/day.

## Solution

A multi-tenant service that receives an order, decides deterministically
whether it needs confirming, sends a WhatsApp utility-template message
through the real Cloud API, retries on a per-client configurable cadence if
nothing changes, and logs every attempt with a DB-backed idempotency key so
the same event never double-sends — even across restarts or duplicate
webhook deliveries.

Order in (manual `/api/test-orders` or the real Shopify webhook) → domain
decision → queue → real WhatsApp send → logged message → cadence-scheduled
retry checks until the order is confirmed or the cadence runs out. The
decision/idempotency/queue logic (`api/services/confirmationIntake.ts`) is
shared by every order source, so it can't drift between the manual endpoint
and the Shopify webhook.

**Known gap:** the inbound WhatsApp webhook (`POST /webhooks/whatsapp/messages`)
that flips `orders.status` to `confirmed` is built and verified — Meta's
synthetic test payload reached it, passed signature verification, and was
handled correctly — but **the app isn't published**, so Meta doesn't deliver
real customer messages to it yet (only dashboard-triggered test payloads).
Publishing needs a public privacy-policy URL; Dovi's Shopify store was
password-protected at first, blocking that, but as of 2026-08-13 the store
and its privacy-policy page are both public — that specific blocker is gone.
Publishing the app is still the owner's call to make (Meta business
dashboard), not something this codebase can do.

## Architecture

```
src/
├── config/env.ts              # validates process.env with zod, fails fast on boot
├── domain/confirmation.ts     # shouldConfirm(order) — pure, no I/O, unit tested
├── channels/
│   ├── whatsapp/                # cloudApiSender.ts — real Meta Graph API calls
│   └── telegram/notifier.ts     # notifyOperator() — best-effort, never throws
├── integrations/
│   ├── shopify/                 # HMAC verification + payload mapping (pure, unit tested)
│   ├── whatsapp/                # HMAC verification + inbound payload parsing (pure, unit tested)
│   └── dropi/mockClient.ts      # mock "mark ready for dispatch" call (no real Dropi token yet)
├── queue/
│   ├── confirmationQueue.ts + confirmationWorker.ts  # first send
│   └── retryQueue.ts + retryWorker.ts                # cadence-driven resends
├── db/
│   ├── pool.ts                 # pg Pool
│   ├── migrations/             # node-pg-migrate, raw SQL via pgm.sql()
│   └── repositories/           # parameterized queries, no ORM
├── api/
│   ├── routes/                  # testOrders.ts, shopifyWebhook.ts (order in), whatsappWebhook.ts (reply in)
│   └── services/
│       ├── confirmationIntake.ts  # shared decision+idempotency+enqueue logic
│       └── dispatchIntake.ts      # mock Dropi call + orders.status → dispatched, run after a confirm
└── observability/logger.ts     # pino structured logging
```

**Request flow, either entry point (`POST /api/test-orders` or the Shopify webhook):**
1. Validate/verify the request. Manual endpoint: zod schema. Webhook: HMAC-SHA256 signature over the raw body (`x-shopify-hmac-sha256`), then resolve the client from `x-shopify-shop-domain` — the signing secret is per-app, not per-store, so the domain header is what tells us *which* tenant this order belongs to.
2. `upsertOrder` — same `(client_id, external_order_id)` always resolves to the same row, so a duplicated intake call (or a Shopify retry — webhooks are at-least-once delivery) doesn't create a second order.
3. `confirmationIntake.intakeOrderForConfirmation`: `domain/shouldConfirm(order)` (pure decision, only `pending_confirmation` orders get confirmed) → claim `idempotency_keys` (`INSERT ... ON CONFLICT (key) DO NOTHING`; the UNIQUE constraint *is* the lock, no check-then-act race) → enqueue a BullMQ job if both pass.
4. The confirmation worker calls the WhatsApp Cloud API and writes a row to `messages` — `sent` or `failed`, either way. It then looks up the client's `retry_cadence_minutes` (e.g. `[15, 60, 180]`) and schedules the first retry-check job at `cadence[0]` minutes out, regardless of whether the send itself succeeded (a failed send and an unconfirmed one both mean "no confirmation reached the customer yet").
5. Each retry-check job re-reads the order fresh: if it's no longer `pending_confirmation`, the chain stops — the inbound WhatsApp webhook (below) is what causes this in practice. Otherwise it claims a new idempotency key (`order:{id}:confirm_retry_{n}`), resends, and schedules the next cadence step — or, once the cadence is exhausted, marks the order `no_show`.

**Shopify webhook specifics (`POST /webhooks/shopify/orders/create`):**
- Assumes every order is COD (true for a Releasit-driven COD store like Dovi's) — no payment-gateway filtering.
- Phone is looked up with a fallback chain (`phone` → `shipping_address.phone` → `customer.phone` → `billing_address.phone`) since where COD-form apps put it varies by store. An order with no phone anywhere is not persisted — logged and acknowledged with `200`, since there's nothing to confirm without a contact number.
- Always returns `2xx` once the signature is valid, even for a skipped order — Shopify needs a fast ack and will retry (then eventually disable the webhook) on repeated non-2xx responses, so failures we can already explain (unknown shop, no phone) are not treated as delivery failures.

**Inbound WhatsApp webhook specifics (`GET`/`POST /webhooks/whatsapp/messages`):**
- `GET` handles Meta's one-time verification handshake (`hub.mode`/`hub.verify_token`/`hub.challenge`), checked against `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — an arbitrary string we chose, not something Meta issues.
- `POST` verifies `X-Hub-Signature-256` (hex, `sha256=` prefix — a different format from Shopify's base64 header, signed with the Meta app's App Secret, not the WhatsApp access token) against the raw body.
- Resolves the tenant from `value.metadata.phone_number_id` in the payload (`clients.whatsapp_phone_number_id`), then finds that client's most recent `pending_confirmation` order for the sending phone number and marks it `confirmed`.
- **Any inbound message counts as a confirmation** — there's no button-based template yet, so there's no structured yes/no signal to key off. A reply like "no quiero" gets marked confirmed the same as "sí". Documented simplification, revisit once an interactive-button template exists (see trade-offs).
- Verified working: Meta's dashboard-triggered synthetic test payload reached the endpoint, passed signature verification, and was handled correctly. Real customer replies don't arrive yet — see "Known gap" above.
- **After a successful confirm, `dispatchIntake.markOrderDispatchedIfConfirmed` runs**: calls the mock Dropi client, then flips `orders.status` to `dispatched`. Only runs when `markOrderConfirmed`'s return value says *this* call was the one that made the transition (not a stale in-memory `order.status` — see trade-offs) — a redelivered webhook for an already-dispatched order is a no-op, both by that check and by `markOrderDispatched`'s own guarded `UPDATE ... WHERE status = 'confirmed'`.
- **Telegram operator notifications (`channels/telegram/notifier.ts`)** fire on two events: order dispatched (mock Dropi) and order marked `no_show` (retry cadence exhausted). `notifyOperator` never throws — a missing `TELEGRAM_BOT_TOKEN`, a missing `clients.telegram_chat_id`, or a failed API call all just log and return, per CLAUDE.md §4.6 ("fallo seguro": a notification channel must never block order processing). Customer-controlled fields (name, phone) are run through `escapeMarkdown` before interpolation — unescaped, a customer name containing `[text](url)` would render as a clickable link in the operator's chat (same fix already applied in the sibling Dovi backend, `~/proyectos/shopify/backend/src/telegram.js`).

**Data model:** `clients` (tenant config, incl. `shopify_shop_domain` and `whatsapp_phone_number_id`) → `orders` → `messages` (every attempt, inbound and outbound) → `idempotency_keys` (dedup per order+event).

## Metrics

`messages.status` + `messages.cost_estimate` are the raw material for confirmation rate, cost per confirmation, and no-shows. Nothing here is computed after the fact — every attempt is logged at the moment it happens.

Query logic lives in `observability/metricsReport.ts` (`getMetricsReport(clientSlug?)`, returns structured JSON) — both the CLI script and the HTTP route below call it, so the SQL exists in exactly one place.

**`npm run report:metrics [-- --client=<slug>]`** (`src/scripts/reportMetrics.ts`) prints: orders by status, confirmation rate, no-show rate (+ delta against a configured baseline), cost per confirmation, messages by status, orders/day.

**`GET /api/metrics?client=<slug>`** (2026-08-13) returns the same data as JSON. Requires an `x-api-key` header matching `METRICS_API_KEY` (`timingSafeEqual`, same pattern as Shopify's HMAC check) — fails closed with 500 (`metrics_not_configured`) if that env var isn't set, rather than defaulting open, since this endpoint exposes per-client business data on a public Railway URL. Wrong/missing key → 401.

Before/after no-show comparison and cost per confirmation both depend on two nullable columns on `clients` (`baseline_no_show_rate`, `whatsapp_utility_cost_estimate`, migration `1786671243376`) that only the operator can fill in — a pre-automation no-show rate and a real WhatsApp Cloud API template price aren't things this system ever measured itself. Deliberately not defaulted: WhatsApp utility-template pricing varies by country/category and changes over time, so a hardcoded "current" price would go stale silently. Until an operator sets them, both the CLI and the HTTP report say "sin datos"/`null` rather than showing a misleading `0`. `cloudApiSender.ts` still returns `costEstimate: 0` (Meta's send response carries no price); `confirmationWorker`/`retryWorker` override it with `client.whatsappUtilityCostEstimate` at send time, so cost is only ever what was configured *when that message went out* — loading a cost later doesn't rewrite already-sent messages.

**Left for next session:** `METRICS_API_KEY` and `TEST_ORDERS_API_KEY` (below) both need to be set in Railway for those routes to respond in production — until then, deliberate 500s, not bugs.

## Security

`POST /api/test-orders` requires the same kind of `x-api-key` auth as `/api/metrics`, via a shared helper (`api/apiKeyAuth.ts`), but its own env var (`TEST_ORDERS_API_KEY`) — found and fixed in a repo-wide security review (2026-08-13). Unlike a read-only metrics endpoint, this route can trigger a real WhatsApp send (real cost, real recipient) for any client with credentials configured, so it needed its own key to scope/rotate independently rather than reusing metrics'. Fails closed (500) if unset.

## Trade-offs

- **Raw `pg` + `node-pg-migrate` over an ORM (Drizzle/Prisma).** Migrations are hand-written SQL wrapped in `pgm.sql(...)`, repositories are hand-written parameterized queries. More boilerplate than a query builder, but every statement that hits the DB is visible and easy to reason about — worth it while still building fluency with SQL and Postgres. Revisit if repository boilerplate becomes the bottleneck.
- **Worker runs in-process with the API** (`server.ts` calls `startConfirmationWorker()` directly) instead of as a separate process. Fine at this volume; split into its own process once API and worker need to scale independently.
- **Serial integer IDs, not UUIDs.** Simpler to read and debug locally. If order IDs ever need to be client-facing (e.g. exposed in a tracking link), switch to UUIDs for those rows specifically.
- **Client config auto-provisioned by seed migration, not by the API.** `POST /api/test-orders` 404s on an unknown `clientSlug`, and the Shopify webhook acks-but-skips an unknown `shopify_shop_domain`, on purpose — adding a client is a DB row added deliberately (migration/seed/future admin endpoint), never an implicit side effect of the first order that mentions it.
- **No payment-gateway filtering on the Shopify webhook.** Every order that arrives is treated as needing confirmation. Correct for a COD-only store; a client mixing COD and prepaid orders would need a per-client gateway allowlist — not built because Dovi doesn't need it yet.
- **BullMQ-level retry disabled on the confirmation queue (`attempts: 1`).** The cadence chain (`retryQueue`) is the single retry mechanism now, covering both transient send failures and unconfirmed orders with the same client-configured cadence — a second, faster BullMQ-level retry would double-schedule cadence chains on every immediate retry.
- **Meta template name is env-configured, decoupled from the job's internal `templateName`.** `WHATSAPP_TEMPLATE_NAME` is what's actually sent to the Graph API; `templateName` on the job/message row (`"order_confirmation"`) is a business-level label recorded for metrics. Lets us point at whatever template is currently approved (`hello_world` for sandbox testing, the real one once live) without touching code.
- **No template parameters/components.** The current `order_confirmation` template is static text — the send call doesn't pass a `components` array. Personalizing the message (customer name, order total) is future work and would need both the template and `cloudApiSender` to grow parameters together.
- **Any inbound WhatsApp message confirms the order — no keyword or button matching.** Simplest signal available without an interactive-button template (see "Connecting a real WhatsApp Cloud API number"); trades false-positive risk (a "no" reads as a confirmation) for not building a fragile keyword list. Revisit once a Quick Reply button template exists — Meta returns an unambiguous button ID instead of free text.
- **WhatsApp credentials (`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`) are global env vars, not per-client DB config**, unlike `shopify_shop_domain` and `whatsapp_phone_number_id` (which *are* per-client, for routing/lookup). Fine with one real WhatsApp-sending client (Dovi); a second client needing their own WhatsApp number would need this promoted to per-client config and a second System User token — not built because there's no second client yet.
- **Publishing the app is a real, undone prerequisite for real inbound traffic** — it needs a public privacy-policy URL, and blocks on Dovi's Shopify store still being password-protected pre-launch. Not something to route around (a fake privacy-policy URL would be worse than leaving this documented as pending).
- **Dropi dispatch mock runs inline (no queue), unlike WhatsApp sends.** The mock has no real I/O to fail or time out, so a BullMQ queue would be speculative infrastructure. Once a real Dropi token exists, this call becomes a fallible network request and should be promoted to the same queue+cadence+idempotency-key pattern already proven for WhatsApp (`confirmationQueue`/`retryQueue`) — not reinvented.
- **No `dropi_order_id` column yet.** The mock's fake tracking id is only in the structured log (`order marked ready for dispatch (mock Dropi)`), not persisted. Add the column once a real Dropi call returns an id worth keeping for ops/metrics.
- **`TELEGRAM_BOT_TOKEN` is a global env var, one bot for all clients; `telegram_chat_id` is per-client** — same split already established for WhatsApp (global token, per-client routing id). No client has a real `telegram_chat_id` seeded (unlike `whatsapp_phone_number_id`, which Dovi's row does carry) — there's no functional need for one yet, and wiring Dovi's real chat before `cod_rag` is actually promoted to serve Dovi would risk a real notification firing from dev/test traffic.
- **`markOrderConfirmed` returns whether it actually made the transition**, instead of void — the caller's in-memory `order` object is stale the instant the UPDATE runs (built from a `pending_confirmation`-only query), so a boolean return is what tells `whatsappWebhook.ts` whether to trigger dispatch, not a re-check of the local object.

## Running locally

```bash
npm run db:up          # postgres + redis via docker compose
npm run migrate:up      # creates schema, seeds a "dovi" test client
npm run test             # domain unit tests (vitest)
npm run dev               # starts API + in-process worker on :3000

curl http://localhost:3000/health

# Requires TEST_ORDERS_API_KEY (see .env.example) — the route fails closed
# without it. Never use clientSlug "dovi" here: that client has real
# WhatsApp credentials configured and this would send a real message.
curl -X POST http://localhost:3000/api/test-orders \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TEST_ORDERS_API_KEY" \
  -d '{"clientSlug":"<a non-dovi test client>","externalOrderId":"TEST-001","customerPhone":"+573001234567","customerName":"Juan Pérez","total":89900}'
```

## Connecting a real Shopify store

1. Don't trust Settings → Domains for the `.myshopify.com` value — a store can show more than one connected `.myshopify.com` domain (e.g. after a rename), and only one of them is what Shopify actually puts in the `X-Shopify-Shop-Domain` header. Create the webhook first (step 2), send a test notification, and read the `shopDomain` the server logs on the resulting `401` (signature not yet configured, but the domain in the log is real) — that's the value to use.
2. In Shopify Admin → Settings → Notifications → Webhooks, create a webhook for the **Order creation** event, format JSON, pointing at `https://<your-public-host>/webhooks/shopify/orders/create`. The signing secret shown on that page (shared across all webhooks configured that way) goes in `.env` as `SHOPIFY_WEBHOOK_SECRET`.
3. `UPDATE clients SET shopify_shop_domain = '<confirmed-domain>' WHERE slug = '<client-slug>';` using the domain confirmed in step 1.
4. `localhost` isn't reachable from Shopify — for live local testing, tunnel it (e.g. `ngrok http 3000`) and use the tunnel URL in step 2; if the tunnel restarts, the URL changes and the webhook needs re-editing. Otherwise this only starts receiving real traffic once deployed (Railway/Render, per `infraestructura_paso_a_paso.md`).

Confirmed working for Dovi (2026-08-12): domain is `f1zauf-q1.myshopify.com`, not `dovi-9909.myshopify.com` (also shown as connected). Deployed at `https://cod-rag-api-production.up.railway.app` — that's the current webhook target, ngrok is no longer used.

## Connecting a real WhatsApp Cloud API number

Meta's own quickstart UI skips two steps that aren't obvious until a send fails. In order:

1. **Verify the phone number** via Meta for Developers → your app → WhatsApp → API Setup → Add phone number. This only proves you own the number.
2. **Register it for the Cloud API** — a separate, API-only call most guides don't mention: `POST https://graph.facebook.com/v25.0/{phone_number_id}/register` with body `{"messaging_product":"whatsapp","pin":"<any 6-digit PIN>"}`. Skipping this gets `(#133010) Account not registered` on every send, even though the number shows as verified everywhere in the UI.
3. **Connect the WABA to the app.** A number added via WhatsApp Manager isn't automatically usable by an app's access token — check Business Settings → Apps → *your app* → Activos conectados. If it's empty, go the other direction: Business Settings → Usuarios del sistema → *the app's system user* → assign the WABA as an asset with **Mensajes** (+ **Plantillas**) permission. Skipping this gets a permissions error claiming the phone number ID "does not exist."
4. **Generate a permanent token**, not the 60-day default, from that System User: Usuarios del sistema → Generar token → select the app → **Nunca** (expiration) → scope `whatsapp_business_messaging`.
5. **`hello_world` only works from Meta's free sandbox test number.** A real registered number gets `(#131058) Hello World templates can only be sent from the Public Test Numbers`. Create a real **Utility** category template (WhatsApp Manager → Plantillas → Crear plantilla) and wait for approval — usually minutes for simple text, but not instant.

`WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANG` point at whatever template is currently approved; switching from sandbox testing to the real template is a Railway variable change, not a deploy.

## Deployment (Railway)

Project `cod-rag`: one service (`cod-rag-api`, runs the API and the BullMQ worker in-process — see trade-offs) plus `Postgres` and `Redis` plugins, wired via Railway's variable references (`DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`) over Railway's private network.

Migrations run in `prestart` (`npm run migrate:up:prod`, a plain `node-pg-migrate up` relying on the env vars Railway injects directly — no `.env`/`dotenv-cli` in production) — Railway's Postgres isn't reachable from a laptop by default (`railway run` executes locally, not inside the private network, and there's no public proxy enabled), so migrating on container boot was simpler than opening one up. Migrations are idempotent (tracked in `pgmigrations`), so redeploys don't reapply anything.

```bash
railway up --service cod-rag-api --ci   # build + deploy
railway logs --service cod-rag-api      # tail logs, confirm migrations + "server listening"
railway variable set KEY=VALUE --service cod-rag-api --skip-deploys   # add/change a var without redeploying
```
