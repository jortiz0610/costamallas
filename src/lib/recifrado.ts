// ============================================================
// Cambiarle la llave a lo que está cifrado en la base.
//
// POR QUÉ EXISTE
// --------------
// `ENCRYPTION_KEY` está marcada como *Sensitive* en Vercel: se puede
// sobrescribir, pero NO leer. Ni desde la CLI ni desde el panel. Y con
// ella está cifrada la contraseña del SMTP, el token de WhatsApp, las
// llaves de WooCommerce, las credenciales de facturación, los tokens de
// marketing y los secretos de doble factor de cada usuario.
//
// O sea: el día que el portal salga de Vercel, todo eso queda ilegible
// y no hay forma de recuperarlo. No es un problema de la migración —
// ya estaba ahí—, pero la migración es cuando estalla.
//
// La salida: mientras el portal SIGA corriendo en Vercel, la llave
// vieja sí existe dentro de su proceso aunque nadie pueda leerla. Esto
// descifra con ella y vuelve a cifrar con una nueva que sí conocemos.
// La llave vieja nunca se imprime, ni se devuelve, ni se guarda.
//
// QUÉ SE TOCA, Y LA TRAMPA
// ------------------------
//   · `configuracion` con encrypted = true → `valor` ES el texto cifrado.
//   · `nexus_conexiones.config` (JSON)     → las claves token, apiKey y
//                                            appSecret.
//   · `configuracion` con clave "2fa:…"    → ⚠️ TAMBIÉN están marcadas
//     encrypted = true, pero su `valor` NO es texto cifrado: es un JSON
//     {secretEnc, enabled, required} con el cifrado DENTRO. Tratarlas
//     como las demás las corrompería, y el síntoma sería que la gente
//     con doble factor no puede entrar. Van aparte.
//
// LAS TRES COSAS QUE LA HACEN SEGURA
// ----------------------------------
//   1. Ensayo. `ensayo: true` no escribe una sola fila y dice qué
//      pasaría. Si algo no descifra, se sabe ANTES.
//   2. Respaldo dentro de la misma base, antes de tocar nada.
//   3. Se puede correr dos veces. Prueba con la vieja; si falla, prueba
//      con la nueva; si la nueva funciona, esa fila ya estaba hecha.
// ============================================================

import { prisma } from "@/lib/prisma";
import { cifrarCon, descifrarCon } from "@/lib/encryption";

/** Claves de `nexus_conexiones.config` que se guardan cifradas. */
const CLAVES_CIFRADAS_CANAL = ["token", "apiKey", "appSecret"];

/** El prefijo de las filas de doble factor. Ver lib/twofa.ts. */
const PREFIJO_2FA = "2fa:";

/** El prefijo de los respaldos que deja esta rutina. */
export const PREFIJO_RESPALDO = "respaldo_recifrado_";

export interface Recuento {
  /** Filas o claves miradas. */
  total: number;
  /** Cambiadas de llave en esta pasada. */
  recifradas: number;
  /** Ya estaban con la llave nueva: una corrida anterior las hizo. */
  yaEstaban: number;
  /** Ni la vieja ni la nueva las descifran. Se dejan INTACTAS. */
  fallidas: string[];
}

export interface ResultadoRecifrado {
  ensayo: boolean;
  configuracion: Recuento;
  dosFactores: Recuento;
  conexiones: Recuento;
  /** La clave de la fila de respaldo, para poder revertir. */
  respaldo: string | null;
  /** true si algo no se pudo descifrar con ninguna de las dos llaves. */
  hayFallos: boolean;
}

const vacio = (): Recuento => ({ total: 0, recifradas: 0, yaEstaban: 0, fallidas: [] });

/**
 * El resultado de intentar cambiarle la llave a un texto.
 *
 *   { estado: "recifrado", texto } → hay que guardar `texto`
 *   { estado: "ya" }               → ya estaba con la nueva, no tocar
 *   { estado: "fallo" }            → ninguna llave sirve, NO tocar
 */
export type Intento =
  | { estado: "recifrado"; texto: string }
  | { estado: "ya" }
  | { estado: "fallo" };

/** Se exporta para poder probarla sin base de datos. Es el corazón de todo. */
export function cambiarLlave(texto: string, vieja: string, nueva: string): Intento {
  try {
    return { estado: "recifrado", texto: cifrarCon(nueva, descifrarCon(vieja, texto)) };
  } catch {
    // No descifró con la vieja. Puede que ya esté hecha.
  }
  try {
    descifrarCon(nueva, texto);
    return { estado: "ya" };
  } catch {
    return { estado: "fallo" };
  }
}

/**
 * Cambia la llave de todo lo cifrado.
 *
 * @param vieja  La llave con la que está cifrado hoy. En Vercel sale de
 *               `process.env.ENCRYPTION_KEY`, y ahí se queda.
 * @param nueva  La llave con la que quedará.
 * @param ensayo Si es true no escribe NADA.
 */
export async function recifrarTodo(
  vieja: string,
  nueva: string,
  ensayo = true,
): Promise<ResultadoRecifrado> {
  if (!vieja || !nueva) throw new Error("Hacen falta las dos llaves.");
  if (vieja === nueva) throw new Error("Las dos llaves son la misma: no habría nada que cambiar.");

  const resultado: ResultadoRecifrado = {
    ensayo,
    configuracion: vacio(),
    dosFactores: vacio(),
    conexiones: vacio(),
    respaldo: null,
    hayFallos: false,
  };

  // ── Lo que hay ──
  const filas = await prisma.configuracion.findMany({
    where: { encrypted: true },
    select: { clave: true, valor: true },
  });
  const conexiones = await prisma.nexusConexion.findMany({
    select: { id: true, nombre: true, config: true },
  });

  // ── El respaldo, ANTES de escribir nada ──
  //
  // Va en la misma base a propósito: así revertir no depende de tener a
  // mano un archivo que se pueda perder. Lo que guarda es TEXTO CIFRADO,
  // no secretos en claro, y queda con encrypted = false para que una
  // corrida futura no intente re-cifrarlo a él también.
  if (!ensayo) {
    const clave = `${PREFIJO_RESPALDO}${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await prisma.configuracion.create({
      data: {
        clave,
        valor: JSON.stringify({ configuracion: filas, conexiones }),
        encrypted: false,
        descripcion: "Copia de lo cifrado ANTES de cambiar de ENCRYPTION_KEY. Se puede borrar cuando todo esté comprobado.",
      },
    });
    resultado.respaldo = clave;
  }

  // ── 1. configuracion ──
  for (const fila of filas) {
    const esDosFactores = fila.clave.startsWith(PREFIJO_2FA);
    const cuenta = esDosFactores ? resultado.dosFactores : resultado.configuracion;
    cuenta.total++;

    // El doble factor guarda el cifrado DENTRO de un JSON.
    if (esDosFactores) {
      let estado: { secretEnc?: string; enabled?: boolean; required?: boolean };
      try {
        estado = JSON.parse(fila.valor);
      } catch {
        cuenta.fallidas.push(`${fila.clave} (no es JSON válido)`);
        continue;
      }
      if (!estado.secretEnc) {
        // Sin secreto no hay nada que cambiar: es un 2FA exigido y
        // todavía sin configurar.
        cuenta.yaEstaban++;
        continue;
      }
      const r = cambiarLlave(estado.secretEnc, vieja, nueva);
      if (r.estado === "fallo") { cuenta.fallidas.push(fila.clave); continue; }
      if (r.estado === "ya") { cuenta.yaEstaban++; continue; }
      cuenta.recifradas++;
      if (!ensayo) {
        await prisma.configuracion.update({
          where: { clave: fila.clave },
          data: { valor: JSON.stringify({ ...estado, secretEnc: r.texto }) },
        });
      }
      continue;
    }

    const r = cambiarLlave(fila.valor, vieja, nueva);
    if (r.estado === "fallo") { cuenta.fallidas.push(fila.clave); continue; }
    if (r.estado === "ya") { cuenta.yaEstaban++; continue; }
    cuenta.recifradas++;
    if (!ensayo) {
      await prisma.configuracion.update({
        where: { clave: fila.clave },
        data: { valor: r.texto },
      });
    }
  }

  // ── 2. Los canales de Nexus ──
  for (const conexion of conexiones) {
    const config = (conexion.config ?? {}) as Record<string, unknown>;
    const nuevo: Record<string, unknown> = { ...config };
    let cambio = false;

    for (const clave of CLAVES_CIFRADAS_CANAL) {
      const valor = config[clave];
      if (typeof valor !== "string" || !valor) continue;
      resultado.conexiones.total++;

      const r = cambiarLlave(valor, vieja, nueva);
      if (r.estado === "fallo") {
        resultado.conexiones.fallidas.push(`${conexion.nombre} → ${clave}`);
        continue;
      }
      if (r.estado === "ya") { resultado.conexiones.yaEstaban++; continue; }
      resultado.conexiones.recifradas++;
      nuevo[clave] = r.texto;
      cambio = true;
    }

    if (cambio && !ensayo) {
      await prisma.nexusConexion.update({
        where: { id: conexion.id },
        data: { config: nuevo as never },
      });
    }
  }

  resultado.hayFallos =
    resultado.configuracion.fallidas.length > 0 ||
    resultado.dosFactores.fallidas.length > 0 ||
    resultado.conexiones.fallidas.length > 0;

  return resultado;
}

/**
 * Deshace un re-cifrado a partir de su respaldo.
 *
 * No es la marcha atrás de un cambio de llave: es "deja la base
 * exactamente como estaba". Sirve mientras `ENCRYPTION_KEY` siga siendo
 * la vieja; si ya se cambió, primero se vuelve a poner la vieja.
 */
export async function revertirRecifrado(claveRespaldo: string): Promise<{ configuracion: number; conexiones: number }> {
  const respaldo = await prisma.configuracion.findUnique({ where: { clave: claveRespaldo } });
  if (!respaldo) throw new Error(`No existe el respaldo "${claveRespaldo}".`);

  const datos = JSON.parse(respaldo.valor) as {
    configuracion: { clave: string; valor: string }[];
    conexiones: { id: string; config: unknown }[];
  };

  for (const fila of datos.configuracion) {
    await prisma.configuracion.update({ where: { clave: fila.clave }, data: { valor: fila.valor } })
      .catch(() => undefined);
  }
  for (const c of datos.conexiones) {
    await prisma.nexusConexion.update({ where: { id: c.id }, data: { config: c.config as never } })
      .catch(() => undefined);
  }

  return { configuracion: datos.configuracion.length, conexiones: datos.conexiones.length };
}
