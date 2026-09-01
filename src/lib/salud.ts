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
import { estadoReloj, HORAS_SIN_LATIDO } from "@/lib/automatizaciones";

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

  // ── El reloj ──
  // Se mide por el LATIDO que deja la propia corrida al terminar, no
  // por que un cron esté declarado en un archivo. Un cron declarado y
  // caído se ve exactamente igual que uno que funciona.
  const reloj = await estadoReloj();
  c.push({
    clave: "cron", titulo: "El reloj de la automatización",
    nivel: reloj.ultimoLatido === null ? "aviso" : reloj.callado ? "problema" : "ok",
    detalle: reloj.ultimoLatido === null
      ? "Todavía no ha dejado ningún latido. Si acabas de desplegar, es normal hasta la próxima corrida."
      : reloj.callado
        ? `Lleva ${reloj.horasSinCorrer} h sin correr (el tope son ${HORAS_SIN_LATIDO} h).`
        : `Corrió hace ${reloj.horasSinCorrer} h.`,
    consecuencia: reloj.callado
      ? "Las cotizaciones no vencen, el seguimiento no sale, nadie pasa a inactivo y los avisos no llegan."
      : undefined,
    arreglo: reloj.callado
      ? "Revisar los crons de Vercel y el secreto CRON_SECRET en GitHub."
      : undefined,
  });

  // ── Y si el reloj rápido está puesto ──
  // El de 15 minutos es el que hace que el seguimiento salga a tiempo.
  // Se detecta por lo mismo: si solo corriera el diario, el latido
  // tendría siempre varias horas.
  if (reloj.horasSinCorrer !== null && !reloj.callado) {
    const rapido = reloj.horasSinCorrer <= 1;
    c.push({
      clave: "cron-rapido", titulo: "Reloj rápido (cada 15 minutos)",
      nivel: rapido ? "ok" : "aviso",
      detalle: rapido
        ? "Está corriendo: el último latido es de hace menos de una hora."
        : `El último latido es de hace ${reloj.horasSinCorrer} h, así que solo está corriendo el diario.`,
      consecuencia: rapido
        ? undefined
        : "El seguimiento sale hasta 23 h tarde y el aviso de «una hora sin responder» llega al día siguiente.",
      arreglo: rapido ? undefined : "Falta el secreto CRON_SECRET en GitHub → Settings → Secrets → Actions.",
    });
  }

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
