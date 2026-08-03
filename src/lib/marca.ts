// ============================================================
// Datos de la empresa para documentos que se generan en el servidor
// (la cotización pública, los correos). El portal los lee por API con
// sesión; aquí no hay sesión, así que se leen directo de `configuracion`.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface Marca {
  companyName: string; brandColor: string; legalName?: string; nit?: string;
  address?: string; phone?: string; email?: string; logoUrl?: string | null;
}

const CLAVES = [
  "empresa_nombre", "empresa_legal", "empresa_nit", "empresa_direccion",
  "empresa_telefono", "empresa_email", "empresa_color", "empresa_logo",
];

export async function getMarca(): Promise<Marca> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: CLAVES } },
    select: { clave: true, valor: true },
  });
  const m = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  return {
    companyName: m.empresa_nombre || "Costamallas",
    // El amarillo de la marca. Es el mismo de costamallas.com.
    brandColor: m.empresa_color || "#ffdd00",
    legalName: m.empresa_legal || undefined,
    nit: m.empresa_nit || undefined,
    address: m.empresa_direccion || undefined,
    phone: m.empresa_telefono || undefined,
    email: m.empresa_email || undefined,
    logoUrl: m.empresa_logo || null,
  };
}
