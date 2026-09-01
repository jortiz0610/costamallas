"use client";

// ============================================================
// Pipeline de pedidos.
//
// Antes era un tablero de tarjetas y nada más: no se veía cuánta plata
// había en cada etapa ni cuánto llevaba parado un pedido, que es
// justamente lo que uno mira en una reunión comercial.
//
// Ahora cada columna suma su valor, cada tarjeta dice los días que lleva
// sin moverse (y se marca en rojo si se pasó del límite de su etapa), se
// puede filtrar por asesor, origen y fecha, y al hacer clic se abre la
// ficha al lado sin perder el tablero.
// ============================================================

import { Suspense, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { InterruptorCapacitacion, AvisoCapacitacion, useModoCapacitacion } from "@/components/crm/ModoCapacitacion";
import {
  Loader2, RefreshCw, TrendingUp, Package, X, Wrench, User, Calendar, AlertTriangle, Filter,
} from "lucide-react";
import Link from "next/link";
import { formatCOP, formatDate, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { PipelineComercial } from "@/components/crm/PipelineComercial";

const CRM_COLOR = "#BA7517";

/** Días a partir de los cuales una tarjeta se considera estancada.
 *  Producción aguanta más que un pedido nuevo sin confirmar. */
const DIAS_ALERTA: Record<string, number> = {
  NUEVO: 2, CONFIRMADO: 3, EN_PRODUCCION: 7, LISTO: 3, DESPACHADO: 5, ENTREGADO: 5, INSTALADO: 9999,
};

const COLUMNAS = [
  { id: "NUEVO",         label: "Nuevos",      hdr: "#64748b" },
  { id: "CONFIRMADO",    label: "Confirmados", hdr: "#185FA5" },
  { id: "EN_PRODUCCION", label: "Producción",  hdr: CRM_COLOR },
  { id: "LISTO",         label: "Listos",      hdr: "#7c3aed" },
  { id: "DESPACHADO",    label: "Despachados", hdr: "#0891b2" },
  { id: "ENTREGADO",     label: "Entregados",  hdr: "#0f766e" },
  { id: "INSTALADO",     label: "Instalados",  hdr: "#16a34a" },
];

const SIGUIENTE: Record<string, string> = {
  NUEVO: "CONFIRMADO", CONFIRMADO: "EN_PRODUCCION", EN_PRODUCCION: "LISTO",
  LISTO: "DESPACHADO", DESPACHADO: "ENTREGADO", ENTREGADO: "INSTALADO",
};

const ORIGENES = [
  { v: "WEB", l: "Tienda web" },
  { v: "MANUAL", l: "Manual" },
  { v: "COTIZACION", l: "Cotización" },
  { v: "NEXUS", l: "Chat" },
  { v: "MARKETPLACE", l: "Marketplace" },
];

interface Pedido {
  id: string; numero: string; estado: string; total: number; createdAt: string;
  estadoDesde: string; origen: string; tieneInstalacion: boolean;
  cliente: { nombre: string; empresa?: string };
  vendedor?: { id: string; nombre: string } | null;
  _count: { items: number };
  instalacion?: { estado: string; fechaAgendada: string | null } | null;
}

const AV = [CRM_COLOR, "#185FA5", "#7c3aed", "#059669", "#dc2626"];
const av = (n: string) => AV[n.charCodeAt(0) % AV.length];
const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function PipelineContent() {
  // Quién ve cuál. Un vendedor no ve el tablero de PRODUCCIÓN: no le
  // dice nada del negocio que está cerrando, y encima invita a mover
  // tarjetas de un proceso que no controla. Producción, al revés, no ve
  // el comercial. Los dos permisos son configurables persona a persona,
  // así que si un vendedor necesita mirar fabricación se le activa.
  const { puedeVer } = useAuth();
  const verComercial = puedeVer("crm.pipeline");
  const verProduccion = puedeVer("crm.pipeline_produccion");
  const [vista, setVista] = useState<"comercial" | "produccion">(
    verComercial ? "comercial" : "produccion",
  );
  const vistaActual = vista === "produccion" && !verProduccion ? "comercial"
    : vista === "comercial" && !verComercial ? "produccion"
    : vista;
  const qc = useQueryClient();
  const [refrescando, setRefrescando] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [fVendedor, setFVendedor] = useState("");
  const [fOrigen, setFOrigen] = useState("");
  const [fDias, setFDias] = useState("");

  // El parámetro va en la clave de la consulta: si no, al encender la
  // capacitación se reusaría la respuesta anterior y la pantalla no
  // cambiaría hasta que caducara la caché.
  const { activo: capacitando, parametro } = useModoCapacitacion();
  const { data: pedidos = [], isLoading, refetch } = useQuery<Pedido[]>({
    queryKey: ["pedidos-pipeline", capacitando],
    queryFn: async () => (await (await fetch(`/api/crm/pedidos${parametro}`)).json()).data ?? [],
    refetchInterval: 60_000,
  });

  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    pedidos.forEach(p => { if (p.vendedor?.id) m.set(p.vendedor.id, p.vendedor.nombre); });
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [pedidos]);

  const filtrados = useMemo(() => pedidos.filter(p => {
    if (p.estado === "CANCELADO") return false;
    if (fVendedor && p.vendedor?.id !== fVendedor) return false;
    if (fOrigen && p.origen !== fOrigen) return false;
    if (fDias && diasDesde(p.createdAt) > Number(fDias)) return false;
    return true;
  }), [pedidos, fVendedor, fOrigen, fDias]);

  const hayFiltro = Boolean(fVendedor || fOrigen || fDias);

  const porColumna = useMemo(() => {
    const m: Record<string, Pedido[]> = {};
    COLUMNAS.forEach(c => { m[c.id] = filtrados.filter(p => p.estado === c.id); });
    return m;
  }, [filtrados]);

  // El embudo es lo que todavía no se ha entregado: sumar lo instalado
  // inflaría la cifra con plata que ya se cobró.
  const totalEmbudo = filtrados.filter(p => p.estado !== "INSTALADO").reduce((a, p) => a + Number(p.total), 0);
  const estancados = filtrados.filter(p => diasDesde(p.estadoDesde) > (DIAS_ALERTA[p.estado] ?? 9999)).length;

  const mover = async (id: string, estado: string) => {
    const res = await fetch(`/api/crm/pedidos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }),
    });
    const j = await res.json();
    if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo mover");
    toast.success(`Movido a ${COLUMNAS.find(c => c.id === estado)?.label ?? estado}`);
    qc.invalidateQueries({ queryKey: ["pedidos-pipeline"] });
  };

  const refrescar = async () => {
    setRefrescando(true);
    await refetch();
    toast.success("Pipeline actualizado");
    setTimeout(() => setRefrescando(false), 1200);
  };

  const abierta = pedidos.find(p => p.id === abierto);

  return (
    <>
      <Topbar title={verComercial ? "Pipeline" : "Pipeline de producción"} actions={
        <div className="flex items-center gap-2">
          <InterruptorCapacitacion puede={puedeVer("crm.cotizaciones.prueba")} />
          {/* Dos tableros distintos y los dos hacen falta: el COMERCIAL
              sigue la oferta hasta que se cierra, y el de PRODUCCION
              sigue el pedido hasta que se entrega. Meterlos en uno solo
              obligaria a una tarjeta a estar en dos columnas. */}
          {/* El selector solo aparece si de verdad hay dos tableros que
              elegir. Con uno solo es un botón que no hace nada. */}
          {verComercial && verProduccion && (
            <div className="flex rounded-xl p-0.5 gap-0.5" style={{ backgroundColor: "var(--surface-3)" }}>
              {([["comercial", "Comercial"], ["produccion", "Producción"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setVista(k)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={vistaActual === k ? { backgroundColor: CRM_COLOR, color: "white" } : { color: "var(--text-muted)" }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <button onClick={refrescar} className="btn-secondary btn-sm">
            <RefreshCw size={13} className={refrescando ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      } />

      {vistaActual === "comercial" ? (
        <div className="flex-1 overflow-y-auto page-bg p-5">
          <PipelineComercial />
        </div>
      ) : (
      <div className="flex-1 overflow-hidden page-bg flex flex-col">
        <div className="p-5 pb-3 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CRM_COLOR + "18" }}>
                <TrendingUp size={16} style={{ color: CRM_COLOR }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted">En el embudo</p>
                <p className="text-base font-bold truncate" style={{ color: CRM_COLOR }}>{formatCOP(totalEmbudo)}</p>
              </div>
            </div>
            <div className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#185FA518" }}>
                <Package size={16} style={{ color: "#185FA5" }} />
              </div>
              <div><p className="text-[11px] text-muted">Pedidos</p><p className="text-base font-bold" style={{ color: "#185FA5" }}>{filtrados.length}</p></div>
            </div>
            <div className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#dc262618" }}>
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <div><p className="text-[11px] text-muted">Estancados</p><p className="text-base font-bold text-red-600">{estancados}</p></div>
            </div>
            <div className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16a34a18" }}>
                <Wrench size={16} className="text-emerald-600" />
              </div>
              <div><p className="text-[11px] text-muted">Con instalación</p><p className="text-base font-bold text-emerald-600">{filtrados.filter(p => p.tieneInstalacion).length}</p></div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-muted" />
            <select className="input py-1 text-xs w-auto" value={fVendedor} onChange={e => setFVendedor(e.target.value)}>
              <option value="">Todos los asesores</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
            <select className="input py-1 text-xs w-auto" value={fOrigen} onChange={e => setFOrigen(e.target.value)}>
              <option value="">Todos los orígenes</option>
              {ORIGENES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select className="input py-1 text-xs w-auto" value={fDias} onChange={e => setFDias(e.target.value)}>
              <option value="">Cualquier fecha</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
            {hayFiltro && (
              <button onClick={() => { setFVendedor(""); setFOrigen(""); setFDias(""); }} className="text-xs font-semibold" style={{ color: CRM_COLOR }}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={22} className="animate-spin" style={{ color: CRM_COLOR }} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto lg:overflow-x-auto lg:overflow-y-hidden px-3 sm:px-5 pb-5">
            <div className="flex flex-col lg:flex-row gap-3 h-full lg:min-w-max">
              {COLUMNAS.map(col => {
                const items = porColumna[col.id] ?? [];
                const valor = items.reduce((a, p) => a + Number(p.total), 0);
                return (
                  <div
                    key={col.id}
                    className="w-full lg:w-[268px] flex flex-col card overflow-hidden"
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (!dragId) return;
                      const ped = pedidos.find(p => p.id === dragId);
                      setDragId(null);
                      if (ped && ped.estado !== col.id) mover(ped.id, col.id);
                    }}
                  >
                    <div className="px-3 py-2.5 flex-shrink-0" style={{ borderTop: `3px solid ${col.hdr}` }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{col.label}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: col.hdr + "20", color: col.hdr }}>
                          {items.length}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold mt-0.5" style={{ color: col.hdr }}>{formatCOP(valor)}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                      {items.length === 0 && <p className="text-[11px] text-muted text-center py-6">Vacío</p>}
                      {items.map(p => {
                        const dias = diasDesde(p.estadoDesde);
                        const estancado = dias > (DIAS_ALERTA[p.estado] ?? 9999);
                        return (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={() => setDragId(p.id)}
                            onDragEnd={() => setDragId(null)}
                            onClick={() => setAbierto(p.id)}
                            className="p-2.5 rounded-xl surface-2 cursor-pointer hover:brand-bg-10 transition-colors"
                            style={estancado ? { borderLeft: "3px solid #dc2626" } : undefined}
                          >
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: av(p.cliente.nombre) }}>
                                {p.cliente.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-soft truncate">{p.cliente.empresa || p.cliente.nombre}</p>
                                <p className="text-[10px] text-muted font-mono">{p.numero}</p>
                              </div>
                              {p.tieneInstalacion && <Wrench size={11} className="text-muted flex-shrink-0" />}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[11px] font-bold text-soft">{formatCOP(Number(p.total))}</span>
                              <span className={cn("text-[10px] font-semibold", estancado ? "text-red-600" : "text-muted")}>
                                {dias === 0 ? "hoy" : `${dias} d`}
                              </span>
                            </div>
                            {SIGUIENTE[p.estado] && (
                              <button
                                onClick={e => { e.stopPropagation(); mover(p.id, SIGUIENTE[p.estado]); }}
                                className="w-full mt-2 py-1 rounded-lg text-[10px] font-semibold surface-3 text-muted hover:brand-bg-10"
                              >
                                Mover a {COLUMNAS.find(c => c.id === SIGUIENTE[p.estado])?.label}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Ficha lateral */}
      {abierta && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setAbierto(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md h-full overflow-y-auto card rounded-none animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="card-header sticky top-0 z-10">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{abierta.numero}</h2>
                <p className="text-xs text-muted">{abierta.cliente.empresa || abierta.cliente.nombre}</p>
              </div>
              <button onClick={() => setAbierto(null)} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl surface-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Valor</p>
                  <p className="text-base font-bold" style={{ color: CRM_COLOR }}>{formatCOP(Number(abierta.total))}</p>
                </div>
                <div className="p-3 rounded-xl surface-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">En esta etapa</p>
                  <p className="text-base font-bold text-soft">{diasDesde(abierta.estadoDesde)} días</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-soft"><Package size={13} className="text-muted" /> {abierta._count.items} ítem{abierta._count.items === 1 ? "" : "s"}</div>
                <div className="flex items-center gap-2 text-soft"><User size={13} className="text-muted" /> {abierta.vendedor?.nombre ?? "Sin asesor"}</div>
                <div className="flex items-center gap-2 text-soft"><Calendar size={13} className="text-muted" /> Creado el {formatDate(abierta.createdAt)}</div>
                <div className="flex items-center gap-2 text-soft">
                  <TrendingUp size={13} className="text-muted" /> Origen: {ORIGENES.find(o => o.v === abierta.origen)?.l ?? abierta.origen}
                </div>
                {abierta.tieneInstalacion && (
                  <div className="flex items-center gap-2 text-soft">
                    <Wrench size={13} className="text-muted" />
                    Instalación: {abierta.instalacion?.estado ?? "sin agendar"}
                    {abierta.instalacion?.fechaAgendada && ` · ${formatDate(abierta.instalacion.fechaAgendada)}`}
                  </div>
                )}
              </div>

              {SIGUIENTE[abierta.estado] && (
                <button
                  onClick={() => { mover(abierta.id, SIGUIENTE[abierta.estado]); setAbierto(null); }}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: CRM_COLOR }}
                >
                  Mover a {COLUMNAS.find(c => c.id === SIGUIENTE[abierta.estado])?.label}
                </button>
              )}

              <Link href={`/crm/pedidos/${abierta.id}`} className="btn-secondary w-full justify-center">
                Abrir el pedido completo
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() { return <Suspense><PipelineContent /></Suspense>; }
