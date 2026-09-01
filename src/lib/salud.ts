// ============================================================
// ¿Está todo funcionando?
//
// Existe porque hoy no hay forma de saberlo sin ser programador. Para
// responder "¿el seguimiento está saliendo?" había que abrir GitHub
// Actions, leer un log y saber qué es un cron. El resultado previsible:
// nadie lo mira, y las cosas se descubren rotas semanas después — como
// el reloj de 15 minutos, que llevaba fallando en el 100% de sus
// corridas sin que nadie se enterara.
//
// Una comprobación aquí NO es un "ping": es una pregunta de negocio con
// su consecuencia escrita. "SMTP sin configurar" no le dice nada a
// nadie; "los correos de seguimiento no salen" sí.
// ============================================================

import { prisma } from "@/lib/prisma";

export type Nivel = "ok" | "aviso" | "problema" | "apagado";

export interface Comprobacion {
  clave: string;
  /** Qué se está mirando, en el idioma del negocio. */
  titulo: string;
  nivel: Nivel;
  /** Lo que se encontró. Una línea. */
  detalle: string;
  /** Qué deja de funcionar si esto está mal. Vacío si no rompe nada. */
  consecuencia?: string;
  /** Qué hay que hacer, y quién. */
  arreglo?: string;
  /** Dónde se arregla, si es dentro del portal. */
  enlace?: string;
}

export interface Salud {
  generadoEn: string;
  /** El peor nivel de todos: es el semáforo de la cabecera. */
  resumen: Nivel;
  comprobaciones: Comprobacion[];
}

const PEOR: Record<Nivel, number> = { ok: 0, apagado: 1, aviso: 2, problema: 3 };

export async function revisarSalud(): Promise<Salud> {
  const c: Comprobacion[] = [];
  const cfg = await prisma.configuracion.findMany({ select: { clave: true } });
  const hay = new Set(cfg.map(x => x.clave));

  // ── Correo ──
  c.push(hay.has("smtp_host")
    ? { clave: "smtp", titulo: "Correo saliente", nivel: "ok", detalle: "Configurado. Los correos salen." }
    : {
        clave: "smtp", titulo: "Correo saliente", nivel: "problema",
        detalle: "Sin configurar.",
        consecuencia: "No sale NINGÚN correo: ni las cotizaciones, ni el seguimiento, ni la encuesta.",
        arreglo: "Cargar las credenciales SMTP.",
        enlace: "/configuracion?tab=correo",
      });

  // ── Tienda ──
  c.push(hay.has("wc_store_url")
    ? { clave: "woo", titulo: "Tienda (WooCommerce)", nivel: "ok", detalle: "Conectada." }
    : {
        clave: "woo", titulo: "Tienda (WooCommerce)", nivel: "aviso",
        detalle: "Sin conectar.",
        consecuencia: "El catálogo no se sincroniza con costamallas.com.",
        enlace: "/configuracion?tab=woocommerce",
      });

  // ── WordPress: es de donde salen los adjuntos del chat ──
  c.push(hay.has("wp_site_url")
    ? { clave: "wp", titulo: "WordPress", nivel: "ok", detalle: "Conectado. Los adjuntos del chat se pueden subir." }
    : {
        clave: "wp", titulo: "WordPress", nivel: "aviso",
        detalle: "Sin conectar.",
        consecuencia: "No se pueden mandar fotos ni audios por el chat.",
        enlace: "/configuracion?tab=woocommerce",
      });

  // ── IA ──
  c.push(hay.has("ai_api_key")
    ? { clave: "ia", titulo: "Asistente de IA", nivel: "ok", detalle: "Configurado." }
    : {
        clave: "ia", titulo: "Asistente de IA", nivel: "apagado",
        detalle: "Sin clave.",
        consecuencia: "No hay sugerencias en el chat ni SEO automático.",
        enlace: "/configuracion?tab=ia",
      });

  // ── Canales de conversación ──
  const conexiones = await prisma.nexusConexion.count({ where: { activo: true } });
  const whatsapp = await prisma.nexusConexion.count({ where: { activo: true, canal: { in: ["WHATSAPP", "whatsapp"] } } });
  c.push({
    clave: "canales", titulo: "Canales de Nexus",
    nivel: conexiones === 0 ? "problema" : whatsapp === 0 ? "aviso" : "ok",
    detalle: `${conexiones} conexión(es) activa(s), ${whatsapp} de WhatsApp.`,
    consecuencia: whatsapp === 0
      ? "Las respuestas por WhatsApp no se entregan: el mensaje se guarda con el error."
      : undefined,
    arreglo: whatsapp === 0 ? "Falta la aprobación de Meta." : undefined,
    enlace: "/configuracion?tab=canales",
  });

  // ── La corrida diaria ──
  // Se mide por su efecto: si hubiera corrido, los clientes tendrían
  // sello de recálculo reciente.
  const recalcRecientes = await prisma.cliente.count({
    where: { estadoCalculadoEn: { gte: new Date(Date.now() - 36 * 3600_000) } },
  });
  const totalClientes = await prisma.cliente.count({ where: { activo: true } });
  c.push({
    clave: "cron", titulo: "Corrida diaria",
    nivel: recalcRecientes > 0 ? "ok" : "problema",
    detalle: recalcRecientes > 0
      ? `Corrió en las últimas 36 h (${recalcRecientes} de ${totalClientes} clientes revisados).`
      : "No hay rastro de que haya corrido en 36 h.",
    consecuencia: recalcRecientes > 0
      ? undefined
      : "Las cotizaciones no vencen, el seguimiento no sale y los clientes no pasan a inactivo.",
    arreglo: recalcRecientes > 0 ? undefined : "Revisar los crons en Vercel y la variable CRON_SECRET.",
  });

  // ── Recargos de instalación ──
  const recargos = await prisma.recargoCiudad.count();
  c.push({
    clave: "recargos", titulo: "Recargos de instalación por ciudad",
    nivel: recargos === 0 ? "aviso" : "ok",
    detalle: recargos === 0 ? "Ninguno cargado." : `${recargos} ciudad(es).`,
    consecuencia: recargos === 0
      ? "Mandar la cuadrilla a Santa Marta se cotiza igual que instalar al lado."
      : undefined,
    enlace: "/configuracion?tab=instalacion",
  });

  // ── Catálogo listo para vender ──
  const sinPrecio = await prisma.producto.count({
    where: { precioNormal: null, intEstado: { not: "ARCHIVADO" } },
  });
  c.push({
    clave: "precios", titulo: "Productos sin precio",
    nivel: sinPrecio === 0 ? "ok" : "aviso",
    detalle: sinPrecio === 0 ? "Todos los activos tienen precio." : `${sinPrecio} sin precio.`,
    consecuencia: sinPrecio > 0 ? "No se pueden cotizar." : undefined,
    enlace: "/productos",
  });

  const sinImagen = await prisma.producto.count({
    where: { imagenes: { none: {} }, intEstado: { not: "ARCHIVADO" } },
  });
  c.push({
    clave: "fotos", titulo: "Productos sin foto",
    nivel: sinImagen === 0 ? "ok" : "aviso",
    detalle: sinImagen === 0 ? "Todos tienen al menos una." : `${sinImagen} sin ninguna foto.`,
    consecuencia: sinImagen > 0 ? "No se pueden publicar en la tienda ni se ven en la cotización." : undefined,
    enlace: "/imagenes",
  });

  // ── El equipo ──
  const vendedoresSinTelefono = await prisma.usuario.count({
    where: { activo: true, rol: { in: ["VENDEDOR", "ADMIN", "SUPERADMIN"] }, telefono: null },
  });
  c.push({
    clave: "telefonos", titulo: "Asesores sin teléfono",
    nivel: vendedoresSinTelefono === 0 ? "ok" : "aviso",
    detalle: vendedoresSinTelefono === 0 ? "Todos tienen." : `${vendedoresSinTelefono} sin teléfono.`,
    consecuencia: vendedoresSinTelefono > 0
      ? "Sus cotizaciones salen sin el botón de WhatsApp del asesor."
      : undefined,
    enlace: "/usuarios",
  });

  // ── Clientes contactables ──
  const sinCorreo = await prisma.cliente.count({ where: { activo: true, email: null } });
  c.push({
    clave: "correos-cliente", titulo: "Clientes sin correo",
    nivel: sinCorreo === 0 ? "ok" : "aviso",
    detalle: sinCorreo === 0 ? "Todos tienen correo." : `${sinCorreo} sin correo.`,
    consecuencia: sinCorreo > 0 ? "A esos no se les puede mandar la cotización ni la encuesta." : undefined,
    enlace: "/crm/clientes",
  });

  // ── Encuesta ──
  c.push(hay.has("postventa_url_resena")
    ? { clave: "resena", titulo: "Enlace de reseñas de Google", nivel: "ok", detalle: "Cargado." }
    : {
        clave: "resena", titulo: "Enlace de reseñas de Google", nivel: "apagado",
        detalle: "Sin cargar.",
        consecuencia: "La encuesta de satisfacción no genera el QR.",
        arreglo: "Pegar el enlace corto del perfil de Google.",
        enlace: "/postventa",
      });

  const resumen = c.reduce<Nivel>((peor, x) => (PEOR[x.nivel] > PEOR[peor] ? x.nivel : peor), "ok");

  return { generadoEn: new Date().toISOString(), resumen, comprobaciones: c };
}
