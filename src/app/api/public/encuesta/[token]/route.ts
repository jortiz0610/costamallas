// ============================================================
// GET  /api/public/encuesta/[token] — ¿esta encuesta sigue abierta?
// POST /api/public/encuesta/[token] — guardar la respuesta
//
// Pública a propósito: la contesta el cliente, que no tiene cuenta. El
// token es largo y aleatorio, así que no se llega a la de otro cambiando
// un número.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardarRespuesta, type RespuestaEncuesta } from "@/lib/encuesta";

type P = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { token } = await params;
  const e = await prisma.encuestaSatisfaccion.findUnique({
    where: { token },
    select: {
      respondidaEn: true,
      cliente: { select: { nombre: true, empresa: true } },
      instalacion: { select: { pedido: { select: { numero: true } } } },
    },
  });
  if (!e) return NextResponse.json({ success: false, error: "no-existe" }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: {
      yaRespondida: Boolean(e.respondidaEn),
      cliente: e.cliente?.empresa || e.cliente?.nombre || null,
      pedido: e.instalacion?.pedido?.numero ?? null,
    },
  });
}

export async function POST(req: NextRequest, { params }: P) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as RespuestaEncuesta;

  const r = await guardarRespuesta(token, body);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });

  return NextResponse.json({ success: true });
}
