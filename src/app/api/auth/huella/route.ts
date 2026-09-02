// ============================================================
// GET /api/auth/huella — las llaves registradas de quien pregunta
//
// Solo las suyas, y sin la llave pública: la pantalla necesita saber
// cuáles hay para poder quitarlas, no el material criptográfico.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { credencialesDe } from "@/lib/huella";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const lista = await credencialesDe(user.sub);

  return NextResponse.json({
    success: true,
    data: lista.map(c => ({
      id: c.id,
      apodo: c.apodo,
      ultimoUsoEn: c.ultimoUsoEn,
      createdAt: c.createdAt,
    })),
  });
}
