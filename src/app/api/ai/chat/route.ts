import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getAIConfig, chatAI } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { pregunta } = await req.json();
  if (!pregunta?.trim()) return NextResponse.json({ success: false, error: "Pregunta vacía" }, { status: 400 });

  const cfg = await getAIConfig();
  if (!cfg) return NextResponse.json({ success: false, sinClave: true, error: "IA no configurada" });

  // Contexto del negocio (resumen ligero)
  const [clientes, productos, sinImagen, cotizaciones, pedidos, tareas, stockCritico] = await Promise.all([
    prisma.cliente.count(),
    prisma.producto.count(),
    prisma.producto.count({ where: { imagenes: { none: {} } } }),
    prisma.cotizacion.count(),
    prisma.pedido.count({ where: { estado: { not: "CANCELADO" } } }),
    prisma.tarea.count({ where: { estado: "PENDIENTE" } }),
    prisma.producto.count({ where: { stock: { lte: 5 } } }),
  ]);

  const system = [
    "Eres el asistente de IA de Costamallas, una empresa colombiana que fabrica y vende mallas (metálicas, nylon, plásticas, para balcones, seguridad perimetral) con servicio de instalación.",
    "Respondes en español, de forma breve, clara y accionable. Eres un ERP/CRM/Marketing.",
    "Datos actuales del sistema:",
    `- Clientes: ${clientes}`,
    `- Productos: ${productos} (sin imagen: ${sinImagen}, stock crítico: ${stockCritico})`,
    `- Cotizaciones: ${cotizaciones}`,
    `- Pedidos activos: ${pedidos}`,
    `- Tareas pendientes: ${tareas}`,
    "Si te piden algo que requiere datos que no tienes, dilo y sugiere dónde verlo en el sistema (módulos: ERP, CRM, Nexus, Marketing).",
  ].join("\n");

  try {
    const respuesta = await chatAI(system, pregunta, cfg);
    return NextResponse.json({ success: true, data: { respuesta } });
  } catch (e) {
    return NextResponse.json({ success: false, error: `Error de IA: ${(e as Error).message}` }, { status: 500 });
  }
}
