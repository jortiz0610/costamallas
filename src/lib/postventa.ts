// ============================================================
// Postventa: políticas públicas y encuesta de satisfacción.
//
// Las políticas estaban en dos .docx en una carpeta del PC de alguien.
// Un cliente que quiere saber si puede devolver un rollo de malla no
// tiene forma de leerlas, y el asesor termina explicándolas de memoria
// —distinto cada vez—. Aquí quedan publicadas en /politicas, accesibles
// desde la propia cotización.
//
// Los textos por defecto están transcritos de los documentos oficiales
// (ver postventa-defaults.ts) y se pueden editar desde el portal.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getMarca } from "@/lib/marca";
import { POSTVENTA_DEFAULTS, type ConfigPostventa } from "@/lib/postventa-defaults";

export { POSTVENTA_DEFAULTS };
export type { ConfigPostventa };

const CLAVES: Record<keyof ConfigPostventa, string> = {
  urlResena: "post_url_resena",
  encuestaTitulo: "post_encuesta_titulo",
  encuestaTexto: "post_encuesta_texto",
  horario: "post_horario",
  politicaEnvios: "post_politica_envios",
  politicaDevoluciones: "post_politica_devoluciones",
  politicaDatos: "post_politica_datos",
};

export async function getConfigPostventa(): Promise<ConfigPostventa> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const texto = (k: keyof ConfigPostventa) => {
    const v = map[CLAVES[k]];
    return v !== undefined && v !== "" ? v : POSTVENTA_DEFAULTS[k];
  };

  return {
    // La URL de la reseña no cae a un valor por defecto: o está cargada
    // o no está. Un QR que lleva a ninguna parte es peor que no tenerlo.
    urlResena: map[CLAVES.urlResena] ?? "",
    encuestaTitulo: texto("encuestaTitulo"),
    encuestaTexto: texto("encuestaTexto"),
    horario: map[CLAVES.horario] ?? "",
    politicaEnvios: texto("politicaEnvios"),
    politicaDevoluciones: texto("politicaDevoluciones"),
    politicaDatos: texto("politicaDatos"),
  };
}

export async function setConfigPostventa(datos: Partial<ConfigPostventa>) {
  for (const [campo, valor] of Object.entries(datos)) {
    const clave = CLAVES[campo as keyof ConfigPostventa];
    if (!clave || valor === undefined) continue;
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: String(valor), descripcion: "Postventa" },
      update: { valor: String(valor) },
    });
  }
}

/**
 * Rellena los huecos de contacto de las políticas con los datos de la
 * empresa. Los documentos originales traen "[correo electrónico]" y
 * "(57 5) xxxxxxx" sin llenar; aquí se sustituyen por lo que haya
 * cargado en Configuración → Empresa.
 *
 * Lo que falte queda como "—". No se inventa un teléfono para que el
 * documento se vea completo: en una política publicada eso es peor que
 * el hueco.
 */
export async function politicasResueltas(): Promise<{
  config: ConfigPostventa;
  envios: string; devoluciones: string; datos: string;
  faltan: string[];
}> {
  const [config, marca] = await Promise.all([getConfigPostventa(), getMarca()]);

  const faltan: string[] = [];
  if (!marca.email) faltan.push("correo de la empresa");
  if (!marca.phone) faltan.push("teléfono de la empresa");
  if (!config.horario) faltan.push("horario de atención");

  const valores: Record<string, string> = {
    correo: marca.email ?? "—",
    telefono: marca.phone ?? "—",
    horario: config.horario || "—",
    empresa: marca.companyName,
  };
  const resolver = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => valores[k] ?? "");

  return {
    config,
    envios: resolver(config.politicaEnvios),
    devoluciones: resolver(config.politicaDevoluciones),
    datos: resolver(config.politicaDatos),
    faltan,
  };
}

// ─────────────────────────────────────────────
// La encuesta de satisfacción
// ─────────────────────────────────────────────

export interface ResultadoEncuesta {
  ok: boolean;
  destino?: string;
  error?: string;
}

/**
 * Le manda la encuesta al cliente cuando la obra se cierra.
 *
 * ⚠️ **Hoy el botón lleva al perfil de reseñas de Google, no a una
 * encuesta propia.** El formulario de valoración de la empresa —NPS,
 * los seis puntajes de satisfacción y la probabilidad de recompra— NO
 * está construido todavía: existe el texto del correo y existe el
 * documento en papel, pero no hay página que lo recoja.
 *
 * Por eso, sin el enlace de reseñas cargado, esto **no manda nada** y
 * dice por qué. Mandar un correo con un botón que lleva a un 404 es
 * peor que no mandarlo: el cliente hace el esfuerzo de entrar y se
 * encuentra con un error nuestro.
 */
export async function enviarEncuesta(instalacionId: string): Promise<ResultadoEncuesta> {
  const inst = await prisma.instalacion.findUnique({
    where: { id: instalacionId },
    select: {
      id: true,
      pedido: {
        select: {
          numero: true,
          cliente: { select: { nombre: true, empresa: true, email: true } },
          vendedor: { select: { nombre: true, telefono: true } },
        },
      },
    },
  });
  if (!inst?.pedido) return { ok: false, error: "La instalación no existe o no tiene pedido." };

  const destino = inst.pedido.cliente.email?.trim();
  if (!destino) {
    return { ok: false, error: `${inst.pedido.cliente.nombre} no tiene correo en el CRM.` };
  }

  const cfg = await getConfigPostventa();
  const enlace = cfg.urlResena?.trim();
  if (!enlace) {
    return {
      ok: false,
      destino,
      error:
        "Falta el enlace de reseñas de Google (Postventa). Sin destino, el correo llevaría a un botón roto, " +
        "así que no se manda. La encuesta propia —NPS y los seis puntajes— todavía no está construida.",
    };
  }

  const { armarCorreo } = await import("@/lib/correo-plantillas-server");
  const { enviarCorreo } = await import("@/lib/correo");

  const correo = await armarCorreo(
    "encuesta_satisfaccion",
    {
      cliente: inst.pedido.cliente.empresa || inst.pedido.cliente.nombre,
      contacto: inst.pedido.cliente.nombre,
      enlace,
      asesor: inst.pedido.vendedor?.nombre ?? "",
      asesorTelefono: inst.pedido.vendedor?.telefono ?? "",
    },
    { urlBoton: enlace },
  );

  try {
    await enviarCorreo({
      para: destino,
      asunto: correo.asunto,
      html: correo.html,
      texto: correo.texto,
    });
  } catch (e) {
    return { ok: false, destino, error: (e as Error).message };
  }

  await prisma.log.create({
    data: {
      accion: "ENCUESTA_ENVIADA",
      detalle: `${inst.pedido.numero} → ${destino}`,
      resultado: "OK",
    },
  }).catch(() => undefined);

  return { ok: true, destino };
}
