// ============================================================
// La visita técnica, de punta a punta.
//
//   npx tsx scripts/probar-visitas.ts
//
// El proceso que se comprueba:
//   agendar → producción llena el formato → el cliente firma →
//   sale el correo (al cliente un aviso, al asesor el formato)
//
// Y las dos reglas que no se pueden romper:
//   · Una visita SIN fecha no le sale a producción.
//   · Del cierre de una visita el cliente NO recibe las medidas.
//
// Contra PRODUCCIÓN. Manda correos de verdad al buzón de la empresa y
// borra lo que crea.
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
  const { agendarVisita, agendar, guardarFormato, cerrarConFirma, trabajosDeCampo } =
    await import("../src/lib/visitas");
  const { avisarCierreDeTrabajo } = await import("../src/lib/cierre-trabajo");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const cfg = await prisma.configuracion.findFirst({ where: { clave: "empresa_email" } });
  const buzon = (cfg?.valor ?? "").trim();
  console.log(`  Los correos de prueba van a: ${buzon || "(sin configurar)"}\n`);

  const creados: string[] = [];
  let clienteId: string | null = null;

  try {
    console.log("═══ 1. Agendar ═══\n");

    // Cliente de capacitación: así esta prueba no ensucia informes.
    const cliente = await prisma.cliente.create({
      data: {
        nombre: "VERIF Visita", tipo: "persona", estado: "PROSPECTO", esPrueba: true,
        email: buzon || undefined, telefono: "3000000000",
        direccion: "Calle 5 # 10-20", ciudad: "Cali",
      },
      select: { id: true },
    });
    clienteId = cliente.id;

    const sinFecha = await agendarVisita({ clienteId: cliente.id, vendedorId: null });
    creados.push(sinFecha.id);
    comprobar("una visita sin fecha queda PENDIENTE", sinFecha.estado === "PENDIENTE", sinFecha.estado);

    const enCampo1 = await trabajosDeCampo({ incluirPruebas: true });
    comprobar("y NO le sale a producción",
      !enCampo1.some(t => t.id === sinFecha.id), "aparecía sin tener fecha");

    const conFecha = await agendarVisita({
      clienteId: cliente.id, vendedorId: null,
      fecha: new Date(Date.now() + 86_400_000),
    });
    creados.push(conFecha.id);
    comprobar("con fecha nace AGENDADA", conFecha.estado === "AGENDADA", conFecha.estado);

    const enCampo2 = await trabajosDeCampo({ incluirPruebas: true });
    comprobar("y AHORA sí le sale a producción",
      enCampo2.some(t => t.id === conFecha.id));

    const traida = await prisma.instalacion.findUnique({
      where: { id: conFecha.id },
      select: { direccion: true, ciudad: true, esPrueba: true, tipo: true },
    });
    comprobar("hereda la dirección del cliente", traida?.direccion === "Calle 5 # 10-20", traida?.direccion ?? "");
    comprobar("y la ciudad", traida?.ciudad === "Cali", traida?.ciudad ?? "");
    comprobar("y la marca de capacitación", traida?.esPrueba === true);
    comprobar("y es del tipo VISITA", traida?.tipo === "VISITA", traida?.tipo ?? "");

    // Agendar una que estaba pendiente.
    const reagendada = await agendar(sinFecha.id, new Date(Date.now() + 172_800_000));
    comprobar("ponerle fecha a una pendiente la agenda", reagendada.estado === "AGENDADA");

    console.log("\n═══ 2. El formato en campo ═══\n");

    await guardarFormato(conFecha.id, {
      medidas: "Balcón principal: 3.20 x 1.10 m",
      condicionesSitio: "Ladrillo, tercer piso sin ascensor.",
      recomendados: [
        { nombre: "Anclajes de expansión", cantidad: 12, unidad: "und" },
        { nombre: "", cantidad: 3 },   // fila a medio escribir
      ],
    });

    const conFormato = await prisma.instalacion.findUnique({
      where: { id: conFecha.id },
      select: { medidas: true, condicionesSitio: true, recomendados: true, estado: true },
    });
    comprobar("se guardan las medidas", Boolean(conFormato?.medidas));
    comprobar("y abrir el formato lo pone EN_PROCESO", conFormato?.estado === "EN_PROCESO", conFormato?.estado ?? "");
    const recs = conFormato?.recomendados as { nombre: string }[];
    comprobar("las filas vacías se descartan", recs.length === 1, JSON.stringify(recs));

    console.log("\n═══ 3. La firma ═══\n");

    const sinFirma = await cerrarConFirma(conFecha.id, { imagen: "", nombre: "Ana" });
    comprobar("sin trazo no se cierra", !sinFirma.ok, sinFirma.error ?? "");

    const sinNombre = await cerrarConFirma(conFecha.id, { imagen: "data:image/png;base64,AAA", nombre: "" });
    comprobar("sin nombre tampoco", !sinNombre.ok, sinNombre.error ?? "");

    const pesada = await cerrarConFirma(conFecha.id, {
      imagen: "data:image/png;base64," + "A".repeat(800_000), nombre: "Ana",
    });
    comprobar("una foto por equivocación se rechaza", !pesada.ok, pesada.error ?? "");

    const bien = await cerrarConFirma(
      conFecha.id,
      { imagen: "data:image/png;base64,iVBORw0KGgo=", nombre: "Ana Pérez", documento: "1144..." },
      { observaciones: "Todo conforme." },
    );
    comprobar("con trazo y nombre sí cierra", bien.ok, bien.error ?? "");
    comprobar("y dice que era una visita", bien.tipo === "VISITA", bien.tipo ?? "");

    const cerrada = await prisma.instalacion.findUnique({
      where: { id: conFecha.id },
      select: { estado: true, firmadoEn: true, firmaNombre: true, fechaRealizada: true },
    });
    comprobar("queda COMPLETADA", cerrada?.estado === "COMPLETADA", cerrada?.estado ?? "");
    comprobar("con sello de firma", Boolean(cerrada?.firmadoEn));
    comprobar("y con la fecha real de ejecución", Boolean(cerrada?.fechaRealizada));

    const dosVeces = await cerrarConFirma(conFecha.id, { imagen: "data:image/png;base64,iVBORw0KGgo=", nombre: "Otro" });
    comprobar("no se puede firmar dos veces", !dosVeces.ok, dosVeces.error ?? "");

    console.log("\n═══ 4. Los correos ═══\n");

    const aviso = await avisarCierreDeTrabajo(conFecha.id);
    if (buzon) {
      comprobar("sale el aviso", aviso.ok, aviso.motivo ?? "");
      comprobar("al cliente", aviso.aCliente === true);
    } else {
      comprobar("sin correo del cliente se omite en vez de reventar", aviso.omitido === true);
    }

    const otraVez = await avisarCierreDeTrabajo(conFecha.id);
    comprobar("y NO se manda dos veces", otraVez.omitido === true, otraVez.motivo ?? "");

    console.log("\n═══ 5. Producción no ve precios ═══\n");

    const campo = await trabajosDeCampo({ incluirPruebas: true });
    const uno = campo[0];
    const json = JSON.stringify(uno ?? {});
    comprobar("la lista de campo no trae ningún total", !json.includes('"total"'), "trae total");
    comprobar("ni precios unitarios", !json.includes("precioUnitario"), "trae precioUnitario");
  } finally {
    for (const id of creados) {
      await prisma.instalacion.deleteMany({ where: { id } }).catch(() => {});
    }
    if (clienteId) {
      await prisma.instalacion.deleteMany({ where: { clienteId } }).catch(() => {});
      await prisma.cliente.deleteMany({ where: { id: clienteId } }).catch(() => {});
    }
    console.log("\n  (limpieza: visitas y cliente de prueba borrados)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
