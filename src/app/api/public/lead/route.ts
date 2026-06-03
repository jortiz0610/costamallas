import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Registra el uso de la campaña/fuente en la atribución (Configuracion JSON)
async function registrarAtribucion(entry: Record<string, unknown>) {
  const row = await prisma.configuracion.findUnique({ where: { clave: "marketing_leads" } });
  let arr: unknown[] = [];
  try { arr = row ? JSON.parse(row.valor) : []; } catch { arr = []; }
  arr.unshift(entry);
  arr = arr.slice(0, 1000);
  await prisma.configuracion.upsert({
    where: { clave: "marketing_leads" },
    create: { clave: "marketing_leads", valor: JSON.stringify(arr), descripcion: "Atribución de leads web (UTM)" },
    update: { valor: JSON.stringify(arr) },
  });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const nombre = String(b.nombre ?? "").trim();
    const email = b.email ? String(b.email).trim().toLowerCase() : null;
    const telefono = b.telefono ? String(b.telefono).trim() : null;
    if (!nombre || (!email && !telefono)) {
      return NextResponse.json({ success: false, error: "Nombre y un dato de contacto (email o teléfono) son requeridos" }, { status: 400, headers: CORS });
    }

    const utm = {
      utm_source: b.utm_source ?? null, utm_medium: b.utm_medium ?? null,
      utm_campaign: b.utm_campaign ?? null, utm_content: b.utm_content ?? null, utm_term: b.utm_term ?? null,
    };
    const fuente = b.utm_source || b.fuente || "web";

    const detalle = [
      b.producto ? `Producto: ${b.producto}` : "",
      b.dimensiones ? `Medidas: ${b.dimensiones}` : "",
      b.mensaje ? `Mensaje: ${b.mensaje}` : "",
      `Origen: ${fuente}${b.utm_campaign ? ` / ${b.utm_campaign}` : ""}`,
    ].filter(Boolean).join("\n");

    // Identificar cliente por email o teléfono
    let cliente = await prisma.cliente.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(telefono ? [{ telefono }] : [])] },
      select: { id: true, notas: true },
    });

    if (cliente) {
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { notas: `${cliente.notas ? cliente.notas + "\n\n" : ""}[Lead web ${new Date().toLocaleDateString("es-CO")}]\n${detalle}` },
      });
    } else {
      cliente = await prisma.cliente.create({
        data: {
          nombre, email, telefono, ciudad: b.ciudad || null,
          estado: "INTERESADO", tipo: "persona",
          notas: `[Lead web ${new Date().toLocaleDateString("es-CO")}]\n${detalle}`,
        },
        select: { id: true, notas: true },
      });
    }

    await registrarAtribucion({ clienteId: cliente.id, nombre, fuente, ...utm, producto: b.producto ?? null, fecha: new Date().toISOString() });

    await prisma.notificacion.create({
      data: { tipo: "NEXUS_MENSAJE", titulo: "Nuevo lead web", mensaje: `${nombre} solicitó información (${fuente})` },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "¡Gracias! Te contactaremos pronto." }, { headers: CORS });
  } catch {
    return NextResponse.json({ success: false, error: "Error al enviar" }, { status: 500, headers: CORS });
  }
}
