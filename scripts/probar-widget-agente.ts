// ============================================================
// Comprueba el widget del chat que se pega en WordPress.
//
//   npx tsx scripts/probar-widget-agente.ts
//
// El widget es JavaScript que este archivo EMITE desde un template
// literal de TypeScript. Eso tiene una trampa que ya mordió una vez: una
// barra invertida sola (`\s`) se pierde por el camino y llega al
// navegador como una letra. Aquí se comprueba el JavaScript EMITIDO, no
// el código fuente — que es lo único que sirve para eso.
//
// Solo lee. No escribe nada ni llama a ningún modelo.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

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

let ok = 0;
let fallos = 0;
function comprobar(titulo: string, condicion: boolean, detalle = "") {
  if (condicion) { ok++; console.log(`  ✓ ${titulo}`); }
  else { fallos++; console.log(`  ✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`); }
}

async function main() {
  const { GET } = await import("../src/app/api/public/agente/widget.js/route");

  // Se pide como lo pediría un navegador desde la tienda.
  const req = new Request("https://portal.costamallas.com/api/public/agente/widget.js", {
    headers: { host: "portal.costamallas.com", "x-forwarded-proto": "https" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await GET(req as any);
  const js = await res.text();

  console.log(`\nSe emitieron ${js.length} caracteres de JavaScript.\n`);

  console.log("═══ 1. El icono ═══\n");

  comprobar("ya NO usa el emoji 💬", !js.includes('"💬"'),
    "cada sistema lo dibujaba distinto; en Windows salía como una nube");
  comprobar("dibuja un SVG", js.includes("<svg viewBox=\"0 0 24 24\""));
  comprobar("mide 26 px, que es donde se lee", js.includes('width="26" height="26"'));
  comprobar("hereda el color del botón", js.includes('fill="currentColor"'));
  comprobar("lleva los tres puntos", (js.match(/<circle cx=/g) ?? []).length === 3);
  comprobar("los puntos salen del color de marca, no escritos a mano",
    js.includes("' + CFG.color + '") || /fill="#[0-9a-f]{6}"\/><\/svg>/i.test(js) === false,
    "si cambia el color de marca, no deben quedar tres puntos huérfanos");
  comprobar("el SVG está oculto para lectores de pantalla", js.includes('aria-hidden="true"'));
  comprobar("el botón sí tiene etiqueta accesible", js.includes('"aria-label", "Abrir el chat de "'));

  console.log("\n═══ 2. El registro previo ═══\n");

  comprobar("pide el nombre", js.includes("Su nombre"));
  comprobar("pide el correo", js.includes("Su correo"));
  comprobar("pide autorizar el tratamiento de datos",
    js.includes("Autorizo el tratamiento de mis datos"));
  comprobar("enlaza a la política", js.includes("/politicas"));
  comprobar("la política abre en otra pestaña sin exponer la ventana",
    js.includes('enlacePol.rel = "noopener noreferrer"'));
  comprobar("el botón nace deshabilitado", js.includes("btnReg.disabled = true"));
  comprobar("el chat y el campo de escribir nacen escondidos",
    js.includes('lista.style.display = "none"') && js.includes('pie.style.display = "none"'));
  comprobar("quien ya se registró no vuelve a llenarlo",
    js.includes("if (visitante || token()) { mostrarChat(); }"));
  comprobar("el nombre y el correo viajan con el mensaje",
    js.includes("nombre: visitante ? visitante.nombre : \"\""));

  console.log("\n  — La trampa de las barras invertidas —\n");

  // Esta es la prueba que de verdad importa: se ejecuta la expresión tal
  // como llega al navegador.
  const m = js.match(/return (\/\^\[\^.*?\/)\.test\(v\)/);
  comprobar("se encuentra el validador de correo en el JS emitido", Boolean(m), m?.[1] ?? "");
  if (m) {
    // eslint-disable-next-line no-eval
    const re: RegExp = eval(m[1]);
    comprobar("acepta un correo normal", re.test("maria@correo.com"));
    comprobar("acepta un correo CON la letra ese", re.test("jose@esek.com.co"),
      "con una sola barra invertida, \\s llegaba como 's' y este fallaba");
    comprobar("rechaza uno sin arroba", !re.test("mariacorreo.com"));
    comprobar("rechaza uno sin dominio", !re.test("maria@"));
    comprobar("rechaza uno con espacios", !re.test("maria garcia@correo.com"));
  }

  console.log("\n═══ 3. Lo que ya funcionaba y no se rompió ═══\n");

  comprobar("todo va dentro de una IIFE", js.trimStart().startsWith("(function ()"));
  comprobar("usa shadow DOM para no pisarle el CSS al tema",
    js.includes("attachShadow"));
  comprobar("dos <script> no pintan dos burbujas",
    js.includes("window.__costamallasAgente"));
  comprobar("el texto del modelo se inserta con textContent, nunca con innerHTML",
    js.includes("p.textContent = texto;"));
  comprobar("el JS emitido es sintácticamente válido",
    (() => { try { new Function(js); return true; } catch { return false; } })(),
    "si esto falla, el chat no arranca en la tienda");

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
