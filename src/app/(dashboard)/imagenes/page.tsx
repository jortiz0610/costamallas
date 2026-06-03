"use client";
import { useState, useRef, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Upload, Trash2, Star, Loader2, ImageIcon, X, Search, Grid3X3, List, AlertTriangle, Package, RefreshCw, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { useBrand } from "@/contexts/BrandContext";

interface AcfImagen { id: string; productoId: string; urlImagen: string; altText: string | null; esPrincipal: boolean; posicion: number; }
interface ProductoConImagenes { id: string; sku: string; nombre: string; categorias: string[]; intEstado: string; _count: { imagenes: number }; imagenPrincipal?: string | null; }
type FiltroImg = "todos" | "con_imagenes" | "sin_imagenes";
type Vista = "grid" | "list";

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

function UploadZone({ productoId, onDone }: { productoId: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [prog, setProg] = useState(0);
  const [total, setTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { brand } = useBrand();

  const handleUpload = async (files: FileList | null) => {
    if (!files || !productoId) return;
    setUploading(true);
    const arr = Array.from(files);
    setTotal(arr.length); setProg(0);
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
      setProg(p => p + 1);
    }
    if (ok > 0) toast.success(`${ok} imagen${ok > 1 ? "es" : ""} subida${ok > 1 ? "s" : ""} a FTP Hostinger`);
    setUploading(false); onDone();
  };

  return (
    <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
      onClick={() => !uploading && fileRef.current?.click()}
      className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all"
      style={{ borderColor: dragOver ? brand.brandColor : "#e2e8f0", backgroundColor: dragOver ? brand.brandColor + "08" : "transparent" }}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
      {uploading ? (
        <div className="space-y-2">
          <Loader2 size={22} className="animate-spin mx-auto" style={{ color: brand.brandColor }} />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Subiendo {prog}/{total} a catalogo.costamallas.com...</p>
          <div className="w-full max-w-xs mx-auto bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${(prog/total)*100}%`, backgroundColor: brand.brandColor }} />
          </div>
        </div>
      ) : (
        <>
          <Upload size={22} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Arrastra imagenes o haz clic</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · max 5MB · FTP Hostinger</p>
        </>
      )}
    </div>
  );
}

function GaleriaProducto({ productoId, onClose }: { productoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { brand } = useBrand();
  const { data: imagenes = [], isLoading } = useQuery({
    queryKey: ["imagenes", productoId],
    queryFn: () => fetchImagenes(productoId),
    enabled: !!productoId,
  });
  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta imagen del FTP?")) return;
    const res = await fetch(`/api/imagenes?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) { toast.success("Eliminada"); qc.invalidateQueries({ queryKey: ["imagenes", productoId] }); qc.invalidateQueries({ queryKey: ["productos-imagenes"] }); }
    else toast.error(json.error ?? "Error");
  };
  const handlePrincipal = async (id: string) => {
    const res = await fetch("/api/imagenes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, esPrincipal: true }) });
    const json = await res.json();
    if (json.success) { toast.success("Principal actualizada"); qc.invalidateQueries({ queryKey: ["imagenes", productoId] }); }
  };
  return (
    <div className="space-y-4">
      <UploadZone productoId={productoId} onDone={() => { qc.invalidateQueries({ queryKey: ["imagenes", productoId] }); qc.invalidateQueries({ queryKey: ["productos-imagenes"] }); }} />
      {isLoading ? (
        <div className="py-8 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: brand.brandColor }} /></div>
      ) : imagenes.length === 0 ? (
        <div className="py-8 text-center"><ImageIcon size={22} className="mx-auto mb-2 text-gray-200" /><p className="text-sm text-gray-400">Sin imagenes — sube la primera arriba</p></div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {imagenes.map(img => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 aspect-square">
              <Image src={img.urlImagen} alt={img.altText ?? ""} fill className="object-cover" unoptimized />
              {img.esPrincipal && (
                <div className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 text-white" style={{ backgroundColor: brand.brandColor }}>
                  <Star size={8} /> Principal
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.esPrincipal && (
                  <button onClick={() => handlePrincipal(img.id)} className="p-1.5 rounded-lg bg-white/90 text-gray-700 hover:bg-white" title="Principal"><Star size={13} /></button>
                )}
                <button onClick={() => handleDelete(img.id)} className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600" title="Eliminar"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FILTROS: { key: FiltroImg; label: string; color: string }[] = [
  { key: "todos",         label: "Todos",          color: "#6b7280" },
  { key: "con_imagenes",  label: "Con imagenes",   color: "#16a34a" },
  { key: "sin_imagenes",  label: "Sin imagenes",   color: "#dc2626" },
];

function ImagenesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroImg>("todos");
  const [vista, setVista] = useState<Vista>("grid");
  const [abierto, setAbierto] = useState<string | null>(null);
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
      <Topbar title="Modulo de imagenes" actions={
        <button onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Actualizar
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg">
        <div className="grid grid-cols-4 gap-4 p-5 pb-0">
          {[
            { label: "Productos", val: productos.length, color: brand.brandColor },
            { label: "Con imagenes", val: conImg, color: "#16a34a" },
            { label: "Sin imagenes", val: sinImg, color: "#dc2626" },
            { label: "Total FTP", val: totalImg, color: "#7c3aed" },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
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
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 ml-auto">
            <button onClick={() => setVista("grid")} className="p-2 transition-all" style={vista === "grid" ? { backgroundColor: brand.brandColor, color: "white" } : { color: "#9ca3af" }}><Grid3X3 size={14} /></button>
            <button onClick={() => setVista("list")} className="p-2 transition-all" style={vista === "list" ? { backgroundColor: brand.brandColor, color: "white" } : { color: "#9ca3af" }}><List size={14} /></button>
          </div>
        </div>
        <div className="px-5 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin mr-2" style={{ color: brand.brandColor }} /><span className="text-sm text-gray-400">Cargando...</span></div>
          ) : productos.length === 0 ? (
            <div className="card p-12 text-center"><Package size={28} className="mx-auto mb-3 text-gray-200" /><p className="text-sm text-gray-400">Sin productos</p></div>
          ) : vista === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {productos.map(p => (
                <div key={p.id} onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                  className="card cursor-pointer hover:shadow-md transition-all overflow-hidden"
                  style={abierto === p.id ? { boxShadow: `0 0 0 2px ${brand.brandColor}` } : {}}>
                  <div className="aspect-square bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
                    {p.imagenPrincipal ? (
                      <Image src={p.imagenPrincipal} alt={p.nombre} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon size={24} className="text-gray-200" /></div>
                    )}
                    <div className="absolute bottom-1.5 right-1.5">
                      {p._count.imagenes === 0
                        ? <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">Sin imgs</span>
                        : <span className="bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{p._count.imagenes}</span>}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-gray-400">{p.sku}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card overflow-hidden">
              {productos.map(p => (
                <div key={p.id} onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                  className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors last:border-b-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative flex-shrink-0">
                    {p.imagenPrincipal ? <Image src={p.imagenPrincipal} alt={p.nombre} fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-gray-300" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.sku}</p>
                  </div>
                  {p._count.imagenes === 0
                    ? <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg"><AlertTriangle size={11} />Sin imgs</span>
                    : <span className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg font-medium flex items-center gap-1"><CheckCircle size={11} />{p._count.imagenes} imgs</span>}
                </div>
              ))}
            </div>
          )}
          {abierto && (
            <div className="mt-4 card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{productos.find(p => p.id === abierto)?.nombre}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{productos.find(p => p.id === abierto)?.sku} · FTP Hostinger</p>
                </div>
                <button onClick={() => setAbierto(null)} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400"><X size={14} /></button>
              </div>
              <GaleriaProducto productoId={abierto} onClose={() => setAbierto(null)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
export default function ImagenesPage() { return <Suspense><ImagenesContent /></Suspense>; }
