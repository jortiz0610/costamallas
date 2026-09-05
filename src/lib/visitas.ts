// ============================================================
// La visita técnica.
//
// El proceso real de Costamallas empieza a veces por una visita: alguien
// va, mide, mira el sitio y llena un formato; con eso el vendedor arma la
// cotización. El portal no tenía dónde poner eso, así que ese paso vivía
// en un papel y en WhatsApp.
//
// El orden completo, y por qué cada paso está donde está:
//
//   1. El ASESOR agenda la visita. Él habla con el cliente, él sabe
//      cuándo puede.
//   2. PRODUCCIÓN va y llena el formato: medidas, cómo está el sitio,
//      qué recomienda. **Sin precios**: en campo no se negocia.
//   3. El cliente FIRMA que la visita se hizo. No recibe copia: todavía
//      no hay nada que entregarle, solo un aviso de que va la oferta.
//   4. El ASESOR cotiza con el formato delante. La oferta queda enlazada
//      a la visita en los dos sentidos.
//   5. Aprobada la oferta, el asesor pide fecha y hora de instalación.
//   6. Solo cuando está AGENDADA le sale como trabajo a producción. Un
//      pedido aprobado sin fecha no es trabajo de nadie todavía, y verlo
//      en la lista de campo es ruido.
// ============================================================

import { prisma } from "@/lib/prisma";

export type TipoTrabajo = "VISITA" | "INSTALACION";

/**
 * Los estados, y qué significan de verdad.
 *
 *   PENDIENTE  · existe, pero nadie le puso fecha. No es trabajo de campo.
 *   AGENDADA   · tiene fecha y hora. AHORA sí le sale a producción.
 *   EN_PROCESO · el técnico la abrió y está en el sitio.
 *   COMPLETADA · terminada y firmada.
 *   CANCELADA  · no se hizo. Se conserva: cancelar no es borrar.
 */
export const ESTADOS_TRABAJO = ["PENDIENTE", "AGENDADA", "EN_PROCESO", "COMPLETADA", "CANCELADA"] as const;
export type EstadoTrabajo = (typeof ESTADOS_TRABAJO)[number];

export interface ProductoRecomendado {
  nombre: string;
  cantidad?: number;
  unidad?: string;
  nota?: string;
}

/** Lo que el de producción escribe en el sitio. */
export interface FormatoVisita {
  medidas?: string;
  condicionesSitio?: string;
  recomendados?: ProductoRecomendado[];
  notas?: string;
}

export interface Firma {
  imagen: string;      // data:image/png;base64,…
  nombre: string;
  documento?: string;
}

/**
 * Agenda una visita para un cliente.
 *
 * No exige fecha: un asesor puede dejarla pedida y cuadrar el día
 * después. Sin fecha queda PENDIENTE y no le aparece a producción, que
 * es lo correcto — una visita sin hora no es trabajo de nadie.
 */
export async function agendarVisita(datos: {
  clienteId: string;
  vendedorId: string | null;
  fecha?: Date | null;
  tecnicoId?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  notas?: string | null;
}): Promise<{ id: string; estado: EstadoTrabajo }> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: datos.clienteId },
    select: { direccion: true, ciudad: true, esPrueba: true },
  });

  const v = await prisma.instalacion.create({
    data: {
      tipo: "VISITA",
      clienteId: datos.clienteId,
      vendedorId: datos.vendedorId,
      tecnicoId: datos.tecnicoId ?? null,
      fechaAgendada: datos.fecha ?? null,
      estado: datos.fecha ? "AGENDADA" : "PENDIENTE",
      // La dirección del cliente viene de arranque, y se puede cambiar:
      // muchas visitas son a una obra que no es la dirección de
      // facturación. Escribirla a mano cada vez es cómo se llega a la
      // dirección equivocada.
      direccion: datos.direccion ?? cliente?.direccion ?? null,
      ciudad: datos.ciudad ?? cliente?.ciudad ?? null,
      notas: datos.notas ?? null,
      esPrueba: cliente?.esPrueba ?? false,
    },
    select: { id: true, estado: true },
  });

  return { id: v.id, estado: v.estado as EstadoTrabajo };
}

/**
 * Pone fecha y hora a un trabajo que estaba pendiente.
 *
 * Es el paso que lo convierte en trabajo de campo. Antes de esto,
 * producción no lo ve.
 */
export async function agendar(id: string, fecha: Date, tecnicoId?: string | null) {
  return prisma.instalacion.update({
    where: { id },
    data: {
      fechaAgendada: fecha,
      estado: "AGENDADA",
      ...(tecnicoId !== undefined ? { tecnicoId } : {}),
    },
    select: { id: true, tipo: true, estado: true, fechaAgendada: true },
  });
}

/** Guarda lo que produccion anotó en el sitio, sin cerrar nada. */
export async function guardarFormato(id: string, f: FormatoVisita) {
  return prisma.instalacion.update({
    where: { id },
    data: {
      medidas: f.medidas ?? undefined,
      condicionesSitio: f.condicionesSitio ?? undefined,
      // Se limpian aquí y no en la pantalla: lo que llega de un teléfono
      // en campo trae filas a medio escribir.
      ...(f.recomendados
        ? { recomendados: f.recomendados.filter(r => r.nombre?.trim()) as never }
        : {}),
      notas: f.notas ?? undefined,
      // Abrir el formato ya es haber empezado.
      ...(f.medidas || f.condicionesSitio ? { estado: "EN_PROCESO" } : {}),
    },
    select: { id: true, estado: true },
  });
}

export interface ResultadoCierre {
  ok: boolean;
  error?: string;
  tipo?: TipoTrabajo;
}

/**
 * Cierra el trabajo con la firma del cliente.
 *
 * La firma es lo que lo cierra, no un botón de "terminar": un acta sin
 * firma no sirve para nada si mañana hay un reclamo, y dejarla opcional
 * garantiza que la mitad de las obras se cierren sin ella.
 */
export async function cerrarConFirma(
  id: string,
  firma: Firma,
  extra?: { observaciones?: string; recibidoPor?: string },
): Promise<ResultadoCierre> {
  const trabajo = await prisma.instalacion.findUnique({
    where: { id },
    select: { id: true, tipo: true, firmadoEn: true },
  });
  if (!trabajo) return { ok: false, error: "Este trabajo no existe." };
  if (trabajo.firmadoEn) return { ok: false, error: "Ya estaba firmado." };

  if (!firma.imagen?.startsWith("data:image/")) {
    return { ok: false, error: "Falta la firma del cliente." };
  }
  // Un PNG de firma pesa unos 10-30 KB. Medio mega es alguien mandando
  // una foto por equivocación, y eso no cabe en una fila.
  if (firma.imagen.length > 700_000) {
    return { ok: false, error: "La firma es demasiado pesada. Vuelva a firmar." };
  }
  if (!firma.nombre?.trim()) {
    return { ok: false, error: "Falta el nombre de quien firma." };
  }

  await prisma.instalacion.update({
    where: { id },
    data: {
      firmaImagen: firma.imagen,
      firmaNombre: firma.nombre.trim().slice(0, 120),
      firmaDocumento: firma.documento?.trim().slice(0, 40) || null,
      firmadoEn: new Date(),
      estado: "COMPLETADA",
      fechaRealizada: new Date(),
      actaFirmadaEn: new Date(),
      // Quien recibe no siempre es quien firmó el contrato.
      actaRecibidoPor: (extra?.recibidoPor ?? firma.nombre).trim().slice(0, 120),
      ...(extra?.observaciones ? { actaObservaciones: extra.observaciones } : {}),
    },
  });

  return { ok: true, tipo: trabajo.tipo as TipoTrabajo };
}

/**
 * Los trabajos que le tocan a producción hoy.
 *
 * Solo lo AGENDADO y lo que está en curso. Un pedido aprobado al que
 * nadie le puso fecha no es trabajo de nadie, y meterlo aquí hace que la
 * lista de campo deje de ser una lista de campo.
 */
export async function trabajosDeCampo(opciones?: {
  tecnicoId?: string | null;
  incluirPruebas?: boolean;
  desde?: Date;
  hasta?: Date;
}) {
  return prisma.instalacion.findMany({
    where: {
      estado: { in: ["AGENDADA", "EN_PROCESO"] },
      ...(opciones?.tecnicoId ? { tecnicoId: opciones.tecnicoId } : {}),
      ...(opciones?.incluirPruebas ? {} : { esPrueba: false }),
      ...(opciones?.desde || opciones?.hasta
        ? { fechaAgendada: { ...(opciones.desde ? { gte: opciones.desde } : {}), ...(opciones.hasta ? { lte: opciones.hasta } : {}) } }
        : {}),
    },
    orderBy: [{ fechaAgendada: "asc" }],
    select: {
      id: true, tipo: true, estado: true, fechaAgendada: true,
      direccion: true, ciudad: true, notas: true, esPrueba: true,
      firmadoEn: true,
      cliente: { select: { id: true, nombre: true, empresa: true, telefono: true } },
      pedido: {
        select: {
          numero: true,
          cliente: { select: { id: true, nombre: true, empresa: true, telefono: true } },
          // Qué hay que instalar. SIN precios: producción no los ve.
          items: { select: { descripcion: true, cantidad: true, unidad: true }, orderBy: { orden: "asc" } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// De la visita a la oferta
// ─────────────────────────────────────────────

/**
 * El formato de la visita, en un bloque de texto.
 *
 * Es lo que el asesor tiene delante mientras cotiza: medidas, cómo está
 * el sitio y lo que anotó producción. Se arma en una sola función —y no
 * en la pantalla— porque lo usan tres sitios: el panel del cotizador, el
 * correo al asesor y la prueba.
 *
 * ⚠️ **Esto NO se copia solo a las observaciones de la oferta.** Las
 * observaciones viajan al cliente en el enlace público, y en
 * `lib/cierre-trabajo.ts` está decidido —con su motivo— que al cliente
 * no se le mandan las medidas antes que el precio. El asesor lo copia si
 * quiere; el portal no lo hace por él.
 */
export function resumenParaCotizar(v: {
  fechaRealizada?: Date | null;
  direccion?: string | null;
  ciudad?: string | null;
  medidas?: string | null;
  condicionesSitio?: string | null;
  notas?: string | null;
  recomendados?: unknown;
}): string {
  const donde = [v.direccion, v.ciudad].filter(Boolean).join(", ");
  const cuando = v.fechaRealizada
    ? new Date(v.fechaRealizada).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const recomendados = Array.isArray(v.recomendados) ? (v.recomendados as ProductoRecomendado[]) : [];

  return [
    `VISITA TÉCNICA${cuando ? ` — ${cuando}` : ""}${donde ? `\n${donde}` : ""}`,
    v.medidas ? `MEDIDAS\n${v.medidas}` : "",
    v.condicionesSitio ? `CÓMO ESTÁ EL SITIO\n${v.condicionesSitio}` : "",
    recomendados.length
      ? "LO QUE RECOMIENDA PRODUCCIÓN\n" + recomendados
          .map(r => `· ${r.nombre}${r.cantidad ? ` — ${r.cantidad} ${r.unidad ?? ""}`.trimEnd() : ""}${r.nota ? ` (${r.nota})` : ""}`)
          .join("\n")
      : "",
    v.notas ? `NOTAS DE CAMPO\n${v.notas}` : "",
  ].filter(Boolean).join("\n\n");
}

/**
 * Enlaza la oferta con la visita de la que salió.
 *
 * `updateMany` con el filtro puesto y no `update`: así una visita que ya
 * tiene oferta no se la deja quitar por un enlace viejo que alguien
 * abrió dos veces, y un id inventado no revienta — devuelve `false`.
 */
export async function enlazarCotizacion(visitaId: string, cotizacionId: string): Promise<boolean> {
  const r = await prisma.instalacion.updateMany({
    where: { id: visitaId, tipo: "VISITA", cotizacionId: null },
    data: { cotizacionId },
  });
  return r.count === 1;
}
