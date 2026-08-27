// ============================================================
// POST /api/public/agente — el agente que atiende en costamallas.com
// GET  /api/public/agente — cómo saludar y si está encendido
//
// Es PÚBLICO: lo llama el navegador de cualquiera que entre a la
// tienda. Eso obliga a tres cosas que no son opcionales:
//
//  1. CORS solo desde los dominios configurados. Sin esto, cualquier
//     página del mundo puede usar la API de Costamallas de juguete.
//  2. Límite por IP. La primera línea contra quien encuentre la URL.
//  3. Topes de gasto (dentro del motor). Un endpoint público que llama
//     a Claude sin tope es una factura esperando.
//
// No requiere sesión a propósito, igual que /api/public/lead: quien
// escribe es un visitante que todavía no es cliente.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { responder } from "@/lib/agente-web";
import { getConfigAgenteWeb } from "@/lib/agente-web/config";
import { getMarca } from "@/lib/marca";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Solo los dominios configurados. `*` sería abrir la API a todo el mundo. */
async function cors(req: NextRequest): Promise<Record<string, string>> {
  const cfg = await getConfigAgenteWeb();
  const origen = req.headers.get("origin") ?? "";
  const permitido = cfg.dominios.some(d => d.trim() && origen === d.trim().replace(/\/$/, ""));

  return {
    ...(permitido ? { "Access-Control-Allow-Origin": origen } : {}),
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: await cors(req) });
}

export async function GET(req: NextRequest) {
  const [cfg, marca] = await Promise.all([getConfigAgenteWeb(), getMarca()]);
  return NextResponse.json(
    {
      success: true,
      data: {
        activo: cfg.activo,
        nombre: cfg.nombre,
        saludo: cfg.saludo,
        empresa: marca.companyName,
        color: marca.brandColor,
        whatsapp: cfg.whatsapp,
      },
    },
    { headers: await cors(req) },
  );
}

export async function POST(req: NextRequest) {
  const headers = await cors(req);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "desconocida";

  // 20 mensajes por minuto y por IP. Una persona escribiendo de verdad
  // no llega ni a la mitad; un script lo pasa en dos segundos.
  const limite = rateLimit(`agente-web:${ip}`, 20, 60_000);
  if (!limite.success) {
    return NextResponse.json(
      { success: false, error: "Va muy rápido. Espere un momento y vuelva a escribir." },
      { status: 429, headers },
    );
  }

  const body = await req.json().catch(() => ({}));
  const mensaje = String(body.mensaje ?? "").trim();
  const token = body.token ? String(body.token) : null;

  if (!mensaje) {
    return NextResponse.json({ success: false, error: "Escriba su pregunta." }, { status: 400, headers });
  }
  // Tope de largo: nadie escribe 2000 caracteres en un chat, pero sí se
  // pegan documentos enteros para hacer gastar tokens.
  if (mensaje.length > 1500) {
    return NextResponse.json(
      { success: false, error: "El mensaje es muy largo. Cuéntenos en pocas líneas qué necesita." },
      { status: 400, headers },
    );
  }

  const r = await responder({ mensaje, token });

  return NextResponse.json(
    {
      success: r.ok,
      data: { texto: r.texto, token: r.token, escalado: r.escalado, motivo: r.motivo },
    },
    { headers },
  );
}
