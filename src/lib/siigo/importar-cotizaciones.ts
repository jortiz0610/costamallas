// ============================================================
// Traer el histórico de cotizaciones de SIIGO.
//
// Son 6.323 ofertas desde enero de 2021, con 22.531 líneas. Sirven para
// una pregunta concreta que hoy no tiene respuesta en el portal: «a este
// cliente, ¿qué le cotizamos antes y a qué precio?».
//
// ── EL CHOQUE DE CONSECUTIVOS, Y CÓMO SE ESQUIVA ──
//
// SIIGO numeró hasta la 12069 y el portal arrancó en la 12065. Las
// cinco del medio existen en los dos sistemas, el mismo día, con
// clientes y montos DISTINTOS. No son duplicados: son documentos
// diferentes con el mismo número.
//
// Aquí no se renumera nada del portal —tocar un consecutivo contable ya
// emitido no es cosa de una importación— y tampoco se inventa un
// formato. Se usa el nombre que el propio SIIGO le da al documento:
// `C-1-12069`. Es único en las 6.323, no se parece a `COT-12069`, y es
// el mismo texto que aparece en SIIGO, así que buscar por él lleva al
// documento correcto en los dos sitios.
//
// ── EL ESTADO SALE DE LA FECHA, y no hay estado propio ──
//
// Estas ofertas viven en el MISMO embudo que las del portal. No llevan
// un estado inventado para ellas: lo que las distingue es `siigoId`, y
// con eso basta —no se van a traer más, así que no hace falta un
// compartimento aparte.
//
// SIIGO no guarda el desenlace, pero sí guarda cuándo se emitió cada
// una, y eso alcanza para el único estado que se puede afirmar sin
// mentir: si ya pasó su validez, está VENCIDA; si no, quedó ENVIADA,
// porque una cotización de SIIGO es un documento que SE LE ENTREGÓ a un
// cliente, no un borrador a medias.
// ============================================================

import { prisma } from "@/lib/prisma";
import { recorrerSiigo } from "./cliente-api";

/**
 * El estado de una oferta traída de SIIGO, deducido de su fecha.
 *
 * De las 6.323, 6.297 ya pasaron su validez y 26 siguen vigentes.
 */
export function estadoPorFecha(fecha: Date, validezDias = 30): string {
  const vence = new Date(fecha.getTime() + validezDias * 86400000);
  return vence.getTime() < Date.now() ? "VENCIDA" : "ENVIADA";
}

export interface CotizacionSiigo {
  id: string;
  number?: number;
  name?: string;
  date?: string;
  customer?: { identification?: string };
  seller?: number;
  total?: number;
  public_url?: string;
  items?: {
    code?: string;
    description?: string;
    quantity?: number;
    price?: number;
    total?: number;
    discount?: { percentage?: number; value?: number };
  }[];
}

export interface ResultadoCotizaciones {
  leidas: number;
  creadas: number;
  yaEstaban: number;
  sinCliente: number;
  errores: { documento: string; error: string }[];
  ensayo: boolean;
}

const soloDigitos = (v: string | null | undefined) => String(v ?? "").replace(/[^0-9]/g, "");

export async function importarCotizacionesSiigo(
  opciones?: { ensayo?: boolean; maxPaginas?: number },
): Promise<ResultadoCotizaciones> {
  const ensayo = opciones?.ensayo ?? false;
  const r: ResultadoCotizaciones = {
    leidas: 0, creadas: 0, yaEstaban: 0, sinCliente: 0, errores: [], ensayo,
  };

  // Los índices se cargan UNA vez. Preguntar por cada una de las 6.323
  // serían miles de consultas contra la base.
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nit: true, cedula: true },
  });
  const porDocumento = new Map<string, string>();
  for (const c of clientes) {
    for (const d of [soloDigitos(c.nit), soloDigitos(c.cedula)]) {
      if (d && !porDocumento.has(d)) porDocumento.set(d, c.id);
    }
  }

  const yaImportadas = new Set(
    (await prisma.cotizacion.findMany({
      where: { siigoId: { not: null } },
      select: { siigoId: true },
    })).map(x => x.siigoId!),
  );

  // Los números que YA existen, para no chocar contra el índice único.
  const numerosUsados = new Set(
    (await prisma.cotizacion.findMany({ select: { numero: true } })).map(x => x.numero),
  );

  const productos = await prisma.producto.findMany({ select: { id: true, sku: true } });
  const porSku = new Map(productos.map(p => [p.sku.trim().toUpperCase(), p.id]));

  await recorrerSiigo<CotizacionSiigo>(
    "/v1/quotations",
    async lote => {
      for (const q of lote) {
        r.leidas++;

        if (yaImportadas.has(q.id)) { r.yaEstaban++; continue; }

        const doc = soloDigitos(q.customer?.identification);
        const clienteId = porDocumento.get(doc);
        if (!clienteId) {
          r.sinCliente++;
          continue;
        }

        // El nombre del documento en SIIGO. Si por lo que sea faltara, se
        // arma uno equivalente: nunca se cae en el formato COT-, que es
        // el del portal.
        const numero = (q.name || `C-1-${q.number ?? q.id.slice(0, 8)}`).trim();
        if (numerosUsados.has(numero)) {
          // No debería pasar —los 6.323 nombres son únicos y no chocan con
          // los COT-— pero si pasa se dice, en vez de reventar la corrida.
          r.errores.push({ documento: numero, error: "ese número ya existe en el portal" });
          continue;
        }

        const fecha = q.date ? new Date(q.date + "T12:00:00-05:00") : new Date();
        const items = q.items ?? [];

        // El subtotal se suma de las líneas. El `total` de SIIGO ya trae
        // impuestos, y guardar uno sin el otro dejaría el documento
        // descuadrado al abrirlo.
        let subtotal = 0;
        const lineas = items.map((it, i) => {
          const cantidad = Number(it.quantity ?? 0);
          const precio = Number(it.price ?? 0);
          const dtoPct = Number(it.discount?.percentage ?? 0);
          const linea = cantidad * precio * (1 - dtoPct / 100);
          subtotal += linea;
          return {
            productoId: porSku.get(String(it.code ?? "").trim().toUpperCase()) ?? null,
            descripcion: String(it.description ?? it.code ?? "Sin descripción").slice(0, 2000),
            cantidad,
            precioUnitario: precio,
            descuento: dtoPct,
            subtotal: linea,
            unidad: null,
            tipo: "PRODUCTO",
            orden: i,
          };
        });

        const total = Number(q.total ?? subtotal);
        // Lo que SIIGO cobró por encima del subtotal es el impuesto. No se
        // recalcula el 19%: se respeta lo que quedó facturado.
        const iva = Math.max(0, total - subtotal);

        try {
          if (!ensayo) {
            await prisma.cotizacion.create({
              data: {
                siigoId: q.id,
                numero,
                clienteId,
                estado: estadoPorFecha(fecha),
                subtotal,
                descuento: 0,
                iva,
                total,
                // La fecha real del documento, no la de la importación:
                // un histórico ordenado por "cuándo lo importamos" no
                // sirve para nada.
                createdAt: fecha,
                validezDias: 30,
                // Queda el enlace al documento en SIIGO, que es la fuente.
                notas: q.public_url ? `Importada de SIIGO · ${q.public_url}` : "Importada de SIIGO",
                esPrueba: false,
                items: { create: lineas },
              },
            });
          }
          numerosUsados.add(numero);
          yaImportadas.add(q.id);
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
