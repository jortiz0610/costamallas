// ============================================================
// POST /api/imagenes/upload — Sube imagen a catalogo.costamallas.com via FTP
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { uploadImageFTP } from "@/lib/ftp";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 5;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productoId = formData.get("productoId") as string | null;
    const esPrincipal = formData.get("esPrincipal") === "true";

    if (!file) return NextResponse.json({ success: false, error: "No se recibió archivo" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Tipo de archivo no permitido. Usa JPG, PNG o WebP." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ success: false, error: `El archivo supera ${MAX_SIZE_MB}MB` }, { status: 400 });
    }

    // Generar nombre único
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const timestamp = Date.now();
    const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    const filename = `${safeName}-${timestamp}.${ext}`;

    // Subir via FTP
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImageFTP(buffer, filename);

    // Guardar en BD si viene con productoId
    if (productoId) {
      // Contar imágenes existentes para posición
      const count = await prisma.acfImagen.count({ where: { productoId } });

      // Si es principal, desmarcar las demás
      if (esPrincipal) {
        await prisma.acfImagen.updateMany({
          where: { productoId },
          data: { esPrincipal: false },
        });
      }

      const imagen = await prisma.acfImagen.create({
        data: {
          productoId,
          urlImagen: url,
          posicion: count,
          esPrincipal: esPrincipal || count === 0,
          altText: file.name.replace(/\.[^.]+$/, ""),
        },
      });

      return NextResponse.json({ success: true, data: { url, imagen } });
    }

    return NextResponse.json({ success: true, data: { url, filename } });
  } catch (err) {
    console.error("[upload imagen]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error al subir imagen" },
      { status: 500 }
    );
  }
}
