// ============================================================
// Un cliente de capacitación tiene que poder recorrer TODO el proceso.
//
//   npx tsx scripts/probar-capacitacion.ts
//
// Antes esto se moría en la cotización: el pedido nacía marcado, pero el
// pipeline escondía lo de prueba y no había dónde seguirlo. Esta prueba
// va cliente → cotización → pedido → instalación → factura y comprueba
// las dos cosas que importan: que el proceso avanza, y que nada de eso
// se cuela en los informes ni en los consecutivos reales.
//
// Contra PRODUCCIÓN. Crea y borra lo suyo.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env["__" + m[1]]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env["__" + m[1]] = "1";
  }
}

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const {
    clienteEsDePrueba, siguienteNumeroPrueba, siguienteNumeroPruebaPedido,
    borrarPruebas, SIN_PRUEBAS,
  } = await import("../src/lib/cotizaciones-prueba");
  const { crearPedidoDeAprobacion } = await import("../src/lib/aprobar-cotizacion");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  // El consecutivo real ANTES de todo. Es la comprobación que más importa.
  const antesCOT = (await prisma.configuracion.findFirst({ where: { clave: "consecutivo_cotizacion" } }))?.valor ?? "?";
  const antesPED = (await prisma.configuracion.findFirst({ where: { clave: "consecutivo_pedido" } }))?.valor ?? "?";
  console.log(`  Consecutivos reales de partida: COT=${antesCOT} · PED=${antesPED}\n`);

  let clienteId: string | null = null;

  try {
    console.log("═══ 1. El cliente ═══\n");

    const cliente = await prisma.cliente.create({
      data: { nombre: "VERIF Capacitación", tipo: "persona", estado: "PROSPECTO", esPrueba: true },
      select: { id: true },
    });
    clienteId = cliente.id;
    comprobar("se puede marcar un cliente como de capacitación", await clienteEsDePrueba(cliente.id));

    const otro = await prisma.cliente.findFirst({ where: { esPrueba: false }, select: { id: true } });
    comprobar("y uno normal NO lo está", !(await clienteEsDePrueba(otro?.id)));

    console.log("\n═══ 2. La cotización ═══\n");

    const numero = await siguienteNumeroPrueba();
    comprobar("la oferta lleva numeración aparte", numero.startsWith("PRUEBA-"), numero);

    const cot = await prisma.cotizacion.create({
      data: {
        numero, clienteId: cliente.id, estado: "BORRADOR", esPrueba: true,
        total: 195000, tieneInstalacion: true,
        items: { create: [{ descripcion: "Kit malla balcón", cantidad: 1, precioUnitario: 195000, subtotal: 195000, orden: 0 }] },
      },
      select: { id: true, numero: true },
    });
    comprobar("se crea", Boolean(cot.id));

    console.log("\n═══ 3. Avanza el proceso (lo que antes NO pasaba) ═══\n");

    await prisma.cotizacion.update({ where: { id: cot.id }, data: { estado: "ENVIADA" } });
    const r = await crearPedidoDeAprobacion(cot.id, null);
    comprobar("aprobar la oferta crea el pedido", Boolean(r.pedidoNumero), JSON.stringify(r));
    comprobar("y el pedido NO gasta un número real",
      (r.pedidoNumero ?? "").startsWith("PRUEBA-PED-"), r.pedidoNumero ?? "");

    const pedido = await prisma.pedido.findFirst({
      where: { cotizacionId: cot.id },
      select: { id: true, esPrueba: true, instalacion: { select: { id: true } } },
    });
    comprobar("el pedido hereda la marca", pedido?.esPrueba === true);
    comprobar("y trae su instalación, como cualquier pedido con obra",
      Boolean(pedido?.instalacion), pedido?.instalacion ? "sí" : "no");

    if (pedido?.instalacion) {
      await prisma.instalacion.update({
        where: { id: pedido.instalacion.id },
        data: { esPrueba: true, estado: "COMPLETADA" },
      });
      comprobar("la instalación se puede completar, igual que una real", true);
    }

    const factura = await prisma.factura.create({
      data: {
        numero: `PRUEBA-FAC-${Date.now()}`, clienteId: cliente.id,
        subtotal: 195000, total: 195000, esPrueba: true,
      },
      select: { id: true },
    });
    comprobar("y hasta se puede facturar", Boolean(factura.id));

    console.log("\n═══ 4. Nada de esto ensucia el negocio ═══\n");

    const despuesCOT = (await prisma.configuracion.findFirst({ where: { clave: "consecutivo_cotizacion" } }))?.valor ?? "?";
    const despuesPED = (await prisma.configuracion.findFirst({ where: { clave: "consecutivo_pedido" } }))?.valor ?? "?";
    comprobar("el consecutivo real de COT no se movió", despuesCOT === antesCOT, `${antesCOT} → ${despuesCOT}`);
    comprobar("el de PED tampoco", despuesPED === antesPED, `${antesPED} → ${despuesPED}`);

    const enInformes = await prisma.cotizacion.count({ where: { ...SIN_PRUEBAS, id: cot.id } });
    comprobar("la oferta no entra en los informes", enInformes === 0);
    const pedidoEnInformes = await prisma.pedido.count({ where: { ...SIN_PRUEBAS, id: pedido?.id ?? "-" } });
    comprobar("el pedido tampoco", pedidoEnInformes === 0);

    console.log("\n═══ 5. Se borra todo de una ═══\n");

    const cuenta = await borrarPruebas({ dry: true, clienteId: cliente.id });
    comprobar("el conteo previo ve la cotización", cuenta.cotizaciones >= 1, String(cuenta.cotizaciones));
    comprobar("y el pedido", cuenta.pedidos >= 1, String(cuenta.pedidos));
    comprobar("y la instalación", cuenta.instalaciones >= 1, String(cuenta.instalaciones));
    comprobar("y la factura", cuenta.facturas >= 1, String(cuenta.facturas));
    comprobar("contar NO borra", (await prisma.cotizacion.count({ where: { id: cot.id } })) === 1);

    await borrarPruebas({ clienteId: cliente.id, incluirCliente: true });
    comprobar("después de borrar no queda la cotización",
      (await prisma.cotizacion.count({ where: { id: cot.id } })) === 0);
    comprobar("ni el pedido",
      (await prisma.pedido.count({ where: { id: pedido?.id ?? "-" } })) === 0);
    comprobar("ni la factura",
      (await prisma.factura.count({ where: { id: factura.id } })) === 0);
    comprobar("ni el cliente",
      (await prisma.cliente.count({ where: { id: cliente.id } })) === 0);
    clienteId = null;
  } finally {
    if (clienteId) {
      await borrarPruebas({ clienteId, incluirCliente: true }).catch(() => {});
      await prisma.cliente.deleteMany({ where: { id: clienteId } }).catch(() => {});
      console.log("\n  (limpieza de emergencia hecha)");
    }
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
