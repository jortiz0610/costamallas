// ============================================================
// SEMBLI — Herramientas (tools) del agente
//
// Cada herramienta declara su `nivelMinimo`. El registro se filtra por
// el nivel del solicitante ANTES de armar el request, así el modelo
// nunca ve una herramienta que no puede usar. Además, `ejecutar()`
// vuelve a validar el nivel: la autorización se aplica en el servidor,
// no se confía en que el modelo respete el prompt.
//
// Las consultas de nivel CLIENTE están acotadas por `clienteId` del
// solicitante, de modo que un cliente no pueda leer los pedidos de otro
// ni pidiéndolo explícitamente.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { alcanza, type NivelSembli, type Solicitante } from "./alcance";

/** Convierte Decimal/Date de Prisma a algo serializable y legible. */
function limpiar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Prisma.Decimal) return Number(valor);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (Array.isArray(valor)) return valor.map(limpiar);
  if (typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, limpiar(v)]),
    );
  }
  return valor;
}

/**
 * Forma que exige la API de Anthropic para `input_schema`.
 * El índice abierto es necesario para encajar con `Tool.InputSchema` del SDK.
 */
export interface EsquemaEntrada {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  [clave: string]: unknown;
}

export interface Herramienta {
  nombre: string;
  descripcion: string;
  nivelMinimo: NivelSembli;
  esquema: EsquemaEntrada;
  ejecutar: (args: Record<string, any>, quien: Solicitante) => Promise<unknown>;
}

const obj = (props: Record<string, unknown>, requeridos: string[] = []): EsquemaEntrada => ({
  type: "object",
  properties: props,
  required: requeridos,
});

const texto = (descripcion: string) => ({ type: "string", description: descripcion });
const entero = (descripcion: string) => ({ type: "integer", description: descripcion });

/** Quita acentos y normaliza para comparar términos escritos a mano. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // quita las marcas de acento que separó NFD
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Traduce lo que escribió el modelo ("balcones", "para balcón") al slug
 * real de la categoría ("mallas-para-balcones").
 *
 * Hace falta porque las categorías se guardan como String[] y Prisma solo
 * permite igualdad exacta (`has`) sobre ese tipo: sin esta resolución, un
 * término aproximado devolvía cero resultados en silencio.
 */
async function resolverCategoria(termino: string): Promise<string | null> {
  const buscado = normalizar(termino);
  if (!buscado) return null;

  // Se resuelve contra el Catálogo Y contra las categorías que de verdad
  // tienen los productos. Los dos no siempre coinciden: hoy el catálogo
  // dice "mallas-construccion" pero los productos usan
  // "mallas-para-construccion", así que filtrar solo por el catálogo
  // devolvería cero resultados.
  const [delCatalogo, deProductos] = await Promise.all([
    prisma.catalogo.findMany({ where: { tipo: "CATEGORIA" }, select: { valor: true, label: true } }),
    prisma.producto.findMany({ select: { categorias: true } }),
  ]);

  const usadas = new Set(deProductos.flatMap((p) => p.categorias));
  const slugs = [
    // Las que están en uso van primero: son las que sí dan resultados.
    ...[...usadas].map((v) => ({ valor: v, texto: normalizar(v), enUso: true })),
    ...delCatalogo
      .filter((c) => !usadas.has(c.valor))
      .map((c) => ({ valor: c.valor, texto: normalizar(`${c.valor} ${c.label}`), enUso: false })),
  ];

  // El label del catálogo ayuda a reconocer el término ("Mallas Metálicas"),
  // así que se añade al texto buscable de las que sí están en uso.
  for (const s of slugs) {
    const conLabel = delCatalogo.find((c) => c.valor === s.valor);
    if (conLabel) s.texto = normalizar(`${s.valor} ${conLabel.label}`);
  }

  // 1) Coincidencia exacta del slug.
  const exacto = slugs.find((s) => normalizar(s.valor) === buscado);
  if (exacto) return exacto.valor;

  // 2) El término aparece dentro del nombre de la categoría (o al revés).
  const parcial = slugs.find((s) => s.texto.includes(buscado) || buscado.includes(normalizar(s.valor)));
  if (parcial) return parcial.valor;

  // 3) Alguna palabra significativa en común ("balcon", "nylon", "metalica").
  const palabras = buscado.split(" ").filter((p) => p.length > 3 && p !== "malla" && p !== "mallas");
  const porPalabra = slugs.find((s) => palabras.some((p) => s.texto.includes(p)));
  return porPalabra?.valor ?? null;
}

/**
 * Categorías que de verdad tienen productos, con su nombre legible y el
 * número de productos. Es lo que se le muestra a Sembli en el prompt: si
 * le pasáramos el catálogo tal cual, incluiría slugs sin un solo producto.
 */
export async function categoriasDisponibles(): Promise<
  { valor: string; label: string; productos: number }[]
> {
  const [delCatalogo, deProductos] = await Promise.all([
    prisma.catalogo.findMany({ where: { tipo: "CATEGORIA" }, select: { valor: true, label: true } }),
    prisma.producto.findMany({ select: { categorias: true } }),
  ]);

  const cuenta = new Map<string, number>();
  for (const p of deProductos) {
    for (const c of p.categorias) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  }

  return [...cuenta.entries()]
    .map(([valor, productos]) => ({
      valor,
      label: delCatalogo.find((c) => c.valor === valor)?.label ?? valor,
      productos,
    }))
    .sort((a, b) => b.productos - a.productos);
}

// ─────────────────────────────────────────────
// Registro de herramientas
// ─────────────────────────────────────────────

export const HERRAMIENTAS: Herramienta[] = [
  // ---------- Nivel CLIENTE ----------
  {
    nombre: "buscar_productos",
    descripcion:
      "Busca productos del catálogo por nombre, SKU, categoría o material. " +
      "Úsala cuando pregunten qué mallas hay, precios, medidas o para comparar referencias.",
    nivelMinimo: "CLIENTE",
    esquema: obj({
      texto: texto("Palabras a buscar en nombre, SKU o descripción. Opcional."),
      categoria: texto(
        "Filtrar por categoría. Acepta el slug exacto o una aproximación " +
          "('balcones' resuelve a 'mallas-para-balcones'). Opcional.",
      ),
      limite: entero("Máximo de resultados (1-25). Por defecto 10."),
    }),
    async ejecutar({ texto: q, categoria, limite }, quien) {
      const esCliente = quien.nivel === "CLIENTE";
      const where: Prisma.ProductoWhereInput = {};
      // El cliente solo ve lo publicado en la tienda.
      if (esCliente) where.publicado = true;
      if (q) {
        where.OR = [
          { nombre: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { descCorta: { contains: q, mode: "insensitive" } },
        ];
      }

      // El modelo suele escribir un término aproximado ("balcones") en vez
      // del slug real ("mallas-para-balcones"). Sin resolverlo, el `has`
      // exacto de Prisma devolvía cero resultados sin avisar de nada.
      let categoriaUsada: string | null = null;
      if (categoria) {
        categoriaUsada = await resolverCategoria(String(categoria));
        if (!categoriaUsada) {
          const validas = await categoriasDisponibles();
          return {
            error: `No existe la categoría "${categoria}".`,
            categoriasValidas: validas.map((c) => `${c.valor} (${c.label})`),
          };
        }
        where.categorias = { has: categoriaUsada };
      }

      const productos = await prisma.producto.findMany({
        where,
        take: Math.min(Math.max(Number(limite) || 10, 1), 25),
        orderBy: { nombre: "asc" },
        select: {
          sku: true,
          nombre: true,
          categorias: true,
          precioNormal: true,
          precioOferta: true,
          acfUnidadVenta: true,
          acfFabricacionMedida: true,
          acfInstalacion: true,
          acfGarantiaAnos: true,
          // Datos internos: solo desde VENDEDOR hacia arriba.
          ...(esCliente ? {} : { stock: true, enStock: true, intEstado: true, publicado: true }),
        },
      });
      return limpiar({
        encontrados: productos.length,
        ...(categoriaUsada ? { categoriaAplicada: categoriaUsada } : {}),
        productos,
      });
    },
  },

  {
    nombre: "detalle_producto",
    descripcion:
      "Devuelve la ficha completa de un producto por SKU: descripción, medidas, materiales, " +
      "normas, certificaciones, colores y aplicaciones.",
    nivelMinimo: "CLIENTE",
    esquema: obj({ sku: texto("SKU exacto del producto.") }, ["sku"]),
    async ejecutar({ sku }, quien) {
      const esCliente = quien.nivel === "CLIENTE";
      const p = await prisma.producto.findUnique({
        where: { sku: String(sku) },
        include: {
          imagenes: {
            select: { urlImagen: true, altText: true, esPrincipal: true },
            orderBy: { posicion: "asc" },
            take: 5,
          },
        },
      });
      if (!p) return { error: `No existe un producto con SKU ${sku}.` };
      if (esCliente && !p.publicado) {
        return { error: "Ese producto no está disponible en la tienda en este momento." };
      }
      const {
        // Campos que el cliente no debe ver nunca.
        intObservaciones, intResponsable, intEstado, intListoExportar, intExportadoEn,
        stock, stockMinimo, notaCompra, wcId, ...publico
      } = p;
      return limpiar(esCliente ? publico : p);
    },
  },

  {
    nombre: "mis_pedidos",
    descripcion:
      "Consulta el estado de los pedidos y cotizaciones del cliente que está preguntando. " +
      "Úsala cuando diga 'mi pedido', 'cómo va mi compra' o pregunte por una cotización suya.",
    nivelMinimo: "CLIENTE",
    esquema: obj({ numero: texto("Número de pedido o cotización específico. Opcional.") }),
    async ejecutar({ numero }, quien) {
      if (!quien.clienteId) {
        return {
          error:
            "Tu usuario aún no está vinculado a una ficha de cliente, así que no puedo ver tus pedidos. " +
            "Escríbenos a ventas para que lo vinculemos.",
        };
      }
      const filtro = { clienteId: quien.clienteId, ...(numero ? { numero: String(numero) } : {}) };
      const [pedidos, cotizaciones] = await Promise.all([
        prisma.pedido.findMany({
          where: filtro,
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            numero: true, estado: true, total: true, fechaEntrega: true,
            tieneInstalacion: true, createdAt: true,
            items: { select: { descripcion: true, cantidad: true, unidad: true } },
          },
        }),
        prisma.cotizacion.findMany({
          where: filtro,
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { numero: true, estado: true, total: true, validezDias: true, createdAt: true },
        }),
      ]);
      return limpiar({ pedidos, cotizaciones });
    },
  },

  {
    nombre: "info_empresa",
    descripcion:
      "Datos institucionales de Costamallas: contacto, horarios, cobertura de envíos, " +
      "políticas de garantía e instalación. Úsala para preguntas informativas de la tienda.",
    nivelMinimo: "CLIENTE",
    esquema: obj({}),
    async ejecutar() {
      const filas = await prisma.configuracion.findMany({
        where: { clave: { startsWith: "empresa_" }, encrypted: false },
        select: { clave: true, valor: true },
      });
      return Object.fromEntries(filas.map((f) => [f.clave.replace("empresa_", ""), f.valor]));
    },
  },

  // ---------- Nivel VENDEDOR ----------
  {
    nombre: "consultar_stock",
    descripcion:
      "Estado de inventario: existencias por producto, productos bajo el mínimo y agotados. " +
      "Úsala para preguntas de disponibilidad y reabastecimiento.",
    nivelMinimo: "VENDEDOR",
    esquema: obj({
      solo_criticos: { type: "boolean", description: "Solo los que están en o bajo el stock mínimo." },
      texto: texto("Filtrar por nombre o SKU. Opcional."),
      limite: entero("Máximo de resultados (1-50). Por defecto 20."),
    }),
    async ejecutar({ solo_criticos, texto: q, limite }) {
      const productos = await prisma.producto.findMany({
        where: {
          ...(q
            ? {
                OR: [
                  { nombre: { contains: q, mode: "insensitive" } },
                  { sku: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        take: Math.min(Math.max(Number(limite) || 20, 1), 50),
        orderBy: { stock: "asc" },
        select: { sku: true, nombre: true, stock: true, stockMinimo: true, enStock: true, acfUnidadVenta: true },
      });
      const conEstado = productos.map((p) => ({
        ...p,
        critico: p.stock <= p.stockMinimo,
        agotado: p.stock <= 0,
      }));
      return limpiar(solo_criticos ? conEstado.filter((p) => p.critico) : conEstado);
    },
  },

  {
    nombre: "buscar_clientes",
    descripcion:
      "Busca clientes del CRM por nombre, empresa, NIT, ciudad o correo, con su estado en el pipeline.",
    nivelMinimo: "VENDEDOR",
    esquema: obj({
      texto: texto("Nombre, empresa, NIT, email o teléfono."),
      estado: texto("Filtrar por estado: PROSPECTO, CONTACTADO, COTIZADO, CLIENTE, PERDIDO. Opcional."),
      limite: entero("Máximo de resultados (1-25). Por defecto 10."),
    }),
    async ejecutar({ texto: q, estado, limite }) {
      const clientes = await prisma.cliente.findMany({
        where: {
          activo: true,
          ...(estado ? { estado: String(estado) } : {}),
          ...(q
            ? {
                OR: [
                  { nombre: { contains: q, mode: "insensitive" } },
                  { empresa: { contains: q, mode: "insensitive" } },
                  { nit: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { telefono: { contains: q } },
                  { ciudad: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        take: Math.min(Math.max(Number(limite) || 10, 1), 25),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, nombre: true, empresa: true, ciudad: true, telefono: true,
          email: true, estado: true, tipo: true,
          _count: { select: { cotizaciones: true, pedidos: true } },
        },
      });
      return limpiar(clientes);
    },
  },

  {
    nombre: "consultar_ventas",
    descripcion:
      "Consulta cotizaciones, pedidos e instalaciones del CRM con filtros por estado, cliente o fecha. " +
      "Úsala para preguntas como 'qué pedidos están pendientes' o 'cotizaciones de este mes'.",
    nivelMinimo: "VENDEDOR",
    esquema: obj(
      {
        tipo: {
          type: "string",
          enum: ["cotizaciones", "pedidos", "instalaciones"],
          description: "Qué consultar.",
        },
        estado: texto("Filtrar por estado. Opcional."),
        cliente: texto("Nombre o empresa del cliente. Opcional."),
        dias: entero("Solo los de los últimos N días. Opcional."),
        limite: entero("Máximo de resultados (1-30). Por defecto 15."),
      },
      ["tipo"],
    ),
    async ejecutar({ tipo, estado, cliente, dias, limite }) {
      const take = Math.min(Math.max(Number(limite) || 15, 1), 30);
      const desde = dias ? new Date(Date.now() - Number(dias) * 86_400_000) : undefined;
      const where: Record<string, unknown> = {
        ...(estado ? { estado: String(estado) } : {}),
        ...(desde ? { createdAt: { gte: desde } } : {}),
        ...(cliente
          ? {
              cliente: {
                OR: [
                  { nombre: { contains: cliente, mode: "insensitive" } },
                  { empresa: { contains: cliente, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      };
      const nombreCliente = { cliente: { select: { nombre: true, empresa: true } } };

      if (tipo === "cotizaciones") {
        return limpiar(
          await prisma.cotizacion.findMany({
            where, take, orderBy: { createdAt: "desc" },
            select: { numero: true, estado: true, total: true, tieneInstalacion: true, createdAt: true, ...nombreCliente },
          }),
        );
      }
      if (tipo === "pedidos") {
        return limpiar(
          await prisma.pedido.findMany({
            where, take, orderBy: { createdAt: "desc" },
            select: { numero: true, estado: true, total: true, fechaEntrega: true, createdAt: true, ...nombreCliente },
          }),
        );
      }
      return limpiar(
        await prisma.instalacion.findMany({
          where: {
            ...(estado ? { estado: String(estado) } : {}),
            ...(desde ? { createdAt: { gte: desde } } : {}),
          },
          take, orderBy: { createdAt: "desc" },
          select: {
            estado: true, createdAt: true,
            pedido: { select: { numero: true, ...nombreCliente } },
          },
        }),
      );
    },
  },

  // ---------- Nivel ADMIN ----------
  {
    nombre: "kpis_negocio",
    descripcion:
      "Indicadores globales del negocio: ventas del período, conversión de cotizaciones, " +
      "valor de inventario, cartera pendiente y totales por módulo.",
    nivelMinimo: "ADMIN",
    esquema: obj({ dias: entero("Ventana en días para las métricas de venta. Por defecto 30.") }),
    async ejecutar({ dias }) {
      const desde = new Date(Date.now() - (Number(dias) || 30) * 86_400_000);
      const [
        productos, publicados, clientes, cotizaciones, cotizacionesGanadas,
        pedidos, ventasPeriodo, stockCritico, facturasPendientes,
      ] = await Promise.all([
        prisma.producto.count(),
        prisma.producto.count({ where: { publicado: true } }),
        prisma.cliente.count({ where: { activo: true } }),
        prisma.cotizacion.count({ where: { createdAt: { gte: desde } } }),
        prisma.cotizacion.count({ where: { createdAt: { gte: desde }, estado: "APROBADA" } }),
        prisma.pedido.count({ where: { createdAt: { gte: desde }, estado: { not: "CANCELADO" } } }),
        prisma.pedido.aggregate({
          where: { createdAt: { gte: desde }, estado: { not: "CANCELADO" } },
          _sum: { total: true },
        }),
        prisma.producto.count({ where: { stock: { lte: 5 } } }),
        // Cartera = lo que de verdad nos deben. Hay que excluir BORRADOR
        // (aún no se emitió, nadie la debe) y ANULADA (se anuló), y sumar
        // `saldoPendiente` en vez de `total`, porque una factura con abono
        // parcial ya no debe el total.
        //
        // Antes esto era `estado != "PAGADA"` sumando `total`: con una sola
        // factura ANULADA en el sistema, reportaba $2.076.669 de cartera
        // inexistente a la gerencia.
        prisma.factura.aggregate({
          where: { estado: { notIn: ["PAGADA", "BORRADOR", "ANULADA"] } },
          _sum: { saldoPendiente: true },
          _count: true,
        }),
      ]);
      return limpiar({
        ventanaDias: Number(dias) || 30,
        productos: { total: productos, publicados },
        clientesActivos: clientes,
        cotizaciones: {
          creadas: cotizaciones,
          aprobadas: cotizacionesGanadas,
          conversionPct: cotizaciones ? Math.round((cotizacionesGanadas / cotizaciones) * 100) : 0,
        },
        pedidos: { creados: pedidos, ventasTotales: ventasPeriodo._sum.total },
        stockCritico,
        cartera: {
          facturasPorCobrar: facturasPendientes._count,
          montoPorCobrar: facturasPendientes._sum.saldoPendiente ?? 0,
          nota: "Solo facturas emitidas y sin pagar. No incluye borradores ni anuladas.",
        },
      });
    },
  },

  {
    nombre: "consultar_compras",
    descripcion:
      "Proveedores y órdenes de compra: quién nos provee qué, órdenes en curso y pendientes de recibir.",
    nivelMinimo: "ADMIN",
    esquema: obj({
      texto: texto("Nombre del proveedor. Opcional."),
      limite: entero("Máximo de resultados (1-25). Por defecto 10."),
    }),
    async ejecutar({ texto: q, limite }) {
      const take = Math.min(Math.max(Number(limite) || 10, 1), 25);
      const [proveedores, ordenes] = await Promise.all([
        prisma.proveedor.findMany({
          where: q ? { nombre: { contains: q, mode: "insensitive" } } : {},
          take, orderBy: { nombre: "asc" },
        }),
        prisma.ordenCompra.findMany({
          where: { estado: { not: "RECIBIDA" } },
          take, orderBy: { createdAt: "desc" },
        }),
      ]);
      return limpiar({ proveedores, ordenesAbiertas: ordenes });
    },
  },

  {
    nombre: "consultar_facturacion",
    descripcion: "Facturas emitidas, pendientes de pago y cartera por cliente.",
    nivelMinimo: "ADMIN",
    esquema: obj({
      estado: texto("Filtrar por estado: BORRADOR, EMITIDA, PAGADA, ANULADA. Opcional."),
      limite: entero("Máximo de resultados (1-30). Por defecto 15."),
    }),
    async ejecutar({ estado, limite }) {
      const facturas = await prisma.factura.findMany({
        where: estado ? { estado: String(estado) } : {},
        take: Math.min(Math.max(Number(limite) || 15, 1), 30),
        orderBy: { createdAt: "desc" },
        include: { cliente: { select: { nombre: true, empresa: true, nit: true } } },
      });
      return limpiar(facturas);
    },
  },

  // ---------- Nivel SUPERADMIN ----------
  {
    nombre: "estado_sistema",
    descripcion:
      "Estado técnico del sistema: qué integraciones están configuradas (WooCommerce, FTP, IA, " +
      "canales de Nexus, Ads), conteo de usuarios por rol y últimos errores registrados. " +
      "Reporta si un secreto está configurado, nunca su valor.",
    nivelMinimo: "SUPERADMIN",
    esquema: obj({}),
    async ejecutar() {
      const [config, usuarios, conexiones, reportes] = await Promise.all([
        prisma.configuracion.findMany({ select: { clave: true, encrypted: true, valor: true } }),
        prisma.usuario.groupBy({ by: ["rol"], _count: true }),
        prisma.nexusConexion.findMany({
          select: { canal: true, nombre: true, activo: true, asignadoId: true },
        }),
        prisma.reporteError.findMany({
          where: { estado: { not: "RESUELTO" } },
          take: 10, orderBy: { createdAt: "desc" },
          select: { modulo: true, accion: true, descripcion: true, estado: true, createdAt: true },
        }),
      ]);
      // Nunca devolvemos el valor de un secreto, solo si existe.
      const integraciones = Object.fromEntries(
        config.map((c) => [c.clave, c.encrypted ? (c.valor ? "configurado" : "vacío") : c.valor]),
      );
      return limpiar({
        integraciones,
        usuariosPorRol: usuarios,
        conexionesNexus: conexiones,
        erroresAbiertos: reportes,
      });
    },
  },
];

/** Herramientas visibles para un nivel dado. */
export function herramientasPara(nivel: NivelSembli): Herramienta[] {
  return HERRAMIENTAS.filter((h) => alcanza(nivel, h.nivelMinimo));
}

/** Definiciones en el formato que espera la API de Anthropic. */
export function definicionesPara(nivel: NivelSembli) {
  return herramientasPara(nivel).map((h) => ({
    name: h.nombre,
    description: h.descripcion,
    input_schema: h.esquema,
  }));
}

/**
 * Ejecuta una herramienta revalidando el nivel. Esta es la barrera real:
 * incluso si el modelo inventara una llamada fuera de su alcance, aquí se
 * rechaza.
 */
export async function ejecutarHerramienta(
  nombre: string,
  args: Record<string, unknown>,
  quien: Solicitante,
): Promise<{ resultado: unknown; error: boolean }> {
  const h = HERRAMIENTAS.find((x) => x.nombre === nombre);
  if (!h) return { resultado: `No existe la herramienta ${nombre}.`, error: true };
  if (!alcanza(quien.nivel, h.nivelMinimo)) {
    return {
      resultado: `Sin permiso: '${nombre}' requiere nivel ${h.nivelMinimo} y el usuario es ${quien.nivel}.`,
      error: true,
    };
  }
  try {
    return { resultado: await h.ejecutar(args as Record<string, any>, quien), error: false };
  } catch (e) {
    return { resultado: `Error consultando datos: ${(e as Error).message}`, error: true };
  }
}
