// GET  /api/imagenes?productoId=xxx — listar imágenes de un producto
// DELETE /api/imagenes?id=xxx     — eliminar imagen

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImageFTP } from "@/lib/ftp";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const productoId = req.nextUrl.searchParams.get("productoId");
  if (!productoId) return NextResponse.json({ success: false, error: "productoId requerido" }, { status: 400 });

  const imagenes = await prisma.acfImagen.findMany({
    where: { productoId },
    orderBy: { posicion: "asc" },
  });

  return NextResponse.json({ success: true, data: imagenes });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const imagen = await prisma.acfImagen.findUnique({ where: { id } });
  if (!imagen) return NextResponse.json({ success: false, error: "Imagen no encontrada" }, { status: 404 });

  // Intentar eliminar del FTP si es de catalogo.costamallas.com
  if (imagen.urlImagen.includes("catalogo.costamallas.com")) {
    const parts = imagen.urlImagen.split("/");
    const filename = parts.pop()!;
    const subfolder = parts.pop()!;
    await deleteImageFTP(filename, subfolder);
  }

  await prisma.acfImagen.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { id, esPrincipal, altText, posicion } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  if (esPrincipal) {
    const imagen = await prisma.acfImagen.findUnique({ where: { id } });
    if (imagen) {
      await prisma.acfImagen.updateMany({
        where: { productoId: imagen.productoId },
        data: { esPrincipal: false },
      });
    }
  }

  const updated = await prisma.acfImagen.update({
    where: { id },
    data: {
      ...(esPrincipal !== undefined && { esPrincipal }),
      ...(altText !== undefined && { altText }),
      ...(posicion !== undefined && { posicion }),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
