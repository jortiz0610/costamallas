"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

const defaultForm = {
  sku: "", nombre: "", descCorta: "", descripcion: "",
  precioNormal: "", precioOferta: "",
  stock: "0", stockMinimo: "15",
  categorias: "", etiquetas: "",
  acfMarcaFabricante: "", acfUnidadVenta: "",
  acfFabricacionMedida: false, acfInstalacion: false,
  intEstado: "BORRADOR", publicado: false, destacado: false,
};

function NuevoProductoContent() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.sku.trim()) return toast.error("SKU es requerido");
    if (!form.nombre.trim()) return toast.error("Nombre es requerido");
    setSaving(true);
    try {
      const payload = {
        ...form,
        precioNormal: form.precioNormal ? parseFloat(form.precioNormal) : null,
        precioOferta: form.precioOferta ? parseFloat(form.precioOferta) : null,
        stock: parseInt(form.stock) || 0,
        stockMinimo: parseInt(form.stockMinimo) || 15,
        categorias: form.categorias.split(",").map((s) => s.trim()).filter(Boolean),
        etiquetas: form.etiquetas.split(",").map((s) => s.trim()).filter(Boolean),
      };

      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al crear");
      toast.success("Producto creado");
      router.push(`/productos/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Topbar
        title="Nuevo producto"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/productos" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
            <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Crear producto
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Información básica</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">SKU *</label><input className="input" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="ej: MN-001" /></div>
                <div><label className="label">Marca / Fabricante</label><input className="input" value={form.acfMarcaFabricante} onChange={(e) => set("acfMarcaFabricante", e.target.value)} /></div>
              </div>
              <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre del producto" /></div>
              <div><label className="label">Descripción corta</label><textarea className="input" rows={2} value={form.descCorta} onChange={(e) => set("descCorta", e.target.value)} /></div>
              <div><label className="label">Descripción larga</label><textarea className="input" rows={4} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Precios y stock</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Precio normal</label><input type="number" className="input" value={form.precioNormal} onChange={(e) => set("precioNormal", e.target.value)} /></div>
                <div><label className="label">Precio oferta</label><input type="number" className="input" value={form.precioOferta} onChange={(e) => set("precioOferta", e.target.value)} /></div>
                <div><label className="label">Stock inicial</label><input type="number" className="input" value={form.stock} onChange={(e) => set("stock", e.target.value)} /></div>
                <div><label className="label">Stock mínimo</label><input type="number" className="input" value={form.stockMinimo} onChange={(e) => set("stockMinimo", e.target.value)} /></div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Categorías y etiquetas</h3>
              <div><label className="label">Categorías (separadas por coma)</label><input className="input" value={form.categorias} onChange={(e) => set("categorias", e.target.value)} placeholder="mallas-metalicas, nylon" /></div>
              <div><label className="label">Etiquetas (separadas por coma)</label><input className="input" value={form.etiquetas} onChange={(e) => set("etiquetas", e.target.value)} placeholder="exterior, resistente" /></div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="card p-5 space-y-4">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Estado</h3>
              <select className="input" value={form.intEstado} onChange={(e) => set("intEstado", e.target.value)}>
                <option value="BORRADOR">Borrador</option>
                <option value="REVISION">En revisión</option>
                <option value="LISTO">Listo</option>
              </select>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={form.publicado} onChange={(e) => set("publicado", e.target.checked)} />
                Publicado en tienda
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={form.acfFabricacionMedida} onChange={(e) => set("acfFabricacionMedida", e.target.checked)} />
                Fabricación a medida
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cm-yellow" checked={form.acfInstalacion} onChange={(e) => set("acfInstalacion", e.target.checked)} />
                Incluye instalación
              </label>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><NuevoProductoContent /></Suspense>;
}
