// ============================================================
// "Cada vendedor ve lo suyo".
//
// El permiso `crm.ver_todo` decide si una persona ve el CRM completo o
// solo su cartera. Lo tienen administración, producción y quien lo
// necesite; un vendedor no.
//
// Está aquí y no repetido en cada route handler porque el filtro tiene
// un matiz que es fácil equivocar: los CLIENTES sin vendedor asignado
// los ve todo el mundo. Si se filtrara solo por `vendedorId = yo`, los
// clientes que entran por la web —que nacen sin asesor— serían
// invisibles hasta que alguien los asignara a mano, y nadie los
// asignaría porque nadie los vería.
//
// Las cotizaciones y los pedidos no tienen ese problema: nacen con el
// vendedor que los creó.
// ============================================================

import type { NextRequest } from "next/server";
import { peticionPuede, usuarioDeCabeceras } from "@/lib/permisos-server";
import { getUserFromRequest } from "@/lib/auth";

/** Quién es y si puede verlo todo. */
export async function alcance(req: NextRequest): Promise<{ usuarioId: string; verTodo: boolean }> {
  // Las route handlers reciben el id en las cabeceras que inyecta el
  // middleware; se cae al token si por lo que sea no vinieran.
  const cab = usuarioDeCabeceras(req);
  const usuarioId = cab.id || (await getUserFromRequest(req))?.sub || "";
  return { usuarioId, verTodo: await peticionPuede(req, "crm.ver_todo") };
}

/** Filtro para `prisma.cliente.findMany`. Vacío = sin restricción. */
export async function filtroClientes(req: NextRequest): Promise<Record<string, unknown>> {
  const { usuarioId, verTodo } = await alcance(req);
  if (verTodo || !usuarioId) return {};
  return { OR: [{ vendedorId: usuarioId }, { vendedorId: null }] };
}

/** Filtro para cotizaciones y pedidos, que sí nacen con dueño. */
export async function filtroPorVendedor(req: NextRequest): Promise<Record<string, unknown>> {
  const { usuarioId, verTodo } = await alcance(req);
  if (verTodo || !usuarioId) return {};
  return { vendedorId: usuarioId };
}
