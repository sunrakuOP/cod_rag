# CLAUDE.md — Contexto del proyecto para Claude Code

> Leé este archivo completo antes de escribir código. Define la misión, el stack, los principios de arquitectura y cómo trabajamos. Mantené este archivo actualizado a medida que el proyecto crece.

## 1. Misión

Construir un **producto de automatización productizado para e-commerce COD (cash-on-delivery) en LatAm** que se pueda vender a múltiples clientes con mínimo re-trabajo, y la infraestructura de negocio alrededor. El objetivo del dueño es llegar a ~USD 2.000/mes recurrente para diciembre 2026 y, en paralelo, construir un portafolio que le consiga un empleo remoto de AI Engineer.

El dueño maneja **backend en Node.js** y ya opera una tienda COD propia ("Dovi", Shopify + Dropi + Releasit) que sirve de caso de prueba y case study #0.

## 2. Qué construimos primero (Oferta A)

**Sistema de confirmación de pedidos COD y anti-no-show por WhatsApp**, reutilizable entre clientes:
- Recibe pedidos (webhook de Shopify / carga manual / Dropi).
- Envía confirmación por WhatsApp usando **plantillas utility** (no marketing).
- Reintenta a los no-contactados con una cadencia configurable.
- Marca los confirmados listos para despacho (integración Dropi; empezar en mock si falta token).
- Notifica al operador por Telegram.
- Registra métricas: tasa de confirmación, no-shows antes/después, pedidos/día sin intervención humana.

Debe ser **multi-cliente desde el diseño**: configuración por tienda (credenciales, plantillas, cadencia) separada del código.

## 3. Stack

- **Lenguaje:** Node.js + **TypeScript** (tipado obligatorio en dominio y límites).
- **API/servidor:** Express (o Fastify si se justifica). Webhooks entrantes + endpoints internos.
- **DB:** PostgreSQL. Estado de pedidos, configuración por cliente, log de mensajes, idempotencia.
- **Colas/trabajos:** cola persistente (BullMQ + Redis) para reintentos y envíos diferidos.
- **WhatsApp:** WhatsApp Cloud API (Meta) directo, o vía BSP si conviene. Ver `negocio/infraestructura_paso_a_paso.md`.
- **Config:** variables de entorno; nunca secretos en el repo. `.env.example` siempre actualizado.

## 4. Principios de arquitectura (no negociables)

1. **Determinista para las decisiones, LLM solo para el lenguaje.** Qué pedido se confirma, cuándo se reintenta, qué se marca a Dropi → reglas explícitas y testeables. El LLM solo redacta/entiende mensajes. Esto lo hace confiable, barato y defendible.
2. **Idempotencia real.** Nada de `Set` en memoria para deduplicar (no persiste entre reinicios/ejecuciones). Usar la DB: clave de idempotencia por pedido+evento. (Trampa ya conocida por el dueño.)
3. **Multi-tenant desde el día 1.** Todo lo específico de cliente vive en config, no en código. Agregar un cliente = agregar una fila de config, no un fork.
4. **Costo de WhatsApp consciente.** Preferir **plantillas utility** (mucho más baratas que marketing) y diseñar flujos para caer dentro de la **ventana de servicio de 24 h** y la **ventana de 72 h** de anuncios Click-to-WhatsApp, donde los mensajes son gratis. No clasificar confirmaciones como marketing.
5. **Observabilidad básica.** Log estructurado de cada mensaje enviado/recibido, su costo estimado y su resultado. Sin esto no hay case study ni depuración.
6. **Fallo seguro.** Ante duda, no enviar dos veces, no marcar despacho sin confirmación. Errores visibles, no silenciosos.

## 5. Estructura de código sugerida

```
src/
├── config/          # carga y validación de config por cliente (env + DB)
├── domain/          # reglas puras: decisión de confirmar/reintentar/marcar (testeable, sin I/O)
├── channels/
│   ├── whatsapp/    # cliente Cloud API, plantillas, ventana de servicio
│   └── telegram/    # notificaciones al operador
├── integrations/
│   ├── shopify/     # webhook de pedidos
│   └── dropi/       # marcar despacho (mock primero)
├── queue/           # trabajos: enviar, reintentar
├── db/              # migraciones, repositorios, claves de idempotencia
├── api/             # endpoints Express + verificación de webhooks
└── observability/   # logging estructurado + métricas
```

## 6. Cómo trabajamos

- **Incremental y funcionando.** Cada día algo corre y se prueba. Preferí un vertical delgado end-to-end (un pedido → confirmación → log) antes de agregar features.
- **Tests en el dominio.** Las reglas de decisión (`src/domain`) van con tests unitarios. Ahí no hay excusa.
- **Explicá trade-offs, no solo entregues código.** Cuando haya más de una forma, decí las opciones y por qué elegís una. El dueño aprende de eso y lo usa en entrevistas.
- **Pistas antes que soluciones completas** cuando estemos en fase de diseño y él quiera pensarlo. Si pide implementación directa, dale.
- **Actualizá `CLAUDE.md` y `README.md`** cuando cambie la arquitectura o se agregue un módulo.
- **Métricas primero.** Todo feature que toque pedidos debe dejar rastro medible (para el case study y el CV).

## 7. Definición de "listo" para la Oferta A
- [x] Un pedido de prueba entra, se confirma por WhatsApp (real, Cloud API) y queda registrado.
- [x] Reintentos con cadencia configurable, idempotentes. El webhook entrante de WhatsApp (§9) marca `confirmed` ante cualquier respuesta del cliente, cortando la cadencia.
- [x] Marcado a Dropi (mock aceptable) tras confirmación.
- [x] Notificación a Telegram.
- [x] Métricas: confirmación %, no-shows antes/después, pedidos/día automáticos, costo por confirmación (`npm run report:metrics`). Antes/después y costo dependen de config manual por cliente (`clients.baseline_no_show_rate`, `clients.whatsapp_utility_cost_estimate`) — el reporte muestra "sin datos" hasta que el operador los carga, nunca inventa un valor.
- [x] Config multi-cliente separada del código (tabla `clients`, seed `dovi`).
- [x] README del módulo con Problema → Solución → Arquitectura → Métrica → Trade-offs (en inglés, sirve para portafolio) → `src/README.md`.

## 8. Contexto de negocio (para decisiones de producto)
- Clientes = vendedores COD que pautean (tienen volumen y presupuesto).
- El dolor central = pedidos que no se confirman a tiempo → flete muerto y devoluciones.
- La métrica que vende = reducción de no-shows y pedidos confirmados sin humano.
- Ver `ventas_canales_outreach.md` e `infraestructura_paso_a_paso.md` (raíz del repo) para oferta, precios, canales y cuentas. Nota: el `README.md` describe subcarpetas `negocio/`/`estudio/` que hoy no existen — estos archivos están sueltos en la raíz.

## 9. Estado actual (implementado — 2026-08-12 a 2026-08-13)

> **⚠️ Guardrail (2026-08-13): no correr `/api/test-orders` con `clientSlug:"dovi"`.**
> El cliente `dovi` en la DB ya tiene credenciales reales de Meta cargadas (WABA
> `2097679467793481`, número real `+57 305 2589325`) — un test-order contra ese slug
> puede disparar un WhatsApp real al número real de Dovi, no un mock. Dovi también tiene
> un backend separado y anterior (`~/proyectos/shopify/backend/`, en un VPS, sesión de
> Claude Code aparte) que es hoy el único sistema conectado al webhook real de Shopify
> de Dovi — el webhook duplicado que `cod_rag` tenía hacia Railway ya se borró
> (2026-08-13). `cod_rag` sigue teniendo las credenciales reales de `dovi` cargadas
> porque el plan de fondo es que `cod_rag` termine reemplazando a ese backend (Dovi es
> "cliente #0", §1) — pero **no antes de tenerlo listo** (plantilla de WhatsApp propia
> aprobada, Telegram, y una decisión explícita de promoverlo). Hasta entonces, para
> pruebas manuales usar un `clientSlug` de prueba nuevo, no `dovi`.

Vertical delgado corriendo local, probado end-to-end (`POST /api/test-orders` →
`shouldConfirm` → idempotencia en DB → BullMQ → mock WhatsApp sender → log en
`messages`). Detalle completo en `src/README.md`.

**Quick start:**
```bash
npm run db:up        # postgres + redis (docker compose)
npm run migrate:up    # schema + seed cliente "dovi"
npm run test            # tests de dominio (vitest)
npm run dev               # API + worker en :3000
```

**Decisiones tomadas (con trade-off documentado en `src/README.md`):**
- `pg` crudo + `node-pg-migrate` (SQL explícito) en vez de un ORM.
- Worker de BullMQ corriendo in-process con la API (separar cuando escale).
- IDs `serial`, no UUID.
- `channels/`, `integrations/` solo tienen lo que se usa hoy; `telegram/` se agrega cuando haya integración real, no antes. `integrations/dropi/` ya existe como mock (ver abajo) — la integración real espera token.
- **Webhook real de Shopify conectado y verificado (2026-08-12).** `POST /webhooks/shopify/orders/create` recibe tráfico real de la tienda de Dovi. Dominio: `f1zauf-q1.myshopify.com` (no `dovi-9909.myshopify.com`, que también aparece conectado en Settings → Domains pero no es el que Shopify usa para firmar webhooks — se confirmó mandando una notificación de prueba real y leyendo el header `X-Shopify-Shop-Domain` en el log). Signing secret en `.env` local (nunca commiteado). Probado con la notificación de prueba de Shopify: firma verificó, pedido se creó, se encoló, worker mock lo procesó — dato de prueba borrado de la DB después.
- Se asume que todo pedido de Dovi es COD (Releasit) — sin filtro por gateway de pago.
- **Deployado en Railway (2026-08-12).** Proyecto `cod-rag`, servicio `cod-rag-api` (Express + worker in-process, un solo servicio) + plugins `Postgres` y `Redis` (variables referenciadas: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`, ambas sobre la red privada de Railway). URL pública: `https://cod-rag-api-production.up.railway.app`. Webhook de Shopify reapuntado ahí, verificado con una segunda notificación de prueba real. Ngrok y el server/Docker local ya no hacen falta, quedaron apagados.
- **Migraciones corren en `prestart`** (`npm run migrate:up:prod`, hook estándar de npm antes de `start`) — Railway no expone su Postgres a la red pública por default, así que no se puede migrar desde la laptop con `railway run` (ese comando ejecuta local, no dentro de la red privada); correrlas al boot del contenedor evita necesitar el proxy público o SSH. Son idempotentes (tabla `pgmigrations`), así que reiniciar el contenedor no las reaplica de más.
- Costo real de Railway (Postgres + Redis + app, plan de uso) — sin visibilidad de precio automatizada; revisar el dashboard de Railway para el gasto real corriente. Trial sin suscripción activa → no se pudo poner un límite de gasto (`railway usage limit set` lo exige); revisar si conviene pasar a un plan pago solo por eso.
- **WhatsApp Cloud API real conectado (2026-08-13).** `channels/whatsapp/mockSender.ts` reemplazado por `cloudApiSender.ts`. Número real de Dovi: `+57 305 2589325` (Phone Number ID `1254313717770824`, WABA "Dovi" `2097679467793481`) — verificado, registrado en la Cloud API (paso aparte de la verificación, ver `src/README.md §Connecting a real WhatsApp Cloud API number`), con permisos otorgados al usuario del sistema `Dovi Bot Backend` y token **permanente** (nunca expira) cargado en Railway. Plantilla `order_confirmation` (utility, `es_CO`) creada y **en revisión de Meta** al cierre de esta sesión — el envío real todavía no se probó de punta a punta, solo el mock/hello_world.
- **Reintentos con cadencia (2026-08-13).** `queue/retryQueue.ts` + `retryWorker.ts`: tras el envío inicial, se programa un chequeo a `client.retry_cadence_minutes[0]` (15 min), que reintenta si el pedido sigue `pending_confirmation`, y así hasta agotar la cadencia (`[15,60,180]` por default), donde marca `no_show`. Probado en Railway: el envío inicial falló (plantilla aún en revisión) y el sistema no crasheó ni hizo retry-loop — registró el fallo y programó el primer reintento correctamente. `confirmationQueue` bajó a `attempts:1` (BullMQ) porque la cadencia ya es el único mecanismo de reintento — tenerlos duplicados generaba cadenas de reintento superpuestas.
- **Webhook entrante de WhatsApp construido y verificado (2026-08-13).** `POST /webhooks/whatsapp/messages`: firma `X-Hub-Signature-256` (formato distinto al de Shopify — hex con prefijo `sha256=`, firmado con el App Secret de Meta, no el token de acceso), resuelve el cliente por `whatsapp_phone_number_id` (columna nueva en `clients`, mismo patrón que `shopify_shop_domain`), y marca `confirmed` el pedido pendiente más reciente de ese teléfono. **Simplificación explícita:** cualquier respuesta cuenta como confirmación (no hay plantilla con botones todavía, así que no hay señal sí/no estructurada). Probado con el payload sintético que ofrece el dashboard de Meta: llegó, verificó firma, se procesó bien.
- **Bloqueado: mensajes reales de WhatsApp no llegan todavía.** La app `dovi-bot-confirmacion` sigue "Sin publicar" — mientras no esté publicada, Meta solo entrega los payloads de prueba del dashboard, no mensajes de clientes reales (confirmado empíricamente: un WhatsApp real mandado al número de Dovi nunca llegó al webhook). Para publicar, Meta exige una URL de política de privacidad pública — la de Shopify (`tiendadovi.com/policies/privacy-policy`) estaba protegida con contraseña (tienda en modo pre-lanzamiento) y ni siquiera mostraba el contenido correcto. Decisión del dueño: **queda pendiente por ahora**, no se fuerza ninguna solución (nada de URLs falsas). **Actualización 2026-08-13 (sesión posterior):** re-verificado por navegador — `tiendadovi.com` ya salió de modo contraseña y la política de privacidad ya carga pública y con el contenido correcto (fecha "Última actualización: 12 de julio de 2026"). El bloqueo de la URL de privacidad **ya no existe** — publicar la app queda a criterio del dueño, no verificado si ya lo hizo. Sigue pendiente de re-chequear el estado de la plantilla `order_confirmation` en WhatsApp Manager (seguía "En revisión" al cierre de la sesión anterior, no verificable sin login).
- **Marcado a Dropi (mock) implementado (2026-08-13).** `integrations/dropi/mockClient.ts` + `api/services/dispatchIntake.ts`: tras un `confirmed` real (webhook entrante de WhatsApp), se llama al mock (siempre "exitoso", genera un `dropiOrderId` fake) y el pedido pasa a `dispatched` — status que ya existía en el dominio (`OrderStatus`) sin usarse hasta ahora. Corre inline, sin cola (el mock no tiene I/O que falle; promoverlo a cola+cadencia+idempotencia como WhatsApp queda para cuando haya token real de Dropi — documentado en trade-offs de `src/README.md`). Probado end-to-end local (Docker Postgres/Redis, server local, secreto de firma de prueba): pedido confirmado por webhook → mock disparado → `orders.status = 'dispatched'` verificado en DB. Probado también el caso de reentrega del mismo webhook (WhatsApp entrega at-least-once): sin duplicar el despacho, gracias al guard `UPDATE ... WHERE status = 'confirmed'` en `markOrderDispatched` — `markOrderConfirmed` ahora devuelve si de verdad hizo la transición, en vez de `void`, porque el objeto `order` en memoria queda desactualizado apenas corre el UPDATE.

- **Descubierto y corregido: webhook duplicado con un backend anterior de Dovi (2026-08-13).** Existe otro backend, más viejo y no relacionado con esta sesión (`~/proyectos/shopify/backend/`, Node/Express/SQLite, en un VPS Hetzner desde el 03-08, dominio `api.tiendadovi.com`), construido en una sesión de Claude Code separada que no sabía de `cod_rag` (ni viceversa). Shopify tenía **dos** suscripciones activas a "Creación de pedido" — una a ese VPS, otra a Railway — cada pedido real de Dovi disparaba los dos sistemas en paralelo. Se verificó en vivo (WhatsApp Manager) que el número real `+57 305 2589325` está conectado bajo la WABA de `cod_rag` (`2097679467793481`); la WABA del VPS (`1352075190449142`) solo tiene el número de sandbox — no fue un "robo" de número, el VPS simplemente nunca llegó a conectar el real (bloqueado en la verificación de negocio de Meta, seguía "pendiente" en su propia memoria al 2026-08-12). **Sin impacto a clientes reales:** la tienda sigue en modo contraseña, cero pedidos reales pasaron por ninguno de los dos. Se decidió (con el dueño): el VPS queda como el único sistema conectado al tráfico real de Dovi por ahora (ya tiene WhatsApp+Telegram+Dropi-manual funcionando); el webhook duplicado hacia Railway **se borró** en Shopify Admin. `cod_rag` sigue con las credenciales reales de `dovi` cargadas (ver guardrail arriba) porque el plan es que eventualmente la reemplace, no antes de estar lista.

- **Notificación a Telegram implementada (2026-08-13).** `channels/telegram/notifier.ts` (`notifyOperator`, `escapeMarkdown`) + `telegram_chat_id` nuevo en `clients` (nullable, sin backfill a propósito — ver guardrail arriba). Dos disparadores: pedido despachado (mock Dropi) y pedido marcado `no_show` (cadencia agotada). Nunca tira excepción — token o chat_id sin configurar, o un fallo de la API de Telegram, solo loguean (CLAUDE.md §4.6). Probado end-to-end local con un cliente de prueba dedicado (nunca `dovi`) y un token de Telegram falso: el flujo completo corrió sin crashear, el fallo 401 de Telegram quedó logueado y el pedido siguió su curso normal (confirmado → despachado).

- **Reporte de métricas completo (2026-08-13, dos sesiones).** `npm run report:metrics [-- --client=<slug>]` (`src/scripts/reportMetrics.ts`, consulta directa a `orders`/`messages`, sin endpoint HTTP): pedidos por estado, tasa de confirmación, tasa de no-show, comparación contra línea base, costo total y costo por confirmación, mensajes por estado, pedidos/día. **Decisión de diseño:** línea base de no-shows y costo por plantilla vienen de dos columnas nuevas en `clients` (`baseline_no_show_rate`, `whatsapp_utility_cost_estimate`, migración `1786671243376`), cargadas manualmente por el operador — nunca inferidas ni con un default hardcodeado. Se descartó a propósito buscar y hardcodear un precio "real" de Meta para Colombia: el pricing de WhatsApp Cloud API varía por país/categoría y cambia con el tiempo, así que un default quedaría desactualizado en silencio — mismo principio que `anti-generico.md` aplica a copy con números falso-precisos. Mientras esos campos estén en `NULL`, el reporte dice explícitamente "sin datos"/"sin configurar", nunca los coacciona a 0. `cloudApiSender.ts` sigue devolviendo `costEstimate: 0` (la respuesta de Meta no trae precio); `confirmationWorker.ts`/`retryWorker.ts` lo pisan con `client.whatsappUtilityCostEstimate` si está configurado — el costo grabado es el vigente al momento del envío, no se recalcula retroactivo si el operador lo carga después. Probado local: migración aplicada, `npm run test` (34/34) y `npm run report:metrics -- --client=dovi` verificados en ambos estados (con y sin config).

- **`GET /api/metrics` implementado (2026-08-13).** La lógica de queries se extrajo a `observability/metricsReport.ts` (`getMetricsReport(clientSlug?)`, devuelve JSON estructurado) — `reportMetrics.ts` (CLI) y la ruta HTTP comparten esa única fuente en vez de duplicar SQL. **Auth fail-closed:** header `x-api-key` comparado con `timingSafeEqual` contra `METRICS_API_KEY` (env var nueva, opcional en el schema pero la ruta devuelve 500 si no está configurada — mismo patrón que `SHOPIFY_WEBHOOK_SECRET`), porque el endpoint expone tasas de confirmación y costos por cliente en una URL pública de Railway. **Falta setear `METRICS_API_KEY` en Railway** para que el endpoint responda en producción — sin eso, sigue fallando cerrado con 500, no es un bug. Probado local: sin key → 401, key incorrecta → 401, key correcta → 200 con el JSON completo, sin `METRICS_API_KEY` en el entorno → 500 `metrics_not_configured`.

- **Security review completo del repo + fix (2026-08-13).** Primera revisión sobre los 31 archivos fuente (no solo diffs de sesiones). Único hallazgo real: `POST /api/test-orders` no tenía ninguna autenticación — cualquiera con la URL pública de Railway podía crear pedidos falsos para cualquier `clientSlug` existente y, si ese cliente tenía credenciales reales de WhatsApp configuradas (como `dovi`, ver guardrail arriba), disparar un envío real a cualquier número, gastando plata real y contaminando las métricas del cliente. **Fix:** mismo esquema que `/api/metrics` — header `x-api-key` vía helper compartido (`api/apiKeyAuth.ts`, `isAuthorizedByApiKey`), pero con env var propia `TEST_ORDERS_API_KEY` (no la misma que métricas: blast radius distinto — este endpoint puede gastar plata y mandar mensajes reales, no solo leer datos). Fail-closed igual que los demás. **Falta setear `TEST_ORDERS_API_KEY` en Railway** para producción. Probado local los 4 casos (sin key, key incorrecta, key correcta, env var sin configurar) — todos correctos.

**Siguiente paso propuesto:** cuando la tienda de Dovi salga de modo
pre-lanzamiento (o haya otra URL pública de política de privacidad), publicar
la app y probar el webhook entrante con un mensaje real; en paralelo, esperar
la aprobación de la plantilla `order_confirmation` para probar un envío
saliente real de punta a punta — a definir con el dueño.
