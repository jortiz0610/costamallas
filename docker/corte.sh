#!/bin/bash
# ============================================================
# El corte: el momento en que el portal deja de vivir en Vercel.
#
#   /srv/portal/corte.sh
#
# Hace TODO menos lo único que no se puede hacer desde aquí: mover el
# DNS. Eso se hace a mano en Hostinger, y va de último a propósito.
#
# EL ORDEN, Y POR QUÉ
#
#   1. Traer los datos otra vez. Recoge todo lo que se movió mientras se
#      probaba. Si esto falla, se para aquí y no ha cambiado nada.
#   2. Cambiar los dominios y levantar. El servidor queda listo y
#      esperando, pero NADIE llega todavía: el DNS sigue en Vercel.
#   3. Encender los crons. Hasta este momento el servidor no ha mandado
#      un solo correo, y eso es deliberado: dos sistemas corriendo la
#      misma automatización sobre los mismos clientes es como se manda
#      el seguimiento dos veces.
#   4. TÚ mueves el DNS.
#
# ⚠️ EL CHAT DE LA WEB SE MUDA EN EL MISMO INSTANTE que el DNS. El
# widget que está pegado en WordPress carga desde portal.costamallas.com,
# así que en cuanto el registro apunte aquí, la tienda le habla a este
# servidor. Por eso el DNS es lo último y por eso conviene hacerlo con
# calma y mirando.
#
# PARA VOLVER ATRÁS: se devuelve el registro DNS a Vercel. Vercel sigue
# encendido y con su base en Supabase. Lo que se pierde es lo que se
# haya escrito en el servidor mientras tanto.
# ============================================================
set -euo pipefail
cd /srv/portal

echo "════════════════════════════════════════════════════"
echo "  CORTE — el portal se muda al servidor"
echo "════════════════════════════════════════════════════"
echo ""

# ── 1. Los datos, otra vez ──
echo "▸ 1/4  Trayendo los datos de Supabase"
./migrar-datos.sh
echo ""

# ── 2. Los dominios de verdad ──
echo "▸ 2/4  Cambiando a los dominios de la empresa"
sed -i 's|^DOMINIOS=.*|DOMINIOS=portal.costamallas.com, cotizaciones.costamallas.com|' .env
sed -i 's|^PORTAL_URL=.*|PORTAL_URL=https://portal.costamallas.com|' .env
sed -i 's|^COTIZACION_URL=.*|COTIZACION_URL=https://cotizaciones.costamallas.com|' .env
grep -E '^(DOMINIOS|PORTAL_URL|COTIZACION_URL)=' .env | sed 's/^/   /'

docker compose up -d
echo "   (Caddy pedirá el certificado de portal.costamallas.com en cuanto"
echo "    el DNS apunte aquí; hasta entonces dará error y es lo esperado)"
echo ""

# ── 3. El reloj ──
echo "▸ 3/4  Encendiendo los crons"
CRON_SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2-)

# `diario` cada 15 minutos y NO también a las 13:00: es la misma ruta y
# corriendo cada cuarto de hora la línea diaria no añade nada. En Vercel
# hacían falta las dos porque el plan Hobby no admite nada más frecuente
# que una vez al día — ese apaño se acaba aquí.
cat > /etc/cron.d/costamallas <<CRON
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
# El reloj del portal. Sustituye al workflow de GitHub Actions, que se
# borra del repositorio: aquí hay cron de verdad.
*/15 * * * * root curl -sS -m 300 -H "Authorization: Bearer $CRON_SECRET" https://portal.costamallas.com/api/cron/diario > /dev/null
0 6 * * *    root curl -sS -m 900 -H "Authorization: Bearer $CRON_SECRET" https://portal.costamallas.com/api/cron/sync-woo > /dev/null
# El respaldo de la base, a las 2 de la mañana.
0 2 * * *    root /srv/portal/respaldo.sh >> /srv/backups/respaldo.log 2>&1
# Y media hora después, poner al día la copia de Vercel: sin esto, la
# vuelta atrás existe pero con datos de la semana pasada.
30 2 * * *   root /srv/portal/refrescar-respaldo-vercel.sh >> /srv/backups/copia-vercel.log 2>&1
CRON
chmod 644 /etc/cron.d/costamallas
systemctl reload cron 2>/dev/null || service cron reload 2>/dev/null || true
echo "   instalado /etc/cron.d/costamallas:"
grep -oE '^[0-9*/, ]+ root [a-z/]+' /etc/cron.d/costamallas | sed 's/^/     /'
echo ""

# ── 4. Comprobar antes de entregar ──
echo "▸ 4/4  Comprobando"
for i in $(seq 1 45); do
  if docker compose exec -T portal node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "   el portal contesta (${i}0s)"; break
  fi
  sleep 2
done
docker compose ps
echo ""
echo "════════════════════════════════════════════════════"
echo "  El servidor está listo y esperando."
echo ""
echo "  FALTA UNA COSA, Y LA HACES TÚ:"
echo "    En Hostinger, el registro A de portal.costamallas.com"
echo "    pasa de 66.33.60.66 (Vercel) a 177.7.51.167 (este servidor)."
echo ""
echo "  Al cambiarlo, el chat de la web de la tienda también se muda."
echo "  Vercel se queda encendido: si algo va mal, devuelves el"
echo "  registro y en minutos estás como antes."
echo "════════════════════════════════════════════════════"
