// ============================================================
// COSTAMALLAS — Roles y permisos (cliente + servidor)
//
// Dos capas, y conviene no confundirlas:
//
//   1. El ROL trae un juego de permisos POR DEFECTO. Vive en código
//      (`PERMISOS_POR_ROL`), porque es política de la empresa, no un
//      dato: si mañana se agrega una pantalla, todos los vendedores
//      deben verla o no verla a la vez, sin tocar 20 filas de una tabla.
//   2. Cada USUARIO puede tener EXCEPCIONES, guardadas en la tabla
//      `permisos_usuario`: una fila por permiso concedido o retirado a
//      mano. Solo las excepciones — nunca el juego completo. Si se
//      guardara el juego completo, el día que el rol gane una pantalla
//      nueva nadie la vería.
//
// Este archivo no toca la base de datos: recibe las excepciones ya
// leídas. Así sirve igual en el servidor y en el navegador.
// ============================================================

export type Rol =
  | "SUPERADMIN"
  | "ADMIN"
  | "MARKETING"
  | "VENDEDOR"
  | "PRODUCCION"
  | "CLIENTE" // login del cliente final: solo su propia información
  // ── Retirados (29-ago) ──
  // Siguen en el tipo y en el enum de la base porque HAY GENTE con ellos
  // puestos: quitarlos del enum sería DDL destructivo sobre la única base
  // que existe, y borrarlos del código dejaría a esas personas sin
  // permisos de un día para otro. No se ofrecen al crear un usuario y no
  // salen en el panel de roles; quien ya los tiene sigue viendo lo mismo
  // que veía. Ver PENDIENTES §17.
  | "USUARIO"
  | "BODEGA"
  | "SOLO_LECTURA";

/** Los roles que se pueden asignar hoy. El orden es el del organigrama. */
export const ROLES_ASIGNABLES: Rol[] = [
  "SUPERADMIN", "ADMIN", "MARKETING", "VENDEDOR", "PRODUCCION",
];

/** Los que ya no se asignan pero siguen funcionando para quien los tiene. */
export const ROLES_RETIRADOS: Rol[] = ["USUARIO", "BODEGA", "SOLO_LECTURA"];

export const esRolRetirado = (rol?: string) => ROLES_RETIRADOS.includes(rol as Rol);

export const esSuperadmin = (rol?: string) => rol === "SUPERADMIN";
export const esAdmin = (rol?: string) => rol === "ADMIN" || rol === "SUPERADMIN";

// Capacidades sensibles
export function puede(rol: string | undefined, capacidad:
  | "gestionar_usuarios"        // ver/crear/editar usuarios
  | "editar_superadmin"         // solo superadmin
  | "config_empresa"            // datos globales de empresa
  | "config_ia"                 // proveedor IA
  | "conexiones_externas"       // canales, WhatsApp, Ads, WooCommerce
  | "ver_reportes_errores"      // bandeja de reportes
  | "campos_categoria"          // gestionar campos variables por categoría
  | "ia_consulta_amplia"        // el asistente puede consultar toda la BD
): boolean {
  switch (capacidad) {
    case "editar_superadmin":
    case "conexiones_externas":
    case "config_ia":
      return esSuperadmin(rol);
    case "gestionar_usuarios":
    case "config_empresa":
    case "ver_reportes_errores":
    case "campos_categoria":
    case "ia_consulta_amplia":
      return esAdmin(rol);
    default:
      return false;
  }
}

// ─────────────────────────────────────────────
// Catálogo de permisos
// ─────────────────────────────────────────────

export type ModuloClave = "ERP" | "CRM" | "NEXUS" | "MARKETING" | "SISTEMA";

export interface Permiso {
  /** Clave estable. NO renombrar: queda escrita en `permisos_usuario`. */
  clave: string;
  modulo: ModuloClave;
  label: string;
  /** Para qué sirve, en el idioma de quien administra el portal. */
  ayuda: string;
  /** `vista` = una pantalla del menú. `accion` = algo que se puede hacer
   *  dentro de una pantalla que ya se ve. Se listan aparte porque se
   *  administran distinto. */
  tipo: "vista" | "accion";
}

/**
 * El catálogo completo. El orden es el del menú, para que la pantalla de
 * permisos se parezca a lo que la persona ve después.
 */
export const PERMISOS: Permiso[] = [
  // ── ERP ──
  { clave: "erp.dashboard", modulo: "ERP", tipo: "vista", label: "Dashboard", ayuda: "La pantalla de inicio con los indicadores del negocio." },
  { clave: "erp.productos", modulo: "ERP", tipo: "vista", label: "Productos", ayuda: "El catálogo: buscar, abrir la ficha, ver precios y existencias." },
  { clave: "erp.imagenes", modulo: "ERP", tipo: "vista", label: "Imágenes", ayuda: "La biblioteca de fotos del catálogo." },
  { clave: "erp.stock", modulo: "ERP", tipo: "vista", label: "Stock", ayuda: "Existencias y alertas de mínimos." },
  { clave: "erp.catalogos", modulo: "ERP", tipo: "vista", label: "Catálogos", ayuda: "Categorías, marcas, unidades, colores y demás listas maestras." },
  { clave: "erp.compras", modulo: "ERP", tipo: "vista", label: "Compras", ayuda: "Proveedores y órdenes de compra." },
  { clave: "erp.facturacion", modulo: "ERP", tipo: "vista", label: "Facturación", ayuda: "Emitir y consultar facturas." },
  { clave: "erp.cartera", modulo: "ERP", tipo: "vista", label: "Cartera", ayuda: "Lo que deben los clientes y qué tan vencido está." },
  { clave: "erp.woocommerce", modulo: "ERP", tipo: "vista", label: "Sincronización WC", ayuda: "Empujar el catálogo a costamallas.com. Toca la tienda en vivo." },
  { clave: "erp.errores", modulo: "ERP", tipo: "vista", label: "Reporte de errores", ayuda: "La bandeja de fallos que reporta el equipo." },
  { clave: "erp.seo", modulo: "ERP", tipo: "vista", label: "SEO con IA", ayuda: "Generación masiva de textos SEO. Gasta dinero y publica en la tienda." },
  // Acciones dentro del ERP
  { clave: "erp.productos.editar", modulo: "ERP", tipo: "accion", label: "Editar productos", ayuda: "Sin esto, la ficha del producto se abre en modo lectura y solo se puede corregir el stock." },
  { clave: "erp.productos.ia", modulo: "ERP", tipo: "accion", label: "SEO y asistente IA en la ficha", ayuda: "Las pestañas de SEO y del asistente dentro del producto. Cada uso cuesta dinero." },
  { clave: "erp.imagenes.subir", modulo: "ERP", tipo: "accion", label: "Subir y borrar imágenes", ayuda: "Sin esto, la biblioteca de imágenes es de solo consulta." },

  // ── CRM ──
  { clave: "crm.resumen", modulo: "CRM", tipo: "vista", label: "Resumen", ayuda: "El tablero de arranque del CRM." },
  { clave: "crm.clientes", modulo: "CRM", tipo: "vista", label: "Clientes", ayuda: "Fichas de clientes y empresas." },
  { clave: "crm.cotizaciones", modulo: "CRM", tipo: "vista", label: "Cotizaciones", ayuda: "Crear, editar y enviar ofertas." },
  { clave: "crm.pedidos", modulo: "CRM", tipo: "vista", label: "Pedidos", ayuda: "Los pedidos en curso." },
  { clave: "crm.pipeline", modulo: "CRM", tipo: "vista", label: "Pipeline comercial", ayuda: "Tus ofertas, etapa por etapa: enviada, para llamar, por vencer." },
  { clave: "crm.pipeline_produccion", modulo: "CRM", tipo: "vista", label: "Pipeline de producción", ayuda: "El tablero de pedidos en fabricación. Normalmente no le sirve a quien vende, pero se puede activar." },
  { clave: "crm.instalaciones", modulo: "CRM", tipo: "vista", label: "Instalaciones", ayuda: "Calendario y seguimiento de las visitas." },
  { clave: "crm.trabajos", modulo: "CRM", tipo: "vista", label: "Trabajos de producción", ayuda: "La bandeja del coordinador: visitas técnicas solicitadas y documentos SG-SST." },
  { clave: "crm.embudo", modulo: "CRM", tipo: "vista", label: "Embudo", ayuda: "El análisis comercial agregado, con las cifras de todo el equipo." },
  { clave: "crm.postventa", modulo: "CRM", tipo: "vista", label: "Postventa", ayuda: "Encuesta de satisfacción y políticas públicas." },
  // Acciones del CRM
  { clave: "crm.ver_todo", modulo: "CRM", tipo: "accion", label: "Ver el CRM de todo el equipo", ayuda: "Sin esto, la persona solo ve sus propios clientes, cotizaciones y pedidos." },
  { clave: "crm.cotizaciones.prueba", modulo: "CRM", tipo: "accion", label: "Modo capacitación", ayuda: "Marcar un cliente como de capacitación. Todo lo que se le haga —cotizar, aprobar, instalar, facturar— funciona igual que con uno real, pero no gasta consecutivo ni entra en informes." },

  // ── NEXUS ──
  { clave: "nexus.inbox", modulo: "NEXUS", tipo: "vista", label: "Inbox", ayuda: "La bandeja de conversaciones con clientes." },
  { clave: "nexus.interno", modulo: "NEXUS", tipo: "vista", label: "Chat interno", ayuda: "Hablar con el equipo dentro del portal. No lo ve ningún cliente." },
  { clave: "nexus.ia", modulo: "NEXUS", tipo: "accion", label: "Asistente IA en el chat", ayuda: "Pedirle ayuda a la IA para redactar una respuesta. Cada uso cuesta dinero, así que se activa persona por persona." },
  { clave: "nexus.borrar", modulo: "NEXUS", tipo: "accion", label: "Borrar chats", ayuda: "Borra conversaciones de la bandeja, incluidas las de la web que nunca llegaron a cliente. Borra de verdad: se lleva los mensajes." },
  { clave: "nexus.plantillas", modulo: "NEXUS", tipo: "vista", label: "Plantillas", ayuda: "Los textos preescritos de respuesta." },
  { clave: "nexus.flujos", modulo: "NEXUS", tipo: "vista", label: "Flujos y automatización", ayuda: "Las reglas que responden solas." },
  { clave: "nexus.tiempos", modulo: "NEXUS", tipo: "vista", label: "Tiempo de respuesta", ayuda: "El informe de cuánto se tarda el equipo en contestar." },
  { clave: "nexus.conexiones", modulo: "NEXUS", tipo: "vista", label: "Conexiones", ayuda: "Los canales: WhatsApp, web, correo. Toca credenciales." },

  // ── MARKETING ──
  { clave: "mkt.dashboard", modulo: "MARKETING", tipo: "vista", label: "Dashboard", ayuda: "Los indicadores de marketing." },
  { clave: "mkt.campanas", modulo: "MARKETING", tipo: "vista", label: "Campañas", ayuda: "Las campañas de anuncios y su inversión." },
  { clave: "mkt.atribucion", modulo: "MARKETING", tipo: "vista", label: "Atribución de leads", ayuda: "De dónde llegó cada contacto." },
  { clave: "mkt.retorno", modulo: "MARKETING", tipo: "vista", label: "Retorno real", ayuda: "La plata cerrada frente a la invertida." },
  { clave: "mkt.reportes", modulo: "MARKETING", tipo: "vista", label: "Reportes", ayuda: "Los informes de marketing." },
  { clave: "mkt.conexiones", modulo: "MARKETING", tipo: "vista", label: "Conexiones de Ads", ayuda: "Las cuentas de Google, Meta y TikTok Ads." },

  // ── SISTEMA ──
  { clave: "sistema.usuarios", modulo: "SISTEMA", tipo: "vista", label: "Usuarios y roles", ayuda: "Altas, bajas y permisos del equipo." },
  { clave: "sistema.reportes", modulo: "SISTEMA", tipo: "vista", label: "Reportes y logs", ayuda: "La auditoría: quién hizo qué y cuándo." },
  { clave: "sistema.salud", modulo: "SISTEMA", tipo: "vista", label: "Estado del sistema", ayuda: "De un vistazo: qué está conectado, qué está roto y qué deja de funcionar por ello." },
  { clave: "sistema.ensayo", modulo: "SISTEMA", tipo: "vista", label: "Ensayo general", ayuda: "Recorre el proceso completo con datos de prueba para comprobar que los correos salen. Crea datos reales marcados como prueba." },
  { clave: "sistema.seguridad", modulo: "SISTEMA", tipo: "vista", label: "Seguridad", ayuda: "Sesiones, 2FA y dispositivos de confianza." },
  { clave: "sistema.configuracion", modulo: "SISTEMA", tipo: "vista", label: "Configuración", ayuda: "Todos los ajustes del portal." },
];

export const PERMISOS_POR_CLAVE: Record<string, Permiso> =
  Object.fromEntries(PERMISOS.map(p => [p.clave, p]));

/** Todas las claves, en orden. Es lo que tiene el SUPERADMIN. */
export const TODAS_LAS_CLAVES = PERMISOS.map(p => p.clave);

// ─────────────────────────────────────────────
// El juego por defecto de cada rol
// ─────────────────────────────────────────────

const VENDEDOR_POR_DEFECTO = [
  // ERP: lo que necesita para vender, y nada de la trastienda.
  "erp.dashboard", "erp.productos", "erp.imagenes", "erp.stock",
  // CRM: todo su ciclo comercial. Sin embudo (son las cifras del equipo),
  // sin postventa (es de administración) y sin el pipeline de PRODUCCIÓN:
  // el tablero de fabricación no le dice nada a quien vende, y encima
  // invita a mover tarjetas de un proceso que no controla. Si en algún
  // momento hace falta, se le activa a esa persona sin tocar el rol.
  "crm.resumen", "crm.clientes", "crm.cotizaciones", "crm.pedidos",
  "crm.pipeline", "crm.instalaciones",
  // Nexus: la bandeja de clientes y el chat con el equipo. El
  // asistente de IA viene ENCENDIDO porque ya lo estaba usando; el
  // administrador puede apagarlo persona por persona si se dispara el
  // gasto.
  // Puede limpiar su bandeja: es quien la sufre cuando se llena de
  // visitas de la web que preguntaron un precio y no volvieron.
  "nexus.inbox", "nexus.interno", "nexus.ia", "nexus.borrar",
];

const PRODUCCION_POR_DEFECTO = [
  // ERP: exactamente lo mismo que el vendedor. Consulta el catálogo y
  // corrige existencias cuando entra o sale material; nada más.
  "erp.dashboard", "erp.productos", "erp.imagenes", "erp.stock",
  // CRM: solo lo suyo — el tablero de fabricación, sus trabajos y las
  // instalaciones. No ve clientes, ni cotizaciones, ni el pipeline
  // comercial: no son su trabajo y contienen precios y márgenes.
  "crm.pipeline_produccion", "crm.trabajos", "crm.instalaciones",
  // Ve las obras de TODO el equipo: un trabajo no "es suyo" por
  // vendedorId, así que sin esto la bandeja del coordinador sale vacía.
  "crm.ver_todo",
  // Nexus: SOLO el chat interno. La bandeja de clientes es del área
  // comercial; producción habla con el equipo, no con el cliente.
  "nexus.interno",
];

/**
 * Marketing.
 *
 * Vive de las cifras: sus campañas, de dónde llegó cada lead y qué se
 * cerró. Necesita el embudo y la lista de clientes para segmentar, pero
 * no toca ofertas ni pedidos.
 */
const MARKETING_POR_DEFECTO = [
  "mkt.dashboard", "mkt.campanas", "mkt.atribucion", "mkt.retorno", "mkt.reportes",
  "crm.embudo", "crm.clientes", "crm.ver_todo",
  "nexus.interno",
];

const BODEGA_POR_DEFECTO = [
  "erp.dashboard", "erp.productos", "erp.imagenes", "erp.stock",
  "erp.catalogos", "erp.compras",
  "erp.productos.editar", "erp.imagenes.subir",
];

const USUARIO_POR_DEFECTO = [
  "erp.dashboard", "erp.productos", "erp.imagenes", "erp.stock", "erp.catalogos",
  "crm.resumen", "crm.clientes", "crm.cotizaciones", "crm.pedidos",
  "nexus.inbox",
];

// El administrador lo ve todo menos lo que `puede()` reserva al
// superadministrador: las conexiones externas (credenciales de terceros)
// y el SEO con IA (gasta dinero y publica en la tienda). Se deriva del
// catálogo para que una pantalla nueva no se le olvide a nadie.
const ADMIN_POR_DEFECTO = TODAS_LAS_CLAVES.filter(
  c => c !== "nexus.conexiones" && c !== "mkt.conexiones" && c !== "erp.seo"
    // El ensayo crea datos y manda correos DE VERDAD. Ofrecérselo en el
    // menú a alguien que va a chocar con un 403 es peor que no ponerlo.
    && c !== "sistema.ensayo",
);

// Solo lectura ve todas las PANTALLAS y ninguna acción. Que no pueda
// escribir ya lo impone `canWrite()`; esto evita además ofrecerle
// botones que le van a fallar.
const SOLO_LECTURA_POR_DEFECTO = PERMISOS
  .filter(p => p.tipo === "vista" && p.modulo !== "SISTEMA")
  .map(p => p.clave);

export const PERMISOS_POR_ROL: Record<string, string[]> = {
  SUPERADMIN: TODAS_LAS_CLAVES,
  ADMIN: ADMIN_POR_DEFECTO,
  MARKETING: MARKETING_POR_DEFECTO,
  VENDEDOR: VENDEDOR_POR_DEFECTO,
  PRODUCCION: PRODUCCION_POR_DEFECTO,
  CLIENTE: [], // no entra al portal interno

  // Retirados: se conservan tal cual estaban para no cambiarle el portal
  // de un día para otro a quien los tenga puestos.
  BODEGA: BODEGA_POR_DEFECTO,
  USUARIO: USUARIO_POR_DEFECTO,
  SOLO_LECTURA: SOLO_LECTURA_POR_DEFECTO,
};

// ─────────────────────────────────────────────
// Cálculo del permiso efectivo
// ─────────────────────────────────────────────

/** Las excepciones de una persona: clave → concedido/retirado. */
export type ExcepcionesPermisos = Record<string, boolean>;

/**
 * Lo que esta persona puede ver y hacer, de verdad.
 *
 * El SUPERADMIN queda fuera del cálculo a propósito: si una excepción
 * mal puesta pudiera quitarle la pantalla de usuarios, se quedaría sin
 * forma de arreglarlo desde el portal.
 */
export function permisosEfectivos(
  rol: string | undefined,
  excepciones?: ExcepcionesPermisos | null,
): Set<string> {
  if (!rol) return new Set();
  if (esSuperadmin(rol)) return new Set(TODAS_LAS_CLAVES);

  const efectivos = new Set(PERMISOS_POR_ROL[rol] ?? []);
  for (const [clave, permitido] of Object.entries(excepciones ?? {})) {
    // Una clave que ya no existe en el catálogo se ignora en silencio:
    // la fila puede venir de una versión anterior del portal.
    if (!PERMISOS_POR_CLAVE[clave]) continue;
    if (permitido) efectivos.add(clave);
    else efectivos.delete(clave);
  }
  return efectivos;
}

/** Atajo para una sola clave, partiendo del rol y sus excepciones. */
export function tienePermiso(
  rol: string | undefined,
  excepciones: ExcepcionesPermisos | null | undefined,
  clave: string,
): boolean {
  return permisosEfectivos(rol, excepciones).has(clave);
}

/** Igual, pero cuando los permisos ya vienen calculados (el caso del navegador). */
export function tiene(permisos: Iterable<string> | undefined | null, clave: string): boolean {
  if (!permisos) return false;
  return permisos instanceof Set ? permisos.has(clave) : Array.from(permisos).includes(clave);
}

// ─────────────────────────────────────────────
// Módulos (las pestañas de arriba del menú)
// ─────────────────────────────────────────────

/**
 * Un módulo se ve si la persona tiene AL MENOS una pantalla suya. Antes
 * era una lista aparte, y eso permitía el peor estado posible: la
 * pestaña ERP encendida y el menú de adentro vacío.
 */
export function modulosVisibles(permisos: Iterable<string>): ModuloClave[] {
  const set = new Set(permisos);
  const orden: ModuloClave[] = ["ERP", "CRM", "NEXUS", "MARKETING", "SISTEMA"];
  return orden.filter(m =>
    PERMISOS.some(p => p.modulo === m && p.tipo === "vista" && set.has(p.clave)),
  );
}

/**
 * Compatibilidad con el código que ya preguntaba por módulo. Ahora se
 * deriva de los permisos del rol; el resultado para los roles que ya
 * existían es el mismo que antes, salvo que VENDEDOR gana ERP — que es
 * justamente lo que se pidió.
 */
export function puedeVerModulo(rol: string | undefined, modulo: string): boolean {
  if (!rol) return false;
  return modulosVisibles(permisosEfectivos(rol)).includes(modulo as ModuloClave);
}

/** @deprecated Se conserva para no romper importaciones viejas. */
export const MODULOS_POR_ROL: Record<string, string[]> = Object.fromEntries(
  Object.keys(PERMISOS_POR_ROL).map(rol => [rol, modulosVisibles(PERMISOS_POR_ROL[rol])]),
);

// ─────────────────────────────────────────────
// Qué permiso exige cada ruta del portal
// ─────────────────────────────────────────────

/**
 * Ruta → permiso. Gana la coincidencia MÁS LARGA, así que agregar una
 * subruta no vuelve ambiguo al padre (`/facturacion/cartera` pide
 * cartera, no facturación).
 *
 * Vive aquí y no repartido por las páginas para que se pueda leer de un
 * vistazo qué protege qué. Lo que no aparece en esta tabla no exige
 * permiso: son pantallas que puede ver cualquiera que entre al portal.
 */
export const RUTAS_PROTEGIDAS: Record<string, string> = {
  "/": "erp.dashboard",
  "/productos": "erp.productos",
  "/productos/seo": "erp.seo",
  // Crear un producto es editar el catálogo, no solo verlo.
  "/productos/nuevo": "erp.productos.editar",
  "/imagenes": "erp.imagenes",
  "/stock": "erp.stock",
  "/categorias": "erp.catalogos",
  "/compras": "erp.compras",
  "/facturacion": "erp.facturacion",
  "/facturacion/cartera": "erp.cartera",
  "/woocommerce": "erp.woocommerce",
  "/exportar": "erp.woocommerce",
  "/importar": "erp.woocommerce",
  "/errores": "erp.errores",
  "/sistema/reportes": "erp.errores",

  "/crm": "crm.resumen",
  "/crm/tareas": "crm.resumen",
  "/crm/clientes": "crm.clientes",
  "/crm/cotizaciones": "crm.cotizaciones",
  "/crm/cotizador": "crm.cotizaciones",
  "/crm/pedidos": "crm.pedidos",
  // Una sola pantalla con dos pestañas: el comercial y el de
  // producción. Basta con tener UNA de las dos para entrar; qué pestaña
  // se ve lo decide la pantalla.
  "/crm/pipeline": "crm.pipeline|crm.pipeline_produccion",
  "/nexus/interno": "nexus.interno",
  "/crm/instalaciones": "crm.instalaciones",
  "/crm/trabajos": "crm.trabajos",
  "/crm/embudo": "crm.embudo",
  "/postventa": "crm.postventa",
  "/postventa/resultados": "crm.postventa",

  "/nexus": "nexus.inbox",
  "/nexus/plantillas": "nexus.plantillas",
  "/nexus/flujos": "nexus.flujos",
  "/nexus/tiempos": "nexus.tiempos",

  "/marketing": "mkt.dashboard",
  "/marketing/campanas": "mkt.campanas",
  "/marketing/atribucion": "mkt.atribucion",
  "/marketing/retorno": "mkt.retorno",
  "/marketing/reportes": "mkt.reportes",

  "/usuarios": "sistema.usuarios",
  "/reportes": "sistema.reportes",
  "/sistema/salud": "sistema.salud",
  "/sistema/ensayo": "sistema.ensayo",
  "/sistema/seguridad": "sistema.seguridad",
  "/configuracion": "sistema.configuracion",
};

/**
 * ¿Estos permisos cumplen lo que pide una ruta?
 *
 * Una ruta puede pedir varios separados por `|`: basta con tener uno.
 * Es para las pantallas que agrupan dos cosas en pestañas.
 */
export function cumplePermisoDeRuta(permisos: Set<string> | string[], exigido: string): boolean {
  const set = permisos instanceof Set ? permisos : new Set(permisos);
  return exigido.split("|").some(c => set.has(c.trim()));
}

/** Qué permiso hace falta para esta URL, o `null` si no exige ninguno. */
export function permisoDeRuta(pathname: string): string | null {
  let mejor: string | null = null;
  for (const ruta of Object.keys(RUTAS_PROTEGIDAS)) {
    const coincide =
      ruta === "/" ? pathname === "/" : pathname === ruta || pathname.startsWith(ruta + "/");
    if (coincide && (!mejor || ruta.length > mejor.length)) mejor = ruta;
  }
  return mejor ? RUTAS_PROTEGIDAS[mejor] : null;
}
