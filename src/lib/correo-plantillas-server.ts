// ============================================================
// Leer, guardar y ARMAR los correos del portal.
//
// `correo-plantillas.ts` tiene el catálogo y los textos por defecto;
// `correo-layout.ts` pone el marco. Aquí se juntan con lo que gerencia
// haya editado y con los datos del caso concreto.
//
// Quien quiera mandar un correo del portal llama a `armarCorreo()` y no
// tiene que saber nada de lo anterior.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getMarca } from "@/lib/marca";
import { envolverCorreo } from "@/lib/correo-layout";
import {
  PLANTILLAS, PLANTILLA_POR_CLAVE, claveAsunto, claveCuerpo, claveBoton,
  aplicarMarcadores, type PlantillaCorreo,
} from "@/lib/correo-plantillas";

export interface PlantillaEditada extends PlantillaCorreo {
  /** ¿Alguien la cambió, o es la de fábrica? */
  editada: boolean;
}

/** Dónde está publicado el catálogo en PDF. Vacío = el botón no sale. */
export const CLAVE_CATALOGO = "correo_url_catalogo";

async function leerConfig(claves: string[]): Promise<Record<string, string>> {
  if (claves.length === 0) return {};
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: claves } },
    select: { clave: true, valor: true },
  });
  return Object.fromEntries(filas.map(f => [f.clave, f.valor]));
}

/** Todas las plantillas con lo que esté guardado encima del valor de fábrica. */
export async function getPlantillas(): Promise<PlantillaEditada[]> {
  const claves = PLANTILLAS.flatMap(p => [claveAsunto(p.clave), claveCuerpo(p.clave), claveBoton(p.clave)]);
  const map = await leerConfig(claves);

  return PLANTILLAS.map(p => {
    const asunto = map[claveAsunto(p.clave)];
    const cuerpo = map[claveCuerpo(p.clave)];
    const boton = map[claveBoton(p.clave)];
    return {
      ...p,
      asunto: asunto ?? p.asunto,
      cuerpo: cuerpo ?? p.cuerpo,
      boton: boton ?? p.boton,
      editada: asunto !== undefined || cuerpo !== undefined || boton !== undefined,
    };
  });
}

export async function getPlantilla(clave: string): Promise<PlantillaEditada | null> {
  const base = PLANTILLA_POR_CLAVE[clave];
  if (!base) return null;
  return (await getPlantillas()).find(p => p.clave === clave) ?? null;
}

/**
 * Guarda una plantilla.
 *
 * Mandar `null` en un campo BORRA lo guardado y vuelve al texto de
 * fábrica. Es lo que hace el botón "Volver al original", y es mejor que
 * copiar el texto de fábrica en la base: así, si algún día se corrige un
 * texto por defecto, quien no lo haya editado recibe la corrección.
 */
export async function guardarPlantilla(
  clave: string,
  datos: { asunto?: string | null; cuerpo?: string | null; boton?: string | null },
): Promise<void> {
  if (!PLANTILLA_POR_CLAVE[clave]) throw new Error(`No existe la plantilla "${clave}".`);

  const pares: [string, string | null | undefined][] = [
    [claveAsunto(clave), datos.asunto],
    [claveCuerpo(clave), datos.cuerpo],
    [claveBoton(clave), datos.boton],
  ];

  for (const [k, v] of pares) {
    if (v === undefined) continue;
    if (v === null) {
      await prisma.configuracion.deleteMany({ where: { clave: k } });
      continue;
    }
    await prisma.configuracion.upsert({
      where: { clave: k },
      create: { clave: k, valor: v, descripcion: `Plantilla de correo: ${clave}` },
      update: { valor: v },
    });
  }
}

export async function getUrlCatalogo(): Promise<string | null> {
  const map = await leerConfig([CLAVE_CATALOGO]);
  const v = (map[CLAVE_CATALOGO] ?? "").trim();
  return /^https?:\/\//.test(v) ? v : null;
}

export async function setUrlCatalogo(url: string): Promise<void> {
  await prisma.configuracion.upsert({
    where: { clave: CLAVE_CATALOGO },
    create: { clave: CLAVE_CATALOGO, valor: url.trim(), descripcion: "PDF del catálogo, para el banner de los correos" },
    update: { valor: url.trim() },
  });
}

export interface CorreoArmado {
  asunto: string;
  html: string;
  texto: string;
}

/**
 * El correo listo para mandar: plantilla + marcadores + marco.
 *
 * `urlBoton` es aparte de los marcadores porque casi siempre es un
 * enlace que se calcula (el de la oferta, el del pedido) y no un dato de
 * negocio que gerencia pueda escribir en el texto.
 */
export async function armarCorreo(
  clave: string,
  datos: Record<string, string | number | null | undefined>,
  opciones?: { urlBoton?: string; pieDelBoton?: string; titulo?: string; extraHtml?: string },
): Promise<CorreoArmado> {
  const p = await getPlantilla(clave);
  if (!p) throw new Error(`No existe la plantilla de correo "${clave}".`);

  const [marca, urlCatalogo] = await Promise.all([getMarca(), getUrlCatalogo()]);

  // `{{empresa}}` está disponible en todas sin declararlo: es la firma.
  const conEmpresa = { empresa: marca.companyName, ...datos };

  const asunto = aplicarMarcadores(p.asunto, conEmpresa);
  const cuerpo = aplicarMarcadores(p.cuerpo, conEmpresa);

  const { html, texto } = envolverCorreo({
    titulo: opciones?.titulo,
    cuerpo,
    boton: p.boton && opciones?.urlBoton
      ? { texto: aplicarMarcadores(p.boton, conEmpresa), url: opciones.urlBoton }
      : undefined,
    pieDelBoton: opciones?.pieDelBoton,
    extraHtml: opciones?.extraHtml,
    marca,
    urlCatalogo,
  });

  return { asunto, html, texto };
}

/**
 * Igual, pero SIN tocar la base para leer la plantilla: se le pasa el
 * texto que hay en el editor. Es lo que hace la vista previa en vivo.
 */
export async function previsualizar(
  clave: string,
  borrador: { asunto: string; cuerpo: string; boton?: string },
): Promise<CorreoArmado> {
  const p = PLANTILLA_POR_CLAVE[clave];
  if (!p) throw new Error(`No existe la plantilla de correo "${clave}".`);

  const [marca, urlCatalogo] = await Promise.all([getMarca(), getUrlCatalogo()]);

  // Los marcadores se rellenan con los EJEMPLOS del catálogo: la vista
  // previa tiene que verse como el correo de verdad, no llena de llaves.
  const ejemplos: Record<string, string> = { empresa: marca.companyName };
  for (const m of p.marcadores) ejemplos[m.k.replace(/[{}]/g, "")] = m.ejemplo;

  return {
    asunto: aplicarMarcadores(borrador.asunto, ejemplos),
    ...envolverCorreo({
      cuerpo: aplicarMarcadores(borrador.cuerpo, ejemplos),
      boton: borrador.boton
        ? { texto: borrador.boton, url: "https://ejemplo" }
        : undefined,
      marca,
      urlCatalogo,
    }),
  };
}
