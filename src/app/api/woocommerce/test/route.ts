// POST /api/woocommerce/test — Verificar conexión con WooCommerce

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/lib/auth";
import { getWCCredentials, testWCConnection } from "@/lib/woocommerce";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  storeUrl: z.string().url("URL de tienda inválida"),
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
  guardar: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: "Solo Admin" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { storeUrl, consumerKey, consumerSecret, guardar } = parsed.data;
    const result = await testWCConnection({ storeUrl, consumerKey, consumerSecret });

    if (guardar && result.ok) {
      // Guardar credenciales cifradas en BD
      const upsert = async (clave: string, valor: string, encrypted: boolean) =>
        prisma.configuracion.upsert({
          where: { clave },
          update: { valor, encrypted },
          create: { clave, valor, encrypted },
        });

      await Promise.all([
        upsert("wc_store_url", storeUrl, false),
        upsert("wc_consumer_key", encrypt(consumerKey), true),
        upsert("wc_consumer_secret", encrypt(consumerSecret), true),
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

  const creds = await getWCCredentials();
  if (!creds) return NextResponse.json({ success: true, data: { configured: false } });

  try {
    const result = await testWCConnection(creds);
    return NextResponse.json({ success: true, data: { configured: true, ...result } });
  } catch (err) {
    return NextResponse.json({
      success: true,
      data: { configured: true, ok: false, error: err instanceof Error ? err.message : "Error" },
    });
  }
}
