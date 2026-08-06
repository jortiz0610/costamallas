// ============================================================
// GET  /api/configuracion/postventa   políticas y encuesta
// POST /api/configuracion/postventa
//
// Los defaults viajan en la respuesta y no se importan en el navegador:
// son varios miles de caracteres de texto legal que no tienen por qué
// estar en el bundle de todo el que abre el portal.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { getConfigPostventa, setConfigPostventa, POSTVENTA_DEFAULTS, politicasResueltas } from "@/lib/postventa";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { faltan } = await politicasResueltas();
  return NextResponse.json({
    success: true,
    data: await getConfigPostventa(),
    defaults: POSTVENTA_DEFAULTS,
    // Los huecos de contacto que quedarían sin llenar en el documento
    // publicado. Se dicen aquí para que no se descubran leyéndolo.
    faltan,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();

  // La URL de la reseña se valida: un QR impreso apuntando a una URL mal
  // escrita no se puede corregir después, ya está en cientos de papeles.
  if (b.urlResena) {
    try {
      const u = new URL(String(b.urlResena));
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      return NextResponse.json(
        { success: false, error: "El enlace de reseñas tiene que ser una URL completa (https://…)." },
        { status: 400 },
      );
    }
  }

  await setConfigPostventa({
    urlResena: b.urlResena,
    encuestaTitulo: b.encuestaTitulo,
    encuestaTexto: b.encuestaTexto,
    horario: b.horario,
    politicaEnvios: b.politicaEnvios,
    politicaDevoluciones: b.politicaDevoluciones,
    politicaDatos: b.politicaDatos,
  });

  return NextResponse.json({ success: true, data: await getConfigPostventa() });
}
