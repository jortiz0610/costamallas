import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, isAdmin } from "@/lib/auth";
import { getWCCredentials, importarPedidosWC } from "@/lib/woocommerce";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  // Sincronización con la tienda: solo admin/superadmin. Toca el catálogo
  // en vivo de costamallas.com, así que no basta con permiso de escritura.
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: "Solo administradores pueden sincronizar con la tienda" }, { status: 403 });

  const creds = await getWCCredentials();
  if (!creds) {
    return NextResponse.json({ success: false, error: "WooCommerce no está configurado. Ve a Configuración → WooCommerce e ingresa tus credenciales." }, { status: 400 });
  }

  try {
    const result = await importarPedidosWC(creds);
    await prisma.log.create({
      data: {
        usuarioId: user.sub, accion: "WC_IMPORT_PEDIDOS",
        detalle: `Importados ${result.importados}, omitidos ${result.omitidos}, clientes nuevos ${result.clientesCreados}`,
        resultado: result.errores.length ? "PARCIAL" : "OK",
      },
    }).catch(() => {});
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error("[WC import-orders]", e);
    return NextResponse.json({ success: false, error: `Error al conectar con WooCommerce: ${(e as Error).message}` }, { status: 500 });
  }
}
