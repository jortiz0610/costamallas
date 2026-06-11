// ============================================================
// POST /api/auth/login
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";
import QRCode from "qrcode";
import { get2FA, verificar2FA, activar2FA, otpauthDe, dispositivoConfiable, recordarDispositivo } from "@/lib/twofa";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limit = rateLimit(`login:${ip}`, 10, 60_000); // 10 intentos por minuto

  if (!limit.success) {
    return NextResponse.json(
      { success: false, error: "Demasiados intentos de login. Espera un momento." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Comparación en tiempo constante para evitar timing attacks
    const passwordMatch = usuario
      ? await bcrypt.compare(password, usuario.password)
      : await bcrypt.compare(password, "$2b$12$invalidhashfortimingequalityXXXXXXX");

    if (!usuario || !passwordMatch || !usuario.activo) {
      return NextResponse.json(
        { success: false, error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    // ── Doble autenticación ──
    const tfa = await get2FA(usuario.id);
    if (tfa && (tfa.enabled || tfa.required)) {
      const setup = !tfa.enabled && tfa.required; // el usuario debe configurarlo ahora
      const confiable = tfa.enabled && (await dispositivoConfiable(usuario.id));
      if (!confiable) {
        const codigo = (body?.code ?? body?.codigo ?? "").toString().trim();
        const qrSetup = async () => {
          const otpauth = await otpauthDe(usuario.id, usuario.email);
          return otpauth ? await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) : null;
        };
        if (!codigo) {
          if (setup) {
            return NextResponse.json(
              { success: false, twoFactorSetupRequired: true, qr: await qrSetup(), error: "Configura tu doble autenticación para continuar" },
              { status: 401 }
            );
          }
          return NextResponse.json(
            { success: false, twoFactorRequired: true, error: "Ingresa el código de tu app de autenticación" },
            { status: 401 }
          );
        }
        const ok = await verificar2FA(usuario.id, codigo);
        if (!ok) {
          return NextResponse.json(
            { success: false, ...(setup ? { twoFactorSetupRequired: true, qr: await qrSetup() } : { twoFactorRequired: true }), error: "Código de verificación incorrecto" },
            { status: 401 }
          );
        }
        if (setup) await activar2FA(usuario.id, codigo); // primera vez: activa 2FA
        await recordarDispositivo(usuario.id);
      }
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol }),
      signRefreshToken(usuario.id),
    ]);

    // Guardar refresh token en BD
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        usuarioId: usuario.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    await setAuthCookies(accessToken, refreshToken);

    // Log de auditoría
    await prisma.log.create({
      data: {
        usuarioId: usuario.id,
        accion: "AUTH_LOGIN",
        resultado: "OK",
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
