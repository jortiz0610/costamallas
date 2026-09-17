"use client";

// ============================================================
// Revisar el catálogo de SIIGO antes de traerlo.
//
// Es una pantalla DE PASO: existe mientras queden fichas por decidir.
// Cuando no queden pendientes deja de tener sentido y se puede quitar.
//
// Lo que se enseña está elegido para decidir en un segundo, no para
// admirar la ficha: el código, el nombre, y las tres cosas que de verdad
// cambian la respuesta —si tiene PRECIO, si el SKU YA ESTÁ en el
// catálogo, y cuántas existencias hay—. Dos botones y a la siguiente.
//
// El aviso del precio no es decorativo: de los 1.044 productos, unos 738
// no tienen precio en SIIGO, y una ficha sin precio no se puede publicar
// en la tienda ni meter en una cotización.
// ============================================================

import { useState, useEffect, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Loader2, RefreshCw, Check, X, PackagePlus, ShieldAlert, Search, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { formatCOP } from "@/lib/utils";
import toast from "react-hot-toast";

interface Ficha {
  id: string;
  codigo: string;
  nombre: string;
  precio: string | number | null;
  ivaPct: string | number | null;
  unidad: string | null;
  tipo: string;
  existencias: string | number;
  grupo: string | null;
  decision: string;
  yaEnPortal: boolean;
  productoId: string | null;
  errorAlTraer: string | null;
}

const VERDE = "#16a34a";
const ERP = "#185FA5";

function RevisionContent() {
  const { isAdmin, isLoading: cargandoSesion } = useAuth();
  const qc = useQueryClient();

  const [decision, setDecision] = useState("PENDIENTE");
  const [busqueda, setBusqueda] = useState("");
  const [conPrecio, setConPrecio] = useState<"" | "1" | "0">("");
  const [pagina, setPagina] = useState(1);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => { setPagina(1); }, [decision, busqueda, conPrecio]);

  const { data, isLoading } = useQuery<{
    data: Ficha[]; total: number; paginas: number;
    conteos: Record<string, number>; conPrecio: number;
  }>({
    queryKey: ["siigo-productos", decision, busqueda, conPrecio, pagina],
    queryFn: async () => {
      const p = new URLSearchParams({ decision, pagina: String(pagina) });
      if (busqueda) p.set("busqueda", busqueda);
      if (conPrecio) p.set("conPrecio", conPrecio);
      return await (await fetch(`/api/siigo/productos?${p}`)).json();
    },
    enabled: isAdmin,
    placeholderData: previa => previa,
  });

  const fichas = data?.data ?? [];
  const conteos = data?.conteos ?? {};
  const totalPaginas = data?.paginas ?? 1;

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await fetch("/api/siigo/productos", { method: "POST" });
      const j = await r.json();
      if (!j.success) return toast.error(j.error ?? "No se pudo sincronizar");
      const d = j.data;
      toast.success(
        `${d.leidos} productos leídos de SIIGO · ${d.nuevos} nuevos · ${d.sinPrecio} sin precio`,
        { duration: 8000 },
      );
      qc.invalidateQueries({ queryKey: ["siigo-productos"] });
    } catch { toast.error("Error de conexión"); }
    finally { setSincronizando(false); }
  };

  const decidir = async (f: Ficha, cual: "TRAER" | "DESCARTAR") => {
    setTrabajando(f.id);
    try {
      const r = await fetch("/api/siigo/productos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [f.id], decision: cual }),
      });
      const j = await r.json();
      if (!j.success) return toast.error(j.error ?? "No se pudo");
      const fallida = (j.data.fallidas ?? [])[0];
      if (fallida) toast.error(fallida.error ?? "No se pudo traer", { duration: 8000 });
      else if (cual === "TRAER") toast.success(`${f.codigo} está en el catálogo`);
      else toast(`${f.codigo} descartado`, { icon: "🚫" });
      qc.invalidateQueries({ queryKey: ["siigo-productos"] });
      qc.invalidateQueries({ queryKey: ["productos"] });
    } catch { toast.error("Error de conexión"); }
    finally { setTrabajando(null); }
  };

  if (cargandoSesion) {
    return (
      <>
        <Topbar title="Catálogo de SIIGO" />
        <div className="flex-1 page-bg flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Topbar title="Catálogo de SIIGO" />
        <div className="flex-1 page-bg p-6">
          <div className="card p-8 max-w-md mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: "#fef3c7" }}>
              <ShieldAlert size={22} style={{ color: "#b45309" }} />
            </div>
            <p className="text-base font-semibold text-soft">Esto lo ve solo un administrador</p>
            <p className="text-sm text-muted">Decidir qué entra al catálogo cambia lo que se puede vender.</p>
            <Link href="/productos" className="btn-secondary btn-sm inline-flex">Volver a productos</Link>
          </div>
        </div>
      </>
    );
  }

  const pendientes = conteos.PENDIENTE ?? 0;
  const traidos = conteos.TRAER ?? 0;
  const descartados = conteos.DESCARTAR ?? 0;
  const hayFichas = pendientes + traidos + descartados > 0;

  const FILTROS = [
    { v: "PENDIENTE", l: "Por decidir", n: pendientes },
    { v: "TRAER", l: "Traídos", n: traidos },
    { v: "DESCARTAR", l: "Descartados", n: descartados },
    { v: "TODAS", l: "Todas", n: pendientes + traidos + descartados },
  ];

  return (
    <>
      <Topbar
        title="Catálogo de SIIGO"
        actions={
          <button onClick={sincronizar} disabled={sincronizando} className="btn-secondary btn-sm disabled:opacity-50">
            <RefreshCw size={12} className={sincronizando ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{hayFichas ? "Actualizar desde SIIGO" : "Traer catálogo de SIIGO"}</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-3 sm:p-5 space-y-4">

        {!hayFichas ? (
          <div className="card p-12 text-center max-w-lg mx-auto space-y-3">
            <PackagePlus size={30} className="mx-auto text-muted" />
            <p className="text-base font-semibold text-soft">Todavía no se ha traído el catálogo</p>
            <p className="text-sm text-muted">
              Pulsa «Traer catálogo de SIIGO» arriba. Se trae una copia de los 1.044 productos
              para revisarlos aquí — no entra nada al catálogo hasta que lo decidas.
            </p>
          </div>
        ) : (
          <>
            {/* Lo que hay que saber antes de empezar a decidir. */}
            <div className="card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#fef3c7" }}>
                <AlertTriangle size={16} style={{ color: "#b45309" }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-soft">
                  {data?.conPrecio ?? 0} de {pendientes + traidos + descartados} tienen precio en SIIGO
                </p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Una ficha sin precio no se puede publicar en la tienda ni meter en una cotización.
                  Lo que traigas entra <strong>sin publicar y en borrador</strong>: traerlo al catálogo
                  no es ponerlo en la tienda.
                </p>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              {FILTROS.map(f => (
                <button key={f.v} onClick={() => setDecision(f.v)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={decision === f.v
                    ? { backgroundColor: ERP, color: "white" }
                    : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {f.l} ({f.n})
                </button>
              ))}

              <span className="w-px h-5 bg-[var(--border)] mx-1" />

              <button onClick={() => setConPrecio(conPrecio === "1" ? "" : "1")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={conPrecio === "1"
                  ? { backgroundColor: VERDE, color: "white" }
                  : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                Con precio
              </button>
              <button onClick={() => setConPrecio(conPrecio === "0" ? "" : "0")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={conPrecio === "0"
                  ? { backgroundColor: "#b45309", color: "white" }
                  : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                Sin precio
              </button>

              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="input pl-9 py-1.5 text-xs" placeholder="Código o nombre…" />
              </div>
            </div>

            {/* Lista */}
            <div className="card overflow-hidden">
              {isLoading ? (
                <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto text-muted" /></div>
              ) : fichas.length === 0 ? (
                <div className="p-12 text-center">
                  <Check size={26} className="mx-auto mb-2" style={{ color: VERDE }} />
                  <p className="text-sm font-medium text-soft">
                    {decision === "PENDIENTE" ? "No queda nada por decidir" : "Nada con este filtro"}
                  </p>
                </div>
              ) : fichas.map(f => {
                const precio = f.precio == null ? null : Number(f.precio);
                const ocupado = trabajando === f.id;
                return (
                  <div key={f.id}
                    className="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4 px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-b-0">

                    <div className="flex items-center justify-between gap-3 xl:block xl:w-36 xl:flex-shrink-0">
                      <p className="text-xs font-mono font-bold" style={{ color: ERP }}>{f.codigo}</p>
                      {f.tipo === "Service" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded surface-2 text-muted">SERVICIO</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-soft">{f.nombre}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {f.yaEnPortal && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>
                            Ya está en el catálogo
                          </span>
                        )}
                        {precio === null && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                            Sin precio
                          </span>
                        )}
                        {f.unidad && <span className="text-[10px] text-muted">por {f.unidad}</span>}
                        <span className="text-[10px] text-muted">
                          existencias: {Number(f.existencias)}
                        </span>
                      </div>
                      {f.errorAlTraer && (
                        <p className="text-[11px] text-red-600 mt-1">{f.errorAlTraer}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 xl:contents">
                      <p className="text-sm font-bold xl:w-28 text-right"
                        style={{ color: precio === null ? "var(--text-muted)" : "inherit" }}>
                        {precio === null ? "—" : formatCOP(precio)}
                      </p>

                      {/* Dos botones. Nada más: si hubiera un menú, decidir
                          mil fichas sería mil menús. */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {f.decision === "PENDIENTE" ? (
                          <>
                            <button onClick={() => decidir(f, "TRAER")} disabled={ocupado}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50"
                              style={{ backgroundColor: VERDE }}>
                              {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Traer
                            </button>
                            <button onClick={() => decidir(f, "DESCARTAR")} disabled={ocupado}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold surface-2 text-muted hover:text-soft flex items-center gap-1 disabled:opacity-50">
                              <X size={12} /> No
                            </button>
                          </>
                        ) : f.decision === "TRAER" ? (
                          f.productoId ? (
                            <Link href={`/productos/${f.productoId}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                              style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
                              <Check size={12} /> Ver ficha
                            </Link>
                          ) : (
                            <span className="text-xs text-muted">Traído</span>
                          )
                        ) : (
                          <button onClick={() => decidir(f, "TRAER")} disabled={ocupado}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold surface-2 text-muted hover:text-soft disabled:opacity-50">
                            Descartado · traer igual
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPaginas > 1 && (
              <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="text-xs text-muted">
                  {fichas.length} de {(data?.total ?? 0).toLocaleString("es-CO")} · página {pagina} de {totalPaginas}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}
                    className="btn-secondary btn-sm disabled:opacity-40">Anterior</button>
                  <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}
                    className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: ERP }}>Siguiente</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><RevisionContent /></Suspense>;
}
