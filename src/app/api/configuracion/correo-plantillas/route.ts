// ============================================================
// GET  /api/configuracion/correo-plantillas       — todas, con lo editado
// PUT  /api/configuracion/correo-plantillas       — guardar una
// POST /api/configuracion/correo-plantillas       — vista previa en vivo
//
// La vista previa es POST y no GET a propósito: el borrador viaja en el
// cuerpo, no en la URL. Un cuerpo de correo en la barra de direcciones
// se corta a los 2 000 caracteres y acaba en los logs del servidor.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import {
  getPlantillas, guardarPlantilla, previsualizar,
  getUrlCatalogo, setUrlCatalogo,
} from "@/lib/correo-plantillas-server";
import { CATEGORIAS } from "@/lib/correo-plantillas";

async function guardia(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 }) };
  if (!esAdmin(user.rol)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Solo un administrador edita las plantillas de correo." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const [plantillas, urlCatalogo] = await Promise.all([getPlantillas(), getUrlCatalogo()]);
  return NextResponse.json({
    success: true,
    data: { plantillas, categorias: CATEGORIAS, urlCatalogo },
  });
}

export async function PUT(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));

  // El PDF del catálogo se guarda por la misma puerta: es parte del
  // diseño del correo, no una configuración aparte.
  if (typeof body?.urlCatalogo === "string") {
    const v = body.urlCatalogo.trim();
    if (v && !/^https?:\/\//.test(v)) {
      return NextResponse.json(
        { success: false, error: "La dirección del catálogo tiene que empezar por http:// o https://" },
        { status: 400 },
      );
    }
    await setUrlCatalogo(v);
  }

  if (body?.clave) {
    if (typeof body.asunto === "string" && !body.asunto.trim()) {
      return NextResponse.json({ success: false, error: "El asunto no puede quedar vacío." }, { status: 400 });
    }
    if (typeof body.cuerpo === "string" && !body.cuerpo.trim()) {
      return NextResponse.json({ success: false, error: "El cuerpo no puede quedar vacío." }, { status: 400 });
    }
    try {
      await guardarPlantilla(body.clave, {
        asunto: body.asunto,
        cuerpo: body.cuerpo,
        boton: body.boton,
      });
    } catch (e) {
      return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
    }
  }

  const [plantillas, urlCatalogo] = await Promise.all([getPlantillas(), getUrlCatalogo()]);
  return NextResponse.json({ success: true, data: { plantillas, urlCatalogo } });
}

export async function POST(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const { clave, asunto, cuerpo, boton } = await req.json().catch(() => ({}));
  if (!clave) return NextResponse.json({ success: false, error: "Falta la clave" }, { status: 400 });

  try {
    const previa = await previsualizar(clave, {
      asunto: asunto ?? "",
      cuerpo: cuerpo ?? "",
      boton: boton || undefined,
    });
    return NextResponse.json({ success: true, data: previa });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
