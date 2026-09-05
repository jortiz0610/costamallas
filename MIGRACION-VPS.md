# Migración al VPS de Hostinger, y cómo se protege el código

> Escrito el **2 de septiembre de 2026**.
> El servidor lo compra y lo paga **Costamallas**. El software es de ESEK.
> Este documento cubre las dos cosas a la vez, porque no se pueden separar.

---

## Lo primero: qué se puede prometer y qué no

Hay que decirlo antes de gastar un peso, porque cambia el plan entero.

**En una máquina donde el cliente tiene acceso de administrador, no
existe el "Docker sellado".** Quien controla el servidor puede:

- Exportar la imagen entera (`docker save`) y abrirla en otro lado.
- Entrar al contenedor y leer los archivos.
- Ver las variables de entorno con `docker inspect` — incluidas las claves.
- Volcar la memoria del proceso.
- Y si le quitas el acceso: entrar por el panel de Hostinger, restablecer
  la contraseña de root, o montar el disco desde el modo de rescate.

Eso no es un fallo de configuración: es lo que significa ser dueño de la
máquina. Cualquiera que te venda un "cifrado inviolable" en un servidor
ajeno te está vendiendo humo.

**Lo que sí se consigue, y es mucho:**

| Objetivo | ¿Se logra? |
|---|---|
| Que el cliente no pueda **leer tu código fuente** cómodamente | Sí — en el servidor solo hay JavaScript compilado y minificado |
| Que no pueda **reconstruir ni modificar** el sistema | Sí — sin el repo, sin el registro y sin las llaves de compilación, no puede |
| Que no pueda **desplegar tu software en otro sitio** | Sí — el registro es tuyo y revocable |
| Que **no dependa de ti** para operar día a día | Sí — es lo que se busca: que funcione solo |
| Que si se acaba la relación, **conserve sus datos** | Sí — la base es suya |
| Que sea **imposible** copiarlo con esfuerzo suficiente | **No.** Se encarece, no se impide |

La última capa —la que de verdad protege— **es el contrato**, no el
servidor. Lo técnico sube el costo de copiarte de "gratis" a "hay que
querer hacerlo". Lo legal es lo que hace que no valga la pena.

---

## La arquitectura

```
   TU MÁQUINA / GITHUB              EL VPS DEL CLIENTE
   ┌──────────────────┐             ┌────────────────────────────┐
   │  Repo privado    │             │  Docker                    │
   │  (solo tuyo)     │             │  ┌──────────────────────┐  │
   │        │         │             │  │ portal:v42           │  │
   │        ▼         │             │  │ (imagen, sin fuentes)│  │
   │  GitHub Actions  │──── push ───┼─▶│                      │  │
   │  compila aquí    │   imagen    │  └──────────────────────┘  │
   │        │         │             │  ┌──────────────────────┐  │
   │        ▼         │             │  │ Caddy (HTTPS)        │  │
   │  GHCR privado    │◀─── pull ───┼──┤                      │  │
   │  (registro tuyo) │  solo lectura│ └──────────────────────┘  │
   └──────────────────┘             │  ┌──────────────────────┐  │
                                    │  │ Postgres  ← DEL      │  │
                                    │  │           CLIENTE    │  │
                                    │  └──────────────────────┘  │
                                    │  /srv/documentos ← suyos   │
                                    └────────────────────────────┘
```

**La idea en una frase:** el código se compila donde tú mandas y al
servidor solo llega el resultado. El servidor nunca ve una línea de
TypeScript.

### Por qué NO Coolify (corrección)

En la conversación anterior recomendé Coolify. **Con este requisito, no
sirve como lo planteé**: Coolify construye desde el repositorio, o sea que
clona tu código en el servidor del cliente. Eso es exactamente lo que se
quiere evitar.

Dos salidas:

1. **Docker Compose + Caddy** (lo que recomiendo). Menos piezas, todo
   explícito, y el servidor solo sabe hacer `pull` de una imagen.
2. **Coolify en modo "Docker Image"** — sí soporta desplegar una imagen ya
   construida desde un registro privado, sin tocar el código. Si prefieres
   su panel para ver logs y reiniciar, es válido. Solo asegúrate de NO
   usar el modo de despliegue desde repositorio.

El resto del documento asume la opción 1.

---

## Las capas de protección, una por una

### 1. El código nunca toca el servidor

Es la capa que más rinde y la más barata.

- El repo sigue siendo **privado y tuyo**.
- **GitHub Actions** compila y publica la imagen en **GHCR**
  (`ghcr.io/tu-usuario/costamallas-portal`), que es privado.
- El servidor tiene un token de **solo lectura** para bajarla.
- En el servidor **no hay** `git`, ni `node_modules`, ni `.ts`, ni el
  `.next` de desarrollo. Solo el resultado compilado.

Si mañana revocas ese token, el servidor **no puede volver a bajar
versiones nuevas**. La que ya tiene sigue corriendo — eso es a propósito:
un interruptor que apague el negocio del cliente por una discusión
comercial es un arma que se dispara sola.

### 2. Compilar sin rastros

Hay que añadir dos cosas al proyecto (**tarea pendiente**, hoy no están):

```ts
// next.config.ts
const nextConfig = {
  // Empaqueta solo lo necesario para correr: sin node_modules completo.
  output: "standalone",
  // Sin mapas de origen. Con ellos, el JavaScript minificado se
  // reconstruye a TypeScript legible con un clic del navegador.
  productionBrowserSourceMaps: false,
  // …lo que ya hay
};
```

Con eso, lo que queda en el servidor es JavaScript minificado. **No es
ilegible** —nadie va a pretender eso— pero reconstruir el proyecto desde
ahí cuesta más que rehacerlo.

> **No recomiendo ofuscadores** (`javascript-obfuscator` y compañía). Con
> Next.js rompen cosas de forma intermitente y difícil de diagnosticar,
> penalizan el rendimiento, y contra alguien decidido solo añaden una
> tarde de trabajo. Cambias una protección real —que no exista el
> fuente— por una molestia.

### 3. Los secretos

Van en un archivo `.env` del servidor que **solo tú creas**, con permisos
`600` y dueño `root`.

Sé honesto sobre el alcance: **el cliente con root puede leerlo.** Lo que
esto evita es el acceso casual —alguien de sistemas del cliente
curioseando— no un ataque deliberado.

Lo que **sí** protege de verdad:

- **Las credenciales que son tuyas, no van al servidor.** El token de
  GHCR es de solo lectura y solo sirve para bajar.
- **Las credenciales del negocio son del cliente** y está bien que las
  tenga: su SMTP, su token de WhatsApp, sus llaves de WooCommerce. Son
  suyas.
- **`ENCRYPTION_KEY` y `JWT_SECRET`**: son de la instalación. Documenta
  cuáles son y entrégalas en el sobre de cierre (ver §Salida digna). Si
  las pierdes tú, no se descifra nada; si se las quedas al irte, dejas al
  cliente con una base ilegible — y eso, además de feo, se pelea.

### 4. La base de datos es del cliente. Punto.

Es la línea que hace que todo lo demás sea defendible.

- Postgres corre en su servidor, con su usuario, y él tiene la clave.
- Los **respaldos son suyos** y automáticos: `pg_dump` diario a
  `/srv/backups`, más el backup del VPS de Hostinger.
- Se le entrega **documentado**: qué tabla es qué, cómo restaurar.

Cuando alguien te pregunte "¿y si ESEK desaparece?", la respuesta es:
*"tus datos están en tu servidor, con tu clave y tu respaldo; lo que
tendrías que reemplazar es el programa, no la información"*. Esa
respuesta es la que cierra ventas, y solo la puedes dar si es verdad.

### 5. Telemetría suave, no interruptor

Un `POST` diario desde el portal a un endpoint tuyo con: versión, nombre
de la instancia, número de usuarios activos.

**Qué hace:** te avisa si aparece una instancia corriendo en un servidor
que no reconoces — que es la señal de que alguien copió la imagen.

**Qué NO hace:** bloquear, degradar ni apagar nada. Si tu servidor está
caído, el portal ni se entera. El usuario fue explícito: *sin afectar para
nada el funcionamiento*, y una licencia que puede fallar y parar una
empresa es un riesgo tuyo, no del cliente: el día que se dispare por
error, la factura de la parada te la reclaman a ti.

### 6. La marca de agua

En el propio código, cadenas únicas por instalación —en un comentario del
bundle, en una constante, en la respuesta de `/api/health`. No protegen
nada por sí solas: sirven para **demostrar el origen** si un día aparece
tu software corriendo donde no debe.

### 7. El contrato — la capa que de verdad protege

Lo técnico sube el costo. Esto es lo que lo hace no valer la pena.
Necesitas, por escrito y firmado:

- **Licencia de USO, no cesión.** El cliente compra el derecho a usar el
  programa en ese servidor, no la propiedad del programa.
- **Prohibición expresa** de copiar, descompilar, revender o desplegar en
  otra infraestructura.
- **Titularidad clara**: el código es de ESEK; los datos son del cliente.
- **Qué pasa al terminar**: cuánto tiempo sigue funcionando, cómo se le
  entregan sus datos, qué se apaga.
- **Penalización** por incumplimiento, con cifra.

> No soy abogado y esto no es asesoría legal. Llévaselo a uno: son dos
> horas de su tiempo y es la parte del plan que más te protege.

---

## Salida digna (escríbela ahora, no cuando haya problema)

Define desde el día uno qué pasa si la relación se acaba. Protege a los
dos y evita que el cliente sienta que está secuestrado — que es
justamente lo que empuja a alguien a copiar el software.

- El cliente se queda con **su base de datos y sus archivos**, exportados.
- El portal sigue funcionando **N meses** con la última versión (sin
  actualizaciones ni soporte).
- Se le entregan `ENCRYPTION_KEY` y `JWT_SECRET` para que sus datos
  cifrados sean legibles por quien venga después.
- **No** se entrega el código fuente.

---

## El plan de migración, paso a paso

### Antes de empezar — lo que hay que preparar

- [ ] **Copiar `ENCRYPTION_KEY` y `JWT_SECRET` EXACTOS de Vercel.**
      ⚠️ Es el error que rompe todo en silencio: con una clave nueva,
      la contraseña del SMTP, el token de WhatsApp y las llaves de
      WooCommerce quedan ilegibles y los correos dejan de salir sin dar
      ningún error.
- [ ] Añadir `output: "standalone"` a `next.config.ts`.
- [ ] Escribir el `Dockerfile` (multi-etapa: compila y descarta).
- [ ] Crear el workflow de GitHub Actions que compila y publica en GHCR.
- [ ] Crear el token de solo lectura de GHCR para el servidor.

### Paso 1 — El servidor

Ubuntu **26.04 LTS**, KVM2 (2 núcleos / 8 GB / 100 GB). Docker soporta
oficialmente 26.04 (*Resolute*); lo verifiqué.

```bash
# Docker, del repositorio oficial
curl -fsSL https://get.docker.com | sh

# Cortafuegos: solo 22, 80 y 443
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Que las actualizaciones de seguridad se instalen solas
apt install -y unattended-upgrades
```

### Paso 2 — Postgres, y que sea del cliente

```bash
mkdir -p /srv/portal /srv/documentos /srv/backups
```

Postgres en Docker, con volumen en `/srv/postgres`. Se le entrega la
contraseña al cliente **por escrito**, con el respaldo diario ya montado.

**Todavía no se migran los datos**: eso es el paso 6, con la app ya
probada apuntando a Supabase.

### Paso 3 — La imagen

En el servidor, `docker login ghcr.io` con el token de solo lectura, y un
`compose.yml` que referencia la imagen **por etiqueta de versión**
(`:v42`), nunca `:latest` — con `latest` no se sabe qué está corriendo ni
se puede volver atrás.

### Paso 4 — HTTPS con Caddy

Caddy delante, que saca y renueva el certificado solo. Dos dominios:

- `portal.costamallas.com`
- `cotizacion.costamallas.com`

⚠️ **El chat de la web carga el widget desde `portal.costamallas.com`.**
Cuando cambies ese DNS, el chat de la tienda apunta al VPS en el mismo
momento. Por eso el DNS va de último.

### Paso 5 — Los crons de verdad

En Vercel había dos, limitados a uno al día, más el reloj de 15 minutos
apañado con GitHub Actions. En el servidor son cron normales y el apaño
desaparece:

```cron
0  6 * * *  curl -sS -H "Authorization: Bearer $CRON_SECRET" https://portal.costamallas.com/api/cron/sync-woo
0 13 * * *  curl -sS -H "Authorization: Bearer $CRON_SECRET" https://portal.costamallas.com/api/cron/diario
*/15 * * * * curl -sS -H "Authorization: Bearer $CRON_SECRET" https://portal.costamallas.com/api/cron/diario?rapido=1
```

*(Verificar los nombres exactos de los parámetros contra
`src/app/api/cron/` antes de ponerlos.)*

### Paso 6 — Probar en paralelo, cortar al final

1. El VPS arriba, apuntando **a la misma base de Supabase**, accesible por
   IP o por un subdominio temporal.
2. Se prueba entero: entrar, cotizar, enviar un correo, el chat, una
   firma.
3. **Solo entonces** se cambia el DNS.
4. Vercel se deja encendido una semana. Si algo sale mal, devuelves el
   DNS y en minutos estás como antes.
5. Con todo estable, se migra la base a Postgres del servidor —o se deja
   en Supabase, que es una decisión aparte.

### Paso 7 — Lo que se desbloquea

- **Documentos de SG-SST** (PENDIENTES §15): escribir el driver `disco`
  que implemente `Almacenamiento`, apuntarlo a `/srv/documentos` y cambiar
  `ALMACENAMIENTO_ACTIVO`. Los registros existentes están marcados con
  `almacenado: false`, así que el portal da **la lista exacta** de qué
  documentos hay que volver a pedir.
- **El reloj de 15 minutos** sin GitHub Actions.
- **El uso comercial**, para este portal. Los otros tres tenants siguen en
  Vercel Hobby y eso no se resuelve aquí.

---

## Lo que este plan NO cubre y hay que decidir

- **¿Se migra Postgres o se queda en Supabase?** Quedarse es más seguro al
  principio: los respaldos ya los hace alguien. Migrar da independencia y
  ahorra la suscripción. Se puede decidir después del paso 6.
- **¿Quién tiene root?** Lo realista es que el cliente lo tenga: es su
  máquina y la paga. Fingir lo contrario da falsa sensación de seguridad y
  además genera fricción el día que necesiten algo y tú no estés.
- **Backup de Hostinger**: contrátalo el día uno. Son unos dólares y es la
  diferencia entre un susto y una tragedia.
- **Los otros tres tenants** (AJP, G2I, Alférez) siguen en Vercel Hobby,
  que prohíbe el uso comercial.

---

## Resumen honesto en cinco líneas

1. El código se compila fuera y al servidor solo llega la imagen.
2. Eso hace **caro** copiarte, no **imposible**. Nadie puede prometer lo
   segundo en una máquina ajena.
3. La base y los archivos son del cliente, de verdad y por escrito.
4. Nada de interruptores que puedan apagarle el negocio.
5. **El contrato es la protección real.** Lo demás sube el precio de
   saltárselo.
