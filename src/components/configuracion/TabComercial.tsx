"use client";

// ============================================================
// Las reglas con las que se cotiza y se cobra:
//   · Hasta qué descuento puede llegar un asesor solo.
//   · Qué anticipo hay que exigir.
//   · Qué plazo tiene cada forma de pago (de ahí sale la fecha de
//     vencimiento de las facturas).
//
// Todo parametrizable: ninguna de estas cifras está en el código.
// ============================================================

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Percent, Plus, Trash2, CalendarClock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import type { PlazoPago } from "@/lib/plazos-pago";

interface Politica {
  descuentoMaxPct: number;
  anticipoMinPct: number;
  exigirAprobacion: boolean;
}

export function TabComercial() {
  const [pol, setPol] = useState<Politica>({ descuentoMaxPct: 5, anticipoMinPct: 50, exigirAprobacion: true });
  const [plazos, setPlazos] = useState<PlazoPago[]>([]);
  const [guardando, setGuardando] = useState(false);

  const { data: politica, isLoading, refetch } = useQuery<{ data: Politica }>({
    queryKey: ["config-comercial"],
    queryFn: async () => (await (await fetch("/api/configuracion/comercial")).json()),
  });
  const { data: datosPlazos, refetch: refetchPlazos } = useQuery<{ data: PlazoPago[] }>({
    queryKey: ["config-plazos"],
    queryFn: async () => (await (await fetch("/api/configuracion/plazos")).json()),
  });

  useEffect(() => { if (politica?.data) setPol(politica.data); }, [politica]);
  useEffect(() => { if (datosPlazos?.data) setPlazos(datosPlazos.data); }, [datosPlazos]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r1 = await (await fetch("/api/configuracion/comercial", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pol),
      })).json();
      if (!r1.success) return toast.error(r1.error ?? "No se pudo guardar la política");

      const r2 = await (await fetch("/api/configuracion/plazos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plazos }),
      })).json();
      if (!r2.success) return toast.error(r2.error ?? "No se pudieron guardar los plazos");

      toast.success("Reglas comerciales guardadas");
      refetch(); refetchPlazos();
    } finally { setGuardando(false); }
  };

  const setPlazo = (i: number, campo: keyof PlazoPago, valor: string | number) =>
    setPlazos(p => p.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  if (isLoading) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <Percent size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Reglas comerciales</h2>
          <p className="text-xs text-muted mt-0.5">
            Hasta dónde puede llegar un asesor solo, y a partir de dónde hace falta el visto bueno de un administrador.
          </p>
        </div>
      </div>

      {/* Descuento y anticipo */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Descuento y anticipo</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Descuento máximo sin aprobación (%)</label>
            <input type="number" className="input" value={pol.descuentoMaxPct}
              onChange={e => setPol(p => ({ ...p, descuentoMaxPct: Number(e.target.value) }))} />
            <p className="text-[11px] text-muted mt-1">
              Cuenta el descuento por línea y el global juntos: si no, el tope se salta poniéndolo línea por línea.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Anticipo mínimo (%)</label>
            <input type="number" className="input" value={pol.anticipoMinPct}
              onChange={e => setPol(p => ({ ...p, anticipoMinPct: Number(e.target.value) }))} />
            <p className="text-[11px] text-muted mt-1">
              Si el asesor no pone ninguno, se entiende que aplica este. Solo se revisa cuando pone uno más bajo a propósito.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs text-soft pt-2 border-t divider">
          <input type="checkbox" className="mt-0.5" checked={pol.exigirAprobacion}
            onChange={e => setPol(p => ({ ...p, exigirAprobacion: e.target.checked }))} />
          <span>
            Exigir aprobación de un administrador cuando se pasen los límites.
            <span className="block text-[11px] text-muted mt-0.5">
              Con esto activo, una oferta fuera de política se puede armar pero no se puede enviar ni convertir en pedido
              hasta que alguien la autorice. Queda registrado quién, cuándo y con qué nota.
            </span>
          </span>
        </label>
      </div>

      {/* Plazos de pago */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
            <CalendarClock size={12} /> Formas de pago y plazos
          </p>
          <button onClick={() => setPlazos(p => [...p, { valor: "", label: "", dias: 0 }])}
            className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ backgroundColor: "var(--brand-color)" }}>
            <Plus size={13} /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-muted mb-3">
          De aquí sale sola la fecha de vencimiento al crear una factura: emisión + los días de su forma de pago.
        </p>

        <div className="space-y-2">
          {plazos.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="input col-span-4 py-1.5 text-xs" placeholder="CONTADO" value={p.valor}
                onChange={e => setPlazo(i, "valor", e.target.value)} />
              <input className="input col-span-5 py-1.5 text-xs" placeholder="Contado" value={p.label}
                onChange={e => setPlazo(i, "label", e.target.value)} />
              <input type="number" className="input col-span-2 py-1.5 text-xs" placeholder="0" value={p.dias}
                onChange={e => setPlazo(i, "dias", Number(e.target.value))} />
              <button onClick={() => setPlazos(x => x.filter((_, j) => j !== i))}
                className="col-span-1 text-muted hover:text-red-500 justify-self-center">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-2">Código · nombre visible · días. El código es lo que se guarda en la factura.</p>

        <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            Los plazos que trae por defecto (contado 0 · crédito 30) son un valor de arranque, no la política confirmada de
            Costamallas. Falta que gerencia diga cuáles son los reales.
          </span>
        </div>
      </div>

      <button onClick={guardar} disabled={guardando} className="btn-primary w-full justify-center">
        {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar reglas
      </button>
    </div>
  );
}
