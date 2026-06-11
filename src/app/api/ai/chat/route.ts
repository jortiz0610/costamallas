import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getAIConfig, chatAI } from "@/lib/ai";
import { esAdmin } from "@/lib/permisos";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { pregunta } = await req.json();
  if (!pregunta?.trim()) return NextResponse.json({ success: false, error: "Pregunta vacía" }, { status: 400 });

  const cfg = await getAIConfig();
  if (!cfg) return NextResponse.json({ success: false, sinClave: true, error: "IA no configurada" });

  const admin = esAdmin(user.rol);
  const baseSystem = "Eres el asistente de IA de Costamallas, empresa colombiana que fabrica y vende mallas (metálicas, nylon, plásticas, para balcones, seguridad perimetral) con servicio de instalación. Respondes en español, breve, claro y accionable.";

  let system: string;
  if (admin) {
    // Admins: contexto amplio del negocio
    const [clientes, productos, sinImagen, cotizaciones, pedidos, tareas, stockCritico] = await Promise.all([
      prisma.cliente.count(),
      prisma.producto.count(),
      prisma.producto.count({ where: { imagenes: { none: {} } } }),
      prisma.cotizacion.count(),
      prisma.pedido.count({ where: { estado: { not: "CANCELADO" } } }),
      prisma.tarea.count({ where: { estado: "PENDIENTE" } }),
      prisma.producto.count({ where: { stock: { lte: 5 } } }),
    ]);
    system = [
      baseSystem,
      "Datos actuales del sistema (visible para administradores):",
      `- Clientes: ${clientes}`,
      `- Productos: ${productos} (sin imagen: ${sinImagen}, stock crítico: ${stockCritico})`,
      `- Cotizaciones: ${cotizaciones} · Pedidos activos: ${pedidos} · Tareas pendientes: ${tareas}`,
      "Si piden datos que no tienes, indica dónde verlos (ERP, CRM, Nexus, Growth).",
    ].join("\n");
  } else {
    // Roles no-admin: sin cifras globales del negocio
    system = [
      baseSystem,
      `El usuario tiene rol ${user.rol} con acceso limitado. NO reveles cifras globales de ventas, finanzas, ni datos de toda la base.`,
      "Ayuda solo con su trabajo operativo (cómo usar el sistema, sus propias tareas/clientes/cotizaciones) y dudas de producto. Si piden información sensible o global, indica amablemente que no tienes permiso para ese dato.",
    ].join("\n");
  }

  try {
    const respuesta = await chatAI(system, pregunta, cfg);
    return NextResponse.json({ success: true, data: { respuesta } });
  } catch (e) {
    return NextResponse.json({ success: false, error: `Error de IA: ${(e as Error).message}` }, { status: 500 });
  }
}
