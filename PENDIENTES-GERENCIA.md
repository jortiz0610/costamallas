# Preguntas para gerencia

> Datos comerciales que el portal necesita y que **no se pueden deducir del
> sistema ni inventar**. Cada uno tiene puesto un valor de arranque razonable
> para que nada quede bloqueado, pero ese valor **no es la política de
> Costamallas** hasta que alguien lo confirme.
>
> Todo lo de aquí se cambia desde el portal en dos minutos. No hace falta
> tocar código ni pedir un desarrollo.
>
> Última revisión: 2026-08-05

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

## 2. Tope de descuento y anticipo mínimo

**Lo que está puesto:** descuento máximo **5 %** sin aprobación, anticipo mínimo
**50 %**. El 5 % viene de la instrucción original; el 50 % se eligió como valor
de arranque para fabricación a medida e instalación.

**Preguntas concretas:**

- ¿El tope del 5 % aplica igual a todos los productos, o hay líneas donde el
  margen da para más (o para menos)?
- ¿El anticipo del 50 % es para todo, o cambia entre material suelto y obra con
  instalación?
- ¿Quién puede autorizar pasarse? Hoy lo hace cualquier ADMIN o SUPERADMIN del
  portal.

**Dónde se carga:** Configuración → Reglas comerciales.

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

**Dónde se carga:** Configuración → Postventa.

---

## 6. Coordinador de proyectos

**Qué se necesita:** quién recibe el aviso cuando se cierra una venta con
instalación.

**Por qué:** hoy no hay nadie asignado. La obra se crea sola y queda la
notificación dentro del portal, pero no sale ningún correo a nadie.

**Dónde se carga:** Configuración → Instalación → Coordinador de proyectos.
Se puede elegir un usuario del portal (recomendado: si cambia de correo no hay
que actualizar nada) o escribir un correo suelto.

---

## 7. Lista de precios de instalación

**Qué se necesita:** el Excel de gerencia con los precios de mano de obra por
servicio y los recargos por ciudad.

**Por qué:** el catálogo de instalación está vacío. Mientras siga así, el asesor
tiene que escribir la instalación a mano en cada cotización o dejarla "a
convenir", y la mano de obra se pierde o se calcula de memoria.

**Dónde se carga:** Configuración → Instalación.

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

## Lo que está bloqueado esperando otra cosa (no es pregunta de gerencia)

| Qué | Qué falta |
|-----|-----------|
| WhatsApp / Nexus de punta a punta | Aprobación de Meta |
| Correo saliente (SMTP) | Cargar credenciales **desde el portal en producción** |
| Facturación electrónica DIAN | Elegir y contratar proveedor (Factus / Siigo / Alegra) |
| Marketplaces | Cuentas de vendedor |
| Plan de Vercel | Hoy es Hobby: prohíbe uso comercial y solo permite 2 crons diarios |
