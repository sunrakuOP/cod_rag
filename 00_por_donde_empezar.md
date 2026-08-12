# estudio/00 — Por dónde empezar

## 1. La decisión Node vs Python (resuelta)

Tenés dos objetivos y cada uno pide un lenguaje distinto. No es contradicción, es división de trabajo:

| Para… | Lenguaje | Por qué |
|---|---|---|
| **El producto vendible** (COD, WhatsApp, agentes de negocio) | **Node.js + TypeScript** | Es tu fuerza. Envío rápido. Webhooks + colas = tu terreno. |
| **El estudio y el empleo** (AI Engineer) | **Python** | Es lo que piden las vacantes; casi todos los ejemplos, librerías (LangChain, LlamaIndex) y evals están en Python. |

**Lo bueno:** tu backend en Node transfiere casi todo el concepto a Python — async, APIs REST, webhooks, colas, DB, manejo de errores. No aprendés a programar de nuevo; aprendés la sintaxis de Python y su ecosistema de IA. Cuestión de semanas, no meses.

> Regla: **construí en Node, estudiá en Python.** Cuando un cliente pague por algo que también quieras en tu portafolio de empleo, podés reimplementar la versión "de estudio" en Python.

## 2. Qué estudiar primero (orden exacto)

No arranques por RAG. Arrancá por los cimientos que RAG asume:

```
1. Python básico-intermedio  (si venís de Node, es rápido)  ← Semana 1
2. async en Python (asyncio, httpx)                          ← Semana 1
3. Llamar una LLM API: mensajes, system prompt, JSON out     ← Semana 2
4. Structured output + manejo de errores/reintentos          ← Semana 2
   → recién ahí seguís con la ruta completa (Fase 2 en adelante)
```

## 3. Setup del entorno (hacelo una vez, hoy)

- **Python 3.12+** con **uv** (gestor rápido) o `venv`.
- Editor: VS Code + extensión de Python.
- **API keys** en variables de entorno (`.env`), nunca en el código. Empezá con un proveedor (el que tengas).
- Cuenta de **GitHub** (si no tenés) — todo lo de estudio se sube ahí, en inglés.
- Instalá: `httpx`, `pydantic`, y el SDK del proveedor que uses.

```bash
# con uv
uv init ai-engineer-study && cd ai-engineer-study
uv add httpx pydantic
# corré tu primer script que llame a una LLM API y devuelva JSON válido
```

## 4. Las primeras 2 semanas (concreto)

**Semana 1 — Python + async (≈2–3 h/día)**
- Día 1–2: sintaxis de Python viniendo de JS (tipos, listas/dicts, comprehensions, f-strings, `pydantic`).
- Día 3–4: `asyncio`, `await`, `httpx.AsyncClient`, `asyncio.gather`.
- Día 5: ejercicio — script que llama 5 endpoints concurrentes y mide el tiempo.
- Fin de semana (bloque): subí el script a GitHub con README en inglés.

**Semana 2 — LLM APIs de verdad**
- Día 1–2: estructura de mensajes (system/user/assistant), rol del system prompt.
- Día 3: structured output con `pydantic` (pedir JSON, validar).
- Día 4: streaming + reintentos con backoff.
- Día 5: ejercicio — tu wrapper `LLMClient` con `complete()` y `stream()`.
- Fin de semana: **Proyecto #1** (CLI multi-proveedor) a GitHub.

A partir de acá seguís con `ruta_estudio_completa.md` desde la **Fase 2 (tool/function calling)**.

## 5. Cómo estudiar (para que rinda con U + gym + lectura)
- **Teoría corta → código ya.** No leas de más; escribí el ejemplo apenas entendés el concepto.
- **Un proyecto por bloque de fin de semana**, subido a GitHub. El portafolio se construye solo si publicás.
- **Explicá en voz alta** cada concepto (en inglés cuando puedas). Si no lo podés explicar, no lo entendiste.
- **Quiz de ayer al empezar hoy:** 3 preguntas de lo anterior antes de arrancar tema nuevo.
