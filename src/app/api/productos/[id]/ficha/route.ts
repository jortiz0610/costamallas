import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { uploadImageFTP, deleteImageFTP } from "@/lib/ftp";
import { getWPCredentials, uploadToWordPressMedia } from "@/lib/wordpress";

type P = { params: Promise<{ id: string }> };
const SUBFOLDER = "fichas-tecnicas";

// POST: sube el PDF de ficha técnica a FTP y guarda la URL en acfExtra
export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const producto = await prisma.producto.findUnique({ where: { id }, select: { sku: true, acfExtra: true } });
  if (!producto) return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ success: false, error: "Solo se permiten archivos PDF" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, error: "El PDF supera 15 MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeSku = producto.sku.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `ficha-${safeSku}-${Date.now()}.pdf`;

  let url: string;
  try {
    // Preferir WordPress (queda servido por costamallas.com); si no, FTP a catalogo.
    const wpCreds = await getWPCredentials();
    url = wpCreds
      ? (await uploadToWordPressMedia(buffer, filename, "application/pdf")).url
      : await uploadImageFTP(buffer, filename, SUBFOLDER);
  } catch (err) {
    console.error("[ficha upload]", err);
    return NextResponse.json({ success: false, error: "No se pudo subir el PDF. Revisa la configuración de WordPress/FTP." }, { status: 500 });
  }

  const acfExtra = { ...(producto.acfExtra as Record<string, unknown> ?? {}), fichaTecnicaUrl: url, fichaTecnicaNombre: file.name };
  // Se guarda también en la columna `acfFichaTecnicaPdf`: es la que lee el
  // sync a WooCommerce y la que consultan otros módulos. Tenerlo solo en
  // acfExtra hacía que la ficha nunca llegara a la tienda.
  await prisma.producto.update({
    where: { id },
    data: { acfExtra: JSON.parse(JSON.stringify(acfExtra)), acfFichaTecnicaPdf: url },
  });

  await prisma.log.create({ data: { usuarioId: user.sub, accion: "PRODUCTO_FICHA", detalle: `Ficha técnica subida: ${producto.sku}`, resultado: "OK" } }).catch(() => {});

  return NextResponse.json({ success: true, data: { url, nombre: file.name } });
}

// DELETE: elimina la ficha técnica
export async function DELETE(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const producto = await prisma.producto.findUnique({ where: { id }, select: { acfExtra: true } });
  const acf = (producto?.acfExtra as Record<string, unknown>) ?? {};
  const url = acf.fichaTecnicaUrl as string | undefined;
  if (url) {
    const filename = url.split("/").pop();
    if (filename) await deleteImageFTP(filename, SUBFOLDER).catch(() => {});
  }
  delete acf.fichaTecnicaUrl; delete acf.fichaTecnicaNombre;
  await prisma.producto.update({ where: { id }, data: { acfExtra: JSON.parse(JSON.stringify(acf)) } });

  return NextResponse.json({ success: true });
}
