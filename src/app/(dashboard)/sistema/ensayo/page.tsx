"use client";

// ============================================================
// Ensayo general.
//
// Recorre el proceso completo con datos de prueba para poder responder
// la pregunta que hoy no se puede responder sin arriesgar un cliente
// real: ¿los correos salen?
//
// Cada paso dice lo que PASÓ, no lo que debería pasar. Si el servidor de
// correo rechaza el mensaje, el paso sale en rojo con el error tal cual
// —que es exactamente lo que se está tratando de averiguar— en vez de un
// "no se pudo enviar" que no ayuda a nadie.
// ============================================================

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Play, Check, X, Loader2, Trash2, Mail, AlertTriangle, ExternalLink, FlaskConical,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";

interface Paso { clave: string; titulo: string; que: string; correo?: string }
interface Resultado {
  clave: string; ok: boolean; mensaje: string; error?: string; enlace?: string;
}
interface Estado {
  pasos: Paso[];
  cliente: { id: string; nombre: string; email: string | null; createdAt: string } | null;
  cotizaciones: number;
  pedidos: number;
  hayCorreo: boolean;
}

function EnsayoContent() {
  const qc = useQueryClient();
  const [correo, setCorreo] = useState("");
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [limpiando, setLimpiando] = useState(false);

  const { data, isLoading } = useQuery<Estado>({
    queryKey: ["ensayo"],
    queryFn: async () => {
      const res = await fetch("/api/sistema/ensayo");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const correoValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim());

  const correr = async (clave: string) => {
    if (!correoValido) return toast.error("Escribe primero el correo donde quieres recibirlo todo.");
    setCorriendo(clave);
    try {
      const res = await fetch("/api/sistema/ensayo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paso: clave, correo: correo.trim() }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error ?? "Falló"); return; }
      setResultados(r => ({ ...r, [clave]: json.data }));
      if (json.data.ok) toast.success(json.data.mensaje.slice(0, 80));
      else toast.error(json.data.error ?? json.data.mensaje, { duration: 9000 });
      qc.invalidateQueries({ queryKey: ["ensayo"] });
    } catch { toast.error("Error de conexión"); }
    finally { setCorriendo(null); }
  };

  const limpiar = async () => {
    if (!confirm("Se borra el cliente del ensayo, sus cotizaciones de prueba, pedidos e instalaciones. ¿Sigo?")) return;
    setLimpiando(true);
    try {
      const res = await fetch("/api/sistema/ensayo", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { toast.error(json.error ?? "Falló"); return; }
      const d = json.data;
      toast.success(`Borrado: ${d.clientes} cliente(s), ${d.cotizaciones} cotización(es), ${d.pedidos} pedido(s), ${d.instalaciones} instalación(es).`);
      setResultados({});
      qc.invalidateQueries({ queryKey: ["ensayo"] });
    } catch { toast.error("Error de conexión"); }
    finally { setLimpiando(false); }
  };

  return (
    <>
      <Topbar
        title="Ensayo general"
        actions={
          <button onClick={limpiar} disabled={limpiando} className="btn-secondary btn-sm text-red-500 disabled:opacity-50">
            {limpiando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            <span className="hidden sm:inline">Borrar lo del ensayo</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--brand-color-10)" }}>
                <FlaskConical size={19} style={{ color: "var(--brand-color)" }} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                  Recorre el proceso completo con datos de prueba
                </p>
                <p className="text-[12px] text-muted mt-1 leading-relaxed">
                  Usa las mismas funciones que el portal en producción — no una copia — así que lo
                  que veas aquí es lo que le pasa a un cliente de verdad. Todo queda marcado como
                  prueba: fuera de informes, del embudo y del consecutivo real.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Correo donde quieres recibirlo todo
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    value={correo}
                    onChange={e => setCorreo(e.target.value)}
                    placeholder="tu@correo.com"
                    className="input pl-9"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted mt-1.5">
                Es el correo del cliente de prueba. Todos los mensajes van ahí y a ningún otro sitio.
              </p>
            </div>

            {data && !data.hayCorreo && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-[11.5px] text-red-700 dark:text-red-300">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  El correo no está configurado, así que los pasos que mandan mensajes van a fallar.
                  Cárgalo en <Link href="/configuracion?tab=correo" className="underline">Configuración → Correo</Link>.
                </p>
              </div>
            )}

            {data?.cliente && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl surface-2 text-[11.5px]">
                <span className="text-muted">Ensayo en curso:</span>
                <Link href={`/crm/clientes/${data.cliente.id}`} className="font-semibold text-soft hover:underline truncate">
                  {data.cliente.nombre}
                </Link>
                <span className="text-muted ml-auto flex-shrink-0">
                  {data.cotizaciones} cot · {data.pedidos} ped
                </span>
              </div>
            )}
          </div>

          {isLoading || !data ? (
            <div className="card p-10 text-center"><Loader2 size={20} className="animate-spin mx-auto text-muted" /></div>
          ) : (
            <div className="card overflow-hidden">
              {data.pasos.map((p, i) => {
                const r = resultados[p.clave];
                const activo = corriendo === p.clave;
                return (
                  <div key={p.clave} className="flex items-start gap-3 px-4 py-4 border-b divider last:border-0">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-bold mt-0.5"
                      style={
                        r?.ok ? { backgroundColor: "#dcfce7", color: "#16a34a" }
                        : r ? { backgroundColor: "#fee2e2", color: "#dc2626" }
                        : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }
                      }
                    >
                      {r?.ok ? <Check size={14} /> : r ? <X size={14} /> : i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{p.titulo}</p>
                      <p className="text-[11.5px] text-muted mt-0.5">{p.que}</p>
                      {p.correo && (
                        <p className="text-[10.5px] text-muted mt-1 inline-flex items-center gap-1">
                          <Mail size={10} /> Correo: {p.correo}
                        </p>
                      )}

                      {r && (
                        <div className="mt-2">
                          <p className={`text-[12px] ${r.ok ? "text-emerald-600" : "text-red-600"}`}>
                            {r.mensaje}
                          </p>
                          {r.error && (
                            <p className="mt-1 text-[11px] font-mono bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg px-2 py-1.5 break-words">
                              {r.error}
                            </p>
                          )}
                          {r.enlace && (
                            <a href={r.enlace} target={r.enlace.startsWith("http") ? "_blank" : undefined}
                              rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
                              style={{ color: "var(--brand-color)" }}>
                              Ver lo que quedó <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => correr(p.clave)}
                      disabled={activo || !correoValido}
                      className="btn-secondary btn-sm flex-shrink-0 disabled:opacity-40"
                    >
                      {activo ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      {r ? "Repetir" : "Correr"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted leading-relaxed px-1">
            Los pasos van en orden: cada uno usa lo que dejó el anterior. Al terminar, «Borrar lo del
            ensayo» deja la base como estaba — se lleva el cliente, sus cotizaciones de prueba, los
            pedidos, las instalaciones y las conversaciones.
          </p>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><EnsayoContent /></Suspense>;
}
