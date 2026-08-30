// ============================================================
// POST /api/nexus/conversaciones/[id]/cliente
//
// Guardar en el CRM a quien está escribiendo, sin salir del chat.
//
// Hasta ahora había que copiar el teléfono, abrir Clientes, darle a
// "nuevo", pegar, guardar y volver — seis pasos con un cliente esperando
// al otro lado. El resultado previsible: nadie lo hacía, y las
// conversaciones se quedaban sin ficha.
//
// Si ya existe alguien con ese teléfono o ese correo NO se crea otro: se
// enlaza el que hay. Un CRM con el mismo cliente tres veces es peor que
// uno con un cliente de menos.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { recalcularCliente } from "@/lib/estados-cliente-server";

type P = { params: Promise<{ id: string }> };

/** Solo dígitos, para poder comparar teléfonos escritos de mil formas. */
const soloDigitos = (v?: string | null) => (v ?? "").replace(/\D/g, "");

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const sinPermiso = await exigirPermiso(req, "crm.clientes");
  if (sinPermiso) return sinPermiso;

  const conv = await prisma.nexusConversacion.findUnique({
    where: { id },
    select: {
      id: true, remitente: true, telRemit: true, emailRemit: true,
      canal: true, clienteId: true, etiquetas: true,
    },
  });
  if (!conv) return NextResponse.json({ success: false, error: "La conversación no existe" }, { status: 404 });

  if (conv.clienteId) {
    const ya = await prisma.cliente.findUnique({ where: { id: conv.clienteId }, select: { id: true, nombre: true } });
    return NextResponse.json({ success: true, data: { ...ya, yaEstaba: true } });
  }

  const tel = soloDigitos(conv.telRemit);
  const email = conv.emailRemit?.trim().toLowerCase() || null;

  if (!tel && !email) {
    return NextResponse.json(
      {
        success: false,
        error: "Esta conversación no trae teléfono ni correo, así que no hay con qué identificar al cliente. Créalo a mano desde Clientes.",
      },
      { status: 400 },
    );
  }

  // ¿Ya existe? El teléfono se compara por dígitos porque en la base hay
  // de todo: con indicativo, sin él, con espacios y con guiones.
  let cliente = email
    ? await prisma.cliente.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, nombre: true } })
    : null;

  if (!cliente && tel) {
    const candidatos = await prisma.cliente.findMany({
      where: { OR: [{ telefono: { not: null } }, { whatsapp: { not: null } }] },
      select: { id: true, nombre: true, telefono: true, whatsapp: true },
    });
    const encontrado = candidatos.find(c => {
      const t1 = soloDigitos(c.telefono), t2 = soloDigitos(c.whatsapp);
      // Se comparan los últimos 10 dígitos: es el número nacional sin
      // indicativo, y es lo único que coincide siempre.
      const cola = (v: string) => v.slice(-10);
      return (t1 && cola(t1) === cola(tel)) || (t2 && cola(t2) === cola(tel));
    });
    if (encontrado) cliente = { id: encontrado.id, nombre: encontrado.nombre };
  }

  let creado = false;
  if (!cliente) {
    // Lo que el bot dedujo del primer mensaje entra como nota: es
    // contexto que ya se sabe y que si no, se pierde.
    const contexto = conv.etiquetas.length ? `De la conversación: ${conv.etiquetas.join(", ")}.` : "";
    cliente = await prisma.cliente.create({
      data: {
        nombre: conv.remitente?.trim() || conv.telRemit || email || "Sin nombre",
        telefono: conv.telRemit ?? null,
        whatsapp: conv.canal === "WHATSAPP" ? (conv.telRemit ?? null) : null,
        email,
        tipo: "persona",
        // Nace prospecto y sube solo. Ver lib/estados-cliente.ts.
        estado: "PROSPECTO",
        vendedorId: user.sub,
        notas: [`Creado desde el chat (${conv.canal}).`, contexto].filter(Boolean).join(" "),
      },
      select: { id: true, nombre: true },
    });
    creado = true;
  }

  await prisma.nexusConversacion.update({
    where: { id: conv.id },
    data: { clienteId: cliente.id },
  });

  // La conversación cuenta como interacción: recalcular deja el estado y
  // la "última señal de vida" al día sin esperar a la corrida diaria.
  await recalcularCliente(cliente.id);

  return NextResponse.json({ success: true, data: { ...cliente, creado, yaEstaba: false } });
}
