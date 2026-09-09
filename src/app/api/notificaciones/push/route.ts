// ============================================================
// La suscripción del navegador a los avisos.
//
//   GET    → la clave pública y si el push está disponible
//   POST   → guarda la suscripción de ESTE navegador
//   DELETE → la quita
//
// La clave pública se sirve desde aquí y no como variable
// NEXT_PUBLIC_*: así rotarla no obliga a reconstruir la imagen ni a
// desplegar. Es pública por definición —el navegador la necesita para
// suscribirse— y no protege nada por sí sola: lo que autoriza el envío
// es la privada, que no sale del servidor.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { clavePublicaPush, pushConfigurado, guardarSuscripcion, borrarSuscripcion } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  return NextResponse.json({
    success: true,
    data: {
      disponible: pushConfigurado(),
      clavePublica: clavePublicaPush(),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  if (!pushConfigurado()) {
    return NextResponse.json(
      { success: false, error: "Los avisos con la app cerrada no están configurados en este servidor." },
      { status: 503 },
    );
  }

  const b = await req.json().catch(() => ({}));
  const endpoint = String(b?.endpoint ?? "").trim();
  const p256dh = String(b?.keys?.p256dh ?? "").trim();
  const auth = String(b?.keys?.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { success: false, error: "La suscripción llegó incompleta." },
      { status: 400 },
    );
  }
  // Un endpoint es una URL del servicio de push del navegador. Si no lo
  // es, no hay nada que guardar y sí algo que sospechar.
  if (!/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ success: false, error: "El endpoint no es válido." }, { status: 400 });
  }

  await guardarSuscripcion({
    usuarioId: user.sub,
    endpoint,
    p256dh,
    auth,
    agente: req.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const endpoint = String(b?.endpoint ?? "").trim();
  if (!endpoint) return NextResponse.json({ success: false, error: "Falta el endpoint." }, { status: 400 });

  // No se comprueba de quién es: darse de baja de un aparato que uno
  // tiene en la mano no necesita permiso, y exigirlo solo conseguiría
  // que alguien se quedara recibiendo avisos que ya no quiere.
  await borrarSuscripcion(endpoint);
  return NextResponse.json({ success: true });
}
