# Lo que sigue — portal de Costamallas

> Escrito al cerrar la sesión del **1 de septiembre de 2026**.
> Commit de referencia: `9a085fc`.

## Antes de empezar

1. `git log --oneline -25` — los commits explican qué se hizo **y por qué**.
2. `CONTEXTO-IA.md` §10.1 (lo construido que no funciona y por qué),
   **§12 cómo se trabaja en este repo** y **§13 Nexus**, que ahora incluye
   el chat de la web entero.
3. `PENDIENTES-GERENCIA.md` — 20 puntos. Los tres últimos son nuevos.
4. Los `scripts/probar-*.ts` son la red de seguridad: hoy hay **21**.
   **Córrelos antes y después de tocar lo suyo.**

⚠️ **Varios scripts tocan producción de verdad**: mandan correos y crean
filas. Cada uno lo avisa en su cabecera y limpia lo que crea. No hay base
de pruebas: la única que existe es la que usan los clientes.

---

## Lo que se hizo en esta sesión

**El chat de la web quedó completo, de ida y de vuelta.** Era lo más roto
del sistema y no se notaba, porque el error solo aparecía al intentar
responder.

- Responder desde Nexus una conversación del chat devolvía *"El canal WEB no
  tiene URL de salida configurada"*. No había camino de vuelta: la persona
  escribía, cerraba la pestaña y no quedaba a dónde contestarle.
- Ahora el widget consulta cada 7 segundos y pinta lo que escribe un humano,
  con su nombre. También con el chat cerrado: la burbuja saca un punto rojo.
- El correo pasó a ser el **recibo**, no el canal: la conversación completa
  sale una vez, al cerrar.
- La entrada dejó de ser un formulario de tres campos. Ahora es el saludo y
  dos botones: escribir, o WhatsApp. Los datos se piden después, y solo a
  quien eligió escribir.

**Otras cosas cerradas:** el tablero de módulos en el teléfono, la pantalla
de resultados de la encuesta, el fragmento de WordPress a la vista en
Configuración, el micrófono (era la cabecera `Permissions-Policy`), y los
estados vacíos del inbox, que decían "conecta un canal" con el canal
conectado.

---

## Lo que quedó pendiente, por orden de valor

### 1. Cerrar solos los chats de la web — PENDIENTES §18

**Es la consecuencia directa de lo que se acaba de hacer.** La copia de la
conversación sale al cerrar, así que **un chat que nadie cierra nunca manda
la copia**. Falta decidir el plazo (48 h, 72 h) y engancharlo a la corrida
diaria. Unas horas de trabajo, y hasta entonces el cliente depende de que
un asesor se acuerde de cerrar.

### 2. La llave de pago — PENDIENTES §19

`3007599461` sale en las cotizaciones y en la plantilla de pago de Nexus.
**No es un teléfono, es la llave de Daviplata.** Gerencia pidió unificar
teléfonos y esto se dejó quieto a propósito: cambiarlo manda los pagos a
donde no es. Falta confirmarlo.

### 3. La encuesta no se ha mandado nunca

Hoy hay **0 encuestas** en la base. La pantalla de resultados existe y
muestra su estado vacío, que es lo correcto. Se manda sola al cerrar una
instalación; hasta que no se cierre la primera obra con el enlace de
reseñas cargado (PENDIENTES §5), no hay nada que leer.

### 4. Lo que nunca se enganchó a la corrida diaria

Dos plantillas de correo escritas y sin disparador:

- **La encuesta a las 24 h** de que un pedido pase a entregado.
- **La visita agendada**, cuando producción fija la fecha.

### 5. Deuda vieja que sigue ahí

- **113 productos sin ninguna foto.** Es la causa real de las miniaturas que
  faltan en las cotizaciones. El código ya hace todo lo que puede.
- **171 productos sin SEO**; el generador masivo nunca se ha lanzado. Cuesta
  unos US$ 2 el catálogo entero (PENDIENTES §9).
- **Recargos de instalación por ciudad**: hay 0 cargados. Gerencia lo aplazó
  explícitamente (PENDIENTES §7).
- **El embudo** admite más gráficas y reportes por vendedor.

---

## Lo que está construido y espera un dato de gerencia

| Qué | Qué falta | PENDIENTES |
|-----|-----------|------------|
| WhatsApp y las 3 líneas | Aprobación de Meta | — |
| QR de la encuesta | Enlace de reseñas de Google | 5 |
| Botón del catálogo en los correos | Subir el PDF y pegar la dirección | 12 |
| Guardar documentos SG-SST | Almacenamiento privado (VPS) | 15 |
| Recargos por ciudad | Cargarlos | 7 |
| Plazos de pago | Confirmación | 1 |
| Facturación DIAN | Elegir proveedor | — |
| Vercel Pro (o el VPS) | Decisión — **el plan actual prohíbe el uso comercial** | — |
| Teléfono del pie de la web | Cambiarlo en WordPress | 20 |

---

## Sin verificar en un dispositivo real

Compilan, están desplegados y probé la lógica por debajo, pero **nadie los
ha visto en un teléfono**:

- El tablero de módulos (`LanzadorMovil`).
- El punto rojo de la burbuja del chat cuando el asesor responde.

También falta comprobar la mitad con sesión iniciada del fragmento de
WordPress: entrar a la tienda con una cuenta y abrir el chat. Si saluda por
el nombre sin pedir datos, quedó.

---

## Trampas (están en §12, pero por si acaso)

- **El widget del chat emite JavaScript desde un template literal**: las
  barras invertidas van **dobles**. Una `\s` sola llega al navegador como la
  letra "s". Y no se pueden usar backticks ni `${` dentro.
- **Los heredocs de Bash se comen las barras invertidas** en este entorno, y
  `node -e "…"` con una clase de caracteres revienta. Para parchear:
  escribir el script de Node **a un archivo** y ejecutarlo.
- **Los finales de línea están mezclados.** Hay archivos en CRLF y otros en
  LF, a veces en el mismo commit. Un parche por texto exacto tiene que
  probar las dos formas o no encuentra nada.
- **Borra `.next` antes de cada build.** OneDrive corrompe la carpeta y el
  build falla con `EINVAL readlink`. No es el código.
- **El sondeo del chat de la web no puede devolver notas internas.** Está
  dicho en §13 y se repite aquí porque es el error que más caro sale.
