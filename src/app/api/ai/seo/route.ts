// ============================================================
// POST /api/ai/seo — genera el SEO de UN producto, para el formulario
//
// Devuelve el texto para que quien está editando la ficha lo vea y
// decida; no lo escribe en el producto. Es el camino de "estoy con esta
// ficha abierta".
//
// Para hacerlos todos está `/api/ai/seo/lote`, que deja las propuestas
// en la cola de revisión. El prompt, el esquema y los recortes son los
// mismos y viven en `lib/seo-ia.ts`: cuando el generador se duplicó,
// tener dos copias del prompt garantizaba que se separaran.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { pedirJSON } from "@/lib/sembli/agente";
import {
  ESQUEMA_SEO, SYSTEM_SEO, mensajeSeo, sanear,
  generarSeoDeProducto, type SeoIA,
} from "@/lib/seo-ia";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) {
    return NextResponse.json({ success: false, error: "Tu rol no permite editar productos" }, { status: 403 });
  }

  const { productoId, nombre, categorias, descripcion } = await req.json();

  try {
    let data: SeoIA;
    let costo = 0;
    let imagenesDelProducto: { id: string }[] = [];

    if (productoId) {
      // Con productoId se arma el contexto completo desde la BD.
      const existe = await prisma.producto.findUnique({
        where: { id: String(productoId) },
        select: { id: true, imagenes: { select: { id: true } } },
      });
      if (!existe) return NextResponse.json({ success: false, error: "El producto no existe" }, { status: 404 });
      imagenesDelProducto = existe.imagenes;

      const r = await generarSeoDeProducto(String(productoId));
      data = r.data;
      costo = r.costoUSD;
    } else {
      // Producto todavía sin guardar: solo se tiene lo que manda el
      // formulario, así que el contexto es mucho más pobre.
      if (!nombre) return NextResponse.json({ success: false, error: "Falta el nombre del producto" }, { status: 400 });
      const ctx = { nombre, categorias: categorias ?? [], descripcionCorta: descripcion ?? "" };
      const r = await pedirJSON<SeoIA>({
        tarea: "seo",
        system: SYSTEM_SEO,
        mensaje: mensajeSeo(ctx, []),
        esquema: ESQUEMA_SEO,
        maxTokens: 2000,
      });
      data = sanear(r.datos, String(nombre));
      costo = r.costoUSD;
    }

    // El alt de las imágenes sí se guarda de una: es metadato, no texto
    // editable del formulario, y así queda listo para el sync a la tienda.
    let imagenesActualizadas = 0;
    if (data.imagenes.length && productoId) {
      const validas = new Set(imagenesDelProducto.map((i) => i.id));
      await Promise.all(
        data.imagenes
          .filter((im) => validas.has(im.id))
          .map((im) =>
            prisma.acfImagen
              .update({ where: { id: im.id }, data: { altText: im.altText, titulo: im.titulo } })
              .then(() => { imagenesActualizadas++; })
              .catch(() => undefined),
          ),
      );
    }

    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "IA_SEO",
          detalle: `Producto ${productoId ?? nombre}`,
          resultado: `imagenes=${imagenesActualizadas} usd=${costo.toFixed(5)}`,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ success: true, data, conIA: true, imagenesActualizadas });
  } catch (e) {
    const msg = (e as Error).message;
    const sinClave = msg.includes("API key") || msg.includes("no está configurada");
    return NextResponse.json({ success: false, sinClave, error: msg }, { status: sinClave ? 200 : 500 });
  }
}
