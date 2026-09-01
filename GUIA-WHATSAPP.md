# Conectar WhatsApp Business al portal

> Para Jose. Escrito el **1 de septiembre de 2026**.
>
> **Los 7 pasos se pueden hacer ya.** El webhook quedó arreglado el 1-sep.
> Empieza por el paso 1: es el que más se demora y no depende de nosotros.

---

## Antes de empezar, tres cosas que conviene saber

**1. El número no puede estar usándose en WhatsApp.** El número que
conectes tiene que salir de la app de WhatsApp (y de WhatsApp Business) o
Meta lo rechaza. No se puede tener el mismo número en el celular y en la
API a la vez.

> Recomendación: **no uses 3006078956 ni 3245912653** si los asesores los
> tienen en el celular. Consigue una línea nueva, aunque sea prepago, o
> usa un fijo que pueda recibir una llamada de verificación. El día que
> quieras migrar uno de los dos, se puede — pero pierdes el historial de
> esa línea en el celular.

**2. La ventana de 24 horas.** Después de que un cliente te escribe,
tienes 24 horas para responderle lo que quieras. Pasadas esas 24 horas
solo puedes escribirle con una **plantilla aprobada por Meta**. Esto no es
del portal, es de WhatsApp, y es la regla que más sorprende.

**3. Es gratis para empezar.** Meta da 1.000 conversaciones de servicio al
mes sin costo. Después se cobra por conversación iniciada, en centavos de
dólar. Para el volumen de Costamallas es difícil que se pase.

---

## Paso 1 — Verificar el negocio en Meta ⏳ empieza por aquí

**Esto es lo que más se demora: de 2 días a 2 semanas.** Hazlo hoy y
mientras Meta revisa, sigues con lo demás.

1. Entra a **business.facebook.com** con el Facebook de Costamallas.
2. Menú de la izquierda → **Configuración del negocio** (el engranaje).
3. **Centro de seguridad** → **Verificación del negocio** → *Iniciar
   verificación*.
4. Te va a pedir:
   - **Nombre legal:** COSTAMALLAS S.A.S.
   - **NIT:** 900.659.899-8
   - **Dirección** y **teléfono** de la empresa.
   - **Un documento** que lo respalde: el **RUT** o el **Certificado de
     Cámara de Comercio** (menos de 90 días). El de Cámara suele pasar a
     la primera.
   - **Sitio web:** costamallas.com
5. Meta verifica por teléfono o correo. Que el número y el correo que
   pongas sean los mismos que salen en el RUT o en la web.

> ⚠️ El nombre tiene que coincidir **exacto** con el documento. Si el RUT
> dice "COSTAMALLAS S.A.S." no escribas "Costamallas SAS".

---

## Paso 2 — Crear la app

1. Entra a **developers.facebook.com** con la misma cuenta.
2. Arriba a la derecha: **Mis aplicaciones** → **Crear aplicación**.
3. Caso de uso: elige **Otro** → tipo **Negocio** (*Business*).
4. Nombre: `Costamallas Portal` (o el que quieras; el cliente no lo ve).
5. Asóciala al **negocio de Costamallas** que verificaste en el paso 1.

---

## Paso 3 — Añadir WhatsApp a la app

1. Ya dentro de la app, en el panel: **Agregar producto** → busca
   **WhatsApp** → *Configurar*.
2. Te crea una **cuenta de WhatsApp Business (WABA)** automáticamente.
3. Vas a caer en la pantalla **API Setup** / *Configuración de la API*.
   **Guarda esta pantalla, es a la que vas a volver.**

En esa pantalla ya te dan un **número de prueba** de Meta. Sirve para
probar que todo funciona antes de meter el número real. Úsalo.

---

## Paso 4 — Registrar el número real

En la misma pantalla de API Setup:

1. En *Desde* / *From*, botón **Agregar número de teléfono**.
2. Datos que pide:
   - **Nombre para mostrar:** `Costamallas` — es lo que ve el cliente en
     su WhatsApp. Meta lo revisa; no pongas cosas como "Costamallas
     Ventas 24/7 ¡Ofertas!" o lo rechazan.
   - **Categoría:** Comercio minorista / Retail.
   - **Descripción:** algo sobrio, tipo *"Mallas de seguridad para
     balcones, mascotas y cerramientos."*
3. Verificación del número: **SMS** o **llamada**. Ten el teléfono a mano.
4. Si el número está en la app de WhatsApp, **primero bórralo de ahí**:
   WhatsApp → Ajustes → Cuenta → Eliminar mi cuenta.

---

## Paso 5 — El token permanente ⚠️ el paso que todos hacen mal

El token que sale en API Setup **caduca en 24 horas**. Si pegas ese en el
portal, mañana deja de funcionar. Hay que crear uno permanente:

1. **business.facebook.com** → **Configuración del negocio**.
2. Menú izquierdo → **Usuarios** → **Usuarios del sistema** → *Agregar*.
3. Nombre: `Portal Costamallas`. Rol: **Administrador**.
4. Sobre ese usuario: **Agregar activos** → pestaña **Aplicaciones** →
   marca tu app → dale **Control total**.
5. Otra vez **Agregar activos** → pestaña **Cuentas de WhatsApp** → marca
   la WABA → **Control total**.
6. Ahora sí: botón **Generar token**.
   - App: la tuya.
   - Caducidad: **Nunca**.
   - Permisos: marca **`whatsapp_business_messaging`** y
     **`whatsapp_business_management`**.
7. **Copia el token y guárdalo donde no se pierda.** Meta lo muestra una
   sola vez.

---

## Paso 6 — Lo que tienes que anotar para mí

De la pantalla **API Setup** de la app, copia estos tres datos:

| Dato | Dónde está | Cómo se ve |
|------|-----------|------------|
| **Phone Number ID** | Debajo del número, en API Setup | Un número largo: `109371234567890`. **No es el teléfono.** |
| **WhatsApp Business Account ID** | En la misma pantalla | Otro número largo |
| **Token permanente** | El del paso 5 | Empieza por `EAA...`, es larguísimo |

**Cárgalos tú mismo en el portal**, no me los mandes por chat:

> Portal → **Configuración** → pestaña **Canales & Redes** → WhatsApp
> Business → pegar y **Guardar**.

El token se guarda **cifrado** en la base. Yo no lo veo ni lo necesito.

---

## Paso 7 — El webhook ✅ ya está listo

Aquí es donde Meta le avisa al portal que llegó un mensaje.

> **Arreglado el 1-sep.** El portal esperaba un formato plano y Meta
> manda uno anidado: cada mensaje habría entrado vacío. Ahora entiende el
> formato real, incluidos los audios, fotos, documentos y ubicaciones, y
> no confunde un acuse de entrega con un mensaje. Y el token de
> verificación ahora sí se exige: antes aceptaba cualquiera.

Son 2 minutos:

1. En la app de Meta: **WhatsApp → Configuración → Webhooks** → *Editar*.
2. **URL de devolución de llamada:**
   ```
   https://portal.costamallas.com/api/nexus/webhook/whatsapp
   ```
3. **Token de verificación:** invéntate uno largo (ej.
   `costamallas-2026-XYZ`) y **pégalo igual** en el portal, en el campo
   *Verify token* de la conexión de WhatsApp. Tienen que ser idénticos.
4. Dale **Verificar y guardar**.
5. Abajo, en *Campos de webhook*, botón **Administrar** → suscríbete a
   **`messages`**. Ese es el único que hace falta.

---

## Cómo saber que quedó

1. Desde tu celular, escríbele al número de Costamallas.
2. El mensaje tiene que aparecer en **Nexus** en menos de 10 segundos,
   con tu nombre y tu número.
3. Responde desde Nexus. Te tiene que llegar al celular.
4. Si no llega: Portal → **Sistema → Estado del sistema**. Dice, canal
   por canal, si "recibe y responde" o "solo recibe", y por qué.

---

## Errores frecuentes

| Lo que ves | Qué pasó |
|-----------|----------|
| "Recipient phone number not in allowed list" | Estás en modo prueba. Añade tu número en API Setup → *Para* → *Administrar lista* |
| El envío falla a las 24 h | La ventana se cerró. Fuera de ella solo van plantillas aprobadas |
| El webhook no verifica | El token de verificación no es idéntico en los dos lados |
| El webhook devuelve 403 | El token de verificación no es idéntico en los dos lados |
| "Display name not approved" | El nombre para mostrar no pasó la revisión. Ponlo más sobrio |

---

## Resumen de qué hacer ahora

1. **Hoy:** paso 1 (verificación del negocio) — es el que se demora.
2. **Hoy también:** pasos 2, 3 y 4 con el número de prueba de Meta.
3. **Cuando tengas el número real:** paso 5 (token permanente) y paso 6
   (cargarlo en el portal).
4. **Paso 7:** cuando tengas la app lista. El webhook ya está de mi lado.
