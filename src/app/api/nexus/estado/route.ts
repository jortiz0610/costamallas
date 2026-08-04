// ============================================================
// GET /api/nexus/estado — qué está realmente encendido en Nexus.
//
// La pantalla de flujos decía "En construcción" mientras el motor sí
// existía, y no había forma de saber si la IA estaba configurada o si un
// canal podía responder. Esto lo dice sin rodeos, canal por canal.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { canalPuedeEnviar } from "@/lib/nexus/canales";
import { obtenerClaveAnthropic } from "@/lib/sembli/agente";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const [clave, conexiones, flujosRow, conversaciones, sinLeer] = await Promise.all([
    obtenerClaveAnthropic().catch(() => null),
    prisma.nexusConexion.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.configuracion.findUnique({ where: { clave: "nexus_flujos" } }),
    prisma.nexusConversacion.count(),
    prisma.nexusConversacion.count({ where: { leida: false, estado: "ABIERTA" } }),
  ]);

  const canales = await Promise.all(
    conexiones.map(async c => {
      const { puede, motivo } = await canalPuedeEnviar(c.id);
      return { id: c.id, canal: c.canal, nombre: c.nombre, activo: c.activo, puedeEnviar: puede, motivo };
    }),
  );

  let flujosActivos = 0;
  try {
    const flujos = flujosRow ? JSON.parse(flujosRow.valor) : [];
    flujosActivos = Array.isArray(flujos) ? flujos.filter((f: { activo?: boolean }) => f.activo).length : 0;
  } catch { /* JSON corrupto: se reporta 0 */ }

  return NextResponse.json({
    success: true,
    data: {
      ia: { configurada: Boolean(clave), modelo: "claude-haiku-4-5" },
      canales,
      // Un canal que solo recibe sirve para leer, no para automatizar:
      // sin salida no hay respuesta automática posible.
      puedenResponder: canales.filter(c => c.activo && c.puedeEnviar).length,
      flujosActivos,
      conversaciones,
      sinLeer,
    },
  });
}
