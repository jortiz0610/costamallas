// ============================================================
// Textos por defecto de la cotización, SIN dependencias de servidor.
//
// Vive aparte de `cotizacion-config.ts` a propósito: ese archivo importa
// Prisma, y estos valores los usan componentes de cliente (la muestra, la
// pantalla de la cotización). Si todo estuviera junto, el navegador
// terminaría arrastrando el cliente de base de datos.
//
// Están transcritos de la cotización real de Costamallas (la de SIIGO):
// son 12 años de letra chica y no conviene "mejorarlos" sin que gerencia
// lo revise.
// ============================================================

export interface ConfigCotizacion {
  /** Carta de presentación que abre la propuesta. */
  carta: string;
  /** Cuentas, llaves y a nombre de quién se paga. */
  infoPago: string;
  formaPago: string;
  tiempoEntrega: string;
  sitioEntrega: string;
  garantia: string;
  /** Qué cubre Costamallas cuando la oferta incluye instalación. */
  instalacionIncluye: string;
  /** Qué debe poner el cliente para que se pueda instalar. */
  instalacionRequiere: string;
  observaciones: string;
  politicas: string;
  vigencia: string;
  /** Días de validez por defecto de una cotización nueva. */
  validezDias: number;
  /** Imágenes del dossier (URL de la biblioteca de imágenes). */
  imgPortada: string;
  imgBanda: string;
  imgInstalacion: string;
  imgContraportada: string;
  /**
   * Dónde recorta cada imagen, en % vertical (0 = borde de arriba,
   * 100 = borde de abajo). Es el `object-position` del `object-cover`.
   *
   * Existe porque los huecos del documento son mucho más apaisados que
   * las fotos: la banda de la carta es una tira de 210×45 mm y la
   * cabecera de instalación de 210×66 mm sobre una hoja A4. Recortando
   * al centro, en una foto de cerramiento esa tira cae en el muro y el
   * suelo, y la malla —lo único que hay que enseñar ahí— queda fuera.
   *
   * Estos valores estuvieron QUEMADOS en `CotizacionDoc.tsx`, calibrados
   * a las fotos que había cargadas. Cambiar una foto desde Configuración
   * descuadraba el recorte y obligaba a tocar código, que es justo lo que
   * no puede pasar con algo que se edita desde el portal.
   */
  posPortada: number;
  posBanda: number;
  posInstalacion: number;
  posContraportada: number;
  /** QR de las llaves de pago. */
  qrPagos: { etiqueta: string; url: string }[];
}

export const DEFAULTS: ConfigCotizacion = {
  carta:
    "Somos una empresa consolidada en el sector, ofreciendo soluciones en todo tipo de mallas. " +
    "Fabricantes de mallas metálicas e importadores. Somos pioneros en mallas de protección para el hogar " +
    "y ofrecemos alternativas a nuestros clientes en diferentes industrias, en seguridad perimetral y disuasiva. " +
    "Contamos con más de 12 años en el mercado llevando nuestros productos a nivel nacional. " +
    "Lo invitamos a conocer nuestro sitio web www.costamallas.com y nuestras redes sociales @costamallas.",

  infoPago:
    "El pago debe realizarse a nombre de COSTAMALLAS S.A.S. — NIT 900.659.899-8\n" +
    "• Bancolombia · Cuenta de Ahorros No. 48700007629\n" +
    "• Davivienda · Cuenta Corriente No. 028669995012\n" +
    "• Bancoomeva · Cuenta Corriente No. 080600830106\n" +
    "Llaves: 0063294599 · @DAVICOSTAMALLAS · 3007599461",

  formaPago: "Contado anticipado en materiales.",

  tiempoEntrega: "De 2 a 5 días hábiles a partir de aplicado el pago.",

  sitioEntrega:
    "En instalaciones de Costamallas. En caso de envío a otras ciudades, el cliente asume el costo del envío " +
    "del material; la mercancía viaja por cuenta y riesgo del comprador, reservándonos el derecho de propiedad " +
    "hasta su cancelación. Si se acuerda con transporte incluido, el material se envía sobre plataforma de camión " +
    "y el descargue en obra es por parte del cliente: el destinatario debe garantizar el acceso fácil y seguro de " +
    "los vehículos al sitio de entrega, de lo contrario asumirá los sobrecostos generados.",

  garantia:
    "Un (1) año contra defectos de fábrica y durabilidad en condiciones normales de uso. Esta garantía no cubre " +
    "daños causados después de su instalación, tales como deterioro por salitre, cortes, quemaduras, productos " +
    "químicos o cualquier otro producto que altere la resistencia molecular de la red.",

  instalacionIncluye:
    "Materiales en descripción, instalación, transporte de materiales, personal y equipos. Personal calificado " +
    "con trabajo en alturas, carnetización e implementos de seguridad. Contamos con la implementación del Sistema " +
    "Integral SG-SST y Calidad ISO 9001.",

  instalacionRequiere:
    "Energía eléctrica de 110 a 220 voltios, lugar de almacenamiento de herramientas, materiales y equipos " +
    "mientras se llevan a cabo las instalaciones, y línea del cerramiento despejada.",

  observaciones:
    "Cotización sujeta a la información suministrada por el cliente, quien debe leer el detalle de lo cotizado en " +
    "esta oferta. En caso de variación en el metraje o de solicitudes diferentes, se cobrará adicional el valor que " +
    "corresponda por unidad y/o por metro, de acuerdo con el metraje final entregado.",

  politicas:
    "Costamallas S.A.S. no hace devoluciones de dinero una vez recibida la orden de compra o de servicio, o pactada " +
    "con el asesor de forma verbal y/o por chat la solicitud de productos sobre pedido, medidas específicas o mallas " +
    "cortadas a la medida. Política de devolución: no se hacen devoluciones de pedidos especiales; después de " +
    "realizado el anticipo no habrá devolución de dinero por costos adicionales. La excepción aplica únicamente " +
    "contra defecto de fabricación.",

  vigencia: "3 días hábiles. Sujeto a rotación de inventarios.",

  validezDias: 3,

  imgPortada: "",
  imgBanda: "",
  imgInstalacion: "",
  imgContraportada: "",

  // Los valores con los que venían quemadas las franjas: 40 % en la banda
  // y 55 % en la cabecera de instalación, calibrados a las fotos que hay
  // cargadas hoy. Las hojas completas (portada y contraportada) no
  // necesitaban corrección porque el hueco es casi tan alto como la foto.
  posPortada: 50,
  posBanda: 40,
  posInstalacion: 55,
  posContraportada: 50,

  qrPagos: [],
};
