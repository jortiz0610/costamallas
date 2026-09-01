// ============================================================
// Lo que llega de la página web entra a Nexus.
//
// El formulario de costamallas.com creaba el cliente, apuntaba la
// atribución y dejaba una notificación suelta — pero **no abría ninguna
// conversación**. Consecuencia práctica: el lead nunca aparecía en el
// inbox, así que nadie lo contestaba desde el portal. Quedaba como una
// fila de cliente con una nota, esperando a que alguien la encontrara.
//
// Ahora entra como conversación de verdad: se ve en la bandeja, se
// asigna, cuenta para el tiempo de respuesta y se contesta desde el
// mismo sitio que todo lo demás.
//
// La conexión de canal se crea sola la primera vez. Depender de que
// alguien la configure a mano significaría perder el primer lead.
// ============================================================

import { prisma } from "@/lib/prisma";

/** El canal con el que se guardan las entradas del formulario web. */
export const CANAL_FORMULARIO = "EMAIL";

/**
 * La conexión sobre la que cuelgan estas conversaciones.
 *
 * Se busca por canal y, si no existe, se crea. Es preferible una
 * conexión creada sola a un lead perdido porque nadie había entrado a
 * Configuración → Canales.
 */
async function conexionDelFormulario(): Promise<string> {
  const existente = await prisma.nexusConexion.findFirst({
    where: { canal: { in: [CANAL_FORMULARIO, "email", "wordpress_form"] } },
    select: { id: true },
  });
  if (existente) return existente.id;

  const nueva = await prisma.nexusConexion.create({
    data: {
      nombre: "Formulario de la página web",
      canal: CANAL_FORMULARIO,
      activo: true,
      config: {},
    },
    select: { id: true },
  });
  return nueva.id;
}

/** A quién se le asigna. Al asesor del cliente si ya tiene; si no, a nadie. */
async function asesorDe(clienteId: string): Promise<string | null> {
  const c = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { vendedorId: true },
  });
  return c?.vendedorId ?? null;
}

export interface EntradaWeb {
  clienteId: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  /** El texto que escribió la persona, ya armado. */
  mensaje: string;
  asunto?: string;
  /** Lo que se sabe del lead: producto, ciudad, campaña. */
  etiquetas?: string[];
}

/**
 * Abre —o retoma— la conversación de este contacto.
 *
 * Si ya tiene una abierta se le añade el mensaje en vez de crear otra:
 * alguien que llena el formulario dos veces en un día no son dos
 * conversaciones, es la misma persona insistiendo.
 */
export async function entrarPorLaWeb(e: EntradaWeb): Promise<{ conversacionId: string; nueva: boolean }> {
  const conexionId = await conexionDelFormulario();

  const abierta = await prisma.nexusConversacion.findFirst({
    where: {
      clienteId: e.clienteId,
      estado: "ABIERTA",
      canal: { in: [CANAL_FORMULARIO, "email", "wordpress_form"] },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  let conversacionId: string;
  let nueva = false;

  if (abierta) {
    conversacionId = abierta.id;
    await prisma.nexusConversacion.update({
      where: { id: conversacionId },
      // Vuelve a marcarse sin leer: llegó algo nuevo.
      data: { leida: false, updatedAt: new Date() },
    });
  } else {
    nueva = true;
    const conv = await prisma.nexusConversacion.create({
      data: {
        conexionId,
        canal: CANAL_FORMULARIO,
        remitente: e.nombre,
        emailRemit: e.email ?? null,
        telRemit: e.telefono ?? null,
        asunto: e.asunto ?? "Solicitud desde la página web",
        estado: "ABIERTA",
        prioridad: "NORMAL",
        leida: false,
        clienteId: e.clienteId,
        asignadoId: await asesorDe(e.clienteId),
        etiquetas: e.etiquetas ?? [],
      },
      select: { id: true },
    });
    conversacionId = conv.id;
  }

  await prisma.nexusMensaje.create({
    data: {
      conversacionId,
      origen: "contacto",
      contenido: e.mensaje,
      tipo: "texto",
      // Entró: no es algo que hayamos intentado enviar.
      estadoEnvio: "RECIBIDO",
      leido: false,
    },
  });

  return { conversacionId, nueva };
}
