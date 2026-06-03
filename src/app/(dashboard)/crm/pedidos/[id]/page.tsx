"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ArrowLeft, Loader2, Package, Wrench, Calendar, MapPin, User, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

const CRM_COLOR = "#BA7517";
const ESTADOS_FLUJO = [
  { v: "NUEVO", l: "Nuevo", c: "#64748b", next: "CONFIRMADO" },
  { v: "CONFIRMADO", l: "Confirmado", c: "#185FA5", next: "EN_PRODUCCION" },
  { v: "EN_PRODUCCION", l: "En producción", c: CRM_COLOR, next: "LISTO" },
  { v: "LISTO", l: "Listo", c: "#7c3aed", next: "DESPACHADO" },
  { v: "DESPACHADO", l: "Despachado", c: "#0891b2", next: "ENTREGADO" },
  { v: "ENTREGADO", l: "Entregado", c: "#0f766e", next: "INSTALADO" },
  { v: "INSTALADO", l: "Instalado", c: "#16a34a", next: null },
];

function PedidoDetalleContent() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pedido", id],
    queryFn: async () => (await (await fetch(`/api/crm/pedidos/${id}`)).json()).data,
  });

  const avanzar = async (next: string) => {
    const res = await fetch(`/api/crm/pedidos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: next }) });
    const json = await res.json();
    if (json.success) { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["pedido", id] }); qc.invalidateQueries({ queryKey: ["crm-pedidos"] }); }
    else toast.error(json.error ?? "Error");
  };

  if (isLoading) return <><Topbar title="Pedido" /><div className="flex-1 flex items-center justify-center page-bg"><Loader2 size={22} className="animate-spin" style={{ color: CRM_COLOR }} /></div></>;
  if (!data) return <><Topbar title="Pedido" /><div className="flex-1 flex items-center justify-center page-bg"><p className="text-sm text-muted">No se encontró el pedido</p></div></>;

  const idx = ESTADOS_FLUJO.findIndex(e => e.v === data.estado);
  const actual = ESTADOS_FLUJO[idx];

  return (
    <>
      <Topbar title={`Pedido ${data.numero}`} actions={
        <Link href="/crm/pedidos" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6 max-w-4xl mx-auto w-full">

        {/* Línea de estados */}
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Estado de producción</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {ESTADOS_FLUJO.map((e, i) => {
              const done = i <= idx;
              return (
                <div key={e.v} className="flex items-center gap-1 flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all"
                      style={{ backgroundColor: done ? e.c : "var(--surface-3)", color: done ? "white" : "var(--text-muted)" }}>
                      {done ? <CheckCircle2 size={16} /> : i + 1}
                    </div>
                    <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: done ? e.c : "var(--text-muted)" }}>{e.l}</span>
                  </div>
                  {i < ESTADOS_FLUJO.length - 1 && <div className="w-8 h-0.5 mb-4" style={{ backgroundColor: i < idx ? e.c : "var(--border)" }} />}
                </div>
              );
            })}
          </div>
          {actual?.next && (
            <button onClick={() => avanzar(actual.next!)} className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{ backgroundColor: CRM_COLOR }}>
              Avanzar a {ESTADOS_FLUJO.find(e => e.v === actual.next)?.l} <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cliente */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Cliente</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{data.cliente.nombre}</p>
            {data.cliente.empresa && <p className="text-xs text-muted">{data.cliente.empresa}</p>}
            <div className="mt-2 space-y-1">
              {data.cliente.telefono && <p className="text-xs text-soft flex items-center gap-1.5"><User size={11} />{data.cliente.telefono}</p>}
              {(data.cliente.direccion || data.cliente.ciudad) && <p className="text-xs text-soft flex items-center gap-1.5"><MapPin size={11} />{[data.cliente.direccion, data.cliente.ciudad].filter(Boolean).join(", ")}</p>}
            </div>
            {data.cotizacion && <Link href="/crm/cotizaciones" className="text-xs font-semibold mt-3 inline-block" style={{ color: CRM_COLOR }}>Desde cotización {data.cotizacion.numero}</Link>}
          </div>

          {/* Instalación */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Instalación</p>
            {data.tieneInstalacion ? (
              data.instalacion ? (
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"><Wrench size={11} />{data.instalacion.estado}</span>
                  {data.instalacion.fechaAgendada && <p className="text-xs text-soft flex items-center gap-1.5"><Calendar size={11} />{new Date(data.instalacion.fechaAgendada).toLocaleDateString("es-CO")}</p>}
                  {data.instalacion.tecnico && <p className="text-xs text-soft flex items-center gap-1.5"><User size={11} />{data.instalacion.tecnico.nombre}</p>}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted">Este pedido requiere instalación pero aún no está agendada.</p>
                  <Link href="/crm/instalaciones" className="text-xs font-semibold mt-2 inline-block" style={{ color: CRM_COLOR }}>Agendar instalación →</Link>
                </div>
              )
            ) : <p className="text-xs text-muted">Pedido sin instalación (envío directo).</p>}
          </div>
        </div>

        {/* Ítems */}
        <div className="card overflow-hidden">
          <div className="card-header"><h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Package size={15} style={{ color: CRM_COLOR }} /> Ítems del pedido</h2></div>
          <table className="table">
            <thead><tr><th>Descripción</th><th className="text-center">Cant.</th><th className="text-right">V. Unit.</th><th className="text-right">Subtotal</th></tr></thead>
            <tbody>
              {data.items.map((it: { id: string; descripcion: string; cantidad: number; precioUnitario: number; subtotal: number; unidad?: string }) => (
                <tr key={it.id}>
                  <td>{it.descripcion}</td>
                  <td className="text-center">{it.cantidad}{it.unidad ? ` ${it.unidad}` : ""}</td>
                  <td className="text-right">{formatCOP(Number(it.precioUnitario))}</td>
                  <td className="text-right font-semibold">{formatCOP(Number(it.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end p-4 border-t divider">
            <div className="text-right">
              <p className="text-xs text-muted">Total del pedido</p>
              <p className="text-2xl font-bold" style={{ color: CRM_COLOR }}>{formatCOP(Number(data.total))}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><PedidoDetalleContent /></Suspense>; }
