// ============================================================
// GET /api/usuarios/[id]/permisos — qué puede esta persona y por qué
// PUT /api/usuarios/[id]/permisos — activar o quitar permisos sueltos
//
// Se guardan SOLO las excepciones. La respuesta del GET distingue las
// tres cosas que hay que ver para administrar esto sin equivocarse:
// lo que trae el rol, lo que se cambió a mano y el resultado final.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { z } from "zod";
import {
  PERMISOS,
  PERMISOS_POR_CLAVE,
  PERMISOS_POR_ROL,
  permisosEfectivos,
  esSuperadmin,
} from "@/lib/permisos";

type Params = { params: Promise<{ id: string }> };

/** Quién puede administrar permisos, y de quién. */
async function guardia(req: NextRequest, id: string) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return { error: NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 }) };
  }
  if (!["SUPERADMIN", "ADMIN"].includes(user.rol)) {
    return { error: NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 }) };
  }

  const objetivo = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });
  if (!objetivo) {
    return { error: NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 }) };
  }
  // Misma jerarquía que el resto de /api/usuarios: un administrador no
  // toca a un superadministrador.
  if (esSuperadmin(objetivo.rol) && !esSuperadmin(user.rol)) {
    return { error: NextResponse.json({ success: false, error: "No puedes editar a un superadministrador" }, { status: 403 }) };
  }
  return { user, objetivo };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const g = await guardia(req, id);
  if (g.error) return g.error;
  const objetivo = g.objetivo!;

  const filas = await prisma.permisoUsuario.findMany({
    where: { usuarioId: id },
    select: { clave: true, permitido: true, nota: true, updatedAt: true },
  });
  const excepciones = Object.fromEntries(filas.map(f => [f.clave, f.permitido]));

  return NextResponse.json({
    success: true,
    data: {
      usuario: objetivo,
      // El catálogo viaja con la respuesta para que la pantalla no tenga
      // que importar la lógica de permisos ni quedarse desfasada.
      catalogo: PERMISOS,
      porDefectoDelRol: PERMISOS_POR_ROL[objetivo.rol] ?? [],
      excepciones,
      efectivos: [...permisosEfectivos(objetivo.rol, excepciones)],
      // El superadministrador queda fuera del cálculo: lo tiene todo y no
      // se le puede quitar nada, porque si una excepción mal puesta le
      // cerrara esta misma pantalla no habría forma de deshacerlo.
      bloqueado: esSuperadmin(objetivo.rol),
      detalle: filas,
    },
  });
}

const putSchema = z.object({
  /**
   * clave → true (conceder), false (retirar) o null (volver al valor por
   * defecto del rol, borrando la excepción). Solo llegan las claves que
   * se tocaron.
   */
  cambios: z.record(z.string(), z.union([z.boolean(), z.null()])),
  nota: z.string().max(300).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const g = await guardia(req, id);
  if (g.error) return g.error;
  const { user, objetivo } = g as { user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>; objetivo: { rol: string } };

  if (esSuperadmin(objetivo.rol)) {
    return NextResponse.json(
      { success: false, error: "El superadministrador lo tiene todo por definición: no admite excepciones." },
      { status: 400 },
    );
  }

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { cambios, nota } = parsed.data;
  const desconocidas = Object.keys(cambios).filter(c => !PERMISOS_POR_CLAVE[c]);
  if (desconocidas.length) {
    return NextResponse.json(
      { success: false, error: `Permisos que no existen: ${desconocidas.join(", ")}` },
      { status: 400 },
    );
  }

  const porDefecto = new Set(PERMISOS_POR_ROL[objetivo.rol] ?? []);

  await prisma.$transaction(async (tx) => {
    for (const [clave, valor] of Object.entries(cambios)) {
      // Volver al valor del rol = borrar la excepción. Y si alguien pide
      // exactamente lo que el rol ya trae, también se borra: guardar una
      // excepción que no excepciona nada solo sirve para que el día que
      // cambie la política del rol esta persona se quede atrás.
      if (valor === null || valor === porDefecto.has(clave)) {
        await tx.permisoUsuario.deleteMany({ where: { usuarioId: id, clave } });
        continue;
      }
      await tx.permisoUsuario.upsert({
        where: { usuarioId_clave: { usuarioId: id, clave } },
        create: { usuarioId: id, clave, permitido: valor, otorgadoPorId: user.sub, nota: nota ?? null },
        update: { permitido: valor, otorgadoPorId: user.sub, nota: nota ?? null },
      });
    }
  });

  const filas = await prisma.permisoUsuario.findMany({
    where: { usuarioId: id },
    select: { clave: true, permitido: true },
  });
  const excepciones = Object.fromEntries(filas.map(f => [f.clave, f.permitido]));

  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: "PERMISOS_ACTUALIZADOS",
      detalle: `Usuario ${id}: ${Object.keys(cambios).length} permiso(s) tocado(s)`,
      resultado: "OK",
      metadata: { usuarioObjetivo: id, cambios, nota: nota ?? null },
    },
  }).catch(() => { /* la auditoría no debe tumbar la operación */ });

  return NextResponse.json({
    success: true,
    data: {
      excepciones,
      efectivos: [...permisosEfectivos(objetivo.rol, excepciones)],
    },
  });
}
