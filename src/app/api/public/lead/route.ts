import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entrarPorLaWeb } from "@/lib/nexus/entrada-web";
import { recalcularCliente } from "@/lib/estados-cliente-server";

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

    // El lead entra al INBOX, no solo a la base. Antes esto creaba el
    // cliente y dejaba una notificación suelta: la solicitud no aparecía
    // en Nexus, así que nadie la contestaba desde el portal — quedaba
    // como una fila con una nota esperando a que alguien la encontrara.
    //
    // Si falla, el lead NO se pierde: ya está guardado como cliente y con
    // su atribución. Se registra el error y se sigue.
    let conversacionId: string | null = null;
    try {
      const etiquetas = [
        b.producto ? `producto:${String(b.producto).slice(0, 40)}` : "",
        b.ciudad ? `ciudad:${String(b.ciudad).slice(0, 30)}` : "",
        `origen:${String(fuente).slice(0, 30)}`,
      ].filter(Boolean);

      const r = await entrarPorLaWeb({
        clienteId: cliente.id,
        nombre,
        email,
        telefono,
        asunto: b.producto ? `Consulta por ${b.producto}` : "Solicitud desde la página web",
        mensaje: detalle,
        etiquetas,
      });
      conversacionId = r.conversacionId;
    } catch (e) {
      console.error("[public/lead] no se pudo abrir la conversación", e);
    }

    // Pedir información cuenta como interacción: deja el estado del
    // cliente al día sin esperar a la corrida de mañana.
    await recalcularCliente(cliente.id);

    await prisma.notificacion.create({
      data: {
        tipo: "NEXUS_MENSAJE",
        titulo: "Nuevo lead web",
        mensaje: `${nombre} solicitó información (${fuente}). Está en el inbox.`,
        data: conversacionId ? { conversacionId } : undefined,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "¡Gracias! Te contactaremos pronto." }, { headers: CORS });
  } catch {
    return NextResponse.json({ success: false, error: "Error al enviar" }, { status: 500, headers: CORS });
  }
}
