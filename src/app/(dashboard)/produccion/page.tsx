"use client";

// ============================================================
// Las órdenes de producción.
//
// La lista que abre el operario al llegar al taller. Se parece más a una
// bandeja que a una tabla: en una tablet, una tabla de ocho columnas se
// lee con lupa y se toca con dos dedos.
// ============================================================

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Plus, Factory, CheckCircle2, Clock, Ban, PenLine, GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import { Topbar } from "@/components/layout/Topbar";
import { useBrand } from "@/contexts/BrandContext";

interface Orden {
  id: string;
  numero: string;
  estado: string;
  esPrueba: boolean;
  fechaExpedicion: string;
  fechaPrevista: string | null;
  firmaOperarioEn: string | null;
  firmaSupervisorEn: string | null;
  operario: { id: string; nombre: string } | null;
  supervisor: { nombre: string } | null;
  pedido: { numero: string } | null;
  producto: { nombre: string; sku: string } | null;
}

const ESTADOS: Record<string, { l: string; color: string; Icon: React.ElementType }> = {
  ABIERTA:    { l: "Abierta",     color: "#64748b", Icon: Clock },
  EN_PROCESO: { l: "Firmada por el operario", color: "#d97706", Icon: PenLine },
  TERMINADA:  { l: "Cerrada",     color: "#16a34a", Icon: CheckCircle2 },
  ANULADA:    { l: "Anulada",     color: "#dc2626", Icon: Ban },
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—";

function Contenido() {
  const { brand } = useBrand();
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [filtro, setFiltro] = useState("");

  const { data, isLoading, refetch } = useQuery<{ data: Orden[]; supervisa: boolean }>({
    queryKey: ["ordenes-produccion", filtro],
    queryFn: async () =>
      (await fetch(`/api/produccion/ordenes${filtro ? `?estado=${filtro}` : ""}`)).json(),
  });

  const ordenes = data?.data ?? [];

  const abrir = async () => {
    setCreando(true);
    try {
      const r = await fetch("/api/produccion/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.success) { toast.error(j.error ?? "No se pudo abrir"); return; }
      toast.success(`${j.data.numero} abierta`);
      router.push(`/produccion/${j.data.id}`);
    } finally { setCreando(false); }
  };

  return (
    <>
      <Topbar title="Órdenes de producción" actions={
        <div className="flex items-center gap-2">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className="input btn-sm max-w-[10rem]">
            <option value="">Todas</option>
            {Object.entries(ESTADOS).map(([v, e]) => <option key={v} value={v}>{e.l}</option>)}
          </select>
          <button onClick={abrir} disabled={creando}
            className="px-3 py-2 rounded-xl text-[13px] font-bold text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: brand.brandColor }}>
            {creando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Nueva orden
          </button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6">
        {isLoading ? (
          <div className="card p-10 text-center">
            <Loader2 size={18} className="animate-spin mx-auto" style={{ color: brand.brandColor }} />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="card p-10 max-w-lg mx-auto text-center">
            <Factory size={26} className="mx-auto mb-3 text-muted" />
            <p className="text-sm font-bold text-soft">
              {filtro ? "Nada con este filtro" : "No hay órdenes todavía"}
            </p>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              {filtro
                ? "Prueba a quitar el filtro."
                : "Abre una cuando vayas a fabricar. Queda con su número y se puede llenar a lo largo del turno."}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2.5">
            {ordenes.map(o => {
              const e = ESTADOS[o.estado] ?? ESTADOS.ABIERTA;
              const Icon = e.Icon;
              return (
                <Link key={o.id} href={`/produccion/${o.id}`}
                  className="card p-4 flex items-start gap-3 hover:brand-bg-10 transition-colors">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: e.color + "1f" }}>
                    <Icon size={18} style={{ color: e.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14.5px] font-bold text-soft">{o.numero}</span>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: e.color + "1f", color: e.color }}>
                        {e.l}
                      </span>
                      {o.esPrueba && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: "#7c3aed1f", color: "#7c3aed" }}>
                          <GraduationCap size={10} /> Práctica
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted mt-1 leading-snug">
                      {[
                        o.producto?.nombre,
                        o.pedido ? `Pedido ${o.pedido.numero}` : null,
                        o.operario?.nombre,
                      ].filter(Boolean).join(" · ") || "Sin asignar"}
                    </p>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      Abierta {fecha(o.fechaExpedicion)}
                      {o.fechaPrevista ? ` · prevista ${fecha(o.fechaPrevista)}` : ""}
                    </p>
                  </div>

                  {/* Las dos firmas, de un vistazo: es lo que decide si
                      la orden está cerrada o le falta la revisión. */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-[10.5px]">
                    <span className={o.firmaOperarioEn ? "text-green-600 font-bold" : "text-muted"}>
                      {o.firmaOperarioEn ? "✓" : "○"} Operario
                    </span>
                    <span className={o.firmaSupervisorEn ? "text-green-600 font-bold" : "text-muted"}>
                      {o.firmaSupervisorEn ? "✓" : "○"} Supervisor
                    </span>
                  </div>
                </Link>
              );
            })}
            <button onClick={() => refetch()} className="w-full py-2 text-[11.5px] text-muted">
              Actualizar
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Contenido /></Suspense>;
}
