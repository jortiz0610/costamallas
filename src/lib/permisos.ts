// ============================================================
// COSTAMALLAS — Roles y permisos (cliente + servidor)
// Jerarquía y reglas de acceso por rol. Sin dependencias de servidor.
// ============================================================

export type Rol = "SUPERADMIN" | "ADMIN" | "USUARIO" | "VENDEDOR" | "PRODUCCION" | "BODEGA" | "SOLO_LECTURA";

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

// Acceso por módulo (vista). Permisos finos por usuario pueden refinarlo luego.
export const MODULOS_POR_ROL: Record<string, string[]> = {
  SUPERADMIN: ["ERP", "CRM", "NEXUS", "MARKETING", "SISTEMA"],
  ADMIN:      ["ERP", "CRM", "NEXUS", "MARKETING", "SISTEMA"],
  VENDEDOR:   ["CRM", "NEXUS"],
  PRODUCCION: ["ERP", "CRM"],
  BODEGA:     ["ERP"],
  USUARIO:    ["ERP", "CRM"],
  SOLO_LECTURA: ["ERP", "CRM", "NEXUS", "MARKETING"],
};

export function puedeVerModulo(rol: string | undefined, modulo: string): boolean {
  if (!rol) return false;
  return (MODULOS_POR_ROL[rol] ?? []).includes(modulo);
}
