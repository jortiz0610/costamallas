"use client";

// ============================================================
// Cotizador único.
//
// Antes había DOS pantallas: "Cotizaciones → Nueva" (producto por
// cantidad) y "Cotizador a medida" (largo × ancho). El vendedor tenía que
// saber de antemano cuál abrir, y si el pedido mezclaba las dos cosas no
// había forma de cotizarlo en un solo documento.
//
// Ahora es una sola: cada línea decide si va por cantidad o por medidas.
// El check de medidas sale solo en los productos marcados como
// "fabricación a medida" en el catálogo.
// ============================================================

import { useState, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, Search, Plus, Trash2, X, Loader2, Save, Ruler, Package,
  UserPlus, Wrench, FileText, LayoutTemplate, MapPin,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP, cn } from "@/lib/utils";
import type { ServicioInstalacion, RecargoCiudad } from "@/components/configuracion/TabInstalacion";

const CRM_COLOR = "#BA7517";
const IVA = 0.19;

interface Producto {
  id: string; sku: string; nombre: string; precioNormal: number | null; stock: number;
  acfUnidadVenta?: string | null; acfFabricacionMedida?: boolean; imagenPrincipal?: string | null;
  categorias: string[];
}
interface Cliente { id: string; nombre: string; empresa?: string; email?: string; telefono?: string; ciudad?: string; nit?: string; }

interface Linea {
  productoId?: string;
  descripcion: string;
  detalle: string;
  /** Cuando es true la cantidad se calcula con largo × ancho. */
  aMedida: boolean;
  puedeMedida: boolean;
  largo: number;
  ancho: number;
  unidades: number;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  unidad: string;
  imagenUrl?: string | null;
  tipo: "PRODUCTO" | "INSTALACION";
}

/** m² = largo × ancho × número de piezas, redondeado a 2 decimales. */
function metrosCuadrados(l: number, a: number, u: number): number {
  return Math.round(l * a * Math.max(u, 1) * 100) / 100;
}

function CotizadorContent() {
  const router = useRouter();

  const [clienteId, setClienteId] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clienteBusq, setClienteBusq] = useState("");
  const [prodBusq, setProdBusq] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [notas, setNotas] = useState("");
  const [plantilla, setPlantilla] = useState<"EXPRESS" | "PROPUESTA">("EXPRESS");
  const [validezDias, setValidezDias] = useState(3);
  const [incluyeInstalacion, setIncluyeInstalacion] = useState(false);
  const [ciudadInstalacion, setCiudadInstalacion] = useState("");
  const [direccionInstalacion, setDireccionInstalacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["cot-clientes", clienteBusq],
    enabled: clienteBusq.length > 1,
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
  });

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["cot-productos", prodBusq],
    enabled: prodBusq.length > 1,
    queryFn: async () => (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(prodBusq)}&limit=8`)).json()).data ?? [],
  });

  const { data: catalogo } = useQuery<{ servicios: ServicioInstalacion[]; ciudades: RecargoCiudad[] }>({
    queryKey: ["instalacion-catalogo-activo"],
    queryFn: async () => (await (await fetch("/api/crm/instalacion-catalogo")).json()).data ?? { servicios: [], ciudades: [] },
  });

  const servicios = catalogo?.servicios ?? [];
  const ciudades = catalogo?.ciudades ?? [];
  const recargo = ciudades.find(c => c.ciudad.toLowerCase() === ciudadInstalacion.trim().toLowerCase());

  // ── Líneas ──
  const agregarProducto = (p: Producto) => {
    const puedeMedida = Boolean(p.acfFabricacionMedida);
    setLineas(prev => [...prev, {
      productoId: p.id,
      descripcion: p.nombre,
      detalle: "",
      aMedida: puedeMedida,
      puedeMedida,
      largo: 1, ancho: 1, unidades: 1,
      cantidad: 1,
      precioUnitario: p.precioNormal ?? 0,
      descuento: 0,
      unidad: puedeMedida ? "m2" : (p.acfUnidadVenta ?? "unidad"),
      imagenUrl: p.imagenPrincipal ?? null,
      tipo: "PRODUCTO",
    }]);
    setProdBusq("");
  };

  /** Instalación sin precio cerrado: queda en la oferta como "a convenir". */
  const agregarInstalacionLibre = () => {
    setLineas(prev => [...prev, {
      descripcion: "Instalación",
      detalle: "El valor se confirma con la visita técnica.",
      aMedida: false, puedeMedida: false,
      largo: 1, ancho: 1, unidades: 1,
      cantidad: 1,
      precioUnitario: 0,
      descuento: 0,
      unidad: "global",
      tipo: "INSTALACION",
    }]);
  };

  /**
   * Al desmarcar la instalación se quitan sus líneas: dejarlas escondidas
   * sumando al total es peor que borrarlas, porque el asesor vería un
   * total que no cuadra con lo que ve en pantalla.
   */
  const alternarInstalacion = (valor: boolean) => {
    if (!valor && lineas.some(l => l.tipo === "INSTALACION")) {
      if (!confirm("Se quitarán las líneas de instalación de esta cotización. ¿Sigo?")) return;
      setLineas(prev => prev.filter(l => l.tipo !== "INSTALACION"));
      setCiudadInstalacion("");
      setDireccionInstalacion("");
    }
    setIncluyeInstalacion(valor);
  };

  const agregarServicio = (s: ServicioInstalacion) => {
    setLineas(prev => [...prev, {
      descripcion: s.nombre,
      detalle: s.descripcion ?? "",
      aMedida: false, puedeMedida: false,
      largo: 1, ancho: 1, unidades: 1,
      cantidad: 1,
      precioUnitario: s.precioBase,
      descuento: 0,
      unidad: s.unidad,
      tipo: "INSTALACION",
    }]);
  };

  const actualizar = (i: number, cambios: Partial<Linea>) => {
    setLineas(prev => prev.map((l, n) => {
      if (n !== i) return l;
      const nueva = { ...l, ...cambios };
      if (nueva.aMedida) nueva.cantidad = metrosCuadrados(nueva.largo, nueva.ancho, nueva.unidades);
      return nueva;
    }));
  };

  const quitar = (i: number) => setLineas(prev => prev.filter((_, n) => n !== i));

  // ── Totales ──
  const { subtotal, valorInstalacion, recargoValor, base, iva, total } = useMemo(() => {
    const sub = lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0);
    const inst = lineas.filter(l => l.tipo === "INSTALACION")
      .reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0);
    // El recargo por desplazamiento se calcula SOLO sobre la instalación:
    // llevar la cuadrilla a otra ciudad no encarece el material.
    const rec = recargo ? inst * (recargo.porcentaje / 100) + (inst > 0 ? recargo.montoFijo : 0) : 0;
    const conRecargo = sub + rec;
    const b = conRecargo * (1 - descuentoGlobal / 100);
    const i = b * IVA;
    return { subtotal: sub, valorInstalacion: inst, recargoValor: rec, base: b, iva: i, total: b + i };
  }, [lineas, descuentoGlobal, recargo]);

  // El sitio de instalación se pide en cuanto se marca la casilla, no
  // cuando ya se agregó una línea: la ciudad es la que define el recargo.
  const hayInstalacion = incluyeInstalacion || lineas.some(l => l.tipo === "INSTALACION");

  const guardar = async () => {
    if (!clienteId) return toast.error("Elige un cliente");
    if (lineas.length === 0) return toast.error("Agrega al menos un producto");
    if (lineas.some(l => l.cantidad <= 0)) return toast.error("Hay líneas en cantidad cero");

    setGuardando(true);
    try {
      const items = lineas.map(l => ({
        productoId: l.productoId,
        descripcion: l.descripcion,
        detalle: [
          l.aMedida ? `Medidas: ${l.largo} × ${l.ancho} m${l.unidades > 1 ? ` · ${l.unidades} piezas` : ""}` : "",
          l.detalle,
        ].filter(Boolean).join("\n") || undefined,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuento: l.descuento,
        unidad: l.unidad,
        tipo: l.tipo,
        imagenUrl: l.imagenUrl ?? undefined,
      }));

      // El recargo por ciudad viaja como un ítem más: así queda a la vista
      // del cliente en vez de aparecer como un aumento sin explicación.
      if (recargoValor > 0) {
        items.push({
          descripcion: `Desplazamiento y viáticos — ${ciudadInstalacion}`,
          cantidad: 1,
          precioUnitario: Math.round(recargoValor),
          descuento: 0,
          unidad: "global",
          tipo: "INSTALACION",
          detalle: recargo ? `Recargo ${recargo.porcentaje > 0 ? `${recargo.porcentaje}%` : ""}${recargo.porcentaje > 0 && recargo.montoFijo > 0 ? " + " : ""}${recargo.montoFijo > 0 ? formatCOP(recargo.montoFijo) : ""} sobre el valor de la instalación.` : undefined,
          productoId: undefined,
          imagenUrl: undefined,
        });
      }

      const res = await fetch("/api/crm/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId, items, notas, descuentoGlobal, validezDias,
          tieneInstalacion: hayInstalacion,
          plantilla,
          ciudadInstalacion: ciudadInstalacion || undefined,
          direccionInstalacion: direccionInstalacion || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success(`${j.data.numero} guardada como borrador`);
      router.push(`/crm/cotizaciones/${j.data.id}`);
    } finally { setGuardando(false); }
  };

  return (
    <>
      <Topbar title="Nueva cotización" actions={
        <div className="flex items-center gap-2">
          <Link href="/crm/cotizaciones" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={guardar} disabled={guardando} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar borrador
          </button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Cliente */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Cliente</p>
            {cliente ? (
              <div className="flex items-center gap-3 p-3 rounded-xl surface-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: CRM_COLOR }}>
                  {cliente.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{cliente.nombre}</p>
                  <p className="text-xs text-muted truncate">
                    {[cliente.empresa, cliente.telefono, cliente.ciudad].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button onClick={() => { setCliente(null); setClienteId(""); }} className="text-muted hover:text-red-500"><X size={15} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente por nombre, empresa o teléfono…" />
                {clientes.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 card p-1 max-h-56 overflow-y-auto">
                    {clientes.map(c => (
                      <button key={c.id} onClick={() => { setCliente(c); setClienteId(c.id); setClienteBusq(""); if (!ciudadInstalacion && c.ciudad) setCiudadInstalacion(c.ciudad); }}
                        className="w-full text-left p-2 rounded-lg hover:brand-bg-10">
                        <p className="text-xs font-semibold text-soft">{c.nombre}</p>
                        <p className="text-[10px] text-muted">{[c.empresa, c.ciudad].filter(Boolean).join(" · ")}</p>
                      </button>
                    ))}
                  </div>
                )}
                <Link href="/crm/clientes/nuevo" className="text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: CRM_COLOR }}>
                  <UserPlus size={12} /> Crear cliente nuevo
                </Link>
              </div>
            )}
          </div>

          {/* Productos */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Productos y servicios</p>

            <div className="relative mb-4">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-9" value={prodBusq} onChange={e => setProdBusq(e.target.value)} placeholder="Buscar producto por nombre o SKU…" />
              {productos.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 card p-1 max-h-64 overflow-y-auto">
                  {productos.map(p => (
                    <button key={p.id} onClick={() => agregarProducto(p)} className="w-full text-left p-2 rounded-lg hover:brand-bg-10 flex items-center gap-2">
                      {p.imagenPrincipal
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imagenPrincipal} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded surface-3 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-soft truncate">{p.nombre}</p>
                        <p className="text-[10px] text-muted font-mono">
                          {p.sku} · {p.precioNormal ? formatCOP(p.precioNormal) : "sin precio"}
                          {p.acfFabricacionMedida && <span className="ml-1" style={{ color: CRM_COLOR }}>· a medida</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── ¿Lleva instalación? ── */}
            <div className="mb-4 p-3 rounded-xl surface-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={incluyeInstalacion}
                  onChange={e => alternarInstalacion(e.target.checked)}
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-soft flex items-center gap-1.5">
                    <Wrench size={12} /> Esta cotización incluye instalación
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Márcalo si además del material se cobra la mano de obra. Sale discriminada en la oferta.
                  </p>
                </div>
              </label>

              {incluyeInstalacion && (
                <div className="mt-3 pt-3 border-t divider space-y-2">
                  {servicios.length > 0 ? (
                    <>
                      <p className="text-[11px] font-semibold text-muted">Elige el servicio</p>
                      <div className="flex flex-wrap gap-1.5">
                        {servicios.map(s => (
                          <button key={s.id} onClick={() => agregarServicio(s)} className="pill text-xs">
                            + {s.nombre} <span className="text-muted">({formatCOP(s.precioBase)}/{s.unidad})</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted">
                      No hay servicios en el catálogo todavía. Se pueden cargar en Configuración → Instalación, o
                      agregar la instalación a mano aquí abajo.
                    </p>
                  )}

                  {/* Hay cerramientos que no se pueden costear en la primera
                      visita. Mejor dejarla escrita en la oferta que omitirla. */}
                  <button onClick={agregarInstalacionLibre} className="pill text-xs">
                    + Instalación a convenir <span className="text-muted">(sin precio por ahora)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Líneas */}
            {lineas.length === 0 ? (
              <div className="p-8 text-center surface-2 rounded-xl">
                <Package size={22} className="mx-auto mb-2 text-muted" />
                <p className="text-xs text-muted">Busca un producto arriba para empezar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lineas.map((l, i) => (
                  <div key={i} className="p-3 rounded-xl surface-2" style={l.tipo === "INSTALACION" ? { borderLeft: `3px solid ${CRM_COLOR}` } : undefined}>
                    <div className="flex items-start gap-3">
                      {l.tipo === "INSTALACION" ? (
                        <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CRM_COLOR + "20" }}>
                          <Wrench size={14} style={{ color: CRM_COLOR }} />
                        </div>
                      ) : l.imagenUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.imagenUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded surface-3 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <input
                          className="input py-1 text-xs font-semibold"
                          value={l.descripcion}
                          onChange={e => actualizar(i, { descripcion: e.target.value })}
                        />
                        {l.puedeMedida && (
                          <label className="flex items-center gap-1.5 text-[11px] text-soft mt-1.5 cursor-pointer">
                            <input type="checkbox" checked={l.aMedida} onChange={e => actualizar(i, { aMedida: e.target.checked, unidad: e.target.checked ? "m2" : "unidad" })} />
                            <Ruler size={11} /> Fabricar a la medida
                          </label>
                        )}
                      </div>

                      <button onClick={() => quitar(i)} className="text-muted hover:text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2.5">
                      {l.aMedida ? (
                        <>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Largo (m)</label>
                            <input type="number" step="0.01" className="input py-1 text-xs" value={l.largo} onChange={e => actualizar(i, { largo: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Ancho (m)</label>
                            <input type="number" step="0.01" className="input py-1 text-xs" value={l.ancho} onChange={e => actualizar(i, { ancho: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Piezas</label>
                            <input type="number" className="input py-1 text-xs" value={l.unidades} onChange={e => actualizar(i, { unidades: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Total m²</label>
                            <div className="input py-1 text-xs font-bold flex items-center" style={{ color: CRM_COLOR }}>{l.cantidad}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Cantidad</label>
                            <input type="number" step="0.01" className="input py-1 text-xs" value={l.cantidad} onChange={e => actualizar(i, { cantidad: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Unidad</label>
                            <input className="input py-1 text-xs" value={l.unidad} onChange={e => actualizar(i, { unidad: e.target.value })} />
                          </div>
                        </>
                      )}
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">V. unitario</label>
                        <input type="number" className="input py-1 text-xs" value={l.precioUnitario} onChange={e => actualizar(i, { precioUnitario: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Desc. %</label>
                        <input type="number" className="input py-1 text-xs" value={l.descuento} onChange={e => actualizar(i, { descuento: Number(e.target.value) })} />
                      </div>
                      <div className={l.aMedida ? "" : "md:col-span-2"}>
                        <label className="block text-[9px] font-bold uppercase text-muted mb-0.5">Subtotal</label>
                        <div className="input py-1 text-xs font-bold flex items-center">
                          {formatCOP(l.cantidad * l.precioUnitario * (1 - l.descuento / 100))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instalación: dónde */}
          {hayInstalacion && (
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-1.5"><MapPin size={12} /> Sitio de instalación</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Ciudad</label>
                  <input className="input" value={ciudadInstalacion} onChange={e => setCiudadInstalacion(e.target.value)} placeholder="Barranquilla" list="ciudades-recargo" />
                  <datalist id="ciudades-recargo">
                    {ciudades.map(c => <option key={c.id} value={c.ciudad} />)}
                  </datalist>
                  {recargo && (
                    <p className="text-[11px] mt-1 font-semibold" style={{ color: CRM_COLOR }}>
                      Recargo por desplazamiento: {recargo.porcentaje > 0 && `${recargo.porcentaje}%`}
                      {recargo.porcentaje > 0 && recargo.montoFijo > 0 && " + "}
                      {recargo.montoFijo > 0 && formatCOP(recargo.montoFijo)} → {formatCOP(recargoValor)}
                    </p>
                  )}
                  {!recargo && ciudadInstalacion.trim().length > 2 && (
                    <p className="text-[11px] text-muted mt-1">Sin recargo configurado para esta ciudad.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Dirección</label>
                  <input className="input" value={direccionInstalacion} onChange={e => setDireccionInstalacion(e.target.value)} placeholder="Km 8 vía Ciénaga, Bodega 4" />
                </div>
              </div>
            </div>
          )}

          {/* Documento y totales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5"><LayoutTemplate size={12} /> Documento</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "EXPRESS", l: "Express", d: "1-2 hojas" },
                  { v: "PROPUESTA", l: "Propuesta", d: "Dossier completo" },
                ] as const).map(p => (
                  <button key={p.v} onClick={() => setPlantilla(p.v)}
                    className={cn("p-3 rounded-xl text-left transition-all", plantilla === p.v ? "text-white" : "surface-2")}
                    style={plantilla === p.v ? { backgroundColor: CRM_COLOR } : undefined}>
                    <p className="text-xs font-bold flex items-center gap-1.5"><FileText size={12} /> {p.l}</p>
                    <p className={cn("text-[10px] mt-0.5", plantilla === p.v ? "text-white/80" : "text-muted")}>{p.d}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Validez (días)</label>
                <input type="number" className="input max-w-[120px]" value={validezDias} onChange={e => setValidezDias(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Observaciones de esta oferta</label>
                <textarea className="input resize-none" rows={3} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Lo particular de este negocio. Las condiciones comerciales fijas ya salen solas." />
              </div>
            </div>

            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Totales</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-soft"><span>Subtotal</span><span className="font-semibold">{formatCOP(subtotal)}</span></div>
                {valorInstalacion > 0 && (
                  <div className="flex justify-between text-[11px] text-muted"><span>· de eso, instalación</span><span>{formatCOP(valorInstalacion)}</span></div>
                )}
                {recargoValor > 0 && (
                  <div className="flex justify-between text-xs" style={{ color: CRM_COLOR }}><span>Desplazamiento a {ciudadInstalacion}</span><span className="font-semibold">{formatCOP(recargoValor)}</span></div>
                )}
                <div className="flex justify-between items-center text-xs text-soft">
                  <span>Descuento global</span>
                  <div className="flex items-center gap-1">
                    <input type="number" className="input py-0.5 text-xs w-16 text-right" value={descuentoGlobal} onChange={e => setDescuentoGlobal(Number(e.target.value))} />
                    <span className="text-muted">%</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-soft"><span>IVA 19%</span><span className="font-semibold">{formatCOP(iva)}</span></div>
                <div className="flex justify-between items-center pt-3 mt-1 border-t divider">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Total</span>
                  <span className="text-xl font-black" style={{ color: CRM_COLOR }}>{formatCOP(total)}</span>
                </div>
              </div>

              <button onClick={guardar} disabled={guardando} className="w-full mt-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar borrador
              </button>
              <p className="text-[11px] text-muted mt-2 text-center">
                Se guarda como borrador. En la cotización podrás imprimirla, mandarla por correo o compartir el enlace.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><CotizadorContent /></Suspense>;
}
