# Proyecto: Ingreso Remoto — COD Automation + AI Engineer

Monorepo de trabajo. Reúne **el negocio** (oferta de automatización COD que se construye y se vende) y **el estudio** (ruta AI Engineer hacia empleo remoto). Objetivo: fuente de ingreso ≥ USD 2.000/mes para diciembre 2026.

## Cómo se divide el trabajo

- **Yo (humano):** estudio la ruta técnica (`/estudio`), avanzo teoría/ejercicios, hago la venta y el outreach.
- **Claude Code:** construye conmigo el producto vendible y la infraestructura (`/negocio`, `/src`), implementando cosas nuevas cada día. Lee `CLAUDE.md` antes de tocar nada.

## Mapa de la carpeta

```
proyecto-ingreso-remoto/
├── README.md                         ← este archivo
├── CLAUDE.md                         ← contexto y reglas para Claude Code (leer primero)
├── PROMPT_CLAUDE_CODE.md             ← prompt de arranque para pegar en Claude Code
├── estudio/
│   ├── 00_por_donde_empezar.md       ← empezá acá: Node vs Python, primeras 2 semanas, setup
│   └── ruta_estudio_completa.md      ← currículo AI Engineer en fases (teoría/ejemplos/ejercicios)
├── negocio/
│   ├── infraestructura_paso_a_paso.md ← cuentas, correo, web, pagos, WhatsApp API, orden de montaje
│   └── ventas_canales_outreach.md     ← canales, contacto, plantillas, precios, escalado
└── src/                              ← el producto (lo construye Claude Code; ver src/README.md)
```

## Dos lenguajes, dos propósitos
- **Negocio / producto vendible → Node.js + TypeScript.** Tu fuerza. Envío rápido.
- **Estudio / empleo AI Engineer → Python.** Lo que piden las vacantes. Tu backend transfiere conceptualmente (async, APIs, webhooks, colas).

## Orden de arranque
1. Leé `estudio/00_por_donde_empezar.md` y montá el entorno.
2. Leé `negocio/infraestructura_paso_a_paso.md` y abrí las cuentas de la Fase 0.
3. Pegá `PROMPT_CLAUDE_CODE.md` en Claude Code para que arme el repo y empiece la Oferta A.
4. Seguí el plan fechado (documento `00_plan_maestro` del bundle anterior).
```
```
