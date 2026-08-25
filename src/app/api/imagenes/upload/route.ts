// ============================================================
// POST /api/imagenes/upload — Sube imagen a catalogo.costamallas.com via FTP
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { uploadImageFTP, verificarUrlPublica } from "@/lib/ftp";
import { getWPCredentials, uploadToWordPressMedia } from "@/lib/wordpress";
import { prisma } from "@/lib/prisma";
import { sincronizarProducto } from "@/lib/sync-tienda";

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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Preferir WordPress (media queda servida por costamallas.com y funciona en la
    // tienda). Si WP no está configurado, usar FTP a catalogo.costamallas.com.
    let url: string;
    let aviso: string | null = null;
    const wpCreds = await getWPCredentials();
    if (wpCreds) {
      const media = await uploadToWordPressMedia(buffer, filename, file.type);
      url = media.url;
    } else {
      url = await uploadImageFTP(buffer, filename);
      // Que el FTP no se queje NO significa que la imagen se vea: el
      // archivo puede quedar en una carpeta que ningún sitio sirve. Ha
      // pasado aquí, y por eso "la ficha se sube pero no aparece en la
      // página". Se comprueba y se dice, en vez de dar por bueno.
      aviso = await verificarUrlPublica(url);
      if (aviso) {
        console.error(`[imagenes] subida no accesible: ${url} — ${aviso}`);
      }
    }

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

      // Que la foto nueva aparezca en la tienda sin esperar a que alguien
      // vuelva a guardar el producto ni al cron diario.
      const sync = await sincronizarProducto(productoId);
      return NextResponse.json({ success: true, data: { url, imagen }, sync, aviso });
    }

    return NextResponse.json({ success: true, data: { url, filename }, aviso });
  } catch (err) {
    console.error("[upload imagen]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error al subir imagen" },
      { status: 500 }
    );
  }
}
