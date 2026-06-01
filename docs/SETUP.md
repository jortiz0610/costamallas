# Costamallas ERP — Guía de instalación

## Requisitos previos

- Node.js 20+ y npm
- Cuenta en [Supabase](https://supabase.com) (gratis) para la base de datos PostgreSQL
- Cuenta en [Vercel](https://vercel.com) (gratis) para el despliegue

---

## Paso 1 — Clonar y instalar

```bash
cd costamallas-erp
npm install
```

---

## Paso 2 — Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project
2. Nombre: `costamallas-erp`
3. Copia la **Connection String** (modo "Transaction Pooler") y el **Direct URL**

---

## Paso 3 — Configurar variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
cp .env.example .env.local
```

**Generar secretos seguros:**

```bash
# JWT Secret (64+ caracteres)
openssl rand -base64 64

# Encryption Key (32 bytes = 64 hex chars)
openssl rand -hex 32
```

Completa en `.env.local`:
```
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="tu_secreto_aqui"
ENCRYPTION_KEY="tu_clave_hex_aqui"
```

---

## Paso 4 — Crear la base de datos

```bash
# Generar cliente Prisma
npm run prisma:generate

# Crear tablas en la base de datos
npm run prisma:push

# Cargar datos iniciales
npm run seed
```

---

## Paso 5 — Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

**Credenciales iniciales:**
- Email: `admin@costamallas.com`
- Contraseña: `CM2026admin#`

⚠️ **Cambia la contraseña inmediatamente después del primer login.**

---

## Paso 6 — Conectar WooCommerce

1. En WordPress: **WooCommerce → Configuración → Avanzado → REST API**
2. Crear clave con permisos de **Lectura/Escritura**
3. En el portal: **Configuración → Credenciales WooCommerce**
4. Pegar la URL de la tienda, Consumer Key y Consumer Secret
5. Hacer clic en **"Guardar y conectar"**

---

## Paso 7 — Despliegue en Vercel

```bash
npm install -g vercel
vercel
```

Agrega las mismas variables de entorno en el dashboard de Vercel.

---

## Estructura del proyecto

```
costamallas-erp/
├── prisma/
│   └── schema.prisma          # Esquema de base de datos
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Página de login
│   │   ├── (dashboard)/       # Portal principal
│   │   └── api/               # API routes (backend)
│   ├── components/
│   │   ├── layout/            # Sidebar, Topbar, Notificaciones
│   │   └── dashboard/         # Componentes del dashboard
│   ├── lib/
│   │   ├── auth.ts            # JWT + cookies httpOnly
│   │   ├── encryption.ts      # AES-256-GCM
│   │   ├── prisma.ts          # Cliente de base de datos
│   │   ├── woocommerce.ts     # Integración WC REST API v3
│   │   ├── rate-limit.ts      # Limitación de requests
│   │   └── validations/       # Esquemas Zod
│   ├── hooks/                 # useAuth, useNotificaciones
│   ├── store/                 # Estado global (Zustand)
│   ├── types/                 # TypeScript types
│   └── middleware.ts          # Protección de rutas + rate limit
├── scripts/
│   └── seed.ts               # Datos iniciales
└── docs/
    └── SETUP.md              # Esta guía
```

---

## Seguridad implementada

| Medida | Implementación |
|--------|---------------|
| Autenticación | JWT con httpOnly cookies (no accesible desde JS) |
| Contraseñas | bcrypt con cost factor 12 |
| Datos sensibles | AES-256-GCM (API keys de WooCommerce) |
| Rate limiting | 100 req/min por IP, 10 intentos de login/min |
| Headers HTTP | X-Frame-Options, CSP, X-Content-Type-Options |
| Validación | Zod en todos los endpoints de entrada |
| RBAC | Roles: Admin, Usuario, Solo Lectura |
| Auditoría | Log de todas las acciones críticas |
| Refresh tokens | Revocables en BD |

---

## Agregar más usuarios

Desde Prisma Studio o ejecutando:

```ts
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

await prisma.usuario.create({
  data: {
    nombre: "Nuevo Usuario",
    email: "usuario@costamallas.com",
    password: await bcrypt.hash("contraseña_segura", 12),
    rol: "USUARIO",
  },
});
```

---

## Soporte

Para dudas o extensiones del portal, contacta al equipo de desarrollo.
