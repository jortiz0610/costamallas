// ============================================================
// Qué correo sale cuando se cierra un trabajo.
//
// Depende de qué se cerró, y la diferencia importa:
//
//   VISITA      → al cliente le llega un aviso de que la visita terminó
//                 y de que pronto recibe la cotización. **Sin copia de
//                 nada**: lo que se midió es material de trabajo del
//                 asesor, no un documento del cliente. Mandarle las
//                 medidas antes que el precio invita a que las lleve a
//                 otro lado. Al ASESOR sí le llega el formato entero,
//                 que es lo que necesita para cotizar.
//
//   INSTALACION → al cliente le llega el ACTA DE ENTREGA firmada, que es
//                 su comprobante. Ese sí es suyo.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enviarCorreo } from "@/lib/correo";
import { envolverCorreo, PIE_EMAIL } from "@/lib/correo-layout";
import { getMarca } from "@/lib/marca";
import { urlPortal } from "@/lib/url-portal";
import { resumenParaCotizar } from "@/lib/visitas";

export interface ResultadoAviso {
  ok: boolean;
  /** true = no había a quién escribirle, y eso no es un fallo. */
  omitido?: boolean;
  motivo?: string;
  aCliente?: boolean;
  aAsesor?: boolean;
}

/**
 * @param urlBase Dominio del portal para el botón «Cotizar esta visita».
 *   Se pasa desde la ruta —que sí tiene la petición delante— porque es
 *   la única forma fiable de saber en qué dominio corre el portal
 *   (ver lib/url-portal.ts). Sin él se usa el de producción.
 */
export async function avisarCierreDeTrabajo(id: string, urlBase?: string): Promise<ResultadoAviso> {
  const t = await prisma.instalacion.findUnique({
    where: { id },
    select: {
      id: true, tipo: true, avisoCierreEn: true, esPrueba: true,
      medidas: true, condicionesSitio: true, recomendados: true,
      notas: true, actaObservaciones: true,
      firmaNombre: true, firmadoEn: true, fechaRealizada: true,
      direccion: true, ciudad: true,
      vendedorId: true,
      cliente: { select: { nombre: true, empresa: true, email: true } },
      pedido: {
        select: {
          numero: true, vendedorId: true,
          cliente: { select: { nombre: true, empresa: true, email: true } },
        },
      },
    },
  });

  if (!t) return { ok: false, motivo: "El trabajo no existe." };
  // Uno por trabajo, no uno por guardado. Sin este sello, volver a
  // firmar —o un reintento— le escribe al cliente dos veces.
  if (t.avisoCierreEn) return { ok: true, omitido: true, motivo: "Ya se había avisado." };

  const cli = t.cliente ?? t.pedido?.cliente ?? null;
  const marca = await getMarca();
  const nombre = cli?.empresa || cli?.nombre || "";
  const donde = [t.direccion, t.ciudad].filter(Boolean).join(", ");

  let aCliente = false;
  let aAsesor = false;

  // ── Al cliente ──
  if (cli?.email) {
    const esVisita = t.tipo === "VISITA";
    const cuerpo = esVisita
      ? [
          `${nombre ? `${nombre}, ` : ""}ya estuvimos en ${donde || "su sitio"} y tomamos las medidas.`,
          "En las próximas horas le llega la cotización con el detalle y el precio.",
          "Si mientras tanto le surge una duda, responda a este correo.",
        ].join("\n\n")
      : [
          `${nombre ? `${nombre}, ` : ""}terminamos la instalación${donde ? ` en ${donde}` : ""}.`,
          t.firmaNombre ? `Recibió y firmó: ${t.firmaNombre}.` : "",
          t.actaObservaciones ? `Observaciones: ${t.actaObservaciones}` : "",
          "Adjuntamos el acta de entrega firmada. Consérvela: es el respaldo de la garantía.",
        ].filter(Boolean).join("\n\n");

    const { html, texto } = envolverCorreo({
      titulo: esVisita ? "Ya hicimos la visita" : "Trabajo entregado",
      cuerpo,
      marca,
    });

    try {
      await enviarCorreo({
        para: cli.email,
        asunto: esVisita
          ? `Visita realizada — ${marca.companyName}`
          : `Acta de entrega${t.pedido?.numero ? ` — ${t.pedido.numero}` : ""}`,
        html, texto,
        responderA: PIE_EMAIL,
      });
      aCliente = true;
    } catch (e) {
      return { ok: false, motivo: (e as Error).message };
    }
  }

  // ── Al asesor, solo si fue una visita ──
  //
  // Es quien va a cotizar. Sin esto tendría que entrar a mirar si ya
  // fueron, y eso es como se quedan visitas hechas sin cotizar.
  const vendedorId = t.vendedorId ?? t.pedido?.vendedorId ?? null;
  if (t.tipo === "VISITA" && vendedorId) {
    const asesor = await prisma.usuario.findUnique({
      where: { id: vendedorId },
      select: { email: true, nombre: true },
    });

    if (asesor?.email) {
      // El mismo texto que ve en el panel del cotizador. Una sola
      // función lo arma (lib/visitas.ts): si mañana el formato lleva un
      // dato más, aparece en los dos sitios a la vez.
      const cuerpo = [
        `Ya se hizo la visita de ${nombre || "el cliente"}. Puedes cotizar.`,
        resumenParaCotizar(t),
      ].filter(Boolean).join("\n\n");

      const { html, texto } = envolverCorreo({
        titulo: "Visita lista para cotizar",
        cuerpo,
        marca,
        // El botón es el arreglo de verdad: abre el cotizador con el
        // cliente puesto, la dirección donde se midió y lo que
        // recomendó producción ya como líneas. Antes esto se copiaba
        // a mano desde este mismo correo, y ahí es donde se perdían
        // las medidas.
        boton: {
          texto: "Cotizar esta visita",
          url: `${(urlBase ?? urlPortal()).replace(/\/$/, "")}/crm/cotizaciones/nueva?visita=${t.id}`,
        },
        pieDelBoton: "Se abre el cotizador con el formato de la visita al lado.",
      });

      try {
        await enviarCorreo({
          para: asesor.email,
          asunto: `Visita hecha: ${nombre || "cliente"} — ya puedes cotizar`,
          html, texto,
        });
        aAsesor = true;
      } catch {
        // Que no le llegue al asesor no puede tumbar el aviso al cliente,
        // que ya salió. Queda sin sellar para reintentarlo.
      }
    }
  }

  if (!aCliente && !aAsesor) {
    return { ok: true, omitido: true, motivo: "Nadie tiene correo cargado." };
  }

  await prisma.instalacion.update({
    where: { id },
    data: { avisoCierreEn: new Date() },
  }).catch(() => {});

  return { ok: true, aCliente, aAsesor };
}
