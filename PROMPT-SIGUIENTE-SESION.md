# Lo que sigue — portal de Costamallas

> Escrito al cerrar la sesión del **29 de agosto de 2026**.
> Commit de referencia: `f1ec65d`.

## Antes de empezar

1. `git log --oneline -20` — los commits explican qué se hizo **y por qué**.
2. `CONTEXTO-IA.md` §10.1 (lo construido que no funciona y por qué),
   §10.2 (estado real de los datos, con el delta del 29-ago) y
   **§12 cómo se trabaja en este repo**.
3. `PENDIENTES-GERENCIA.md` — 15 puntos. Los cuatro últimos son nuevos.
4. Los `scripts/probar-*.ts` son la red de seguridad. **Córrelos antes y
   después de tocar lo suyo.** Hoy hay nueve y todos pasan.

---

## Lo único que quedó a medias

### Fase 7 — Nexus móvil

**Estado: los mockups están hechos y esperan visto bueno.** No se programó
nada, y así se pidió: "Enséñamelos y espera mi visto bueno para esta fase".

Lo que los mockups proponen y hay que confirmar antes de programar:

- El teléfono abre en Nexus. Barra inferior con Chats · Cotizar · Clientes ·
  Más; el resto de módulos cuelga de **Más**. Solo por debajo de 768 px.
- Las tres líneas de WhatsApp son **filtros** arriba, no tres bandejas. Las
  que no existen salen punteadas con el motivo ("falta Meta") en vez de
  esconderse.
- **`@mallita` contesta hacia adentro**, como nota interna violeta. El
  vendedor decide qué copiar. Debajo va lo que costó y el cupo del día.
- **`/`** abre comandos que son puentes al resto del portal sin salir del
  chat: `/cotizar` abre el cotizador con el cliente puesto, `/cliente`
  guarda en el CRM a quien escribe.
- Tres temas de fondo, **solo en móvil**.
- Se quita «resolver» y lo que solo le sirve al administrador. El canal de
  **WordPress y el de correo se unen**.

Ya está hecho, de la parte de escritorio de esa fase: **el menú lateral se
pliega** y lo recuerda entre visitas.

---

## Lo que está construido y espera un dato de gerencia

| Qué | Qué falta | Punto en PENDIENTES |
|-----|-----------|---------------------|
| Todos los correos | Cargar SMTP **desde el portal en producción** | — |
| WhatsApp y las 3 líneas | Aprobación de Meta | — |
| Botón del catálogo en los correos | Subir el PDF y pegar la dirección | 12 |
| El reloj de 15 min | El secreto `CRON_SECRET` en GitHub | **13** ⚠️ dos minutos |
| Cupo diario de `@mallita` | Decidir el número | 14 |
| Guardar documentos SG-SST | Almacenamiento privado (VPS) | 15 |
| Recargos por ciudad | Hay 0 cargados | 7 |
| Plazos de pago | Confirmación | 1 |
| Facturación DIAN | Elegir proveedor | — |
| Vercel Pro (o el VPS) | Decisión | — |

El **13** es el más barato de todos y desbloquea la automatización entera.

---

## Cosas que quedaron a la vista y valdría la pena mirar

- **113 productos sin ninguna foto.** Es la causa real de que falten
  miniaturas en las cotizaciones: 13 de los 19 ítems sin foto apuntan a
  productos que no tienen ninguna. El código ya hace todo lo que puede.
- **171 productos sin SEO** y el generador masivo nunca se ha lanzado.
  Cuesta unos US$ 2 el catálogo entero.
- **El embudo** se puede mejorar con más gráficas y reportes por vendedor.
  Estaba en la Fase 5 y se dejó como estaba: el tablero comercial nuevo se
  llevó el esfuerzo.
- **La encuesta de satisfacción a las 24 h de completado**: la plantilla de
  correo existe, falta engancharla a la corrida diaria cuando un pedido
  pasa a entregado.
- **El correo de visita agendada** también tiene plantilla y falta
  engancharlo al momento en que producción fija la fecha.

---

## Trampas nuevas (están en §12, pero por si acaso)

- **El widget del chat emite JavaScript desde un template literal**: las
  barras invertidas van **dobles**. Una `\s` sola llega al navegador como
  la letra "s".
- **Los heredocs de Bash se comen las barras invertidas** en este entorno,
  y `node -e "…"` con una clase de caracteres revienta. Para parchear:
  escribir el script de Node **a un archivo** y ejecutarlo.
- **El Sidebar ya está normalizado** a CRLF. Se puede editar con
  normalidad; sigue valiendo comprobar `git diff --stat`.
