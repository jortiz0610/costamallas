// ============================================================
// La Orden de Producción de Malla Ciclón.
//
// Es el formato que hoy se llena en papel y se archiva en una carpeta:
// qué malla se va a fabricar, con qué materia prima, qué salió, cuánto se
// desperdició, qué paradas hubo y si se generó producto no conforme. Lo
// firma el operario y lo firma el supervisor.
//
// Se replica TAL CUAL, con sus mismas secciones y sus mismas casillas.
// No se "mejora" el formato: es un documento del sistema de gestión, la
// gente ya sabe llenarlo, y un formulario que se parece al papel se
// adopta el primer día. Uno que lo reorganiza "mejor" se llena mal
// durante un mes.
//
// Lo que sí cambia respecto al papel:
//
//   · Los kilos cuadran solos. Recibida = utilizada + desperdicio +
//     devuelta. En papel eso se comprobaba a ojo, o no se comprobaba.
//   · Nada se pierde. Una orden a medio llenar se guarda; el papel se
//     moja, se traspapela o se llena con otro bolígrafo.
//   · Las firmas quedan con fecha y hora.
// ============================================================

import { prisma } from "@/lib/prisma";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";

// ─────────────────────────────────────────────
// Las tablas del formato
// ─────────────────────────────────────────────

/** Una de las tres presentaciones (A, B, C) de la especificación. */
export interface FilaEspecificacion {
  fila: "A" | "B" | "C";
  ref?: string;
  colorGalv?: string;
  calibre?: string;
  ojo?: string;
  alto?: number;
  largo?: number;
  m2?: number;
  cant1?: number;
  largo1?: number;
  peso?: number;
  cant2?: number;
  largo2?: number;
}

export interface FilaMateriaPrima {
  n: number;
  colorGalv?: string;
  calibre?: string;
  ordenCompraLote?: string;
  kgRecibida?: number;
  kgUtilizada?: number;
  kgDesperdicio?: number;
  kgDevuelta?: number;
}

export interface FilaProductoTerminado {
  n: number;
  ref?: string;
  alto?: number;
  largo?: number;
  peso?: number;
  diametro?: number;
  m2?: number;
}

export interface FilaInterrupcion {
  n: number;
  horaInicio?: string;
  horaFinal?: string;
  motivo?: string;
}

/** Los cinco tratamientos del producto no conforme, tal como el papel. */
export const TRATAMIENTOS_PNC = [
  { v: "RETENCION_REPROCESO", l: "Retención y Reproceso" },
  { v: "REPARACION", l: "Reparación" },
  { v: "CONCESION", l: "Concesión" },
  { v: "RECLASIFICACION_APROVECHAMIENTO", l: "Reclasificación o Aprovechamiento" },
  { v: "DESTRUCCION", l: "Destrucción" },
] as const;

export const ESTADOS_OP = ["ABIERTA", "EN_PROCESO", "TERMINADA", "ANULADA"] as const;
export type EstadoOP = (typeof ESTADOS_OP)[number];

// ─────────────────────────────────────────────
// Crear
// ─────────────────────────────────────────────

export async function crearOrden(datos: {
  pedidoId?: string | null;
  productoId?: string | null;
  operarioId?: string | null;
  fechaPrevista?: Date | null;
  creadaPor?: string | null;
}): Promise<{ id: string; numero: string }> {
  // Si nace de un pedido de capacitación, es de capacitación. Si no, se
  // colaría en los informes de producción como fabricación real.
  const pedido = datos.pedidoId
    ? await prisma.pedido.findUnique({
        where: { id: datos.pedidoId },
        select: { esPrueba: true },
      })
    : null;

  const numero = await siguienteNumeroSeguro("OP");

  const op = await prisma.ordenProduccion.create({
    data: {
      numero,
      pedidoId: datos.pedidoId ?? null,
      productoId: datos.productoId ?? null,
      operarioId: datos.operarioId ?? null,
      fechaPrevista: datos.fechaPrevista ?? null,
      esPrueba: pedido?.esPrueba ?? false,
      // Las tres filas del papel salen ya puestas: A, B y C. Un operario
      // que abre la orden y ve una tabla vacía no sabe cuántas puede
      // llenar; con las tres a la vista, llena las que necesite.
      especificacion: [
        { fila: "A" }, { fila: "B" }, { fila: "C" },
      ] as never,
      materiaPrima: [1, 2, 3, 4].map(n => ({ n })) as never,
      productoTerminado: Array.from({ length: 10 }, (_, i) => ({ n: i + 1 })) as never,
      interrupciones: [1, 2, 3, 4].map(n => ({ n })) as never,
    },
    select: { id: true, numero: true },
  });

  return op;
}

// ─────────────────────────────────────────────
// Los kilos tienen que cuadrar
// ─────────────────────────────────────────────

export interface CuadreMateriaPrima {
  cuadra: boolean;
  /** Fila por fila, lo que falta o lo que sobra. */
  problemas: { n: number; recibida: number; suma: number; diferencia: number }[];
  totalRecibida: number;
  totalUtilizada: number;
  totalDesperdicio: number;
  totalDevuelta: number;
}

/**
 * Recibida = utilizada + desperdicio + devuelta.
 *
 * En el papel esto se comprobaba a ojo, o no se comprobaba, y un error de
 * transcripción en los kilos de desperdicio se descubría meses después
 * cuadrando el inventario — cuando ya no hay a quién preguntarle.
 *
 * Se admite una diferencia de 0.5 kg: la báscula del taller no da más
 * resolución y exigir el gramo exacto solo enseña a la gente a inventar
 * un número que cuadre.
 */
export function cuadrarMateriaPrima(filas: FilaMateriaPrima[]): CuadreMateriaPrima {
  const TOLERANCIA = 0.5;
  const problemas: CuadreMateriaPrima["problemas"] = [];
  let totalRecibida = 0, totalUtilizada = 0, totalDesperdicio = 0, totalDevuelta = 0;

  for (const f of filas) {
    const recibida = Number(f.kgRecibida ?? 0);
    const utilizada = Number(f.kgUtilizada ?? 0);
    const desperdicio = Number(f.kgDesperdicio ?? 0);
    const devuelta = Number(f.kgDevuelta ?? 0);

    totalRecibida += recibida;
    totalUtilizada += utilizada;
    totalDesperdicio += desperdicio;
    totalDevuelta += devuelta;

    // Una fila en blanco no es un error: son cuatro renglones fijos y
    // casi nunca se usan los cuatro.
    if (!recibida && !utilizada && !desperdicio && !devuelta) continue;

    const suma = utilizada + desperdicio + devuelta;
    const diferencia = Math.round((recibida - suma) * 100) / 100;
    if (Math.abs(diferencia) > TOLERANCIA) {
      problemas.push({ n: f.n, recibida, suma: Math.round(suma * 100) / 100, diferencia });
    }
  }

  return {
    cuadra: problemas.length === 0,
    problemas,
    totalRecibida: Math.round(totalRecibida * 100) / 100,
    totalUtilizada: Math.round(totalUtilizada * 100) / 100,
    totalDesperdicio: Math.round(totalDesperdicio * 100) / 100,
    totalDevuelta: Math.round(totalDevuelta * 100) / 100,
  };
}

/** Cuánto del material entró se fue en desperdicio, en porcentaje. */
export function porcentajeDesperdicio(c: CuadreMateriaPrima): number | null {
  if (!c.totalRecibida) return null;
  return Math.round((c.totalDesperdicio / c.totalRecibida) * 1000) / 10;
}

// ─────────────────────────────────────────────
// Cerrar
// ─────────────────────────────────────────────

export interface ResultadoCierre {
  ok: boolean;
  error?: string;
}

/**
 * Firma del operario o del supervisor.
 *
 * Son dos firmas distintas y en ese orden: el supervisor revisa lo que
 * el operario declaró. Dejar firmar al supervisor antes convierte la
 * revisión en un trámite.
 */
export async function firmar(
  id: string,
  quien: "OPERARIO" | "SUPERVISOR",
  firma: { imagen: string; nombre: string },
  usuarioId?: string | null,
): Promise<ResultadoCierre> {
  const op = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: {
      id: true, estado: true, firmaOperarioEn: true, firmaSupervisorEn: true,
      materiaPrima: true, generaPnc: true, pncTratamiento: true,
    },
  });
  if (!op) return { ok: false, error: "Esta orden no existe." };
  if (op.estado === "ANULADA") return { ok: false, error: "La orden está anulada." };

  if (!firma.imagen?.startsWith("data:image/")) return { ok: false, error: "Falta la firma." };
  if (firma.imagen.length > 700_000) return { ok: false, error: "La firma es demasiado pesada. Vuelva a firmar." };
  if (!firma.nombre?.trim()) return { ok: false, error: "Falta el nombre de quien firma." };

  if (quien === "OPERARIO") {
    if (op.firmaOperarioEn) return { ok: false, error: "El operario ya firmó." };

    // Antes de firmar, los kilos tienen que cuadrar. Es el único momento
    // en que se puede exigir: después ya está cerrada y corregirla
    // significa reabrir un documento firmado.
    const cuadre = cuadrarMateriaPrima(((op.materiaPrima ?? []) as unknown as FilaMateriaPrima[]));
    if (!cuadre.cuadra) {
      const p = cuadre.problemas[0];
      return {
        ok: false,
        error: `Los kilos no cuadran en el insumo ${p.n}: recibió ${p.recibida} y declaró ${p.suma}. ` +
          `${p.diferencia > 0 ? "Faltan" : "Sobran"} ${Math.abs(p.diferencia)} kg.`,
      };
    }

    // Si marcó que hubo producto no conforme, hay que decir qué se hizo
    // con él. "Sí hubo" sin tratamiento no cierra nada.
    if (op.generaPnc && !op.pncTratamiento) {
      return { ok: false, error: "Marcó producto no conforme: falta decir qué tratamiento se le dio." };
    }

    await prisma.ordenProduccion.update({
      where: { id },
      data: {
        firmaOperario: firma.imagen,
        firmaOperarioNombre: firma.nombre.trim().slice(0, 120),
        firmaOperarioEn: new Date(),
        operarioId: usuarioId ?? undefined,
        estado: "EN_PROCESO",
      },
    });
    return { ok: true };
  }

  // ── Supervisor ──
  if (!op.firmaOperarioEn) {
    return { ok: false, error: "Primero tiene que firmar el operario." };
  }
  if (op.firmaSupervisorEn) return { ok: false, error: "El supervisor ya firmó." };

  await prisma.ordenProduccion.update({
    where: { id },
    data: {
      firmaSupervisor: firma.imagen,
      firmaSupervisorNombre: firma.nombre.trim().slice(0, 120),
      firmaSupervisorEn: new Date(),
      supervisorId: usuarioId ?? undefined,
      // Las dos firmas la cierran. No hay un botón de "terminar" aparte:
      // una orden terminada sin firmar no sirve para el sistema de
      // gestión, y una firmada sin terminar no existe.
      estado: "TERMINADA",
    },
  });
  return { ok: true };
}
