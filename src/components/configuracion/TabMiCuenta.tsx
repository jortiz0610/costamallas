"use client";

// ============================================================
// Lo que puede tocar CUALQUIERA en Configuración.
//
// Antes, un vendedor que entraba a Configuración veía dieciocho pestañas
// del negocio —SMTP, consecutivos, reglas comerciales, conexiones— y no
// podía cambiar ninguna: se topaba con un 403 o, peor, cambiaba algo que
// no le correspondía. Un menú lleno de puertas cerradas es peor que un
// menú corto.
//
// Ahora quien no administra ve dos cosas, y las dos son suyas: sus datos
// y cómo instalar la app en su teléfono.
// ============================================================

import { useEffect, useState } from "react";
import {
  User, Shield, Smartphone, Share, PlusSquare, Bell, Check, Loader2, LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { GestionHuella } from "@/components/seguridad/Huella";
import { estadoAvisos, pedirPermisoAvisos } from "@/lib/nexus-preferencias";
import { suscribirEsteAparato, darDeBajaEsteAparato, yaSuscrito, pushSoportado } from "@/lib/push-navegador";

const NOMBRE_ROL: Record<string, string> = {
  SUPERADMIN: "Superadministrador",
  ADMIN: "Administrador",
  MARKETING: "Marketing",
  VENDEDOR: "Asesor comercial",
  PRODUCCION: "Producción",
  CLIENTE: "Cliente",
};

function Bloque({ titulo, icono, children }: {
  titulo: string; icono: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        {icono}
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{titulo}</p>
      </div>
      {children}
    </div>
  );
}

export function TabMiCuenta() {
  const { user, logout } = useAuth();
  const [permiso, setPermiso] = useState<string>("no-disponible");
  const [pidiendo, setPidiendo] = useState(false);
  // Suscripcion push: es lo que hace que el aviso llegue con el portal
  // CERRADO. El permiso de arriba solo cubre "pestana abierta o en
  // segundo plano", y confundir las dos cosas es prometer de mas.
  const [conPush, setConPush] = useState(false);
  const [cambiandoPush, setCambiandoPush] = useState(false);

  // El estado del permiso solo existe en el navegador.
  useEffect(() => { setPermiso(estadoAvisos()); }, []);
  useEffect(() => { yaSuscrito().then(setConPush); }, []);

  // Distinguir iPhone importa: allí no existe "instalar app", existe
  // "añadir a pantalla de inicio", y solo desde Safari. Decirle a alguien
  // con iPhone que busque un botón de instalar es mandarlo a buscar algo
  // que no está.
  const [esIOS, setEsIOS] = useState(false);
  const [yaInstalada, setYaInstalada] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setEsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setYaInstalada(window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true);
  }, []);

  const activarAvisos = async () => {
    setPidiendo(true);
    const r = await pedirPermisoAvisos();
    setPermiso(r);
    if (r === "granted") {
      // Con el permiso recien dado se suscribe el aparato en el mismo
      // gesto: pedirle a alguien que pulse DOS botones seguidos para
      // una sola cosa es como se queda a medias.
      const p = await suscribirEsteAparato();
      setConPush(p === "listo");
      toast.success(p === "listo"
        ? "Listo: te avisamos aunque tengas el portal cerrado"
        : "Avisos activados en esta pestaña");
    }
    else if (r === "denied") {
      toast.error("El navegador los bloqueó. Hay que permitirlos desde el candado de la barra de direcciones.", { duration: 9000 });
    }
    setPidiendo(false);
  };

  return (
    <div className="max-w-2xl space-y-4">

      <Bloque titulo="Quién eres" icono={<User size={13} className="text-muted" />}>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Nombre</span>
            <span className="text-[13.5px] font-semibold text-soft text-right">{user?.nombre ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Correo</span>
            <span className="text-[13.5px] text-soft text-right break-all">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Rol</span>
            <span className="text-[13.5px] font-semibold text-soft">
              {NOMBRE_ROL[user?.rol ?? ""] ?? user?.rol ?? "—"}
            </span>
          </div>
        </div>
        <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
          Estos datos los cambia un administrador. Si algo está mal, pídeselo: aquí no se pueden
          editar a propósito, porque el rol decide a qué tienes acceso.
        </p>
      </Bloque>

      <Bloque titulo="Avisos de mensajes" icono={<Bell size={13} className="text-muted" />}>
        {permiso === "no-disponible" ? (
          <p className="text-[12.5px] text-muted leading-relaxed">
            Este navegador no admite avisos. En el teléfono, instala la app (abajo) y sí funcionan.
          </p>
        ) : permiso === "granted" ? (
          <>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-green-600">
              <Check size={14} />
              {conPush
                ? "Activados. Te llegan aunque tengas el portal cerrado."
                : "Activados, pero solo con el portal abierto."}
            </p>

            {/* La diferencia entre las dos cosas se dice, no se insinúa:
                un aviso que la gente cree que le va a llegar y no llega
                es peor que no tener avisos. */}
            {conPush ? (
              <>
                <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
                  Este aparato está suscrito. Si usas también el computador de la oficina, actívalos
                  allí por separado: la suscripción es de cada navegador, no de tu cuenta.
                </p>
                <button
                  onClick={async () => {
                    setCambiandoPush(true);
                    const ok = await darDeBajaEsteAparato();
                    if (ok) { setConPush(false); toast.success("Este aparato ya no recibe avisos"); }
                    else toast.error("No se pudo dar de baja");
                    setCambiandoPush(false);
                  }}
                  disabled={cambiandoPush}
                  className="btn-secondary btn-sm mt-3"
                >
                  {cambiandoPush ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
                  No avisar en este aparato
                </button>
              </>
            ) : pushSoportado() ? (
              <>
                <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
                  Ahora mismo solo te avisamos si tienes el portal abierto o en segundo plano. Para
                  que te lleguen <strong>con el portal cerrado</strong> —como un WhatsApp— hay que
                  suscribir este aparato.
                </p>
                <button
                  onClick={async () => {
                    setCambiandoPush(true);
                    const r = await suscribirEsteAparato();
                    setConPush(r === "listo");
                    if (r === "listo") toast.success("Listo: te avisamos aunque cierres el portal");
                    else if (r === "no-configurado") toast.error("Este servidor todavía no tiene los avisos configurados.", { duration: 8000 });
                    else toast.error("No se pudo suscribir este aparato");
                    setCambiandoPush(false);
                  }}
                  disabled={cambiandoPush}
                  className="btn-primary btn-sm mt-3"
                >
                  {cambiandoPush ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
                  Avisarme con el portal cerrado
                </button>
              </>
            ) : (
              <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
                Este navegador no admite avisos con el portal cerrado. En iPhone hace falta
                <strong> añadir la app a la pantalla de inicio</strong> (abajo) y abrirla desde ahí.
              </p>
            )}
          </>
        ) : permiso === "denied" ? (
          <p className="text-[12.5px] text-muted leading-relaxed">
            Los bloqueaste. Para volver a activarlos hay que tocar el <strong>candado</strong> de la barra
            de direcciones → Notificaciones → Permitir. Desde aquí ya no se puede volver a preguntar.
          </p>
        ) : (
          <>
            <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
              Para enterarte de un mensaje nuevo sin tener que mirar la pestaña.
            </p>
            <button onClick={activarAvisos} disabled={pidiendo} className="btn-primary btn-sm">
              {pidiendo ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />} Activar
            </button>
          </>
        )}
      </Bloque>

      <Bloque titulo="La app en tu teléfono" icono={<Smartphone size={13} className="text-muted" />}>
        {yaInstalada ? (
          <p className="flex items-center gap-2 text-[13px] font-semibold text-green-600">
            <Check size={14} /> Ya la estás usando instalada.
          </p>
        ) : esIOS ? (
          <ol className="space-y-2.5 text-[13px] text-soft">
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">1.</span>
              <span>Abre este portal en <strong>Safari</strong>. Desde Chrome en iPhone no se puede.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">2.</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                Toca <Share size={14} className="inline" /> <strong>Compartir</strong>, abajo en el centro.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">3.</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                Baja y elige <PlusSquare size={14} className="inline" /> <strong>Añadir a pantalla de inicio</strong>.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">4.</span>
              <span>Toca <strong>Añadir</strong>. Queda como una app más, sin la barra del navegador.</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2.5 text-[13px] text-soft">
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">1.</span>
              <span>Abre este portal en <strong>Chrome</strong>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">2.</span>
              <span>Toca los <strong>tres puntos</strong> de arriba a la derecha.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-muted flex-shrink-0">3.</span>
              <span>Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</span>
            </li>
          </ol>
        )}
        <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
          Instalada abre más rápido, ocupa toda la pantalla y los avisos se ven como los de
          cualquier otra app.
        </p>
      </Bloque>

      <Bloque titulo="Seguridad" icono={<Shield size={13} className="text-muted" />}>
        <div className="mb-4">
          <GestionHuella />
        </div>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          La contraseña y la verificación en dos pasos se manejan desde tu perfil de usuario.
          Si necesitas restablecerla, pídeselo a un administrador.
        </p>
        <button onClick={logout} className="btn-secondary btn-sm">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </Bloque>
    </div>
  );
}
