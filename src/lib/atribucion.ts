// ============================================================
// Retorno REAL por fuente y campaña.
//
// El módulo de marketing mostraba un ROAS que nadie calculaba: los
// campos `leads`, `conversiones` e `ingresos` de cada campaña se teclean
// a mano en un JSON dentro de `configuracion`. Es una hoja de cálculo
// disfrazada de indicador: dice lo que alguien creyó, no lo que pasó.
//
// Lo que sí es real ya estaba ahí y nadie lo cruzaba: `/api/public/lead`
// guarda, por cada lead de la web, el `clienteId` que creó en el CRM
// junto con sus UTM. Ese es el eslabón. Con él se puede seguir la
// cadena entera sin inventar nada:
//
//   lead (utm_source, utm_campaign) → cliente → cotizaciones → pedidos
//
// Y de ahí sale la plata de verdad: cuánto se cotizó y cuánto se cerró
// por cada fuente. La inversión se sigue tecleando —eso viene de la
// plataforma de anuncios y no hay forma de saberlo desde aquí— pero
// dividir plata real entre inversión real ya es un ROAS que se sostiene.
//
// Todo esto es de solo lectura y no necesitó tocar el esquema.
// ============================================================

import { prisma } from "@/lib/prisma";

/** Una entrada del JSON que escribe /api/public/lead. */
interface LeadCrudo {
  clienteId?: string;
  nombre?: string;
  fuente?: string;
  utm_source?: string | null;
  utm_campaign?: string | null;
  producto?: string | null;
  fecha?: string;
}

export interface FilaRetorno {
  clave: string;
  fuente: string;
  campana: string | null;
  leads: number;
  /** Leads que llegaron a tener al menos una cotización. */
  cotizados: number;
  /** Leads con al menos un pedido (venta cerrada). */
  cerrados: number;
  valorCotizado: number;
  valorCerrado: number;
  /** De cada 100 leads, cuántos terminaron comprando. */
  tasaCierre: number;
  /** Plata cerrada por lead. Es lo que vale traer uno más de esa fuente. */
  valorPorLead: number;
}

export interface Retorno {
  ventanaDias: number;
  desde: Date;
  resumen: {
    leads: number;
    conCliente: number;
    cotizados: number;
    cerrados: number;
    valorCotizado: number;
    valorCerrado: number;
    tasaCierre: number;
  };
  filas: FilaRetorno[];
  /** Leads del JSON que no traen clienteId: no se pueden seguir. */
  sinRastro: number;
}

export async function calcularRetorno(dias: number): Promise<Retorno> {
  const desde = new Date(Date.now() - dias * 86_400_000);

  const fila = await prisma.configuracion.findUnique({
    where: { clave: "marketing_leads" },
    select: { valor: true },
  });

  let leads: LeadCrudo[] = [];
  try {
    const parsed = JSON.parse(fila?.valor ?? "[]");
    if (Array.isArray(parsed)) leads = parsed as LeadCrudo[];
  } catch {
    // Un JSON corrupto deja el informe en cero, no lo tumba.
  }

  const enVentana = leads.filter(l => {
    if (!l.fecha) return false;
    const f = new Date(l.fecha);
    return !Number.isNaN(f.getTime()) && f >= desde;
  });

  const conCliente = enVentana.filter(l => l.clienteId);
  const sinRastro = enVentana.length - conCliente.length;
  const clienteIds = [...new Set(conCliente.map(l => l.clienteId!))];

  // Una sola consulta por tabla. Se traen los totales por cliente y se
  // cruzan en memoria: son cientos de filas, no millones.
  const [cotizaciones, pedidos] = clienteIds.length
    ? await Promise.all([
        prisma.cotizacion.groupBy({
          by: ["clienteId"],
          where: { clienteId: { in: clienteIds }, estado: { not: "BORRADOR" } },
          _sum: { total: true },
          _count: { _all: true },
        }),
        prisma.pedido.groupBy({
          by: ["clienteId"],
          // Un pedido cancelado no es una venta.
          where: { clienteId: { in: clienteIds }, estado: { not: "CANCELADO" } },
          _sum: { total: true },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const cotPorCliente = new Map(cotizaciones.map(c => [c.clienteId, Number(c._sum.total ?? 0)]));
  const pedPorCliente = new Map(pedidos.map(p => [p.clienteId, Number(p._sum.total ?? 0)]));

  // Agrupado por fuente + campaña. Un lead sin campaña se agrupa igual,
  // porque el tráfico orgánico también trae ventas y dejarlo fuera haría
  // parecer que todo viene de anuncios.
  const grupos = new Map<string, FilaRetorno>();

  for (const l of conCliente) {
    const fuente = (l.utm_source || l.fuente || "directo").toLowerCase();
    const campana = l.utm_campaign || null;
    const clave = `${fuente}|${campana ?? ""}`;

    const g = grupos.get(clave) ?? {
      clave, fuente, campana,
      leads: 0, cotizados: 0, cerrados: 0,
      valorCotizado: 0, valorCerrado: 0, tasaCierre: 0, valorPorLead: 0,
    };

    g.leads++;
    const cot = cotPorCliente.get(l.clienteId!) ?? 0;
    const ped = pedPorCliente.get(l.clienteId!) ?? 0;
    if (cot > 0) { g.cotizados++; g.valorCotizado += cot; }
    if (ped > 0) { g.cerrados++; g.valorCerrado += ped; }

    grupos.set(clave, g);
  }

  const filas = [...grupos.values()]
    .map(g => ({
      ...g,
      tasaCierre: g.leads ? Math.round((g.cerrados / g.leads) * 100) : 0,
      valorPorLead: g.leads ? Math.round(g.valorCerrado / g.leads) : 0,
    }))
    .sort((a, b) => b.valorCerrado - a.valorCerrado || b.leads - a.leads);

  const totalCerrados = filas.reduce((s, f) => s + f.cerrados, 0);

  return {
    ventanaDias: dias,
    desde,
    resumen: {
      leads: enVentana.length,
      conCliente: conCliente.length,
      cotizados: filas.reduce((s, f) => s + f.cotizados, 0),
      cerrados: totalCerrados,
      valorCotizado: filas.reduce((s, f) => s + f.valorCotizado, 0),
      valorCerrado: filas.reduce((s, f) => s + f.valorCerrado, 0),
      tasaCierre: conCliente.length ? Math.round((totalCerrados / conCliente.length) * 100) : 0,
    },
    filas,
    sinRastro,
  };
}
