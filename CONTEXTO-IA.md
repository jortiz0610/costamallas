# 🧠 CONTEXTO DEL PROYECTO — Costamallas ERP

> **Propósito de este documento:** dar a cualquier IA (o desarrollador nuevo) todo el
> contexto necesario para entender el proyecto **sin tener que adivinar nada**: qué es,
> cómo está construido, dónde está alojado y cómo se conecta con los servicios externos
> (Vercel, Supabase, WooCommerce, FTP, IA, plataformas de Ads).
>
> **Última actualización:** 2026-06-03 · Commit de referencia: `a351c45`
> _Mantén este archivo actualizado cuando cambie la arquitectura o las integraciones._

---

## 1. Qué es el proyecto

**Costamallas ERP** es un portal interno (ERP + CRM + PIM) para la empresa **Costamallas**
(fabricante/distribuidor de mallas metálicas, nylon, plásticas, para balcones y seguridad
perimetral, en Colombia).

Centraliza:
- **Productos (PIM):** catálogo con campos técnicos (ACF) específicos por categoría.
- **CRM:** clientes, cotizaciones, pedidos, instalaciones, tareas, pipeline de ventas.
- **Compras/ERP:** proveedores y órdenes de compra, control de stock.
- **Imágenes:** biblioteca con subida por **FTP** al hosting del catálogo.
- **Sincronización con la tienda WooCommerce** (costamallas.com): exportar productos e
  importar pedidos.
- **Marketing:** conexiones OAuth con Google/Meta/TikTok Ads, campañas, atribución UTM, leads.
- **Nexus:** hub omnicanal (conversaciones, plantillas, conexiones, webhooks).
- **Asistente de IA** flotante (OpenAI o Anthropic, configurable).
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
- Para aplicar el esquema: `npm run prisma:push` (o `prisma:migrate`). Migraciones en
  `prisma/migrations/`.

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

### 3.5 IA generativa (OpenAI o Anthropic)
- Asistente IA en `src/lib/ai.ts`. Soporta **OpenAI** (`gpt-4o-mini` por defecto) o
  **Anthropic** (`claude-3-5-haiku-latest` por defecto).
- La API key y el proveedor se guardan **cifrados en `configuracion`** (`ai_provider`,
  `ai_api_key`, `ai_model`). **Si no hay key configurada, el asistente degrada a "modo reglas"**
  (sin IA generativa) — no rompe.
- Rutas: `/api/ai/chat`, `/api/ai/config`.

### 3.6 Marketing — OAuth de Ads (Google / Meta / TikTok)
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
│   └── migrations/              # Migraciones SQL
├── scripts/
│   └── seed.ts                  # Datos iniciales (admin, catálogos, config, productos demo)
├── docs/
│   └── SETUP.md                 # Guía de instalación paso a paso
├── src/
│   ├── middleware.ts            # ⭐ Auth + rate limit en TODAS las rutas (ver §5)
│   ├── app/
│   │   ├── (auth)/login/        # Página de login (pública)
│   │   ├── (dashboard)/         # Portal protegido (todas las páginas internas)
│   │   ├── cotizar/             # Cotizador web PÚBLICO (captura leads)
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
│   │   ├── ai.ts                # OpenAI / Anthropic
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
  - Rutas públicas: `/login`, `/api/auth/login`, `/cotizar`, `/api/public`, `/api/marketing/oauth`.
  - API sin auth → `401`; página sin auth → redirect a `/login`.
- **Roles (`enum Rol`):** `SUPERADMIN, ADMIN, USUARIO, VENDEDOR, PRODUCCION, BODEGA, SOLO_LECTURA`.
  `canWrite()` = cualquiera excepto `SOLO_LECTURA`.
- **Cifrado:** datos sensibles (credenciales WC, tokens OAuth, API key de IA, secreto 2FA) se
  cifran con **AES-256-GCM** (`ENCRYPTION_KEY`, 32 bytes hex). Formato `iv:authTag:ciphertext`.
- **Cabeceras HTTP de seguridad** definidas en `next.config.ts` (CSP, HSTS, X-Frame-Options…).
- **Auditoría:** acciones críticas se registran en la tabla `logs`.

---

## 6. Módulos y rutas API

Páginas (bajo `(dashboard)` salvo indicación): inicio, `categorias`, `compras`,
`configuracion`, `crm` (+ `clientes`, `cotizaciones`, `cotizador`, `pedidos`, `instalaciones`,
`pipeline`, `tareas`), `errores`, `exportar`, `imagenes`, `importar`, `marketing`
(+ `atribucion`, `campanas`, `reportes`), `nexus` (+ `flujos`, `plantillas`), `productos`
(+ `nuevo`, `[id]`), `reportes`, `sistema/seguridad`, `stock`, `usuarios`.
Públicas: `(auth)/login` y `cotizar`.

Endpoints API (`src/app/api/`):
`ai/{chat,config}` · `auth/{login,logout,me}` · `catalogos` · `compras/proveedores` ·
`configuracion/empresa` · `crm/{clientes,cotizaciones,instalaciones,pedidos,tareas}` (+ `[id]`) ·
`dashboard/kpis` · `exportar/woocommerce` · `health` · `imagenes` (+ `upload`) · `logs` ·
`marketing/{campanas,conexiones,leads,oauth/[plataforma],oauth/callback}` ·
`nexus/{conexiones,conversaciones,mensajes,plantillas,webhook/[canal]}` · `notificaciones` ·
`productos` (+ `[id]`, `[id]/ficha`) · `public/{lead,productos}` · `sistema/health` ·
`stock/alertas` · `usuarios` (+ `[id]`, `[id]/2fa`) ·
`woocommerce/{import,import-orders,test}`.

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

> Credenciales de **WooCommerce, OAuth de Ads y la API key de IA** NO son variables de entorno
> en producción: se configuran desde el portal y se guardan **cifradas en la tabla `configuracion`**.

---

## 8. Modelo de datos (resumen)

Esquema completo y autoritativo: **`prisma/schema.prisma`**. Tablas principales (`@@map`):

- **Auth:** `usuarios`, `refresh_tokens`.
- **CRM/Ventas:** `clientes`, `tareas`, `cotizaciones` + `items_cotizacion`, `pedidos` +
  `items_pedido`, `instalaciones`.
- **Compras:** `proveedores`, `ordenes_compra`.
- **Productos (PIM):** `productos` (campos WooCommerce + ACF + control interno) e imágenes
  (`imagenes`). Fichas técnicas ACF por categoría: `acf_mallas_metalicas`, `acf_balcones`,
  `acf_nylon`, `acf_plasticas`, `acf_seguridad_perimetral`.
- **Soporte:** `catalogos` (categorías, marcas, unidades…), `configuracion` (clave/valor, con
  `encrypted`), `errores_validacion`, `logs`, `notificaciones`, `woocommerce_sync`.
- **Nexus:** `nexus_conexiones`, `nexus_conversaciones`, `nexus_mensajes`, `plantillas_nexus`.

Notas: IDs `cuid()`. Importes `Decimal(14,2)`. Un `producto` se mapea a WooCommerce por `wcId`.
La tabla **`configuracion`** es un almacén genérico clave/valor que guarda desde umbrales de
stock hasta secretos cifrados (WC, OAuth, IA, 2FA).

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

Último commit de referencia de este documento: **`a351c45`**.

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
```
