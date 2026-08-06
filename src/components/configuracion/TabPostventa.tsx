"use client";

// ============================================================
// Postventa: las políticas que se publican en /politicas y el QR de la
// encuesta de satisfacción.
//
// Los textos vienen transcritos de los documentos oficiales de la
// empresa. Se pueden editar, pero el botón para volver al original está
// a mano: nadie quiere reescribir una política legal desde cero porque
// se le fue un borrado.
// ============================================================

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Star, ExternalLink, AlertTriangle, RotateCcw, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface ConfigPostventa {
  urlResena: string; encuestaTitulo: string; encuestaTexto: string; horario: string;
  politicaEnvios: string; politicaDevoluciones: string; politicaDatos: string;
}

interface Respuesta { data: ConfigPostventa; defaults: ConfigPostventa; faltan: string[] }

export function TabPostventa() {
  const [cfg, setCfg] = useState<ConfigPostventa | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, refetch } = useQuery<Respuesta>({
    queryKey: ["config-postventa"],
    queryFn: async () => (await (await fetch("/api/configuracion/postventa")).json()),
  });

  useEffect(() => { if (data?.data) setCfg(data.data); }, [data]);

  const set = <K extends keyof ConfigPostventa>(k: K, v: ConfigPostventa[K]) =>
    setCfg(p => (p ? { ...p, [k]: v } : p));

  const restaurar = (k: keyof ConfigPostventa) => {
    if (!data?.defaults) return;
    if (!confirm("¿Volver al texto del documento original? Se pierde lo que hayas escrito aquí.")) return;
    set(k, data.defaults[k]);
  };

  const guardar = async () => {
    if (!cfg) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/postventa", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Postventa guardada");
      refetch();
    } finally { setGuardando(false); }
  };

  if (isLoading || !cfg) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  const faltan = data?.faltan ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <Star size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Postventa</h2>
          <p className="text-xs text-muted mt-0.5">
            Las políticas que ve el cliente y el código de la encuesta de satisfacción.
          </p>
        </div>
        <Link href="/politicas" target="_blank" className="btn-secondary btn-sm flex-shrink-0">
          <ExternalLink size={13} /> Ver publicadas
        </Link>
      </div>

      {/* Encuesta / reseña */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
          <QrCode size={12} /> Encuesta de satisfacción
        </p>

        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
            Enlace de reseñas de Google
          </label>
          <input className="input" value={cfg.urlResena} onChange={e => set("urlResena", e.target.value)}
            placeholder="https://g.page/r/…/review" />
          {cfg.urlResena ? (
            <p className="text-[11px] text-muted mt-1.5">
              El QR ya se puede imprimir desde <Link href="/postventa" className="font-semibold" style={{ color: "var(--brand-color)" }}>Postventa</Link>.
            </p>
          ) : (
            <div className="flex items-start gap-1.5 text-[11px] mt-2 p-2.5 rounded-lg text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Sin este enlace no se genera el QR. Se saca del perfil de negocio de Google: Buscar tu empresa →
                &quot;Pedir reseñas&quot; → copiar el enlace corto. No se pone uno inventado: un QR impreso que no lleva a
                ninguna parte ya no se puede corregir.
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Título de la tarjeta</label>
            <input className="input" value={cfg.encuestaTitulo} onChange={e => set("encuestaTitulo", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Horario de atención</label>
            <input className="input" value={cfg.horario} onChange={e => set("horario", e.target.value)}
              placeholder="Lunes a viernes 8:00 a.m. – 5:00 p.m." />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Texto de la tarjeta</label>
          <textarea className="input resize-none text-xs leading-relaxed" rows={3} value={cfg.encuestaTexto}
            onChange={e => set("encuestaTexto", e.target.value)} />
        </div>
      </div>

      {faltan.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Las políticas publicadas van a salir con huecos: falta {faltan.join(", ")}. El correo y el teléfono se cargan
            en la pestaña Empresa; el horario, aquí arriba. Los documentos originales tampoco los traían.
          </span>
        </div>
      )}

      {/* Políticas */}
      <Politica
        titulo="Política de envíos y entrega"
        nota="⚠️ No existe un .docx de envíos. Este texto está armado con las condiciones REALES de la cotización de SIIGO (sitio y tiempo de entrega). Gerencia tiene que confirmarlo."
        valor={cfg.politicaEnvios} set={v => set("politicaEnvios", v)} restaurar={() => restaurar("politicaEnvios")}
      />
      <Politica
        titulo="Política de devoluciones y reembolsos"
        nota="Transcrita del documento oficial, vigente desde el 12 de abril de 2025."
        valor={cfg.politicaDevoluciones} set={v => set("politicaDevoluciones", v)} restaurar={() => restaurar("politicaDevoluciones")}
      />
      <Politica
        titulo="Política de tratamiento de la información"
        nota="Transcrita del documento oficial (Ley 1581 de 2012), vigente desde el 12 de abril de 2025."
        valor={cfg.politicaDatos} set={v => set("politicaDatos", v)} restaurar={() => restaurar("politicaDatos")}
      />

      <p className="text-[11px] text-muted">
        Los marcadores <code className="surface-3 px-1 rounded font-mono">{"{{correo}}"}</code>,{" "}
        <code className="surface-3 px-1 rounded font-mono">{"{{telefono}}"}</code> y{" "}
        <code className="surface-3 px-1 rounded font-mono">{"{{horario}}"}</code> se reemplazan con los datos de la
        empresa al publicar. Ahí es donde los documentos originales tenían los huecos sin llenar.
      </p>

      <button onClick={guardar} disabled={guardando} className="btn-primary w-full justify-center">
        {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar y publicar
      </button>
    </div>
  );
}

function Politica({ titulo, nota, valor, set, restaurar }: {
  titulo: string; nota: string; valor: string; set: (v: string) => void; restaurar: () => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{titulo}</p>
        <button onClick={restaurar} className="text-[10px] font-semibold text-muted hover:text-red-500 flex items-center gap-1 flex-shrink-0">
          <RotateCcw size={10} /> Volver al original
        </button>
      </div>
      <p className="text-[11px] text-muted mb-3">{nota}</p>
      <textarea className="input resize-y text-[11px] leading-relaxed font-mono" rows={10} value={valor}
        onChange={e => set(e.target.value)} />
      <p className="text-[10px] text-muted mt-1.5">
        Una línea en blanco separa párrafos. Las líneas cortas numeradas salen como títulos de sección.
      </p>
    </div>
  );
}
