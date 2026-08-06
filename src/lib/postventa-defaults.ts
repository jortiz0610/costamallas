// ============================================================
// Textos de las políticas públicas.
//
// ⚠️ NO son textos escritos aquí: están transcritos de los documentos
// oficiales de Costamallas, tal cual, sin "mejorarlos".
//
//   · Devoluciones y reembolsos → "Politicas devoluciones y reembolsos.docx"
//     (vigente desde el 12 de abril de 2025).
//   · Tratamiento de datos → "POLÍTICA DE TRATAMIENTO DE LA INFORMACIÓN.docx"
//     (vigente desde el 12 de abril de 2025).
//
// El documento de devoluciones y el de datos tienen HUECOS donde debería
// ir el contacto ("[correo electrónico]", "(57 5) xxxxxxx"). Esos huecos
// se reemplazan con los marcadores {{correo}}, {{telefono}} y {{horario}},
// que se llenan con lo que haya en Configuración → Empresa. No se
// inventaron datos para taparlos.
//
// ⚠️ NO EXISTE un documento de política de envíos. Lo que hay aquí está
// armado con las condiciones REALES de la cotización de SIIGO (sitio de
// entrega y tiempo de entrega, ver cotizacion-textos.ts). Está anotado en
// PENDIENTES-GERENCIA.md: hay que confirmarlo antes de darlo por bueno.
//
// Este archivo NO lo importa ningún componente de cliente: los defaults
// viajan por la API. Son varios miles de caracteres que no tienen por qué
// terminar en el navegador de nadie.
// ============================================================

export interface ConfigPostventa {
  /** URL a la que lleva el QR de la encuesta (la reseña de Google). */
  urlResena: string;
  encuestaTitulo: string;
  encuestaTexto: string;
  /** Horario de atención, para los huecos de las políticas. */
  horario: string;
  politicaEnvios: string;
  politicaDevoluciones: string;
  politicaDatos: string;
}

const ENVIOS = `Sitio de entrega

En instalaciones de Costamallas. En caso de envío a otras ciudades, el cliente asume el costo del envío del material; la mercancía viaja por cuenta y riesgo del comprador, reservándonos el derecho de propiedad hasta su cancelación.

Si se acuerda con transporte incluido, el material se envía sobre plataforma de camión y el descargue en obra es por parte del cliente: el destinatario debe garantizar el acceso fácil y seguro de los vehículos al sitio de entrega, de lo contrario asumirá los sobrecostos generados.

Tiempo de entrega

De 2 a 5 días hábiles a partir de aplicado el pago.

Productos fabricados a medida

Los productos cortados a medida o fabricados bajo pedido se producen después de recibido el anticipo, y su tiempo de entrega se confirma con el asesor en cada caso.

Recepción del pedido

Al recibir la mercancía, revísela antes de firmar. Si llega un producto incorrecto o con daños del transporte, debe notificarlo dentro de los 3 días hábiles siguientes, con evidencia fotográfica (ver la política de devoluciones).

Contacto

Correo electrónico: {{correo}}
Teléfono: {{telefono}}
Horario de atención: {{horario}}`;

const DEVOLUCIONES = `En Costamallas, nos comprometemos a brindar productos de alta calidad y un servicio al cliente excepcional. Entendemos que pueden surgir situaciones en las que necesite devolver un producto o solicitar un reembolso. A continuación, se detallan nuestras políticas de devoluciones y reembolsos para garantizar una experiencia clara y transparente.

1. Condiciones Generales

Plazo para devoluciones. Los productos pueden ser devueltos dentro de los 15 días hábiles posteriores a la recepción del pedido, siempre y cuando cumplan con las condiciones establecidas en esta política.

Estado del producto. Para que un producto sea elegible para devolución, debe estar en su estado original, sin uso, con todos sus componentes, etiquetas y embalaje intacto.

Productos personalizados o cortados a medida. Los productos fabricados bajo pedido, personalizados o cortados a medida (como mallas metálicas específicas o alambre de púas) no son elegibles para devolución, salvo que presenten defectos de fabricación.

Costos de envío. Los costos de envío asociados con la devolución correrán por cuenta del cliente, excepto en casos donde el producto entregado sea incorrecto o presente defectos atribuibles a Costamallas.

2. Proceso de Devolución

Solicitud de devolución. El cliente debe comunicarse con nuestro equipo de atención al cliente a través de {{correo}} o {{telefono}} para notificar su intención de devolver un producto. Proporcione el número de pedido, una descripción del motivo de la devolución y fotografías del producto (si aplica).

Aprobación de la devolución. Nuestro equipo evaluará la solicitud y, si cumple con las condiciones establecidas, se le proporcionará una autorización de devolución junto con instrucciones detalladas sobre cómo proceder.

Envío del producto. El cliente debe enviar el producto a la dirección proporcionada por Costamallas, asegurándose de incluir todos los accesorios, manuales y embalajes originales. Es responsabilidad del cliente asegurar el producto durante el transporte.

Inspección del producto. Una vez recibido, nuestro equipo inspeccionará el producto para verificar su estado. Si cumple con las condiciones de devolución, se procederá con el reembolso o cambio según corresponda.

3. Reembolsos

Método de reembolso. El reembolso se realizará utilizando el mismo método de pago utilizado en la compra original.

Tiempo de procesamiento. El tiempo estimado para procesar un reembolso es de 5 a 7 días hábiles después de recibir y aprobar el producto devuelto.

Exclusiones. Los costos de envío originales no son reembolsables, salvo en casos de errores atribuibles a Costamallas.

4. Cambios de Producto

Si desea cambiar un producto por otro de igual o mayor valor, siga el mismo proceso de devolución descrito anteriormente. En caso de que el nuevo producto tenga un costo superior, el cliente deberá pagar la diferencia antes de que se realice el envío.

5. Productos Defectuosos o Dañados

Si recibe un producto defectuoso o dañado durante el transporte, debe notificarlo dentro de los 3 días hábiles posteriores a la recepción del pedido. Proporcione evidencia fotográfica del daño o defecto para que podamos evaluar la situación. Una vez verificado, ofreceremos un reemplazo gratuito o un reembolso completo, incluyendo los costos de envío asociados.

6. Excepciones

Los siguientes productos no son elegibles para devolución o reembolso:

· Mallas metálicas cortadas a medida o personalizadas.
· Alambre de púas fabricado según especificaciones del cliente.
· Productos que hayan sido instalados o utilizados.

7. Contacto

Si tiene alguna pregunta o necesita asistencia con una devolución o reembolso, no dude en contactarnos:

Correo electrónico: {{correo}}
Teléfono: {{telefono}}
Horario de atención: {{horario}}

8. Cambios en las Políticas

Costamallas se reserva el derecho de modificar estas políticas en cualquier momento. Cualquier cambio será notificado en nuestro sitio web y entrará en vigor inmediatamente después de su publicación.

9. Vigencia

Esta Política ha sido aprobada por Costamallas, y entró en vigencia a partir del 12 de abril de 2025.`;

const DATOS = `Con el objetivo de dar cumplimiento a la legislación vigente en materia de protección de datos, en especial la Ley 1581 de 2012 (y demás normas que la modifiquen, adicionen, complementen o desarrollen) y al Decreto 1377 de 2013, a continuación lo ponemos al tanto de los aspectos relevantes en relación con la recolección, uso y transferencia de datos personales que COSTAMALLAS S.A.S realiza de sus datos personales, en virtud de la autorización otorgada por usted para adelantar dicho tratamiento, así como también el manejo.

En esta política de tratamiento de datos personales (la "Política") encontrará los lineamientos corporativos y de ley bajo los cuales la Compañía realiza el tratamiento de sus datos, la finalidad, sus derechos como titular, así como los procedimientos internos y externos para el ejercicio de tales derechos.

Conforme a lo previsto en el artículo 15 de la Constitución Política de Colombia y la legislación aplicable (Ley 1266 de 2008, Ley 1581 de 2012, Decreto 1377 de 2013 y todas aquellas normas que las reglamenten, adicionen, deroguen o modifiquen), tenemos una clara política de privacidad y protección de sus datos personales: no obtenemos información personal de terceros que tengan una relación comercial o jurídica con la Compañía, incluyéndolo a usted, a los Clientes, Empleados o Proveedores, a menos que estos la hayan suministrado voluntariamente mediante su consentimiento previo, expreso y calificado.

1. Definiciones

Para la interpretación de esta Política, le pedimos tener en cuenta las siguientes definiciones:

Dato personal: Cualquier información vinculada o que pueda asociarse a una o varias personas naturales determinadas o determinables.

Datos sensibles: Aquellos datos que afectan la intimidad del Titular o cuyo uso indebido puede generar su discriminación.

Encargado del Tratamiento: Persona natural o jurídica, pública o privada, que por sí misma o en asocio con otros, realice el Tratamiento de datos personales por cuenta de la Compañía como Responsable de los datos.

Política de Tratamiento: Se refiere al presente documento, como política de tratamiento de datos personales aplicada por la Compañía de conformidad con los lineamientos de la legislación vigente en la materia.

Proveedor: Toda persona natural o jurídica que preste algún servicio a la Compañía en virtud de una relación contractual/obligacional.

Responsable del Tratamiento: Persona natural o jurídica, pública o privada, que por sí misma o en asocio con otros, decida sobre la base de datos y/o el Tratamiento de los datos.

Titular: Persona natural cuyos datos personales sean objeto de Tratamiento, sea cliente, proveedor, empleado, o cualquier tercero que, en razón de una relación comercial o jurídica, suministre datos personales a la Compañía.

Trabajador: Toda persona natural que preste un servicio a la Compañía en virtud de un contrato laboral.

Transferencia: Se refiere al envío por parte de la Compañía como Responsable del Tratamiento o un Encargado de los datos, a un tercer agente o persona natural/jurídica (receptor), dentro o fuera del territorio nacional para el tratamiento efectivo de datos personales.

Transmisión: Se refiere a la comunicación de datos personales por parte del Responsable al Encargado, ubicado dentro o fuera del territorio nacional, para que el Encargado, por cuenta del Responsable, trate datos personales.

Tratamiento: Cualquier operación o conjunto de operaciones sobre datos personales, tales como la recolección, almacenamiento, uso, circulación o supresión.

Para el entendimiento de los términos que no se encuentran incluidos dentro del listado anterior, usted deberá remitirse a la legislación vigente, en especial a la Ley 1581 de 2012 y al Decreto 1377 de 2013.

2. Tipo de Información sujeta a Tratamiento

La Compañía reconoce que sus Empleados, Pensionados a cargo y accionistas tienen derecho a contar con una expectativa razonable de su privacidad, teniendo en cuenta sus responsabilidades, derechos y obligaciones con la Compañía.

En virtud de la relación que se establezca entre usted y la Compañía, ésta recolecta, almacena, usa y transfiere datos personales, a compañías localizadas dentro y fuera de Colombia. Dichos datos personales e información incluyen, entre otros:

De los Candidatos: nombre, identificación, dirección, teléfono, fecha de nacimiento, información de estudios, participación en actividades de recreación y deporte; hoja de vida, educación, experiencia, vínculos con entidades y con empresas.

De los Clientes: nombre del Cliente o razón social, número de identificación o NIT con dígito de verificación, lugar de domicilio, dirección, teléfonos, fax, correo electrónico; nombre del gerente general o representante legal y sus datos de contacto; nombre del asignado para el recaudo de cartera y su correo electrónico; información tributaria; información bancaria que incluye nombre del titular de la cuenta, número de la cuenta y nombre o código del banco.

De los Proveedores: nombre del Proveedor o razón social, número de identificación o NIT con dígito de verificación, lugar de domicilio, dirección, teléfonos, fax, correo electrónico; nombre del gerente general o representante legal y sus datos de contacto; nombre del gerente o coordinador de ventas; nombre del asignado para el recaudo de cartera; información tributaria; información bancaria.

De los Empleados: trabajador y grupo familiar (nombre, identificación, dirección, teléfono, nombre de cónyuge e hijos, edad, fecha de nacimiento, participación en actividades de recreación y deporte); hoja de vida, educación y experiencia; salario y otros pagos; saldo de deudas contraídas con COSTAMALLAS S.A.S o libranza; aportes pensionales; constitución y aportes a fondos de pensiones voluntarias y bonos de alimentos; procesos judiciales, embargos y deudas a favor de cooperativas; afiliaciones con descuento de nómina; autorizaciones de descuentos; información de afiliación a fondos de empleados y gremiales; prestaciones durante toda su vida laboral; contrato laboral; vinculación con empleadores anteriores; historia laboral; pago de auxilios y beneficios y sus beneficiarios; afiliación a EPS, fondo de pensiones, ARL y caja de compensación; capacitaciones recibidas; informe demográfico; incapacidades y accidentes laborales; horas extras; evaluación anual de competencia.

Si dentro de la información recolectada se encuentran datos sensibles, se le informará de la calidad de dichos datos y la finalidad del tratamiento, y sólo serán tratados con su consentimiento previo, expreso e informado. Por tratarse de datos sensibles, usted no está obligado a autorizar su tratamiento.

3. Uso y finalidad del Tratamiento

Los datos personales son utilizados para:

· Ejecución del contrato suscrito con la Compañía.
· Pago de obligaciones contractuales.
· Envío de información a entidades gubernamentales o judiciales por solicitud expresa de las mismas.
· Soporte en procesos de auditoría externa/interna.
· Envío y recepción de mensajes con fines comerciales, publicitarios y/o de atención al cliente.
· Registro de la información de candidatos, clientes, empleados y proveedores en la base de datos de la Compañía.
· Contacto con candidatos, clientes, empleados o proveedores para el envío de información relacionada con la relación contractual, comercial y obligacional.
· Recolección de datos para el cumplimiento de los deberes que como Responsable de la información le corresponden a la Compañía.
· Propósitos de seguridad o prevención de fraude.
· Proporcionarle un efectivo servicio al cliente.
· Cualquier otra finalidad que resulte en el desarrollo del contrato o la relación entre usted y la Compañía.

Si usted nos proporciona datos personales, esta información será utilizada sólo para los propósitos aquí señalados, y no procederemos a vender, licenciar, transmitir o divulgar la misma fuera de la Compañía salvo que (i) usted nos autorice expresamente a hacerlo, (ii) sea necesario para permitir a nuestros contratistas o agentes prestar los servicios que les hemos encomendado, (iii) sea con el fin de proporcionarle nuestros productos o servicios, (iv) sea divulgada a las entidades que prestan servicios de marketing en nuestro nombre o a otras entidades con las cuales tenemos acuerdos de mercadeo conjunto, (v) tenga relación con una fusión, consolidación, adquisición, desinversión u otro proceso de reestructuración, o (vi) según sea requerido o permitido por la ley.

La Compañía podrá subcontratar a terceros para el procesamiento de determinadas funciones o información. Cuando lo hace, advierte a dichos terceros sobre la necesidad de proteger la información personal con medidas de seguridad apropiadas, les prohíbe el uso de su información personal para fines propios y les impide divulgarla a otros.

De igual forma, la Compañía podrá transferir o transmitir (según corresponda) sus datos personales a otras compañías en el extranjero por razones de seguridad, eficiencia administrativa y mejor servicio, de conformidad con las autorizaciones de cada una de estas personas. En el caso de transmisión de datos personales, se suscribirá el contrato de transmisión a que haya lugar en los términos del Decreto 1377 de 2013.

Una vez cese la necesidad de tratamiento de sus datos, los mismos podrán ser eliminados de las bases de datos o archivados en términos seguros. Dichos datos no serán eliminados a pesar de la solicitud del titular cuando su conservación sea necesaria para el cumplimiento de una obligación o contrato.

4. Derechos del Titular

De conformidad con el artículo 8 de la Ley 1581 de 2012, los derechos que como titular le asisten en relación con sus datos personales son:

· Conocer, actualizar y rectificar sus datos personales frente a la empresa como Responsable del Tratamiento o Encargados del Tratamiento. Este derecho se podrá ejercer, entre otros, frente a datos parciales, inexactos, incompletos, fraccionados, que induzcan a error, o aquellos cuyo Tratamiento esté expresamente prohibido o no haya sido autorizado.
· Solicitar prueba de la autorización otorgada a la Compañía como Responsable del Tratamiento, salvo cuando expresamente se exceptúe como requisito para el Tratamiento.
· Ser informado por la Compañía, previa solicitud, respecto del uso que le ha dado a sus datos personales.
· Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a lo dispuesto en la ley y las demás normas que la modifiquen, adicionen o complementen.
· Revocar la autorización y/o solicitar la supresión del dato cuando en el Tratamiento no se respeten los principios, derechos y garantías constitucionales y legales.
· Acceder en forma gratuita a sus datos personales que hayan sido objeto de Tratamiento.

5. Procedimiento para el ejercicio de sus derechos como titular

Si tiene preguntas acerca de esta Política, o cualquier inquietud o reclamo, o en caso de ejercicio de queja, rectificación, actualización, consulta, o solicitud de acceso o de supresión de datos, o con respecto a la administración de la Política, comuníquese con nosotros a través de cualquiera de los siguientes medios:

Teléfono: {{telefono}}
Correo electrónico: {{correo}}

Una vez usted ponga el caso en conocimiento del área responsable al interior de la Compañía, se dará trámite a la consulta, solicitud o queja.

Podrá consultar a COSTAMALLAS S.A.S respecto de los datos personales que tenga almacenados en sus bases de datos, para lo cual será necesario que el solicitante o su representante legal acrediten previamente su identidad. Dicha consulta será atendida en un término máximo de diez (10) días hábiles contados a partir de la fecha de recibo de la misma. Este plazo podrá ser ampliado en una sola ocasión, en cuyo caso le serán informados los motivos de la demora y la fecha en que se atenderá su solicitud, la cual en ningún caso será superior a cinco (5) días hábiles siguientes al vencimiento del primer término.

Su solicitud o petición relacionada con reclamos, actualizaciones, correcciones o supresión de sus datos personales deberá ser atendida en un término máximo de quince (15) días hábiles desde el recibo de la solicitud. Para la correcta y completa consideración de su petición, le solicitamos allegar la identidad del solicitante, su número de identificación, la dirección de notificaciones/respuestas y los documentos que quiera hacer valer.

Si su solicitud no tiene los datos y hechos suficientes que permitan a COSTAMALLAS S.A.S atenderla de forma correcta y completa, se le requerirá dentro de los cinco (5) días siguientes a la recepción para que subsane sus fallas. Después de transcurridos dos (2) meses desde la fecha del requerimiento, si usted no ha subsanado según lo requerido, se entiende que ha desistido de su solicitud.

6. Modificación de esta política

Esta política puede ser modificada en cualquier momento, avisándole del cambio, y se pondrá a su disposición la última versión de esta Política o los mecanismos para obtener una copia de la misma.

Fecha de entrada en vigencia: 12 de abril de 2025.
Fecha de última modificación: 12 de abril de 2025.
Periodo de vigencia de las bases de datos: la vigencia de la base de datos será el tiempo razonable y necesario para cumplir con las finalidades del tratamiento de la información.`;

export const POSTVENTA_DEFAULTS: ConfigPostventa = {
  urlResena: "",
  encuestaTitulo: "¿Cómo nos fue?",
  encuestaTexto:
    "Su opinión nos sirve para mejorar y le sirve a quien está buscando lo mismo que usted buscaba. " +
    "Escanee el código y cuéntenos cómo le fue con nosotros.",
  horario: "",
  politicaEnvios: ENVIOS,
  politicaDevoluciones: DEVOLUCIONES,
  politicaDatos: DATOS,
};
