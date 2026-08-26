// ============================================================
// Consecutivos de documentos (cotizaciones, pedidos, órdenes…)
//
// Antes cada módulo hacía `count() + 1`, que se rompe de dos formas:
//
//   1. Si se borra un documento, el conteo baja y el siguiente número
//      repite uno ya usado. Como la columna `numero` es @unique, la
//      creación falla con un error de restricción que no dice nada.
//   2. Dos usuarios creando a la vez leen el mismo conteo y piden el
//      mismo número; uno de los dos falla.
//
// Aquí el contador se guarda en `configuracion` y se incrementa con un
// UPDATE atómico de Postgres, así que dos peticiones simultáneas reciben
// números distintos sin necesidad de bloqueos.
// ============================================================

import { prisma } from "@/lib/prisma";

/**
 * Documentos que llevan consecutivo.
 *
 * ⚠️ NO existe "INS": las instalaciones no tienen columna `numero` —se
 * identifican por el pedido del que cuelgan— así que pedirle el
 * consecutivo reventaba con «column "numero" does not exist». Estaba
 * declarado desde el principio y nadie lo había llamado hasta que la
 * pantalla de Consecutivos pidió los cinco tipos de una vez.
 */
export type TipoDocumento = "COT" | "PED" | "OC" | "FAC";

const CONFIG: Record<TipoDocumento, { clave: string; descripcion: string; digitos: number; etiqueta: string }> = {
  COT: { clave: "consecutivo_cotizacion", descripcion: "Último número de cotización emitido", digitos: 5, etiqueta: "Cotizaciones" },
  PED: { clave: "consecutivo_pedido", descripcion: "Último número de pedido emitido", digitos: 5, etiqueta: "Pedidos" },
  OC:  { clave: "consecutivo_orden_compra", descripcion: "Último número de orden de compra emitido", digitos: 5, etiqueta: "Órdenes de compra" },
  FAC: { clave: "consecutivo_factura", descripcion: "Último número de factura emitido", digitos: 5, etiqueta: "Facturas" },
};

export const TIPOS = Object.keys(CONFIG) as TipoDocumento[];
export const etiquetaDe = (tipo: TipoDocumento) => CONFIG[tipo].etiqueta;

/**
 * Formato del número: prefijo y cantidad de dígitos, configurables.
 *
 * Existe porque una empresa que viene de otro sistema necesita CONTINUAR
 * su numeración, no empezar de cero. Costamallas llevaba 12.063
 * cotizaciones en SIIGO: arrancar en COT-00001 le habría dicho a cada
 * cliente que son nuevos.
 *
 * El prefijo puede ser vacío (solo el número) o alfanumérico.
 */
async function formato(tipo: TipoDocumento): Promise<{ prefijo: string; digitos: number }> {
  const { clave, digitos } = CONFIG[tipo];
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: [`${clave}_prefijo`, `${clave}_digitos`] } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const guardadoPrefijo = map[`${clave}_prefijo`];
  const guardadoDigitos = Number(map[`${clave}_digitos`]);

  return {
    // `undefined` = nunca se configuró → se mantiene el comportamiento de
    // siempre (COT-00001). Una cadena vacía SÍ es una elección: sin prefijo.
    prefijo: guardadoPrefijo === undefined ? tipo : guardadoPrefijo,
    digitos: Number.isFinite(guardadoDigitos) && guardadoDigitos > 0 && guardadoDigitos <= 12
      ? guardadoDigitos
      : digitos,
  };
}

/** Arma el número con el formato configurado. */
function componer(prefijo: string, digitos: number, valor: string | number): string {
  const num = String(valor).padStart(digitos, "0");
  return prefijo ? `${prefijo}-${num}` : num;
}

/** Modelos donde vive el `numero` de cada tipo, para sembrar el contador. */
const TABLA: Record<TipoDocumento, string> = {
  COT: "cotizaciones",
  PED: "pedidos",
  OC: "ordenes_compra",
  FAC: "facturas",
};

/**
 * Siembra el contador con el número más alto que ya exista.
 *
 * Se llama la primera vez que se pide un consecutivo de un tipo. Toma el
 * máximo existente, NO el conteo: así los documentos borrados no hacen
 * retroceder la numeración y nunca se repite un número ya emitido.
 */
async function sembrar(tipo: TipoDocumento): Promise<number> {
  const tabla = TABLA[tipo];
  // `numero` puede traer prefijos distintos o texto viejo; se extrae la
  // parte numérica final y se ignora lo que no sea un número.
  const filas = await prisma.$queryRawUnsafe<{ max: number | null }[]>(
    `SELECT MAX(NULLIF(regexp_replace("numero", '^.*?(\\d+)$', '\\1'), '')::bigint)::int AS max
     FROM "${tabla}"
     WHERE "numero" ~ '\\d+$'`,
  );
  return filas[0]?.max ?? 0;
}

/**
 * Devuelve el siguiente número, ya formateado (`COT-00042`).
 *
 * El incremento es atómico: `UPDATE … SET valor = (valor::int + 1) …
 * RETURNING valor` se resuelve dentro de la misma sentencia, así que dos
 * llamadas concurrentes obtienen valores distintos.
 */
export async function siguienteNumero(tipo: TipoDocumento): Promise<string> {
  const { clave, descripcion } = CONFIG[tipo];
  const { prefijo, digitos } = await formato(tipo);

  // Paso 1 — garantizar que la fila del contador exista.
  //
  // `ON CONFLICT DO NOTHING` hace que varias peticiones simultáneas
  // puedan ejecutarlo sin pisarse: una inserta y las demás no hacen nada.
  // Sembrar aquí y NO en la rama de fallo del UPDATE es lo que evita que
  // cinco llamadas concurrentes calculen el mismo "máximo + 1" y devuelvan
  // todas el mismo número.
  //
  // Se siembra con el máximo actual (no máximo+1): el primer UPDATE ya
  // devuelve máximo+1.
  const yaExiste = await prisma.configuracion.findUnique({ where: { clave }, select: { id: true } });
  if (!yaExiste) {
    const desde = await sembrar(tipo);
    await prisma.$executeRaw`
      INSERT INTO configuracion (id, clave, valor, encrypted, descripcion, "updatedAt")
      VALUES (gen_random_uuid()::text, ${clave}, ${String(desde)}, false, ${descripcion}, NOW())
      ON CONFLICT (clave) DO NOTHING
    `;
  }

  // Paso 2 — incrementar de forma atómica. Postgres resuelve la lectura y
  // la escritura dentro de la misma sentencia, así que dos peticiones
  // concurrentes reciben valores distintos sin bloqueos explícitos.
  const filas = await prisma.$queryRaw<{ valor: string }[]>`
    UPDATE configuracion
       SET valor = ((valor)::bigint + 1)::text,
           "updatedAt" = NOW()
     WHERE clave = ${clave}
       AND valor ~ '^\\d+$'
    RETURNING valor
  `;

  if (!filas.length) {
    // El valor guardado no es un número (alguien lo editó a mano).
    throw new Error(
      `El contador "${clave}" tiene un valor inválido. Corrígelo en Configuración para poder seguir numerando.`,
    );
  }

  return componer(prefijo, digitos, filas[0].valor);
}

/**
 * Igual que `siguienteNumero`, pero verificando que el número no exista
 * ya en la tabla. Protege contra el caso de que alguien haya insertado un
 * número a mano por fuera del contador.
 */
export async function siguienteNumeroSeguro(tipo: TipoDocumento, intentos = 5): Promise<string> {
  const tabla = TABLA[tipo];
  for (let i = 0; i < intentos; i++) {
    const numero = await siguienteNumero(tipo);
    const existe = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "${tabla}" WHERE "numero" = $1`,
      numero,
    );
    if (!existe[0]?.n) return numero;
  }
  throw new Error(
    `No se pudo generar un consecutivo ${tipo} libre después de ${intentos} intentos. ` +
      "Revisa la numeración del módulo.",
  );
}

/** Estado del contador, para mostrarlo en Configuración. */
export async function estadoConsecutivo(tipo: TipoDocumento) {
  const { clave, etiqueta } = CONFIG[tipo];
  const { prefijo, digitos } = await formato(tipo);
  const fila = await prisma.configuracion.findUnique({ where: { clave }, select: { valor: true } });
  const actual = fila ? Number(fila.valor) : await sembrar(tipo);
  return {
    tipo,
    etiqueta,
    actual,
    prefijo,
    digitos,
    proximo: componer(prefijo, digitos, actual + 1),
    inicializado: Boolean(fila),
  };
}

/**
 * Fija el contador y el formato de un tipo de documento.
 *
 * `desde` es el ÚLTIMO número usado, no el próximo: si en el sistema
 * anterior la última cotización fue la 12063, se guarda 12063 y la
 * primera que emita el portal será la 12064. Se pide así porque es el
 * dato que la gente tiene a la mano.
 *
 * No deja retroceder por debajo de lo ya emitido: bajar el contador
 * generaría números repetidos y `numero` es único, así que la creación
 * fallaría con un error que no explica nada.
 */
export async function fijarConsecutivo(
  tipo: TipoDocumento,
  datos: { desde?: number; prefijo?: string; digitos?: number },
): Promise<{ ok: boolean; error?: string }> {
  const { clave, descripcion } = CONFIG[tipo];

  if (datos.prefijo !== undefined) {
    const p = datos.prefijo.trim().toUpperCase();
    if (!/^[A-Z0-9-]{0,10}$/.test(p)) {
      return { ok: false, error: "El prefijo solo admite letras, números y guiones (hasta 10 caracteres)." };
    }
    await prisma.configuracion.upsert({
      where: { clave: `${clave}_prefijo` },
      create: { clave: `${clave}_prefijo`, valor: p, descripcion: `Prefijo de ${descripcion}` },
      update: { valor: p },
    });
  }

  if (datos.digitos !== undefined) {
    if (!Number.isInteger(datos.digitos) || datos.digitos < 1 || datos.digitos > 12) {
      return { ok: false, error: "Los dígitos deben ir entre 1 y 12." };
    }
    await prisma.configuracion.upsert({
      where: { clave: `${clave}_digitos`, },
      create: { clave: `${clave}_digitos`, valor: String(datos.digitos), descripcion: `Dígitos de ${descripcion}` },
      update: { valor: String(datos.digitos) },
    });
  }

  if (datos.desde !== undefined) {
    if (!Number.isInteger(datos.desde) || datos.desde < 0) {
      return { ok: false, error: "El número debe ser un entero positivo." };
    }
    const maximo = await sembrar(tipo);
    if (datos.desde < maximo) {
      return {
        ok: false,
        error: `Ya hay documentos emitidos hasta el ${maximo}. Poner el contador en ${datos.desde} repetiría números.`,
      };
    }
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: String(datos.desde), descripcion },
      update: { valor: String(datos.desde) },
    });
  }

  return { ok: true };
}
