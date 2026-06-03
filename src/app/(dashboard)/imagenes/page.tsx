"use client";
import { useState, useRef, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Upload, Trash2, Star, Loader2, ImageIcon, Search, RefreshCw, AlertTriangle, CheckCircle, Plus } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { useBrand } from "@/contexts/BrandContext";

interface AcfImagen { id: string; productoId: string; urlImagen: string; altText: string | null; esPrincipal: boolean; posicion: number; }
interface ProductoConImagenes {
  id: string; sku: string; nombre: string; categorias: string[]; intEstado: string;
  _count: { imagenes: number }; imagenPrincipal?: string | null;
}
type FiltroImg = "todos" | "con_imagenes" | "sin_imagenes";

async function fetchProductos(filtro: FiltroImg, busqueda: string) {
  const params = new URLSearchParams({ limit: "200", orderBy: "nombre" });
  if (busqueda) params.set("busqueda", busqueda);
  const res = await fetch(`/api/productos?${params}`);
  const json = await res.json();
  const productos: ProductoConImagenes[] = json.data ?? [];
  if (filtro === "con_imagenes") return productos.filter(p => p._count.imagenes > 0);
  if (filtro === "sin_imagenes") return productos.filter(p => p._count.imagenes === 0);
  return productos;
}

async function fetchImagenes(productoId: string): Promise<AcfImagen[]> {
  const res = await fetch(`/api/imagenes?productoId=${productoId}`);
  return (await res.json()).data ?? [];
}

function UploadButton({ productoId, onDone }: { productoId: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { brand } = useBrand();

  const handleUpload = async (files: FileList | null) => {
    if (!files || !productoId) return;
    setUploading(true);
    const arr = Array.from(files);
    let ok = 0;
    for (const file of arr) {
      const fd = new FormData();
      fd.append("file", file); fd.append("productoId", productoId); fd.append("esPrincipal", String(ok === 0));
      try {
        const res = await fetch("/api/imagenes/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || !json.success) toast.error(`${file.name}: ${json.error}`);
        else ok++;
      } catch { toast.error(`Error: ${file.name}`); }
    }
    if (ok > 0) toast.success(`${ok} imagen${ok > 1 ? "es" : ""} subidas`);
    setUploading(false); onDone();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 flex-shrink-0"
        style={{ backgroundColor: brand.brandColor }}
      >
        {uploading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
        Agregar
      </button>
    </>
  );
}

function ProductoImageRow({ producto }: { producto: ProductoConImagenes }) {
  const qc = useQueryClient();
  const { brand } = useBrand();

  const { data: imagenes = [], isLoading } = useQuery({
    queryKey: ["imagenes", producto.id],
    queryFn: () => fetchImagenes(producto.id),
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar imagen?")) return;
    const res = await fetch(`/api/imagenes?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Eliminada");
      qc.invalidateQueries({ queryKey: ["imagenes", producto.id] });
      qc.invalidateQueries({ queryKey: ["productos-imagenes"] });
    } else toast.error(json.error ?? "Error");
  };

  const handlePrincipal = async (id: string) => {
    const res = await fetch("/api/imagenes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, esPrincipal: true }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Principal actualizada");
      qc.invalidateQueries({ queryKey: ["imagenes", producto.id] });
    }
  };

  return (
    <div className="card p-4">
      {/* Product header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 relative flex-shrink-0">
          {producto.imagenPrincipal ? (
            <Image src={producto.imagenPrincipal} alt={producto.nombre} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-gray-300" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{producto.nombre}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-gray-400">{producto.sku}</span>
            {producto.categorias?.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: brand.brandColor + "15", color: brand.brandColor }}>
                {producto.categorias[0]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {imagenes.length === 0
            ? <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg"><AlertTriangle size={10} />Sin fotos</span>
            : <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg"><CheckCircle size={10} />{imagenes.length} foto{imagenes.length !== 1 ? "s" : ""}</span>
          }
          <UploadButton
            productoId={producto.id}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["imagenes", producto.id] });
              qc.invalidateQueries({ queryKey: ["productos-imagenes"] });
            }}
          />
        </div>
      </div>

      {/* Photos strip */}
      {isLoading ? (
        <div className="h-16 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: brand.brandColor }} />
        </div>
      ) : imagenes.length === 0 ? (
        <div className="h-16 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-400">Sin imágenes — haz clic en Agregar</p>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {imagenes.map(img => (
            <div key={img.id} className="relative group w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0"
              style={{ borderColor: img.esPrincipal ? brand.brandColor : "transparent" }}>
              <Image src={img.urlImagen} alt={img.altText ?? ""} fill className="object-cover" unoptimized />
              {img.esPrincipal && (
                <div className="absolute top-0.5 left-0.5">
                  <Star size={8} className="text-white drop-shadow" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                {!img.esPrincipal && (
                  <button onClick={() => handlePrincipal(img.id)} className="p-1 rounded-md bg-white/90 text-gray-700 hover:bg-white" title="Principal">
                    <Star size={10} />
                  </button>
                )}
                <button onClick={() => handleDelete(img.id)} className="p-1 rounded-md bg-red-500 text-white hover:bg-red-600" title="Eliminar">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FILTROS: { key: FiltroImg; label: string; color: string }[] = [
  { key: "todos",        label: "Todos",         color: "#6b7280" },
  { key: "con_imagenes", label: "Con imágenes",  color: "#16a34a" },
  { key: "sin_imagenes", label: "Sin imágenes",  color: "#dc2626" },
];

function ImagenesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroImg>("todos");
  const { brand } = useBrand();

  const { data: productos = [], isLoading, refetch } = useQuery<ProductoConImagenes[]>({
    queryKey: ["productos-imagenes", filtro, busqueda],
    queryFn: () => fetchProductos(filtro, busqueda),
  });

  const conImg = productos.filter(p => p._count.imagenes > 0).length;
  const sinImg = productos.filter(p => p._count.imagenes === 0).length;
  const totalImg = productos.reduce((s, p) => s + p._count.imagenes, 0);

  return (
    <>
      <Topbar title="Gestión de imágenes" actions={
        <button onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Actualizar
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-5 pb-0">
          {[
            { label: "Productos", val: productos.length, color: brand.brandColor },
            { label: "Con imágenes", val: conImg, color: "#16a34a" },
            { label: "Sin imágenes", val: sinImg, color: "#dc2626" },
            { label: "Total FTP", val: totalImg, color: "#7c3aed" },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="px-5 py-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={filtro === f.key ? { backgroundColor: f.color, color: "white" } : { color: "#6b7280" }}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} className="input pl-9 py-1.5 text-xs" placeholder="Buscar producto..." />
          </div>
        </div>

        {/* Product list */}
        <div className="px-5 pb-6 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={22} className="animate-spin mr-2" style={{ color: brand.brandColor }} />
              <span className="text-sm text-gray-400">Cargando...</span>
            </div>
          ) : productos.length === 0 ? (
            <div className="card p-12 text-center">
              <ImageIcon size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Sin productos</p>
            </div>
          ) : (
            productos.map(p => <ProductoImageRow key={p.id} producto={p} />)
          )}
        </div>
      </div>
    </>
  );
}

export default function ImagenesPage() { return <Suspense><ImagenesContent /></Suspense>; }
