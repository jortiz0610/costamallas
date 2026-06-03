"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Tag, Plus, Trash2, Loader2, Pencil, Check, X, Package, Palette, Ruler, FileText, Truck, Zap, BookOpen } from "lucide-react";
import toast from "react-hot-toast";

interface Catalogo {
  id: string;
  tipo: string;
  valor: string;
  label: string;
  orden: number;
  activo: boolean;
}

const TIPOS = [
  { key: "CATEGORIA",    label: "Categorías",        icon: Tag,      color: "#185FA5", desc: "Agrupación de productos" },
  { key: "MARCA",        label: "Marcas",             icon: Package,  color: "#7c3aed", desc: "Fabricantes y marcas" },
  { key: "COLOR",        label: "Colores",            icon: Palette,  color: "#e11d48", desc: "Colores disponibles" },
  { key: "NORMA",        label: "Normas",             icon: FileText, color: "#0891b2", desc: "Normas de calidad" },
  { key: "APLICACION",   label: "Aplicaciones",       icon: Zap,      color: "#d97706", desc: "Usos del producto" },
  { key: "UNIDAD_VENTA", label: "Unidades de venta",  icon: Ruler,    color: "#059669", desc: "m², m, und, rollo..." },
  { key: "CLASE_ENVIO",  label: "Clases de envío",    icon: Truck,    color: "#6b7280", desc: "Clasificación logística" },
];

async function fetchCatalogos(tipo: string): Promise<Catalogo[]> {
  const res = await fetch(`/api/catalogos?tipo=${tipo}`);
  const json = await res.json();
  return json.data ?? [];
}

function CategoriasContent() {
  const [tipo, setTipo] = useState("CATEGORIA");
  const [newValor, setNewValor] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const qc = useQueryClient();

  const tipoMeta = TIPOS.find((t) => t.key === tipo)!;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalogos", tipo],
    queryFn: () => fetchCatalogos(tipo),
  });

  const handleAdd = async () => {
    if (!newValor.trim() || !newLabel.trim()) return toast.error("Completa los campos");
    setAdding(true);
    try {
      const res = await fetch("/api/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          valor: newValor.trim().toLowerCase().replace(/\s+/g, "-"),
          label: newLabel.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al agregar");
      toast.success("Agregado correctamente");
      setNewValor(""); setNewLabel("");
      qc.invalidateQueries({ queryKey: ["catalogos", tipo] });
    } catch { toast.error("Error de conexión"); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este item?")) return;
    const res = await fetch(`/api/catalogos?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["catalogos", tipo] }); }
    else toast.error(json.error ?? "Error");
  };

  const handleEdit = async (id: string) => {
    const res = await fetch("/api/catalogos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, label: editLabel }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Actualizado"); setEditId(null); qc.invalidateQueries({ queryKey: ["catalogos", tipo] }); }
    else toast.error(json.error ?? "Error");
  };

  const TipoIcon = tipoMeta.icon;

  return (
    <>
      <Topbar title="Catálogos" />
      <div className="flex-1 overflow-y-auto page-bg">
        {/* Selector de tipo */}
        <div className="p-5 pb-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Selecciona un catálogo</p>
          <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              const activo = tipo === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTipo(t.key)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-center"
                  style={
                    activo
                      ? { backgroundColor: t.color + "15", borderColor: t.color, color: t.color }
                      : { backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
                  }
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={activo ? { backgroundColor: t.color, color: "white" } : { backgroundColor: "#f1f5f9" }}
                  >
                    <Icon size={16} />
                  </div>
                  <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido del catálogo seleccionado */}
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: tipoMeta.color + "10", border: `1px solid ${tipoMeta.color}30` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: tipoMeta.color }}>
              <TipoIcon size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{tipoMeta.label}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{tipoMeta.desc} · {items.length} items</p>
            </div>
          </div>

          {/* Agregar nuevo */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Plus size={12} style={{ color: tipoMeta.color }} /> Agregar nuevo item
            </h3>
            <div className="flex gap-3">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Nombre visible (ej: Malla Sombra)"
                className="input flex-1"
              />
              <input
                value={newValor}
                onChange={(e) => setNewValor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Slug (ej: malla-sombra)"
                className="input flex-1"
              />
              <button
                onClick={handleAdd}
                disabled={adding}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all disabled:opacity-50 flex-shrink-0"
                style={{ backgroundColor: tipoMeta.color }}
              >
                {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Agregar
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center">
                <Loader2 size={18} className="animate-spin mx-auto mb-2" style={{ color: tipoMeta.color }} />
                <p className="text-xs text-gray-400">Cargando...</p>
              </div>
            ) : !items.length ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: tipoMeta.color + "15" }}>
                  <TipoIcon size={22} style={{ color: tipoMeta.color }} />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sin items en {tipoMeta.label}</p>
                <p className="text-xs text-gray-400 mt-1">Agrega el primero arriba</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group"
                  style={{ borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none" }}
                >
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: tipoMeta.color + "15", color: tipoMeta.color }}
                  >
                    {item.valor}
                  </span>
                  {editId === item.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEdit(item.id); if (e.key === "Escape") setEditId(null); }}
                        className="input flex-1 py-1 text-sm"
                        autoFocus
                      />
                      <button onClick={() => handleEdit(item.id)} className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditId(item.id); setEditLabel(item.label); }}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CategoriasPage() {
  return <Suspense><CategoriasContent /></Suspense>;
}
