// ============================================================
// Compras a proveedores, traídas de SIIGO.
//
// ── UNA ACLARACIÓN QUE CAMBIA DÓNDE VA ESTO ──
//
// `/v1/purchases` NO es "lo que compraron los clientes". Cada documento
// trae un campo `supplier`: son las compras que hace COSTAMALLAS a sus
// 335 proveedores. Lo que compró un cliente ya está en las facturas de
// venta.
//
// Por eso esto va contra Proveedor y OrdenCompra, no contra Cliente.
//
// ── LOS TERCEROS DE SIIGO NO SON SOLO CLIENTES ──
//
// `/v1/customers` devuelve 4.045 `Customer`, 89 `Supplier` y 150
// `Other`. Los proveedores salen de ahí, y hay un matiz: 267 de los 335
// proveedores están marcados como `Customer` porque también le compran a
// Costamallas. Esos existen en las dos tablas a propósito — son la misma
// empresa en dos papeles distintos.
// ============================================================

import { prisma } from "@/lib/prisma";
import { recorrerSiigo, leerSiigo, type ClienteSiigo, type PaginaSiigo } from "./cliente-api";

export interface CompraSiigo {
  id: string;
  number?: number;
  name?: string;
  date?: string;
  supplier?: { identification?: string };
  total?: number;
  balance?: number;
  provider_invoice?: { prefix?: string; number?: string };
  items?: {
    code?: string;
    description?: string;
    quantity?: number;
    price?: number;
    total?: number;
  }[];
  payments?: { name?: string; value?: number; due_date?: string }[];
}

export interface ResultadoCompras {
  proveedoresCreados: number;
  proveedoresYaEstaban: number;
  leidas: number;
  creadas: number;
  yaEstaban: number;
  sinProveedor: number;
  errores: { documento: string; error: string }[];
  ensayo: boolean;
}

const soloDigitos = (v: string | null | undefined) => String(v ?? "").replace(/[^0-9]/g, "");

/**
 * Da de alta como proveedor a los terceros que aparecen comprando.
 *
 * Se hace ANTES de las compras y con la lista completa de terceros: si
 * se crearan sobre la marcha, cada compra tendría que decidir si el
 * proveedor existe, y el nombre saldría de un documento de compra en vez
 * de la ficha del tercero, que es donde están el correo y el teléfono.
 */
async function asegurarProveedores(
  documentos: Set<string>,
  ensayo: boolean,
): Promise<{ creados: number; yaEstaban: number; porDocumento: Map<string, string> }> {
  const existentes = await prisma.proveedor.findMany({
    select: { id: true, nit: true, siigoId: true },
  });
  const porDocumento = new Map<string, string>();
  for (const p of existentes) {
    const d = soloDigitos(p.nit);
    if (d) porDocumento.set(d, p.id);
  }

  let creados = 0;
  let yaEstaban = 0;

  // Se recorre el catálogo de terceros y se crean solo los que hacen
  // falta: los que de verdad aparecen en alguna compra.
  await recorrerSiigo<ClienteSiigo>("/v1/customers", async lote => {
    for (const t of lote) {
      const doc = soloDigitos(t.identification);
      if (!doc || !documentos.has(doc)) continue;
      if (porDocumento.has(doc)) { yaEstaban++; continue; }

      const nombre = (t.name ?? []).map(x => String(x ?? "").trim()).filter(Boolean).join(" ").trim();
      if (!nombre) continue;

      if (!ensayo) {
        const creado = await prisma.proveedor.create({
          data: {
            siigoId: t.id,
            nombre,
            nit: doc,
            email: (t.contacts ?? [])[0]?.email?.trim() || null,
            telefono: (t.phones ?? []).find(p => p.number)?.number?.trim() || null,
            ciudad: t.address?.city?.city_name?.trim() || null,
            departamento: t.address?.city?.state_name?.trim() || null,
            direccion: t.address?.address?.trim() || null,
          },
          select: { id: true },
        });
        porDocumento.set(doc, creado.id);
      } else {
        // En ensayo se apunta igual, para que el conteo de compras "sin
        // proveedor" no salga inflado por proveedores que SÍ se crearían.
        porDocumento.set(doc, "ensayo");
      }
      creados++;
    }
  });

  return { creados, yaEstaban, porDocumento };
}

export async function importarComprasSiigo(
  opciones?: { ensayo?: boolean; maxPaginas?: number },
): Promise<ResultadoCompras> {
  const ensayo = opciones?.ensayo ?? false;
  const r: ResultadoCompras = {
    proveedoresCreados: 0, proveedoresYaEstaban: 0,
    leidas: 0, creadas: 0, yaEstaban: 0, sinProveedor: 0, errores: [], ensayo,
  };

  // Primero se mira QUIÉNES son los proveedores, leyendo solo las compras.
  const documentos = new Set<string>();
  await recorrerSiigo<CompraSiigo>("/v1/purchases", async lote => {
    for (const c of lote) {
      const d = soloDigitos(c.supplier?.identification);
      if (d) documentos.add(d);
    }
  });

  const prov = await asegurarProveedores(documentos, ensayo);
  r.proveedoresCreados = prov.creados;
  r.proveedoresYaEstaban = prov.yaEstaban;

  const yaImportadas = new Set(
    (await prisma.ordenCompra.findMany({ where: { siigoId: { not: null } }, select: { siigoId: true } }))
      .map(x => x.siigoId!),
  );
  const numerosUsados = new Set(
    (await prisma.ordenCompra.findMany({ select: { numero: true } })).map(x => x.numero),
  );

  await recorrerSiigo<CompraSiigo>(
    "/v1/purchases",
    async lote => {
      for (const c of lote) {
        r.leidas++;
        if (yaImportadas.has(c.id)) { r.yaEstaban++; continue; }

        const proveedorId = prov.porDocumento.get(soloDigitos(c.supplier?.identification));
        if (!proveedorId) { r.sinProveedor++; continue; }

        const numero = (c.name || `FC-${c.number ?? c.id.slice(0, 8)}`).trim();
        if (numerosUsados.has(numero)) {
          r.errores.push({ documento: numero, error: "ese número ya existe en el portal" });
          continue;
        }

        const fecha = c.date ? new Date(c.date + "T12:00:00-05:00") : new Date();
        const saldo = Number(c.balance ?? 0);
        const total = Number(c.total ?? 0);

        // `items` es un campo JSON en OrdenCompra, no una tabla aparte.
        const items = (c.items ?? []).map(it => ({
          codigo: it.code ?? null,
          descripcion: String(it.description ?? it.code ?? "").slice(0, 500),
          cantidad: Number(it.quantity ?? 0),
          precio: Number(it.price ?? 0),
          total: Number(it.total ?? 0),
        }));

        // Saldo 0 = recibida y pagada. Con saldo, queda como enviada:
        // es una compra real que todavía se debe.
        const estado = saldo <= 0 ? "RECIBIDA" : "ENVIADA";

        const refProveedor = c.provider_invoice
          ? `Factura del proveedor: ${c.provider_invoice.prefix ?? ""}${c.provider_invoice.number ?? ""}`.trim()
          : null;

        try {
          if (!ensayo) {
            await prisma.ordenCompra.create({
              data: {
                siigoId: c.id,
                numero,
                proveedorId,
                estado,
                total,
                items,
                fechaEsperada: fecha,
                recibidaEn: saldo <= 0 ? fecha : null,
                createdAt: fecha,
                notas: [refProveedor, saldo > 0 ? `Saldo por pagar: ${saldo}` : null]
                  .filter(Boolean).join(" · ") || null,
              },
            });
          }
          numerosUsados.add(numero);
          yaImportadas.add(c.id);
          r.creadas++;
        } catch (e) {
          r.errores.push({
            documento: numero,
            error: e instanceof Error ? e.message.slice(0, 160) : String(e),
          });
        }
      }
    },
    { maxPaginas: opciones?.maxPaginas },
  );

  return r;
}

// Se exporta para que la ruta pueda comprobar la conexión sin importar.
export async function contarCompras(): Promise<number> {
  const p = await leerSiigo<PaginaSiigo<CompraSiigo>>("/v1/purchases?page_size=1&page=1");
  return p.pagination?.total_results ?? 0;
}
