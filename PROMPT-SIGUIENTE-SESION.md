# Prompt para la siguiente sesión — Costamallas ERP

> Copia todo lo de abajo (desde «Vas a continuar…») y pégalo como primer mensaje
> de una sesión nueva de Claude Code, en la carpeta del proyecto.
>
> Escrito el 2026-08-28. Último commit de referencia: `f1ea1e2`.
>
> **Es mucho trabajo: son varias sesiones, no una.** Está ordenado en fases
> a propósito. La Fase 1 es la base de la que cuelga todo lo demás; si se
> hace en desorden hay que rehacerla.

---

Vas a continuar el portal de Costamallas (`Costamallas/Files/costamallas-erp`).
Avanza SIN PARAR hasta terminar todo lo que se pueda hacer sin mí. Si tienes
preguntas, hazlas TODAS al principio, en una sola tanda, y después sigue de
largo: no me pidas visto bueno entre tareas.

## ANTES DE EMPEZAR — verifica el estado real, no te fíes de este texto

1. `git log --oneline -35` — los commits explican QUÉ se hizo y POR QUÉ. Ahí
   está casi todo el contexto de las últimas dos sesiones.
2. `git status` y `git rev-list --left-right --count origin/main...HEAD`.
3. `CONTEXTO-IA.md` — arquitectura, §10.1 lo construido que no funciona y por
   qué, §10.2 estado de los datos, **§12 cómo se trabaja en este repo**.
4. `PENDIENTES-GERENCIA.md` — los datos que faltan de mi lado.
5. `prisma/migrations/` — 14 migraciones aplicadas a mano en producción.
6. Los scripts de `scripts/probar-*.ts` y `verificar-*.ts`: son la red de
   seguridad. **Córrelos antes y después de tocar lo suyo.**

## CÓMO SE TRABAJA EN ESTE REPO (no lo redescubras)

Está todo en `CONTEXTO-IA.md` §12. Lo que más duele si se olvida:

- **MIGRACIONES:** `npx tsx scripts/aplicar-migracion.ts <archivo.sql>`.
  `prisma db execute` se cuelga contra el pooler. El SQL debe ser idempotente
  y ADITIVO. Nunca DDL destructivo: se aplica sobre la única base que hay.
  Después: actualizar `schema.prisma` a mano y `npx prisma generate`.
- **BUILD:** borra `.next` antes de cada `npm run build` (OneDrive lo corrompe).
  Si `rm -rf .next` se queja de archivos en uso, insiste.
- **A veces OneDrive borra `node_modules/.prisma`.** Si un script falla con
  `Cannot find module '.prisma/client/default'`, corre `npx prisma generate`.
- **CADA LLAMADA A BASH ES UN SHELL NUEVO.** Las variables no sobreviven.
- **CRLF:** casi todos los archivos tienen finales CRLF. Si insertas líneas con
  `\n` a secas, el diff se ensucia. Detecta el fin de línea del archivo y úsalo.
  Comprueba siempre con `git diff --stat`. Para reemplazos de varias líneas, un
  script de Node con una cadena exacta es más seguro que `sed`: si la cadena no
  está, falla en vez de escribir cualquier cosa. **Ojo con los backticks y
  `${}` dentro de heredocs** — rompen el script; usa la herramienta de edición.
- **NO pruebes con sesión iniciada:** entrar al portal escribe en producción.
  Verifica con `tsc --noEmit`, `npm run build`, las rutas públicas
  (`/cotizacion/demo`, `/politicas`) y los scripts de `scripts/`.
- **EJECUTAR EN PRODUCCIÓN SIN SESIÓN:** el `CRON_SECRET` de `.env.local` es el
  mismo que el de Vercel. Con él se dispara cualquier ruta que use el patrón de
  `/api/cron/diario`. Es la ÚNICA forma de correr algo que necesite descifrar un
  secreto de `configuracion` (WordPress, WooCommerce, la key de Claude): esas
  claves están cifradas con la `ENCRYPTION_KEY` de producción, que no es la de
  local. Ojo: la ruta tiene que estar en `PUBLIC_PATHS` del middleware o no
  llega ni a ejecutarse.
- **COMMITS:** en español, agrupados por tema, explicando el porqué. Si el
  mensaje lleva backticks o comillas, escríbelo a un archivo y usa
  `git commit -F`. **Puedes desplegar**: `git push` dispara Vercel. Verifica
  READY con `api.vercel.com` y `VERCEL_TOKEN` antes de seguir.
- **Marca como «no verificado» todo lo que no hayas comprobado.**

## DECISIONES YA TOMADAS (no las vuelvas a preguntar)

1. **Permisos: tabla en BD, por usuario y submódulo.** Cada rol trae un juego
   por defecto y a cada usuario se le puede activar o quitar algo puntual.
2. **Automatización: constrúyela como si hubiera cron frecuente.** Nos migramos
   pronto al VPS de Hostinger, donde hay cron real. Mientras tanto, deja un
   disparador externo (GitHub Actions con `schedule`, cada 15 min, llamando con
   el `CRON_SECRET`) para que funcione ya en Vercel Hobby.
3. **COT-00001 a COT-00009: BORRARLAS todas**, aunque COT-00002 y COT-00004
   estén aprobadas y tengan pedido. ⚠️ **Antes de borrar, exporta las 9 con sus
   ítems a un JSON en `docs/` y commítalo.** Es irreversible y hay 4 pedidos
   nacidos de cotizaciones.
4. **Las cotizaciones se sirven desde `cotizacion.costamallas.com`.** Deja el
   código listo para ese dominio (`lib/url-portal.ts` ya centraliza esto) y
   dime los pasos exactos de DNS + Vercel que tengo que hacer yo.
5. **Descuento del vendedor: tope libre del 10 %.** No es un desplegable de
   valores fijos — puede poner 3, 6,5 u 8; lo que no puede es pasarse de 10.
   Por encima, la política comercial ya exige visto bueno de un administrador.
6. **Cotizaciones de prueba: sí, con marca.** Solo el superadmin las crea. Van
   marcadas y quedan FUERA de informes, embudo, pipeline y consecutivo real, y
   se pueden borrar en bloque. Lo mismo para los pedidos y el resto del flujo
   que nazca de ellas.
7. **Nombres de las etapas del pipeline: los de la Fase 5.** Ya están decididos.

## ESTADO VERIFICADO (2026-08-28)

- **Permisos:** solo por MÓDULO, en `lib/permisos.ts`, en código. Sin tabla, sin
  submódulos, sin permisos por usuario. `VENDEDOR: ["CRM", "NEXUS"]`.
- **20 cotizaciones.** 9 con numeración vieja (COT-00001…09), 11 con la nueva
  (COT-12065…12075). Aprobadas: COT-00002, COT-00004, COT-12070.
- **31 clientes.** Estados en uso: `CLIENTE_ACTIVO`=19, `INTERESADO`=9,
  `RECURRENTE`=2, `PROSPECTO`=1. Quitar RECURRENTE obliga a migrar esos 2.
- **2 vendedores activos:** Elkin Fernández, Bleidis Barrios.
- **1 conexión Nexus** (canal WEB, la del agente). **0 de WhatsApp.**
- **176 productos**, 60 publicados, 171 activos sin SEO, 113 sin ninguna imagen.
- **El agente web está ENCENDIDO** en costamallas.com, con WhatsApp
  573007599461, Sonnet 5 y tope de US$ 3/día.
- **«Ver el portal como…»** ya existe (`lib/rol-prueba.ts`): el superadmin se
  pone otro rol en solo lectura. Úsalo para probar lo que construyas.

## LO QUE ESTÁ BLOQUEADO ESPERÁNDOME A MÍ

Construye todo lo que se pueda y déjalo funcionando en cuanto llegue el dato,
con un aviso claro en pantalla de qué falta. **NO simules que funciona.**

| Qué | Qué falta | Qué se cae |
|-----|-----------|------------|
| **SMTP** | cargar credenciales desde el portal EN PRODUCCIÓN | **Todos** los correos nuevos de esta lista |
| **WhatsApp** | aprobación de Meta | Las 3 líneas asignables y el Nexus móvil real |
| **Enlace de reseñas Google** | el enlace corto | El QR de la encuesta |
| **Horario de atención** | el dato | Sale «—» en las políticas |
| **Recargos por ciudad** | hay 0 cargados | La instalación cuesta igual en toda la costa |
| **Plazos de pago reales** | confirmación | Hoy: contado 0 / crédito 30 |
| **Facturación DIAN** | elegir proveedor | Modo manual |
| **Vercel plan Pro** | decisión (o el VPS) | Uso comercial en plan Hobby |

## ARCHIVOS QUE YA TE DEJÉ

En `Costamallas/Files/formatos/`:

- **`Formato Valoración de cliente.docx`** — la encuesta. Contiene: NPS
  (0-10 «¿con qué probabilidad recomendaría?»), «¿qué destacaría?», satisfacción
  0-10 en **calidad de productos/servicios, relación calidad-precio,
  profesionalidad, atención recibida, puntualidad/rapidez, limpieza/orden**,
  probabilidad de recompra 0-10, y recomendaciones abiertas.
- **`Acta de servicio.xlsx`** — orden de servicio; tipo (instalación,
  reemplazo, desmonte, mantenimiento, garantía, otro); control de avance con
  fecha/técnico/labor/hora inicio-fin por visita; observaciones del cliente;
  declaraciones de conformidad; estado completado o pendiente con razones.
- **`F. Visita tecnica.xlsx`** — cerca eléctrica (altura y material del muro,
  metros lineales, postes, aisladores, alambre, tapones, placas, cable, tubos
  EMT, acabado, punto eléctrico, distancias) y malla invisible (medidas de
  balcón y ventanas, si tiene vidrio, material de la parte superior).
- **`FORMATO REQUISICION DE MATERIALES Y HERRAMIENTAS.xlsx`** — proyecto,
  ubicación, responsable, descripción, tiempo de ejecución, tabla de materiales
  y de herramientas con cantidad y detalle, solicitudes especiales, firmas.
- **`Catalogo PRO CM 2026.pdf`** — el catálogo para el botón del correo.

## DATOS DE LA EMPRESA PARA LOS CORREOS

Pie de todos los correos: **Teléfonos 3006078956 – 3245912653** y
**ventas@costamallas.com**.

Cuerpo del correo de envío de cotización (texto exacto, no lo «mejores»):

> Cordial saludo Estimado cliente,
>
> Esperamos se encuentren muy bien.
>
> De acuerdo con lo conversado, compartimos la propuesta correspondiente al
> servicio solicitado, la cual incluye el alcance técnico y las condiciones
> comerciales para su revisión.
>
> Para nosotros es muy valioso acompañarlo y aportar a sus proyectos. Quedamos
> atentos a sus comentarios o inquietudes, así como a cualquier ajuste que
> consideren necesario para avanzar.
>
> Agradecemos de antemano su tiempo y la confianza depositada en nuestro equipo

---

# EL TRABAJO, EN ORDEN

## FASE 1 — Permisos por submódulo y por usuario (va primero, todo depende)

Tabla en BD. Cada rol trae un juego por defecto; a cada usuario se le puede
activar o quitar algo puntual. Pantalla de administración de perfiles y roles.

**Lo que debe ver el VENDEDOR (hoy solo ve CRM y NEXUS):**

- **ERP:** Dashboard, Productos, Imágenes, Stock. **NO:** Catálogos, Compras,
  Facturación, Cartera, Sincronización WC, Reporte de errores, SEO con IA.
- **CRM:** Resumen, Clientes, Cotizaciones, Pedidos, Pipeline, Instalaciones.
  **NO:** Embudo, Postventa.
- **NEXUS:** solo Inbox. **NO:** Plantillas, Flujos, Tiempo de respuesta,
  Conexiones.
- **Growth/Marketing:** nada.

**Permiso por usuario que hay que poder activar:** «este vendedor puede editar
productos». Por defecto un vendedor ve la ficha completa pero **solo edita el
stock**, y no ve las pestañas de SEO ni de asistente IA.

Usa `lib/rol-prueba.ts` para comprobar cada rol sin crear usuarios.

## FASE 2 — ERP para el vendedor

- **Productos:** ficha en modo lectura salvo stock. Esconder pestañas SEO e IA.
  Agrégale herramientas útiles para vender (buscar rápido, ver precio y
  existencias, copiar ficha para mandar al cliente).
- **Imágenes:** solo lectura, con un **filtro técnico** para encontrar fotos
  rápido (por producto, categoría, medida, si está publicada). Copiar URL y
  **adjuntar directo a un chat de Nexus**.
- **Stock:** como está + herramientas útiles.

## FASE 3 — Clientes y estados automáticos

Rediseñar la tarjeta y el registro de cliente y de empresa (más profesional, y
distintos entre sí). **Estados automáticos**, calculados, no escritos a mano:

| Estado | Cuándo |
|--------|--------|
| Prospecto | primera interacción |
| Interesado | pidió una cotización |
| Cliente activo | aprobó una cotización |
| VIP | empresa con más de 5 cotizaciones aprobadas |
| Inactivo | más de 6 meses sin ninguna interacción (chat incluido) |
| *(renombrar «no calificado»)* | nunca aprobó una cotización; sigue recibiendo publicidad |

Quitar `CALIFICADO` y `RECURRENTE` (hay 2 clientes en RECURRENTE: migrarlos).
Conectar Clientes con Nexus: iniciar chat de WhatsApp desde la ficha.

## FASE 4 — Cotizaciones (el bloque más grande)

- **Check «asignación de visita»**: agenda una visita previa al coordinador de
  producción. El vendedor llena el formato; al coordinador le llega la
  solicitud en su módulo de trabajos, con opción de descargar en PDF.
  Base: `F. Visita tecnica.xlsx`.
- **Check «proceso de SG-SST requerido»**: habilita al coordinador la carga de
  documentos por trabajador (cédula, planilla de seguridad social, certificado
  de alturas…), más coordinador SST y coordinador de alturas. **Subida por
  PERSONA de una vez**, con casillas opcionales para marcar qué documentos
  van. ⚠️ Son datos personales: NO al FTP (que está roto) ni a una biblioteca
  pública de WordPress — decide un almacenamiento privado y explícalo.
- **Descuentos:** el vendedor tiene un **tope libre del 10 %** — puede poner
  cualquier valor hasta ahí (3, 6,5, 8…), no una lista cerrada. Pasarse de 10
  cae en la política comercial, que ya exige visto bueno de un administrador.
- **Check «producto sin descuento»** en el ERP: esos productos no admiten
  descuento individual, pero sí entran en el descuento global.
- **Correos** (ver Fase 6).
- **Miniaturas:** las imágenes no salen en la miniatura de la cotización.
  **Diagnostícalo** — debe salir siempre, también en EXPRESS y en producción.
- **Botones del cliente** en la cotización pública: rediseñarlos, que no tapen
  el documento. Añadir **Aprobar con confirmación de «Sí»**. Sin botón de
  rechazar.
- **Vencidas:** dejar aplazar la fecha unos días más.
- **Cotizaciones de prueba:** columna `esPrueba` (aditiva). Solo el superadmin
  puede crearlas. Quedan fuera de informes, embudo, pipeline y del consecutivo
  real —usa una numeración aparte tipo `PRUEBA-001` para no quemar números—, se
  ven marcadas en pantalla y se pueden borrar en bloque. La marca se hereda al
  pedido y a todo lo que nazca de ellas.
- **Borrar COT-00001…09** (con respaldo previo en JSON).

## FASE 5 — Pipeline automatizado y flujo con producción

Cada vendedor ve su propio pipeline. **Los nombres de las etapas ya están
decididos** (describen lo que pasó; la única donde el vendedor tiene que actuar
lleva nombre imperativo a propósito):

| Etapa | Qué significa | Quién actúa |
|-------|---------------|-------------|
| **Enviada** | acaba de salir, arrancó el reloj | — |
| **Recordada** | ya le llegó el correo de las 24 h | automático |
| **Para llamar** | le toca al vendedor | **el vendedor** |
| **Por vencer** | salió el último correo, con el botón de aprobar | automático |
| **Vencidas** | al final, con ojito para ocultar | — |
| **En producción** | el cliente aprobó | producción |
| **Completados** | encuesta a las 24 h | — |

```
Enviada  → (24 h)    Recordada   · automático: correo recordando la oferta
         →           Para llamar · notificaciones al vendedor en horario
                                   laboral, aleatorias; él marca «llamado»
         → (48-72 h) Por vencer  · automático: correo con la fecha de
                                   vencimiento y botón sutil de aprobar
         →           Vencidas    · al final, con ojito para ocultar (no oculto)
         →           En producción · si aprobó (aquí arranca producción)
         →           Completados · al salir de producción
                                 · a las 24 h: encuesta de satisfacción
```

**Vuelta de producción a cotización:** cuando producción entrega la visita
técnica, sus fotos y el `FORMATO REQUISICION DE MATERIALES Y HERRAMIENTAS`, la
oportunidad vuelve a «pendiente cotización» **con un color llamativo** y aviso
en todos lados. Al terminar la visita técnica, producción entrega el
`Acta de servicio` con fotos y pasa a completado.

**Instalaciones (vendedor):** calendario con vista mes / semana / día,
**sin domingos en la vista semana**. Ver sus visitas programadas, hablar con el
cliente antes, y correo automático al cliente con fecha y hora acordadas.

**Pedidos:** cada vendedor ve solo los suyos. Quitar el botón de importar de
WooCommerce. Solo el admin puede devolver un pedido a cotización. Calendario
personalizable.

**Embudo** (que el vendedor NO ve): mejorarlo con más gráficas y reportes por
vendedor.

## FASE 6 — Correos: plantillas editables

Pestaña nueva en **Configuración → Correo**: todas las plantillas de correo,
categorizadas, editables, **con vista previa en vivo**. Que quede muy bien
hecho.

La plantilla lleva un **banner horizontal, vistoso pero no invasivo**, con
botones al **catálogo (PDF)** y a la **tienda**. Pie con los teléfonos y el
correo de ventas.

**Correos nuevos:**
- Envío de cotización (con el texto exacto de arriba).
- **Cotización modificada** — si ya se había enviado, preguntarle al vendedor
  si la reenvía.
- Presión para aprobar (Llamado 3), con botón de aprobar sutil y elegante.
- Visita agendada, con fecha y hora.
- Encuesta de satisfacción a las 24 h de completado.
- **Avisar mejor al vendedor cuando el cliente abre la cotización.**

## FASE 7 — Nexus: móvil primero

**Dos mockups primero**, antes de programar: cómo se vería la PWA en móvil.
Enséñamelos y espera mi visto bueno para esta fase.

- En móvil, el vendedor entra y **lo primero que ve es Nexus**. Los demás
  módulos, en un menú. Que funcione como WhatsApp: dinámica y fácil.
- Cámara, audios y archivos, como WhatsApp.
- `/` para comandos y **`@mallita`** para pedir ayuda a la IA (con límite
  diario y que lo active el admin).
- **Escritorio:** el menú lateral debe poder plegarse para dar espacio. Los
  canales en horizontal no se ven bien: rediseñar. Quitar lo que es solo de
  admin. Poder **guardar el cliente desde el chat**. Quitar «resolver»: todos
  son chats, diferenciados solo por canal. **Unir el canal de WordPress con el
  de correo.** Vistas previas de enlaces y archivos.
- **Temas:** menú de configuración en el inbox para elegir fondo, 3 temas, solo
  en móvil.
- 3 líneas de WhatsApp, asignables desde la configuración del usuario.

## FASE 8 — Detalles sueltos

- **Chatbot web:** mini registro antes de chatear (nombre y correo mínimo, y
  aceptación de la política de datos).
- **Icono del chatbot: ya está decidido.** Hoy es el emoji 💬, que se ve
  distinto en cada sistema y por eso parece una nube. Reemplázalo por este SVG
  en `api/public/agente/widget.js/route.ts` (donde dice `burbuja.textContent`).
  Es dibujado, no bajado de ningún banco de iconos: sin licencia de por medio y
  legible a 26 px, que es donde los iconos bonitos se vuelven mugre.

  ```js
  // Burbuja sólida con tres puntos. Hereda el color del botón.
  burbuja.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2.75c-5.11 0-9.25 3.44-9.25 7.69 0 2.4 1.33 4.54 3.41 5.95v3.36c0 .53.6.84 1.03.53l3.02-2.17c.58.09 1.18.13 1.79.13 5.11 0 9.25-3.44 9.25-7.8S17.11 2.75 12 2.75Z"/>' +
    '<circle cx="8.2" cy="10.4" r="1.15" fill="#f9df1e"/>' +
    '<circle cx="12" cy="10.4" r="1.15" fill="#f9df1e"/>' +
    '<circle cx="15.8" cy="10.4" r="1.15" fill="#f9df1e"/>' +
    '</svg>';
  ```

  Los puntos van en amarillo de marca porque la burbuja es negra sobre el
  círculo amarillo. Si algún día el color de marca cambia, sácalo de
  `CFG.color` en vez de dejarlo escrito.
- **Configuración más pro:** agrupar mejor las pestañas y poner iconos «?» de
  ayuda que expliquen qué hace cada opción.

---

## REGLAS

- Si algo de aquí no coincide con el repositorio, **dímelo y sigue con lo
  verificado**.
- Marca como «no verificado» todo lo que no hayas comprobado. Prefiero un «no
  lo probé» a una afirmación bonita.
- **No inventes datos comerciales.** Precios, plazos y garantías salen de la
  cotización de SIIGO, de la lista de precios y de `Archivos base de empresa/`.
- Escribe un script de verificación por cada cosa que construyas, como los que
  ya hay en `scripts/`. Si escribe en producción, que limpie al terminar.
- Actualiza `CONTEXTO-IA.md` y `PENDIENTES-GERENCIA.md` al final.
- Cuando termines, dame un resumen de qué quedó hecho, qué verificaste y qué
  sigue pendiente.
