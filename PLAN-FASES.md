# Plan de fases — Costamallas ERP

> **Por qué existe este archivo:** el plan de 5 fases se venía usando en cada
> sesión, pero no estaba escrito en ninguna parte. Vivía en los mensajes de
> commit y en la cabeza de quien lo pidió. Reconstruirlo cuesta una hora larga
> de leer historial, y si entra alguien nuevo (o una sesión nueva de IA) empieza
> a ciegas.
>
> **Reconstruido el 2026-08-05** a partir del historial de git y de los prompts
> de las sesiones anteriores. Las fases 1 y 2 son las que menos rastro dejaron,
> así que su detalle es el menos fiable: está marcado.
>
> Última revisión: 2026-08-05 · commit `2fbf326`

---

## Estado de un vistazo

| Fase | Qué es | Estado |
|------|--------|--------|
| 1 | Base del portal y PIM | ✅ Cerrada |
| 2 | IA de producto y sincronización con la tienda | ✅ Cerrada |
| 3 | CRM comercial | ✅ Cerrada (5-ago) |
| 4 | Nexus omnicanal | ✅ Cerrada, salvo la aprobación de Meta |
| 5 | Growth y marketplaces | ⬜ **No empezada** |
| — | Operación diaria (fuera del plan original) | ✅ Cerrada (5-ago) |

---

## Fase 1 · Base del portal y PIM ✅

*(Detalle reconstruido; es la fase con menos rastro documental.)*

Portal interno con autenticación propia (JWT en cookies httpOnly, 2FA opcional
con dispositivos de confianza), roles, auditoría y catálogo de productos con
campos técnicos ACF por categoría. Importación desde WooCommerce, biblioteca de
imágenes por FTP, formularios ACF dinámicos y navegación móvil tipo app.

---

## Fase 2 · IA de producto y tienda ✅

Generación de SEO y de fichas técnicas con IA, exportación y sincronización con
WooCommerce, control de stock y alertas.

Más adelante se rehízo el motor de IA como el agente **Sembli**
(`src/lib/sembli/`): herramientas con nivel mínimo por rol, jerarquía
`CLIENTE < VENDEDOR < ADMIN < SUPERADMIN` revalidada en el servidor, y estrategia
híbrida de modelos (Haiku para volumen, Sonnet para calidad puntual).

> ⚠️ **Deuda de esta fase:** el generador de SEO existe y no se ha usado nunca.
> Hay ~63 productos sin SEO y ~63 sin ficha técnica, sobre unos 60 y pico en
> total. Desde el 2-ago el SEO además sí viaja a Yoast, así que es apretar un
> botón y ganar posicionamiento.

---

## Fase 3 · CRM comercial ✅

Los puntos 2, 5 y 6 quedaron pendientes de sesiones anteriores y se cerraron
entre el 1 y el 5 de agosto.

- **Cotización 2.0** — un solo cotizador (cada línea decide si va por cantidad o
  por medidas), dos plantillas (EXPRESS y PROPUESTA), instalación con precio y
  recargo por ciudad, contenido parametrizable, enlace público con registro de
  aperturas y envío por correo.
- **Pipeline** — valor y número de pedidos por etapa, días sin moverse con
  límite distinto por etapa, filtros y ficha lateral.
- **Instalaciones** — calendario semanal, fotos de antes y después, checklist de
  cierre que el servidor hace cumplir, aviso al coordinador y acta de entrega
  firmable.
- **Embudo** — la tasa de cierre contra la meta del 28 %, tiempos entre creación,
  envío, apertura y aprobación, y desglose por asesor.
- **Seguimiento post-cotización** — los tres toques (§ ver `CONTEXTO-IA.md` 3.7).
- **Política comercial** — tope de descuento y anticipo mínimo con aprobación de
  administrador y registro de quién autorizó qué.

---

## Fase 4 · Nexus omnicanal ✅

- Entrada por webhook por canal y **salida real** por WhatsApp Cloud API.
- Reparto por turno entre asesores, respetando al asesor que ya atiende al
  cliente.
- Bot que califica el primer mensaje (producto, ciudad, urgencia) con las
  categorías reales del catálogo.
- Plantillas de arranque, flujos editables y una pantalla de estado que dice,
  canal por canal, si "recibe y responde" o "solo recibe" y por qué.
- **Tiempo de respuesta** — el compromiso de la hora, medido en horario hábil.
- **El chat de la página, de ida y de vuelta** (1-sep). El visitante escribe
  desde costamallas.com, el asesor le responde desde Nexus y la respuesta le
  aparece en su propia ventana, con el nombre de quien contesta. Al cerrar la
  conversación le llega la charla completa por correo.
- **Chat interno del equipo** y bandeja con tres columnas en escritorio;
  tablero de módulos en el teléfono.

**Lo que falta y no depende del código:** la aprobación de Meta. Hasta entonces
el envío por WhatsApp se registra como fallido con el motivo real; no se simula.

**Lo que se decidió NO hacer:** respuesta automática al cliente sin que la
apruebe una persona. Hoy el flujo prepara la respuesta y un asesor la aprueba, y
la pantalla lo dice explícitamente.

---

## Fase 5 · Growth y marketplaces ⬜ no empezada

Lo único que existe hoy es la parte de marketing: conexiones OAuth con Google,
Meta y TikTok Ads, campañas, atribución por UTM y captura de leads.

**Pendiente:**
- Marketplaces (Falabella, MercadoLibre): hoy son pestañas de configuración
  vacías. **Bloqueado**: faltan las cuentas de vendedor.
- Explotar de verdad la atribución: hoy se capturan los leads pero nadie mira el
  ROAS por campaña contra las ventas cerradas del CRM.

---

## Fuera del plan original · Operación diaria ✅

Cosas que no estaban en las 5 fases y salieron de la operación:

- **Correo saliente (SMTP)** configurable desde el portal.
- **Compras**: proveedores con sus productos, órdenes de compra con envío por
  correo, recepción de mercancía que suma stock y cancelación que no borra.
- **Facturación**: cartera por antigüedad, recordatorios de cobro, fecha de
  vencimiento calculada por forma de pago y corrección en lote de las viejas.
- **Postventa**: políticas públicas en `/politicas` y QR de encuesta.
- **Filtros de trabajo del catálogo**: sin imagen, sin precio, sin SEO, sin ficha,
  fuera de la tienda, a medida, listos para exportar.

---

## Qué haría falta para dar el proyecto por terminado

Por orden de lo que más desbloquea:

1. **Empezar a enviar cotizaciones desde el portal.** Mientras se manden por
   fuera, el embudo, la tasa de cierre y el seguimiento no tienen datos. Es lo
   que más desbloquea desde que el SMTP está cargado (28-ago) y el disparador
   de 15 minutos corre en verde (1-sep).
2. **Cerrar la primera obra con el enlace de reseñas cargado.** De ahí sale la
   primera encuesta: la pantalla de resultados existe y hoy está vacía porque
   no se ha mandado ninguna.
3. **Crear los usuarios VENDEDOR reales** (hoy los asesores son administradores).
4. Los datos de gerencia: plazos de pago, precios de instalación, enlace de
   reseñas, coordinador de obras → `PENDIENTES-GERENCIA.md`.
5. Aprobación de Meta · proveedor de facturación electrónica · cuentas de
   marketplace.
6. **Pasar Vercel a plan Pro.** Hobby prohíbe el uso comercial y ya no quedan
   cupos de cron.
