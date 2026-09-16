// ============================================================
// Traer las facturas de venta de SIIGO.
//
// Son 1.985 documentos de 2020 en adelante, con 4.644 líneas y 2.156
// pagos registrados. Y traen algo que el portal no tenía de ninguna
// parte: **el rastro de la DIAN**. 1.687 vienen con CUFE y sello
// `Accepted`, 62 rechazadas, 16 en borrador.
//
// Eso responde a "cómo deben ir nuestras facturas" con documentos
// reales aceptados, en vez de con una plantilla inventada: se ve qué
// prefijo se usa (FE), qué observaciones llevan, cómo se registran los
// pagos y qué forma tiene un CUFE aceptado.
//
// ── DOS TIPOS DE DOCUMENTO EN LA MISMA LISTA ──
//
// SIIGO devuelve aquí dos cosas: 1.765 facturas electrónicas (prefijo
// FE) y 220 órdenes de compra (prefijo OC). Las OC son justamente las
// que no tienen sello de la DIAN, porque no son facturas. Se traen las
// dos —son documentos reales del negocio— pero el estado ante la DIAN
// las distingue.
//
// ── EL ESTADO SALE DEL SALDO, NO SE INVENTA ──
//
// SIIGO sí dice cuánto queda por cobrar (`balance`), así que aquí no
// hay que adivinar como en las cotizaciones: saldo 0 es PAGADA, saldo
// pendiente es PARCIAL si ya abonó algo y EMITIDA si no.
// ============================================================

import { prisma } from "@/lib/prisma";
import { recorrerSiigo } from "./cliente-api";

export interface FacturaSiigo {
  id: string;
  prefix?: string;
  number?: number;
  name?: string;
  date?: string;
  customer?: { identification?: string };
  total?: number;
  balance?: number;
  observations?: string;
  public_url?: string;
  stamp?: { status?: string; cufe?: string };
  items?: {
    code?: string;
    description?: string;
    quantity?: number;
    price?: number;
    total?: number;
    discount?: { percentage?: number };
    taxes?: { percentage?: number }[];
  }[];
  payments?: { id?: number; name?: string; value?: number; due_date?: string }[];
}

export interface ResultadoFacturas {
  leidas: number;
  creadas: number;
  yaEstaban: number;
  sinCliente: number;
  errores: { documento: string; error: string }[];
  ensayo: boolean;
}

const soloDigitos = (v: string | null | undefined) => String(v ?? "").replace(/[^0-9]/g, "");

/** El sello de SIIGO traducido al vocabulario del portal. */
function estadoDian(sello: string | undefined): string {
  switch ((sello ?? "").toLowerCase()) {
    case "accepted": return "ACEPTADA";
    case "rejected": return "RECHAZADA";
    case "draft":    return "PENDIENTE";
    // Sin sello no es un fallo: las órdenes de compra no van a la DIAN.
    default:         return "NO_APLICA";
  }
}

export async function importarFacturasSiigo(
  opciones?: { ensayo?: boolean; maxPaginas?: number },
): Promise<ResultadoFacturas> {
  const ensayo = opciones?.ensayo ?? false;
  const r: ResultadoFacturas = {
    leidas: 0, creadas: 0, yaEstaban: 0, sinCliente: 0, errores: [], ensayo,
  };

  const clientes = await prisma.cliente.findMany({ select: { id: true, nit: true, cedula: true } });
  const porDocumento = new Map<string, string>();
  for (const c of clientes) {
    for (const d of [soloDigitos(c.nit), soloDigitos(c.cedula)]) {
      if (d && !porDocumento.has(d)) porDocumento.set(d, c.id);
    }
  }

  const yaImportadas = new Set(
    (await prisma.factura.findMany({ where: { siigoId: { not: null } }, select: { siigoId: true } }))
      .map(x => x.siigoId!),
  );
  const numerosUsados = new Set(
    (await prisma.factura.findMany({ select: { numero: true } })).map(x => x.numero),
  );

  const productos = await prisma.producto.findMany({ select: { id: true, sku: true } });
  const porSku = new Map(productos.map(p => [p.sku.trim().toUpperCase(), p.id]));

  await recorrerSiigo<FacturaSiigo>(
    "/v1/invoices",
    async lote => {
      for (const f of lote) {
        r.leidas++;
        if (yaImportadas.has(f.id)) { r.yaEstaban++; continue; }

        const clienteId = porDocumento.get(soloDigitos(f.customer?.identification));
        if (!clienteId) { r.sinCliente++; continue; }

        const numero = (f.name || `${f.prefix ?? "FV"}-${f.number ?? f.id.slice(0, 8)}`).trim();
        if (numerosUsados.has(numero)) {
          r.errores.push({ documento: numero, error: "ese número de factura ya existe en el portal" });
          continue;
        }

        const fecha = f.date ? new Date(f.date + "T12:00:00-05:00") : new Date();
        const total = Number(f.total ?? 0);
        const saldo = Number(f.balance ?? 0);

        let subtotal = 0;
        const lineas = (f.items ?? []).map((it, i) => {
          const cantidad = Number(it.quantity ?? 0);
          const precio = Number(it.price ?? 0);
          const dto = Number(it.discount?.percentage ?? 0);
          const linea = cantidad * precio * (1 - dto / 100);
          subtotal += linea;
          return {
            productoId: porSku.get(String(it.code ?? "").trim().toUpperCase()) ?? null,
            descripcion: String(it.description ?? it.code ?? "Sin descripción").slice(0, 2000),
            cantidad,
            precioUnitario: precio,
            descuento: dto,
            // El IVA que quedó FACTURADO, no el que tocaría hoy. Una
            // factura de 2020 con otro porcentaje no se recalcula: se
            // guarda como se emitió.
            ivaPct: Number(it.taxes?.[0]?.percentage ?? 0),
            subtotal: linea,
            orden: i,
          };
        });

        const iva = Math.max(0, total - subtotal);

        // Los pagos que SIIGO tiene registrados. `name` es la cuenta por
        // la que entró la plata ("Bancolombia AH7626"), que es la
        // referencia útil para conciliar.
        const pagos = (f.payments ?? [])
          .filter(p => Number(p.value ?? 0) > 0)
          .map(p => ({
            monto: Number(p.value),
            metodo: "TRANSFERENCIA",
            referencia: p.name ?? null,
            fecha,
          }));

        const pagado = pagos.reduce((s, p) => s + p.monto, 0);
        const estado = saldo <= 0 ? "PAGADA" : pagado > 0 ? "PARCIAL" : "EMITIDA";

        try {
          if (!ensayo) {
            await prisma.factura.create({
              data: {
                siigoId: f.id,
                numero,
                prefijo: f.prefix ?? null,
                consecutivo: f.number ?? null,
                clienteId,
                estado,
                estadoDian: estadoDian(f.stamp?.status),
                cufe: f.stamp?.cufe ?? null,
                // El visor público de SIIGO ES el documento: enlazarlo
                // vale más que guardar un PDF que se quedaría viejo.
                pdfUrl: f.public_url ?? null,
                subtotal,
                descuento: 0,
                iva,
                total,
                saldoPendiente: saldo,
                fechaEmision: fecha,
                createdAt: fecha,
                notas: f.observations ? String(f.observations).slice(0, 4000) : null,
                items: { create: lineas },
                ...(pagos.length ? { pagos: { create: pagos } } : {}),
              },
            });
          }
          numerosUsados.add(numero);
          yaImportadas.add(f.id);
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
