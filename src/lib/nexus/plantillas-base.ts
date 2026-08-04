// ============================================================
// Plantillas de arranque para las preguntas que llegan todos los días.
//
// Escritas para lo que de verdad pregunta un cliente de Costamallas:
// precio, medidas, si instalan, si envían a su ciudad, garantía.
// El asesor las inserta con un atajo y ajusta lo que haga falta.
//
// Los {campos} se reemplazan al usarlas. No se inventan datos que el
// sistema no tiene: donde va un precio o un plazo, queda el hueco para
// que el asesor lo llene, porque prometer mal es peor que preguntar.
// ============================================================

export interface PlantillaBase {
  nombre: string;
  categoria: string;
  atajo: string;
  contenido: string;
}

export const PLANTILLAS_BASE: PlantillaBase[] = [
  {
    nombre: "Saludo y primera pregunta",
    categoria: "SALUDO",
    atajo: "/hola",
    contenido:
      "¡Hola! Gracias por escribir a Costamallas 👋\n" +
      "Somos fabricantes de mallas con más de 12 años en el mercado.\n\n" +
      "Para ayudarte con lo justo, cuéntame:\n" +
      "• ¿Qué necesitas proteger o cerrar?\n" +
      "• ¿En qué ciudad estás?",
  },
  {
    nombre: "Piden precio (sin medidas)",
    categoria: "COTIZACION",
    atajo: "/precio",
    contenido:
      "Con gusto te paso el precio 🙂\n\n" +
      "El valor depende del metraje, así que necesito dos datos:\n" +
      "• Largo y alto aproximados del área\n" +
      "• Ciudad donde se instalaría o a donde enviamos\n\n" +
      "Con eso te armo la cotización formal hoy mismo.",
  },
  {
    nombre: "Cómo tomar las medidas",
    categoria: "COTIZACION",
    atajo: "/medidas",
    contenido:
      "Te explico cómo medir, es sencillo 📏\n\n" +
      "1. Mide el LARGO total del tramo que quieres cubrir, de punta a punta.\n" +
      "2. Mide la ALTURA que necesitas.\n" +
      "3. Si el terreno tiene esquinas o desniveles, cuéntame cuántas.\n\n" +
      "Con largo × alto sacamos los metros cuadrados. Si prefieres, mándame una foto del sitio y te oriento.",
  },
  {
    nombre: "Malla para balcones",
    categoria: "FAQ",
    atajo: "/balcones",
    contenido:
      "La malla de protección para balcones es transparente, casi no se ve desde adentro y no le quita luz ni vista 🏠\n\n" +
      "Sirve para proteger niños y mascotas, y se instala sin romper el piso ni la baranda.\n\n" +
      "Para cotizarte necesito el largo y el alto del balcón, y tu ciudad.",
  },
  {
    nombre: "Cerramiento perimetral",
    categoria: "FAQ",
    atajo: "/cerramiento",
    contenido:
      "Para cerramientos manejamos malla eslabonada (ciclón) con postes y, si lo necesitas, alambre de púa arriba 🔒\n\n" +
      "Nuestra oferta incluye materiales, transporte, instalación y personal certificado para trabajo en alturas.\n\n" +
      "Para pasarte el valor necesito los metros lineales del perímetro, la altura que quieres y la ciudad.",
  },
  {
    nombre: "Mallas deportivas",
    categoria: "FAQ",
    atajo: "/deportiva",
    contenido:
      "Manejamos malla de nylon para canchas: fútbol, tenis, pádel y golf ⚽\n\n" +
      "Se usa como cerramiento perimetral y para división de canchas.\n\n" +
      "Cuéntame el largo, la altura y la ciudad, y te armo la cotización.",
  },
  {
    nombre: "¿Instalan ustedes?",
    categoria: "FAQ",
    atajo: "/instalacion",
    contenido:
      "Sí, tenemos servicio de instalación con personal propio ✅\n\n" +
      "Incluye materiales, transporte, equipos y personal certificado en trabajo en alturas, con implementos de seguridad.\n\n" +
      "Del lado tuyo solo necesitamos energía de 110-220 V, un sitio para guardar herramienta mientras dura la obra y la línea despejada.\n\n" +
      "El valor de la instalación varía según el producto y la ciudad. Dime dónde es y te lo incluyo en la cotización.",
  },
  {
    nombre: "¿Envían a mi ciudad?",
    categoria: "FAQ",
    atajo: "/envio",
    contenido:
      "Sí, despachamos a todo el país 🚚\n\n" +
      "El material sale de nuestras instalaciones en Barranquilla. El costo del envío lo asume el cliente, salvo que acordemos transporte incluido.\n\n" +
      "Dime tu ciudad y te confirmo el valor del flete junto con la cotización.",
  },
  {
    nombre: "Garantía",
    categoria: "FAQ",
    atajo: "/garantia",
    contenido:
      "Todos nuestros productos tienen un (1) año de garantía contra defectos de fábrica y durabilidad en condiciones normales de uso 🛡️\n\n" +
      "No cubre daños posteriores a la instalación como cortes, quemaduras, químicos o deterioro por salitre.",
  },
  {
    nombre: "Formas de pago",
    categoria: "COTIZACION",
    atajo: "/pago",
    contenido:
      "Puedes pagar por transferencia o consignación a nombre de COSTAMALLAS S.A.S. — NIT 900.659.899-8:\n\n" +
      "• Bancolombia · Ahorros 48700007629\n" +
      "• Davivienda · Corriente 028669995012\n" +
      "• Bancoomeva · Corriente 080600830106\n\n" +
      "También por llave: 0063294599 · @DAVICOSTAMALLAS · 3007599461\n\n" +
      "Apenas nos confirmes el pago con el soporte, arrancamos.",
  },
  {
    nombre: "Envío de la cotización",
    categoria: "COTIZACION",
    atajo: "/cotiza",
    contenido:
      "Te acabo de enviar la cotización 📄\n\n" +
      "Ahí encuentras el detalle de lo cotizado, el tiempo de entrega y las condiciones.\n\n" +
      "Quedo atento a cualquier ajuste que necesites para avanzar en el proceso.",
  },
  {
    nombre: "Seguimiento a las 24 horas",
    categoria: "SEGUIMIENTO",
    atajo: "/seguimiento1",
    contenido:
      "¡Hola! Solo quería confirmar que te llegó bien la cotización 🙂\n\n" +
      "¿Tienes alguna duda o hay algo que quieras ajustar?",
  },
  {
    nombre: "Cierre — antes de que venza",
    categoria: "SEGUIMIENTO",
    atajo: "/cierre",
    contenido:
      "La cotización vence pronto y los precios están sujetos a rotación de inventario ⏳\n\n" +
      "Si quieres, apartamos el material hoy con un anticipo y coordinamos la fecha que mejor te sirva.\n\n" +
      "¿Te lo dejo separado?",
  },
  {
    nombre: "Fuera de horario",
    categoria: "GENERAL",
    atajo: "/horario",
    contenido:
      "¡Hola! Gracias por escribirnos 🌙\n\n" +
      "En este momento estamos fuera de horario de atención. Un asesor te responde apenas iniciemos la jornada.\n\n" +
      "Si nos dejas qué necesitas y tu ciudad, adelantamos y te contestamos con la información lista.",
  },
  {
    nombre: "Despedida",
    categoria: "DESPEDIDA",
    atajo: "/gracias",
    contenido:
      "¡Gracias a ti! 🙌\n\n" +
      "Cualquier cosa que necesites, aquí estamos. Que tengas un excelente día.",
  },
];
