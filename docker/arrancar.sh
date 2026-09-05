#!/bin/sh
# ============================================================
# Lo que pasa cuando arranca el contenedor del portal.
#
# Dos cosas, en este orden:
#   1. Aplicar las migraciones que le falten a la base.
#   2. Levantar el servidor.
#
# Y si lo primero falla, NO se hace lo segundo. Un portal corriendo
# contra una base a la que le falta una columna no da un error claro:
# da media pantalla en blanco y un error distinto en cada sitio, y se
# descubre tres días después por una queja.
# ============================================================
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "✗ Falta DATABASE_URL. Revisa el archivo .env del servidor."
  exit 1
fi

# `prisma migrate deploy` usa DIRECT_URL cuando está puesta (el esquema
# lo declara así). Con Supabase eso importa: el pooler no admite las
# sentencias que necesita una migración.
if [ "${MIGRAR_AL_ARRANCAR:-1}" = "1" ]; then
  echo "→ Aplicando migraciones pendientes…"
  if ! node node_modules/prisma/build/index.js migrate deploy; then
    echo ""
    echo "✗ Las migraciones fallaron. El portal no arranca a propósito."
    echo "  Mira el error de arriba. Si la base ya estaba al día y lo que"
    echo "  falla es el bloqueo, es que hay otro contenedor arrancando:"
    echo "  espera y vuelve a intentarlo."
    exit 1
  fi
else
  echo "→ MIGRAR_AL_ARRANCAR=0: se saltan las migraciones."
fi

echo "→ Portal ${PORTAL_VERSION:-dev} escuchando en ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
