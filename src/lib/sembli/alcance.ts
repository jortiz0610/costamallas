// ============================================================
// SEMBLI — Jerarquía de acceso del agente
//
// Sembli es UN solo agente disponible para todos, pero lo que puede
// ver y hacer depende del rol de quien pregunta. El alcance NO se
// define en el prompt (un prompt se puede convencer con palabras):
// se define aquí y se aplica en el ejecutor de herramientas, del
// lado del servidor. El prompt solo se lo explica al modelo.
//
//   CLIENTE     → catálogo público + SUS pedidos/cotizaciones. Nada más.
//   VENDEDOR    → + stock, clientes, cotizaciones, pedidos, consultas amplias.
//                 Nada de configuración ni de otros vendedores.
//   ADMIN       → todo el sistema (KPIs, compras, facturación, usuarios).
//   SUPERADMIN  → sin límite (incluye credenciales/conexiones y SQL de lectura).
// ============================================================

import type { Rol } from "@/lib/permisos";

/** Niveles de Sembli, en orden creciente de privilegio. */
export type NivelSembli = "CLIENTE" | "VENDEDOR" | "ADMIN" | "SUPERADMIN";

export const JERARQUIA: Record<NivelSembli, number> = {
  CLIENTE: 0,
  VENDEDOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

/**
 * Traduce el rol del sistema al nivel de Sembli.
 * Cualquier rol desconocido cae al nivel más bajo (fail-closed).
 */
export function nivelDeRol(rol: string | undefined): NivelSembli {
  switch (rol) {
    case "SUPERADMIN":
      return "SUPERADMIN";
    case "ADMIN":
      return "ADMIN";
    case "VENDEDOR":
    case "USUARIO":
    case "PRODUCCION":
    case "BODEGA":
      return "VENDEDOR";
    case "CLIENTE":
    case "SOLO_LECTURA":
    default:
      return "CLIENTE";
  }
}

/** ¿El nivel alcanza el mínimo exigido? */
export function alcanza(nivel: NivelSembli, minimo: NivelSembli): boolean {
  return JERARQUIA[nivel] >= JERARQUIA[minimo];
}

/** Contexto de quien está hablando con Sembli. */
export interface Solicitante {
  usuarioId: string;
  email: string;
  rol: Rol | "CLIENTE";
  nivel: NivelSembli;
  /** Solo para nivel CLIENTE: a qué ficha de Cliente está atado. */
  clienteId?: string | null;
  nombre?: string;
}

/**
 * Descripción del alcance que se inyecta en el system prompt, para que
 * el modelo no ofrezca cosas que la herramienta le va a negar.
 */
export const DESCRIPCION_ALCANCE: Record<NivelSembli, string> = {
  CLIENTE: [
    "Hablas con un CLIENTE de Costamallas.",
    "Solo puedes darle: información de productos del catálogo público, precios de lista,",
    "datos de la tienda (envíos, garantías, instalación) y el estado de SUS propios pedidos y cotizaciones.",
    "NUNCA reveles: stock interno, costos, márgenes, datos de otros clientes, nombres de vendedores,",
    "configuración del sistema ni nada administrativo. Si te lo piden, explica amablemente que",
    "para eso debe escribir a ventas y ofrece el canal de contacto.",
  ].join(" "),
  VENDEDOR: [
    "Hablas con un ASESOR COMERCIAL de Costamallas.",
    "Puedes consultar: catálogo completo, stock y alertas de inventario, clientes, cotizaciones,",
    "pedidos e instalaciones, y hacer consultas amplias y comparativas sobre esos datos.",
    "NO puedes: cambiar configuración, ver o tocar credenciales/conexiones, gestionar usuarios,",
    "ni entrar a facturación o compras. Si te piden algo de eso, dile que lo solicite a un administrador.",
  ].join(" "),
  ADMIN: [
    "Hablas con la GERENCIA / un ADMINISTRADOR de Costamallas.",
    "Puedes consultar todo el sistema: productos, stock, CRM completo, compras y proveedores,",
    "facturación, marketing, Nexus, usuarios, KPIs y logs.",
    "Lo único reservado es el manejo de credenciales y secretos, que es del superadministrador.",
  ].join(" "),
  SUPERADMIN: [
    "Hablas con el SUPERADMINISTRADOR.",
    "No tienes restricciones de consulta: cualquier dato del sistema, incluida la configuración",
    "técnica, el estado de las conexiones externas y los registros de auditoría.",
    "Nunca imprimas el valor de un secreto o token, ni siquiera a él: reporta solo si está configurado o no.",
  ].join(" "),
};
