import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { generar2FA, activar2FA, desactivar2FA, is2FAEnabled, is2FARequerido, requerir2FA } from "@/lib/twofa";

type P = { params: Promise<{ id: string }> };

// Admin/SuperAdmin pueden gestionar a cualquiera; un usuario puede gestionar el suyo.
function puedeGestionar(user: { sub: string; rol: string }, targetId: string) {
  return user.sub === targetId || ["SUPERADMIN", "ADMIN"].includes(user.rol);
}

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!puedeGestionar(user, id)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  return NextResponse.json({ success: true, data: { enabled: await is2FAEnabled(id), requerido: await is2FARequerido(id) } });
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!puedeGestionar(user, id)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { action, code } = await req.json();
  const target = await prisma.usuario.findUnique({ where: { id }, select: { email: true, nombre: true } });
  if (!target) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });

  if (action === "require") {
    await requerir2FA(id);
    await prisma.log.create({ data: { usuarioId: user.sub, accion: "AUTH_2FA_REQ", detalle: `2FA exigido a ${target.email}`, resultado: "OK" } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  if (action === "generate") {
    const { otpauth } = await generar2FA(id, target.email);
    const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 240 });
    return NextResponse.json({ success: true, data: { qr, otpauth } });
  }

  if (action === "activate") {
    if (!code) return NextResponse.json({ success: false, error: "Código requerido" }, { status: 400 });
    const ok = await activar2FA(id, String(code));
    if (!ok) return NextResponse.json({ success: false, error: "Código incorrecto. Verifica la hora de tu teléfono." }, { status: 400 });
    await prisma.log.create({ data: { usuarioId: user.sub, accion: "AUTH_2FA_ON", detalle: `2FA activado para ${target.email}`, resultado: "OK" } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  if (action === "disable") {
    await desactivar2FA(id);
    await prisma.log.create({ data: { usuarioId: user.sub, accion: "AUTH_2FA_OFF", detalle: `2FA desactivado para ${target.email}`, resultado: "OK" } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Acción inválida" }, { status: 400 });
}
