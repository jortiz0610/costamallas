import { z } from "zod";

export const productoSchema = z.object({
  tipo: z.enum(["SIMPLE", "VARIABLE", "AGRUPADO", "EXTERNO"]).default("SIMPLE"),
  sku: z.string().min(1, "SKU requerido").max(50),
  nombre: z.string().min(2, "Nombre requerido").max(255),
  slug: z.string().max(255).optional(),
  publicado: z.boolean().default(false),
  visibilidad: z.string().default("visible"),
  destacado: z.boolean().default(false),
  descCorta: z.string().max(500).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  seoTitulo: z.string().max(70).optional().nullable(),
  seoDescripcion: z.string().max(200).optional().nullable(),
  seoKeywords: z.array(z.string()).optional(),
  seoTexto: z.string().optional().nullable(),
  precioNormal: z.number().positive("El precio debe ser positivo").optional().nullable(),
  precioOferta: z.number().positive().optional().nullable(),
  estadoImpuesto: z.string().optional().nullable(),
  claseImpuesto: z.string().optional().nullable(),
  enStock: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
  stockMinimo: z.number().int().min(0).default(15),
  permiteBackorders: z.enum(["no", "notify", "yes"]).default("no"),
  pesoKg: z.number().positive().optional().nullable(),
  largoCm: z.number().positive().optional().nullable(),
  anchoCm: z.number().positive().optional().nullable(),
  altoCm: z.number().positive().optional().nullable(),
  categorias: z.array(z.string()).default([]),
  etiquetas: z.array(z.string()).default([]),
  claseEnvio: z.string().optional().nullable(),
  notaCompra: z.string().optional().nullable(),
  permiteResenas: z.boolean().default(true),
  acfSkuInterno: z.string().optional().nullable(),
  acfMarcaFabricante: z.string().optional().nullable(),
  acfUnidadVenta: z.string().optional().nullable(),
  acfFabricacionMedida: z.boolean().default(false),
  acfInstalacion: z.boolean().default(false),
  // No admite descuento por linea. Si entra en el descuento global.
  sinDescuento: z.boolean().default(false),
  acfGarantiaAnos: z.number().int().min(0).optional().nullable(),
  acfAplicaciones: z.array(z.string()).default([]),
  acfColores: z.array(z.string()).default([]),
  acfNormas: z.array(z.string()).default([]),
  // ── La ficha técnica en PDF ──
  //
  // Un campo de texto vacío manda `""`, no `undefined`. Y `""` NO es una
  // URL válida, así que `.url().optional().nullable()` la rechazaba:
  // crear un producto sin ficha técnica —que son casi todos— fallaba con
  // «URL inválida», un mensaje que además no decía de qué campo hablaba.
  //
  // Se traduce el vacío a `null` antes de validar, que es lo que
  // significa de verdad: "no hay ficha". Se recorta también el espacio
  // sobrante, porque una URL pegada desde el navegador suele traerlo y
  // fallaría por un motivo invisible.
  acfFichaTecnicaPdf: z.preprocess(
    v => {
      if (typeof v !== "string") return v;
      const limpio = v.trim();
      return limpio === "" ? null : limpio;
    },
    z.string().url("URL inválida").nullable().optional(),
  ),
  acfCertificaciones: z.array(z.string()).default([]),
  acfExtra: z.record(z.unknown()).optional().default({}),
  intEstado: z.enum(["BORRADOR", "REVISION", "LISTO", "PUBLICADO", "ARCHIVADO"]).default("BORRADOR"),
  intResponsable: z.string().optional().nullable(),
  intObservaciones: z.string().optional().nullable(),
  intListoExportar: z.boolean().default(false),
});

export const filtrosProductosSchema = z.object({
  busqueda: z.string().optional(),
  categoria: z.string().optional(),
  estado: z.enum(["BORRADOR", "REVISION", "LISTO", "PUBLICADO", "ARCHIVADO"]).optional(),
  publicado: z.coerce.boolean().optional(),
  stockCritico: z.coerce.boolean().optional(),

  // ── Filtros de trabajo del catálogo ──
  // Responden a "qué me falta para poder publicar" y "qué está mal",
  // que es lo que de verdad se busca cuando se abre esta pantalla.
  /** Nivel calculado comparando stock con el mínimo de cada producto. */
  nivel: z.enum(["AGOTADO", "CRITICO", "BAJO", "ADVERTENCIA", "OK"]).optional(),
  sinImagen: z.coerce.boolean().optional(),
  sinPrecio: z.coerce.boolean().optional(),
  sinSEO: z.coerce.boolean().optional(),
  sinFicha: z.coerce.boolean().optional(),
  /** Nunca ha llegado a la tienda: no tiene wcId. */
  sinTienda: z.coerce.boolean().optional(),
  listoExportar: z.coerce.boolean().optional(),
  aMedida: z.coerce.boolean().optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  orderBy: z.enum(["updatedAt", "createdAt", "nombre", "sku", "precioNormal", "stock"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type ProductoInput = z.infer<typeof productoSchema>;
export type FiltrosProductosInput = z.infer<typeof filtrosProductosSchema>;
