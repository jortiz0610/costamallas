// ============================================================
// Comprueba las plantillas de correo y el marco que las envuelve.
//
//   npx tsx scripts/probar-correos.ts
//
// Lo que se busca destapar:
//   · Que el texto que escribió gerencia esté TAL CUAL. Es lo primero
//     que se rompe cuando alguien "mejora" una frase.
//   · Que ningún correo salga con un {{marcador}} sin reemplazar.
//   · Que el pie lleve SIEMPRE los teléfonos y el correo de ventas.
//   · Que el botón del catálogo NO salga si no hay catálogo publicado:
//     un enlace roto en un correo a un cliente es peor que un botón que
//     falta.
//
// Solo LEE de la base (marca y plantillas guardadas). No manda ningún
// correo ni escribe nada.
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

/** El texto exacto que escribió gerencia. No se toca. */
const FRASES_DE_GERENCIA = [
  "Cordial saludo Estimado cliente,",
  "Esperamos se encuentren muy bien.",
  "De acuerdo con lo conversado, compartimos la propuesta correspondiente al servicio solicitado, la cual incluye el alcance técnico y las condiciones comerciales para su revisión.",
  "Para nosotros es muy valioso acompañarlo y aportar a sus proyectos. Quedamos atentos a sus comentarios o inquietudes, así como a cualquier ajuste que consideren necesario para avanzar.",
  "Agradecemos de antemano su tiempo y la confianza depositada en nuestro equipo",
];

async function main() {
  const {
    PLANTILLAS, PLANTILLA_POR_CLAVE, CATEGORIAS,
    aplicarMarcadores, marcadoresSueltos,
  } = await import("../src/lib/correo-plantillas");
  const { envolverCorreo, PIE_TELEFONOS, PIE_EMAIL, URL_TIENDA } =
    await import("../src/lib/correo-layout");

  console.log("\n═══ 1. El catálogo de plantillas ═══\n");

  const claves = PLANTILLAS.map(p => p.clave);
  comprobar("no hay claves repetidas", new Set(claves).size === claves.length);
  comprobar("todas tienen asunto y cuerpo", PLANTILLAS.every(p => p.asunto && p.cuerpo));
  comprobar("todas explican cuándo salen", PLANTILLAS.every(p => p.cuando.length > 10));
  comprobar("todas caen en una categoría que existe",
    PLANTILLAS.every(p => CATEGORIAS.some(c => c.v === p.categoria)));

  console.log("\n  — Los correos que pidió gerencia —\n");
  for (const [clave, que] of [
    ["cotizacion_envio", "envío de la cotización"],
    ["cotizacion_modificada", "la cotización cambió"],
    ["cotizacion_por_vencer", "presión para aprobar (por vencer)"],
    ["visita_agendada", "visita agendada, con fecha y hora"],
    ["encuesta_satisfaccion", "encuesta a las 24 h de completado"],
    ["aviso_cliente_abrio", "avisarle al vendedor que el cliente abrió"],
  ] as [string, string][]) {
    comprobar(`existe la plantilla de ${que}`, Boolean(PLANTILLA_POR_CLAVE[clave]));
  }

  console.log("\n  — El texto de gerencia, palabra por palabra —\n");
  const envio = PLANTILLA_POR_CLAVE.cotizacion_envio;
  for (const frase of FRASES_DE_GERENCIA) {
    comprobar(`«${frase.slice(0, 46)}…»`, envio.cuerpo.includes(frase));
  }
  comprobar("no se le agregó nada de más",
    envio.cuerpo.trim() === FRASES_DE_GERENCIA.join("\n\n").trim(),
    "el cuerpo tiene que ser exactamente ese texto");

  console.log("\n  — Los marcadores —\n");
  comprobar("ningún cuerpo usa un marcador que no declara",
    PLANTILLAS.every(p =>
      marcadoresSueltos(p.asunto + " " + p.cuerpo)
        .every(m => m === "{{empresa}}" || p.marcadores.some(x => x.k === m))),
    PLANTILLAS.flatMap(p =>
      marcadoresSueltos(p.asunto + " " + p.cuerpo)
        .filter(m => m !== "{{empresa}}" && !p.marcadores.some(x => x.k === m))
        .map(m => `${p.clave}:${m}`)).join(", "));
  comprobar("todos los marcadores traen un ejemplo",
    PLANTILLAS.every(p => p.marcadores.every(m => m.ejemplo.length > 0)));

  comprobar("un dato que falta BORRA el marcador, no lo deja escrito",
    aplicarMarcadores("Hola {{contacto}}, van {{total}}.", { contacto: "Ana" }) === "Hola Ana, van .",
    "es mejor una frase que cojea que un correo que dice {{total}}");

  console.log("\n  — Con datos reales no queda ninguno suelto —\n");
  for (const p of PLANTILLAS) {
    const datos: Record<string, string> = { empresa: "Costamallas" };
    for (const m of p.marcadores) datos[m.k.replace(/[{}]/g, "")] = m.ejemplo;
    const armado = aplicarMarcadores(p.asunto + "\n" + p.cuerpo, datos);
    comprobar(`${p.clave} sale limpio`, marcadoresSueltos(armado).length === 0,
      marcadoresSueltos(armado).join(", "));
  }

  console.log("\n═══ 2. El marco del correo ═══\n");

  const marcaFalsa = {
    companyName: "Costamallas",
    brandColor: "#ffdd00",
    phone: PIE_TELEFONOS,
    email: PIE_EMAIL,
    logoUrl: null,
  };

  const sinCatalogo = envolverCorreo({
    cuerpo: "Hola.\n\nEsto es una prueba.",
    marca: marcaFalsa,
    urlCatalogo: null,
  });

  comprobar("el pie lleva los teléfonos", sinCatalogo.html.includes(PIE_TELEFONOS));
  comprobar("el pie lleva el correo de ventas", sinCatalogo.html.includes(PIE_EMAIL));
  comprobar("el banner enlaza a la tienda", sinCatalogo.html.includes(URL_TIENDA));
  comprobar("SIN catálogo publicado, el botón del catálogo NO sale",
    !sinCatalogo.html.includes("Ver el catálogo"),
    "un enlace roto en un correo a un cliente es peor que un botón que falta");
  comprobar("los saltos de línea se vuelven párrafos",
    (sinCatalogo.html.match(/<p style="margin:0 0 14px/g) ?? []).length === 2);
  comprobar("hay versión en texto plano", sinCatalogo.texto.includes("Esto es una prueba."));
  comprobar("la versión en texto también lleva los teléfonos",
    sinCatalogo.texto.includes(PIE_TELEFONOS));

  const conCatalogo = envolverCorreo({
    cuerpo: "Hola.",
    marca: marcaFalsa,
    urlCatalogo: "https://costamallas.com/catalogo.pdf",
    boton: { texto: "Ver la cotización", url: "https://portal/x" },
    pieDelBoton: "Válida hasta el 15 de septiembre.",
  });
  comprobar("CON catálogo, el botón sí sale", conCatalogo.html.includes("Ver el catálogo"));
  comprobar("el botón principal sale con su enlace", conCatalogo.html.includes("https://portal/x"));
  comprobar("y su pie de aviso", conCatalogo.html.includes("Válida hasta el 15 de septiembre."));

  comprobar("el HTML se escapa (nadie inyecta etiquetas desde el editor)",
    envolverCorreo({ cuerpo: "<script>alert(1)</script>", marca: marcaFalsa }).html
      .includes("&lt;script&gt;"));

  comprobar("es HTML de correo: tablas, no flexbox",
    sinCatalogo.html.includes("<table role=\"presentation\"") && !sinCatalogo.html.includes("display:flex"),
    "Gmail y Outlook no entienden flexbox");

  console.log("\n═══ 3. Contra la base ═══\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`  (servidor: ${host})\n`);

    const { getPlantillas, getUrlCatalogo } = await import("../src/lib/correo-plantillas-server");
    const guardadas = await getPlantillas();
    comprobar("se leen todas las plantillas", guardadas.length === PLANTILLAS.length);
    comprobar("las que nadie tocó salen sin marcar como editadas",
      guardadas.every(p => p.editada === false || p.asunto !== PLANTILLA_POR_CLAVE[p.clave].asunto ||
        p.cuerpo !== PLANTILLA_POR_CLAVE[p.clave].cuerpo));

    const editadas = guardadas.filter(p => p.editada);
    console.log(`  ${editadas.length} plantilla(s) editadas por gerencia${editadas.length ? ": " + editadas.map(p => p.nombre).join(", ") : ""}`);

    const catalogo = await getUrlCatalogo();
    console.log(catalogo
      ? `  Catálogo publicado en: ${catalogo}`
      : "  ⚠️  Sin catálogo publicado: el botón no sale en ningún correo.");

    const { previsualizar } = await import("../src/lib/correo-plantillas-server");
    const previa = await previsualizar("cotizacion_envio", {
      asunto: envio.asunto, cuerpo: envio.cuerpo, boton: envio.boton,
    });
    comprobar("la vista previa se arma sin marcadores sueltos",
      marcadoresSueltos(previa.asunto + previa.html).length === 0);
    comprobar("y trae el texto de gerencia", previa.html.includes("Esperamos se encuentren muy bien."));
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
