import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const CLAVE = "nexus_flujos";

export interface Flujo {
  id: string;
  nombre: string;
  disparador: string[];          // palabras clave que activan el flujo
  objetivo: string;              // qué debe lograr el agente
  accion: "responder_ia" | "transferir" | "etiquetar" | "saludo";
  transferirSiComplejo: boolean;
  canal: string;                 // todos, whatsapp, instagram...
  activo: boolean;
  createdAt: string;
}

const DEFAULTS: Flujo[] = [
  {
    id: "flujo_producto",
    nombre: "Consulta de producto",
    disparador: ["precio", "producto", "tienen", "catálogo", "catalogo", "medidas", "malla", "info", "información"],
    objetivo: "Cuando un cliente consulta un producto, responde con toda la información disponible de ese producto (tipos, medidas, precio por m², usos) de forma clara y útil.",
    accion: "responder_ia",
    transferirSiComplejo: false,
    canal: "todos",
    activo: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "flujo_cotizar",
    nombre: "Ayuda a cotizar",
    disparador: ["cotizar", "cotización", "cotizacion", "presupuesto", "precio", "comprar", "necesito"],
    objetivo: "Cuando un cliente quiere cotizar, ayúdalo de forma amable y ordenada a entender qué necesita: tipo de malla, medidas (largo x ancho), cantidad, ciudad y si requiere instalación. Pregunta una o dos cosas a la vez. Si la conversación se vuelve compleja, transfiere a un asesor humano.",
    accion: "responder_ia",
    transferirSiComplejo: true,
    canal: "todos",
    activo: true,
    createdAt: new Date().toISOString(),
  },
];

async function leer(): Promise<Flujo[]> {
  const row = await prisma.configuracion.findUnique({ where: { clave: CLAVE } });
  if (!row) { await guardar(DEFAULTS); return DEFAULTS; }
  try { return JSON.parse(row.valor) as Flujo[]; } catch { return DEFAULTS; }
}
async function guardar(flujos: Flujo[]) {
  await prisma.configuracion.upsert({
    where: { clave: CLAVE },
    create: { clave: CLAVE, valor: JSON.stringify(flujos), descripcion: "Flujos de automatización de Nexus" },
    update: { valor: JSON.stringify(flujos) },
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

  const b = await req.json();
  if (!b.nombre?.trim()) return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 });

  const flujos = await leer();
  const nuevo: Flujo = {
    id: `flujo_${Date.now()}`,
    nombre: b.nombre.trim(),
    disparador: Array.isArray(b.disparador) ? b.disparador : String(b.disparador ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    objetivo: b.objetivo ?? "",
    accion: b.accion ?? "responder_ia",
    transferirSiComplejo: !!b.transferirSiComplejo,
    canal: b.canal ?? "todos",
    activo: b.activo ?? true,
    createdAt: new Date().toISOString(),
  };
  flujos.unshift(nuevo);
  await guardar(flujos);
  return NextResponse.json({ success: true, data: nuevo }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { id, ...rest } = await req.json();
  const flujos = await leer();
  const i = flujos.findIndex(f => f.id === id);
  if (i === -1) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
  flujos[i] = { ...flujos[i], ...rest };
  await guardar(flujos);
  return NextResponse.json({ success: true, data: flujos[i] });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const flujos = await leer();
  await guardar(flujos.filter(f => f.id !== id));
  return NextResponse.json({ success: true });
}
