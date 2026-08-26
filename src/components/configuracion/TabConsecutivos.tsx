"use client";

// ============================================================
// La numeración de cada documento.
//
// Una empresa que viene de otro sistema necesita CONTINUAR su
// numeración, no empezar de cero: arrancar en COT-00001 le dice a cada
// cliente que la empresa es nueva.
//
// Se pide el ÚLTIMO número usado, no el próximo, porque es el dato que
// la gente tiene a la mano ("vamos por la 12063").
// ============================================================

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Hash, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface Consecutivo {
  tipo: string; etiqueta: string; actual: number;
  prefijo: string; digitos: number; proximo: string; inicializado: boolean;
}

export function TabConsecutivos() {
  const [edicion, setEdicion] = useState<Record<string, { desde: string; prefijo: string; digitos: string }>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ data: Consecutivo[]; fallos?: { tipo: string; error: string }[] }>({
    queryKey: ["config-consecutivos"],
    queryFn: async () => {
      const res = await fetch("/api/configuracion/consecutivos");
      const j = await res.json();
      // Sin esto, un error del servidor dejaba `data` en undefined y la
      // pantalla giraba para siempre sin decir qué pasó.
      if (!res.ok || !j.success) throw new Error(j.error ?? `El servidor respondió ${res.status}`);
      return j;
    },
  });

  useEffect(() => {
    if (!data?.data) return;
    const ini: typeof edicion = {};
    for (const c of data.data) {
      ini[c.tipo] = { desde: String(c.actual), prefijo: c.prefijo, digitos: String(c.digitos) };
    }
    setEdicion(ini);
  }, [data]);

  const guardar = async (tipo: string) => {
    const e = edicion[tipo];
    setGuardando(tipo);
    try {
      const res = await fetch("/api/configuracion/consecutivos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, desde: e.desde, prefijo: e.prefijo, digitos: e.digitos }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success(j.mensaje);
      refetch();
    } finally { setGuardando(null); }
  };

  if (isLoading) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  if (error || !data) {
    return (
      <div className="card p-6 max-w-2xl" style={{ borderLeft: "4px solid #dc2626" }}>
        <p className="text-sm font-bold text-soft flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-500" /> No se pudo cargar la numeración
        </p>
        <p className="text-xs text-muted mt-2 break-words">
          {error instanceof Error ? error.message : "El servidor no respondió."}
        </p>
        <button onClick={() => refetch()} className="btn-secondary btn-sm mt-4">Reintentar</button>
      </div>
    );
  }

  /** La vista previa se calcula aquí para que se vea antes de guardar. */
  const previa = (tipo: string) => {
    const e = edicion[tipo];
    if (!e) return "";
    const n = String(Number(e.desde || 0) + 1).padStart(Math.min(12, Math.max(1, Number(e.digitos) || 1)), "0");
    return e.prefijo ? `${e.prefijo}-${n}` : n;
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <Hash size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Consecutivos</h2>
          <p className="text-xs text-muted mt-0.5">
            Con qué número sigue cada documento. Sirve para continuar la numeración que traías de otro sistema.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10">
        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          Se escribe el <b>último número usado</b>, no el próximo. Si tu última cotización fue la 12063, escribe 12063 y
          la primera que emita el portal será la 12064. No se puede poner por debajo de lo ya emitido: se repetirían
          números y el documento no se podría guardar.
        </span>
      </div>

      {(data.fallos ?? []).length > 0 && (
        <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            No se pudo leer la numeración de: {data.fallos!.map(f => `${f.tipo} (${f.error})`).join(" · ")}. El resto sí
            se puede configurar.
          </span>
        </div>
      )}

      {data.data.map(c => {
        const e = edicion[c.tipo];
        if (!e) return null;
        return (
          <div key={c.tipo} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted">{c.etiqueta}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {c.inicializado ? `Va por el ${c.actual}` : "Todavía no se ha emitido ninguno"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted">El próximo será</p>
                <p className="text-sm font-mono font-bold" style={{ color: "var(--brand-color)" }}>{previa(c.tipo)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Último usado</label>
                <input type="number" className="input py-1.5 text-xs" value={e.desde}
                  onChange={ev => setEdicion(p => ({ ...p, [c.tipo]: { ...p[c.tipo], desde: ev.target.value } }))} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Prefijo</label>
                <input className="input py-1.5 text-xs" value={e.prefijo} placeholder="(sin prefijo)"
                  onChange={ev => setEdicion(p => ({ ...p, [c.tipo]: { ...p[c.tipo], prefijo: ev.target.value.toUpperCase() } }))} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Dígitos</label>
                <input type="number" className="input py-1.5 text-xs" value={e.digitos}
                  onChange={ev => setEdicion(p => ({ ...p, [c.tipo]: { ...p[c.tipo], digitos: ev.target.value } }))} />
              </div>
              <button onClick={() => guardar(c.tipo)} disabled={guardando === c.tipo}
                className="py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-color)" }}>
                {guardando === c.tipo ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
              </button>
            </div>

            <p className="text-[10px] text-muted mt-2">
              Deja el prefijo vacío para que el documento sea solo el número. Admite letras, números y guiones.
            </p>
          </div>
        );
      })}
    </div>
  );
}
