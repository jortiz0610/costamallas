// ============================================================
// Traer los clientes de SIIGO al CRM.
//
// En SIIGO hay 4.284 clientes con cinco años y medio de historia; en el
// portal había 78. La diferencia no es un detalle: es que un asesor
// abría el CRM, buscaba a quien acababa de llamar, no lo encontraba, y
// lo creaba otra vez a mano.
//
// LA REGLA QUE MANDA SOBRE TODAS: no pisar lo que escribió una persona.
//
// Un cliente que ya está en el portal puede haber sido corregido a mano
// —un teléfono que en SIIGO está viejo, un correo que rebotaba—. Al
// reimportar solo se RELLENAN los campos vacíos; lo que ya tiene valor
// se respeta aunque SIIGO diga otra cosa. La contabilidad manda en la
// contabilidad; el CRM manda en los datos de contacto.
//
// CÓMO SE RECONOCE A QUIEN YA ESTÁ, en este orden:
//   1. Por `siigoId`. Es exacto y sobrevive a que le cambien el nombre.
//   2. Por documento (NIT o cédula, comparando solo los dígitos). Es lo
//      que engancha a los 9 clientes que ya estaban en el portal antes
//      de que existiera este código.
//
// Se puede correr las veces que haga falta: la segunda vez no crea nada.
// ============================================================

import { prisma } from "@/lib/prisma";
import { recorrerSiigo, type ClienteSiigo } from "./cliente-api";

export interface ResultadoImportacion {
  leidos: number;
  creados: number;
  actualizados: number;
  sinCambios: number;
  omitidos: { identificacion: string; motivo: string }[];
  errores: { identificacion: string; error: string }[];
  ensayo: boolean;
}

/** Solo los dígitos: "900.882.270-1" y "9008822701" son el mismo documento. */
const soloDigitos = (v: string | null | undefined) => String(v ?? "").replace(/[^0-9]/g, "");

/**
 * `/v1/customers` de SIIGO NO devuelve solo clientes: devuelve TERCEROS.
 *
 * De los 4.284 hay 4.045 marcados `Customer`, 89 `Supplier` y 150
 * `Other`. Los 239 que no son clientes entraron al CRM en la primera
 * importación y ahí se vio el problema: son proveedores y terceros
 * contables, tienen cero cotizaciones y cero facturas, y lo único que
 * hacen en una lista de clientes es estorbar cuando alguien busca.
 *
 * Ojo con el matiz: un proveedor PUEDE ser cliente a la vez —267 de los
 * 335 proveedores están marcados `Customer`— y esos sí entran. Lo que
 * se descarta es lo que SIIGO dice que no es cliente, no "todo el que
 * aparezca en una compra".
 */
const TIPOS_QUE_SON_CLIENTE = new Set(["Customer"]);

/** Los códigos de documento que SIIGO usa para EMPRESA. El resto es persona. */
const DOCS_EMPRESA = new Set(["31", "50"]);

interface Mapeado {
  siigoId: string;
  identificacion: string;
  nombre: string;
  empresa: string | null;
  tipo: "empresa" | "persona";
  nit: string | null;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  departamento: string | null;
  direccion: string | null;
}

/** Traduce un cliente de SIIGO a la forma del CRM. */
export function mapearCliente(c: ClienteSiigo): Mapeado | null {
  const identificacion = soloDigitos(c.identification);
  if (!identificacion) return null;

  const partes = (c.name ?? []).map(x => String(x ?? "").trim()).filter(Boolean);
  const nombreCompleto = partes.join(" ").trim();
  if (!nombreCompleto) return null;

  const codigoDoc = String(c.id_type?.code ?? "");
  // `person_type` es lo que dice SIIGO; el tipo de documento es la
  // comprobación de respaldo para los registros viejos que lo traen mal.
  const esEmpresa = c.person_type === "Company" || DOCS_EMPRESA.has(codigoDoc);

  const contacto = (c.contacts ?? [])[0];
  const email = contacto?.email?.trim() || null;

  const tel = (c.phones ?? []).find(p => p.number)?.number?.trim() || null;

  const ciudad = c.address?.city?.city_name?.trim() || null;
  const departamento = c.address?.city?.state_name?.trim() || null;
  const direccion = c.address?.address?.trim() || null;

  return {
    siigoId: c.id,
    identificacion,
    // En una empresa, el nombre del CRM es la razón social; el contacto
    // humano, si lo hay, no reemplaza al titular de la factura.
    nombre: nombreCompleto,
    empresa: esEmpresa ? nombreCompleto : null,
    tipo: esEmpresa ? "empresa" : "persona",
    nit: esEmpresa ? identificacion : null,
    cedula: esEmpresa ? null : identificacion,
    email,
    telefono: tel,
    ciudad,
    departamento,
    direccion,
  };
}

/** Rellena solo lo que está vacío. Devuelve {} si no hay nada que tocar. */
function soloLoVacio(
  existente: {
    empresa: string | null; email: string | null; telefono: string | null;
    ciudad: string | null; departamento: string | null; direccion: string | null;
    nit: string | null; cedula: string | null; siigoId: string | null;
  },
  nuevo: Mapeado,
): Record<string, string> {
  const cambios: Record<string, string> = {};
  const poner = (campo: keyof typeof existente, valor: string | null) => {
    if (!valor) return;
    const actual = existente[campo];
    if (actual === null || actual === undefined || String(actual).trim() === "") {
      cambios[campo] = valor;
    }
  };

  // El siigoId se pone siempre que falte: es el enganche, no un dato del
  // cliente, y sin él la próxima corrida volvería a buscar por documento.
  if (!existente.siigoId) cambios.siigoId = nuevo.siigoId;

  poner("empresa", nuevo.empresa);
  poner("email", nuevo.email);
  poner("telefono", nuevo.telefono);
  poner("ciudad", nuevo.ciudad);
  poner("departamento", nuevo.departamento);
  poner("direccion", nuevo.direccion);
  poner("nit", nuevo.nit);
  poner("cedula", nuevo.cedula);

  return cambios;
}

export async function importarClientesSiigo(
  opciones?: { ensayo?: boolean; maxPaginas?: number },
): Promise<ResultadoImportacion> {
  const ensayo = opciones?.ensayo ?? false;

  const r: ResultadoImportacion = {
    leidos: 0, creados: 0, actualizados: 0, sinCambios: 0,
    omitidos: [], errores: [], ensayo,
  };

  // El índice de lo que YA hay. Se carga una vez: preguntarle a la base
  // por cada uno de los 4.284 serían 4.284 consultas.
  const existentes = await prisma.cliente.findMany({
    select: {
      id: true, siigoId: true, nit: true, cedula: true, empresa: true,
      email: true, telefono: true, ciudad: true, departamento: true, direccion: true,
    },
  });
  const porSiigoId = new Map(existentes.filter(e => e.siigoId).map(e => [e.siigoId!, e]));
  const porDocumento = new Map<string, (typeof existentes)[number]>();
  for (const e of existentes) {
    for (const d of [soloDigitos(e.nit), soloDigitos(e.cedula)]) {
      if (d && !porDocumento.has(d)) porDocumento.set(d, e);
    }
  }

  // SIIGO tiene cinco documentos repetidos entre sus propios clientes.
  // Sin esto, el segundo intentaría crearse y chocaría contra el primero
  // que acabamos de insertar en esta misma corrida.
  const vistosEnEstaCorrida = new Set<string>();

  await recorrerSiigo<ClienteSiigo>(
    "/v1/customers",
    async lote => {
      for (const crudo of lote) {
        r.leidos++;
        // Los terceros que SIIGO no marca como cliente no entran al CRM.
        if (!TIPOS_QUE_SON_CLIENTE.has(String(crudo.type ?? "Customer"))) {
          r.omitidos.push({ identificacion: String(crudo.identification ?? "?"), motivo: `no es cliente en SIIGO (${crudo.type})` });
          continue;
        }

        const c = mapearCliente(crudo);
        if (!c) {
          r.omitidos.push({
            identificacion: String(crudo.identification ?? "?"),
            motivo: "sin identificación o sin nombre",
          });
          continue;
        }

        if (vistosEnEstaCorrida.has(c.identificacion)) {
          r.omitidos.push({
            identificacion: c.identificacion,
            motivo: "documento repetido dentro de SIIGO",
          });
          continue;
        }
        vistosEnEstaCorrida.add(c.identificacion);

        const yaEsta = porSiigoId.get(c.siigoId) ?? porDocumento.get(c.identificacion);

        try {
          if (yaEsta) {
            const cambios = soloLoVacio(yaEsta, c);
            if (Object.keys(cambios).length === 0) { r.sinCambios++; continue; }
            if (!ensayo) {
              await prisma.cliente.update({ where: { id: yaEsta.id }, data: cambios });
            }
            r.actualizados++;
          } else {
            if (!ensayo) {
              const creado = await prisma.cliente.create({
                data: {
                  siigoId: c.siigoId,
                  nombre: c.nombre,
                  empresa: c.empresa,
                  tipo: c.tipo,
                  nit: c.nit,
                  cedula: c.cedula,
                  email: c.email,
                  telefono: c.telefono,
                  ciudad: c.ciudad,
                  departamento: c.departamento,
                  direccion: c.direccion,
                  // Nace como PROSPECTO a propósito. El estado real lo
                  // calcula el portal a partir de cotizaciones y pedidos,
                  // y esos todavía no se han traído: marcarlos como
                  // clientes activos ahora sería inventarse el dato.
                  estado: "PROSPECTO",
                },
                select: { id: true, siigoId: true, nit: true, cedula: true, empresa: true, email: true, telefono: true, ciudad: true, departamento: true, direccion: true },
              });
              // Entra al índice: si SIIGO trae otra vez el mismo
              // documento más adelante, se reconoce en vez de duplicarse.
              porSiigoId.set(c.siigoId, creado);
              porDocumento.set(c.identificacion, creado);
            }
            r.creados++;
          }
        } catch (e) {
          r.errores.push({
            identificacion: c.identificacion,
            error: e instanceof Error ? e.message.slice(0, 160) : String(e),
          });
        }
      }
    },
    { maxPaginas: opciones?.maxPaginas },
  );

  return r;
}
