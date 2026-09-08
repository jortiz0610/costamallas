#!/bin/bash
# ============================================================
# Mantiene viva la copia de seguridad de Vercel.
#
#   /srv/portal/refrescar-respaldo-vercel.sh
#
# Vercel se quedó encendido a propósito: si un día el servidor se cae,
# se devuelve el DNS y en cinco minutos el portal vuelve a funcionar.
# Pero eso solo sirve si su base tiene datos recientes — y desde el
# corte, todo lo que se escribe va al servidor, así que Supabase se
# queda cada día más atrás. Esto la pone al día una vez al día.
#
# Lo que se consigue: si hay que volver a Vercel, se pierde como mucho
# lo de hoy. No es cero, y hay que decirlo así de claro; pero la
# alternativa —levantar una máquina desde cero— es una tarde de trabajo.
#
# ⚠️ ESTO SOBRESCRIBE SUPABASE ENTERO. La dirección es siempre la misma:
#
#       servidor  ──────────▶  Supabase
#       (lo vivo)              (la copia)
#
# Al revés sería destruir producción. Por eso el guion COMPRUEBA que el
# servidor sigue siendo el que atiende portal.costamallas.com, y si no
# lo es, se niega a correr: significa que alguien ya devolvió el DNS a
# Vercel y entonces la copia es la que manda.
# ============================================================
set -euo pipefail

cd /srv/portal
IP_DE_ESTE_SERVIDOR=177.7.51.167

echo "[$(date '+%F %T')] ── Refrescando la copia de Vercel ──"

# ── El seguro ──
# Si portal.costamallas.com ya no apunta aquí, es que se hizo la vuelta
# atrás y Supabase pasó a ser la base viva. Sobrescribirla sería borrar
# producción con datos de un servidor que ya nadie usa.
actual=$(getent ahostsv4 portal.costamallas.com 2>/dev/null | head -1 | awk '{print $1}')
if [ "$actual" != "$IP_DE_ESTE_SERVIDOR" ]; then
  echo "✗ portal.costamallas.com apunta a ${actual:-nada}, no a este servidor."
  echo "  Eso significa que la copia es la que está sirviendo. NO se toca."
  exit 1
fi

set -a; . /root/.origen.env; set +a
if [ -z "${DIRECT_URL:-}" ]; then
  echo "✗ Falta DIRECT_URL en /root/.origen.env."
  exit 1
fi

# ── 1. Volcar lo vivo ──
VOLCADO=/tmp/hacia-supabase.dump
echo "  volcando el servidor…"
if ! docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-costamallas}" \
      -d "${POSTGRES_DB:-costamallas}" --schema=public --no-owner --no-privileges -Fc > "$VOLCADO"; then
  echo "✗ El volcado falló. Supabase se queda como estaba."
  rm -f "$VOLCADO"; exit 1
fi

PESO=$(stat -c%s "$VOLCADO")
echo "  volcado: $(numfmt --to=iec "$PESO")"
# Un volcado ridículamente pequeño es un volcado cortado. Restaurarlo
# dejaría la copia peor que desactualizada: la dejaría vacía.
if [ "$PESO" -lt 51200 ]; then
  echo "✗ El volcado pesa demasiado poco. No se toca la copia."
  rm -f "$VOLCADO"; exit 1
fi

# ── 2. Vaciar y restaurar en Supabase ──
echo "  restaurando en Supabase…"
# Los GRANT no son decorativos: al recrear el esquema, Supabase pierde
# los permisos que dan por hechos sus propias herramientas, y el panel
# deja de poder mirar las tablas.
psql "$DIRECT_URL" -q -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO public;" >/dev/null

pg_restore --no-owner --no-privileges -d "$DIRECT_URL" < "$VOLCADO" 2>/tmp/hacia-supabase.err || true
ERRORES=$(grep "^pg_restore: error" /tmp/hacia-supabase.err 2>/dev/null | grep -vc 'already exists' || true)

# ── 3. Comprobar, no confiar ──
FALLOS=0
for t in usuarios clientes cotizaciones pedidos productos; do
  o=$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-costamallas}" -d "${POSTGRES_DB:-costamallas}" \
        -tAc "SELECT count(*) FROM $t" 2>/dev/null | tr -d '\r')
  d=$(psql "$DIRECT_URL" -tAc "SELECT count(*) FROM $t" 2>/dev/null || echo "?")
  [ "$o" = "$d" ] || { printf "  ✗ %s: servidor %s / copia %s\n" "$t" "$o" "$d"; FALLOS=$((FALLOS+1)); }
done

rm -f "$VOLCADO"

if [ "$FALLOS" -gt 0 ] || [ "${ERRORES:-0}" -gt 0 ]; then
  echo "✗ La copia quedó incompleta (${ERRORES:-0} errores, $FALLOS tablas descuadradas)."
  echo "  El servidor no se ha tocado: esto solo afecta a la copia de emergencia."
  exit 1
fi

echo "[$(date '+%F %T')] ✓ Copia de Vercel al día."
