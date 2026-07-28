// POST /api/wordpress/test — Verificar/guardar credenciales de WordPress
// GET  /api/wordpress/test — Estado de la conexión

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getWPCredentials, testWPConnection } from "@/lib/wordpress";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  siteUrl: z.string().url("URL inválida").default("https://costamallas.com"),
  user: z.string().min(1, "Usuario requerido"),
  appPassword: z.string().min(1, "Application Password requerido"),
  guardar: z.boolean().default(false),
});

function esAdmin(rol: string) {
  return rol === "ADMIN" || rol === "SUPERADMIN";
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Solo Admin" }, { status: 403 });

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }
    const { siteUrl, user: wpUser, appPassword, guardar } = parsed.data;
    const cleanUrl = siteUrl.replace(/\/$/, "");

    // Las Application Passwords se muestran con espacios; WP los ignora al validar.
    const result = await testWPConnection({ siteUrl: cleanUrl, user: wpUser, appPassword: appPassword.trim() });

    if (guardar && result.ok) {
      const upsert = (clave: string, valor: string, encrypted: boolean) =>
        prisma.configuracion.upsert({
          where: { clave },
          update: { valor, encrypted },
          create: { clave, valor, encrypted },
        });
      await Promise.all([
        upsert("wp_site_url", cleanUrl, false),
        upsert("wp_user", wpUser, false),
        upsert("wp_app_password", encrypt(appPassword.trim()), true),
      ]);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error de conexión" },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const creds = await getWPCredentials();
  if (!creds) return NextResponse.json({ success: true, data: { configured: false } });

  try {
    const result = await testWPConnection(creds);
    return NextResponse.json({ success: true, data: { configured: true, siteUrl: creds.siteUrl, ...result } });
  } catch (err) {
    return NextResponse.json({
      success: true,
      data: { configured: true, ok: false, siteUrl: creds.siteUrl, error: err instanceof Error ? err.message : "Error" },
    });
  }
}
