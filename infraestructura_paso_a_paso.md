# negocio/infraestructura_paso_a_paso

Todo lo operativo para que el negocio exista y pueda cobrar. Montá en el orden de abajo; no todo el día 1.

---

## 0. Orden de montaje (qué primero)

```
FASE A (esta semana, gratis o casi):
  GitHub · correo profesional · dominio · landing de 1 página · Meta Business + WABA (sandbox)

FASE B (antes del primer cobro):
  Método de pago (Wise/Payoneer) · WhatsApp Cloud API productivo · hosting

FASE C (cuando escale):
  n8n self-host · BSP si el volumen lo pide · marca formal · contador
```

No pagues nada hasta tener señales de venta. Casi todo esto arranca gratis.

---

## 1. Identidad y presencia (Fase A)

**Nombre de marca.** Elegí un nombre corto para tu práctica de automatización (no uses "Dovi", eso es la tienda). Sirve para correo, dominio y landing. Ej: algo tipo `[nombre]automation` / `[nombre]labs`.

**Correo profesional.** No vendas desde un @gmail personal. Opciones:
- **Zoho Mail:** plan gratuito con dominio propio (más barato para empezar).
- **Google Workspace:** ~USD 6/mes, mejor integración.
- Formato: `hola@tudominio.com`, `juan@tudominio.com`.

**Dominio.** Comprá `tudominio.com` (Namecheap/Cloudflare, ~USD 10/año). Es barato y sube credibilidad enorme frente a un cliente.

**Landing de 1 página.** No necesitás web completa todavía. Una página que diga: qué problema resolvés (confirmación COD), para quién, prueba (case study de Dovi), y un botón de WhatsApp/contacto.
- Rápido y gratis: **Carrd**, **Framer**, o una página estática. Después la reemplazás por una en Next.js si querés.
- Contenido mínimo: titular con el dolor + resultado, 3 bullets de qué hacés, 1 case study con métrica, CTA a WhatsApp.

**GitHub** (si no lo tenés): cuenta + perfil en inglés. Acá va el portafolio de estudio y los case studies.

---

## 2. WhatsApp: cómo funciona y cómo no quemar plata

Esto es el corazón técnico de la Oferta A. Entendé el modelo antes de construir.

**App gratis vs API.** La app de WhatsApp Business (gratis) automatiza poco y es 1 dispositivo. Para vender a clientes necesitás la **WhatsApp Cloud API** (Meta), que permite varios agentes, plantillas y automatización real.

**Cómo se cobra (clave para el margen).** Desde julio 2025 Meta cobra **por mensaje** (ya no por conversación). Lo que tenés que saber:
- El precio depende del **país del destinatario** y de la **categoría** del mensaje.
- **Colombia está entre los países más baratos** para mensajes.
- **Plantillas UTILITY** (confirmación de pedido, envío) cuestan **mucho menos** que MARKETING (~80–90% menos). **Tu confirmación COD es utility, nunca marketing.** Clasificarla mal duplica el costo.
- **Ventana de servicio de 24 h:** si el cliente escribe primero (o responde), tus respuestas dentro de 24 h son **gratis**.
- **Ventana de 72 h de anuncios Click-to-WhatsApp:** cuando el lead entra desde un anuncio, 72 h de mensajería gratis. **Los vendedores COD pautean → tus confirmaciones caen seguido en esta ventana gratis.** Diseñá el flujo para aprovecharla.
- Hay ~1.000 conversaciones de servicio gratis/mes por cuenta.

**Meta directo vs BSP.** Podés ir directo con la Cloud API de Meta (más barato, más control — ideal para vos que sos dev) o vía un BSP (Twilio, 360dialog, Gupshup, Wati) que agrega markup (~USD 0.003–0.010/mensaje) pero simplifica. **Recomendación:** empezá **directo con Meta Cloud API** (sos ingeniero, no necesitás el wrapper). Considerá un BSP solo si un cliente necesita algo que Meta directo no dé fácil.

**Qué abrir (Fase A→B):**
1. Cuenta de **Meta Business**.
2. **WhatsApp Business Account (WABA)** + número.
3. App en Meta for Developers → credenciales de la Cloud API (empezá en sandbox).
4. Registrar y aprobar tus **plantillas utility** de confirmación.

---

## 3. Cómo cobrar (Fase B)

Regla: **evitá el SWIFT del banco tradicional** (comisiones altas y te convierten a pesos a la fuerza). Stack recomendado para Colombia:

| Herramienta | Para qué | Nota |
|---|---|---|
| **Wise** | Clientes que te pagan directo en USD | Te da cuenta con **routing/account de EE.UU.**; el cliente paga como si fueras local en USA. Comisiones bajas. 100% online desde Colombia. |
| **Payoneer** | Marketplaces (Upwork/Fiverr) | Prácticamente obligatorio si usás esas plataformas; cuenta virtual USA + tarjeta. |
| **Deel** | Empleo / contractor con una empresa | Maneja contrato, factura y retiros (incluye Deel Card física en Colombia). Ideal para el track empleo. |
| **Local (Nequi/PSE/Bancolombia)** | Clientes COD que pagan en COP | Tus clientes LatAm probablemente pagan en pesos; tené esto listo también. |

- Global66 y Airtm (USDC) son alternativas válidas.
- **Abrí Wise ya** (gratis) — es tu default para USD.

**Impuestos/legal (no soy contador, confirmá con uno):** al facturar servicios vas a necesitar tu **RUT** y definir régimen; hay implicaciones al recibir ingresos del exterior. No lo dejes para diciembre. Una consulta con un contador temprano te evita dolores. Esto no es asesoría fiscal.

---

## 4. Hosting e infra técnica (Fase B→C)

Para correr el producto que construye Claude Code:
- **Hosting app:** Railway o Render para empezar (deploy fácil desde GitHub); VPS (Hetzner/DigitalOcean) cuando quieras más control/menos costo.
- **PostgreSQL:** gestionado (Railway/Neon/Supabase) al inicio.
- **Redis:** para la cola (BullMQ) — gestionado o en el mismo VPS.
- **n8n self-host (Fase C):** para automatizaciones de clientes que no valen código a medida. Self-host = margen (evitás el costo del SaaS). Recordá tus trampas ya documentadas: idempotencia con `getWorkflowStaticData()`/DB (no `Set` en memoria) y `NODE_FUNCTION_ALLOW_EXTERNAL` para módulos en Code node.

---

## 5. Checklist de cuentas

```
[ ] GitHub (perfil en inglés)
[ ] Dominio (Namecheap/Cloudflare)
[ ] Correo profesional (Zoho/Workspace) @tudominio.com
[ ] Landing 1 página (Carrd/Framer)
[ ] Meta Business + WABA + número
[ ] Meta for Developers app (Cloud API, sandbox → productivo)
[ ] Plantillas utility aprobadas
[ ] Wise (USD)  ·  Payoneer (marketplaces)  ·  local (COP)
[ ] Hosting + Postgres + Redis
[ ] LinkedIn actualizado (ver 03_portafolio_y_empleo del bundle anterior)
[ ] Consulta con contador (RUT/régimen)
```

---

## 6. Qué NO hacer todavía
- No armes una web grande ni logo caro: una landing y un case study venden más.
- No pagues un BSP ni n8n cloud hasta tener volumen que lo justifique.
- No compres cursos de "agencia de IA": el material que tenés + construir cubre eso.
- No formalices una empresa (SAS) antes de tener ingreso recurrente; primero validá.
