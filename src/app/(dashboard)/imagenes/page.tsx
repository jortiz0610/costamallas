"use client";

import { useState, useRef, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Upload, Trash2, Star, Loader2, Image as ImageIcon, X, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";

interface AcfImagen {
  id: string;
  productoId: string;
  urlImagen: string;
  altText: string | null;
  titulo: string | null;
  esPrincipal: boolean;
  posicion: number;
}

interface ProductoBasico {
  id: string;
  sku: string;
  nombre: string;
}

async function fetchProductos(): Promise<ProductoBasico[]> {
  const res = await fetch("/api/productos?limit=200&orderBy=nombre");
  const json = await res.json();
  return json.data ?? [];
}

async function fetchImagenes(productoId: string): Promise<AcfImagen[]> {
  const res = await fetch(`/api/imagenes?productoId=${productoId}`);
  const json = await res.json();
  return json.data ?? [];
}

function ImagenesContent() {
  const [productoId, setProductoId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: productos = [] } = useQuery({ queryKey: ["productos-basico"], queryFn: fetchProductos });
  const { data: imagenes = [], isLoading: loadingImagenes } = useQuery({
    queryKey: ["imagenes", productoId],
    queryFn: () => fetchImagenes(productoId),
    enabled: !!productoId,
  });

  const productoActual = productos.find((p) => p.id === productoId);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !productoId) return toast.error("Selecciona un producto primero");
    setUploading(true);
    let ok = 0;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productoId", productoId);
      formData.append("esPrincipal", String(imagenes.length === 0 && ok === 0));

      try {
        const res = await fetch("/api/imagenes/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok || !json.success) toast.error(`${file.name}: ${json.error}`);
        else ok++;
      } catch {
        toast.error(`Error subiendo ${file.name}`);
      }
    }

    if (ok > 0) {
      toast.success(`${ok} imagen${ok > 1 ? "es" : ""} subida${ok > 1 ? "s" : ""} correctamente`);
      qc.invalidateQueries({ queryKey: ["imagenes", productoId] });
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta imagen?")) return;
    const res = await fetch(`/api/imagenes?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Imagen eliminada");
      qc.invalidateQueries({ queryKey: ["imagenes", productoId] });
    } else {
      toast.error(json.error ?? "Error al eliminar");
    }
  };

  const handleSetPrincipal = async (id: string) => {
    const res = await fetch("/api/imagenes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, esPrincipal: true }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Imagen principal actualizada");
      qc.invalidateQueries({ queryKey: ["imagenes", productoId] });
    }
  };

  return (
    <>
      <Topbar title="Imágenes de productos" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Selector de producto */}
        <div className="card p-5">
          <label className="block text-[12px] font-medium text-gray-700 mb-2">Selecciona un producto</label>
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="input w-full max-w-md"
          >
            <option value="">— Elige un producto —</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.sku} — {p.nombre}</option>
            ))}
          </select>
        </div>

        {productoId && (
          <>
            {/* Zona de upload */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? "border-cm-yellow bg-cm-yellow/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-[13px]">Subiendo imágenes…</span>
                </div>
              ) : (
                <>
                  <Upload size={28} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-[13px] font-medium text-gray-600">Arrastra imágenes aquí o haz clic para seleccionar</p>
                  <p className="text-[11px] text-gray-400 mt-1">JPG, PNG, WebP — máx. 5MB por imagen</p>
                  <p className="text-[11px] text-blue-500 mt-1">Se subirán a catalogo.costamallas.com</p>
                </>
              )}
            </div>

            {/* Galería */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-[13px] font-semibold text-gray-800">
                  Imágenes de {productoActual?.nombre} ({imagenes.length})
                </h2>
              </div>

              {loadingImagenes ? (
                <div className="p-8 text-center text-[12px] text-gray-400">Cargando…</div>
              ) : !imagenes.length ? (
                <div className="p-8 text-center">
                  <ImageIcon size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-500">Este producto no tiene imágenes</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-5">
                  {imagenes.map((img) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                      <Image
                        src={img.urlImagen}
                        alt={img.altText ?? ""}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {img.esPrincipal && (
                        <div className="absolute top-1.5 left-1.5 bg-cm-yellow text-cm-black text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Star size={9} /> Principal
                        </div>
                      )}
                      {/* Acciones al hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {!img.esPrincipal && (
                          <button
                            onClick={() => handleSetPrincipal(img.id)}
                            title="Marcar como principal"
                            className="bg-cm-yellow text-cm-black p-1.5 rounded-lg hover:bg-yellow-400"
                          >
                            <Star size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(img.id)}
                          title="Eliminar"
                          className="bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            {imagenes.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
                <CheckCircle size={12} className="text-green-500" />
                Las imágenes están alojadas en{" "}
                <a href="https://catalogo.costamallas.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                  catalogo.costamallas.com
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function ImagenesPage() {
  return (
    <Suspense>
      <ImagenesContent />
    </Suspense>
  );
}
