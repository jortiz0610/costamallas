// ============================================================
// COSTAMALLAS ERP — Tipos globales TypeScript
// ============================================================

export type Rol =
  | "SUPERADMIN"
  | "ADMIN"
  | "USUARIO"
  | "VENDEDOR"
  | "PRODUCCION"
  | "BODEGA"
  | "SOLO_LECTURA"
  | "CLIENTE";

export type TipoProducto = "SIMPLE" | "VARIABLE" | "AGRUPADO" | "EXTERNO";

export type EstadoProducto =
  | "BORRADOR"
  | "REVISION"
  | "LISTO"
  | "PUBLICADO"
  | "ARCHIVADO";

export type SeveridadError = "CRITICO" | "ALTO" | "MEDIO" | "BAJO" | "INFO";

export type EstadoCorreccion =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "RESUELTO"
  | "IGNORADO";

export type TipoNotificacion =
  | "STOCK_CRITICO"
  | "STOCK_BAJO"
  | "ERROR_VALIDACION"
  | "EXPORTACION_COMPLETA"
  | "SYNC_WOOCOMMERCE"
  | "SISTEMA"
  | "NEXUS_MENSAJE";

export type TipoCatalogo =
  | "CATEGORIA"
  | "MARCA"
  | "CLASE_ENVIO"
  | "CLASE_IMPUESTO"
  | "UNIDAD_VENTA"
  | "COLOR"
  | "NORMA"
  | "APLICACION";

export type NivelStock = "OK" | "ADVERTENCIA" | "BAJO" | "CRITICO";

// ── Usuario ──────────────────────────────────

export interface UsuarioDTO {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  /// Permisos ya calculados (rol + excepciones). Los manda /api/auth/me:
  /// el navegador no puede calcularlos solo porque las excepciones
  /// viven en la base de datos.
  permisos?: string[];
  /// Solo con el modo prueba activo: el rol de verdad de la sesión.
  rolReal?: Rol;
  rolPrueba?: boolean;
}

export interface JWTPayload {
  sub: string;
  email: string;
  nombre: string;
  /** El rol con el que se está navegando. En modo prueba NO es el del
   *  token: es el que el superadministrador se puso encima. */
  rol: Rol;
  iat?: number;
  exp?: number;

  // ── "Ver el portal como…" ──
  // Estos dos NO viajan en el token: los agrega getUserFromRequest al
  // leer la cookie. Así probarse un rol no obliga a reemitir la sesión.
  /** El rol de verdad. Solo aparece con el modo prueba activo. */
  rolReal?: Rol;
  /** true = está viendo el portal como otro rol, y NADA se guarda. */
  rolPrueba?: boolean;
}

// ── Producto ──────────────────────────────────

export interface ProductoListItem {
  id: string;
  wcId: number | null;
  sku: string;
  nombre: string;
  slug: string;
  publicado: boolean;
  precioNormal: number | null;
  precioOferta: number | null;
  stock: number;
  stockMinimo: number;
  nivelStock: NivelStock;
  categorias: string[];
  intEstado: EstadoProducto;
  intListoExportar: boolean;
  updatedAt: string;
  imagenPrincipal?: string | null;
  /** Se fabrica a la medida: al cotizarlo se piden largo y ancho. */
  acfFabricacionMedida?: boolean;
  acfUnidadVenta?: string | null;
  /** No admite descuento por línea (margen mínimo). */
  sinDescuento?: boolean;
  /** Para el filtro por medida de la biblioteca de imágenes. */
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  _count?: { imagenes: number };
}

export interface ProductoDetalle extends ProductoListItem {
  tipo: TipoProducto;
  visibilidad: string;
  destacado: boolean;
  descCorta: string | null;
  descripcion: string | null;
  precioOferta: number | null;
  estadoImpuesto: string | null;
  claseImpuesto: string | null;
  enStock: boolean;
  permiteBackorders: string;
  pesoKg: number | null;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
  etiquetas: string[];
  claseEnvio: string | null;
  notaCompra: string | null;
  permiteResenas: boolean;
  acfSkuInterno: string | null;
  acfMarcaFabricante: string | null;
  acfUnidadVenta: string | null;
  acfFabricacionMedida: boolean;
  acfInstalacion: boolean;
  acfGarantiaAnos: number | null;
  acfAplicaciones: string[];
  acfColores: string[];
  acfNormas: string[];
  acfFichaTecnicaPdf: string | null;
  acfCertificaciones: string[];
  /** Campos ACF variables por categoría. Incluye `fichaTecnicaUrl`. */
  acfExtra?: Record<string, unknown> | null;
  seoTitulo: string | null;
  seoDescripcion: string | null;
  seoKeywords: string[];
  seoTexto: string | null;
  intResponsable: string | null;
  intObservaciones: string | null;
  intExportadoEn: string | null;
  imagenes: ImagenDTO[];
  createdAt: string;
}

export interface ImagenDTO {
  id: string;
  posicion: number;
  urlImagen: string;
  altText: string | null;
  titulo: string | null;
  esPrincipal: boolean;
  urlValida: boolean | null;
}

// ── Filtros y paginación ──────────────────────

export interface ProductosFiltros {
  busqueda?: string;
  categoria?: string;
  estado?: EstadoProducto;
  publicado?: boolean;
  stockCritico?: boolean;
  page?: number;
  limit?: number;
  orderBy?: "updatedAt" | "nombre" | "sku" | "precioNormal" | "stock";
  order?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Dashboard KPIs ────────────────────────────

export interface DashboardKPIs {
  productos: {
    total: number;
    publicados: number;
    borradores: number;
    listos: number;
    sinPrecio: number;
    sinImagen: number;
    precioPromedio: number;
  };
  stock: {
    criticos: number;
    bajos: number;
    advertencia: number;
    ok: number;
    alertas: StockAlerta[];
  };
  categorias: CategoriaKPI[];
  woocommerce: {
    ultimaSync: string | null;
    pendientesExportar: number;
    erroresPendientes: number;
  };
}

export interface StockAlerta {
  id: string;
  sku: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  nivelStock: NivelStock;
}

export interface CategoriaKPI {
  categoria: string;
  total: number;
  porcentaje: number;
}

// ── Notificaciones ────────────────────────────

export interface NotificacionDTO {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

// ── Logs ──────────────────────────────────────

export interface LogDTO {
  id: string;
  accion: string;
  detalle: string | null;
  resultado: string | null;
  archivoGenerado: string | null;
  totalFilas: number | null;
  ipAddress: string | null;
  usuario: { nombre: string; email: string } | null;
  createdAt: string;
}

// ── Errores ───────────────────────────────────

export interface ErrorValidacionDTO {
  id: string;
  skuRef: string | null;
  tipoError: string;
  severidad: SeveridadError;
  mensaje: string;
  accionRecomendada: string | null;
  estadoCorreccion: EstadoCorreccion;
  producto: { sku: string; nombre: string } | null;
  createdAt: string;
}

// ── API responses ─────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface WCTestResult {
  ok: boolean;
  storeUrl: string;
  storeName: string;
  version: string;
  message?: string;
}
