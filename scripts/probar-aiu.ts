// ============================================================
// Comprueba el cálculo del AIU contra una cotización REAL.
//
//   npx tsx scripts/probar-aiu.ts
//
// Es lógica pura: no toca la base de datos ni la red. Se puede correr
// siempre y en dos segundos.
//
// La referencia es la hoja de un cerramiento de 1.350 m² que la empresa
// cotizó de verdad. Si el cálculo del portal no reproduce ESE total al
// peso, no sirve — por bonito que se vea en pantalla.
//
// Lo primero que se comprueba, antes que el AIU, es que apagarlo deje
// las cuentas EXACTAMENTE como estaban. Una función nueva no puede
// cambiarle el total a las cotizaciones que ya existen.
// ============================================================

import { calcularCotizacion, AIU_DEFAULTS, leerAIU } from "../src/lib/cotizacion-calculo";

let fallos = 0;
const f = (n: number) => "$ " + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

function comprobar(titulo: string, ok: boolean, detalle = "") {
  console.log(`  ${ok ? "✔" : "✘"} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}
/** Los montos se comparan al peso: un peso de diferencia en una oferta
 *  de 156 millones se nota, y es la clase de descuadre que hace que
 *  contabilidad deje de confiar en el sistema. */
const igual = (a: number, b: number) => Math.abs(a - b) < 1;

// ── La hoja real ────────────────────────────────────────────
const HOJA = {
  descripcion: "Suministro e instalación de cerramiento, 1.350 m²",
  cantidad: 1350,
  precioUnitario: 88_178.638,     // el unitario que produce el subtotal de la hoja
  subtotal: 119_041_161,
  admin: 15_690_000,              // escrito a mano (la hoja dice 10 %, pero es 13,18 %)
  imprevistos: 7_995_000,         // escrito a mano (dice 5 %, es 6,72 %)
  utilidad: 11_904_116,           // sí es el 10 % exacto
  ivaUtilidad: 2_261_782,         // 19 % de la utilidad
  total: 156_892_059,
};

console.log("\n1. SIN AIU — nada puede cambiar para lo que ya existe\n");
{
  const items = [
    { cantidad: 10, precioUnitario: 100_000, tipo: "PRODUCTO" },
    { cantidad: 1, precioUnitario: 500_000, tipo: "INSTALACION" },
  ];
  const r = calcularCotizacion(items, 0, AIU_DEFAULTS);
  console.log(`   subtotal ${f(r.subtotal)} · IVA ${f(r.iva)} · total ${f(r.total)}`);
  comprobar("el subtotal es la suma de las líneas", igual(r.subtotal, 1_500_000));
  comprobar("el IVA es el 19 % de TODO, como siempre", igual(r.iva, 285_000));
  comprobar("el total es subtotal + IVA", igual(r.total, 1_785_000));
  comprobar("no aparece AIU", r.admin === 0 && r.imprevistos === 0 && r.utilidad === 0);
  comprobar("no hay IVA de utilidad", r.ivaUtilidad === 0);

  const conDesc = calcularCotizacion(items, 10, AIU_DEFAULTS);
  comprobar(
    "el descuento global sigue funcionando igual",
    igual(conDesc.subtotalConDesc, 1_350_000) && igual(conDesc.iva, 256_500) && igual(conDesc.total, 1_606_500),
    `total ${f(conDesc.total)}`,
  );
}

// ── 2. La hoja real, con los montos que escribió el asesor ──
console.log("\n2. LA COTIZACIÓN REAL DE LA EMPRESA\n");
console.log(`   ${HOJA.descripcion}\n`);
{
  const items = [{ cantidad: HOJA.cantidad, precioUnitario: HOJA.precioUnitario, tipo: "INSTALACION" }];
  const r = calcularCotizacion(items, 0, {
    activo: true,
    adminPct: 10, imprevPct: 5, utilidadPct: 10,
    // Administración e imprevistos van como suma fija, que es como los
    // negocia la empresa. La utilidad se deja salir del porcentaje.
    adminMonto: HOJA.admin,
    imprevMonto: HOJA.imprevistos,
    utilidadMonto: null,
  });

  const fila = (etiqueta: string, calculado: number, hoja: number) => {
    console.log(`   ${etiqueta.padEnd(18)} portal ${f(calculado).padStart(16)}   hoja ${f(hoja).padStart(16)}   ${igual(calculado, hoja) ? "✔" : "✘"}`);
    if (!igual(calculado, hoja)) fallos++;
  };
  fila("SUBTOTAL", r.subtotalConDesc, HOJA.subtotal);
  fila("ADMINISTRACIÓN", r.admin, HOJA.admin);
  fila("IMPREVISTOS", r.imprevistos, HOJA.imprevistos);
  fila("UTILIDAD", r.utilidad, HOJA.utilidad);
  fila("IVA UTILIDAD", r.ivaUtilidad, HOJA.ivaUtilidad);
  fila("TOTAL", r.total, HOJA.total);
  console.log("");
  comprobar("la utilidad salió del 10 % sin escribirla a mano", igual(r.utilidad, HOJA.utilidad));
  comprobar("el material no aporta IVA (todo es obra)", igual(r.ivaMaterial, 0));
  comprobar("el IVA cobrado es SOLO el de la utilidad", igual(r.iva, HOJA.ivaUtilidad));
}

// ── 3. Lo que hacía el portal con esa misma obra ────────────
console.log("\n3. LO QUE COBRABA EL PORTAL ANTES POR ESA OBRA\n");
{
  const items = [{ cantidad: HOJA.cantidad, precioUnitario: HOJA.precioUnitario, tipo: "INSTALACION" }];
  const viejo = calcularCotizacion(items, 0, AIU_DEFAULTS);
  console.log(`   IVA sobre todo el subtotal: ${f(viejo.iva)}`);
  console.log(`   IVA que corresponde:        ${f(HOJA.ivaUtilidad)}`);
  console.log(`   → ${(viejo.iva / HOJA.ivaUtilidad).toFixed(1)} veces de más\n`);
  comprobar("queda registrado el tamaño del error que se corrigió", viejo.iva > HOJA.ivaUtilidad * 9);
}

// ── 4. Oferta mixta: material aparte, obra por AIU ──────────
console.log("\n4. OFERTA MIXTA (material suelto + obra)\n");
{
  const items = [
    { cantidad: 100, precioUnitario: 50_000, tipo: "PRODUCTO" },     // 5.000.000 material
    { cantidad: 1, precioUnitario: 10_000_000, tipo: "INSTALACION" }, // 10.000.000 obra
  ];
  const r = calcularCotizacion(items, 0, { activo: true, adminPct: 10, imprevPct: 5, utilidadPct: 10 });
  console.log(`   material ${f(r.subtotalMaterial)} · obra ${f(r.subtotalObra)}`);
  console.log(`   A ${f(r.admin)} · I ${f(r.imprevistos)} · U ${f(r.utilidad)}`);
  console.log(`   IVA material ${f(r.ivaMaterial)} + IVA utilidad ${f(r.ivaUtilidad)} = ${f(r.iva)}`);
  console.log(`   TOTAL ${f(r.total)}\n`);

  comprobar("el AIU se calcula SOLO sobre la obra", igual(r.admin, 1_000_000) && igual(r.utilidad, 1_000_000),
    "10 % de 10.000.000, no de 15.000.000");
  comprobar("el material lleva su 19 % completo", igual(r.ivaMaterial, 950_000));
  comprobar("la utilidad lleva su 19 %", igual(r.ivaUtilidad, 190_000));
  comprobar("el IVA total es la suma de los dos", igual(r.iva, 1_140_000));
  comprobar(
    "el total cuadra",
    igual(r.total, 15_000_000 + 1_000_000 + 500_000 + 1_000_000 + 1_140_000),
    f(r.total),
  );
}

// ── 5. El descuento global no puede mover la base del AIU ───
console.log("\n5. CON DESCUENTO GLOBAL\n");
{
  const items = [
    { cantidad: 1, precioUnitario: 5_000_000, tipo: "PRODUCTO" },
    { cantidad: 1, precioUnitario: 5_000_000, tipo: "INSTALACION" },
  ];
  const r = calcularCotizacion(items, 20, { activo: true, adminPct: 10, imprevPct: 5, utilidadPct: 10 });
  comprobar(
    "el descuento se reparte proporcional entre material y obra",
    igual(r.subtotalMaterial, 4_000_000) && igual(r.subtotalObra, 4_000_000),
    `material ${f(r.subtotalMaterial)} · obra ${f(r.subtotalObra)}`,
  );
  comprobar("el AIU sale de la obra YA descontada", igual(r.utilidad, 400_000), f(r.utilidad));
}

// ── 6. Saneamiento de lo que llega del formulario ───────────
console.log("\n6. LO QUE LLEGA DEL FORMULARIO\n");
{
  comprobar("sin marcar la casilla, el AIU queda apagado", leerAIU({}).activo === false);
  comprobar("un porcentaje absurdo cae al de fábrica", leerAIU({ aiuActivo: true, aiuAdminPct: 5000 }).adminPct === 10);
  comprobar("un porcentaje negativo cae al de fábrica", leerAIU({ aiuActivo: true, aiuImprevPct: -3 }).imprevPct === 5);
  comprobar("un texto en el porcentaje cae al de fábrica", leerAIU({ aiuActivo: true, aiuUtilidadPct: "abc" }).utilidadPct === 10);
  comprobar("un monto vacío no cuenta como cero", leerAIU({ aiuActivo: true, aiuAdmin: "" }).adminMonto === null);
  comprobar("un monto escrito sí manda", leerAIU({ aiuActivo: true, aiuAdmin: 15690000 }).adminMonto === 15_690_000);
}

console.log(fallos === 0 ? "\n✅ Todas las comprobaciones pasaron.\n" : `\n❌ ${fallos} fallaron.\n`);
process.exit(fallos === 0 ? 0 : 1);
