# Preguntas para gerencia

> Datos comerciales que el portal necesita y que **no se pueden deducir del
> sistema ni inventar**. Cada uno tiene puesto un valor de arranque razonable
> para que nada quede bloqueado, pero ese valor **no es la política de
> Costamallas** hasta que alguien lo confirme.
>
> Todo lo de aquí se cambia desde el portal en dos minutos. No hace falta
> tocar código ni pedir un desarrollo.
>
> Última revisión: **2026-08-29**

---

## 1. Formas de pago y sus plazos ⚠️ el más urgente

**Qué se necesita:** la lista real de formas de pago que usa Costamallas y a
cuántos días vence cada una.

**Por qué importa:** de ahí sale sola la fecha de vencimiento de cada factura.
Sin ese dato, la factura nace sin fecha, la cartera tiene que estimarle la
antigüedad con la fecha de emisión y no hay contra qué decir que está vencida.

**Lo que está puesto mientras tanto:**

| Código | Nombre | Días |
|--------|--------|------|
| `CONTADO` | Contado | 0 |
| `CREDITO_30` | Crédito 30 días | 30 |

**Preguntas concretas:**

- ¿Se maneja crédito? ¿A cuántos días — 15, 30, 45, 60?
- ¿El plazo cuenta desde la emisión de la factura o desde la entrega?
- ¿Hay clientes con plazo propio, distinto del general?

**Dónde se carga:** Configuración → Reglas comerciales → Formas de pago y plazos.

---

## 2. Anticipo mínimo

**El descuento ya se decidió** (29-ago): el vendedor tiene un tope **libre del
10 %** — puede poner 3, 6,5 u 8; lo que no puede es pasarse de 10. Por encima,
la oferta queda esperando visto bueno de un administrador y no se puede enviar.
Ya está cargado en el portal.

**Lo que sigue pendiente:** el anticipo mínimo. Está puesto en **50 %** como
valor de arranque para fabricación a medida e instalación.

**Preguntas concretas:**

- ¿El anticipo del 50 % es para todo, o cambia entre material suelto y obra con
  instalación?
- ¿El tope del 10 % aplica igual a todos los productos? Hay una casilla nueva
  por producto —**«no admite descuento»**— para las líneas de margen mínimo:
  esas no se pueden rebajar línea por línea, pero sí entran en el descuento
  global de la oferta. Falta decir cuáles son.
- ¿Quién puede autorizar pasarse? Hoy lo hace cualquier ADMIN o SUPERADMIN.

**Dónde se carga:** Configuración → Lo comercial → Reglas comerciales.

---
## 3. Política de envíos ⚠️ no existe el documento

**Qué se necesita:** confirmar el texto de la política de envíos que se publica
en `/politicas` y que ve el cliente desde su cotización.

**Por qué:** en `Archivos base de empresa/` hay .docx de **devoluciones** y de
**tratamiento de datos**, pero **no de envíos**. El texto que está publicado se
armó con las condiciones reales de la cotización de SIIGO (sitio de entrega y
tiempo de entrega), sin agregar nada. No es un documento aprobado.

**Preguntas concretas:**

- ¿Ese texto refleja lo que se cumple hoy?
- ¿Hay costos de envío por ciudad o por peso que deberían salir escritos?
- ¿Existe un documento oficial de envíos que no esté en la carpeta?

**Dónde se carga:** Configuración → Postventa → Política de envíos y entrega.

---

## 4. Datos de contacto para las políticas

**Qué se necesita:** correo, teléfono y horario de atención de la empresa.

**Por qué:** los dos .docx oficiales traen los huecos **sin llenar**
(`[correo electrónico]`, `(57 5) xxxxxxx`, `[horario]`). El portal los reemplaza
con lo que haya en Configuración → Empresa; lo que falte sale como "—" en la
política publicada. No se inventó ningún dato para taparlos.

**Dónde se carga:** Configuración → Empresa (correo y teléfono) ·
Configuración → Postventa (horario).

---

## 5. Enlace de reseñas de Google

**Qué se necesita:** el enlace corto de reseñas del perfil de negocio de Google.

**Por qué:** es a donde lleva el QR de la encuesta de satisfacción, el que va
impreso en la entrega y en el acta de instalación. Mientras no esté, el portal
**no genera ningún QR** — un código impreso en cientos de papeles que no lleva a
ninguna parte ya no se puede corregir.

**Cómo se saca:** buscar la empresa en Google → perfil de negocio →
**Pedir reseñas** → copiar el enlace corto.

**Comprobado el 26-ago:** el acta de entrega se probó de punta a punta y, sin el
enlace, **no pinta el QR** — no deja un recuadro vacío ni un código que no lleva a
ninguna parte. Todo lo demás del acta ya sale bien.

**Dónde se carga:** Configuración → Postventa.

---

## 6. Coordinador de proyectos

**Qué se necesita:** quién recibe el aviso cuando se cierra una venta con
instalación.

**Por qué:** hoy no hay nadie asignado. La obra se crea sola y queda la
notificación dentro del portal, pero no sale ningún correo a nadie.

**Comprobado el 26-ago:** el aviso se probó por primera vez, fabricando una venta
con instalación contra la base real. Funciona: la obra se crea sola en PENDIENTE
con la dirección y la ciudad, y queda la notificación en el portal. Con un
coordinador elegido, la notificación va **dirigida a él** con copia a los
administradores, en vez de verla los siete usuarios. El correo sigue sin salir
porque falta el SMTP, y eso el portal lo dice en vez de callarlo.

La prueba destapó un fallo que nunca se había visto porque el módulo nunca se
había usado: mientras no haya SMTP, cada vez que se reaprobaba la cotización se
creaba otra notificación igual. Corregido.

**Dónde se carga:** Configuración → Instalación → Coordinador de proyectos.
Se puede elegir un usuario del portal (recomendado: si cambia de correo no hay
que actualizar nada) o escribir un correo suelto.

---

## 7. Recargos de instalación por ciudad

**Resuelto a medias.** Los **17 servicios de instalación** ya están cargados,
desde la hoja SERVICIOS de la lista de precios de agosto (26 de agosto de 2026).

⚠️ Esa hoja tenía la columna encabezada como **«precio de COSTO»** aunque el
título decía «al público». Se cargaron como precio de venta porque así se
confirmó, pero conviene que alguien los revise una vez en
Configuración → Instalación.

**Lo que falta: los recargos por ciudad.** Hay **cero** cargados (medido contra la
base el 26-ago: 17 servicios activos, 0 recargos). Sin ellos, la
instalación cuesta lo mismo en Barranquilla que mandando la cuadrilla a Santa
Marta, Cartagena o Montería: los viáticos se los come la empresa.

Se necesita, por cada ciudad donde se instala: un porcentaje sobre el valor de
la instalación, un monto fijo, o los dos.

**Dónde se carga:** Configuración → Instalación → Recargo por ciudad.

---

## 8. Textos de los correos de seguimiento

**Qué se necesita:** que alguien de gerencia lea los tres correos que el sistema
le va a mandar solo a los clientes.

**Por qué:** salen a nombre de Costamallas sin que nadie los revise antes de
cada envío. Los que están escritos **no prometen nada que el sistema no sepa**:
no hay plazos de entrega, precios ni garantías en ellos; solo el número de la
oferta, su total, cuándo vence y el enlace. Aun así conviene leerlos una vez.

**Dónde se leen y se editan:** Configuración → Seguimiento.

---

## 9. Lanzar el SEO del catálogo ⚠️ decisión de plata, pequeña

**Qué se necesita:** que alguien entre a **Productos → SEO con IA**, lance el
lote y apruebe las propuestas.

**Por qué:** de 172 productos activos, **171 no tienen SEO**. Uno solo lo tiene.
Sin meta título ni meta descripción, Google se inventa lo que muestra en el
resultado de búsqueda, y lo que se inventa casi nunca vende.

**Cuánto cuesta:** **US$ 2,05** el catálogo entero (unos 8.000 pesos), o
US$ 0,012 por producto. La pantalla lo dice antes de lanzar y va sumando el gasto
real mientras corre. Se puede empezar solo por los 60 publicados, que son los que
están en Google hoy.

**Por qué hay que aprobar uno por uno y no hay un botón de "aplicar todo":**
guardar el SEO de un producto publicado lo sincroniza con costamallas.com. O sea,
aprobar **publica**. Texto escrito por una IA saliendo a la tienda a nombre de
Costamallas sin que nadie lo haya leído es exactamente lo que no queremos. Las
propuestas se pueden corregir antes de aprobar, y las de los 113 productos que
todavía no están publicados no salen a ninguna parte.

**Dónde:** Productos → SEO con IA.

---

## 10. Fotos y fichas técnicas de los 113 productos nuevos

**Qué se necesita:** las fotos de los productos que llegaron con la lista de
precios de agosto.

**Por qué:** **113 de los 172 productos activos no tienen ni una imagen**, y por
eso no se pueden publicar: un producto sin foto en la tienda no se vende. Además
**ninguno de los 172 tiene ficha técnica en PDF**.

No es un desarrollo pendiente: el módulo de imágenes funciona y desde que
WordPress está conectado lo que se sube queda servido de verdad. Faltan los
archivos.

**Dónde se cargan:** Productos → la ficha de cada uno, o el módulo de Imágenes.

---

## 11. Encender el agente de la página web ⚠️ nuevo

**Qué se necesita:** leer cómo responde, cargarle un WhatsApp, encenderlo, y pegar
una línea en WordPress.

El agente ya está construido y **probado contra producción con preguntas reales**.
Nace **apagado** a propósito: encenderlo pone a un modelo a hablarle a clientes a
nombre de Costamallas, y eso lo decide una persona.

**Lo que hace:** responde dudas de la web (qué malla sirve para qué, medidas,
precios del catálogo), pasa a un asesor en cuanto aparece un reclamo, un pago, un
pedido o una garantía, y guarda el prospecto en el CRM. Cada conversación entra a
Nexus, así que el asesor la ve y queda medida por el compromiso de la hora.

**Lo que NO hace, a propósito:** no promete fechas, no da descuentos, no inventa
precios de lo cortado a la medida, y no toca pagos ni pedidos.

**Cuánto cuesta:** unos **US$ 0,03 por conversación** de 4 preguntas (medido). Trae
tope diario, tope por conversación y máximo de mensajes, configurables.

**Pasos:**
1. Configuración → Agente web. Lea el saludo.
2. Cargue el **WhatsApp** al que quiere que escale (sin él no sale el botón).
3. Enciéndalo.
4. Copie el `<script>` que sale ahí y péguelo en WordPress antes de `</body>`.
   **Quite antes el chat viejo** (el del 304-310-9168) o van a salir dos burbujas.

---

## 12. El PDF del catálogo, para el banner de los correos ⚠️ nuevo

**Qué se necesita:** subir `Catalogo PRO CM 2026.pdf` a algún sitio público —la
biblioteca de WordPress sirve— y pegar su dirección en el portal.

**Por qué importa:** todos los correos que salen del portal llevan ahora un
banner con dos botones: la tienda y el catálogo. La tienda ya funciona. El del
catálogo **no sale** mientras no haya PDF, a propósito: un enlace roto en un
correo a un cliente es peor que un botón que falta.

**Dónde se carga:** Configuración → Comunicación → Plantillas de correo, en el
recuadro de arriba.

---

## 13. Un secreto en GitHub, para que la automatización corra ⚠️ nuevo

**Qué se necesita:** crear el secreto `CRON_SECRET` en el repositorio de GitHub
(Settings → Secrets and variables → Actions → New repository secret), con el
**mismo valor** que la variable `CRON_SECRET` que ya está en Vercel.

**Por qué importa:** Vercel en plan Hobby solo permite crons **diarios**. El
toque de las 24 h del seguimiento salía con hasta 23 horas de retraso, y el
aviso por incumplir el compromiso de responder en una hora llegaba al día
siguiente. Ahora hay un disparador en GitHub Actions que llama la misma ruta
**cada 15 minutos**. Sin el secreto, ese trabajo falla en rojo y la
automatización se queda como estaba.

Es un paso de dos minutos y no cuesta nada. Cuando migremos al VPS de
Hostinger habrá cron de verdad y esto se borra.

---

## 14. El cupo diario de la IA en el chat ⚠️ nuevo, cuando se programe la Fase 7

**Qué se necesita:** cuánto puede gastar el equipo al día en `@mallita` —la
ayuda de IA dentro del inbox— y quién puede subir ese tope.

**Referencia:** el agente de la web tiene US$ 3 al día y hasta ahora no se ha
acercado. `@mallita` la usarían los vendedores, así que el consumo sería otro.

---

## 15. Almacenamiento privado para los documentos de SG-SST ⚠️ nuevo

**Qué pasa hoy:** el módulo de trabajos ya registra qué documento entregó cada
trabajador y cuándo —que es lo que hace falta para saber si puede entrar a la
obra—, **pero el archivo no se guarda**. La pantalla lo dice con todas las
letras.

**Por qué:** son datos personales de terceros (cédulas, planillas de seguridad
social, exámenes médicos) y los dos sitios donde el portal sabe subir archivos
no sirven: el FTP está roto, y la biblioteca de WordPress es **pública** con
direcciones adivinables. Subir ahí la cédula de un trabajador sería una fuga de
datos, no un atajo.

**Qué se decidió (29-ago):** esperar a la migración al VPS de Hostinger, que
tendrá disco privado. El código ya está preparado: hay que escribir un
conector y cambiar una línea.

---
## Lo que está bloqueado esperando otra cosa (no es pregunta de gerencia)

| Qué | Qué falta |
|-----|-----------|
| WhatsApp / Nexus de punta a punta | Aprobación de Meta. Hoy hay **0 conexiones** configuradas |
| Correo saliente (SMTP) | Cargar credenciales **desde el portal en producción**. Sigue vacío |
| Facturación electrónica DIAN | Elegir y contratar proveedor (Factus / Siigo / Alegra) |
| Marketplaces | Cuentas de vendedor **y** construir la integración: hoy no existe backend |
| Plan de Vercel | Hoy es Hobby: **prohíbe el uso comercial**. Lo de los crons ya se resolvió por fuera (ver punto 13), pero el uso comercial sigue siendo un riesgo real |
| Guardar los documentos de SG-SST | Almacenamiento privado. Ver punto 15 |

---

## Ya resuelto (para que no se vuelva a pedir)

### 29 de agosto

- **Tope de descuento al 10 %**, libre hasta ahí. Cargado.
- **Los nueve COT-00001…09 se borraron**, con respaldo previo en
  `docs/respaldo-cotizaciones-00001-00009.json`. Los 3 pedidos que habían
  nacido de ellas **no se borraron** —un pedido entregado es una venta real— y
  quedaron anotados con su oferta de origen.
- **El estado del cliente ya no se escribe a mano**: se calcula. 12 de 31
  fichas estaban desfasadas y se corrigieron.
- **Las miniaturas de la cotización**: arregladas por los dos lados. De 19
  ítems sin foto, 13 son productos que de verdad **no tienen ninguna foto** en
  el catálogo — eso no lo arregla el código (ver punto 10).
- **Los correos ya se pueden editar desde el portal**, con vista previa.
- **El icono del chat de la web** dejó de ser el emoji que en Windows parecía
  una nube.

### 26 de agosto y antes

- **WordPress conectado** (26-ago). Las imágenes, fichas técnicas y fotos de obra
  que se suban desde el portal ya quedan en la biblioteca del sitio y se ven.
- **Logo cargado** y saliendo en la portada de la propuesta.
- **Lista de precios de agosto cargada**: 176 productos (113 nuevos sin publicar)
  y 17 servicios de instalación.
- **Consecutivo de cotizaciones** continuando desde la numeración de SIIGO.
- **Cédula** en la ficha del cliente persona natural.
- **Cuatro fotos** en la cotización (portada, franja, instalación, contraportada),
  y desde el 26-ago **el recorte de cada una se ajusta desde el portal**: si se
  cambia una foto y la malla queda a otra altura, se mueve un deslizador en
  Configuración → Cotización con vista previa. Antes había que tocar código.
- **Las últimas 2 imágenes rotas, rescatadas** (26-ago). Eran las del "Kit Malla
  para Gatos", que estaba publicado en la tienda con la foto principal caída. Los
  archivos no se habían perdido: estaban en el disco del FTP, en una carpeta que
  ese subdominio no sirve. Se bajaron, se subieron a la biblioteca de WordPress y
  el producto volvió a sincronizar. **Hoy el catálogo tiene 0 imágenes rotas.**
- **El compromiso de responder en una hora ya avisa** (26-ago). Cuando una
  conversación se pasa del plazo sin primera respuesta, le llega aviso al asesor
  asignado y a los administradores. Ojo: sale en la corrida diaria, no al minuto
  61 — para eso hace falta el plan Pro de Vercel.
