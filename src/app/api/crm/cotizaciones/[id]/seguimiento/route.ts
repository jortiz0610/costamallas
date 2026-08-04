// ============================================================
// GET/POST /api/crm/cotizaciones/[id]/seguimiento
//
// El estado de los tres toques de una oferta y las acciones sobre ellos.
// GET calcula cuándo toca cada uno aunque todavía no exista el registro:
// el asesor tiene que poder ver la agenda antes de que pase nada, no
// solo el rastro de lo que ya ocurrió.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { correoConfigurado } from "@/lib/correo";
import {
  getConfigSeguimiento, dispararToque, marcarToque2Hecho, venceEl,
} from "@/lib/seguimiento";

type P = { params: Promise<{ id: string }> };

const HORA = 3_600_000;
const DIA = 86_400_000;

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const cot = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true, numero: true, estado: true, createdAt: true, validezDias: true,
      enviadaEn: true, seguimientoActivo: true, vistas: true, vistaPrimeraEn: true,
      cliente: { select: { nombre: true, email: true, telefono: true, whatsapp: true } },
      seguimientos: { orderBy: { toque: "asc" } },
    },
  });
  if (!cot) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });

  const cfg = await getConfigSeguimiento();
  const enviada = cot.enviadaEn?.getTime() ?? null;
  const vence = venceEl(cot);
  const reg = new Map(cot.seguimientos.map(s => [s.toque, s]));

  // La agenda prevista. Sin `enviadaEn` no hay reloj: el seguimiento
  // arranca cuando la oferta sale, no cuando se crea el borrador.
  const previsto = (t: 1 | 2 | 3): Date | null => {
    if (enviada === null) return null;
    if (t === 1) return new Date(enviada + cfg.t1Horas * HORA);
    if (t === 2) return new Date(enviada + cfg.t2Horas * HORA);
    return new Date(vence.getTime() - cfg.t3DiasAntes * DIA);
  };

  const toques = ([1, 2, 3] as const).map(t => {
    const r = reg.get(t);
    return {
      toque: t,
      automatico: t !== 2,
      programadoPara: r?.programadoPara ?? previsto(t),
      estado: r?.estado ?? (enviada === null ? "SIN_ENVIAR" : "PROGRAMADO"),
      canal: r?.canal ?? (t === 2 ? "TAREA" : "EMAIL"),
      ejecutadoEn: r?.ejecutadoEn ?? null,
      destino: r?.destino ?? null,
      mensaje: r?.mensaje ?? null,
      error: r?.error ?? null,
      tareaId: r?.tareaId ?? null,
      alertaEnviadaEn: r?.alertaEnviadaEn ?? null,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      activo: cot.seguimientoActivo,
      enviadaEn: cot.enviadaEn,
      venceEl: vence,
      vencida: vence.getTime() < Date.now(),
      vistas: cot.vistas,
      vistaPrimeraEn: cot.vistaPrimeraEn,
      clienteTieneCorreo: Boolean(cot.cliente.email),
      toques,
      config: {
        activoGlobal: cfg.activo,
        t1Horas: cfg.t1Horas,
        t2Horas: cfg.t2Horas,
        t2LimiteHoras: cfg.t2LimiteHoras,
        t3DiasAntes: cfg.t3DiasAntes,
        porWhatsapp: cfg.porWhatsapp,
      },
      // Lo que falta para que esto funcione de verdad. Se dice en
      // pantalla en vez de dejar que el asesor lo descubra al fallar.
      listo: {
        correo: await correoConfigurado(),
        whatsapp: false, // pendiente de la aprobación de Meta
      },
    },
  });
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const accion = String(body.accion ?? "");

  switch (accion) {
    case "apagar":
    case "encender": {
      await prisma.cotizacion.update({
        where: { id },
        data: { seguimientoActivo: accion === "encender" },
      });
      await prisma.log.create({
        data: {
          usuarioId: user.sub,
          accion: "COTIZACION_SEGUIMIENTO",
          detalle: `${id} → ${accion === "encender" ? "activado" : "apagado"}`,
          resultado: "OK",
        },
      }).catch(() => undefined);
      return NextResponse.json({
        success: true,
        mensaje: accion === "encender"
          ? "Seguimiento activado para esta oferta"
          : "Seguimiento apagado: no se le manda nada más al cliente por esta oferta",
      });
    }

    case "enviar": {
      const toque = Number(body.toque);
      if (toque !== 1 && toque !== 3) {
        return NextResponse.json(
          { success: false, error: "Solo los toques 1 y 3 los manda el sistema. El 2 lo hace una persona." },
          { status: 400 },
        );
      }
      const r = await dispararToque(id, toque);
      const ok = r.estado === "ENVIADO";
      return NextResponse.json(
        { success: ok, mensaje: r.detalle, error: ok ? undefined : r.detalle, data: r },
        { status: ok ? 200 : 400 },
      );
    }

    case "marcar-hecho": {
      const r = await marcarToque2Hecho(id, String(body.nota ?? "").trim());
      const ok = r.estado === "HECHO";
      return NextResponse.json(
        { success: ok, mensaje: r.detalle, error: ok ? undefined : r.detalle },
        { status: ok ? 200 : 400 },
      );
    }

    default:
      return NextResponse.json({ success: false, error: "Acción desconocida" }, { status: 400 });
  }
}
