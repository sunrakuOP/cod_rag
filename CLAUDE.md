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
- [x] Un pedido de prueba entra, se confirma por WhatsApp (mock) y queda registrado.
- [ ] Reintentos con cadencia configurable, idempotentes.
- [ ] Marcado a Dropi (mock aceptable) tras confirmación.
- [ ] Notificación a Telegram.
- [ ] Métricas: confirmación %, no-shows antes/después, pedidos/día automáticos (la tabla `messages` ya deja el rastro; falta el reporte).
- [x] Config multi-cliente separada del código (tabla `clients`, seed `dovi`).
- [x] README del módulo con Problema → Solución → Arquitectura → Métrica → Trade-offs (en inglés, sirve para portafolio) → `src/README.md`.

## 8. Contexto de negocio (para decisiones de producto)
- Clientes = vendedores COD que pautean (tienen volumen y presupuesto).
- El dolor central = pedidos que no se confirman a tiempo → flete muerto y devoluciones.
- La métrica que vende = reducción de no-shows y pedidos confirmados sin humano.
- Ver `ventas_canales_outreach.md` e `infraestructura_paso_a_paso.md` (raíz del repo) para oferta, precios, canales y cuentas. Nota: el `README.md` describe subcarpetas `negocio/`/`estudio/` que hoy no existen — estos archivos están sueltos en la raíz.

## 9. Estado actual (implementado — 2026-08-12)

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

**Decisiones tomadas hoy (con trade-off documentado en `src/README.md`):**
- `pg` crudo + `node-pg-migrate` (SQL explícito) en vez de un ORM.
- Worker de BullMQ corriendo in-process con la API (separar cuando escale).
- IDs `serial`, no UUID.
- `channels/`, `integrations/` solo tienen lo que se usa hoy (`whatsapp/mockSender.ts`); `telegram/`, `shopify/`, `dropi/` se agregan cuando haya integración real, no antes.

**Siguiente paso propuesto:** integración real con Shopify (webhook de pedidos
de Dovi) para reemplazar el endpoint de pedido mock, o WhatsApp Cloud API real
reemplazando `mockSender.ts` — a definir con el dueño.
