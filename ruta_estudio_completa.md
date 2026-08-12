# estudio/ruta_estudio_completa — Currículo AI Engineer

Currículo en **8 fases**, construido desde lo que piden las vacantes remotas de AI/LLM Engineer en 2026. Cada fase: `Objetivo · Teoría · Ejemplo · Ejercicios · Integrador · Proyecto (a GitHub) · Recursos`.

**Proyecto ancla** (evoluciona en todo el currículo): **asistente de operaciones para flota de robots industriales** (extiende tu FleetOps). Empieza como script y termina como agente RAG desplegado con evals. Cada fase le suma una capa.

**Checklist de contratación** que cubrimos:
`async Python · LLM APIs multi-proveedor · system prompts · tool/function calling · RAG · orquestación de agentes · evals y observabilidad · costos · streaming · memoria · guardarraíles/prompt-injection · deploy (Docker) · comunicación de producto`

**Tiempo:** ~2–3 h/día → currículo completo ≈ 5–7 meses. **No hace falta terminarlo para cobrar:** con Fases 1–3 + una capa de evals ya vendés RAG y aplicás a empleo.

Regla de portafolio: **cada proyecto se sube a GitHub, README en inglés** (Problema → Solución → Arquitectura → Métrica → Trade-offs).

---

## Fase 0 — Cimientos (Python + async) · ~1 sem
Cubierta en `00_por_donde_empezar.md`. Salí de acá sabiendo: Python fluido desde JS, `asyncio`/`gather`, `pydantic`, entornos y secretos en `.env`.
- **Proyecto:** script que consulta N robots (mock) concurrentemente.
- **Recursos:** docs de `asyncio`; docs de `pydantic`; "Real Python" async.

---

## Fase 1 — LLM APIs a fondo · ~2 sem

**Objetivo:** usar el modelo como ingeniero, no como usuario de chat.

**Teoría:**
- Mensajes `system`/`user`/`assistant`; el `system` define rol y reglas (80% del comportamiento).
- Multi-proveedor: abstraé detrás de una interfaz propia (`LLMClient`).
- **Structured output:** forzar JSON válido con instrucción estricta + validación `pydantic`. Nunca regex sobre texto libre.
- **Streaming** (latencia percibida) y consumo token a token.
- **Errores/reintentos:** rate limits, timeouts, backoff exponencial.
- **Tokens y costo:** qué es un token; el `system` largo se paga en cada llamada.

**Ejemplo:**
```python
import json
from pydantic import BaseModel

class Triage(BaseModel):
    intent: str          # "estado" | "reasignar" | "mantenimiento"
    robot_id: str | None
    urgency: int         # 1-5

SYSTEM = ("Sos un clasificador. Respondé SOLO JSON válido, sin markdown, "
          "claves: intent, robot_id, urgency (1-5).")

def classify(client, text: str) -> Triage:
    raw = client.complete(system=SYSTEM, user=text)
    return Triage(**json.loads(raw))   # valida acá, controlado
```

**Ejercicios:**
- Quiz: ¿por qué structured output > parsear texto? ¿dónde reintentás si el JSON viene inválido?
- Construí `LLMClient` con `complete()`, `stream()`, reintentos y conteo de tokens.

**Integrador:** clasificador de intención (structured output) para el asistente de flota.

**Proyecto #1:** CLI multi-proveedor con streaming + structured output + manejo de errores.

**Recursos:** docs del proveedor (Anthropic/OpenAI); guía de prompting del proveedor.

---

## Fase 2 — Tool use / function calling · ~2 sem

**Objetivo:** que el modelo ejecute acciones, no solo hable.

**Teoría:**
- Function calling: describís herramientas (nombre, JSON schema); el modelo elige cuál y con qué args; **vos ejecutás** y devolvés el resultado.
- **Loop de agente:** usuario → modelo elige tool → ejecutás → devolvés → responde o elige otra → …
- Diseño de herramientas: chicas, nombres claros, descripciones precisas (la descripción ES parte del prompt).
- **MCP (Model Context Protocol):** estándar para exponer herramientas/datos de forma reutilizable. Varias vacantes lo piden explícito.

**Ejemplo:**
```python
tools = [{
  "name": "get_robot_status",
  "description": "Estado, batería y ubicación de un robot por id.",
  "input_schema": {"type": "object",
    "properties": {"robot_id": {"type": "string"}}, "required": ["robot_id"]},
}]

def agent_loop(client, user_msg):
    messages = [{"role": "user", "content": user_msg}]
    while True:
        r = client.complete(messages=messages, tools=tools)
        if r.stop_reason == "tool_use":
            out = run_tool(r.tool_name, r.tool_input)
            messages += [r.as_message(), tool_result(out)]
            continue
        return r.text
```

**Ejercicios:**
- Quiz: ¿quién ejecuta la tool? ¿qué pasa si pide una que no existe?
- Dale 3 tools al asistente (`get_robot_status`, `reassign_task`, `flag_maintenance`) e implementá el loop.

**Integrador:** exponé esas tools como un **servidor MCP** mínimo.

**Proyecto #2:** agente con herramientas + servidor MCP.

**Recursos:** spec de MCP; docs de tool use del proveedor.

---

## Fase 3 — RAG a fondo (el corazón) · ~3 sem

**Objetivo:** responder con base en documentos propios, con citas, sin alucinar. Patrón más desplegado y más pedido.

**Teoría:**
- Pipeline: `docs → chunking → embeddings → vector DB → retrieval (top-k) → (re-ranking) → prompt con contexto → respuesta con citas`.
- **Embeddings:** texto → vector; similitud = cercanía.
- **Chunking:** tamaño, solape, por estructura. Chunking malo = causa #1 de RAG malo.
- **Vector DB:** empezá con **pgvector** (Postgres, un solo motor datos+vectores). Luego pgvector vs Pinecone vs Weaviate.
- **Retrieval:** similitud, top-k, filtros de metadata, **búsqueda híbrida** (keyword + vectorial).
- **Re-ranking:** reordenar candidatos con un modelo más fino.
- **Citas y anti-alucinación:** responder SOLO con el contexto, citar fuente, decir "no lo sé" si no está.

**Ejemplo:**
```python
def ingest(docs):
    for doc in docs:
        for ch in chunk_text(doc, size=800, overlap=100):
            db.insert(vector=embed(ch.text), text=ch.text, meta=ch.meta)

def answer(query):
    hits = db.search(embed(query), top_k=5, filter=...)   # retrieval
    hits = rerank(query, hits)[:3]                         # opcional
    ctx = format_with_sources(hits)
    system = ("Respondé SOLO con el CONTEXTO y citá [n]. "
              "Si no está en el contexto, decí que no lo sabés.")
    return client.complete(system=system, user=f"{ctx}\n\nPregunta: {query}")
```

**Ejercicios:**
- Quiz: ¿qué es un embedding? ¿por qué el chunking pesa tanto? ¿qué es búsqueda híbrida?
- Ingestá manuales técnicos (o normativa/ políticas de tienda) y respondé 10 preguntas con citas.

**Integrador:** conectá el RAG como **herramienta** del agente de flota (Fase 2). Ahora consulta manuales además de la API.

**Proyecto #3 (ESTRELLA):** RAG sobre documentos reales, con citas, filtros de metadata y manejo de "no sé". Es tu mejor activo para vender **y** para el CV.

**Recursos:** docs de pgvector; guía de embeddings del proveedor; concepto de RAG en docs de LlamaIndex/LangChain (para vocabulario).

---

## Fase 4 — Agentes multi-paso, memoria y guardarraíles · ~3 sem

**Objetivo:** agentes que planifican, recuerdan y son seguros.

**Teoría:**
- **Orquestación:** de loops ad-hoc a grafos de estado (**LangGraph**) o roles (**CrewAI**). Nodos = pasos; estado compartido.
- **Multi-agente:** especializados (planificador, ejecutor, verificador).
- **Memoria:** el contexto largo NO la resuelve. Resumen, memoria por-sesión vs persistente, recuperar solo lo relevante.
- **Guardarraíles / LLM06 "Excessive Agency":** acción irreversible fuera de alcance. Mitigaciones (sabelas explicar en entrevista): least-privilege tools, human-in-the-loop, kill switch, límite de iteraciones, **decisiones deterministas + LLM solo para lenguaje**.

**Ejercicios:**
- Quiz: definí "excessive agency" + 3 mitigaciones. ¿cuándo un grafo le gana a un loop?
- Convertí el asistente a LangGraph con nodo de planificación y checkpoint humano antes de `reassign_task`.

**Integrador:** el asistente decide entre consultar manuales (RAG) o la API según la pregunta, con guardarraíles.

**Proyecto #4:** agente multi-herramienta con guardarraíles **documentados** (README con modelo de amenaza + mitigaciones).

**Recursos:** docs de LangGraph; OWASP LLM Top 10 (para LLM06).

---

## Fase 5 — Evals y observabilidad (el diferenciador de contratación) · ~2 sem

**Objetivo:** medir si el sistema funciona. **Esta fase te consigue el empleo.**

**Teoría:**
- "Si no lo podés medir, no lo podés enviar."
- **Tipos:** offline (set fijo) vs online; métricas de retrieval (precision/recall de chunks) vs de generación; **LLM-as-judge** (un LLM puntúa contra criterios) y su riesgo.
- **Diseñar un eval set:** casos representativos + borde + casos que deben fallar seguro (fuera de dominio → "no sé").
- **Regresión:** correr evals en cada cambio.
- **Observabilidad/tracing:** ver cada paso (tool, retrieval, costo). **OpenTelemetry**, Langfuse.

**Ejemplo:**
```python
cases = [
  {"q": "¿Cada cuánto se lubrica el actuador X?", "must_contain": ["500 h"]},
  {"q": "¿Capital de Francia?", "must_refuse": True},  # fuera de dominio
]
def run_evals(system):
    passed = 0
    for c in cases:
        out = system.answer(c["q"])
        ok = (c.get("must_refuse") and system.refused(out)) or \
             all(k in out for k in c.get("must_contain", []))
        passed += ok; log_trace(c, out, ok)
    return passed / len(cases)
```

**Ejercicios:**
- Quiz: eval de retrieval vs de generación; riesgo de LLM-as-judge.
- 20 casos para tu RAG de Fase 3, medí %, cambiá el chunk size, volvé a medir.

**Integrador:** dashboard/endpoint con el % de calidad + trazas.

**Proyecto #5:** suite de evals + tracing sobre el RAG. **Tu historia de entrevista:** "diseñé el eval set, medí X%, cambié Y, subió a Z."

**Recursos:** docs de Langfuse; OpenTelemetry básico.

---

## Fase 6 — Producción · ~2 sem

**Objetivo:** que corra fuera de tu máquina, barato y seguro.

**Teoría:**
- **Deploy:** **Docker**, API con FastAPI, health checks, env vars.
- **Colas:** trabajos largos fuera del request.
- **Costos:** caching de respuestas/embeddings + routing (modelo barato/ caro) → 40–70% menos.
- **Seguridad:** defensa de **prompt injection**, rate limits, no exponer secretos.
- **Logging** estructurado + trazas de Fase 5.

**Ejercicios:**
- Quiz: ¿qué es prompt injection y cómo lo mitigás? ¿cómo bajás costo sin bajar calidad?
- Dockerizá el agente RAG, exponelo como API con `/health` y logging.

**Integrador:** el asistente de flota desplegado con caching + routing + observabilidad.

**Proyecto #6:** agente RAG desplegado como API contenedorizada. Cierra el arco del proyecto ancla.

**Recursos:** docs de FastAPI; Docker getting started.

---

## Fase 7 — Comunicación de producto · continuo

**Objetivo:** saber contar lo que construiste (predice seniority).

**Teoría:** todo README/case study = Problema → Solución → Arquitectura → Métrica → Trade-offs. Explicá en términos de negocio (ROI, riesgo). Diagramas simples.

**Ejercicio:** reescribí los READMEs de tus 6 proyectos con esa estructura, cada uno con una métrica y un trade-off explicado.

---

## Mapa de dependencias
```
Fase 0 → 1 → 2 → 3 ─┬─► 5 (evals) → 6 (prod)
                    │
              4 (agentes+guardarraíles)
Fase 7 atraviesa todo.
```

## Checklist "listo para aplicar a empleo"
- [ ] async Python sólido
- [ ] Wrapper multi-proveedor (streaming + structured output)
- [ ] Agente con tools + servidor MCP
- [ ] **RAG con citas, sobre docs reales, público**
- [ ] Agente con guardarraíles documentados (LLM06)
- [ ] **Suite de evals con número de calidad + historia para contar**
- [ ] Algo desplegado (Docker + API)
- [ ] READMEs en inglés con Problema→Métrica→Trade-off
