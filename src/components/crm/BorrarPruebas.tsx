"use client";

// ============================================================
// Borrar en bloque las cotizaciones de prueba.
//
// Dice CUÁNTAS va a borrar antes de que alguien confirme. Un botón de
// borrado en bloque que no dice cuánto borra se pulsa a ciegas, y esto
// se lleva por delante los pedidos que nacieron de esas ofertas.
//
// Solo lo ve el superadministrador. Que alguien pueda CREAR pruebas no
// significa que pueda vaciar la tabla.
// ============================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FlaskConical, Loader2, Trash2, X } from "lucide-react";

export function BorrarPruebas({ onBorrado }: { onBorrado?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const { data, refetch } = useQuery<{ cotizaciones: number; pedidos: number; numeros: string[] }>({
    queryKey: ["cotizaciones-prueba"],
    queryFn: async () => (await (await fetch("/api/crm/cotizaciones/pruebas")).json()).data,
    staleTime: 30_000,
  });

  const cuantas = data?.cotizaciones ?? 0;
  if (cuantas === 0) return null;

  const borrar = async () => {
    setBorrando(true);
    try {
      const res = await fetch("/api/crm/cotizaciones/pruebas", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo borrar");
      toast.success(
        `${json.data.cotizaciones} cotizaciones y ${json.data.pedidos} pedidos de prueba borrados`,
      );
      setAbierto(false);
      await refetch();
      onBorrado?.();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="btn-secondary btn-sm"
        title="Borrar todas las cotizaciones de prueba y los pedidos que nacieron de ellas"
        style={{ color: "#b45309" }}
      >
        <FlaskConical size={12} /> Limpiar pruebas ({cuantas})
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !borrando && setAbierto(false)}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FlaskConical size={15} style={{ color: "#b45309" }} /> Borrar las pruebas
              </h2>
              <button onClick={() => setAbierto(false)} disabled={borrando} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-[13px] text-gray-700 dark:text-gray-200">
                Se van a borrar <strong>{data?.cotizaciones} cotizaciones</strong> de prueba
                {(data?.pedidos ?? 0) > 0 && <> y <strong>{data?.pedidos} pedidos</strong> que nacieron de ellas</>}.
              </p>
              {data?.numeros?.length ? (
                <div className="rounded-xl p-3 max-h-40 overflow-y-auto text-[11.5px] font-mono text-gray-500 dark:text-slate-400" style={{ backgroundColor: "var(--surface-3)" }}>
                  {data.numeros.join("  ·  ")}
                </div>
              ) : null}
              <p className="text-[11.5px] text-gray-400">
                Es irreversible. Las ofertas reales no se tocan: solo lo marcado como prueba.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setAbierto(false)} disabled={borrando} className="btn-secondary btn-sm">
                Cancelar
              </button>
              <button
                onClick={borrar}
                disabled={borrando}
                className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: "#dc2626" }}
              >
                {borrando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Sí, borrar {cuantas}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
