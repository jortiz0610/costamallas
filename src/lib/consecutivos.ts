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

export type TipoDocumento = "COT" | "PED" | "OC" | "FAC" | "INS";

const CONFIG: Record<TipoDocumento, { clave: string; descripcion: string; digitos: number }> = {
  COT: { clave: "consecutivo_cotizacion", descripcion: "Último número de cotización emitido", digitos: 5 },
  PED: { clave: "consecutivo_pedido", descripcion: "Último número de pedido emitido", digitos: 5 },
  OC:  { clave: "consecutivo_orden_compra", descripcion: "Último número de orden de compra emitido", digitos: 5 },
  FAC: { clave: "consecutivo_factura", descripcion: "Último número de factura emitido", digitos: 5 },
  INS: { clave: "consecutivo_instalacion", descripcion: "Último número de instalación emitido", digitos: 5 },
};

/** Modelos donde vive el `numero` de cada tipo, para sembrar el contador. */
const TABLA: Record<TipoDocumento, string> = {
  COT: "cotizaciones",
  PED: "pedidos",
  OC: "ordenes_compra",
  FAC: "facturas",
  INS: "instalaciones",
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
  const { clave, descripcion, digitos } = CONFIG[tipo];

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

  return `${tipo}-${filas[0].valor.padStart(digitos, "0")}`;
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
  const { clave, digitos } = CONFIG[tipo];
  const fila = await prisma.configuracion.findUnique({ where: { clave }, select: { valor: true } });
  const actual = fila ? Number(fila.valor) : await sembrar(tipo);
  return {
    tipo,
    actual,
    proximo: `${tipo}-${String(actual + 1).padStart(digitos, "0")}`,
    inicializado: Boolean(fila),
  };
}
