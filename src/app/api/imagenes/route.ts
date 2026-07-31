// GET  /api/imagenes?productoId=xxx — listar imágenes de un producto
// DELETE /api/imagenes?id=xxx     — eliminar imagen

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImageFTP } from "@/lib/ftp";
import { sincronizarProducto } from "@/lib/sync-tienda";

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

  // Borrar una imagen cambia lo que ve el cliente en la tienda: se
  // sincroniza de una en vez de esperar al próximo guardado o al cron.
  const sync = await sincronizarProducto(imagen.productoId);
  return NextResponse.json({ success: true, sync });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { id, esPrincipal, altText, posicion, productoId, orden } = await req.json();

  // Reordenar la galería completa: orden = [ids en el nuevo orden].
  // La posición 0 pasa a ser la principal (en WooCommerce la primera imagen es la destacada).
  if (productoId && Array.isArray(orden)) {
    const existentes = await prisma.acfImagen.findMany({ where: { productoId }, select: { id: true } });
    const validas = new Set(existentes.map((i) => i.id));
    const ids = (orden as string[]).filter((x) => validas.has(x));
    if (ids.length !== existentes.length) {
      return NextResponse.json({ success: false, error: "El orden no incluye todas las imágenes del producto" }, { status: 400 });
    }
    await prisma.$transaction(
      ids.map((imgId, i) =>
        prisma.acfImagen.update({ where: { id: imgId }, data: { posicion: i, esPrincipal: i === 0 } })
      )
    );
    const data = await prisma.acfImagen.findMany({ where: { productoId }, orderBy: { posicion: "asc" } });
    // El orden decide cuál es la imagen destacada en la tienda: hay que
    // reflejarlo de inmediato.
    const sync = await sincronizarProducto(productoId);
    return NextResponse.json({ success: true, data, sync });
  }

  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  // Marcar principal = moverla al frente y renumerar (posición 0 = destacada en Woo)
  if (esPrincipal) {
    const imagen = await prisma.acfImagen.findUnique({ where: { id } });
    if (imagen) {
      const resto = await prisma.acfImagen.findMany({
        where: { productoId: imagen.productoId, id: { not: id } },
        orderBy: { posicion: "asc" },
        select: { id: true },
      });
      await prisma.$transaction([
        prisma.acfImagen.update({ where: { id }, data: { esPrincipal: true, posicion: 0 } }),
        ...resto.map((r, i) =>
          prisma.acfImagen.update({ where: { id: r.id }, data: { esPrincipal: false, posicion: i + 1 } })
        ),
      ]);
      const updated = await prisma.acfImagen.findUnique({ where: { id } });
      const sync = await sincronizarProducto(imagen.productoId);
      return NextResponse.json({ success: true, data: updated, sync });
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

  const sync = await sincronizarProducto(updated.productoId);
  return NextResponse.json({ success: true, data: updated, sync });
}
