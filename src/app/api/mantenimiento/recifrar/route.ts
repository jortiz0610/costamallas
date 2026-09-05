// ============================================================
// POST /api/mantenimiento/recifrar — cambiarle la llave a lo cifrado
//
// Se corre UNA VEZ, desde Vercel, antes de mudarse al VPS. Ver
// lib/recifrado.ts para el porqué: `ENCRYPTION_KEY` está marcada como
// Sensitive en Vercel y no la puede leer nadie, así que lo cifrado en
// la base quedaría ilegible al salir de ahí.
//
// CÓMO SE USA
//   1. En Vercel se crean dos variables TEMPORALES:
//        RECIFRADO_SECRET      un secreto largo, solo para esta ruta
//        ENCRYPTION_KEY_NUEVA  la llave nueva, 64 caracteres hex
//   2. Ensayo (no escribe nada):
//        curl -X POST -H "Authorization: Bearer <RECIFRADO_SECRET>" \
//             https://portal.costamallas.com/api/mantenimiento/recifrar
//   3. De verdad:
//        ...mismo comando con  ?ejecutar=1
//   4. Se sobrescribe ENCRYPTION_KEY con la nueva, se BORRAN las dos
//      temporales y se redespliega.
//
// La llave vieja no se devuelve, ni se registra, ni sale de aquí. Lo
// único que se dice es cuántas filas se tocaron.
//
// ⚠️ Esta ruta se borra cuando la mudanza esté hecha. No es una función
// del portal: es una herramienta de una sola vez, y dejarla puesta es
// dejar una palanca para cambiar la llave de todo.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { recifrarTodo, revertirRecifrado } from "@/lib/recifrado";

// Nunca en caché ni prerenderizada: escribe en la base.
export const dynamic = "force-dynamic";
// Tocar cientos de filas de una en una no cabe en los 10 s por defecto.
export const maxDuration = 300;

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.RECIFRADO_SECRET;
  // Sin secreto configurado la ruta NO es pública: está cerrada. Es lo
  // contrario de lo que suele salir mal cuando falta una variable.
  if (!secreto || secreto.length < 24) return false;
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const vieja = process.env.ENCRYPTION_KEY;
  const nueva = process.env.ENCRYPTION_KEY_NUEVA;

  if (!vieja) {
    return NextResponse.json(
      { success: false, error: "No hay ENCRYPTION_KEY en este entorno: no habría con qué descifrar." },
      { status: 400 },
    );
  }
  if (!nueva) {
    return NextResponse.json(
      { success: false, error: "Falta ENCRYPTION_KEY_NUEVA. Créala en Vercel antes de correr esto." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);

  // ── Marcha atrás ──
  const revertir = searchParams.get("revertir");
  if (revertir) {
    try {
      const r = await revertirRecifrado(revertir);
      return NextResponse.json({ success: true, revertido: r });
    } catch (e) {
      return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
    }
  }

  // Escribir hay que pedirlo. Por defecto ensaya: quien llame esto sin
  // leer la documentación no debe poder cambiar la base de un curl.
  const ensayo = searchParams.get("ejecutar") !== "1";

  try {
    const r = await recifrarTodo(vieja, nueva, ensayo);
    return NextResponse.json({
      success: true,
      ...r,
      mensaje: ensayo
        ? "ENSAYO: no se escribió nada. Si los fallos están en cero, repite con ?ejecutar=1"
        : r.hayFallos
          ? "HECHO, PERO CON FALLOS. Lo que falló quedó INTACTO con la llave vieja. Míralo antes de cambiar ENCRYPTION_KEY."
          : "Hecho. Ahora sobrescribe ENCRYPTION_KEY con la nueva, borra las dos variables temporales y redespliega.",
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
