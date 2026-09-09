// ============================================================
// ¿Se está respaldando la base?
//
// POR QUÉ EXISTE
// --------------
// La primera noche del portal en su servidor no se hizo NINGÚN
// respaldo. El cron corrió, falló por una tontería del archivo de
// variables, y dejó una línea de error en un archivo de registro que
// nadie mira. Se supo dos días después, por casualidad.
//
// Eso es lo peligroso de un respaldo: no avisa cuando falta. El día que
// se echa de menos es justo el día en que ya no hay forma de arreglarlo.
//
// CÓMO SE MIDE, Y POR QUÉ ASÍ
// ---------------------------
// Por el RASTRO que deja el propio guion al terminar, igual que el
// reloj de la automatización (ver lib/automatizaciones.ts). No por si
// existe una línea en el crontab: un cron declarado y roto se ve
// exactamente igual que uno que funciona — que es precisamente el error
// que costó esa primera noche.
//
// El guion `docker/respaldo.sh` escribe aquí al acabar, diga bien o mal.
// Un intento fallido registrado es más útil que el silencio.
// ============================================================

import { prisma } from "@/lib/prisma";

export const CLAVE_RESPALDO = "respaldo_ultimo";

/** A partir de cuántas horas sin respaldo hay que preocuparse. */
export const HORAS_SIN_RESPALDO = 36;

/** Lo que escribe el guion al terminar. Todo opcional: viene de bash. */
export interface RastroRespaldo {
  /** ISO. Cuándo terminó el intento. */
  en?: string;
  /** ¿Salió bien el volcado local? */
  ok?: boolean;
  /** Tamaño del archivo, en bytes. */
  bytes?: number;
  /** ¿Se subió la copia fuera de la máquina? */
  fuera?: boolean;
  /** Si falló, una línea diciendo por qué. */
  motivo?: string;
}

export interface EstadoRespaldo {
  hay: boolean;
  en: string | null;
  horas: number | null;
  ok: boolean;
  fuera: boolean;
  bytes: number | null;
  motivo: string | null;
  /** Lleva demasiado tiempo sin hacerse. */
  viejo: boolean;
}

export async function estadoRespaldo(): Promise<EstadoRespaldo> {
  const vacio: EstadoRespaldo = {
    hay: false, en: null, horas: null, ok: false,
    fuera: false, bytes: null, motivo: null, viejo: true,
  };

  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE_RESPALDO } });
  if (!fila?.valor) return vacio;

  let r: RastroRespaldo;
  try {
    r = JSON.parse(fila.valor);
  } catch {
    return vacio;
  }

  const t = r.en ? new Date(r.en).getTime() : NaN;
  if (Number.isNaN(t)) return vacio;

  const horas = (Date.now() - t) / 3600_000;
  return {
    hay: true,
    en: r.en ?? null,
    horas: Math.round(horas * 10) / 10,
    ok: r.ok === true,
    fuera: r.fuera === true,
    bytes: typeof r.bytes === "number" ? r.bytes : null,
    motivo: r.motivo ?? null,
    viejo: horas > HORAS_SIN_RESPALDO,
  };
}

/** "144 KB", "2,3 MB". Para decirlo en pantalla sin pensar. */
export function pesoLegible(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
