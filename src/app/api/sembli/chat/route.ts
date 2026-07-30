// ============================================================
// POST /api/sembli/chat — conversación con el agente Sembli
//
// El nivel de acceso se deriva SIEMPRE del JWT del servidor, nunca de
// nada que mande el cliente. Un usuario no puede pedir "responde como
// admin": el rol viene del token y el filtrado ocurre en las
// herramientas.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { conversarConSembli, estadoCredencial, type TurnoChat } from "@/lib/sembli/agente";
import { esAdmin } from "@/lib/permisos";
import { nivelDeRol, type Solicitante } from "@/lib/sembli/alcance";
import { herramientasPara } from "@/lib/sembli/herramientas";

/** Tope de turnos que aceptamos del cliente, para acotar el prompt. */
const MAX_TURNOS = 20;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  let cuerpo: { mensaje?: string; historial?: TurnoChat[]; contexto?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const mensaje = (cuerpo.mensaje ?? "").trim();
  if (!mensaje) {
    return NextResponse.json({ success: false, error: "El mensaje está vacío" }, { status: 400 });
  }
  if (mensaje.length > 4000) {
    return NextResponse.json(
      { success: false, error: "El mensaje es demasiado largo (máx. 4000 caracteres)" },
      { status: 400 },
    );
  }

  // El rol sale del token; clienteId se lee de la BD (no del cliente).
  const nivel = nivelDeRol(user.rol);
  let clienteId: string | null = null;
  if (nivel === "CLIENTE") {
    const fila = await prisma.usuario.findUnique({
      where: { id: user.sub },
      select: { clienteId: true },
    });
    clienteId = fila?.clienteId ?? null;
  }

  const quien: Solicitante = {
    usuarioId: user.sub,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    nivel,
    clienteId,
  };

  // Solo se conservan los últimos turnos y se descarta cualquier campo
  // extra que venga del navegador.
  const historial: TurnoChat[] = (cuerpo.historial ?? [])
    .filter((t) => (t?.rol === "user" || t?.rol === "assistant") && typeof t.texto === "string")
    .slice(-MAX_TURNOS)
    .map((t) => ({ rol: t.rol, texto: t.texto.slice(0, 4000) }));
  historial.push({ rol: "user", texto: mensaje });

  try {
    const salida = await conversarConSembli({
      quien,
      historial,
      contextoPantalla: typeof cuerpo.contexto === "string" ? cuerpo.contexto.slice(0, 500) : undefined,
    });

    // Auditoría del consumo, para poder revisar el gasto luego.
    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "SEMBLI_CHAT",
          detalle: mensaje.slice(0, 500),
          resultado: `nivel=${nivel} modelo=${salida.modelo} tools=${salida.herramientasUsadas.join(",") || "-"} usd=${salida.uso.costoUSD.toFixed(5)}`,
          metadata: { uso: salida.uso, herramientas: salida.herramientasUsadas },
        },
      })
      .catch(() => undefined); // el registro nunca debe tumbar la respuesta

    return NextResponse.json({
      success: true,
      data: {
        respuesta: salida.respuesta,
        herramientasUsadas: salida.herramientasUsadas,
        nivel,
      },
    });
  } catch (e) {
    const mensajeError = (e as Error).message;
    const sinClave = mensajeError.includes("API key");
    return NextResponse.json(
      { success: false, sinClave, error: mensajeError },
      { status: sinClave ? 200 : 500 },
    );
  }
}

/** GET — qué puede hacer Sembli para este usuario (para pintar sugerencias). */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }
  const nivel = nivelDeRol(user.rol);
  return NextResponse.json({
    success: true,
    data: {
      nivel,
      capacidades: herramientasPara(nivel).map((h) => ({
        nombre: h.nombre,
        descripcion: h.descripcion,
      })),
      sugerencias: SUGERENCIAS[nivel],
      // Diagnóstico solo para admins: de dónde sale la credencial y si
      // descifra bien en ESTE entorno. Nunca incluye el valor de la key.
      ...(esAdmin(user.rol) ? { credencial: await estadoCredencial() } : {}),
    },
  });
}

const SUGERENCIAS: Record<string, string[]> = {
  CLIENTE: [
    "¿Qué mallas tienen para balcones?",
    "¿Cómo va mi pedido?",
    "¿Hacen instalación en mi ciudad?",
    "¿Qué garantía tiene la malla de nylon?",
  ],
  VENDEDOR: [
    "¿Qué productos están por debajo del stock mínimo?",
    "Muéstrame las cotizaciones de los últimos 15 días",
    "¿Qué pedidos están pendientes de entrega?",
    "Busca clientes de Barranquilla en estado COTIZADO",
  ],
  ADMIN: [
    "Dame los KPIs del último mes",
    "¿Cuánta cartera tenemos pendiente?",
    "¿Qué proveedores tenemos y qué órdenes están abiertas?",
    "¿Cuál es la conversión de cotizaciones a pedidos?",
  ],
  SUPERADMIN: [
    "¿Qué integraciones están configuradas y cuáles faltan?",
    "Muéstrame los errores abiertos del sistema",
    "Dame los KPIs y el estado de las conexiones de Nexus",
    "¿Cuántos usuarios hay por rol?",
  ],
};
