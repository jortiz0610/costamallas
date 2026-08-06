// ============================================================
// Comprobaciones de lo comercial contra la base REAL.
//
//   npx tsx scripts/verificar-comercial.ts
//
// SOLO LECTURA: no escribe, no manda correos, no gasta IA. Es el
// equivalente de verificar-sembli.ts para lo que se construyó el 5 de
// agosto (seguimiento, política comercial, vencimientos, facturación).
//
// Existe porque nada de eso se puede probar entrando al portal: entrar
// escribe en la base de producción. Esto comprueba las invariantes que
// SÍ se pueden mirar desde fuera — que los datos están donde deben y que
// no hay estados imposibles.
//
// Sale con código 1 si alguna comprobación falla, para poder encadenarlo.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

// Ojo: antes de instanciar PrismaClient.
for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

let fallos = 0;
let avisos = 0;

const ok = (t: string, d = "") => console.log(`  OK    ${t}${d ? ` — ${d}` : ""}`);
const falla = (t: string, d: string) => { fallos++; console.log(`  FALLA ${t} — ${d}`); };
const aviso = (t: string, d: string) => { avisos++; console.log(`  aviso ${t} — ${d}`); };

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { getPoliticaComercial, descuentoEfectivoPct, evaluarPolitica } =
    await import("../src/lib/politica-comercial");
  const { getPlazosPago, calcularFechaVence } = await import("../src/lib/plazos-pago");
  const { marcarVencidos } = await import("../src/lib/vencimientos");
  const { venceEl, getConfigSeguimiento } = await import("../src/lib/seguimiento");

  // ── 1. Política comercial ──
  console.log("\n1. Política comercial");
  const pol = await getPoliticaComercial();
  ok("configuración legible", `descuento máx ${pol.descuentoMaxPct}% · anticipo mín ${pol.anticipoMinPct}%`);

  // El cálculo del descuento efectivo debe sumar línea y global.
  const efectivo = descuentoEfectivoPct(
    [{ cantidad: 10, precioUnitario: 100 }], // bruto 1000
    10,   // 10% global
    900,  // ya venía con 10% de línea
  );
  efectivo === 19
    ? ok("descuento efectivo suma línea y global", "10% línea + 10% global = 19%")
    : falla("descuento efectivo", `esperaba 19, dio ${efectivo}`);

  const v1 = evaluarPolitica({ descuentoPct: pol.descuentoMaxPct + 1, anticipoPct: null }, pol);
  v1.requiere ? ok("pasarse del tope exige aprobación") : falla("tope de descuento", "no exigió aprobación");

  const v2 = evaluarPolitica({ descuentoPct: 0, anticipoPct: null }, pol);
  !v2.requiere ? ok("anticipo sin definir no se castiga") : falla("anticipo nulo", "exigió aprobación sin motivo");

  // Ninguna cotización puede estar APROBADA con el visto bueno pendiente.
  const contradictorias = await prisma.cotizacion.count({
    where: { estado: "APROBADA", aprobacionEstado: "PENDIENTE" },
  });
  contradictorias === 0
    ? ok("no hay cotizaciones aprobadas sin visto bueno")
    : falla("estado imposible", `${contradictorias} aprobada(s) con aprobación PENDIENTE`);

  // Ninguna enviada puede estar pendiente de aprobación.
  const enviadasSinVB = await prisma.cotizacion.count({
    where: { estado: { in: ["ENVIADA", "VENCIDA"] }, aprobacionEstado: "PENDIENTE" },
  });
  enviadasSinVB === 0
    ? ok("no hay ofertas enviadas sin visto bueno")
    : falla("estado imposible", `${enviadasSinVB} enviada(s) con aprobación PENDIENTE`);

  // ── 2. Seguimiento ──
  console.log("\n2. Seguimiento post-cotización");
  const seg = await getConfigSeguimiento();
  seg.t2LimiteHoras > seg.t2Horas
    ? ok("el plazo del toque 2 es posterior a su creación", `${seg.t2Horas}h → ${seg.t2LimiteHoras}h`)
    : falla("toques mal configurados", `t2=${seg.t2Horas}h con plazo ${seg.t2LimiteHoras}h`);

  // No puede haber dos registros del mismo toque para la misma oferta.
  const duplicados = await prisma.$queryRawUnsafe<{ cotizacionId: string; toque: number; n: bigint }[]>(
    `SELECT "cotizacionId", "toque", COUNT(*) AS n
       FROM "seguimientos_cotizacion"
      GROUP BY "cotizacionId", "toque" HAVING COUNT(*) > 1`,
  );
  duplicados.length === 0
    ? ok("sin toques duplicados")
    : falla("toques duplicados", `${duplicados.length} combinación(es) repetidas`);

  // Un seguimiento marcado ENVIADO tiene que tener fecha de ejecución.
  const enviadosSinFecha = await prisma.seguimientoCotizacion.count({
    where: { estado: "ENVIADO", ejecutadoEn: null },
  });
  enviadosSinFecha === 0
    ? ok("todo lo marcado como enviado tiene fecha")
    : falla("seguimiento inconsistente", `${enviadosSinFecha} ENVIADO sin ejecutadoEn`);

  // ── 3. Vencimientos ──
  console.log("\n3. Vencimientos (simulacro, no escribe)");
  const venc = await marcarVencidos({ dry: true });
  ok("cotizaciones revisadas", `${venc.cotizaciones.revisadas} enviadas · ${venc.cotizaciones.vencidas.length} por vencer`);
  ok("facturas revisadas", `${venc.facturas.vencidas.length} por marcar vencidas`);

  // Después de correr el cron no debería quedar ninguna ENVIADA caducada.
  const enviadas = await prisma.cotizacion.findMany({
    where: { estado: "ENVIADA" },
    select: { numero: true, createdAt: true, validezDias: true },
  });
  const caducadas = enviadas.filter(c => venceEl(c).getTime() < Date.now());
  caducadas.length === 0
    ? ok("no hay ofertas caducadas en estado ENVIADA")
    : aviso("ofertas caducadas sin marcar", `${caducadas.length} — las marcará la próxima corrida del cron`);

  // ── 4. Facturación ──
  console.log("\n4. Facturación");
  const plazos = await getPlazosPago();
  plazos.length > 0
    ? ok("hay formas de pago definidas", plazos.map(p => `${p.valor}=${p.dias}d`).join(" · "))
    : falla("sin formas de pago", "la fecha de vencimiento no se puede calcular");

  const base = new Date("2026-01-01T00:00:00Z");
  const contado = plazos.find(p => p.dias === 0);
  if (contado) {
    const f = calcularFechaVence(contado.valor, base, plazos);
    f?.getTime() === base.getTime()
      ? ok("contado vence el mismo día")
      : falla("cálculo de vencimiento", `contado dio ${f?.toISOString()}`);
  }
  calcularFechaVence("NO_EXISTE", base, plazos) === null
    ? ok("una forma de pago desconocida NO inventa fecha")
    : falla("cálculo de vencimiento", "inventó una fecha para una forma de pago inexistente");

  const sinFecha = await prisma.factura.count({
    where: { fechaVence: null, estado: { notIn: ["ANULADA", "BORRADOR"] } },
  });
  sinFecha === 0
    ? ok("ninguna factura viva sin fecha de vencimiento")
    : aviso("facturas sin vencimiento", `${sinFecha} — corregibles en /facturacion/sin-vencimiento`);

  // El saldo pendiente nunca puede pasarse del total.
  const saldoRaro = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM "facturas" WHERE "saldoPendiente" > "total"`,
  );
  Number(saldoRaro[0]?.n ?? 0) === 0
    ? ok("ningún saldo pendiente mayor que el total")
    : falla("saldo inconsistente", `${saldoRaro[0].n} factura(s)`);

  // ── 5. Lo que falta para que todo esto sirva ──
  console.log("\n5. Datos que faltan (no son fallos, son pendientes)");
  const { correoConfigurado } = await import("../src/lib/correo");
  (await correoConfigurado())
    ? ok("correo saliente configurado")
    : aviso("SMTP sin configurar", "el seguimiento y los avisos no salen");

  const { getConfigPostventa } = await import("../src/lib/postventa");
  const post = await getConfigPostventa();
  post.urlResena ? ok("enlace de reseñas cargado") : aviso("sin enlace de reseñas", "el QR no se genera");

  const { getConfigInstalacion } = await import("../src/lib/instalaciones");
  const inst = await getConfigInstalacion();
  (inst.coordinadorId || inst.coordinadorEmail)
    ? ok("coordinador de obras asignado")
    : aviso("sin coordinador", "el aviso queda solo como notificación interna");

  const vendedores = await prisma.usuario.count({ where: { activo: true, rol: "VENDEDOR" } });
  vendedores > 0
    ? ok("hay usuarios VENDEDOR", `${vendedores}`)
    : aviso("sin vendedores", "los asesores son administradores; la alerta del toque 2 se la manda a sí mismo");

  console.log(
    `\n${fallos === 0 ? "Sin fallos" : `${fallos} FALLO(S)`}` +
    `${avisos ? ` · ${avisos} aviso(s) de datos pendientes` : ""}.`,
  );

  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
