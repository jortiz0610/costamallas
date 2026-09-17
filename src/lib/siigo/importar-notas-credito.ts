// ============================================================
// Notas crédito.
//
// Una nota crédito ANULA o REBAJA una factura ya emitida: una
// devolución, un descuento acordado después, un error de facturación.
//
// Por qué importan más de lo que su número sugiere —son solo 82—: la
// cartera del portal sale de `saldoPendiente` de las facturas, y una
// factura corregida por una nota sigue diciendo que el cliente debe. Sin
// las notas, el portal afirma que hay una deuda que ya no existe, y
// alguien llama a cobrarla.
//
// No se restan del total de la factura: un documento contable emitido no
// se edita, se corrige con otro documento. La nota queda enlazada a su
// factura y se ve al lado.
// ============================================================

import { prisma } from "@/lib/prisma";
import { recorrerSiigo } from "./cliente-api";

export interface NotaCreditoSiigo {
  id: string;
  number?: number;
  name?: string;
  date?: string;
  /** La factura que corrige. */
  invoice?: { id?: string };
  invoice_data?: { prefix?: string; number?: number; cude?: string };
  reason?: number | string;
  customer?: { identification?: string };
  total?: number;
  observations?: string;
  stamp?: { status?: string; cufe?: string };
}

export interface ResultadoNotas {
  leidas: number;
  creadas: number;
  yaEstaban: number;
  sinCliente: number;
  sinFactura: number;
  errores: { documento: string; error: string }[];
  ensayo: boolean;
}

const soloDigitos = (v: string | null | undefined) => String(v ?? "").replace(/[^0-9]/g, "");

/** Los motivos que usa la DIAN, en cristiano. */
const MOTIVOS: Record<string, string> = {
  "1": "Devolución parcial de bienes o servicios",
  "2": "Anulación de la factura",
  "3": "Rebaja o descuento parcial",
  "4": "Ajuste de precio",
  "5": "Otro",
};

function estadoDian(sello: string | undefined): string {
  switch ((sello ?? "").toLowerCase()) {
    case "accepted": return "ACEPTADA";
    case "rejected": return "RECHAZADA";
    case "draft":    return "PENDIENTE";
    default:         return "NO_APLICA";
  }
}

export async function importarNotasCreditoSiigo(
  opciones?: { ensayo?: boolean; maxPaginas?: number },
): Promise<ResultadoNotas> {
  const ensayo = opciones?.ensayo ?? false;
  const r: ResultadoNotas = {
    leidas: 0, creadas: 0, yaEstaban: 0, sinCliente: 0, sinFactura: 0, errores: [], ensayo,
  };

  const clientes = await prisma.cliente.findMany({ select: { id: true, nit: true, cedula: true } });
  const porDocumento = new Map<string, string>();
  for (const c of clientes) {
    for (const d of [soloDigitos(c.nit), soloDigitos(c.cedula)]) {
      if (d && !porDocumento.has(d)) porDocumento.set(d, c.id);
    }
  }

  // Las facturas se buscan por su id de SIIGO: es el enlace exacto que
  // trae la nota, mejor que adivinar por número.
  const facturas = await prisma.factura.findMany({
    where: { siigoId: { not: null } },
    select: { id: true, siigoId: true },
  });
  const facturaPorSiigo = new Map(facturas.map(f => [f.siigoId!, f.id]));

  const yaImportadas = new Set(
    (await prisma.notaCredito.findMany({ where: { siigoId: { not: null } }, select: { siigoId: true } }))
      .map(x => x.siigoId!),
  );
  const numerosUsados = new Set(
    (await prisma.notaCredito.findMany({ select: { numero: true } })).map(x => x.numero),
  );

  await recorrerSiigo<NotaCreditoSiigo>(
    "/v1/credit-notes",
    async lote => {
      for (const n of lote) {
        r.leidas++;
        if (yaImportadas.has(n.id)) { r.yaEstaban++; continue; }

        const clienteId = porDocumento.get(soloDigitos(n.customer?.identification));
        if (!clienteId) { r.sinCliente++; continue; }

        const numero = (n.name || `NC-${n.number ?? n.id.slice(0, 8)}`).trim();
        if (numerosUsados.has(numero)) {
          r.errores.push({ documento: numero, error: "esa nota ya existe en el portal" });
          continue;
        }

        const facturaId = n.invoice?.id ? facturaPorSiigo.get(n.invoice.id) ?? null : null;
        // Que no se enlace no es un fallo: puede corregir una factura
        // anterior a las que se importaron. Se cuenta y se sigue.
        if (!facturaId) r.sinFactura++;

        const fecha = n.date ? new Date(n.date + "T12:00:00-05:00") : new Date();

        try {
          if (!ensayo) {
            await prisma.notaCredito.create({
              data: {
                siigoId: n.id,
                numero,
                clienteId,
                facturaId,
                fecha,
                motivo: MOTIVOS[String(n.reason ?? "")] ?? (n.reason ? `Motivo ${n.reason}` : null),
                total: Number(n.total ?? 0),
                estadoDian: estadoDian(n.stamp?.status),
                cufe: n.stamp?.cufe ?? null,
                notas: n.observations ? String(n.observations).slice(0, 2000) : null,
                createdAt: fecha,
              },
            });
          }
          numerosUsados.add(numero);
          yaImportadas.add(n.id);
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
