#!/bin/bash
# ============================================================
# Trae los datos de Supabase al Postgres del servidor.
#
#   /srv/portal/migrar-datos.sh
#
# Se corre DOS veces en toda la mudanza:
#   · una ahora, para poder probar el portal con datos de verdad;
#   · otra en el momento del corte, para recoger todo lo que se movió
#     mientras se probaba.
#
# Por eso es idempotente y por eso BORRA el destino antes de restaurar:
# restaurar encima de datos que ya están duplicaría filas y reventaría
# las claves únicas a mitad de camino. El destino es una copia
# desechable hasta el corte; el origen manda.
#
# EL ORDEN IMPORTA, y es lo único que hay que entender de este guion:
#
#   1. Volcar. Si el volcado falla, NO se toca el destino y no ha pasado
#      nada. Este es el único momento peligroso y está antes de todo.
#   2. Guardar el volcado anterior, por si el nuevo saliera envenenado.
#   3. Vaciar el destino y restaurar.
#   4. Comparar tabla por tabla contra el origen. Si no cuadra, se dice.
#
# ⚠️ Después del corte esto NO se vuelve a correr: el origen pasa a ser
# el servidor y Supabase queda como copia de seguridad. Correrlo
# entonces sería sobrescribir producción con datos viejos.
# ============================================================
set -euo pipefail

cd /srv/portal
set -a; . /root/.origen.env; set +a

SELLO=$(date +%Y%m%d-%H%M%S)
VOLCADO=/root/origen-$SELLO.dump

echo "[$(date '+%F %T')] ── 1. Volcando Supabase ──"
if ! pg_dump "$DIRECT_URL" --schema=public --no-owner --no-privileges -Fc -f "$VOLCADO"; then
  echo "✗ El volcado falló. El servidor NO se ha tocado: sigue con los datos de antes."
  rm -f "$VOLCADO"
  exit 1
fi

PESO=$(stat -c%s "$VOLCADO")
echo "   volcado: $(numfmt --to=iec "$PESO")"
# Un volcado de menos de 50 KB de una base de 16 MB es un volcado
# cortado. Mejor parar aquí que descubrirlo con el destino ya vacío.
if [ "$PESO" -lt 51200 ]; then
  echo "✗ El volcado pesa demasiado poco. Algo salió mal. No se toca el servidor."
  exit 1
fi

echo "[$(date '+%F %T')] ── 2. Vaciando el destino ──"
# CASCADE porque las tablas se referencian entre ellas. Se recrea el
# esquema vacío acto seguido: sin esto, la restauración no tiene dónde
# escribir.
docker compose exec -T postgres psql -U "${POSTGRES_USER:-costamallas}" -d "${POSTGRES_DB:-costamallas}" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null

echo "[$(date '+%F %T')] ── 3. Restaurando ──"
docker compose exec -T postgres pg_restore --no-owner --no-privileges \
  -U "${POSTGRES_USER:-costamallas}" -d "${POSTGRES_DB:-costamallas}" < "$VOLCADO" 2> /root/restore-$SELLO.err || true

# `schema "public" already exists` es esperable y no es un fallo: lo
# acabamos de crear nosotros. Cualquier otro error sí hay que mirarlo.
ERRORES=$(grep "^pg_restore: error" "/root/restore-$SELLO.err" 2>/dev/null | grep -vc 'schema "public" already exists' || true)
echo "   errores relevantes: ${ERRORES:-0}"
if [ "${ERRORES:-0}" -gt 0 ]; then
  grep "^pg_restore: error" "/root/restore-$SELLO.err" | grep -v 'schema "public" already exists' | head -8
fi

echo "[$(date '+%F %T')] ── 4. Comparando origen y destino ──"
FALLOS=0
for t in usuarios clientes cotizaciones productos pedidos instalaciones configuracion notificaciones; do
  o=$(psql "$DIRECT_URL" -tAc "SELECT count(*) FROM $t" 2>/dev/null || echo "?")
  d=$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-costamallas}" -d "${POSTGRES_DB:-costamallas}" \
        -tAc "SELECT count(*) FROM $t" 2>/dev/null | tr -d '\r' || echo "?")
  if [ "$o" = "$d" ]; then
    printf "   OK  %-16s %s\n" "$t" "$o"
  else
    printf "   ✗   %-16s origen %s / destino %s\n" "$t" "$o" "$d"
    FALLOS=$((FALLOS+1))
  fi
done

# El historial de migraciones no viaja en el volcado: la base de origen
# se creo con `db push` y no lo tiene. Sin esto, el portal intentaria
# aplicar las 24 migraciones sobre una base que ya tiene las tablas y NO
# arrancaria.
echo "[$(date '+%F %T')] ── 5. Marcando las migraciones como aplicadas ──"
docker compose run --rm --no-deps --entrypoint sh portal -c '
  P="node node_modules/prisma/build/index.js"
  n=0
  for m in $(ls prisma/migrations | grep -v migration_lock.toml); do
    $P migrate resolve --applied "$m" >/dev/null 2>&1 && n=$((n+1))
  done
  echo "   marcadas: $n"
' 2>/dev/null | grep marcadas

# Los volcados viejos no se acumulan: son datos de clientes.
ls -1t /root/origen-*.dump 2>/dev/null | tail -n +4 | xargs -r rm -f

if [ "$FALLOS" -gt 0 ]; then
  echo ""
  echo "✗ HAY TABLAS QUE NO CUADRAN. No sigas con el corte hasta entender por qué."
  exit 1
fi

echo ""
echo "✓ Datos migrados y comprobados. Volcado guardado en $VOLCADO"
