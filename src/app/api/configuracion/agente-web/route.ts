// ============================================================
// GET/POST /api/configuracion/agente-web
//
// El agente atiende a clientes en la web pública a nombre de la
// empresa y gasta dinero en cada mensaje: encenderlo y ajustarlo es
// cosa del superadministrador, igual que el resto de conexiones
// externas y que el lote de SEO.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import {
  getConfigAgenteWeb, setConfigAgenteWeb, gastoDeHoy, AGENTE_WEB_DEFAULTS,
} from "@/lib/agente-web/config";
import { estadoCredencial } from "@/lib/sembli/agente";
import { prisma } from "@/lib/prisma";
import { urlPortal } from "@/lib/url-portal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esSuperadmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo el superadministrador" }, { status: 403 });
  }

  const [cfg, gasto, credencial, conversaciones] = await Promise.all([
    getConfigAgenteWeb(),
    gastoDeHoy(),
    estadoCredencial(),
    prisma.nexusConversacion.count({ where: { canal: "WEB" } }),
  ]);

  return NextResponse.json({
    success: true,
    data: cfg,
    defaults: AGENTE_WEB_DEFAULTS,
    estado: {
      gastoHoyUSD: gasto,
      iaConfigurada: credencial.origen !== "ninguno",
      conversaciones,
      // Lo que hay que pegar en WordPress. Se devuelve armado para que
      // nadie tenga que componer la URL a mano — y con `urlPortal`, no
      // con NEXT_PUBLIC_APP_URL, que apunta a la tienda y hacía que el
      // <script> que se copiaba señalara al sitio equivocado.
      embed: `<script src="${urlPortal(req)}/api/public/agente/widget.js" defer></script>`,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esSuperadmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo el superadministrador" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));

  const num = (v: unknown, min: number, max: number): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return NaN; // señal de error
    return n;
  };

  const topeDia = num(b.topeDiarioUSD, 0.1, 500);
  const topeConv = num(b.topeConversacionUSD, 0.01, 20);
  const maxMsj = num(b.maxMensajes, 4, 200);
  if ([topeDia, topeConv, maxMsj].some(v => Number.isNaN(v))) {
    return NextResponse.json(
      { success: false, error: "Los topes están fuera de rango: revisa el gasto diario, el de la conversación y el máximo de mensajes." },
      { status: 400 },
    );
  }

  // Los dominios se guardan sin la barra final para poder compararlos
  // con el header Origin, que nunca la trae.
  const dominios = Array.isArray(b.dominios)
    ? b.dominios.map((d: unknown) => String(d).trim().replace(/\/$/, "")).filter(Boolean)
    : undefined;

  await setConfigAgenteWeb({
    activo: typeof b.activo === "boolean" ? b.activo : undefined,
    nombre: b.nombre !== undefined ? String(b.nombre).slice(0, 40) : undefined,
    saludo: b.saludo !== undefined ? String(b.saludo).slice(0, 600) : undefined,
    modelo: b.modelo === "claude-haiku-4-5" || b.modelo === "claude-sonnet-5" ? b.modelo : undefined,
    topeDiarioUSD: topeDia,
    topeConversacionUSD: topeConv,
    maxMensajes: maxMsj,
    whatsapp: b.whatsapp !== undefined ? String(b.whatsapp).slice(0, 30) : undefined,
    dominios,
  });

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "CONFIG_AGENTE_WEB",
        detalle: typeof b.activo === "boolean" ? (b.activo ? "encendido" : "apagado") : "ajustes",
        resultado: "OK",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ success: true, data: await getConfigAgenteWeb() });
}
