// ============================================================
// Conexiones de canal de Nexus.
//
// La configuración de cada canal lleva credenciales (el token de WhatsApp,
// por ejemplo). Dos cosas que antes no pasaban y ahora sí:
//   · se guardan cifradas, como el resto de secretos del sistema;
//   · nunca se devuelven al navegador — solo si están puestas o no.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { urlPortal } from "@/lib/url-portal";
import { getUserFromRequest } from "@/lib/auth";
import { prepararConfig } from "@/lib/nexus/canales";

/** Claves que jamás salen del servidor. */
const SECRETAS = new Set(["token", "apiKey", "appSecret"]);

function configSegura(bruto: unknown): Record<string, unknown> {
  const cfg = (bruto ?? {}) as Record<string, unknown>;
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (SECRETAS.has(k)) salida[`tiene_${k}`] = Boolean(v);
    else salida[k] = v;
  }
  return salida;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const conexiones = await prisma.nexusConexion.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    success: true,
    data: conexiones.map(c => ({ ...c, config: configSegura(c.config) })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["ADMIN", "SUPERADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { canal, nombre, descripcion, config } = body;
  if (!canal || !nombre) return NextResponse.json({ success: false, error: "Canal y nombre requeridos" }, { status: 400 });

  // Antes se armaba con NEXTAUTH_URL/VERCEL_URL, que en este proyecto no
  // existen: el webhook quedaba apuntando a localhost y había que
  // corregirlo a mano al pegarlo en Meta.
  // Ojo: NEXT_PUBLIC_APP_URL apunta a la tienda; el webhook lo tiene
  // que recibir el portal.
  const base = urlPortal(req);
  const webhookUrl = `${base}/api/nexus/webhook/${canal}`;

  const conexion = await prisma.nexusConexion.create({
    data: { canal, nombre, descripcion, config: prepararConfig(config ?? {}), webhookUrl },
  });

  return NextResponse.json({ success: true, data: { ...conexion, config: configSegura(conexion.config) } });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { id, activo, config, nombre, asignadoId } = body;
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

  const actual = await prisma.nexusConexion.findUnique({ where: { id } });
  if (!actual) return NextResponse.json({ success: false, error: "La conexión no existe" }, { status: 404 });

  // Se fusiona con lo que ya había: así se puede corregir el Phone Number
  // ID sin tener que volver a pegar el token entero.
  let configFinal: Record<string, unknown> | undefined;
  if (config) {
    if (!["ADMIN", "SUPERADMIN"].includes(user.rol)) {
      return NextResponse.json({ success: false, error: "Sin permisos para cambiar credenciales" }, { status: 403 });
    }
    const entrante = Object.fromEntries(
      Object.entries(config as Record<string, string>).filter(([, v]) => v !== "" && v !== undefined),
    );
    configFinal = { ...(actual.config as Record<string, unknown>), ...prepararConfig(entrante) };
  }

  const updated = await prisma.nexusConexion.update({
    where: { id },
    data: {
      ...(activo !== undefined && { activo }),
      ...(configFinal && { config: configFinal as never }),
      ...(nombre && { nombre }),
      ...(asignadoId !== undefined && { asignadoId: asignadoId || null }),
    },
  });

  return NextResponse.json({ success: true, data: { ...updated, config: configSegura(updated.config) } });
}
