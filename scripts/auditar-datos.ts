// ============================================================
// Qué hay y qué falta en la base de producción.
//
//   npx tsx scripts/auditar-datos.ts
//
// Solo lectura. Sirve para responder "¿esto está listo para usarse de
// verdad?" con números en vez de con impresiones.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[`__${m[1]}`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}`] = "1";
  }
}

const t = (s: string) => console.log(`\n${"─".repeat(58)}\n${s}\n${"─".repeat(58)}`);
const linea = (etiqueta: string, valor: string | number, aviso = "") =>
  console.log(`  ${etiqueta.padEnd(38)} ${String(valor).padStart(6)}  ${aviso}`);

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();

  t("CATÁLOGO");
  const prod = await p.producto.count();
  const publicados = await p.producto.count({ where: { publicado: true } });
  const sinPrecio = await p.producto.count({ where: { precioNormal: null, intEstado: { not: "ARCHIVADO" } } });
  const sinImagen = await p.producto.count({ where: { imagenes: { none: {} }, intEstado: { not: "ARCHIVADO" } } });
  const sinSeo = await p.producto.count({ where: { seoTitulo: null, intEstado: { not: "ARCHIVADO" } } });
  const sinFicha = await p.producto.count({ where: { acfFichaTecnicaPdf: null, intEstado: { not: "ARCHIVADO" } } });
  linea("productos", prod);
  linea("publicados en la tienda", publicados, publicados < prod / 2 ? "◄ menos de la mitad" : "");
  linea("activos SIN precio", sinPrecio, sinPrecio ? "◄ no se pueden cotizar" : "");
  linea("activos SIN imagen", sinImagen, sinImagen ? "◄ no se pueden publicar" : "");
  linea("activos SIN SEO", sinSeo, sinSeo ? "◄ no los encuentra Google" : "");
  linea("activos SIN ficha técnica PDF", sinFicha);

  t("COMERCIAL");
  for (const [e, n] of Object.entries(
    (await p.cotizacion.groupBy({ by: ["estado"], _count: true }))
      .reduce((a, r) => ({ ...a, [r.estado]: r._count }), {} as Record<string, number>),
  )) linea(`cotizaciones ${e}`, n as number);
  linea("cotizaciones de prueba", await p.cotizacion.count({ where: { esPrueba: true } }));
  linea("clientes", await p.cliente.count());
  linea("  · sin correo", await p.cliente.count({ where: { email: null } }), "◄ no se les puede enviar nada");
  linea("  · sin teléfono ni whatsapp", await p.cliente.count({ where: { telefono: null, whatsapp: null } }));
  linea("  · sin vendedor asignado", await p.cliente.count({ where: { vendedorId: null } }));
  linea("pedidos", await p.pedido.count());
  linea("facturas", await p.factura.count());

  t("OPERACIÓN E INSTALACIÓN");
  linea("servicios de instalación", await p.servicioInstalacion.count());
  const recargos = await p.recargoCiudad.count();
  linea("recargos por ciudad", recargos, recargos === 0 ? "◄ instalar en Santa Marta cuesta igual que al lado" : "");
  linea("instalaciones", await p.instalacion.count());
  linea("proveedores", await p.proveedor.count());
  linea("órdenes de compra", await p.ordenCompra.count());

  t("NEXUS");
  linea("conexiones de canal", await p.nexusConexion.count());
  for (const r of await p.nexusConversacion.groupBy({ by: ["canal"], _count: true })) {
    linea(`  conversaciones ${r.canal}`, r._count);
  }
  linea("mensajes", await p.nexusMensaje.count());
  linea("plantillas de respuesta", await p.plantillaNexus.count());
  linea("chats internos", await p.chatInterno.count());

  t("SEGUIMIENTO Y AUTOMATIZACIÓN");
  const seg = await p.seguimientoCotizacion.groupBy({ by: ["estado"], _count: true });
  if (!seg.length) linea("seguimientos", 0, "◄ nunca se ha disparado ninguno");
  for (const r of seg) linea(`seguimientos ${r.estado}`, r._count);

  // ¿Ha corrido la corrida diaria alguna vez? Se mira por los logs que deja.
  const logsCron = await p.log.findMany({
    where: { accion: { contains: "CRON" } },
    orderBy: { createdAt: "desc" }, take: 1,
    select: { accion: true, createdAt: true },
  });
  linea("último log de cron", logsCron[0] ? logsCron[0].createdAt.toISOString().slice(0, 16) : "NUNCA",
    logsCron.length ? "" : "◄ revisar");

  const notifs = await p.notificacion.count();
  linea("notificaciones en el portal", notifs);

  t("CONFIGURACIÓN: LO QUE FALTA POR CARGAR");
  const claves = await p.configuracion.findMany({ select: { clave: true } });
  const set = new Set(claves.map(c => c.clave));
  const revisar: [string, string][] = [
    ["smtp_host", "correo saliente"],
    ["wc_store_url", "WooCommerce"],
    ["wp_site_url", "WordPress (adjuntos del chat)"],
    ["ai_api_key", "IA / Sembli"],
    ["postventa_url_resena", "enlace de reseñas de Google (QR de la encuesta)"],
    ["empresa_horario", "horario de atención (sale en las políticas)"],
    ["facturacion_proveedor", "facturación electrónica DIAN"],
    ["com_anticipo_min_pct", "anticipo mínimo (hoy usa el de fábrica)"],
    ["cot_plazos_pago", "plazos de pago reales"],
  ];
  for (const [clave, que] of revisar) {
    const hay = set.has(clave);
    console.log(`  ${hay ? "✅" : "❌"} ${que.padEnd(44)} (${clave})`);
  }
  console.log(`\n  Total de claves de configuración: ${claves.length}`);

  await p.$disconnect();
  console.log("");
}

main().catch(e => { console.error(e); process.exit(1); });
