"use client";
import { useState, useRef, Suspense, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Upload, Trash2, Star, Loader2, ImageIcon, Search, RefreshCw,
  AlertTriangle, CheckCircle, Plus, ChevronRight, Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { useBrand } from "@/contexts/BrandContext";

interface AcfImagen { id: string; productoId: string; urlImagen: string; altText: string | null; esPrincipal: boolean; posicion: number; }
interface ProductoConImagenes {
  id: string; sku: string; nombre: string; categorias: string[]; intEstado: string;
  _count: { imagenes: number }; imagenPrincipal?: string | null;
}
type FiltroImg = "todos" | "con_imagenes" | "sin_imagenes";

async function fetchProductos(busqueda: string): Promise<ProductoConImagenes[]> {
  const params = new URLSearchParams({ limit: "100", orderBy: "nombre", order: "asc" });
  if (busqueda) params.set("busqueda", busqueda);
  const res = await fetch(`/api/productos?${params}`);
  return (await res.json()).data ?? [];
}
async function fetchImagenes(productoId: string): Promise<AcfImagen[]> {
  const res = await fetch(`/api/imagenes?productoId=${productoId}`);
  return (await res.json()).data ?? [];
}

// ── Panel derecho: gestión de imágenes de un producto ──
function PanelProducto({ producto }: { producto: ProductoConImagenes }) {
  const qc = useQueryClient();
  const { brand } = useBrand();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragImgId, setDragImgId] = useState<string | null>(null);

  const { data: imagenes = [], isLoading } = useQuery({
    queryKey: ["imagenes", producto.id],
    queryFn: () => fetchImagenes(producto.id),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["imagenes", producto.id] });
    qc.invalidateQueries({ queryKey: ["productos-imagenes"] });
  };

  const upload = async (files: FileList | File[] | null) => {
    if (!files) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const fd = new FormData();
      fd.append("file", file); fd.append("productoId", producto.id); fd.append("esPrincipal", String(ok === 0 && imagenes.length === 0));
      try {
        const res = await fetch("/api/imagenes/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || !json.success) toast.error(`${file.name}: ${json.error}`);
        else ok++;
      } catch { toast.error(`Error: ${file.name}`); }
    }
    if (ok > 0) { toast.success(`${ok} imagen${ok > 1 ? "es" : ""} subida${ok > 1 ? "s" : ""}`); refresh(); }
    setUploading(false);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar imagen?")) return;
    if ((await (await fetch(`/api/imagenes?id=${id}`, { method: "DELETE" })).json()).success) { toast.success("Eliminada"); refresh(); }
  };
  const principal = async (id: string) => {
    if ((await (await fetch("/api/imagenes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, esPrincipal: true }) })).json()).success) { toast.success("Principal actualizada"); refresh(); }
  };

  const reordenar = async (targetId: string) => {
    if (!dragImgId || dragImgId === targetId) return;
    const ids = imagenes.map(i => i.id);
    const from = ids.indexOf(dragImgId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    const json = await (await fetch("/api/imagenes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productoId: producto.id, orden: ids }) })).json();
    if (json.success) { toast.success("Orden actualizado"); refresh(); }
    else toast.error(json.error ?? "Error al reordenar");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header producto */}
      <div className="flex items-center gap-3 px-6 py-4 border-b divider flex-shrink-0">
        <div className="w-12 h-12 rounded-xl overflow-hidden surface-2 relative flex-shrink-0">
          {producto.imagenPrincipal
            ? <Image src={producto.imagenPrincipal} alt={producto.nombre} fill className="object-cover" unoptimized />
            : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-muted" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-800 dark:text-gray-100 truncate">{producto.nombre}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="sku-tag">{producto.sku}</span>
            {producto.categorias?.[0] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: brand.brandColor + "15", color: brand.brandColor }}>{producto.categorias[0]}</span>
            )}
            <span className="text-xs text-muted">· {imagenes.length} foto{imagenes.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => upload(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50 flex-shrink-0" style={{ backgroundColor: brand.brandColor }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Subir imágenes
        </button>
      </div>

      {/* Zona de drop + galería */}
      <div className="flex-1 overflow-y-auto p-6">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
          className="rounded-2xl border-2 border-dashed transition-all p-1"
          style={{ borderColor: dragOver ? brand.brandColor : "var(--border)", backgroundColor: dragOver ? brand.brandColor + "0c" : "transparent" }}
        >
          {isLoading ? (
            <div className="h-40 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: brand.brandColor }} /></div>
          ) : imagenes.length === 0 ? (
            <div onClick={() => fileRef.current?.click()} className="h-48 flex flex-col items-center justify-center gap-2 cursor-pointer">
              <div className="w-14 h-14 rounded-2xl surface-2 flex items-center justify-center"><Upload size={24} className="text-muted" /></div>
              <p className="text-sm font-semibold text-soft">Arrastra imágenes aquí o haz clic para subir</p>
              <p className="text-xs text-muted">JPG, PNG, WEBP · varias a la vez</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
              {imagenes.map((img, idx) => (
                <div key={img.id} draggable
                  onDragStart={() => setDragImgId(img.id)}
                  onDragEnd={() => setDragImgId(null)}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); reordenar(img.id); }}
                  className={`relative group aspect-square rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing ${dragImgId === img.id ? "opacity-40" : ""}`}
                  style={{ borderColor: img.esPrincipal ? "#FFCC00" : "var(--border)" }}>
                  <Image src={img.urlImagen} alt={img.altText ?? ""} fill className="object-cover" unoptimized />
                  <div className="absolute bottom-2 left-2 min-w-5 h-5 px-1 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</div>
                  {img.esPrincipal && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      <Star size={9} className="fill-white" /> Principal
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!img.esPrincipal && (
                      <button onClick={() => principal(img.id)} className="w-9 h-9 rounded-xl bg-yellow-400 text-white flex items-center justify-center" title="Marcar principal"><Star size={15} /></button>
                    )}
                    <button onClick={() => eliminar(img.id)} className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center" title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {/* Tile agregar */}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed divider flex flex-col items-center justify-center gap-1.5 hover:surface-2 transition-colors">
                {uploading ? <Loader2 size={20} className="animate-spin text-muted" /> : <Plus size={20} className="text-muted" />}
                <span className="text-[11px] text-muted font-medium">Agregar</span>
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted mt-3 text-center">Arrastra las miniaturas para cambiar el orden (así aparecerán en WooCommerce). La <span className="font-semibold text-yellow-500">Principal ⭐</span> siempre es la primera y es la que se muestra en la tienda y los listados.</p>
      </div>
    </div>
  );
}

const FILTROS: { key: FiltroImg; label: string; color: string }[] = [
  { key: "todos",        label: "Todos",        color: "#64748b" },
  { key: "con_imagenes", label: "Con fotos",    color: "#16a34a" },
  { key: "sin_imagenes", label: "Sin fotos",    color: "#dc2626" },
];

function ImagenesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroImg>("todos");
  const [selId, setSelId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { brand } = useBrand();

  const { data: productos = [], isLoading, refetch } = useQuery<ProductoConImagenes[]>({
    queryKey: ["productos-imagenes", busqueda],
    queryFn: () => fetchProductos(busqueda),
  });

  const conImg = productos.filter(p => (p._count?.imagenes ?? 0) > 0).length;
  const sinImg = productos.filter(p => (p._count?.imagenes ?? 0) === 0).length;
  const totalImg = productos.reduce((s, p) => s + (p._count?.imagenes ?? 0), 0);
  const cobertura = productos.length > 0 ? Math.round((conImg / productos.length) * 100) : 0;

  const lista = productos.filter(p => {
    const n = p._count?.imagenes ?? 0;
    if (filtro === "con_imagenes") return n > 0;
    if (filtro === "sin_imagenes") return n === 0;
    return true;
  });

  // Selección automática del primero
  useEffect(() => {
    if (!selId && lista.length > 0) setSelId(lista[0].id);
    if (selId && !lista.some(p => p.id === selId) && lista.length > 0) setSelId(lista[0].id);
  }, [lista, selId]);

  const seleccionado = productos.find(p => p.id === selId) ?? null;

  const handleRefresh = async () => { setRefreshing(true); await refetch(); toast.success("Imágenes actualizadas"); setTimeout(() => setRefreshing(false), 2200); };

  return (
    <>
      <Topbar title="Biblioteca de imágenes" actions={
        <button onClick={handleRefresh} className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}>
          <RefreshCw size={12} className={refreshing ? "animate-spin-once" : ""} /> Actualizar
        </button>
      } />

      {/* Barra de cobertura */}
      <div className="px-6 py-3 flex items-center gap-4 flex-wrap border-b divider surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={15} style={{ color: brand.brandColor }} />
          <span className="text-xs text-muted">Cobertura del catálogo</span>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="flex-1 h-2 rounded-full surface-3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cobertura}%`, backgroundColor: cobertura >= 80 ? "#16a34a" : cobertura >= 50 ? "#d97706" : "#dc2626" }} />
          </div>
          <span className="text-xs font-bold" style={{ color: cobertura >= 80 ? "#16a34a" : cobertura >= 50 ? "#d97706" : "#dc2626" }}>{cobertura}%</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted"><b className="text-soft">{productos.length}</b> productos</span>
          <span className="text-emerald-600"><b>{conImg}</b> con fotos</span>
          <span className="text-red-500"><b>{sinImg}</b> sin fotos</span>
          <span className="text-muted"><b className="text-soft">{totalImg}</b> imágenes</span>
        </div>
      </div>

      {/* Maestro-detalle */}
      <div className="flex-1 overflow-hidden flex">
        {/* Lista de productos (maestro) */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r divider surface">
          <div className="p-3 space-y-2 border-b divider flex-shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} className="input pl-9 py-1.5 text-xs" placeholder="Buscar producto..." />
            </div>
            <div className="flex gap-1.5">
              {FILTROS.map(f => (
                <button key={f.key} onClick={() => setFiltro(f.key)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={filtro === f.key ? { backgroundColor: f.color, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: brand.brandColor }} /></div>
            ) : lista.length === 0 ? (
              <div className="p-8 text-center"><ImageIcon size={24} className="mx-auto mb-2 text-muted" /><p className="text-sm text-muted">Sin productos</p></div>
            ) : lista.map(p => {
              const n = p._count?.imagenes ?? 0;
              const activo = p.id === selId;
              return (
                <button key={p.id} onClick={() => setSelId(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-l-2"
                  style={activo ? { backgroundColor: brand.brandColor + "12", borderLeftColor: brand.brandColor } : { borderLeftColor: "transparent" }}>
                  <div className="w-10 h-10 rounded-lg overflow-hidden surface-2 relative flex-shrink-0">
                    {p.imagenPrincipal
                      ? <Image src={p.imagenPrincipal} alt="" fill className="object-cover" unoptimized />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-muted font-mono">{p.sku}</p>
                  </div>
                  {n > 0
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0"><CheckCircle size={9} />{n}</span>
                    : <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0"><AlertTriangle size={9} /></span>}
                  <ChevronRight size={13} className={activo ? "" : "text-muted"} style={activo ? { color: brand.brandColor } : {}} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalle */}
        {seleccionado ? (
          <PanelProducto producto={seleccionado} key={seleccionado.id} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 page-bg">
            <ImageIcon size={32} className="text-muted" />
            <p className="text-sm text-muted">Selecciona un producto para gestionar sus imágenes</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function ImagenesPage() { return <Suspense><ImagenesContent /></Suspense>; }
