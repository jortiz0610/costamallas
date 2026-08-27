// ============================================================
// Comprueba que EDITAR una cotización no le cambie el total sola.
//
//   npx tsx scripts/probar-editar-cotizacion.ts
//
// Es el riesgo real de esta función. Al abrir una cotización guardada, la
// pantalla tiene que reconstruir cosas que NO se guardan tal cual:
//
//   · el descuento global, que se guarda como monto y no como %
//   · si la administración y los imprevistos se escribieron a mano o
//     salieron del porcentaje
//   · la línea del recargo por ciudad, que la pantalla agrega sola y hay
//     que descartar al recargar para que no se duplique
//
// Si alguna de esas reconstrucciones pierde información, abrir una
// oferta y darle "Guardar" le cambia el precio sin que nadie lo pida —
// y eso es exactamente lo que no puede pasar con algo que ya se le mandó
// a un cliente.
//
// Lógica pura: no toca la base ni la red.
// ============================================================

import { calcularCotizacion, leerAIU } from "../src/lib/cotizacion-calculo";

let fallos = 0;
const f = (n: number) => "$ " + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
const igual = (a: number, b: number) => Math.abs(a - b) < 1;

function comprobar(titulo: string, ok: boolean, detalle = "") {
  console.log(`  ${ok ? "✔" : "✘"} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

const PREFIJO_RECARGO = "Desplazamiento y viáticos";

/** Lo que hace la pantalla al abrir una cotización guardada. */
function recargar(guardado: {
  subtotal: number; descuento: number;
  items: { descripcion: string; cantidad: number; precioUnitario: number; descuento: number; tipo: string; subtotal: number }[];
  aiuActivo: boolean; aiuAdminPct: number; aiuImprevPct: number; aiuUtilidadPct: number;
  aiuAdmin: number; aiuImprev: number; aiuUtilidad: number;
}) {
  // El descuento global se deduce del monto guardado.
  const bruto = guardado.subtotal;
  const descuentoGlobal = bruto > 0 ? Math.round((guardado.descuento / bruto) * 10000) / 100 : 0;

  // La línea del recargo se descarta: se vuelve a calcular sola.
  const items = guardado.items.filter(i => !i.descripcion.startsWith(PREFIJO_RECARGO));

  // La base del AIU es TODO el subtotal ya descontado (corregido el
  // 27-ago con la contadora): en un contrato de obra el material es
  // costo directo, no una venta aparte.
  const baseAIU = items.reduce((a, i) => a + i.subtotal, 0) * (1 - descuentoGlobal / 100);
  const manual = (monto: number, pct: number) => {
    if (!monto) return "";
    const delPct = (pct / 100) * baseAIU;
    return Math.abs(monto - delPct) < 1 ? "" : String(Math.round(monto));
  };

  return {
    descuentoGlobal,
    items,
    aiuMonto: {
      admin: manual(guardado.aiuAdmin, guardado.aiuAdminPct),
      imprev: manual(guardado.aiuImprev, guardado.aiuImprevPct),
      utilidad: manual(guardado.aiuUtilidad, guardado.aiuUtilidadPct),
    },
  };
}

/** Guarda, recarga y vuelve a guardar. El total no puede moverse. */
function ciclo(nombre: string, items: Parameters<typeof calcularCotizacion>[0] & { descripcion?: string }[], descGlobal: number, aiu: Parameters<typeof calcularCotizacion>[2]) {
  const conDesc = items as unknown as { descripcion: string; cantidad: number; precioUnitario: number; descuento: number; tipo: string }[];

  const primera = calcularCotizacion(items, descGlobal, aiu);
  const guardado = {
    subtotal: primera.subtotal,
    descuento: primera.descuento,
    items: conDesc.map(i => ({
      ...i,
      subtotal: i.cantidad * i.precioUnitario * (1 - (i.descuento ?? 0) / 100),
    })),
    aiuActivo: primera.aiuActivo,
    aiuAdminPct: aiu!.adminPct, aiuImprevPct: aiu!.imprevPct, aiuUtilidadPct: aiu!.utilidadPct,
    aiuAdmin: primera.admin, aiuImprev: primera.imprevistos, aiuUtilidad: primera.utilidad,
  };

  const vuelto = recargar(guardado);
  const monto = (v: string) => (v.trim() === "" ? null : Number(v));
  const segunda = calcularCotizacion(vuelto.items, vuelto.descuentoGlobal, {
    activo: guardado.aiuActivo,
    adminPct: guardado.aiuAdminPct, imprevPct: guardado.aiuImprevPct, utilidadPct: guardado.aiuUtilidadPct,
    adminMonto: monto(vuelto.aiuMonto.admin),
    imprevMonto: monto(vuelto.aiuMonto.imprev),
    utilidadMonto: monto(vuelto.aiuMonto.utilidad),
  });

  console.log(`\n   ${nombre}`);
  console.log(`     guardada  total ${f(primera.total)}  ·  IVA ${f(primera.iva)}`);
  console.log(`     reabierta total ${f(segunda.total)}  ·  IVA ${f(segunda.iva)}`);
  comprobar("     el total no cambia al reabrir y guardar", igual(primera.total, segunda.total),
    igual(primera.total, segunda.total) ? "" : `se movió ${f(segunda.total - primera.total)}`);
  comprobar("     el IVA no cambia", igual(primera.iva, segunda.iva));
  comprobar("     el descuento global se dedujo bien", igual(vuelto.descuentoGlobal, descGlobal),
    `${vuelto.descuentoGlobal}% vs ${descGlobal}%`);
  return { primera, segunda, vuelto };
}

console.log("\n1. IDA Y VUELTA — abrir y volver a guardar\n");

ciclo("Material suelto, sin descuento",
  [{ descripcion: "Malla eslabonada", cantidad: 10, precioUnitario: 120_000, descuento: 0, tipo: "PRODUCTO" }] as never,
  0, { activo: false, adminPct: 10, imprevPct: 5, utilidadPct: 10 });

ciclo("Material con 12,5 % de descuento global",
  [{ descripcion: "Malla eslabonada", cantidad: 7, precioUnitario: 133_333, descuento: 0, tipo: "PRODUCTO" }] as never,
  12.5, { activo: false, adminPct: 10, imprevPct: 5, utilidadPct: 10 });

ciclo("Obra con AIU por porcentaje",
  [{ descripcion: "Cerramiento", cantidad: 1350, precioUnitario: 88_178.638, descuento: 0, tipo: "INSTALACION" }] as never,
  0, { activo: true, adminPct: 10, imprevPct: 5, utilidadPct: 10 });

const conManual = ciclo("Obra con administración e imprevistos a mano (la hoja real)",
  [{ descripcion: "Cerramiento", cantidad: 1350, precioUnitario: 88_178.638, descuento: 0, tipo: "INSTALACION" }] as never,
  0, {
    activo: true, adminPct: 10, imprevPct: 5, utilidadPct: 10,
    adminMonto: 15_690_000, imprevMonto: 7_995_000, utilidadMonto: null,
  });

console.log("");
comprobar("los montos escritos a mano se reconocen al reabrir",
  conManual.vuelto.aiuMonto.admin === "15690000" && conManual.vuelto.aiuMonto.imprev === "7995000",
  `admin "${conManual.vuelto.aiuMonto.admin}" · imprev "${conManual.vuelto.aiuMonto.imprev}"`);
comprobar("la utilidad, que salió del %, vuelve vacía",
  conManual.vuelto.aiuMonto.utilidad === "",
  "así la casilla se ve calculada y no fija");
comprobar("y el total sigue siendo el de la hoja", igual(conManual.segunda.total, 156_892_059), f(conManual.segunda.total));

ciclo("Oferta mixta con descuento y AIU",
  [
    { descripcion: "Malla", cantidad: 100, precioUnitario: 50_000, descuento: 0, tipo: "PRODUCTO" },
    { descripcion: "Instalación", cantidad: 1, precioUnitario: 10_000_000, descuento: 0, tipo: "INSTALACION" },
  ] as never,
  10, { activo: true, adminPct: 10, imprevPct: 5, utilidadPct: 10 });

// ── 2. El recargo por ciudad no se puede duplicar ───────────
console.log("\n\n2. LA LÍNEA DEL RECARGO POR CIUDAD\n");
{
  const guardado = {
    subtotal: 11_000_000, descuento: 0,
    items: [
      { descripcion: "Instalación de cerramiento", cantidad: 1, precioUnitario: 10_000_000, descuento: 0, tipo: "INSTALACION", subtotal: 10_000_000 },
      { descripcion: `${PREFIJO_RECARGO} — Santa Marta`, cantidad: 1, precioUnitario: 1_000_000, descuento: 0, tipo: "INSTALACION", subtotal: 1_000_000 },
    ],
    aiuActivo: true, aiuAdminPct: 10, aiuImprevPct: 5, aiuUtilidadPct: 10,
    aiuAdmin: 1_100_000, aiuImprev: 550_000, aiuUtilidad: 1_100_000,
  };
  const v = recargar(guardado);
  comprobar("la línea del recargo se descarta al reabrir", v.items.length === 1, `quedaron ${v.items.length} línea(s)`);
  comprobar("no queda ninguna línea de desplazamiento",
    !v.items.some(i => i.descripcion.startsWith(PREFIJO_RECARGO)),
    "si se conservara, se sumaría otra en cada guardado");
  comprobar("las líneas del asesor sí se conservan", v.items[0].descripcion === "Instalación de cerramiento");
}

// ── 3. Qué estados se dejan editar ──────────────────────────
console.log("\n3. QUÉ SE DEJA EDITAR\n");
{
  const EDITABLES = new Set(["BORRADOR", "ENVIADA"]);
  const casos: [string, boolean, string][] = [
    ["BORRADOR", true, "todavía no ha salido de la casa"],
    ["ENVIADA", true, "se permite, pero la pantalla avisa que el cliente tiene el enlace"],
    ["APROBADA", false, "ya generó un pedido"],
    ["RECHAZADA", false, "es historia"],
    ["VENCIDA", false, "es historia"],
  ];
  for (const [estado, esperado, porque] of casos) {
    comprobar(`${estado.padEnd(10)} ${esperado ? "se edita" : "NO se edita"}`, EDITABLES.has(estado) === esperado, porque);
  }
}

// ── 4. El AIU que llega del formulario al reabrir ───────────
console.log("\n4. SANEAMIENTO AL VOLVER A GUARDAR\n");
{
  const a = leerAIU({ aiuActivo: true, aiuAdminPct: 10, aiuAdmin: "" });
  comprobar("una casilla vacía se recalcula del porcentaje", a.adminMonto === null);
  const b = leerAIU({ aiuActivo: true, aiuAdminPct: 10, aiuAdmin: "15690000" });
  comprobar("una casilla con valor lo conserva", b.adminMonto === 15_690_000);
}

console.log(fallos === 0 ? "\n✅ Todas las comprobaciones pasaron.\n" : `\n❌ ${fallos} fallaron.\n`);
process.exit(fallos === 0 ? 0 : 1);
