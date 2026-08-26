// ============================================================
// GET/POST /api/mantenimiento/imagenes-ftp
//
// Rescata las imágenes que se subieron por FTP y que ninguna URL sirve:
// las baja del disco, las sube a la biblioteca de WordPress y corrige la
// dirección guardada.
//
// ?dry=1 → dice qué haría y cuánto pesa cada archivo, sin tocar nada.
//
// Corre EN PRODUCCIÓN por obligación, no por comodidad: las credenciales
// de WordPress están cifradas con la ENCRYPTION_KEY de producción, que
// no es la de local. Desde un PC no se pueden descifrar.
//
// NO es un cron de Vercel: el plan Hobby permite dos y los dos cupos
// están usados. Se dispara a mano —desde el portal o con el
// CRON_SECRET— porque además es una limpieza de una vez, no algo que
// tenga que correr todos los días.
//
// La autorización es la misma que la de /api/cron/diario: administrador
// con sesión, o `Authorization: Bearer <CRON_SECRET>`.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { rescatarImagenesFTP } from "@/lib/rescate-imagenes";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function autorizado(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  const user = await getUserFromRequest(req);
  return !!user && esAdmin(user.rol);
}

async function handle(req: NextRequest) {
  if (!(await autorizado(req))) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  // El GET nunca escribe: entrar a mirar no puede mover imágenes de
  // sitio. Para rescatar de verdad hay que hacer POST.
  const dry = req.method === "GET" || req.nextUrl.searchParams.get("dry") === "1";

  try {
    return NextResponse.json({ success: true, data: await rescatarImagenesFTP({ dry }) });
  } catch (err) {
    console.error("[mantenimiento/imagenes-ftp]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Falló el rescate" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
