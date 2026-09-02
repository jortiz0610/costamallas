# Lo que sigue — portal de Costamallas

> Escrito al cerrar la sesión del **1 de septiembre de 2026**.
> Commit de referencia: `b08f20a`.

## Antes de empezar

1. `git log --oneline -20` — los commits explican qué se hizo **y por qué**.
2. `CONTEXTO-IA.md` **§12 cómo se trabaja aquí** y **§13 Nexus**.
3. `PENDIENTES-GERENCIA.md` — las decisiones que no dependen del código.
4. `GUIA-WHATSAPP.md` — los 7 pasos para conectar WhatsApp Business.
5. Los `scripts/probar-*.ts` son la red de seguridad: hoy hay **24**.

⚠️ **Varios scripts tocan producción de verdad**: mandan correos y crean
filas. Cada uno lo avisa en su cabecera y limpia lo que crea. No hay base
de pruebas: la única que existe es la que usan los clientes.

---

## Lo que se hizo en esta sesión

Diez entregas, todas desplegadas.

**WhatsApp.** La guía de los 7 pasos, y el webhook arreglado: esperaba un
cuerpo plano y Meta manda uno anidado, así que conectarlo habría llenado
la bandeja de filas `(Sin mensaje)` de `WhatsApp`. Ahora entiende audios,
fotos, documentos, ubicaciones y botones, no confunde un acuse de entrega
con un mensaje, y exige el token de verificación —antes aceptaba
cualquiera—.

**Modo capacitación.** La marca de prueba empieza en el CLIENTE y baja
sola a cotizaciones, pedidos, visitas, instalaciones y facturas. Antes era
una casilla de la cotización y el ensayo se moría ahí: el pipeline
escondía lo de prueba, así que no había dónde seguir el proceso.

**Visita técnica.** El paso que faltaba antes de cotizar. Agendar →
producción llena el formato en campo → el cliente firma → al asesor le
llega el formato para cotizar. Con firma a pantalla completa.

**Cotizador.** Dos columnas en escritorio, vista previa, y la ciudad y
dirección del cliente entran solas.

**Nexus.** Barra propia en el móvil, avisos del sistema, menú de tres
puntos con los cuatro estados, el audio que no sonaba, el zoom al
escribir, y las etiquetas de proceso fuera del hilo.

**Configuración.** Menú plegado y tres niveles de rol, con "Mi cuenta"
para quien no administra.

**Huella.** WebAuthn con el sensor del propio aparato, sin debilitar el
doble factor.

---

## Lo que quedó pendiente, por orden de valor

### 1. Enganchar la visita al cotizador — el círculo a medio cerrar

La visita ya guarda `cotizacionId` y el modelo tiene la relación en los
dos sentidos, pero **falta la pantalla**: desde una visita terminada no
hay un botón de "cotizar esto" que abra el cotizador con el cliente y las
medidas puestas. Hoy el asesor recibe el formato por correo y lo copia a
mano.

Es lo que más valor añade de lo que queda, y es media pantalla de trabajo.

### 2. Cerrar solos los chats de la web — PENDIENTES §18

La copia de la conversación sale al cerrar, así que **un chat que nadie
cierra nunca manda la copia**. Falta decidir el plazo y engancharlo a la
corrida diaria.

### 3. Push de verdad (con la app cerrada)

Los avisos de Nexus funcionan con la pestaña abierta o en segundo plano.
Para que lleguen con la app **cerrada** hacen falta claves VAPID en Vercel
y un service worker suscrito. Está dicho en el código para que nadie lo
prometa antes de tiempo.

### 4. La llave de pago — PENDIENTES §19

`3007599461` sale en las cotizaciones y en la plantilla de pago. **No es
un teléfono, es la llave de Daviplata.** Se dejó quieta a propósito
cuando se unificaron los números.

### 5. Deuda vieja

- **113 productos sin foto** — la causa real de las miniaturas que faltan.
- **171 sin SEO**; el generador masivo nunca se lanzó (~US$ 2).
- **Recargos por ciudad**: 0 cargados, aplazado por gerencia.
- La encuesta **nunca se ha mandado**: hay 0 en la base.

---

## Sin verificar en un dispositivo real

Compilan, los tipos están bien y la lógica está probada por debajo, pero
**nadie los ha visto funcionando**:

- El tablero de módulos y la barra de Nexus en un teléfono.
- La firma a pantalla completa con un dedo o un lápiz.
- La **huella**: WebAuthn solo se puede probar con un sensor real y https.
- Las dos columnas del cotizador en un monitor.

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
