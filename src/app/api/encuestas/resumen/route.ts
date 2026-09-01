// ============================================================
// GET /api/encuestas/resumen — los resultados de la encuesta
//
// Devuelve el resumen (NPS, promedios, tasa de respuesta) y la lista de
// respuestas en la misma llamada: la pantalla las muestra a la vez, y
// separarlas solo servía para que una llegara antes que la otra.
//
// Lo protege `crm.postventa`, el mismo permiso que la tarjeta con el QR:
// quien manda la encuesta es quien tiene que poder leer lo que contestan.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { resumenEncuestas, ultimasRespuestas, TODAS_LAS_PREGUNTAS } from "@/lib/encuesta";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.postventa");
  if (sinPermiso) return sinPermiso;

  // ?dias=90 acota a los últimos meses. Sin parámetro, todo: con pocas
  // respuestas, recortar por fecha deja la pantalla vacía y parece rota.
  const dias = Number(new URL(req.url).searchParams.get("dias") ?? "0");
  const desde = dias > 0 ? new Date(Date.now() - dias * 86_400_000) : undefined;

  const [resumen, respuestas] = await Promise.all([
    resumenEncuestas(desde),
    ultimasRespuestas(120),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      resumen,
      respuestas,
      // Las etiquetas viajan con los datos para que la pantalla no repita
      // los textos de las preguntas y se desincronicen.
      preguntas: TODAS_LAS_PREGUNTAS.map(p => ({ campo: p.campo, texto: p.texto })),
    },
  });
}
