// ============================================================
// POST /api/public/woocommerce/webhook — la tienda avisa al ERP
//
// Es la mitad que faltaba de la conexión. Hasta ahora los pedidos de
// costamallas.com entraban por el cron `sync-woo`, que corre UNA VEZ AL
// DÍA a las 6 de la mañana: una compra de las 7 a. m. aparecía en el ERP
// al día siguiente. Con esto llega en segundos.
//
// QUÉ ESCUCHA
//   order.created  · la compra entra al ERP
//   order.updated  · cambios de estado y de pago
//   product.updated· si alguien edita un precio EN WordPress
//
// LA SEGURIDAD ES EL PUNTO DELICADO
// ---------------------------------
// Esta ruta es pública por obligación: WooCommerce no tiene sesión en el
// portal. Una ruta pública que crea pedidos sin comprobar quién llama es
// una puerta abierta — cualquiera con la URL podría inventar pedidos y
// clientes.
//
// Por eso se verifica la FIRMA de cada aviso. WooCommerce manda
// `x-wc-webhook-signature`, que es el HMAC-SHA256 del cuerpo con un
// secreto que solo conocen la tienda y el portal. Si no cuadra, se
// responde 401 y no se toca nada.
//
// La comparación va con `timingSafeEqual` y no con `===`: comparar
// cadenas se rinde en el primer carácter distinto, y de esa diferencia
// de tiempo se puede deducir la firma correcta byte a byte.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { importarUnPedidoWC, CLAVE_SECRETO_WEBHOOK } from "@/lib/woocommerce";
import { notificar } from "@/lib/notificar";

export const dynamic = "force-dynamic";

function firmaValida(cuerpo: string, firma: string | null, secreto: string): boolean {
  if (!firma) return false;
  const esperada = crypto.createHmac("sha256", secreto).update(cuerpo, "utf8").digest("base64");
  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  // Distinta longitud ya es un no, y timingSafeEqual exige que coincidan.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // El cuerpo se lee como TEXTO y se firma sobre ese texto exacto. Si se
  // parseara antes y se volviera a serializar, el JSON resultante no
  // sería byte a byte el mismo y la firma nunca cuadraría.
  const cuerpo = await req.text();

  const topic = req.headers.get("x-wc-webhook-topic") ?? "";

  // ── El "ping" del alta ──
  //
  // Al crear un webhook, WooCommerce manda una comprobación con el
  // cuerpo `webhook_id=13` y **sin firmarla**. Se comprobó en vivo: los
  // tres pings llegaron y se rechazaron con 401 por falta de firma.
  //
  // Contestarle 200 es seguro porque un ping no hace NADA: no trae
  // pedido, no toca la base, solo confirma que la dirección existe. Y
  // hay que contestarlo, o en el panel de la tienda el webhook aparece
  // como fallido y alguien lo desactiva creyendo que está roto.
  if (!topic && /^webhook_id=\d+$/.test(cuerpo.trim())) {
    return NextResponse.json({ ok: true, ping: true });
  }

  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE_SECRETO_WEBHOOK } });
  const secreto = fila?.valor?.trim();
  if (!secreto) {
    // Sin secreto configurado la ruta está CERRADA, no abierta. Es lo
    // contrario de lo que suele salir mal cuando falta una variable.
    return NextResponse.json({ ok: false, error: "Webhook no configurado." }, { status: 503 });
  }

  if (!firmaValida(cuerpo, req.headers.get("x-wc-webhook-signature"), secreto)) {
    await prisma.log.create({
      data: {
        accion: "WC_WEBHOOK_RECHAZADO",
        detalle: `Firma inválida desde ${req.headers.get("x-forwarded-for") ?? "?"}`,
        resultado: "ERROR",
      },
    }).catch(() => undefined);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!cuerpo || cuerpo === "{}") return NextResponse.json({ ok: true, vacio: true });

  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo ilegible" }, { status: 400 });
  }

  try {
    if (topic === "order.created" || topic === "order.updated") {
      const r = await importarUnPedidoWC(datos as never);

      // Un pedido nuevo se avisa; una actualización no, o el equipo
      // recibiría un aviso por cada movimiento interno de la tienda.
      if (r.estado === "importado") {
        const admins = await prisma.usuario.findMany({
          where: { activo: true, rol: { in: ["ADMIN", "SUPERADMIN"] } },
          select: { id: true },
        });
        await notificar({
          usuarioId: admins.map(a => a.id),
          titulo: `Venta en la web · ${r.numero}`,
          mensaje: `Entró un pedido de costamallas.com por ${Number(datos.total ?? 0).toLocaleString("es-CO")}.`,
          data: { numero: r.numero },
          url: "/crm/pedidos",
          etiqueta: `pedido-${r.numero}`,
        }).catch(() => undefined);
      }

      await prisma.log.create({
        data: {
          accion: "WC_WEBHOOK_PEDIDO",
          detalle: `${topic} → ${r.numero}: ${r.estado}`,
          resultado: "OK",
        },
      }).catch(() => undefined);

      return NextResponse.json({ ok: true, resultado: r.estado });
    }

    if (topic === "product.updated") {
      // Solo se anota de quién se trata. Traerse el cambio de la tienda
      // al ERP automáticamente sería pisar el dato bueno con el flojo:
      // el ERP es la fuente de la verdad del catálogo, y quien edita en
      // WordPress normalmente se equivocó de sitio.
      const sku = String((datos as { sku?: string }).sku ?? "");
      await prisma.log.create({
        data: {
          accion: "WC_WEBHOOK_PRODUCTO",
          detalle: `Editaron en WordPress: ${sku || datos.id}. El ERP manda; revisar si fue a propósito.`,
          resultado: "OK",
        },
      }).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, ignorado: topic });
  } catch (e) {
    console.error("[wc webhook]", topic, e);
    // 500 a propósito: WooCommerce reintenta lo que falla. Contestar 200
    // aquí sería perder el pedido en silencio.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
