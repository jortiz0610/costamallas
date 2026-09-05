#!/bin/bash
# ============================================================
# El respaldo diario de la base. Va en /srv/portal/respaldo.sh.
#
#   0 2 * * * /srv/portal/respaldo.sh >> /srv/backups/respaldo.log 2>&1
#
# DOS COPIAS, Y NO SON LA MISMA COSA
# ----------------------------------
#   1. En la máquina (/srv/backups). Salva de un borrado, de una
#      migración que salió mal, de un "update sin where". Es la que se
#      usa el 95 % de las veces.
#   2. FUERA de la máquina. Salva de perder la máquina: un disco, una
#      factura sin pagar, un servidor borrado por equivocación.
#
# Un respaldo que vive en el mismo disco que la base no es un respaldo:
# es una copia. Si solo hay tiempo para una, que sea la de fuera.
#
# La copia de fuera va a Supabase Storage si están puestas las tres
# variables de abajo. Se aprovecha el proyecto de Supabase que queda
# libre al traerse la base al VPS: ya está pagado y ya está fuera.
# Cualquier otro destino (S3, Backblaze, el backup de Hostinger) sirve
# igual; lo que no sirve es no tener ninguno.
#
#   SUPABASE_URL          https://xxxx.supabase.co
#   SUPABASE_SERVICE_KEY  la clave de servicio (NO la anon)
#   SUPABASE_BUCKET       respaldos
# ============================================================
set -euo pipefail

DIRECTORIO=/srv/backups
DIAS_QUE_SE_GUARDAN=14
cd /srv/portal

# Las variables salen del mismo .env que usa el portal.
set -a
# shellcheck disable=SC1091
[ -f /srv/portal/.env ] && . /srv/portal/.env
set +a

USUARIO="${POSTGRES_USER:-costamallas}"
BASE="${POSTGRES_DB:-costamallas}"
SELLO=$(date +%Y%m%d-%H%M)
ARCHIVO="$DIRECTORIO/costamallas-$SELLO.sql.gz"

mkdir -p "$DIRECTORIO"

echo "[$(date '+%F %T')] Respaldando $BASE…"

# `pg_dump` dentro del contenedor: así no hace falta instalar el cliente
# de Postgres en el servidor ni preocuparse de que su versión coincida.
# `-T` porque cron no tiene terminal y sin eso docker falla.
if ! docker compose exec -T postgres pg_dump -U "$USUARIO" -d "$BASE" --clean --if-exists \
  | gzip -9 > "$ARCHIVO.parcial"; then
  echo "✗ El pg_dump falló. No se toca nada más."
  rm -f "$ARCHIVO.parcial"
  exit 1
fi

# Se renombra AL FINAL. Un archivo a medio escribir con el nombre bueno
# es peor que no tener respaldo: parece que hay uno.
mv "$ARCHIVO.parcial" "$ARCHIVO"

PESO=$(du -h "$ARCHIVO" | cut -f1)
echo "  ✓ $ARCHIVO ($PESO)"

# Un volcado de unos pocos KB es una base vacía o un dump que se cortó.
if [ "$(stat -c%s "$ARCHIVO")" -lt 51200 ]; then
  echo "  ⚠ El respaldo pesa menos de 50 KB. Míralo antes de confiar en él."
fi

# ── La copia de fuera ──
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  BUCKET="${SUPABASE_BUCKET:-respaldos}"
  echo "  → Subiendo a Supabase Storage ($BUCKET)…"
  if curl -fsS -X POST \
      "${SUPABASE_URL%/}/storage/v1/object/$BUCKET/$(basename "$ARCHIVO")" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
      -H "Content-Type: application/gzip" \
      --data-binary "@$ARCHIVO" > /dev/null; then
    echo "  ✓ Copia fuera de la máquina lista."
  else
    # No se corta el script: el respaldo local YA está hecho y sirve.
    echo "  ✗ No se pudo subir. El respaldo local sí quedó."
  fi
else
  echo "  ⚠ Sin copia fuera de la máquina: faltan SUPABASE_URL y SUPABASE_SERVICE_KEY."
  echo "    Un respaldo en el mismo disco que la base no salva de perder el disco."
fi

# ── Limpieza ──
# Solo los locales. Los de fuera se limpian en su destino: precisamente
# de lo que protegen es de que algo de esta máquina los borre.
borrados=$(find "$DIRECTORIO" -name "costamallas-*.sql.gz" -mtime +$DIAS_QUE_SE_GUARDAN -print -delete | wc -l)
[ "$borrados" -gt 0 ] && echo "  (se borraron $borrados respaldos de más de $DIAS_QUE_SE_GUARDAN días)"

echo "[$(date '+%F %T')] Listo."
