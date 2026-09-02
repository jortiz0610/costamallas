// ============================================================
// El formato de selección de proveedores.
//
//   npx tsx scripts/probar-evaluacion-proveedor.ts
//
// Solo lógica: no toca la base. Comprueba que los porcentajes son los
// del formulario original y que "No aplica" NO castiga, que es la única
// decisión de cálculo que no estaba escrita en el papel.
// ============================================================

import {
  calcularPuntaje, lecturaPuntaje, documentosEnBlanco,
  DOCUMENTOS, TIEMPOS_ENTREGA, OPCIONES_PAGO,
} from "../src/lib/evaluacion-proveedor";

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

const docs = (...valores: ("SI" | "NO" | "NA")[]) =>
  DOCUMENTOS.map((d, i) => ({ clave: d.clave, texto: d.texto, valor: valores[i] ?? "NA" }));

function main() {
  console.log("\n═══ 1. Los porcentajes son los del formulario ═══\n");

  comprobar("son cinco documentos", DOCUMENTOS.length === 5, String(DOCUMENTOS.length));
  comprobar("entrega inmediata vale 100",
    TIEMPOS_ENTREGA.find(t => t.v === "INMEDIATA")?.pct === 100);
  comprobar("más de 7 días vale 50",
    TIEMPOS_ENTREGA.find(t => t.v === "MAS_7")?.pct === 50);
  comprobar("contado vale 70",
    OPCIONES_PAGO.find(o => o.v === "CONTADO")?.pct === 70);
  comprobar("crédito 60 vale 100",
    OPCIONES_PAGO.find(o => o.v === "CREDITO_60")?.pct === 100);

  console.log("\n═══ 2. El puntaje ═══\n");

  const perfecto = calcularPuntaje({
    documentos: docs("SI", "SI", "SI", "SI", "SI"),
    tiempoEntrega: "INMEDIATA",
    opcionPago: "CREDITO_60",
  });
  comprobar("todo sí, entrega inmediata y crédito 60 = 100", perfecto.total === 100, String(perfecto.total));

  const pesimo = calcularPuntaje({
    documentos: docs("NO", "NO", "NO", "NO", "NO"),
    tiempoEntrega: "MAS_7",
    opcionPago: "CONTADO",
  });
  comprobar("todo no, lo peor de cada bloque = 40",
    pesimo.total === 40, String(pesimo.total));
  comprobar("y lista los cinco faltantes", pesimo.faltantes.length === 5);

  console.log("\n═══ 3. 'No aplica' NO castiga ═══\n");

  const conNA = calcularPuntaje({
    documentos: docs("SI", "SI", "NA", "NA", "NA"),
    tiempoEntrega: "INMEDIATA",
    opcionPago: "CREDITO_60",
  });
  comprobar("dos sí y tres 'no aplica' siguen siendo 100 en documentos",
    conNA.documentos === 100, String(conNA.documentos));
  comprobar("y lo dice", conNA.noAplican === 3, String(conNA.noAplican));

  // Si "no aplica" valiera 0, esto daría 40 en documentos y el proveedor
  // saldría castigado por algo que no le corresponde.
  comprobar("el total no se hunde por los 'no aplica'",
    conNA.total === 100, String(conNA.total));

  console.log("\n═══ 4. Media evaluación no parece un suspenso ═══\n");

  const soloDocs = calcularPuntaje({ documentos: docs("SI", "SI", "SI", "SI", "SI") });
  comprobar("solo los documentos contestados = 100, no 33",
    soloDocs.total === 100, String(soloDocs.total));
  comprobar("y los bloques sin contestar salen vacíos",
    soloDocs.entrega === null && soloDocs.pago === null);

  const vacia = calcularPuntaje({ documentos: documentosEnBlanco() });
  comprobar("una evaluación en blanco no tiene puntaje", vacia.total === null, String(vacia.total));
  comprobar("y se lee como 'sin evaluar'",
    lecturaPuntaje(vacia.total).etiqueta === "Sin evaluar");

  console.log("\n═══ 5. Cómo se lee el número ═══\n");

  comprobar("95 es muy bueno", lecturaPuntaje(95).etiqueta === "Muy bueno");
  comprobar("80 es aceptable", lecturaPuntaje(80).etiqueta === "Aceptable");
  comprobar("65 tiene reparos", lecturaPuntaje(65).etiqueta === "Con reparos");
  comprobar("40 no se recomienda", lecturaPuntaje(40).etiqueta === "No recomendado");

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main();
