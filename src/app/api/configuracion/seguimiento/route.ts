// ============================================================
// GET  /api/configuracion/seguimiento   parámetros y textos de los 3 toques
// POST /api/configuracion/seguimiento   guarda lo que venga
//
// No hay nada secreto: son los correos que va a recibir el cliente. Pero
// editarlos es cosa de administración, porque es lo que la empresa dice
// en su nombre sin que nadie lo revise antes de salir.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { getConfigSeguimiento, setConfigSeguimiento, SEGUIMIENTO_DEFAULTS } from "@/lib/seguimiento";
import { correoConfigurado } from "@/lib/correo";
import { MARCADORES } from "@/lib/seguimiento-textos";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  return NextResponse.json({
    success: true,
    data: await getConfigSeguimiento(),
    defaults: SEGUIMIENTO_DEFAULTS,
    marcadores: MARCADORES,
    listo: { correo: await correoConfigurado(), whatsapp: false },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();

  const entero = (v: unknown, min: number, max: number, nombre: string): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new Error(`${nombre} debe ir entre ${min} y ${max}`);
    }
    return n;
  };

  try {
    const t1Horas = entero(b.t1Horas, 1, 168, "El toque 1");
    const t2Horas = entero(b.t2Horas, 1, 336, "El toque 2");
    const t2LimiteHoras = entero(b.t2LimiteHoras, 1, 336, "El plazo del toque 2");
    const t3DiasAntes = entero(b.t3DiasAntes, 1, 30, "El toque 3");

    // El plazo para hacer la llamada no puede vencer antes de que la
    // tarea exista: sería una alerta a gerencia por algo imposible.
    const h2 = t2Horas ?? (await getConfigSeguimiento()).t2Horas;
    if (t2LimiteHoras != null && t2LimiteHoras <= h2) {
      return NextResponse.json(
        { success: false, error: "El plazo del toque 2 tiene que ser mayor que la hora en que se crea la tarea." },
        { status: 400 },
      );
    }

    await setConfigSeguimiento({
      activo: typeof b.activo === "boolean" ? b.activo : undefined,
      porWhatsapp: typeof b.porWhatsapp === "boolean" ? b.porWhatsapp : undefined,
      t1Horas, t2Horas, t2LimiteHoras, t3DiasAntes,
      t1Asunto: b.t1Asunto, t1Cuerpo: b.t1Cuerpo, t1Whatsapp: b.t1Whatsapp,
      t2Titulo: b.t2Titulo, t2Guion: b.t2Guion,
      t3Asunto: b.t3Asunto, t3Cuerpo: b.t3Cuerpo, t3Whatsapp: b.t3Whatsapp,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await getConfigSeguimiento() });
}
