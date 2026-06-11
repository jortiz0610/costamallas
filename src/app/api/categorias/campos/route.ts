import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";

const CLAVE = "campos_categoria";

export interface CampoDef { key: string; label: string; tipo: "texto" | "numero" | "booleano" | "lista"; unidad?: string; opciones?: string[]; }
type Mapa = Record<string, CampoDef[]>;

async function leer(): Promise<Mapa> {
  const row = await prisma.configuracion.findUnique({ where: { clave: CLAVE } });
  try { return row ? JSON.parse(row.valor) : {}; } catch { return {}; }
}

// GET: cualquier usuario autenticado (para renderizar el formulario)
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, data: await leer() });
}

// POST: solo admin/superadmin — guarda los campos de una categoría
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { categoria, campos } = await req.json();
  if (!categoria) return NextResponse.json({ success: false, error: "Falta la categoría" }, { status: 400 });

  const mapa = await leer();
  if (Array.isArray(campos) && campos.length) mapa[categoria] = campos;
  else delete mapa[categoria];

  await prisma.configuracion.upsert({
    where: { clave: CLAVE },
    create: { clave: CLAVE, valor: JSON.stringify(mapa), descripcion: "Campos variables por categoría" },
    update: { valor: JSON.stringify(mapa) },
  });
  return NextResponse.json({ success: true });
}
