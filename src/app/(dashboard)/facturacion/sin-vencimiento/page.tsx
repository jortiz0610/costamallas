"use client";

// ============================================================
// Facturas sin fecha de vencimiento — corrección en lote.
//
// Una factura sin vencimiento no se puede cobrar: no hay contra qué
// decir que está vencida, y la cartera tenía que estimarle la antigüedad
// con la fecha de emisión.
//
// La pantalla propone la fecha que le corresponde a cada una según su
// forma de pago y se aceptan todas de una vez. Escribir 40 fechas a mano
// no lo hace nadie, y por eso llevan meses sin fecha.
// ============================================================

import { Suspense, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, ArrowLeft, CalendarClock, Check, AlertTriangle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP, formatDateShort } from "@/lib/utils";
import type { PlazoPago } from "@/lib/plazos-pago";

const ERP_COLOR = "#185FA5";

interface FacturaSinFecha {
  id: string; numero: string; estado: string; total: number; saldoPendiente: number;
  formaPago: string | null; formaPagoConocida: boolean;
  base: string; sugerida: string | null;
  cliente: { nombre: string; empresa: string | null };
}

/** La fecha en formato yyyy-mm-dd, que es lo que espera <input type=date>. */
const aInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function Contenido() {
  const [elegido, setElegido] = useState<Record<string, { formaPago: string; fechaVence: string }>>({});
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ plazos: PlazoPago[]; facturas: FacturaSinFecha[] }>({
    queryKey: ["facturas-sin-vencimiento"],
    queryFn: async () => (await (await fetch("/api/facturacion/sin-vencimiento")).json()).data,
  });

  // Arranca con lo que propone el servidor. El usuario corrige lo que no
  // le cuadre en vez de escribirlo todo.
  useEffect(() => {
    if (!data) return;
    const inicial: Record<string, { formaPago: string; fechaVence: string }> = {};
    for (const f of data.facturas) {
      inicial[f.id] = {
        formaPago: f.formaPagoConocida && f.formaPago ? f.formaPago : (data.plazos[0]?.valor ?? ""),
        fechaVence: aInput(f.sugerida),
      };
    }
    setElegido(inicial);
  }, [data]);

  const plazos = data?.plazos ?? [];
  const facturas = data?.facturas ?? [];

  /** Cambiar la forma de pago recalcula la fecha propuesta. */
  const cambiarForma = (f: FacturaSinFecha, valor: string) => {
    const plazo = plazos.find(p => p.valor === valor);
    const base = new Date(f.base);
    const nueva = plazo ? new Date(base.getTime() + plazo.dias * 86_400_000) : null;
    setElegido(prev => ({
      ...prev,
      [f.id]: { formaPago: valor, fechaVence: nueva ? nueva.toISOString().slice(0, 10) : prev[f.id]?.fechaVence ?? "" },
    }));
  };

  const aplicar = async () => {
    const cambios = facturas
      .map(f => ({ id: f.id, formaPago: elegido[f.id]?.formaPago, fechaVence: elegido[f.id]?.fechaVence }))
      .filter(c => c.fechaVence);

    if (!cambios.length) return toast.error("No hay ninguna fecha puesta");
    if (!confirm(`¿Aplicar la fecha de vencimiento a ${cambios.length} factura(s)?`)) return;

    setGuardando(true);
    try {
      const res = await fetch("/api/facturacion/sin-vencimiento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cambios }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo");
      toast.success(j.mensaje);
      for (const p of j.data.problemas ?? []) toast.error(p, { duration: 6000 });
      refetch();
    } finally { setGuardando(false); }
  };

  return (
    <>
      <Topbar title="Facturas sin vencimiento" actions={
        <Link href="/facturacion/cartera" className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 surface-2 text-soft">
          <ArrowLeft size={13} /> Cartera
        </Link>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-4 max-w-5xl mx-auto w-full">
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: ERP_COLOR }} /></div>
        ) : facturas.length === 0 ? (
          <div className="card p-10 text-center">
            <Check size={22} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-semibold text-soft">Todas las facturas tienen fecha de vencimiento.</p>
            <p className="text-xs text-muted mt-1">
              Las nuevas la calculan solas según su forma de pago; no vuelve a hacer falta ponerla a mano.
            </p>
          </div>
        ) : (
          <>
            <div className="card p-4 flex items-start gap-3" style={{ borderLeft: "4px solid #f59e0b" }}>
              <CalendarClock size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-soft">
                  {facturas.length} factura{facturas.length === 1 ? "" : "s"} sin fecha de vencimiento
                </p>
                <p className="text-muted mt-0.5">
                  La fecha propuesta es la de emisión (o la de creación, si nunca se emitió) más el plazo de su forma de
                  pago. Revisa y aplica: puedes cambiar cualquiera antes de guardar.
                </p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="surface-2">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Factura</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Cliente</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Saldo</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Desde</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Forma de pago</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map(f => (
                      <tr key={f.id} className="border-t divider">
                        <td className="px-4 py-2.5">
                          <Link href={`/facturacion/${f.id}`} className="font-mono font-bold text-soft hover:underline">{f.numero}</Link>
                          <p className="text-[10px] text-muted">{f.estado}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-soft truncate max-w-[180px]">{f.cliente.empresa || f.cliente.nombre}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-soft whitespace-nowrap">
                          {formatCOP(f.saldoPendiente)}
                        </td>
                        <td className="px-4 py-2.5 text-muted whitespace-nowrap">{formatDateShort(f.base)}</td>
                        <td className="px-4 py-2.5">
                          <select
                            className="input py-1 text-xs"
                            value={elegido[f.id]?.formaPago ?? ""}
                            onChange={e => cambiarForma(f, e.target.value)}
                          >
                            {plazos.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                          </select>
                          {!f.formaPagoConocida && f.formaPago && (
                            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={9} /> traía &quot;{f.formaPago}&quot;
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="date" className="input py-1 text-xs"
                            value={elegido[f.id]?.fechaVence ?? ""}
                            onChange={e => setElegido(p => ({ ...p, [f.id]: { ...p[f.id], fechaVence: e.target.value } }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={aplicar} disabled={guardando}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: ERP_COLOR }}>
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Aplicar a las {facturas.length}
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><Contenido /></Suspense>; }
