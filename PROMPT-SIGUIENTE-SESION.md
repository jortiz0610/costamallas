# Lo que sigue — portal de Costamallas

> Escrito al cerrar la sesión del **2 de septiembre de 2026**.
> Commit de referencia: `bc760b6`.

## Antes de empezar

1. `git log --oneline -25` — los commits explican qué se hizo **y por qué**.
2. `CONTEXTO-IA.md` **§12 cómo se trabaja aquí**, **§13 Nexus**, **§14 proceso
   de campo**, **§15 capacitación**, **§16 huella**.
3. `PENDIENTES-GERENCIA.md` — 21 puntos. Las decisiones que no dependen del código.
4. `MIGRACION-VPS.md` — el plan de migración y de protección del código.
5. `GUIA-WHATSAPP.md` — los 7 pasos para conectar WhatsApp Business.
6. Los `scripts/probar-*.ts` son la red de seguridad: hoy hay **27**.

⚠️ **Varios scripts tocan producción de verdad**: mandan correos y crean
filas. Cada uno lo avisa en su cabecera y limpia lo que crea. No hay base
de pruebas: la única que existe es la que usan los clientes.

---

## Lo primero de la cola

### 1. Enganchar la visita al cotizador

Es lo que más valor añade de todo lo que queda, y es media pantalla.

El modelo **ya guarda `cotizacionId`** en la visita, y la relación está en
los dos sentidos. Lo que falta es el botón: desde una visita terminada,
un «Cotizar esto» que abra el cotizador con el cliente puesto, la
dirección de la visita, y las medidas y recomendados de producción
volcados en las notas o en las líneas.

Hoy el asesor recibe el formato por correo y lo copia a mano. Ese copiado
es donde se pierden medidas.

### 2. La migración al VPS — ver `MIGRACION-VPS.md`

El servidor lo compra el cliente. El plan incluye cómo proteger el código
en una máquina que no es nuestra, y **corrige** la recomendación anterior
de usar Coolify construyendo desde GitHub: eso pondría el código fuente
en el servidor del cliente.

### 3. Lo que nunca se enganchó a la corrida diaria

Dos plantillas escritas y sin disparador:

- **La encuesta a las 24 h** de que un pedido pase a entregado.
- **La visita agendada**, cuando producción fija la fecha.

Ambas tienen que respetar `lib/horario-habil.ts`, como ya hace el
seguimiento.

### 4. Cerrar solos los chats de la web — PENDIENTES §18

La copia de la conversación sale al cerrar, así que **un chat que nadie
cierra nunca manda la copia**. Falta decidir el plazo y engancharlo.

### 5. Push con la app cerrada — PENDIENTES §21

Los avisos de Nexus funcionan con la pestaña abierta o en segundo plano.
Con la app **cerrada** hacen falta claves VAPID y un service worker
suscrito. Está dicho en el código para que nadie lo prometa antes.

---

## Lo que se hizo el 1 y 2 de septiembre

Para no repetirlo ni deshacerlo por accidente.

| | |
|---|---|
| **WhatsApp** | Guía de 7 pasos + webhook que entiende el formato real de Meta (antes cada mensaje habría entrado vacío) |
| **Capacitación** | La marca de prueba empieza en el CLIENTE y baja sola por todo el proceso |
| **Visita técnica** | Agendar → formato en campo → firma → el asesor cotiza |
| **Firma** | Pantalla completa, dedo o lápiz, con presión |
| **Cotizador** | Dos columnas, vista previa, ciudad y dirección automáticas, descuentos discriminados |
| **Nexus** | Barra propia en móvil, avisos, menú de 3 puntos, audio, zoom, etiquetas fuera del hilo |
| **Configuración** | Menú plegado y tres niveles de rol, con "Mi cuenta" para quien no administra |
| **Huella** | WebAuthn con el sensor del aparato, sin debilitar el doble factor |
| **Horario hábil** | Los correos automáticos esperan al siguiente momento de atención |
| **OPERARIO** | Rol nuevo + Orden de Producción de Malla Ciclón |
| **Proveedores** | El formato de selección que vivía en Google Forms |

---

## Decisiones de gerencia pendientes

Las de siempre están en `PENDIENTES-GERENCIA.md`. Las **nuevas** del 2-sep,
que salieron de decisiones que tomé yo y conviene confirmar:

- **El horario de atención vive en el código** (`lib/horario-habil.ts`), no
  en Configuración. Razón: es el horario de la puerta — si cambia el
  letrero cambia esto, y las dos cosas se hacen a la vez. En Configuración
  se habrían desincronizado. **Si gerencia lo quiere editable, se mueve.**
- **El puntaje de proveedores es promedio simple** de los tres bloques. El
  formato no dice pesos y repartirlos sería inventar una política
  comercial desde el código.
- **`crm.cotizaciones.equipo` viene activado** para VENDEDOR: se ven y se
  editan las ofertas entre asesores. Los clientes siguen repartidos.

---

## Sin verificar en un dispositivo real

Compilan, los tipos están bien y la lógica está probada por debajo, pero
**nadie los ha visto funcionando**:

- La **orden de producción** en una tablet de taller.
- La **firma** a pantalla completa con un dedo o un lápiz.
- La **huella**: WebAuthn solo se puede probar con sensor real y https.
- El **tablero de módulos** y la barra de Nexus en un teléfono.
- Las **dos columnas** del cotizador en un monitor.
- El **diálogo de reenvío** al modificar una oferta ya enviada.
- La **evaluación de proveedores**.

Entrar al portal con sesión escribe en producción, así que esto solo lo
puede comprobar alguien con una cuenta.

---

## Trampas (están en §12, pero por si acaso)

- **El widget del chat emite JavaScript desde un template literal**: las
  barras invertidas van **dobles**, y no se pueden usar backticks ni `${`.
- **`String.replace` se come `$'`**. Un `$` seguido de comilla en el texto
  de reemplazo inserta "todo lo que va después del match" y duplica medio
  archivo. Pasó con una expresión regular de SQL.
- **Los heredocs de Bash se comen las barras invertidas**. Para parchear:
  escribir el script de Node **a un archivo** y ejecutarlo.
- **Los finales de línea están mezclados** (CRLF y LF, a veces en el mismo
  commit). Un parche por texto exacto tiene que probar las dos formas.
- **Borra `.next` antes de cada build.** OneDrive corrompe la carpeta.
- **El sondeo del chat de la web no puede devolver notas internas.**
- **Los precios NO se piden en la API de campo.** Si no se seleccionan, no
  se pueden filtrar mal desde la pantalla.
- **`cumplePermisoDeRuta(permisos, exigido)`** — en ese orden. Una ruta
  puede exigir varios permisos separados por `|` y comprobarlo con
  `permisos.has(clave)` da siempre falso.
