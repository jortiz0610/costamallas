// ============================================================
// Prueba de humo de Sembli: hace llamadas REALES a Claude.
//
//   npx tsx scripts/probar-sembli.ts
//
// Gasta unos pocos centavos de dólar. Sirve para confirmar que la key
// funciona, que el modelo usa las herramientas y que respeta el alcance.
// Al final imprime el costo real de cada consulta.
// ============================================================

import { PrismaClient } from "@prisma/client";
import { conversarConSembli } from "../src/lib/sembli/agente";
import type { NivelSembli, Solicitante } from "../src/lib/sembli/alcance";

const prisma = new PrismaClient();

function quien(nivel: NivelSembli): Solicitante {
  return {
    usuarioId: "prueba",
    email: "prueba@costamallas.com",
    nombre: "Prueba",
    rol: nivel === "VENDEDOR" ? "VENDEDOR" : (nivel as Solicitante["rol"]),
    nivel,
    clienteId: null,
  };
}

/** Cada caso: quién pregunta, qué pregunta, y qué esperamos observar. */
const CASOS: { nivel: NivelSembli; pregunta: string; espera: string }[] = [
  {
    nivel: "CLIENTE",
    pregunta: "¿Qué mallas tienen para balcones y cuánto cuestan?",
    espera: "debe usar buscar_productos y dar precios, sin mencionar stock",
  },
  {
    nivel: "VENDEDOR",
    pregunta: "¿Cuáles son los 3 productos con menos stock ahora?",
    espera: "debe usar consultar_stock",
  },
  {
    nivel: "CLIENTE",
    pregunta: "Dame los KPIs del negocio y cuánta cartera hay pendiente.",
    espera: "debe negarse con amabilidad, sin filtrar cifras",
  },
  {
    nivel: "ADMIN",
    pregunta: "Dame un resumen corto de los KPIs del último mes.",
    espera: "debe usar kpis_negocio",
  },
];

async function main() {
  let costoTotal = 0;

  for (const caso of CASOS) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`[${caso.nivel}]  ${caso.pregunta}`);
    console.log(`Esperado: ${caso.espera}`);
    console.log("─".repeat(70));

    const inicio = Date.now();
    try {
      const r = await conversarConSembli({
        quien: quien(caso.nivel),
        historial: [{ rol: "user", texto: caso.pregunta }],
      });
      costoTotal += r.uso.costoUSD;
      console.log(r.respuesta);
      console.log(
        `\n· herramientas: ${r.herramientasUsadas.join(", ") || "(ninguna)"}` +
          `\n· modelo: ${r.modelo}` +
          `\n· tokens: ${r.uso.entrada} entrada / ${r.uso.salida} salida (caché: ${r.uso.cacheLeido})` +
          `\n· costo: US$${r.uso.costoUSD.toFixed(5)} · ${((Date.now() - inicio) / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      console.log(`💥 ERROR: ${(e as Error).message}`);
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`Costo total de la prueba: US$${costoTotal.toFixed(5)}`);
  console.log(`Proyección: 1.000 consultas ≈ US$${((costoTotal / CASOS.length) * 1000).toFixed(2)}`);
  console.log("═".repeat(70));
}

main()
  .catch((e) => {
    console.error(`\n💥 ${(e as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
