// ============================================================
// Lectura y escritura del contenido de la cotización.
//
// Todo esto se escribía a mano en el campo "notas" de cada cotización, lo
// que hacía que cada asesor mandara condiciones distintas. Ahora vive en
// `configuracion`, se edita una vez desde el portal y se puede sobrescribir
// por cotización cuando el negocio lo amerite.
//
// Los valores por defecto y el tipo están en `cotizacion-textos.ts`, que
// no importa Prisma: así los componentes de cliente pueden usarlos sin
// arrastrar el cliente de base de datos al navegador.
// ============================================================

import { prisma } from "@/lib/prisma";
import { DEFAULTS, type ConfigCotizacion } from "@/lib/cotizacion-textos";

export { DEFAULTS };
export type { ConfigCotizacion };

const CLAVES: Record<keyof ConfigCotizacion, string> = {
  carta: "cot_carta",
  infoPago: "cot_info_pago",
  formaPago: "cot_forma_pago",
  tiempoEntrega: "cot_tiempo_entrega",
  sitioEntrega: "cot_sitio_entrega",
  garantia: "cot_garantia",
  instalacionIncluye: "cot_inst_incluye",
  instalacionRequiere: "cot_inst_requiere",
  observaciones: "cot_observaciones",
  politicas: "cot_politicas",
  vigencia: "cot_vigencia",
  validezDias: "cot_validez_dias",
  imgPortada: "cot_img_portada",
  imgBanda: "cot_img_banda",
  imgInstalacion: "cot_img_instalacion",
  imgContraportada: "cot_img_contraportada",
  posPortada: "cot_pos_portada",
  posBanda: "cot_pos_banda",
  posInstalacion: "cot_pos_instalacion",
  posContraportada: "cot_pos_contraportada",
  qrPagos: "cot_qr_pagos",
};

/** Lee la configuración; lo que no esté guardado cae al valor por defecto. */
export async function getConfigCotizacion(): Promise<ConfigCotizacion> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const texto = (k: keyof ConfigCotizacion) => {
    const v = map[CLAVES[k]];
    return v !== undefined && v !== "" ? v : (DEFAULTS[k] as string);
  };

  // El recorte es un porcentaje. Un valor fuera de 0-100 no se corrige a
  // ciegas: se cae al de fábrica, porque un `object-position` inválido
  // no rompe nada visible y la foto saldría descuadrada sin explicación.
  const posicion = (k: "posPortada" | "posBanda" | "posInstalacion" | "posContraportada") => {
    const v = Number(map[CLAVES[k]]);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : (DEFAULTS[k] as number);
  };

  let qrPagos = DEFAULTS.qrPagos;
  try {
    const crudo = map[CLAVES.qrPagos];
    if (crudo) {
      const parsed = JSON.parse(crudo);
      if (Array.isArray(parsed)) qrPagos = parsed;
    }
  } catch {
    // Un JSON corrupto no debe tumbar la cotización entera: se ignora.
  }

  return {
    carta: texto("carta"),
    infoPago: texto("infoPago"),
    formaPago: texto("formaPago"),
    tiempoEntrega: texto("tiempoEntrega"),
    sitioEntrega: texto("sitioEntrega"),
    garantia: texto("garantia"),
    instalacionIncluye: texto("instalacionIncluye"),
    instalacionRequiere: texto("instalacionRequiere"),
    observaciones: texto("observaciones"),
    politicas: texto("politicas"),
    vigencia: texto("vigencia"),
    validezDias: Number(map[CLAVES.validezDias]) || DEFAULTS.validezDias,
    imgPortada: map[CLAVES.imgPortada] ?? "",
    imgBanda: map[CLAVES.imgBanda] ?? "",
    imgInstalacion: map[CLAVES.imgInstalacion] ?? "",
    imgContraportada: map[CLAVES.imgContraportada] ?? "",
    posPortada: posicion("posPortada"),
    posBanda: posicion("posBanda"),
    posInstalacion: posicion("posInstalacion"),
    posContraportada: posicion("posContraportada"),
    qrPagos,
  };
}

/** Guarda solo lo que venga definido. Nada de esto es secreto: sin cifrar. */
export async function setConfigCotizacion(datos: Partial<ConfigCotizacion>) {
  for (const [campo, valor] of Object.entries(datos)) {
    const clave = CLAVES[campo as keyof ConfigCotizacion];
    if (!clave || valor === undefined) continue;
    const guardado =
      typeof valor === "string" ? valor
      : typeof valor === "number" ? String(valor)
      : JSON.stringify(valor);

    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: guardado, descripcion: "Contenido de la cotización" },
      update: { valor: guardado },
    });
  }
}
