// ============================================================
// AGENTE WEB — lo que el agente puede consultar y hacer.
//
// Son tres, y son pocas a propósito: cada herramienta de más es una
// forma de más de equivocarse delante de un cliente.
//
//   buscar_productos  — el catálogo REAL, con su precio real
//   escalar_a_asesor  — crea el aviso para que alguien conteste
//   dejar_contacto    — guarda el prospecto en el CRM
//
// Ninguna toca dinero, pedidos ni facturas. El agente informa y conecta;
// no decide nada por la empresa.
// ============================================================

import { prisma } from "@/lib/prisma";
import { formatCOP } from "@/lib/utils";

export const HERRAMIENTAS_AGENTE = [
  {
    name: "buscar_productos",
    description:
      "Busca en el catálogo publicado de Costamallas. Úsala SIEMPRE antes de hablar de un producto " +
      "o de un precio: es la única fuente de precios reales. Si no devuelve nada, dilo y ofrece un asesor; " +
      "no supongas que el producto existe.",
    input_schema: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description:
            "Lo que busca el cliente, con sus palabras: 'malla para gatos balcón', 'malla gallinero', " +
            "'cerramiento perimetral'. No uses SKU ni jerga interna.",
        },
      },
      required: ["consulta"],
      additionalProperties: false,
    },
  },
  {
    name: "escalar_a_asesor",
    description:
      "Marca la conversación para que un asesor la atienda y le avisa. Úsala en cuanto aparezca un reclamo, " +
      "una garantía, un pago, un pedido existente, una instalación, o cuando el cliente pida hablar con una " +
      "persona. Llamarla es lo que hace que le llegue a alguien: decir 'le paso con un asesor' sin llamarla " +
      "deja al cliente esperando.",
    input_schema: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          description: "Por qué hay que escalar, en una frase. Lo lee el asesor antes de contestar.",
        },
        resumen: {
          type: "string",
          description:
            "Qué necesita el cliente y qué se sabe ya (medidas, ciudad, producto). Sirve para que el asesor " +
            "no le vuelva a preguntar lo mismo.",
        },
      },
      required: ["motivo", "resumen"],
      additionalProperties: false,
    },
  },
  {
    name: "dejar_contacto",
    description:
      "Guarda los datos del cliente para que un asesor lo llame. Úsala cuando te dé nombre y teléfono o correo. " +
      "No pidas cédula ni datos bancarios.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Como se presentó." },
        telefono: { type: "string", description: "Celular. Opcional si dio correo." },
        email: { type: "string", description: "Correo. Opcional si dio celular." },
        ciudad: { type: "string", description: "Ciudad, si la mencionó." },
        interes: { type: "string", description: "Qué necesita, con medidas si las dio." },
      },
      required: ["nombre"],
      additionalProperties: false,
    },
  },
] as const;

export interface ContextoEjecucion {
  conversacionId: string;
  /** Se llena si el agente escala, para que quien llama lo sepa. */
  escalado: { motivo: string; resumen: string } | null;
  clienteId: string | null;
}

/** Palabras que no aportan nada a la búsqueda y sí ensucian los resultados. */
const VACIAS = new Set([
  "de", "la", "el", "los", "las", "para", "por", "con", "un", "una", "unos", "unas",
  "que", "en", "mi", "me", "se", "del", "al", "y", "o", "es", "son", "tengo", "quiero",
  "necesito", "busco", "cuanto", "cuánto", "vale", "precio", "cuesta", "malla", "mallas",
]);

/** Sin tildes y en minúsculas, para comparar como escribe la gente. */
const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function buscarProductos(consulta: string): Promise<string> {
  const palabras = normalizar(consulta)
    .split(/[^a-z0-9]+/)
    .filter(p => p.length > 2 && !VACIAS.has(p));

  if (!palabras.length) {
    return "Consulta demasiado vaga. Pregúntale al cliente para qué necesita la malla.";
  }

  // Solo lo PUBLICADO: si no está en la tienda, el cliente no lo puede
  // comprar y mencionárselo solo crea una expectativa que no se cumple.
  //
  // Se traen todos y se filtran aquí en vez de hacerlo en la consulta a
  // propósito. `contains` es subcadena, y con eso "nada" encontraba
  // "eslabo·nada·": un cliente preguntando cualquier cosa se llevaba una
  // lista de productos que no tienen que ver. Filtrando aquí se exige
  // palabra COMPLETA y además se puede ordenar por cuántos términos
  // encajan, que es lo que decide si la primera sugerencia sirve. Son
  // ~60 productos publicados: cabe de sobra en memoria.
  const todos = await prisma.producto.findMany({
    where: { publicado: true },
    select: {
      nombre: true, slug: true, descCorta: true, categorias: true,
      precioNormal: true, precioOferta: true, acfUnidadVenta: true,
      acfFabricacionMedida: true, acfInstalacion: true, acfColores: true,
      acfAplicaciones: true, largoCm: true, anchoCm: true, altoCm: true, enStock: true,
    },
  });

  const productos = todos
    .map(p => {
      // El nombre pesa más que la descripción: quien busca "gallinero"
      // quiere el producto que se llama así, no uno que lo menciona de
      // pasada en el texto de venta.
      const nombre = normalizar(p.nombre);
      const etiquetas = normalizar([...p.categorias, ...p.acfAplicaciones].join(" "));
      const texto = normalizar(p.descCorta ?? "");
      let punteo = 0;
      for (const w of palabras) {
        const limite = new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`);
        if (limite.test(nombre)) punteo += 3;
        else if (limite.test(etiquetas)) punteo += 2;
        else if (limite.test(texto)) punteo += 1;
      }
      return { p, punteo };
    })
    .filter(x => x.punteo > 0)
    .sort((a, b) => b.punteo - a.punteo)
    .slice(0, 6)
    .map(x => x.p);

  if (!productos.length) {
    return (
      "No hay productos publicados que coincidan. NO te inventes uno: dile al cliente que le confirmas " +
      "con un asesor qué opciones hay para su caso."
    );
  }

  const filas = productos.map(p => {
    const precio = p.precioOferta ?? p.precioNormal;
    const medidas = [p.largoCm && `largo ${p.largoCm} cm`, p.anchoCm && `ancho ${p.anchoCm} cm`, p.altoCm && `alto ${p.altoCm} cm`]
      .filter(Boolean).join(", ");
    return [
      `- ${p.nombre}`,
      `  precio: ${precio ? formatCOP(Number(precio)) : "no publicado — lo confirma un asesor"}` +
        (p.acfUnidadVenta ? ` por ${p.acfUnidadVenta}` : ""),
      p.descCorta ? `  qué es: ${p.descCorta.replace(/<[^>]+>/g, " ").slice(0, 180)}` : "",
      medidas ? `  medidas: ${medidas}` : "",
      p.acfColores?.length ? `  colores: ${p.acfColores.join(", ")}` : "",
      p.acfFabricacionMedida ? "  se fabrica a la medida (el precio final depende de las medidas)" : "",
      p.acfInstalacion ? "  se puede instalar" : "",
      p.enStock ? "" : "  OJO: sin existencias ahora mismo",
      `  enlace: https://costamallas.com/producto/${p.slug}`,
    ].filter(Boolean).join("\n");
  });

  return [
    `${productos.length} producto(s) del catálogo publicado:`,
    "",
    ...filas,
    "",
    "Menciona como mucho dos o tres, los que de verdad encajen. Los precios son los publicados: si el " +
    "producto se fabrica a la medida, aclara que el valor final depende de las medidas.",
  ].join("\n");
}

async function escalarAAsesor(
  ctx: ContextoEjecucion,
  motivo: string,
  resumen: string,
): Promise<string> {
  ctx.escalado = { motivo, resumen };

  await prisma.nexusConversacion.update({
    where: { id: ctx.conversacionId },
    data: {
      prioridad: "ALTA",
      etiquetas: { push: "escalada-por-agente" },
      // Se deja ABIERTA y SIN primera respuesta a propósito: así entra
      // en el informe de tiempos y en la alerta del compromiso de la
      // hora. Marcarla como respondida porque el bot contestó sería
      // justo la trampa que hace inútil el indicador.
    },
  }).catch(() => undefined);

  await prisma.nexusMensaje.create({
    data: {
      conversacionId: ctx.conversacionId,
      origen: "sistema",
      contenido: `⚠️ El agente escaló esta conversación.\nMotivo: ${motivo}\nResumen: ${resumen}`,
      tipo: "nota",
      estadoEnvio: "RECIBIDO",
    },
  }).catch(() => undefined);

  return (
    "Listo, la conversación quedó marcada para un asesor y ya le llegó el aviso. " +
    "Dile al cliente que en breve lo contactan, y si todavía no te ha dado nombre y número, pídeselos."
  );
}

async function dejarContacto(
  ctx: ContextoEjecucion,
  datos: { nombre: string; telefono?: string; email?: string; ciudad?: string; interes?: string },
): Promise<string> {
  const nombre = datos.nombre.trim();
  if (!nombre) return "Falta el nombre. Pídeselo antes de llamar esta herramienta.";
  if (!datos.telefono && !datos.email) {
    return "Falta el celular o el correo. Sin uno de los dos nadie puede devolverle la llamada: pídeselo.";
  }

  // Si ya existe por teléfono o correo no se duplica: un prospecto
  // repetido hace que dos asesores llamen a la misma persona.
  const existente = await prisma.cliente.findFirst({
    where: {
      OR: [
        datos.telefono ? { telefono: datos.telefono.trim() } : {},
        datos.email ? { email: datos.email.trim().toLowerCase() } : {},
      ].filter(o => Object.keys(o).length > 0),
    },
    select: { id: true, nombre: true },
  });

  const cliente = existente
    ? existente
    : await prisma.cliente.create({
        data: {
          nombre,
          telefono: datos.telefono?.trim() || null,
          email: datos.email?.trim().toLowerCase() || null,
          ciudad: datos.ciudad?.trim() || null,
          tipo: "persona",
          estado: "PROSPECTO",
          notas: `Llegó por el agente de la web.${datos.interes ? `\nInterés: ${datos.interes}` : ""}`,
        },
        select: { id: true, nombre: true },
      });

  ctx.clienteId = cliente.id;

  await prisma.nexusConversacion.update({
    where: { id: ctx.conversacionId },
    data: {
      clienteId: cliente.id,
      remitente: nombre,
      telRemit: datos.telefono?.trim() || null,
      emailRemit: datos.email?.trim().toLowerCase() || null,
      ...(datos.interes ? { asunto: datos.interes.slice(0, 120) } : {}),
    },
  }).catch(() => undefined);

  return existente
    ? "Ya estaba registrado en el sistema; la conversación quedó ligada a su ficha. Sigue atendiéndolo con normalidad."
    : "Contacto guardado. Agradécele y dile que un asesor lo contacta.";
}

/** Ejecuta la herramienta que pidió el modelo. Nunca lanza. */
export async function ejecutarHerramientaAgente(
  ctx: ContextoEjecucion,
  nombre: string,
  entrada: Record<string, unknown>,
): Promise<string> {
  try {
    switch (nombre) {
      case "buscar_productos":
        return await buscarProductos(String(entrada.consulta ?? ""));
      case "escalar_a_asesor":
        return await escalarAAsesor(ctx, String(entrada.motivo ?? ""), String(entrada.resumen ?? ""));
      case "dejar_contacto":
        return await dejarContacto(ctx, {
          nombre: String(entrada.nombre ?? ""),
          telefono: entrada.telefono ? String(entrada.telefono) : undefined,
          email: entrada.email ? String(entrada.email) : undefined,
          ciudad: entrada.ciudad ? String(entrada.ciudad) : undefined,
          interes: entrada.interes ? String(entrada.interes) : undefined,
        });
      default:
        return `No existe la herramienta ${nombre}.`;
    }
  } catch (e) {
    // Que falle una consulta no puede tumbar la conversación con un
    // cliente. Se le dice al modelo, que ya sabe qué hacer: ofrecer un
    // asesor en vez de inventarse la respuesta.
    console.error("[agente-web] herramienta", nombre, e);
    return "La consulta falló. No inventes la respuesta: dile al cliente que se lo confirma un asesor.";
  }
}
