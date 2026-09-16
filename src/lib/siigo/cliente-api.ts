// ============================================================
// Hablar con SIIGO. SOLO LECTURA.
//
// Aquí no hay ni un POST, ni un PUT, ni un DELETE contra SIIGO, y no es
// un descuido: SIIGO es la CONTABILIDAD de la empresa. Un error nuestro
// escribiendo ahí no es un dato feo en una pantalla, es un documento
// contable mal emitido. El portal lee de SIIGO y punto; lo que se emite
// en SIIGO lo emite una persona desde SIIGO.
//
// LAS CREDENCIALES no van en el repositorio. Viven cifradas en la tabla
// `configuracion`, igual que las de WordPress, y se cargan de ahí.
//
// El token dura 24 horas y se reaprovecha: pedir uno nuevo en cada
// llamada gastaría una petición de autenticación por cada página de
// resultados, y una importación de 4.284 clientes son 43 páginas.
// ============================================================

import { prisma } from "@/lib/prisma";
import { decryptIfNeeded } from "@/lib/encryption";

export const CLAVE_USUARIO = "siigo_usuario";
export const CLAVE_ACCESS_KEY = "siigo_access_key";
export const CLAVE_PARTNER_ID = "siigo_partner_id";

const BASE = "https://api.siigo.com";

export interface CredencialesSiigo {
  usuario: string;
  accessKey: string;
  partnerId: string;
}

export async function credencialesSiigo(): Promise<CredencialesSiigo | null> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: [CLAVE_USUARIO, CLAVE_ACCESS_KEY, CLAVE_PARTNER_ID] } },
  });
  const mapa = Object.fromEntries(filas.map(f => [f.clave, f]));

  const usuario = mapa[CLAVE_USUARIO]?.valor;
  const crudo = mapa[CLAVE_ACCESS_KEY]?.valor;
  if (!usuario || !crudo) return null;

  const accessKey = mapa[CLAVE_ACCESS_KEY].encrypted ? decryptIfNeeded(crudo) : crudo;
  // El Partner-Id es obligatorio en todas las llamadas. Identifica a la
  // aplicación que consulta; si no está configurado se usa el nombre de
  // la empresa, que es lo que SIIGO acepta hoy.
  const partnerId = mapa[CLAVE_PARTNER_ID]?.valor || "Costamallas";

  return { usuario, accessKey, partnerId };
}

// ── El token, reaprovechado mientras siga vivo ──
let cache: { token: string; expiraEn: number; partnerId: string } | null = null;

export async function tokenSiigo(forzar = false): Promise<string> {
  const creds = await credencialesSiigo();
  if (!creds) throw new Error("SIIGO no está configurado. Faltan usuario y clave de API.");

  const margen = 60_000; // se renueva un minuto antes de vencer
  if (!forzar && cache && cache.expiraEn - margen > Date.now() && cache.partnerId === creds.partnerId) {
    return cache.token;
  }

  const r = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Partner-Id": creds.partnerId },
    body: JSON.stringify({ username: creds.usuario, access_key: creds.accessKey }),
  });

  const texto = await r.text();
  if (!r.ok) {
    // El cuerpo de SIIGO explica si es clave mala o usuario mal escrito;
    // se conserva porque "no autenticó" no dice cuál de las dos.
    throw new Error(`SIIGO rechazó las credenciales (HTTP ${r.status}): ${texto.slice(0, 200)}`);
  }

  const j = JSON.parse(texto) as { access_token: string; expires_in: number };
  cache = {
    token: j.access_token,
    expiraEn: Date.now() + (j.expires_in ?? 86400) * 1000,
    partnerId: creds.partnerId,
  };
  return cache.token;
}

/** Una lectura. `ruta` empieza por "/". */
export async function leerSiigo<T = unknown>(ruta: string): Promise<T> {
  const creds = await credencialesSiigo();
  if (!creds) throw new Error("SIIGO no está configurado.");
  const token = await tokenSiigo();

  const pedir = async (tk: string) =>
    fetch(BASE + ruta, {
      headers: {
        Authorization: `Bearer ${tk}`,
        "Partner-Id": creds.partnerId,
        "Content-Type": "application/json",
      },
    });

  let r = await pedir(token);
  // Un 401 a mitad de una importación larga significa que el token
  // caducó antes de lo previsto. Se pide uno nuevo y se reintenta UNA
  // vez: si vuelve a fallar, es un problema de credenciales de verdad.
  if (r.status === 401) r = await pedir(await tokenSiigo(true));

  const texto = await r.text();
  if (!r.ok) throw new Error(`SIIGO ${ruta} → HTTP ${r.status}: ${texto.slice(0, 200)}`);
  return JSON.parse(texto) as T;
}

export interface PaginaSiigo<T> {
  pagination: { page: number; page_size: number; total_results: number };
  results: T[];
}

/**
 * Recorre TODAS las páginas de un listado.
 *
 * `alLote` se llama con cada página según llega, en vez de acumular
 * todo en memoria y devolverlo al final: son miles de registros, y así
 * la importación puede ir guardando y avisando de su progreso.
 */
export async function recorrerSiigo<T>(
  ruta: string,
  alLote: (lote: T[], info: { pagina: number; total: number }) => Promise<void>,
  opciones?: { porPagina?: number; maxPaginas?: number },
): Promise<{ paginas: number; registros: number }> {
  const porPagina = opciones?.porPagina ?? 100;
  let pagina = 1;
  let registros = 0;
  let total = 0;

  while (true) {
    const sep = ruta.includes("?") ? "&" : "?";
    const p = await leerSiigo<PaginaSiigo<T>>(`${ruta}${sep}page_size=${porPagina}&page=${pagina}`);
    total = p.pagination?.total_results ?? 0;
    const lote = p.results ?? [];
    if (!lote.length) break;

    await alLote(lote, { pagina, total });
    registros += lote.length;

    if (registros >= total) break;
    if (opciones?.maxPaginas && pagina >= opciones.maxPaginas) break;
    pagina++;
  }

  return { paginas: pagina, registros };
}

// ── La forma de un cliente en SIIGO ──
export interface ClienteSiigo {
  id: string;
  person_type?: "Company" | "Person";
  id_type?: { code?: string; name?: string };
  identification?: string;
  check_digit?: string;
  /** Empresa: ["RAZÓN SOCIAL"]. Persona: ["NOMBRES", "APELLIDOS"]. */
  name?: string[];
  active?: boolean;
  address?: {
    address?: string;
    city?: { city_name?: string; state_name?: string; country_name?: string };
  };
  phones?: { indicative?: string; number?: string; extension?: string }[];
  contacts?: { first_name?: string; last_name?: string; email?: string }[];
  metadata?: { created?: string; last_updated?: string };
}
