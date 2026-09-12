// ============================================================
// GET/POST /api/cron/diario — la corrida diaria del portal
// ------------------------------------------------------------
// Hace nueve cosas:
//   1. Vencer lo que caducó (cotizaciones y facturas).
//   2. El seguimiento post-cotización.
//   3. Avisar de las conversaciones que pasaron del compromiso de
//      respuesta sin que nadie las contestara.
//   4. Recalcular el estado de los clientes. Los demás estados se
//      recalculan solos cuando pasa algo; INACTIVO no tiene evento que
//      lo dispare —es la ausencia de eventos— así que sin esta pasada
//      nadie pasaría a inactivo nunca.
//
// El orden de las dos primeras es a propósito: primero se vence y
// después se hace el seguimiento, para no perseguir una oferta que ya
// caducó esta misma madrugada.
//
// La tercera va al final porque no depende de las otras y porque, si
// algo se cae, es lo que menos duele perder: la notificación del portal
// queda igual y la pantalla /nexus/tiempos sigue mostrando el dato.
//
// Existe como ruta "diaria" y no como "/api/cron/seguimiento" por una
// limitación concreta del plan: **Vercel Hobby permite 2 crons y solo
// frecuencia diaria**. Ya hay uno (sync-woo), así que este es el último
// cupo. Todo lo demás que haya que correr una vez al día tiene que
// entrar aquí dentro, no como un cron nuevo.
//
// Un cron más frecuente que diario no falla suave: rompe el deploy
// entero y el auto-deploy se cae en silencio.
//
// La ejecuta Vercel Cron con `Authorization: Bearer <CRON_SECRET>`, y
// también puede dispararla un administrador desde el portal.
//
// ?dry=1 → dice qué haría, sin mandar ni escribir nada.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { correrSeguimientos } from "@/lib/seguimiento";
import { marcarVencidos } from "@/lib/vencimientos";
import { alertarSinRespuesta } from "@/lib/nexus/alertas";
import { recalcularEstados } from "@/lib/estados-cliente-server";
import { limpiar } from "@/lib/mantenimiento";
import { avisarAgendados, mandarEncuestasPendientes } from "@/lib/avisos-operacion";
import { cerrarChatsDormidos } from "@/lib/nexus/cierre-automatico";
import { sincronizarServiciosComoProductos } from "@/lib/servicios-productos";
import {
  apuntarLatido, avisarBorradoresParados, repartirClientesSinAsesor,
  avisarClientesEnfriandose, resumenSemanal,
} from "@/lib/automatizaciones";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function autorizado(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true; // Vercel Cron
  const user = await getUserFromRequest(req); // disparo manual desde el portal
  return !!user && (user.rol === "ADMIN" || user.rol === "SUPERADMIN");
}

async function handle(req: NextRequest) {
  if (!(await autorizado(req))) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const inicio = Date.now();

  try {
    // Primero vencer, después perseguir: si no, el seguimiento le manda
    // el "su oferta vence mañana" a una que caducó anoche.
    const vencimientos = await marcarVencidos({ dry });
    const seguimiento = await correrSeguimientos({ dry });

    // ⚠️ Al correr una vez al día, el aviso llega en la corrida
    // siguiente y no al minuto 61. Para un compromiso de una hora eso
    // es tarde, y no se arregla desde el código: hace falta el plan Pro
    // o un disparador externo. Lo que resuelve hoy es que nadie se
    // entere NUNCA, que era lo que pasaba.
    const tiemposNexus = await alertarSinRespuesta({ dry });

    // El estado del cliente se recalcula solo cuando pasa algo (se
    // cotiza, se aprueba). El paso a INACTIVO es el único que NO tiene
    // evento que lo dispare —es la ausencia de eventos— así que sin esta
    // pasada diaria nadie pasaría a inactivo nunca. Va al final: usa las
    // cotizaciones que acaban de vencer más arriba.
    const estadosCliente = await recalcularEstados({ dry });

    // ── Las de abajo son "extras": útiles, pero ninguna es motivo para
    // perder lo de arriba. Cada una con su propio try, y el resultado
    // dice si falló en vez de callarlo.
    const extra = async <T>(nombre: string, fn: () => Promise<T>) => {
      try { return await fn(); }
      catch (e) {
        console.error(`[cron/diario] ${nombre}`, e);
        return { error: e instanceof Error ? e.message : String(e) };
      }
    };

    // Higiene: tokens vencidos, notificaciones leídas viejas y logs de
    // hace más de un año.
    const limpieza = await extra("limpieza", () => limpiar({ dry }));

    // Un borrador no dispara nada: el reloj arranca al ENVIAR. Así que
    // uno olvidado es trabajo hecho que nunca existió para el cliente.
    const borradores = await extra("borradores", () => avisarBorradoresParados({ dry }));

    // Un cliente sin asesor no está en el pipeline de nadie.
    const reparto = await extra("reparto", () => repartirClientesSinAsesor({ dry }));

    // Aviso un mes ANTES de que pase a inactivo, que es cuando todavía
    // se puede hacer algo.
    const enfriandose = await extra("enfriandose", () => avisarClientesEnfriandose({ dry }));

    // Confirmarle al cliente la fecha de su visita o instalación.
    // Antes de esto se enteraba por WhatsApp si el asesor se acordaba, y
    // cuando no, el técnico llegaba a una casa donde no había nadie.
    const agendados = await extra("agendados", () => avisarAgendados({ dry }));

    // La encuesta, 24 h después de firmar la entrega. La plantilla y la
    // pantalla de resultados llevaban meses escritas sin que nadie
    // disparara el correo: se estaba midiendo el vacío.
    const encuestas = await extra("encuestas", () => mandarEncuestasPendientes({ dry }));

    // Cerrar los chats de la web que quedaron abiertos. No es limpieza
    // de bandeja: al cerrar es cuando al cliente le llega la copia de la
    // conversación, así que uno que nadie cierra nunca se la manda.
    const chatsWeb = await extra("chatsWeb", () => cerrarChatsDormidos({ dry }));

    // Los servicios de instalación, como productos buscables. Se
    // regenera al guardar un servicio; esta pasada diaria es la red por
    // si alguien tocó la tabla por fuera o un guardado falló. Son 14
    // filas: cuesta menos que comprobar si hace falta.
    const serviciosProducto = dry ? { omitido: "ensayo" } : await extra("servicios", () => sincronizarServiciosComoProductos());

    // Solo los lunes; los otros días se sale solo.
    const semanal = await extra("semanal", () => resumenSemanal({ dry }));

    // El latido va AL FINAL y solo si no es una prueba en seco: es lo
    // que mira el vigilante para saber que la corrida llegó hasta aquí.
    // Sellarlo al principio diría "corrí bien" aunque se cayera a mitad.
    if (!dry) await apuntarLatido();

    return NextResponse.json({
      success: true,
      data: {
        dryRun: dry,
        duracionMs: Date.now() - inicio,
        vencimientos,
        seguimiento,
        tiemposNexus,
        estadosCliente,
        limpieza,
        borradores,
        reparto,
        enfriandose,
        agendados,
        encuestas,
        chatsWeb,
        serviciosProducto,
        semanal,
      },
    });
  } catch (err) {
    console.error("[cron/diario]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error en la corrida diaria" },
      { status: 500 },
    );
  }
}

export const GET = handle;  // Vercel Cron
export const POST = handle; // botón del portal
