// ============================================================
// POST /api/nexus/conversaciones/borrar — borrar chats
//
// Dos formas:
//   { ids: [...] }        borra los que se marcaron
//   { sinCliente: true }  borra TODOS los que no llegaron a cliente
//
// La segunda existe porque la bandeja se llena sola: el chat de la web
// abre una conversación por cada visita, y la mayoría no pasa de "¿hacen
// mallas para gatos?". Archivarlas de una en una no lo hace nadie, así
// que la bandeja deja de servir.
//
// ⚠️ Borra de verdad, no archiva. Se lleva los mensajes por cascada.
// Lo que NO se lleva por delante:
//   · Las conversaciones con cliente vinculado, en el borrado masivo.
//     Ahí hay historia comercial.
//   · Nada de otro dueño, si quien borra no puede ver el CRM completo:
//     un vendedor no le limpia la bandeja a otro.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso, peticionPuede, usuarioDeCabeceras } from "@/lib/permisos-server";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "nexus.borrar");
  if (sinPermiso) return sinPermiso;

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const sinCliente = body.sinCliente === true;
  const dry = body.dry === true;

  if (!ids.length && !sinCliente) {
    return NextResponse.json(
      { success: false, error: "No se dijo qué borrar." },
      { status: 400 },
    );
  }

  // Sin `crm.ver_todo`, solo lo asignado a esta persona. Si no, cualquiera
  // podría vaciarle la bandeja a un compañero.
  const verTodo = await peticionPuede(req, "crm.ver_todo");
  const yo = usuarioDeCabeceras(req).id || user.sub;
  const mio = verTodo ? {} : { asignadoId: yo };

  const where = sinCliente
    ? {
        ...mio,
        // Las que tienen ficha en el CRM se quedan: ahí hay historia.
        clienteId: null,
        // Y las que alguien contestó tampoco: si hubo respuesta, hubo
        // trabajo, y borrarlo se lleva la medida del tiempo de respuesta.
        primeraRespuestaEn: null,
      }
    : { ...mio, id: { in: ids } };

  const afectadas = await prisma.nexusConversacion.findMany({
    where,
    select: { id: true, remitente: true, canal: true, clienteId: true, _count: { select: { mensajes: true } } },
  });

  if (dry) {
    return NextResponse.json({
      success: true,
      data: {
        borradas: 0,
        seBorrarian: afectadas.length,
        mensajes: afectadas.reduce((s, c) => s + c._count.mensajes, 0),
      },
    });
  }

  if (afectadas.length) {
    await prisma.nexusConversacion.deleteMany({ where: { id: { in: afectadas.map(c => c.id) } } });
  }

  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: "NEXUS_CONVERSACIONES_BORRADAS",
      detalle: sinCliente
        ? `Limpieza de ${afectadas.length} chat(s) sin cliente`
        : `${afectadas.length} chat(s) borrados a mano`,
      resultado: "OK",
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    data: {
      borradas: afectadas.length,
      mensajes: afectadas.reduce((s, c) => s + c._count.mensajes, 0),
    },
  });
}
