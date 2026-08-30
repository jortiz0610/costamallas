// ============================================================
// El cupo diario de IA, contra la base.
//
// Se lleva en `configuracion` con una clave por persona y día
// (`nexus_uso_ia:<userId>:<AAAA-MM-DD>`). No hace falta una tabla: son
// filas que caducan solas al cambiar el día y a nadie le interesa la de
// anteayer.
//
// El tope se comprueba ANTES de llamar al modelo, no después: contar lo
// gastado cuando ya se gastó no es un tope, es un informe.
// ============================================================

import { prisma } from "@/lib/prisma";
import { CUPO_IA_POR_DEFECTO, CLAVE_CUPO_IA, claveUsoIA } from "@/lib/nexus/comandos";

/** El tope que puso administración, o el de fábrica. */
export async function cupoDiario(): Promise<number> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE_CUPO_IA } });
  const n = Number(fila?.valor);
  return Number.isFinite(n) && n >= 0 ? n : CUPO_IA_POR_DEFECTO;
}

export async function setCupoDiario(valor: number) {
  await prisma.configuracion.upsert({
    where: { clave: CLAVE_CUPO_IA },
    create: {
      clave: CLAVE_CUPO_IA,
      valor: String(Math.max(0, Math.floor(valor))),
      descripcion: "Veces al día que cada persona puede pedirle ayuda a la IA en el chat",
    },
    update: { valor: String(Math.max(0, Math.floor(valor))) },
  });
}

export async function usoDeHoy(usuarioId: string): Promise<number> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: claveUsoIA(usuarioId) } });
  return Number(fila?.valor) || 0;
}

export interface EstadoCupo {
  usado: number;
  tope: number;
  quedan: number;
  agotado: boolean;
}

export async function estadoCupo(usuarioId: string): Promise<EstadoCupo> {
  const [usado, tope] = await Promise.all([usoDeHoy(usuarioId), cupoDiario()]);
  return { usado, tope, quedan: Math.max(0, tope - usado), agotado: usado >= tope };
}

/**
 * Suma uno al contador del día. Se llama DESPUÉS de que el modelo
 * respondiera bien: cobrarle a alguien un intento que falló por un error
 * nuestro es la clase de detalle que hace que la gente deje de usar la
 * herramienta.
 */
export async function apuntarUso(usuarioId: string): Promise<void> {
  const clave = claveUsoIA(usuarioId);
  const actual = await usoDeHoy(usuarioId);
  await prisma.configuracion.upsert({
    where: { clave },
    create: { clave, valor: "1", descripcion: "Uso de IA en el chat (se recicla cada día)" },
    update: { valor: String(actual + 1) },
  }).catch(() => { /* que no tumbe la respuesta que ya se dio */ });
}
