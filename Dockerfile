# ============================================================
# La imagen del portal.
#
# Multietapa a propósito, y esa es toda la idea de la migración: se
# compila en unas capas que se TIRAN, y la imagen final se lleva solo el
# resultado. En el servidor del cliente no queda un solo archivo .ts, ni
# el repositorio, ni `node_modules` completo.
#
# Sé honesto sobre el alcance: quien tiene root en esa máquina puede
# abrir la imagen y leer el JavaScript compilado. Lo que esto consigue
# es que reconstruir el proyecto cueste más que rehacerlo — no que sea
# imposible. Lo que de verdad protege es el contrato (ver MIGRACION-VPS.md).
#
#   docker build -t portal:local .
#
# En la práctica no se construye a mano: lo hace GitHub Actions
# (.github/workflows/imagen.yml) y publica en GHCR.
# ============================================================

# Node 22 LTS y no 24: es la versión con la que Prisma 5 tiene motores
# probados. Alpine para que la imagen no pese 1 GB.
ARG NODE=22-alpine

# ── 1. Dependencias ──
# En su propia etapa para que cambiar una línea de código NO obligue a
# reinstalar todo: mientras package-lock.json no cambie, esta capa se
# reutiliza.
FROM node:${NODE} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
# El esquema tiene que estar antes del `npm ci`: el postinstall de
# Prisma lo busca.
COPY prisma ./prisma
RUN npm ci

# ── 2. Compilar ──
# Esta etapa es la que se tira. Aquí está el código fuente.
FROM node:${NODE} AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `npm run build` = prisma generate && next build.
#
# ⚠️ La compilación NO se conecta a la base: si algún día una página se
# vuelve estática y consulta datos al compilar, aquí es donde va a
# fallar. Se resuelve con `export const dynamic = "force-dynamic"` en esa
# página, NO metiendo la DATABASE_URL en la construcción — quedaría
# escrita en una capa de la imagen.
RUN npm run build

# ── 3. Lo que corre ──
FROM node:${NODE} AS runner

# Chromium, para fabricar el PDF de las cotizaciones.
#
# Es lo único que engorda la imagen de verdad (~530 MB → ~700 MB), y se
# acepta a cambio de algo concreto: el cliente recibe el enlace por
# WhatsApp y lo abre en el navegador que WhatsApp trae por dentro, donde
# `window.print()` NO HACE NADA. Sin un PDF de verdad, el botón de
# descargar era un botón que no funcionaba justo donde más se usa.
#
# Se instala el Chromium de Alpine en vez del que se baja Puppeteer
# (por eso `puppeteer-core` y no `puppeteer`): el de Puppeteer se compila
# contra glibc y en Alpine no arranca.
#
# Las fuentes no son opcionales: sin ellas el PDF sale con cuadraditos
# en vez de letras.
RUN apk add --no-cache \
      libc6-compat openssl \
      chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_DOWNLOAD=1

# Usuario propio. El portal no necesita root dentro del contenedor, y
# correr como root ahí es regalar la mitad del camino si alguna vez se
# encuentra una ejecución remota.
RUN addgroup -g 1001 -S portal && adduser -u 1001 -S portal -G portal

COPY --from=builder --chown=portal:portal /app/public ./public
# El servidor ya empaquetado: esto es `output: "standalone"` de
# next.config.ts. Trae su propio server.js y solo las dependencias que
# se usan de verdad.
COPY --from=builder --chown=portal:portal /app/.next/standalone ./
COPY --from=builder --chown=portal:portal /app/.next/static ./.next/static

# El esquema y las migraciones, más la CLI de Prisma: el arranque aplica
# lo que falte en la base. Se copian del BUILDER y no de `deps` porque
# ahí el cliente ya está generado; el de `deps` es el molde vacío y
# pisaría al bueno.
COPY --from=builder --chown=portal:portal /app/prisma ./prisma
COPY --from=builder --chown=portal:portal /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=portal:portal /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=portal:portal /app/node_modules/.prisma ./node_modules/.prisma

# puppeteer-core va aparte por la misma razón que Prisma: está declarado
# como externo en next.config.ts, así que NO viaja dentro del paquete de
# `standalone`. Si se confía solo en el rastreador y este se deja algo,
# el fallo aparece únicamente aquí dentro —en desarrollo funciona— y
# cuesta un despliegue entero descubrirlo.
COPY --from=builder --chown=portal:portal /app/node_modules/puppeteer-core ./node_modules/puppeteer-core

COPY --chown=portal:portal docker/arrancar.sh ./arrancar.sh
RUN chmod +x ./arrancar.sh

# De qué versión es esta imagen. Sale en /api/health y en los registros:
# sin esto, "¿qué está corriendo en el servidor?" no tiene respuesta.
ARG VERSION=dev
ENV PORTAL_VERSION=$VERSION

USER portal
EXPOSE 3000

# Caddy y Docker necesitan saber si el portal está vivo o solo levantado.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./arrancar.sh"]
