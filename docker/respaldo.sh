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
#   SUPABASE_SECRET_KEY  la clave de servicio (NO la anon)
#   SUPABASE_BUCKET       respaldos
# ============================================================
set -euo pipefail

DIRECTORIO=/srv/backups
DIAS_QUE_SE_GUARDAN=14
cd /srv/portal

# ── Leer el .env SIN ejecutarlo ──
#
# ⚠️ Aquí ponía `. /srv/portal/.env`, que parece lo natural y es una
# trampa: el formato de Docker Compose admite valores con espacios y sin
# comillas —`DOMINIOS=portal.costamallas.com, cotizaciones.costamallas.com`—
# y el shell intenta EJECUTAR el segundo dominio como si fuera un
# comando. El guion moría en esa línea, antes de volcar nada.
#
# Eso dejó al portal sin un solo respaldo su primera noche en
# producción, y no se vio porque un cron que falla no se lo cuenta a
# nadie: solo deja una línea en un archivo que nadie mira.
#
# Peor todavía: sourcing un archivo de configuración ejecuta lo que
# haya dentro. Un valor con acentos graves o `$(...)` no es un error de
# sintaxis, es código corriendo como root.
leer() {
  sed -n "s/^$1=//p" /srv/portal/.env 2>/dev/null | head -1 | sed 's/^"//; s/"$//'
}

USUARIO="$(leer POSTGRES_USER)"; USUARIO="${USUARIO:-costamallas}"
BASE="$(leer POSTGRES_DB)";      BASE="${BASE:-costamallas}"
SUPABASE_URL="$(leer SUPABASE_URL)"
SUPABASE_SECRET_KEY="$(leer SUPABASE_SECRET_KEY)"
SUPABASE_BUCKET="$(leer SUPABASE_BUCKET)"
SELLO=$(date +%Y%m%d-%H%M)
ARCHIVO="$DIRECTORIO/costamallas-$SELLO.sql.gz"

mkdir -p "$DIRECTORIO"

echo "[$(date '+%F %T')] Respaldando $BASE…"

# ── Dejar rastro en la propia base ──
#
# Un cron que falla no se lo cuenta a nadie: deja una línea en un
# archivo que nadie mira. Eso dejó a este portal sin respaldos su
# primera noche, y se supo dos días después por casualidad.
#
# Así que el guion apunta CÓMO le fue en la tabla `configuracion`, y la
# pantalla de Estado del sistema lo lee y lo pinta en rojo si hace falta
# (ver src/lib/respaldo-estado.ts). Se escribe también cuando falla: un
# intento fallido registrado es más útil que el silencio.
apuntar() {
  local ok="$1" bytes="${2:-0}" fuera="${3:-false}" motivo="${4:-}"
  # El motivo se limpia de comillas: va dentro de un JSON dentro de SQL.
  motivo=$(printf '%s' "$motivo" | tr -d "\"'\\\\" | cut -c1-160)
  local json="{\"en\":\"$(date -Is)\",\"ok\":$ok,\"bytes\":$bytes,\"fuera\":$fuera,\"motivo\":\"$motivo\"}"
  docker compose exec -T postgres psql -U "$USUARIO" -d "$BASE" -q -c \
    "INSERT INTO configuracion (id, clave, valor, encrypted, descripcion, \"updatedAt\")
     VALUES (md5('respaldo_ultimo'), 'respaldo_ultimo', '$json', false,
             'Como le fue al ultimo respaldo. Lo escribe docker/respaldo.sh', now())
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, \"updatedAt\" = now();" \
    >/dev/null 2>&1 || true
}

# `pg_dump` dentro del contenedor: así no hace falta instalar el cliente
# de Postgres en el servidor ni preocuparse de que su versión coincida.
# `-T` porque cron no tiene terminal y sin eso docker falla.
if ! docker compose exec -T postgres pg_dump -U "$USUARIO" -d "$BASE" --clean --if-exists \
  | gzip -9 > "$ARCHIVO.parcial"; then
  echo "✗ El pg_dump falló. No se toca nada más."
  rm -f "$ARCHIVO.parcial"
  apuntar false 0 false "el pg_dump fallo"
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
FUERA=false
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SECRET_KEY:-}" ]; then
  BUCKET="${SUPABASE_BUCKET:-respaldos}"
  echo "  → Subiendo a Supabase Storage ($BUCKET)…"
  if curl -fsS -X POST \
      "${SUPABASE_URL%/}/storage/v1/object/$BUCKET/$(basename "$ARCHIVO")" \
      -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
      -H "Content-Type: application/gzip" \
      --data-binary "@$ARCHIVO" > /dev/null; then
    echo "  ✓ Copia fuera de la máquina lista."
    FUERA=true
  else
    # No se corta el script: el respaldo local YA está hecho y sirve.
    echo "  ✗ No se pudo subir. El respaldo local sí quedó."
  fi
else
  echo "  ⚠ Sin copia fuera de la máquina: faltan SUPABASE_URL y SUPABASE_SECRET_KEY."
  echo "    Un respaldo en el mismo disco que la base no salva de perder el disco."
fi

# El rastro para la pantalla de Estado del sistema. Va después de la
# copia de fuera para poder decir si salió o no.
apuntar true "$(stat -c%s "$ARCHIVO")" "$FUERA" ""

# ── Limpieza ──
# Solo los locales. Los de fuera se limpian en su destino: precisamente
# de lo que protegen es de que algo de esta máquina los borre.
borrados=$(find "$DIRECTORIO" -name "costamallas-*.sql.gz" -mtime +$DIAS_QUE_SE_GUARDAN -print -delete | wc -l)
[ "$borrados" -gt 0 ] && echo "  (se borraron $borrados respaldos de más de $DIAS_QUE_SE_GUARDAN días)"

echo "[$(date '+%F %T')] Listo."
