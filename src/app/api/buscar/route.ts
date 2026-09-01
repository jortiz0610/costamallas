// ============================================================
// GET /api/buscar?q=… — el buscador global
//
// Busca a la vez en clientes, cotizaciones, pedidos y productos, y
// devuelve todo junto. Antes había que adivinar en qué módulo estaba lo
// que se buscaba y abrir esa pantalla primero.
//
// Respeta los permisos: cada bloque solo se consulta si la persona
// puede ver ese módulo. Un vendedor sin acceso a facturación no debe
// enterarse de que existe una factura por un buscador.
//
// Y respeta el alcance: sin `crm.ver_todo`, solo sale lo suyo. El
// buscador no es una puerta trasera al CRM de los demás.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { permisosDe, usuarioDeCabeceras } from "@/lib/permisos-server";
import { formatCOP } from "@/lib/utils";

export const dynamic = "force-dynamic";

export interface Resultado {
  tipo: "cliente" | "cotizacion" | "pedido" | "producto";
  id: string;
  titulo: string;
  /** La segunda línea: lo que distingue este de otro parecido. */
  detalle: string;
  href: string;
  /** Una etiqueta corta a la derecha (estado, precio). */
  marca?: string;
}

/** Cuántos de cada tipo. Suficiente para reconocer, no tanto como para
 *  tener que leer una lista larga. */
const POR_TIPO = 5;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Con menos de dos letras cualquier búsqueda devuelve medio catálogo.
  if (q.length < 2) return NextResponse.json({ success: true, data: [] });

  const cab = usuarioDeCabeceras(req);
  const permisos = await permisosDe(cab.id || user.sub, user.rol);
  const verTodo = permisos.has("crm.ver_todo");
  const mio = verTodo ? {} : { vendedorId: cab.id || user.sub };

  const contiene = { contains: q, mode: "insensitive" as const };
  const tareas: Promise<Resultado[]>[] = [];

  if (permisos.has("crm.clientes")) {
    tareas.push((async () => {
      const filas = await prisma.cliente.findMany({
        where: {
          activo: true,
          ...(verTodo ? {} : { OR: [{ vendedorId: cab.id || user.sub }, { vendedorId: null }] }),
          AND: [{
            OR: [
              { nombre: contiene }, { empresa: contiene }, { email: contiene },
              { nit: contiene }, { cedula: contiene }, { telefono: contiene },
            ],
          }],
        },
        select: { id: true, nombre: true, empresa: true, ciudad: true, estado: true, tipo: true },
        take: POR_TIPO,
      });
      return filas.map(c => ({
        tipo: "cliente" as const,
        id: c.id,
        titulo: c.empresa || c.nombre,
        detalle: [c.tipo === "empresa" ? "Empresa" : "Persona", c.ciudad].filter(Boolean).join(" · "),
        href: `/crm/clientes/${c.id}`,
        marca: c.estado.replace(/_/g, " ").toLowerCase(),
      }));
    })());
  }

  if (permisos.has("crm.cotizaciones")) {
    tareas.push((async () => {
      const filas = await prisma.cotizacion.findMany({
        where: {
          ...mio,
          OR: [{ numero: contiene }, { cliente: { is: { nombre: contiene } } }, { cliente: { is: { empresa: contiene } } }],
        },
        select: {
          id: true, numero: true, estado: true, total: true, esPrueba: true,
          cliente: { select: { nombre: true, empresa: true } },
        },
        orderBy: { createdAt: "desc" },
        take: POR_TIPO,
      });
      return filas.map(c => ({
        tipo: "cotizacion" as const,
        id: c.id,
        titulo: `${c.numero}${c.esPrueba ? " · prueba" : ""}`,
        detalle: c.cliente.empresa || c.cliente.nombre,
        href: `/crm/cotizaciones/${c.id}`,
        marca: `${c.estado.toLowerCase()} · ${formatCOP(Number(c.total))}`,
      }));
    })());
  }

  if (permisos.has("crm.pedidos")) {
    tareas.push((async () => {
      const filas = await prisma.pedido.findMany({
        where: {
          ...mio,
          OR: [{ numero: contiene }, { cliente: { is: { nombre: contiene } } }, { cliente: { is: { empresa: contiene } } }],
        },
        select: {
          id: true, numero: true, estado: true, total: true,
          cliente: { select: { nombre: true, empresa: true } },
        },
        orderBy: { createdAt: "desc" },
        take: POR_TIPO,
      });
      return filas.map(p => ({
        tipo: "pedido" as const,
        id: p.id,
        titulo: p.numero,
        detalle: p.cliente.empresa || p.cliente.nombre,
        href: `/crm/pedidos/${p.id}`,
        marca: `${p.estado.toLowerCase()} · ${formatCOP(Number(p.total))}`,
      }));
    })());
  }

  if (permisos.has("erp.productos")) {
    tareas.push((async () => {
      const filas = await prisma.producto.findMany({
        where: {
          intEstado: { not: "ARCHIVADO" },
          OR: [{ nombre: contiene }, { sku: contiene }, { acfSkuInterno: contiene }],
        },
        select: { id: true, nombre: true, sku: true, precioNormal: true, stock: true, acfUnidadVenta: true },
        take: POR_TIPO,
      });
      return filas.map(p => ({
        tipo: "producto" as const,
        id: p.id,
        titulo: p.nombre,
        detalle: `${p.sku} · ${p.stock} ${p.acfUnidadVenta ?? "ud"} en existencia`,
        href: `/productos/${p.id}`,
        marca: p.precioNormal ? formatCOP(Number(p.precioNormal)) : "sin precio",
      }));
    })());
  }

  const data = (await Promise.all(tareas)).flat();
  return NextResponse.json({ success: true, data });
}
