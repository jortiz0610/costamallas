// ============================================================
// Respalda y borra las cotizaciones de la numeración vieja
// (COT-00001 … COT-00009).
//
//   npx tsx scripts/respaldar-y-borrar-cot-viejas.ts            (solo respalda)
//   npx tsx scripts/respaldar-y-borrar-cot-viejas.ts --borrar   (respalda y borra)
//
// Por qué existe: gerencia decidió borrarlas todas, incluidas COT-00002
// y COT-00004, que están APROBADAS y tienen pedido. Es irreversible y
// hay 4 pedidos nacidos de esas ofertas, así que:
//
//   1. Se exportan las 9 COMPLETAS —con sus ítems, su cliente y los
//      pedidos que engendraron— a un JSON en docs/, que se commitea.
//   2. Solo entonces se borra, y solo con --borrar.
//
// ⚠️ `onDelete: SetNull` en Pedido.cotizacionId: los pedidos NO se
// borran, se quedan huérfanos de su cotización. Eso es lo correcto —un
// pedido entregado es una venta real— pero hay que saberlo: después de
// esto, esos 4 pedidos no tendrán oferta de origen. Por eso el respaldo
// los incluye.
// ============================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

(process.env as Record<string, string>).NODE_ENV = "production";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

const NUMEROS = Array.from({ length: 9 }, (_, i) => `COT-0000${i + 1}`);
const DESTINO = "docs/respaldo-cotizaciones-00001-00009.json";

async function main() {
  const borrar = process.argv.includes("--borrar");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`Servidor: ${host}\n`);

    const cotizaciones = await prisma.cotizacion.findMany({
      where: { numero: { in: NUMEROS } },
      include: {
        items: { orderBy: { orden: "asc" } },
        cliente: true,
        vendedor: { select: { id: true, nombre: true, email: true } },
        seguimientos: true,
        pedidos: { include: { items: true, instalacion: true } },
      },
      orderBy: { numero: "asc" },
    });

    if (cotizaciones.length === 0) {
      console.log("No queda ninguna de las nueve. Nada que hacer.");
      return;
    }

    console.log(`Encontradas ${cotizaciones.length} de ${NUMEROS.length}:\n`);
    for (const c of cotizaciones) {
      console.log(
        `  ${c.numero}  ${c.estado.padEnd(10)} ${Number(c.total).toLocaleString("es-CO").padStart(12)}  ` +
        `${c.items.length} ítem(s)  ${c.pedidos.length} pedido(s)  ${c.cliente.nombre.slice(0, 28)}`,
      );
    }

    const respaldo = {
      generadoEn: new Date().toISOString(),
      motivo:
        "Gerencia pidió borrar la numeración vieja COT-00001..09. Se exporta " +
        "antes porque es irreversible y cuatro pedidos nacieron de estas ofertas.",
      advertencia:
        "Los PEDIDOS no se borraron: Pedido.cotizacionId es SetNull, así que " +
        "siguen existiendo sin oferta de origen. Aquí queda su contenido.",
      numerosPedidos: NUMEROS,
      total: cotizaciones.length,
      cotizaciones,
    };

    mkdirSync(dirname(DESTINO), { recursive: true });
    // El replacer convierte los Decimal de Prisma a número: si no,
    // JSON.stringify los escribe como objetos y el respaldo no sirve
    // para leer una cifra.
    writeFileSync(
      DESTINO,
      JSON.stringify(respaldo, (_k, v) => {
        if (typeof v === "bigint") return v.toString();
        if (v && typeof v === "object" && typeof (v as { toNumber?: () => number }).toNumber === "function") {
          return (v as { toNumber: () => number }).toNumber();
        }
        return v;
      }, 2),
      "utf8",
    );
    console.log(`\nRespaldo escrito en ${DESTINO}`);

    if (!borrar) {
      console.log("\nNo se borró nada. Para borrar: --borrar");
      return;
    }

    // Antes de borrar, dejar constancia en los pedidos que se quedan
    // huérfanos, para que dentro de seis meses se sepa de dónde salieron.
    const pedidos = cotizaciones.flatMap(c =>
      c.pedidos.map(p => ({ id: p.id, numero: p.numero, cot: c.numero })),
    );
    for (const p of pedidos) {
      await prisma.pedido.update({
        where: { id: p.id },
        data: {
          origenRef: p.cot,
          notas: [
            `Nació de ${p.cot}, borrada el ${new Date().toLocaleDateString("es-CO")} por decisión de gerencia.`,
            `El contenido de esa oferta está en ${DESTINO}.`,
          ].join(" "),
        },
      });
    }
    if (pedidos.length) console.log(`\n${pedidos.length} pedido(s) anotados con su oferta de origen.`);

    const { count } = await prisma.cotizacion.deleteMany({
      where: { numero: { in: NUMEROS } },
    });
    console.log(`${count} cotizaciones borradas.`);

    const quedan = await prisma.cotizacion.count({ where: { numero: { in: NUMEROS } } });
    console.log(quedan === 0 ? "Comprobado: no queda ninguna." : `⚠️ Quedan ${quedan}.`);

    // Los clientes de esas ofertas cambian de estado al quedarse sin ellas.
    const { recalcularEstados } = await import("../src/lib/estados-cliente-server");
    const r = await recalcularEstados({
      clienteIds: [...new Set(cotizaciones.map(c => c.clienteId))],
    });
    console.log(`Estados recalculados: ${r.cambiados} de ${r.revisados} clientes cambiaron.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
