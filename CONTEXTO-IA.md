# 🧠 CONTEXTO DEL PROYECTO — Costamallas ERP

> **Propósito de este documento:** dar a cualquier IA (o desarrollador nuevo) todo el
> contexto necesario para entender el proyecto **sin tener que adivinar nada**: qué es,
> cómo está construido, dónde está alojado y cómo se conecta con los servicios externos
> (Vercel, Supabase, WooCommerce, FTP, IA, plataformas de Ads).
>
> **Última actualización:** 2026-08-29 · Commit de referencia: `c566d9c`
> _Mantén este archivo actualizado cuando cambie la arquitectura o las integraciones._
>
> **Antes de tocar nada, lee también:**
> - `PLAN-FASES.md` — las 5 fases del proyecto, qué hay cerrado y qué falta.
> - `PENDIENTES-GERENCIA.md` — los datos comerciales que faltan (plazos de pago,
>   precios de instalación, enlace de reseñas…). Varios módulos están construidos
>   pero esperando uno de esos datos.
> - `§12 Cómo se trabaja en este repo` — las trampas que ya costaron tiempo
>   (migraciones, build, OneDrive, Sidebar). No las redescubras.

---

## 1. Qué es el proyecto

**Costamallas ERP** es un portal interno (ERP + CRM + PIM) para la empresa **Costamallas**
(fabricante/distribuidor de mallas metálicas, nylon, plásticas, para balcones y seguridad
perimetral, en Colombia).

Centraliza:
- **Productos (PIM):** catálogo con campos técnicos (ACF) específicos por categoría,
  filtros de trabajo (sin imagen, sin precio, sin SEO…) y guía de completitud.
- **CRM:** clientes, **cotización 2.0** (dos plantillas, enlace público, envío por
  correo y seguimiento de aperturas), pedidos, **pipeline** con valor y días por
  etapa, **embudo** con la tasa de cierre, **instalaciones** con calendario,
  evidencia fotográfica y acta de entrega, tareas.
- **Política comercial:** tope de descuento y anticipo mínimo, con aprobación de
  administrador y registro de quién autorizó qué.
- **Seguimiento post-cotización:** los tres toques posteriores al envío de una
  oferta (§3.7).
- **Compras/ERP:** proveedores con sus productos, órdenes de compra con envío por
  correo y recepción de mercancía que suma stock, control de inventario.
- **Facturación:** facturas, pagos, **cartera por antigüedad**, recordatorios de
  cobro y adaptador (sin conectar) para facturación electrónica DIAN.
- **Postventa:** políticas públicas (`/politicas`) y QR de encuesta de satisfacción.
- **Imágenes:** biblioteca con subida por **FTP** al hosting del catálogo.
- **Sincronización con la tienda WooCommerce** (costamallas.com): exportar productos
  (incluidos ficha técnica ACF y metadatos de **Yoast SEO**) e importar pedidos.
- **Marketing:** conexiones OAuth con Google/Meta/TikTok Ads, campañas, atribución UTM, leads.
- **Nexus:** hub omnicanal — entrada por webhook, reparto por turno entre asesores,
  bot que califica el primer mensaje, salida real por WhatsApp Cloud API
  (pendiente de la aprobación de Meta) e informe del **tiempo de respuesta**
  medido en horario hábil, que es donde se verifica el compromiso de la hora.
- **Asistente de IA** flotante: el agente **Sembli**, con herramientas y jerarquía
  de acceso por rol.
- **Cotizador web público** (`/cotizar`) que captura leads desde la web.

El idioma del producto, el código (nombres de modelos/campos) y la UI es **español**.

---

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | **Next.js 15** (App Router) + **React 19** | `next dev --turbo`; build hace `prisma generate && next build` |
| Lenguaje | **TypeScript 5.7** | alias de import: `@/*` → `src/*` |
| Estilos | **Tailwind CSS 3.4** + dark mode | `BrandContext` maneja color de marca y tema |
| Estado | **Zustand** (`authStore`) + **TanStack React Query** | |
| ORM / DB | **Prisma 5.22** sobre **PostgreSQL** | esquema en `prisma/schema.prisma` |
| Auth | **JWT (jose)** en cookies `httpOnly` + **bcryptjs** | sin librería externa de sesiones |
| 2FA | **otplib** (TOTP, Google Authenticator) + **qrcode** | |
| Validación | **Zod** | esquemas en `src/lib/validations/` |
| FTP | **basic-ftp** | subida de imágenes |
| UI utils | **lucide-react**, **react-hot-toast**, **clsx**, **tailwind-merge** | |

---

## 3. Infraestructura y servicios externos (LO MÁS IMPORTANTE)

Este es el contexto que se pierde fácilmente. El proyecto **depende de varios servicios
externos**; el código local no funciona sin ellos.

### 3.1 Vercel — Hosting / Deploy
- El proyecto se despliega en **Vercel** (Next.js). Cada `git push` a `main` en el repo
  **GitHub `jortiz0610/costamallas`** dispara un deploy automático.
- Varios commits del historial son `trigger deploy` / `force redeploy` → confirman que el
  flujo de release es **push a GitHub → build en Vercel**.
- **Las variables de entorno de producción se configuran en el dashboard de Vercel**
  (Settings → Environment Variables), NO en archivos `.env` del repo (`.env*` está en
  `.gitignore`). Hay que replicar ahí las mismas claves de la sección 7.
- `next.config.ts` define cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.) y
  los `remotePatterns` de imágenes permitidas (`costamallas.com`, `*.woocommerce.com`).

⚠️ **El plan es Hobby, y eso condiciona el diseño:**
- **Máximo 2 cron jobs y solo frecuencia diaria.** Un cron más frecuente que diario
  no falla suave: **rompe el deploy entero** y el auto-deploy se cae en silencio.
  Los dos cupos están usados (`vercel.json`):
  `/api/cron/sync-woo` a las 06:00 UTC y `/api/cron/diario` a las 13:00 UTC
  (= 8 a.m. en Colombia). **Todo lo que haya que correr una vez al día tiene que
  entrar dentro de `/api/cron/diario`, no como un cron nuevo.**
- Las funciones cortan a los **60 s**.
- El plan Hobby **prohíbe el uso comercial**. Esto es un portal de una empresa que
  factura: hay que pasar a Pro. Es una decisión del dueño, no un pendiente técnico.

### 3.2 Supabase — Base de datos PostgreSQL
- La base de datos es **PostgreSQL alojada en Supabase**.
- Prisma usa **dos URLs** (patrón estándar de Supabase + PgBouncer):
  - `DATABASE_URL` → **Transaction Pooler** (puerto `6543`, con `?pgbouncer=true`). Es la
    que usa la app en runtime.
  - `DIRECT_URL` → **conexión directa** (puerto `5432`). La usan `prisma migrate` / `prisma db push`.
  - Ver `datasource db` en `prisma/schema.prisma` (`url` + `directUrl`).
- El commit `7d5bf52 fix: pgbouncer url` confirma que hubo que ajustar la URL del pooler.
- **No hay Supabase Auth ni Supabase Storage**: solo se usa Supabase como Postgres. La
  autenticación es propia (JWT) y las imágenes van por FTP (no a Supabase Storage).
- **Las migraciones se aplican a mano, con un script propio.** Ver §12: ni
  `prisma db execute` ni un script suelto de Prisma funcionan contra esta base.
  Migraciones en `prisma/migrations/` (sí se versionan; hasta agosto de 2026
  estaban en `.gitignore` y vivían solo en el PC de quien las corrió).

### 3.3 WooCommerce — Tienda (costamallas.com)
- Integración con la **REST API v3** de WooCommerce (`/wp-json/wc/v3/...`), cliente en
  `src/lib/woocommerce.ts`. Auth = Basic (consumer key/secret en base64).
- **Las credenciales NO viven en `.env` en producción**: se guardan **cifradas (AES-256-GCM)
  en la tabla `configuracion`** (claves `wc_store_url`, `wc_consumer_key`, `wc_consumer_secret`)
  y se editan desde **Configuración → Credenciales WooCommerce** en el portal. Las variables
  `WC_*` del `.env` son solo fallback.
- Funciones clave: `testWCConnection`, `syncProductosToWC` (exporta productos → crea/actualiza
  por `wcId`), `importarPedidosWC` (importa pedidos y autocrea clientes en el CRM por
  email/teléfono), `generarCSVWooCommerce` (export en formato CSV de WooCommerce).
- Rutas: `/api/woocommerce/test`, `/api/woocommerce/import`, `/api/woocommerce/import-orders`,
  `/api/exportar/woocommerce`.

### 3.4 FTP — Imágenes del catálogo (Hostinger)
- Las imágenes de productos se suben por **FTP** a `catalogo.costamallas.com`
  (hosting Hostinger), no a Vercel ni a Supabase. Cliente en `src/lib/ftp.ts`.
- Config por entorno: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_BASE_PATH`
  (`/home/u873653854/domains/costamallas.com/public_html/catalogo`), `FTP_BASE_URL`
  (`https://catalogo.costamallas.com`).
- Las URLs públicas resultantes quedan bajo `https://catalogo.costamallas.com/<subcarpeta>/<archivo>`.
- Rutas: `/api/imagenes`, `/api/imagenes/upload`.

### 3.5 IA generativa — agente **Sembli** (Claude)

El asistente es un **agente con herramientas**, no un chat de texto suelto. Vive en
`src/lib/sembli/` y usa el SDK oficial `@anthropic-ai/sdk`.

| Archivo | Qué hace |
|---------|----------|
| `modelos.ts` | Registro de modelos y **forma del request por modelo**. Cada modelo de Claude acepta parámetros distintos; mandar el equivocado devuelve 400. Ver los avisos del archivo. |
| `alcance.ts` | Jerarquía de acceso: `CLIENTE < VENDEDOR < ADMIN < SUPERADMIN`. Mapea `Rol` → nivel, con **fail-closed** (rol raro cae a CLIENTE). |
| `herramientas.ts` | Las 11 herramientas, cada una con `nivelMinimo`. `ejecutarHerramienta()` **revalida el nivel**: la autorización es del servidor, no del prompt. |
| `agente.ts` | Bucle manual de tool-use (tope de 6 vueltas), registro de consumo y helpers `pedirJSON` / `pedirTexto`. |

**Modelos (estrategia híbrida para gastar poco):**
- Chat de Sembli y Nexus → `claude-haiku-4-5` (US$1/US$5 por MTok). Alto volumen.
- Ficha técnica PDF y SEO → `claude-sonnet-5` (US$3/US$15). Calidad puntual.

⚠️ **Trampas de la API ya resueltas en `modelos.ts` — no las reintroduzcas:**
- Haiku 4.5 **no** acepta `output_config.effort` (error). Su thinking usa el formato
  viejo `{type:"enabled", budget_tokens}`.
- Sonnet 5 **sí piensa aunque omitas `thinking`** (adaptive por defecto) y cobra por
  ello: hay que apagarlo explícitamente. Rechaza `budget_tokens` y `temperature`.
- Prompt caching: **hoy no entra**. El prefijo mide ~1.370 tokens (CLIENTE) / ~2.364
  (ADMIN) y Haiku 4.5 exige 4.096 mínimo. No es un bug; está medido y documentado.

**Costo medido:** ~US$0,006–0,008 por consulta (≈US$6–8 por 1.000). La palanca para
bajarlo es el tamaño de lo que devuelven las herramientas, no la caché.

**Credencial:** la API key va **cifrada en `configuracion.ai_api_key`** (AES-256-GCM).
Se carga con `npm run sembli:activar` (lee un archivo con la key, la cifra y la
guarda; nunca la imprime). `ANTHROPIC_API_KEY` del entorno es solo respaldo local.

**Nivel CLIENTE:** `Usuario.clienteId` ata un login a una ficha del CRM y el rol
`CLIENTE` limita a Sembli a los pedidos de ese cliente. Requirió DDL aditivo en
producción (columna nullable + valor de enum + índice), ya aplicado el 2026-07-30.

**Rutas:** `/api/sembli/chat` (POST conversar, GET capacidades y sugerencias).
Las viejas `/api/ai/*` siguen ahí y se migrarán a este núcleo.

**Verificación (no gasta tokens):** `npx tsx scripts/verificar-sembli.ts` — 26
comprobaciones del límite de seguridad contra la BD real (escalada de privilegios,
fuga de campos internos al cliente, aislamiento entre clientes).
**Prueba real (sí gasta):** `npx tsx scripts/probar-sembli.ts`.

### 3.6 Correo saliente (SMTP)

- Cliente en `src/lib/correo.ts`, sobre **nodemailer**. Lo usan las órdenes de
  compra a proveedores, el envío de la cotización, los recordatorios de cartera,
  el seguimiento post-cotización y el aviso al coordinador de obras.
- Las credenciales van **cifradas en `configuracion`** (`smtp_host`, `smtp_port`,
  `smtp_secure`, `smtp_user`, `smtp_password`, `smtp_from_name`,
  `smtp_from_email`) y se editan en **Configuración → Correo**.
- ⚠️ **Hay que cargarlas desde el portal EN PRODUCCIÓN.** Lo que se cifra en local
  no se puede descifrar en Vercel: la `ENCRYPTION_KEY` es distinta. Si pasa,
  `getConfigCorreo()` lo trata como "sin configurar" en vez de tumbar el módulo, y
  `estadoCorreo()` devuelve `descifra: false` para poder decirlo en pantalla.
- **Hoy NO está configurado.** Todo lo que manda correo lo dice en pantalla con el
  motivo, y no simula haber enviado.
- Los errores de SMTP se traducen a castellano entendible antes de mostrarlos.

### 3.7 Seguimiento post-cotización

Los tres toques que pidió la gerencia para subir la tasa de cierre del 10 % al 28 %.
Motor en `src/lib/seguimiento.ts`, textos en `seguimiento-textos.ts` (sin Prisma,
para que la pantalla de configuración no arrastre Postgres al navegador).

| Toque | Cuándo | Quién |
|-------|--------|-------|
| 1 · confirmar que llegó | 24 h después de enviar | automático (correo) |
| 2 · llamada | tarea a las 48 h, plazo hasta las 72 h | **una persona** |
| 3 · aviso de vencimiento | 1 día antes de vencer la oferta | automático (correo) |

- Si el asesor no marca el toque 2 dentro del plazo, se avisa a los ADMIN del
  portal (notificación + correo). **Una sola vez**: un aviso diario se deja de leer.
  Antes de acusar a nadie se comprueba la tarea, por si la cerró desde `/crm/tareas`.
- **Diseñado para una corrida diaria** (limitación de Hobby): cada toque se dispara
  cuando "ya pasó su hora", no en una ventana estrecha. Si el cron se salta un día,
  al siguiente se pone al corriente.
- Sin SMTP, el toque queda **PENDIENTE con el motivo**, no como enviado: se
  reintenta cada día y sale solo cuando se carguen las credenciales.
- WhatsApp: el texto se arma y se guarda, pero el envío se registra como fallido con
  el motivo real. `enviarWhatsAppDirecto()` (en `nexus/canales.ts`) funciona el día
  que Meta apruebe, sin tocar nada.
- Se puede apagar por cotización (`cotizaciones.seguimientoActivo`).
- Diagnóstico sin tocar la base: `npx tsx scripts/revisar-seguimiento.ts` (solo
  lectura, modo simulacro) o el botón "Ver qué haría hoy" en Configuración.

### 3.8 Marketing — OAuth de Ads (Google / Meta / TikTok)
- Framework OAuth en `src/lib/marketing-oauth.ts`. URLs de auth/token y scopes por plataforma.
- `clientId`/`secret`/`accountId`/`token` se guardan **cifrados en `configuracion`**
  (claves `mkt_oauth_<plataforma>_<campo>`). El `secret` y el `token` se cifran; el resto no.
- Flujo: `/api/marketing/oauth/[plataforma]` (inicia) → `/api/marketing/oauth/callback` (recibe code).
  Estas rutas son **públicas** en el middleware.

---

## 4. Arquitectura del código

```
costamallas-erp/
├── prisma/
│   ├── schema.prisma            # Modelo de datos (PostgreSQL). Fuente de verdad del dominio.
│   └── migrations/              # Migraciones SQL, aplicadas a mano (ver §12)
├── scripts/
│   ├── seed.ts                  # Datos iniciales (admin, catálogos, config, productos demo)
│   ├── aplicar-migracion.ts     # ⭐ Aplica un .sql sentencia por sentencia (ver §12)
│   ├── activar-sembli.ts        # Carga y cifra la API key de Anthropic
│   ├── verificar-sembli.ts      # 26 comprobaciones del límite de acceso (no gasta tokens)
│   ├── probar-sembli.ts         # Prueba real del agente (SÍ gasta tokens)
│   ├── revisar-seguimiento.ts   # Simulacro del seguimiento contra la base (solo lectura)
│   ├── revisar-fotos.ts         # Qué imágenes del catálogo están rotas (solo lectura)
│   ├── probar-tiempos.ts        # 15 comprobaciones del reloj hábil (lógica pura, sin BD)
│   ├── verificar-comercial.ts   # 14 invariantes de lo comercial contra la BD (solo lectura)
│   ├── crear-usuario.ts         # Alta de usuario con contraseña temporal aleatoria
│   └── generar-iconos-pwa.ts
├── docs/
│   └── SETUP.md                 # Guía de instalación paso a paso
├── src/
│   ├── middleware.ts            # ⭐ Auth + rate limit en TODAS las rutas (ver §5)
│   ├── app/
│   │   ├── (auth)/login/        # Página de login (pública)
│   │   ├── (dashboard)/         # Portal protegido (todas las páginas internas)
│   │   ├── cotizar/             # Cotizador web PÚBLICO (captura leads)
│   │   ├── cotizacion/[token]/  # La oferta que ve el cliente, PÚBLICA (noindex)
│   │   ├── politicas/           # Políticas PÚBLICAS (envíos, devoluciones, datos)
│   │   └── api/                 # Backend (route handlers). Ver §6
│   ├── components/              # crm, dashboard, erp, layout, productos
│   ├── contexts/BrandContext.tsx# Tema (dark mode) y color de marca
│   ├── hooks/                   # useAuth, useNotificaciones
│   ├── lib/                     # ⭐ Integraciones e infraestructura (ver §3)
│   │   ├── auth.ts              # JWT + cookies httpOnly + guards de rol
│   │   ├── encryption.ts        # AES-256-GCM (formato iv:authTag:ciphertext en base64)
│   │   ├── prisma.ts            # Singleton de PrismaClient
│   │   ├── woocommerce.ts       # Cliente WC REST v3
│   │   ├── ftp.ts               # Subida de imágenes
│   │   ├── ai.ts                # Motor viejo de IA (se está migrando a sembli/)
│   │   ├── sembli/              # El agente: modelos, alcance, herramientas, bucle
│   │   ├── nexus/               # Canales de salida, reparto por turno, bot, plantillas
│   │   ├── correo.ts            # SMTP (nodemailer), credenciales cifradas
│   │   ├── seguimiento.ts       # Los 3 toques post-cotización (+ seguimiento-textos.ts)
│   │   ├── politica-comercial.ts# Tope de descuento y anticipo mínimo
│   │   ├── plazos-pago.ts       # Formas de pago → fecha de vencimiento de la factura
│   │   ├── postventa.ts         # Políticas públicas y encuesta (+ postventa-defaults.ts)
│   │   ├── instalaciones.ts     # Aviso al coordinador cuando se cierra una venta
│   │   ├── cotizacion-config.ts # Contenido de la cotización (+ cotizacion-textos.ts)
│   │   ├── facturacion.ts       # Consecutivos y adaptador DIAN (sin conectar)
│   │   ├── consecutivos.ts      # Contador atómico compartido (COT, PED, FAC…)
│   │   ├── marca.ts             # Datos de empresa para documentos del servidor
│   │   ├── marketing-oauth.ts   # OAuth Google/Meta/TikTok Ads
│   │   ├── marketing.ts         # KPIs de marketing (ROAS, CPC, CPL, CTR…)
│   │   ├── twofa.ts             # 2FA TOTP + dispositivos confiables (7 días)
│   │   ├── rate-limit.ts        # Rate limiting en memoria
│   │   ├── colombia.ts          # Departamentos/ciudades CO
│   │   ├── timezone.ts          # Zona horaria Colombia
│   │   └── validations/         # Esquemas Zod (auth, producto)
│   ├── store/authStore.ts       # Estado de auth (Zustand)
│   └── types/index.ts           # Tipos compartidos (JWTPayload, Rol, ProductoDetalle…)
```

**Patrón de las API routes:** el `middleware.ts` valida el JWT e **inyecta** `x-user-id`,
`x-user-email`, `x-user-rol` en los headers de la request; las route handlers leen esos
headers en vez de re-verificar el token.

---

## 5. Autenticación y seguridad

- **Login:** `POST /api/auth/login` → valida con Zod, compara bcrypt (en tiempo constante
  contra timing attacks), emite **access token (7d)** y **refresh token (30d)** como cookies
  `httpOnly`. El refresh token se guarda en la tabla `refresh_tokens` (revocable).
- **2FA (opcional por usuario):** si está activo y el dispositivo no es de confianza, el login
  exige un código TOTP (`twoFactorRequired: true`). Tras verificar, el dispositivo se "recuerda"
  7 días vía cookie firmada `cm_2fa_trust`. El secreto 2FA se guarda **cifrado** en `configuracion`
  con clave `2fa:<userId>` (no hay tabla dedicada).
- **Middleware (`src/middleware.ts`):**
  - Rate limit por IP+ruta en todas las `/api/` (200 req/ventana; login = 10/min).
  - Rutas públicas: `/login`, `/api/auth/login`, `/cotizar`, `/api/public`,
    `/api/marketing/oauth`, `/api/cron`, `/cotizacion`, `/politicas`.
  - API sin auth → `401`; página sin auth → redirect a `/login`.
- **Roles (`enum Rol`):** `SUPERADMIN, ADMIN, USUARIO, VENDEDOR, PRODUCCION, BODEGA,
  SOLO_LECTURA, CLIENTE`. `canWrite()` = cualquiera excepto `SOLO_LECTURA`.
- **Permisos por SUBMÓDULO y por USUARIO** (desde el 28-ago). Dos capas que
  conviene no confundir:
  1. El **rol** trae un juego por defecto, en código (`PERMISOS_POR_ROL` de
     `lib/permisos.ts`). Es política de la empresa: si mañana se agrega una
     pantalla, todos los vendedores la ganan a la vez.
  2. Cada **persona** puede tener EXCEPCIONES, en la tabla `permisos_usuario`.
     **Solo las excepciones** — si se guardara el juego completo por usuario, el
     día que el rol gane una pantalla no la vería nadie.

  Se aplica en tres sitios, y solo el tercero protege datos:
  · `Sidebar`/`MobileNav` filtran el menú (presentación).
  · `GuardiaRuta` en el layout cierra la pantalla si se llega escribiendo la URL.
    Va en el layout y no en cada página por lo mismo que el bloqueo del modo
    prueba vive en el middleware: una comprobación por página falla el día que
    alguien agregue una.
  · `exigirPermiso()` en las route handlers. Es lo único que un `fetch` desde la
    consola del navegador no puede saltarse.

  Al **SUPERADMIN** no se le puede quitar nada, a propósito: una excepción mal
  puesta que le cerrara la pantalla de usuarios no tendría cómo deshacerse.
  ⚠️ Ojo: `isAdmin()` de `lib/auth.ts` compara **solo** con `ADMIN` y deja fuera a
  `SUPERADMIN`. Para permisos nuevos usa `esAdmin()` de `lib/permisos.ts`, que sí
  incluye a los dos.
- **Lo público lleva `noindex`:** `/cotizacion` tiene su propio layout con
  noindex/nofollow (una oferta lleva nombre, productos y precios del cliente) y el
  `robots.txt` del portal es `Disallow: /` completo.
- **Cifrado:** datos sensibles (credenciales WC, tokens OAuth, API key de IA, secreto 2FA) se
  cifran con **AES-256-GCM** (`ENCRYPTION_KEY`, 32 bytes hex). Formato `iv:authTag:ciphertext`.
- **Cabeceras HTTP de seguridad** definidas en `next.config.ts` (CSP, HSTS, X-Frame-Options…).
- **Auditoría:** acciones críticas se registran en la tabla `logs`.

---

## 6. Módulos y rutas API

Páginas (bajo `(dashboard)` salvo indicación): inicio, `categorias`, `compras`,
`configuracion`, `crm` (+ `clientes`, `cotizaciones` [+ `nueva`, `[id]`], `embudo`,
`pedidos`, `instalaciones` [+ `[id]/acta`], `pipeline`, `tareas`), `errores`,
`exportar`, `facturacion` (+ `nueva`, `[id]`, `cartera`, `sin-vencimiento`),
`imagenes`, `importar`, `marketing` (+ `atribucion`, `campanas`, `reportes`, `retorno`),
`nexus` (+ `flujos`, `plantillas`, `tiempos`), `postventa`, `productos` (+ `nuevo`, `[id]`, `seo`),
`reportes`, `sistema/{seguridad,reportes}`, `stock`, `usuarios`, `woocommerce`.
`crm/cotizador` quedó como redirección al cotizador único.

**Públicas:** `(auth)/login`, `cotizar`, `cotizacion/[token]`, `cotizacion/demo`
y `politicas`.

**Configuración** es una sola página con pestañas: Empresa · IA · Correo ·
Cotización · **Seguimiento** · **Reglas comerciales** · **Postventa** ·
Instalación · Facturación · Canales & Redes · Conexiones Ads · WooCommerce ·
Falabella · MercadoLibre · Usuarios WP. Las pestañas viven en
`src/components/configuracion/Tab*.tsx`.

Endpoints API (`src/app/api/`):
`ai/{chat,config,ficha,producto,nexus-reply}` · `ai/seo` (+ `seo/lote`, `seo/propuestas`) ·
`auth/{login,logout,me}` ·
`catalogos` · `categorias/campos` ·
`compras/{proveedores,ordenes}` (+ `[id]`, `[id]/enviar`, `[id]/productos`) ·
`configuracion/{empresa,correo,cotizacion,seguimiento,comercial,plazos,postventa,instalacion}` ·
`crm/{clientes,cotizaciones,pedidos,tareas,instalaciones,instalacion-catalogo,embudo}`
(+ `cotizaciones/[id]/{enviar,seguimiento,aprobacion}`) ·
`cron/{sync-woo,diario}` · `dashboard/kpis` · `exportar/woocommerce` ·
`facturacion/{config,cartera,sin-vencimiento,facturas}` (+ `[id]/{emitir,pago,recordatorio}`) ·
`health` · `imagenes` (+ `upload`, `limpiar-rotas`) · `logs` ·
`ai/costos` (qué cuesta cada tarea de IA, medido) ·
`configuracion/agente-web` ·
`mantenimiento/imagenes-ftp` (rescate FTP → WordPress; CRON_SECRET o admin) ·
`marketing/{campanas,conexiones,leads,retorno,oauth/[plataforma],oauth/callback}` ·
`nexus/{conexiones,conversaciones,mensajes,plantillas,flujos,estado,tiempos,webhook/[canal]}` ·
`notificaciones` · `postventa/qr` · `productos` (+ `[id]`, `[id]/ficha`) ·
`public/{lead,productos}` · **`public/agente`** (el agente de la web) y
`public/agente/widget.js` (el chat que se pega en WordPress) ·
`crm/cotizaciones/[id]/compartir` ·
`reportes-error` · `sembli/chat` · `sistema/health` ·
`stock` (+ `alertas`) · `usuarios` (+ `lista`, `[id]`, `[id]/2fa`) ·
`woocommerce/{import,import-orders,test,diagnostico}` · `wordpress/test`.

---

## 7. Variables de entorno

Plantilla en `.env.example`. En **local** van en `.env.local`; en **producción** en el
**dashboard de Vercel**. `.env*` está en `.gitignore` (nunca se commitea).

| Variable | Para qué | Dónde se obtiene |
|----------|----------|------------------|
| `DATABASE_URL` | Postgres runtime (pooler 6543, `pgbouncer=true`) | Supabase → Connection string (Transaction) |
| `DIRECT_URL` | Migraciones Prisma (directo 5432) | Supabase → Connection string (Direct) |
| `JWT_SECRET` | Firma de JWT (mín. 32, ideal 64+ chars) | `openssl rand -base64 64` |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Vigencia tokens (7d / 30d) | — |
| `ENCRYPTION_KEY` | AES-256-GCM (64 chars hex = 32 bytes) | `openssl rand -hex 32` |
| `WC_STORE_URL` / `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | Fallback WooCommerce (lo real va cifrado en BD) | WooCommerce → REST API |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` | URL y nombre del portal | — |
| `NODE_ENV` | `development` / `production` | — |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Límite de requests | — |
| `FTP_HOST` / `FTP_USER` / `FTP_PASSWORD` / `FTP_BASE_PATH` / `FTP_BASE_URL` | Subida de imágenes a Hostinger | Hostinger (cuenta FTP) |
| `CRON_SECRET` | Autoriza a Vercel Cron a llamar `/api/cron/*` | Cualquier cadena larga aleatoria |
| `PORTAL_URL` | El portal, cuando no hay petición de la que sacar el origen (la corrida diaria). Sin ella se usa `portal.costamallas.com` | — |
| `COTIZACION_URL` | Dominio desde el que se le sirve la oferta al CLIENTE. Sin ella se usa el portal, y todo sigue funcionando | Ver PENDIENTES §16 |

⚠️ **`NEXT_PUBLIC_APP_URL` no es cosmética.** Es la base de los enlaces que se
mandan por correo (la cotización pública, el seguimiento, el aviso al coordinador).
Si está mal, el cliente recibe un enlace que no abre. `NEXTAUTH_URL` y `VERCEL_URL`
**no existen en este proyecto**: hubo que corregir un webhook que se armaba con
ellas y quedaba apuntando a localhost.

> Credenciales de **WooCommerce, OAuth de Ads y la API key de IA** NO son variables de entorno
> en producción: se configuran desde el portal y se guardan **cifradas en la tabla `configuracion`**.

---

## 8. Modelo de datos (resumen)

Esquema completo y autoritativo: **`prisma/schema.prisma`**. Tablas principales (`@@map`):

- **Auth:** `usuarios`, `refresh_tokens`.
- **CRM/Ventas:** `clientes`, `tareas`, `cotizaciones` + `items_cotizacion`,
  `seguimientos_cotizacion`, `pedidos` + `items_pedido`, `instalaciones`,
  `servicios_instalacion`, `recargos_ciudad`.
- **Facturación:** `facturas` + `items_factura` + `pagos_factura`.
- **Compras:** `proveedores`, `proveedor_productos`, `ordenes_compra`.
- **Productos (PIM):** `productos` (campos WooCommerce + ACF + control interno) e imágenes
  (`imagenes`), `seo_propuestas` (cola de revisión del SEO generado por IA: nada de lo
  que escribe la IA llega a la tienda sin que una persona lo apruebe). Fichas técnicas ACF por categoría: `acf_mallas_metalicas`, `acf_balcones`,
  `acf_nylon`, `acf_plasticas`, `acf_seguridad_perimetral`.
- **Soporte:** `catalogos` (categorías, marcas, unidades…), `configuracion` (clave/valor, con
  `encrypted`), `errores_validacion`, `logs`, `notificaciones`, `woocommerce_sync`.
- **Nexus:** `nexus_conexiones`, `nexus_conversaciones`, `nexus_mensajes`, `plantillas_nexus`.
- **Soporte extra:** `reportes_error`.

Notas: IDs `cuid()`. Importes `Decimal(14,2)`. Un `producto` se mapea a WooCommerce por `wcId`.
La tabla **`configuracion`** es un almacén genérico clave/valor que guarda desde umbrales de
stock hasta secretos cifrados (WC, OAuth, IA, 2FA, SMTP). Prefijos de sus claves:
`empresa_*` · `wc_*` · `wp_*` · `ai_*` · `smtp_*` · `cot_*` (contenido de la cotización,
incluido `cot_pos_*`: dónde recorta cada imagen) · `nexus_*` (horario y compromiso) ·
`seg_*` (seguimiento) · `com_*` (política comercial) · `fact_*` (facturación y
plazos) · `post_*` (postventa) · `inst_*` (coordinador de obras) · `mkt_oauth_*`.

**Los consecutivos son atómicos** (`lib/consecutivos.ts`). Antes eran `count() + 1`,
que repetía número al borrar un registro y entregaba el mismo a dos usuarios
simultáneos. En facturación eso no es solo un error técnico: un consecutivo
repetido o con saltos es un problema ante la DIAN.

---

### Tablas nuevas (28/29-ago)

| Tabla | Para qué | Nota |
|-------|----------|------|
| `permisos_usuario` | Las EXCEPCIONES de permisos de cada persona | Solo excepciones, nunca el juego completo. Ver §5 |
| `visitas_tecnicas` | La visita previa a cotizar en firme | Una por cotización (índice único). El formulario va en JSON: son dos formatos muy distintos —cerca eléctrica y malla invisible— y una columna por casilla obligaría a migrar cada vez que producción pida una medida |
| `sgsst_personas` | Una fila por PERSONA del proceso SG-SST | `documentos` guarda el REGISTRO de lo entregado con `almacenado: false`: el archivo todavía no se guarda |

**Columnas nuevas que conviene conocer:**

- `cotizaciones.esPrueba` · `pedidos.esPrueba` — la marca se hereda. Filtrar con
  `SIN_PRUEBAS` de `lib/cotizaciones-prueba.ts`.
- `cotizaciones.prorrogaDias` / `prorrogas` — aplazar el vencimiento. Se guarda
  **aparte** de `validezDias` para que el documento siga diciendo la validez que
  se le ofreció al cliente.
- `cotizaciones.requiereVisita` / `requiereSgsst` — las dos casillas del cotizador.
- `clientes.ultimaInteraccionEn` / `estadoCalculadoEn` — el estado calculado.
- `productos.sinDescuento` — no admite rebaja por línea; sí entra en el global.

---

## 9. Puesta en marcha (local)

```bash
cd costamallas-erp
npm install                 # instalar dependencias (no se commitea node_modules)
cp .env.example .env.local  # y completar valores (ver §7)
npm run prisma:generate     # generar cliente Prisma
npm run prisma:push         # crear/actualizar tablas en Supabase
npm run seed                # datos iniciales
npm run dev                 # http://localhost:3000
```

**Credenciales iniciales (seed):** `admin@costamallas.com` / `CM2026admin#`
⚠️ Cambiar la contraseña tras el primer login.

**Deploy:** push a `main` en GitHub → Vercel construye y publica automáticamente. Asegurarse
de tener todas las variables de §7 en el dashboard de Vercel.

---

## 10. Cronología (contexto histórico)

El repo se construyó intensivamente entre el **2026-06-01 y el 2026-06-03**:
- **01-jun:** primer deploy, importar desde WooCommerce, módulo de imágenes FTP, CRM completo,
  formularios ACF dinámicos.
- **02-jun:** rediseño UI (dark mode, brand color, Soft UI), Nexus, reportes, fix URL pgbouncer.
- **03-jun:** rediseño v2, biblioteca de imágenes drag&drop, cotizador a medida, asistente IA,
  ficha técnica FTP, 2FA + dispositivos confiables, sync de pedidos WooCommerce, módulo
  Marketing (OAuth Ads, UTM, atribución), pipeline drag&drop, navegación móvil tipo app.

Después vinieron sesiones más espaciadas, cada una con un tema:
- **jul:** el agente **Sembli** (herramientas + jerarquía de acceso), rol `CLIENTE`.
- **1-ago:** correo SMTP desde el portal · órdenes de compra a proveedores ·
  cartera por antigüedad y recordatorios · **cotización 2.0** (cotizador único,
  dos plantillas, instalación con precio, enlace público, envío) · **pipeline**
  con valor y días en etapa · **instalaciones** con calendario y evidencia.
- **2-ago:** recepción de mercancía que suma stock · **embudo** con la tasa de
  cierre · filtros de trabajo del catálogo · ficha técnica y **Yoast SEO** que sí
  llegan a WooCommerce.
- **3-ago:** **Nexus** de verdad — salida por WhatsApp Cloud API, reparto por
  turno, bot que califica, plantillas y flujos reales.
- **5-ago:** **seguimiento post-cotización** (3 toques) · **tope de descuento y
  anticipo** con aprobación · **fecha de vencimiento** de facturas + corrección en
  lote · **postventa** (políticas públicas y QR de encuesta) · **aviso al
  coordinador** y **acta de entrega** de instalación · **tiempo de respuesta de
  Nexus** (el compromiso de la hora, en horario hábil) · el plan de fases por fin
  escrito en `PLAN-FASES.md`.

- **26-ago:** lista de precios de agosto (176 productos y 17 servicios) ·
  WordPress conectado de verdad · la cotización con marca y fotos reales ·
  **posición del recorte de las imágenes configurable** (estaba quemada en el
  código) · **generador de SEO masivo con cola de revisión** · **alerta de
  incumplimiento del tiempo de respuesta** · el aviso al coordinador y el acta de
  entrega **probados por primera vez**, con un bug de notificaciones duplicadas
  encontrado y corregido · las últimas 2 imágenes rotas rescatadas del FTP a
  WordPress.

- **27-ago:** los enlaces de cotización que daban 404 (estaban todas en BORRADOR) ·
  **"Compartir enlace"**, que es lo que por fin permite marcar una oferta como
  ENVIADA sin SMTP y desbloquea el seguimiento · el costo de cada tarea de IA
  flotando al lado de su botón, con el valor REAL de los registros · SEO con IA
  restringido a SUPERADMIN · **agente de atención al cliente para
  costamallas.com**.

- **28/29-ago:** la sesión más larga del proyecto. **Permisos por submódulo y
  por usuario** (tabla `permisos_usuario`, pantalla de administración, tres
  capas de aplicación) · el **ERP visto por quien vende**: ficha comercial en
  lugar del formulario, filtro técnico en imágenes, copiar la ficha y mandarla
  a un chat · **el estado del cliente pasa a calcularse** en vez de escribirse
  · **alta de cliente y de empresa separadas** · borrado de COT-00001…09 con
  respaldo · **cotizaciones de prueba**, **aplazar vencidas**, **visita
  técnica y SG-SST** con su bandeja de producción · **tablero comercial** con
  las siete etapas · **disparador cada 15 min** por GitHub Actions ·
  **plantillas de correo editables con vista previa** · icono nuevo y **mini
  registro** en el chat de la web.

Último commit de referencia de este documento: **`c566d9c`**.

---

## 10.1 Lo que está construido pero NO funciona todavía (y por qué)

Esto es lo que más se malinterpreta al leer el código: hay módulos completos
esperando un dato que no depende del código. **Ninguno simula funcionar**: todos
lo dicen en pantalla con el motivo.

> ⚠️ **El SMTP ya está cargado** (28-ago 21:40). Era el bloqueador
> número uno de este proyecto: media docena de módulos llevaban semanas
> escritos y sin ejecutarse porque no había por dónde mandar un correo.
> Ahora **salen de verdad**, y eso cambia cómo se prueban las cosas:
> correr scripts/probar-alerta-tiempos.ts manda correos reales a los
> administradores. El script lo avisa antes de empezar.

| Módulo | Qué falta | Qué pasa mientras tanto |
|--------|-----------|--------------------------|
| WhatsApp / Nexus | Aprobación de Meta | El texto se arma y se guarda; el envío se registra como fallido con el motivo real |
| Recargo de instalación por ciudad | Que gerencia los cargue | Los 17 servicios ya están; sin recargo, la cuadrilla a Santa Marta cuesta lo mismo que instalar al lado |
| Alerta de tiempo de respuesta | Nada — funciona | Pero avisa en la corrida DIARIA, no al minuto 61: Hobby no deja más de un cron al día |
| SEO masivo | Nada — funciona | Genera a la cola de revisión; falta que alguien lance el primer lote y apruebe. **Solo SUPERADMIN** |
| Agente web | Nada — funciona, probado contra producción | Nace APAGADO. Falta encenderlo, cargarle el WhatsApp de escalamiento y pegar el `<script>` en WordPress |
| QR de encuesta | El enlace de reseñas de Google | No se genera ningún QR (uno impreso que no funciona no se puede corregir) |
| Facturación electrónica | Elegir proveedor (Factus/Siigo/Alegra) | Modo "manual": la factura se emite sin ir a la DIAN |
| Marketplaces | Cuentas de vendedor | Pestañas de configuración vacías |
| Documentos de SG-SST | Almacenamiento privado (llega con el VPS) | Se registra QUÉ documento entregó cada persona y cuándo; **el archivo NO se guarda** y la pantalla lo dice. Ver `lib/almacenamiento-documentos.ts` |
| Botón del catálogo en los correos | Subir el PDF y pegar su dirección | El botón sencillamente no sale. Un enlace roto en un correo es peor que un botón que falta |
| Disparador cada 15 min | El secreto `CRON_SECRET` en GitHub | El workflow existe y falla en rojo. La corrida diaria de Vercel sigue funcionando |
| Nexus móvil (Fase 7) | Visto bueno de los mockups | Nada programado todavía; los mockups están hechos |
| Plazos de pago reales | Confirmación de gerencia | Contado 0 / crédito 30 como valor de arranque |

Detalle y preguntas concretas en **`PENDIENTES-GERENCIA.md`**.

---

## 10.2 Estado real de los datos

### Al 29 de agosto (lo que cambió)

| Qué | Antes (26-ago) | Ahora | Por qué |
|-----|----------------|-------|---------|
| Cotizaciones | 20 | **11** (1 aprobada, 10 borradores) | Se borraron las nueve de la numeración vieja, con respaldo en `docs/` |
| Pedidos | 19 | **21** | Dos nuevos; los 3 que venían de las COT borradas siguen ahí, anotados con su origen |
| Clientes por estado | 19 activos / 9 interesados / 2 recurrentes / 1 prospecto, **escritos a mano** | **12 activos / 8 interesados / 11 prospectos**, calculados | 12 de 31 fichas estaban desfasadas. Ver `lib/estados-cliente.ts` |
| Estados en uso | `CLIENTE_ACTIVO`, `INTERESADO`, `RECURRENTE`, `PROSPECTO` | `CLIENTE_ACTIVO`, `INTERESADO`, `PROSPECTO` | `RECURRENTE`, `CALIFICADO` y `NO_CALIFICADO` se retiraron |
| Conversaciones de Nexus | 0 | **5** | El agente de la web ya está atendiendo |
| Productos sin ninguna foto | 113 | **113** | Sigue igual: es la lista de precios de agosto. **Es la causa real de que falten miniaturas en las cotizaciones** |
| Excepciones de permisos | — | **0** | La tabla existe y está vacía: todo el mundo tiene lo que trae su rol |
| Visitas técnicas / SG-SST | — | **0 / 0** | Las tablas existen; nadie ha marcado todavía una cotización con visita |

**Usuarios activos (7):** 1 superadmin, 1 admin, 2 vendedores, 1 producción,
2 solo lectura.

### Al 26 de agosto (el detalle largo)

Medido contra la base de producción. Importa porque el código puede estar bien y
aun así no verse funcionar: media docena de módulos de este repo llevan semanas
sin ejecutarse nunca, no porque fallen, sino porque no hay sobre qué actuar.

**Catálogo**

- **176 productos** (172 activos, 60 publicados en la tienda, 4 archivados).
- **171 activos sin SEO**. Uno solo lo tiene. Desde el 26-ago hay generador masivo
  con cola de revisión en `/productos/seo`: genera en lote, deja la propuesta en
  `SeoPropuesta` y **una persona aprueba producto por producto**, porque aprobar
  guarda el producto y guardar un producto publicado lo sincroniza con
  costamallas.com. Costo estimado del catálogo completo: **US$ 2,05** con Sonnet 5
  (~US$ 0,012 por producto). **Todavía no se ha lanzado ningún lote.**
- **172 activos sin ficha técnica PDF.** Ninguno la tiene.
- **113 activos sin ninguna imagen**: son los productos nuevos de la lista de
  precios de agosto. Por eso no están publicados.
- **173 imágenes, 0 rotas** (`scripts/revisar-fotos.ts`, 26-ago). Las 2 que
  apuntaban a `catalogo.costamallas.com` —las del `103-2KIT-GVENT-MASCOTAS`, con
  la principal caída en un producto publicado— se rescataron del disco FTP y se
  subieron a la biblioteca de WordPress con
  `POST /api/mantenimiento/imagenes-ftp`. Bajaron con su tamaño exacto (509 KB y
  523 KB), abren con 200, y el producto volvió a sincronizar. **Ya no queda
  ninguna imagen apuntando a ese subdominio.**

**Comercial**

- **10 cotizaciones**: 1 aprobada, 9 borradores. **Ninguna en estado ENVIADA**, así
  que el seguimiento post-cotización no tiene sobre qué actuar: el reloj arranca
  cuando se envía una oferta *desde el portal*, y sin SMTP no se puede enviar.
- **Consecutivo en 12065.** La última es `COT-12065` (borrador del 26-ago, $10.442.250).
  Hay un hueco entre `COT-00009` y `COT-12065` porque se retomó la numeración de
  SIIGO. La próxima será `COT-12066`. **Un número consumido por una cotización que
  no se guardó es el comportamiento correcto**: un hueco es más seguro que un
  número repetido. No hay nada que arreglar ahí.
- **19 pedidos**: 10 entregados, 7 cancelados, 1 listo, 1 confirmado.
- **1 factura**, anulada y sin fecha de vencimiento.
- **22 clientes.**
- **17 servicios de instalación** cargados y activos, **0 recargos por ciudad**. Sin
  recargos, instalar en Barranquilla cuesta lo mismo que mandar la cuadrilla a
  Santa Marta.

**Operación**

- **0 instalaciones** y 0 pedidos con instalación. El aviso al coordinador y el
  acta de entrega llevaban desde el 5 de agosto sin ejecutarse **ni una vez**. Se
  probaron el 26-ago con `scripts/probar-instalaciones.ts`, que fabrica el caso
  completo contra la base real y lo borra al terminar: 44 comprobaciones, todas
  pasan. La prueba destapó un bug real (notificación duplicada en cada
  reaprobación mientras no haya SMTP), corregido con un segundo sello,
  `avisoPortalEn`.
- **0 conversaciones de Nexus y 0 conexiones configuradas.** El informe de tiempos
  de respuesta y su alerta funcionan, pero no tienen nada que medir hasta que
  Meta apruebe WhatsApp o entre un formulario web. La alerta se verificó
  fabricando conversaciones con `scripts/probar-alerta-tiempos.ts`: 20
  comprobaciones, todas pasan.
- **7 usuarios activos**: 1 SUPERADMIN, 3 ADMIN, 2 VENDEDOR, 1 PRODUCCION. Ya hay
  vendedores de verdad (Elkin Fernández, Bleidis Barrios), así que el reparto por
  asesor y el aviso del toque 2 ya no le llegan al mismo administrador que no
  llamó — que era el problema del 5 de agosto.
- **El módulo de marketing mide a mano.** `leads`, `conversiones` e `ingresos` de
  cada campaña se teclean en un JSON dentro de `configuracion`. La inversión
  seguirá siendo manual (viene de la plataforma de anuncios), pero la plata
  cerrada ya se calcula sola en `/marketing/retorno`.

---

## 11. Notas operativas / convenciones para la IA

- **Fuente de verdad del dominio:** `prisma/schema.prisma`. Antes de tocar datos, léelo.
- **No subir secretos:** `.env*` está en `.gitignore`. Nunca commitear claves ni volcarlas
  en documentos. Para credenciales en runtime, usar la tabla `configuracion` (cifrada).
- **Integraciones que NO funcionan sin servicio externo:** la app **requiere** Supabase
  (Postgres) para arrancar; WooCommerce/FTP/IA/Ads degradan o fallan según corresponda si no
  hay credenciales, pero la mayoría de pantallas internas funcionan con la BD sola.
- **Carpeta de trabajo local:** este proyecto vive en
  `…\AUTOMATIZACIONES\Costamallas\Files\costamallas-erp` (varios elementos son enlaces
  simbólicos en OneDrive). El repo Git real es `github.com/jortiz0610/costamallas` (rama `main`).
- **Actualizar = `git pull`**, no reemplazar la carpeta a mano: borra `.env`, `node_modules`
  y `.next`. Tras un `pull` que cambie `package.json` o el schema, correr `npm install` y
  `npm run prisma:generate`.
- **`npm install` local NO es obligatorio:** el backend corre en **Vercel**, que instala las
  dependencias él mismo en cada deploy. Solo se hace `npm install` en el PC si se quiere probar
  en `localhost` (`npm run dev`) o tocar la BD desde local (`prisma:*`, `seed`).
- **Commits y push: solo los necesarios.** No commitear ni hacer push por cada cambio pequeño;
  agrupar en un commit con sentido y empujar **solo cuando el cambio deba publicarse**, porque
  **cada push a `main` dispara un deploy en Vercel**. Nada de commits de ruido ("trigger deploy",
  "wip", etc.). Si el cambio no necesita publicarse aún, dejarlo sin commitear.
- **Idioma:** mantener nombres de modelos, campos, rutas y UI en español (consistencia).
- **No inventar datos comerciales.** Precios, plazos, garantías y políticas salen de
  la cotización real de SIIGO y de los documentos en
  `Files/Archivos base de empresa/`. Si un dato no existe, se deja el hueco y se
  anota en `PENDIENTES-GERENCIA.md`: un plazo inventado en una política publicada es
  peor que un campo vacío.
- **Marcar lo no verificado.** En los commits se dice explícitamente qué se probó y
  qué no ("verificado con tsc y build; no probado con sesión iniciada").

---

## 12. Cómo se trabaja en este repo (aprendido a los golpes)

Cosas que ya costaron tiempo. No las redescubras.

### Migraciones

```bash
npx tsx scripts/aplicar-migracion.ts prisma/migrations/<carpeta>/migration.sql
```

- `prisma db execute` **se queda colgado** contra el pooler de Supabase.
- Un script suelto de Prisma carga `.env` (host directo, **solo IPv6**, que desde
  muchas redes no responde) en vez de `.env.local` (el pooler, que es lo que usa la
  app). `aplicar-migracion.ts` fuerza el valor correcto; los scripts de `scripts/`
  hacen lo mismo al arrancar.
- El SQL debe ser **idempotente** (`IF NOT EXISTS`) y **aditivo**. Nunca DDL
  destructivo: esto se aplica sobre la base de producción, que es la única que hay.
- Después: actualizar `prisma/schema.prisma` a mano y `npx prisma generate`.

### Responsive: nada de cajas que se deslizan a lo ancho

Regla del portal, decidida el 29-ago: **si no cabe, se apila**. Un
`overflow-x-auto` PARECE responsive y no lo es — hay que arrastrar para ver
la columna del precio, se pierde de vista de qué fila era, y en la práctica
nadie lo hace: se abre el escritorio o no se mira.

Cómo se hace aquí:

- **Tablas:** usa `<div className="table-wrapper"><table className="table">`.
  Por debajo de 768 px cada fila se convierte sola en una FICHA. Ponle
  `data-label="Precio"` a cada `<td>` que necesite rótulo; la celda del
  nombre y la de los botones se dejan SIN `data-label` a propósito (ocupan
  la línea entera). La regla vive en `globals.css`.
- **Rejillas:** nunca `grid-cols-3` a secas. Siempre con punto de corte:
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- **Maestro-detalle** (inbox de Nexus, biblioteca de imágenes): en móvil se
  ve UNA de las dos columnas, con botón de volver. Ver
  `(dashboard)/nexus/page.tsx` como referencia.
- **Excepciones legítimas:** los documentos que se imprimen
  (`CotizacionDoc`, `FacturaPDF`, el acta) son hojas A4 de ancho fijo, y los
  calendarios tienen siete días. Ésos NO se tocan.

Se comprueba con el navegador a 360 px: `document.documentElement.scrollWidth`
tiene que ser igual a `window.innerWidth`.

### En el teléfono se entra por Nexus

Para **todos** los roles, no solo vendedores (`ModuloDeArranque` en el layout
del portal). Solo la primera vez: en cuanto alguien cambia de módulo su
elección se guarda en `localStorage` y el arranque no vuelve a opinar. En
escritorio no se fuerza nada.

### Build

**Borra `.next` antes de cada `npm run build`.** OneDrive corrompe la carpeta y el
build falla con `EINVAL readlink`. No es el código. Si `Remove-Item` se queja de que
un archivo está en uso, insiste o cierra lo que tenga abierto el directorio.

### `src/components/layout/Sidebar.tsx` — ya está arreglado

**Tenía** finales de línea mezclados —CRLF, LF suelto y hasta `\r\r\n`— y por eso
un cambio de dos líneas producía un diff de 600. Se normalizó a CRLF el 28-ago en
un commit aparte (`b8a7d65`), que no toca ni un carácter de código.

Ya se puede editar con normalidad. Lo que sigue valiendo: **comprueba siempre con
`git diff --stat`**. Si un cambio pequeño produce un diff enorme, el problema son
los saltos de línea y hay que mirarlo antes de commitear, no después.

### Cada llamada a Bash es un shell nuevo

Las variables no sobreviven entre llamadas. Si calculas un número de línea con
`grep` y lo usas en un `sed -i` de la llamada siguiente, llega **vacío** y `sed`
destroza el archivo. Calcula y usa en el mismo comando.

Para reemplazos de varias líneas, un script corto de Node con
`readFileSync` + `replace` de una cadena exacta es más seguro que `sed`: si la
cadena no está, falla en vez de escribir cualquier cosa. Y **hay que respetar
los finales de línea**: la mayoría de archivos son CRLF, así que insertar una
línea con `
` a secas ensucia el diff. Comprobar siempre con
`git diff --stat`.

### El widget del chat emite JavaScript desde un template literal

`api/public/agente/widget.js/route.ts` devuelve JavaScript construido con una
plantilla de TypeScript. Ahí **las barras invertidas van dobles**: una `\s`
sola se pierde al evaluar la plantilla y llega al navegador como la letra `s`.
Pasó de verdad con el validador de correo del registro, que rechazaba cualquier
dirección que llevara una ese.

`scripts/probar-widget-agente.ts` comprueba el JavaScript **emitido**, no el
código fuente: evalúa la expresión regular tal como le llega al navegador y
verifica que el archivo entero compile. Es lo único que sirve para esto.

### Los heredocs de Bash se comen las barras invertidas

En este entorno, un `cat > archivo <<'EOF'` **no** conserva `\\` aunque el
delimitador esté entre comillas, y un `node -e "…"` con una clase de caracteres
revienta con «Unterminated regexp». Para parchear archivos: escribir el script
de Node **a un archivo** con la herramienta de edición y ejecutarlo. Para
cambios de una línea, la herramienta de edición directamente.

### Probar

- **No pruebes con sesión iniciada.** Entrar al portal escribe en la BD de
  producción (último acceso, logs, aperturas de cotización).
- Lo que sí se puede: `npx tsc --noEmit`, `npm run build`, la ruta pública
  `/cotizacion/demo`, `/politicas`, y los scripts de `scripts/`.
- Verificar el deploy: `api.vercel.com/v6/deployments` con `VERCEL_TOKEN`, y
  comprobar que el commit quedó en estado `READY`.

**Scripts de verificación** (los tres últimos escriben en producción y limpian
al terminar, incluso si algo falla; lo que crean lleva el prefijo `VERIF-`):

| Script | Qué comprueba |
|--------|----------------|
| `revisar-fotos.ts` | Solo lectura. Qué imágenes del catálogo no abren |
| `revisar-seguimiento.ts` | Solo lectura. Estado de los tres toques |
| `verificar-comercial.ts` · `verificar-sembli.ts` | Solo lectura |
| `probar-tiempos.ts` | Lógica pura del reloj hábil, sin base de datos |
| `probar-seo-cola.ts` | La estimación de costo y que aprobar escribe lo aprobado |
| `probar-alerta-tiempos.ts` | Fabrica conversaciones vencidas y comprueba el aviso |
| `probar-instalaciones.ts` | Fabrica una venta con instalación: aviso y acta |
| `probar-permisos.ts` | 92 comprobaciones del sistema de permisos. Crea y borra su usuario VERIF- |
| `probar-ficha-vendedor.ts` | La ficha comercial y el candado del stock |
| `probar-estados-cliente.ts` | Los estados automáticos. Con `--aplicar` los escribe |
| `probar-cotizacion-fase4.ts` | Miniaturas, prórroga, cotizaciones de prueba |
| `probar-trabajos.ts` | Visita técnica y SG-SST. Vigila que nadie active un almacén sin querer |
| `probar-pipeline.ts` | En qué columna cae cada oferta. Lógica pura + datos reales |
| `probar-correos.ts` | Las plantillas. Compara el texto de gerencia frase por frase |
| `probar-widget-agente.ts` | El JavaScript **emitido** del chat de la web |
| `respaldar-y-borrar-cot-viejas.ts` | Exporta a `docs/` y borra. Con `--borrar` |

### Ejecutar algo EN PRODUCCIÓN sin iniciar sesión

El `CRON_SECRET` de `.env.local` es **el mismo** que el de Vercel (comprobado el
26-ago). Con él se puede disparar contra `portal.costamallas.com` cualquier ruta
que use el patrón de autorización de `/api/cron/diario`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://portal.costamallas.com/api/cron/diario?dry=1"
```

Esto es lo que permite verificar en producción sin entrar al portal, y es la
**única** forma de correr lo que necesita descifrar un secreto de
`configuracion` (WordPress, WooCommerce, la API key de Claude): esas claves
están cifradas con la `ENCRYPTION_KEY` de producción, que **no** es la de local.

⚠️ Una ruta así tiene que estar en `PUBLIC_PATHS` del middleware o no llega
siquiera a ejecutarse: el middleware corta antes con "No autenticado". Estar en
esa lista **no la hace pública** — la ruta se autoriza sola.

---

## 13. Nexus: lo que hay que saber antes de tocarlo

### El canal es una cadena, y en la base hay de todo

Conviven `WEB` (el agente de la página), `wordpress_form` y las
minúsculas del mapa viejo (`whatsapp`, `email`). **Siempre** pasar por
`normalizarCanal()` de `lib/nexus-preferencias.ts` antes de comparar o de
buscar un color: comparar sin normalizar hacía que el color que la
persona configuró no se aplicara nunca.

Ahí también se decide que **el formulario de WordPress se atiende como
correo**: los dos se contestan por escrito y sin nadie esperando al otro
lado. El chat en vivo de la web (`WEB`) NO se une a correo, justamente
porque ahí sí hay alguien delante de la pantalla.

Al filtrar por canal en el servidor hay que buscar por TODAS las formas
de ese canal (ver `/api/nexus/conversaciones`), no por la cadena tal cual.

### Las preferencias del inbox viven en el navegador

Colores, etiquetas, sonido y tema están en `localStorage`
(`lib/nexus-preferencias.ts`). Son gustos de quien atiende, no datos de
la empresa: guardarlos en el servidor costaría una consulta más en cada
carga del inbox para algo que a nadie más le importa.

### La IA del chat tiene dos candados

1. El permiso `nexus.ia`, que el administrador enciende o apaga persona
   por persona desde Usuarios y Roles.
2. Un **cupo diario por persona** (`lib/nexus/cupo-ia.ts`), comprobado
   ANTES de llamar al modelo. El contador vive en `configuracion` con una
   clave por persona y día, así que se recicla solo. El uso se apunta
   DESPUÉS de una respuesta buena: cobrar un intento que falló por un
   error nuestro es la forma de que la gente deje de usar la herramienta.

Un tope de 0 apaga el asistente para todos sin tocar permisos.

### Los adjuntos van a la biblioteca de WordPress

`/api/nexus/adjunto`. Tiene que ser una URL **pública**: la API de
WhatsApp no recibe el archivo, recibe un enlace y lo descarga ella.

⚠️ Por eso mismo ese endpoint **no sirve** para los documentos de SG-SST:
cédulas y planillas son datos personales y no pueden quedar en una URL
adivinable. Esos siguen en `lib/almacenamiento-documentos.ts`, esperando
el disco privado del VPS.

Si WordPress rechaza un tipo de archivo —pasa con los audios `webm` en
instalaciones por defecto— se devuelve el error real del servidor, no un
"no se pudo subir" que no le dice a nadie qué hay que habilitar.

### Comandos

`/` abre el menú **solo si la barra abre el mensaje**: un `/` en mitad de
una frase ("2/4 de pulgada") no debe abrirlo, y aquí eso se escribe todo
el día. Un comando NUNCA se manda como mensaje — mandarle "/cliente" a un
cliente por WhatsApp no se puede deshacer.

`@mallita` redacta, no envía: la IA propone y la persona decide.
