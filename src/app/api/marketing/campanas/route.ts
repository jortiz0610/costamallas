import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

const CLAVE = "marketing_campanas";

export interface Campana {
  id: string;
  nombre: string;
  canal: string;        // google, meta, tiktok, organico, email, otro
  estado: string;       // activa, pausada, finalizada
  inversion: number;
  impresiones: number;
  clics: number;
  leads: number;
  conversiones: number; // ventas cerradas
  ingresos: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  createdAt: string;
}

async function leer(): Promise<Campana[]> {
  const row = await prisma.configuracion.findUnique({ where: { clave: CLAVE } });
  if (!row) return [];
  try { return JSON.parse(row.valor) as Campana[]; } catch { return []; }
}
async function guardar(campanas: Campana[]) {
  await prisma.configuracion.upsert({
    where: { clave: CLAVE },
    create: { clave: CLAVE, valor: JSON.stringify(campanas), descripcion: "Campañas de marketing" },
    update: { valor: JSON.stringify(campanas) },
  });
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, data: await leer() });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  if (!b.nombre?.trim()) return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 });

  const campanas = await leer();
  const nueva: Campana = {
    id: `cmp_${Date.now()}`,
    nombre: b.nombre.trim(),
    canal: b.canal ?? "otro",
    estado: b.estado ?? "activa",
    inversion: Number(b.inversion) || 0,
    impresiones: Number(b.impresiones) || 0,
    clics: Number(b.clics) || 0,
    leads: Number(b.leads) || 0,
    conversiones: Number(b.conversiones) || 0,
    ingresos: Number(b.ingresos) || 0,
    fechaInicio: b.fechaInicio || null,
    fechaFin: b.fechaFin || null,
    createdAt: new Date().toISOString(),
  };
  campanas.unshift(nueva);
  await guardar(campanas);
  return NextResponse.json({ success: true, data: nueva }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { id, ...rest } = await req.json();
  const campanas = await leer();
  const i = campanas.findIndex(c => c.id === id);
  if (i === -1) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
  const num = ["inversion", "impresiones", "clics", "leads", "conversiones", "ingresos"];
  for (const k of Object.keys(rest)) {
    (campanas[i] as unknown as Record<string, unknown>)[k] = num.includes(k) ? Number(rest[k]) || 0 : rest[k];
  }
  await guardar(campanas);
  return NextResponse.json({ success: true, data: campanas[i] });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  const campanas = await leer();
  await guardar(campanas.filter(c => c.id !== id));
  return NextResponse.json({ success: true });
}
