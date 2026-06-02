"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Save, Trash2, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

async function fetchProducto(id: string) {
  const res = await fetch(`/api/productos/${id}`);
  if (!res.ok) throw new Error("Producto no encontrado");
  return (await res.json()).data;
}

const ESTADOS = ["BORRADOR","REVISION","LISTO","PUBLICADO","ARCHIVADO"];

function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);

  const { data: producto, isLoading, error } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => fetchProducto(id),
  });

  // Inicializar form cuando llegan los datos
  if (producto && !form) setForm(producto);

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-[13px]"><Loader2 size={18} className="animate-spin mr-2" />Cargando producto…</div>;
  if (error || !producto) return <div className="flex-1 flex items-center justify-center text-red-400 text-[13px]">Producto no encontrado</div>;

  const data = form ?? producto;

  const set = (key: string, val: unknown) => setForm((prev) => ({ ...(prev ?? producto), [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al guardar");
      toast.success("Producto guardado");
      qc.invalidateQueries({ queryKey: ["productos"] });
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Archivar el producto "${producto.nombre}"?`)) return;
    const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) { toast.success("Producto archivado"); router.push("/productos"); }
    else toast.error(json.error ?? "Error");
  };

  return (
    <>
      <Topbar
        title={producto.nombre}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/productos" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
            {producto.wcId && <a href={`${process.env.NEXT_PUBLIC_APP_URL?.replace("portal","")}/producto/${producto.slug}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><ExternalLink size={13} /> Ver en tienda</a>}
            <button onClick={handleDelete} className="btn-secondary btn-sm text-red-500"><Trash2 size={13} /></button>
            <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Col principal */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Información básica</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">SKU *</label><input className="input" value={String(data.sku ?? "")} onChange={(e) => set("sku", e.target.value)} /></div>
                <div><label className="label">SKU Interno</label><input className="input" value={String(data.acfSkuInterno ?? "")} onChange={(e) => set("acfSkuInterno", e.target.value)} /></div>
              </div>
              <div><label className="label">Nombre *</label><input className="input" value={String(data.nombre ?? "")} onChange={(e) => set("nombre", e.target.value)} /></div>
              <div><label className="label">Descripción corta</label><textarea className="input" rows={2} value={String(data.descCorta ?? "")} onChange={(e) => set("descCorta", e.target.value)} /></div>
              <div><label className="label">Descripción larga</label><textarea className="input" rows={4} value={String(data.descripcion ?? "")} onChange={(e) => set("descripcion", e.target.value)} /></div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Precios</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Precio normal</label><input type="number" className="input" value={String(data.precioNormal ?? "")} onChange={(e) => set("precioNormal", e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="label">Precio oferta</label><input type="number" className="input" value={String(data.precioOferta ?? "")} onChange={(e) => set("precioOferta", e.target.value ? parseFloat(e.target.value) : null)} /></div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Stock</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label">Stock actual</label><input type="number" className="input" value={String(data.stock ?? 0)} onChange={(e) => set("stock", parseInt(e.target.value) || 0)} /></div>
                <div><label className="label">Stock mínimo</label><input type="number" className="input" value={String(data.stockMinimo ?? 15)} onChange={(e) => set("stockMinimo", parseInt(e.target.value) || 0)} /></div>
                <div><label className="label">Backorders</label>
                  <select className="input" value={String(data.permiteBackorders ?? "no")} onChange={(e) => set("permiteBackorders", e.target.value)}>
                    <option value="no">No</option><option value="notify">Notificar</option><option value="yes">Sí</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Dimensiones y peso</h3>
              <div className="grid grid-cols-4 gap-4">
                <div><label className="label">Peso (kg)</label><input type="number" step="0.001" className="input" value={String(data.pesoKg ?? "")} onChange={(e) => set("pesoKg", e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="label">Largo (cm)</label><input type="number" step="0.01" className="input" value={String(data.largoCm ?? "")} onChange={(e) => set("largoCm", e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="label">Ancho (cm)</label><input type="number" step="0.01" className="input" value={String(data.anchoCm ?? "")} onChange={(e) => set("anchoCm", e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="label">Alto (cm)</label><input type="number" step="0.01" className="input" value={String(data.altoCm ?? "")} onChange={(e) => set("altoCm", e.target.value ? parseFloat(e.target.value) : null)} /></div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Campos ACF</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Marca / Fabricante</label><input className="input" value={String(data.acfMarcaFabricante ?? "")} onChange={(e) => set("acfMarcaFabricante", e.target.value)} /></div>
                <div><label className="label">Unidad de venta</label><input className="input" value={String(data.acfUnidadVenta ?? "")} onChange={(e) => set("acfUnidadVenta", e.target.value)} /></div>
                <div><label className="label">Garantía (años)</label><input type="number" className="input" value={String(data.acfGarantiaAnos ?? "")} onChange={(e) => set("acfGarantiaAnos", e.target.value ? parseInt(e.target.value) : null)} /></div>
                <div><label className="label">Ficha técnica (URL PDF)</label><input className="input" value={String(data.acfFichaTecnicaPdf ?? "")} onChange={(e) => set("acfFichaTecnicaPdf", e.target.value || null)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={Boolean(data.acfFabricacionMedida)} onChange={(e) => set("acfFabricacionMedida", e.target.checked)} />
                  Fabricación a medida
                </label>
                <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={Boolean(data.acfInstalacion)} onChange={(e) => set("acfInstalacion", e.target.checked)} />
                  Incluye instalación
                </label>
              </div>
            </div>
          </div>

          {/* Col lateral */}
          <div className="space-y-5">
            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Estado</h3>
              <select className="input" value={String(data.intEstado ?? "BORRADOR")} onChange={(e) => set("intEstado", e.target.value)}>
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={Boolean(data.publicado)} onChange={(e) => set("publicado", e.target.checked)} />
                Publicado en tienda
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={Boolean(data.destacado)} onChange={(e) => set("destacado", e.target.checked)} />
                Destacado
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={Boolean(data.intListoExportar)} onChange={(e) => set("intListoExportar", e.target.checked)} />
                Listo para exportar
              </label>
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Categorías</h3>
              <input className="input text-[12px]" placeholder="ej: mallas-metalicas, nylon (separadas por coma)" value={Array.isArray(data.categorias) ? (data.categorias as string[]).join(", ") : ""} onChange={(e) => set("categorias", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Etiquetas</h3>
              <input className="input text-[12px]" placeholder="ej: exterior, resistente (separadas por coma)" value={Array.isArray(data.etiquetas) ? (data.etiquetas as string[]).join(", ") : ""} onChange={(e) => set("etiquetas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Observaciones internas</h3>
              <textarea className="input text-[12px]" rows={3} value={String(data.intObservaciones ?? "")} onChange={(e) => set("intObservaciones", e.target.value)} placeholder="Notas internas del equipo…" />
            </div>

            {producto.wcId && (
              <div className="card p-4 bg-green-50 border-green-200">
                <p className="text-[11px] font-medium text-green-700">WooCommerce ID: #{producto.wcId}</p>
                <p className="text-[10px] text-green-600 mt-0.5">Sincronizado con la tienda</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><ProductoDetallePage /></Suspense>;
}
