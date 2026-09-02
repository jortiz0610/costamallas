"use client";

// ============================================================
// El interruptor de la huella, y el botón para entrar con ella.
//
// Dos piezas que van juntas porque comparten la parte delicada: saber si
// este aparato PUEDE. No basta con que exista `navigator.credentials` —
// eso está en todos los navegadores modernos—; hay que preguntarle al
// aparato si tiene un sensor propio disponible. Un botón de "entrar con
// huella" en un computador de escritorio sin lector es un botón que
// falla, y un botón que falla se deja de usar aunque luego funcione.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, Check, Trash2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

/** ¿Este aparato tiene sensor propio (huella, cara o PIN)? */
export async function hayHuellaDisponible(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  // WebAuthn exige https. En http el navegador ni lo intenta y el error
  // que devuelve no dice nada de eso.
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

interface Credencial {
  id: string;
  apodo: string | null;
  ultimoUsoEn: string | null;
  createdAt: string;
}

/** El panel de "Mi cuenta": activar, ver y quitar. */
export function GestionHuella() {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [lista, setLista] = useState<Credencial[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/huella");
      const j = await r.json();
      if (j.success) setLista(j.data ?? []);
    } catch { /* sin conexión: se queda la lista que había */ }
  }, []);

  useEffect(() => {
    void hayHuellaDisponible().then(setDisponible);
    void cargar();
  }, [cargar]);

  const activar = async () => {
    setOcupado(true);
    try {
      const r = await fetch("/api/auth/huella/registrar");
      const j = await r.json();
      if (!j.success) { toast.error(j.error ?? "No se pudo empezar"); return; }

      const respuesta = await startRegistration({ optionsJSON: j.data });

      const g = await fetch("/api/auth/huella/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(respuesta),
      });
      const jg = await g.json();
      if (!jg.success) { toast.error(jg.error ?? "No se pudo guardar"); return; }

      toast.success("Listo. La próxima vez entras con tu huella.");
      void cargar();
    } catch (e) {
      // Cancelar no es un error: es lo que pasa cuando alguien lo piensa
      // mejor y quita el dedo. Decirle "falló" lo deja creyendo que el
      // sistema está roto.
      const nombre = (e as { name?: string })?.name ?? "";
      if (nombre === "NotAllowedError") toast("Cancelado", { icon: "👍" });
      else toast.error(`No se pudo activar (${nombre || "motivo desconocido"})`);
    } finally { setOcupado(false); }
  };

  const quitar = async (id: string) => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/auth/huella/registrar?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) { toast.error("No se pudo quitar"); return; }
      toast.success("Quitada de este portal");
      void cargar();
    } finally { setOcupado(false); }
  };

  if (disponible === null) return null;

  if (!disponible) {
    return (
      <p className="text-[12.5px] text-muted leading-relaxed">
        Este equipo no tiene lector de huella ni Face ID disponible para el navegador.
        En el teléfono sí funciona: instala la app y actívalo desde ahí.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lista.length > 0 ? (
        <>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-green-600">
            <Check size={14} /> Activada en {lista.length === 1 ? "un dispositivo" : `${lista.length} dispositivos`}
          </p>
          <div className="space-y-1.5">
            {lista.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 p-2.5 rounded-xl surface-2">
                <Fingerprint size={15} className="text-muted flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-semibold text-soft truncate">
                    {c.apodo ?? "Dispositivo"}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {c.ultimoUsoEn
                      ? `Usada el ${new Date(c.ultimoUsoEn).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}`
                      : "Sin usar todavía"}
                  </span>
                </span>
                <button
                  onClick={() => quitar(c.id)}
                  disabled={ocupado}
                  aria-label="Quitar"
                  className="p-2 text-muted hover:text-red-500 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12.5px] text-muted leading-relaxed">
          Para entrar sin escribir la contraseña cada vez. Tu huella no sale de este
          dispositivo: el portal solo guarda una llave que sin él no sirve.
        </p>
      )}

      <button onClick={activar} disabled={ocupado} className="btn-primary btn-sm">
        {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Fingerprint size={13} />}
        {lista.length ? "Activar en este dispositivo también" : "Activar la huella"}
      </button>

      <p className="flex items-start gap-1.5 text-[11.5px] text-muted leading-relaxed">
        <ShieldCheck size={12} className="flex-shrink-0 mt-0.5" />
        <span>
          No reemplaza la verificación en dos pasos: la huella solo se puede activar desde
          una sesión que ya la pasó, en este mismo aparato.
        </span>
      </p>
    </div>
  );
}

/** El botón de la pantalla de entrada. */
export function EntrarConHuella({ onEntrado }: { onEntrado: () => void }) {
  const [disponible, setDisponible] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { void hayHuellaDisponible().then(setDisponible); }, []);
  if (!disponible) return null;

  const entrar = async () => {
    setOcupado(true);
    try {
      const r = await fetch("/api/auth/huella/entrar");
      const j = await r.json();
      if (!j.success) { toast.error(j.error ?? "No se pudo empezar"); return; }

      const respuesta = await startAuthentication({ optionsJSON: j.data });

      const g = await fetch("/api/auth/huella/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(respuesta),
      });
      const jg = await g.json();
      if (!jg.success) { toast.error(jg.error ?? "No se pudo entrar"); return; }

      onEntrado();
    } catch (e) {
      const nombre = (e as { name?: string })?.name ?? "";
      // Sin credencial en el aparato, el navegador también lanza
      // NotAllowedError. Se dice lo que hay que hacer en vez de "error".
      if (nombre === "NotAllowedError") {
        toast("Entra con tu contraseña y actívala en Configuración → Mi cuenta.", { duration: 7000 });
      } else {
        toast.error(`No se pudo (${nombre || "motivo desconocido"})`);
      }
    } finally { setOcupado(false); }
  };

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={ocupado}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border divider text-[14px] font-semibold text-soft transition-all hover:surface-2 disabled:opacity-50"
    >
      {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={17} />}
      Entrar con huella
    </button>
  );
}
