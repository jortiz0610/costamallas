// ============================================================
// Configuración de correo (SMTP)
//   GET    /api/configuracion/correo   estado, sin la contraseña
//   POST   /api/configuracion/correo   guarda y/o prueba la conexión
//   DELETE /api/configuracion/correo   borra las credenciales
//
// Es la pantalla que faltaba para que el módulo de compras pueda
// mandarle órdenes a los proveedores y facturación pueda cobrar.
//
// ⚠️ Estas credenciales deben cargarse EN PRODUCCIÓN desde el portal:
// la contraseña se cifra con la ENCRYPTION_KEY del entorno y la de local
// no es la misma que la de Vercel.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import {
  borrarConfigCorreo, estadoCorreo, probarCorreo, setConfigCorreo,
} from "@/lib/correo";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  return NextResponse.json({ success: true, data: await estadoCorreo() });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  const puerto = b.puerto != null && String(b.puerto) !== "" ? Number(b.puerto) : undefined;

  if (puerto != null && (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)) {
    return NextResponse.json({ success: false, error: "El puerto no es válido" }, { status: 400 });
  }

  // Se prueba con lo que el usuario acaba de escribir. Si no manda
  // contraseña se usa la guardada, para poder corregir el host o el
  // puerto sin volver a teclearla.
  const resultado = await probarCorreo({
    host: b.host?.trim(),
    puerto,
    seguro: typeof b.seguro === "boolean" ? b.seguro : undefined,
    usuario: b.usuario?.trim(),
    password: b.password || undefined,
    remitenteNombre: b.remitenteNombre?.trim(),
    remitenteEmail: b.remitenteEmail?.trim(),
  });

  // Guardar solo si la conexión sirvió: unas credenciales que no
  // conectan guardadas "por si acaso" solo sirven para que el envío
  // falle después, lejos de esta pantalla.
  if (b.guardar) {
    if (!resultado.ok) {
      return NextResponse.json(
        { success: false, error: `No se guardó: ${resultado.mensaje}`, prueba: resultado },
        { status: 400 },
      );
    }
    await setConfigCorreo({
      smtp_host: b.host?.trim(),
      smtp_port: puerto != null ? String(puerto) : undefined,
      smtp_secure: typeof b.seguro === "boolean" ? String(b.seguro) : undefined,
      smtp_user: b.usuario?.trim(),
      smtp_password: b.password || undefined,
      smtp_from_name: b.remitenteNombre?.trim(),
      smtp_from_email: b.remitenteEmail?.trim(),
    });
    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "CONFIG_CORREO_GUARDADA",
          detalle: `${b.host} · ${b.usuario}`,
          resultado: "OK",
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    success: resultado.ok,
    mensaje: resultado.mensaje,
    guardado: Boolean(b.guardar) && resultado.ok,
    error: resultado.ok ? undefined : resultado.mensaje,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  await borrarConfigCorreo();
  return NextResponse.json({ success: true });
}
