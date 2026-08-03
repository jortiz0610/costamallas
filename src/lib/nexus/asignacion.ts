// ============================================================
// NEXUS — a quién le cae la conversación que entra.
//
// El problema que describió gerencia: la línea de WhatsApp tenía un solo
// dueño, así que todo lo que entraba caía en la misma persona. "Si Lady ya
// lleva dos atenciones, Elkin también tiene que tener la oportunidad."
//
// Reglas, en orden:
//   1. Si el contacto ya es cliente y tiene vendedor asignado, va con él.
//      Cambiar de asesor a mitad de relación es la peor experiencia.
//   2. Si ya tuvo una conversación antes, sigue con quien lo atendió.
//   3. Si no, por turno: al asesor con menos conversaciones abiertas.
//      Se desempata por el que lleva más tiempo sin recibir una.
// ============================================================

import { prisma } from "@/lib/prisma";

/** Roles que atienden clientes. */
const ROLES_ATENCION = ["VENDEDOR", "ADMIN", "SUPERADMIN", "USUARIO"];

export interface Asignacion {
  usuarioId: string | null;
  clienteId: string | null;
  motivo: string;
}

/** Busca al contacto en el CRM por teléfono o correo. */
async function buscarCliente(telefono?: string | null, email?: string | null) {
  const tel = telefono?.replace(/\D/g, "");
  if (!tel && !email) return null;

  // Se comparan los últimos 10 dígitos: la misma persona puede aparecer
  // como 3006078956, +573006078956 o 57 300 607 8956.
  const cola = tel && tel.length >= 10 ? tel.slice(-10) : null;

  const candidatos = await prisma.cliente.findMany({
    where: {
      activo: true,
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(cola ? [{ telefono: { contains: cola } }, { whatsapp: { contains: cola } }] : []),
      ],
    },
    select: { id: true, vendedorId: true },
    take: 1,
  });

  return candidatos[0] ?? null;
}

/**
 * Decide el asesor de una conversación entrante.
 *
 * `preferido` es el usuario amarrado a la línea; hoy se usa solo como
 * último recurso: si la línea tiene dueño fijo, el reparto por turno
 * pierde el sentido.
 */
export async function asignarConversacion(datos: {
  telefono?: string | null;
  email?: string | null;
  preferido?: string | null;
}): Promise<Asignacion> {
  const cliente = await buscarCliente(datos.telefono, datos.email);

  // 1. El cliente ya tiene asesor.
  if (cliente?.vendedorId) {
    const sigueActivo = await prisma.usuario.findFirst({
      where: { id: cliente.vendedorId, activo: true },
      select: { id: true },
    });
    if (sigueActivo) {
      return { usuarioId: cliente.vendedorId, clienteId: cliente.id, motivo: "Ya es su asesor en el CRM" };
    }
  }

  // 2. Ya lo atendieron antes por este medio.
  if (cliente || datos.telefono || datos.email) {
    const previa = await prisma.nexusConversacion.findFirst({
      where: {
        asignadoId: { not: null },
        OR: [
          ...(cliente ? [{ clienteId: cliente.id }] : []),
          ...(datos.telefono ? [{ telRemit: datos.telefono }] : []),
          ...(datos.email ? [{ emailRemit: datos.email }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { asignadoId: true },
    });
    if (previa?.asignadoId) {
      const sigueActivo = await prisma.usuario.findFirst({
        where: { id: previa.asignadoId, activo: true },
        select: { id: true },
      });
      if (sigueActivo) {
        return { usuarioId: previa.asignadoId, clienteId: cliente?.id ?? null, motivo: "Ya lo había atendido antes" };
      }
    }
  }

  // 3. Por turno: el que menos carga tiene.
  const asesores = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ROLES_ATENCION as never[] } },
    select: { id: true, nombre: true },
  });

  if (!asesores.length) {
    return { usuarioId: datos.preferido ?? null, clienteId: cliente?.id ?? null, motivo: "No hay asesores activos" };
  }

  const abiertas = await prisma.nexusConversacion.groupBy({
    by: ["asignadoId"],
    where: { estado: "ABIERTA", asignadoId: { in: asesores.map(a => a.id) } },
    _count: { _all: true },
  });
  const carga = new Map(abiertas.map(a => [a.asignadoId!, a._count._all]));

  // Última vez que a cada uno le cayó algo, para desempatar de forma justa.
  const ultimas = await prisma.nexusConversacion.groupBy({
    by: ["asignadoId"],
    where: { asignadoId: { in: asesores.map(a => a.id) } },
    _max: { createdAt: true },
  });
  const ultima = new Map(ultimas.map(u => [u.asignadoId!, u._max.createdAt?.getTime() ?? 0]));

  const elegido = asesores
    .map(a => ({ ...a, carga: carga.get(a.id) ?? 0, ultima: ultima.get(a.id) ?? 0 }))
    .sort((x, y) => x.carga - y.carga || x.ultima - y.ultima)[0];

  return {
    usuarioId: elegido.id,
    clienteId: cliente?.id ?? null,
    motivo: `Por turno · tenía ${elegido.carga} conversación(es) abiertas`,
  };
}
