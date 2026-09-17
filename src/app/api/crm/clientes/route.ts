import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { filtroClientes } from "@/lib/alcance-crm";
import { peticionPuede } from "@/lib/permisos-server";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const busqueda = req.nextUrl.searchParams.get("busqueda") ?? "";
  const soloActivos = req.nextUrl.searchParams.get("activos") !== "false";

  // Sin `crm.ver_todo`, un vendedor ve su cartera y los que todavía no
  // tienen asesor asignado.
  const suyos = await filtroClientes(req);

  // ── Paginación ──
  //
  // Esto devolvía `take: 100` y punto. Con 78 clientes nunca se notó;
  // con 4.350 significa que 4.250 personas EXISTEN en la base y no hay
  // forma de llegar a ellas desde la pantalla. Un CRM que solo enseña
  // los primeros cien no es un CRM.
  //
  // Se devuelve también el total, porque "100 de 4.350" y "100" son
  // mensajes muy distintos para quien está buscando a alguien.
  const pagina = Math.max(1, Number(req.nextUrl.searchParams.get("pagina")) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("porPagina")) || 100));

  const where = {
    ...suyos,
    activo: soloActivos ? true : undefined,
    ...(busqueda ? {
      OR: [
        { nombre: { contains: busqueda, mode: "insensitive" as const } },
        { empresa: { contains: busqueda, mode: "insensitive" as const } },
        { email: { contains: busqueda, mode: "insensitive" as const } },
        { telefono: { contains: busqueda, mode: "insensitive" as const } },
        { nit: { contains: busqueda, mode: "insensitive" as const } },
        { cedula: { contains: busqueda, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      include: {
        vendedor: { select: { nombre: true } },
        _count: { select: { cotizaciones: true, pedidos: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.cliente.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: clientes,
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { nombre, empresa, cargo, email, telefono, whatsapp, ciudad, departamento,
          direccion, nit, cedula, paginaWeb, tipo, notas, estado } = body;

  if (!nombre?.trim()) return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 });

  // Cliente de capacitación. Se comprueba el permiso en el SERVIDOR: la
  // casilla de la pantalla se puede quitar con el inspector, y un cliente
  // marcado sin querer deja de contar en los informes sin que nadie lo
  // note.
  const quierePrueba = body.esPrueba === true;
  const esPrueba = quierePrueba && (await peticionPuede(req, "crm.cotizaciones.prueba"));
  if (quierePrueba && !esPrueba) {
    return NextResponse.json(
      { success: false, error: "No tienes permiso para crear clientes de capacitación." },
      { status: 403 },
    );
  }

  const cliente = await prisma.cliente.create({
    data: {
      nombre, empresa, cargo, email, telefono, whatsapp, ciudad, departamento,
      direccion, nit, cedula, paginaWeb,
      tipo: tipo ?? "persona", notas, esPrueba,
      estado: estado ?? "PROSPECTO",
      vendedorId: user.sub,
    },
  });

  return NextResponse.json({ success: true, data: cliente }, { status: 201 });
}
