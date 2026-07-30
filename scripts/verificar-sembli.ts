// ============================================================
// Verifica la jerarquía de acceso de Sembli contra la base de datos real.
//
//   npx tsx scripts/verificar-sembli.ts
//
// Comprueba lo que de verdad importa: que el filtrado por rol ocurre en el
// servidor y no depende de que el modelo obedezca el prompt.
// NO llama a la API de Anthropic, así que no cuesta tokens.
// ============================================================

import { PrismaClient } from "@prisma/client";
import { herramientasPara, ejecutarHerramienta } from "../src/lib/sembli/herramientas";
import { nivelDeRol, type NivelSembli, type Solicitante } from "../src/lib/sembli/alcance";

const prisma = new PrismaClient();

let ok = 0;
let fallos = 0;

function afirmar(descripcion: string, condicion: boolean, detalle = "") {
  if (condicion) {
    ok++;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos++;
    console.log(`  ✗ ${descripcion}${detalle ? `  → ${detalle}` : ""}`);
  }
}

function quien(nivel: NivelSembli, clienteId?: string | null): Solicitante {
  return {
    usuarioId: "prueba",
    email: "prueba@costamallas.com",
    rol: nivel === "VENDEDOR" ? "VENDEDOR" : (nivel as Solicitante["rol"]),
    nivel,
    clienteId: clienteId ?? null,
  };
}

async function main() {
  console.log("\n── Mapeo de roles a niveles ──");
  afirmar("SUPERADMIN → SUPERADMIN", nivelDeRol("SUPERADMIN") === "SUPERADMIN");
  afirmar("ADMIN → ADMIN", nivelDeRol("ADMIN") === "ADMIN");
  afirmar("VENDEDOR → VENDEDOR", nivelDeRol("VENDEDOR") === "VENDEDOR");
  afirmar("CLIENTE → CLIENTE", nivelDeRol("CLIENTE") === "CLIENTE");
  afirmar("SOLO_LECTURA cae a CLIENTE", nivelDeRol("SOLO_LECTURA") === "CLIENTE");
  afirmar("rol desconocido cae a CLIENTE (fail-closed)", nivelDeRol("HACKER") === "CLIENTE");
  afirmar("rol vacío cae a CLIENTE", nivelDeRol(undefined) === "CLIENTE");

  console.log("\n── Herramientas visibles por nivel ──");
  const porNivel = (["CLIENTE", "VENDEDOR", "ADMIN", "SUPERADMIN"] as const).map((n) => ({
    nivel: n,
    cuantas: herramientasPara(n).length,
    nombres: herramientasPara(n).map((h) => h.nombre),
  }));
  porNivel.forEach((p) => console.log(`  ${p.nivel.padEnd(11)} ${p.cuantas} → ${p.nombres.join(", ")}`));
  afirmar(
    "el conjunto crece con el nivel (nunca al revés)",
    porNivel[0].cuantas < porNivel[1].cuantas &&
      porNivel[1].cuantas < porNivel[2].cuantas &&
      porNivel[2].cuantas < porNivel[3].cuantas,
  );
  afirmar(
    "el CLIENTE no ve ninguna herramienta de stock/CRM/admin",
    !porNivel[0].nombres.some((n) =>
      ["consultar_stock", "buscar_clientes", "consultar_ventas", "kpis_negocio", "estado_sistema"].includes(n),
    ),
  );

  console.log("\n── Escalada de privilegios bloqueada en el servidor ──");
  // Aquí está lo importante: aunque el modelo invente la llamada, el
  // ejecutor la rechaza porque revalida el nivel.
  const intentos: [NivelSembli, string][] = [
    ["CLIENTE", "consultar_stock"],
    ["CLIENTE", "kpis_negocio"],
    ["CLIENTE", "estado_sistema"],
    ["VENDEDOR", "kpis_negocio"],
    ["VENDEDOR", "consultar_facturacion"],
    ["VENDEDOR", "estado_sistema"],
    ["ADMIN", "estado_sistema"],
  ];
  for (const [nivel, herramienta] of intentos) {
    const r = await ejecutarHerramienta(herramienta, {}, quien(nivel));
    afirmar(
      `${nivel} NO puede usar ${herramienta}`,
      r.error === true && String(r.resultado).includes("Sin permiso"),
      String(r.resultado).slice(0, 80),
    );
  }

  console.log("\n── Los niveles altos sí pueden ──");
  for (const [nivel, herramienta] of [
    ["VENDEDOR", "consultar_stock"],
    ["ADMIN", "kpis_negocio"],
    ["SUPERADMIN", "estado_sistema"],
  ] as [NivelSembli, string][]) {
    const r = await ejecutarHerramienta(herramienta, {}, quien(nivel));
    afirmar(`${nivel} sí puede usar ${herramienta}`, r.error === false, String(r.resultado).slice(0, 100));
  }

  console.log("\n── Fuga de datos internos al cliente ──");
  const comoCliente = await ejecutarHerramienta("buscar_productos", { limite: 3 }, quien("CLIENTE"));
  const comoVendedor = await ejecutarHerramienta("buscar_productos", { limite: 3 }, quien("VENDEDOR"));
  const jsonCliente = JSON.stringify(comoCliente.resultado);
  afirmar("buscar_productos no falla para el cliente", comoCliente.error === false);
  afirmar('el cliente NO recibe el campo "stock"', !jsonCliente.includes('"stock"'), jsonCliente.slice(0, 120));
  afirmar('el cliente NO recibe "intEstado"', !jsonCliente.includes("intEstado"));
  afirmar(
    'el vendedor SÍ recibe "stock"',
    JSON.stringify(comoVendedor.resultado).includes('"stock"'),
  );

  console.log("\n── Aislamiento entre clientes ──");
  const sinVinculo = await ejecutarHerramienta("mis_pedidos", {}, quien("CLIENTE", null));
  afirmar(
    "un cliente sin ficha vinculada no ve pedidos de nadie",
    JSON.stringify(sinVinculo.resultado).includes("no está vinculado"),
    JSON.stringify(sinVinculo.resultado).slice(0, 90),
  );

  // Con un cliente real de la BD: sus pedidos deben ser solo suyos.
  const alguien = await prisma.cliente.findFirst({
    where: { pedidos: { some: {} } },
    select: { id: true, nombre: true },
  });
  if (alguien) {
    const suyos = await ejecutarHerramienta("mis_pedidos", {}, quien("CLIENTE", alguien.id));
    const totalEnSistema = await prisma.pedido.count();
    const devueltos = (suyos.resultado as { pedidos: unknown[] }).pedidos.length;
    const propios = await prisma.pedido.count({ where: { clienteId: alguien.id } });
    afirmar(
      `"${alguien.nombre}" recibe solo sus ${propios} pedido(s), no los ${totalEnSistema} del sistema`,
      devueltos === Math.min(propios, 10),
      `devueltos=${devueltos} propios=${propios}`,
    );
  } else {
    console.log("  – sin pedidos en la BD: se omite la prueba de aislamiento real");
  }

  console.log("\n── Herramienta inexistente ──");
  const fantasma = await ejecutarHerramienta("borrar_todo", {}, quien("SUPERADMIN"));
  afirmar("una herramienta inventada se rechaza", fantasma.error === true);

  console.log(`\n${fallos === 0 ? "✅" : "❌"}  ${ok} correctas, ${fallos} fallidas\n`);
  if (fallos > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`\n💥 ${(e as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
