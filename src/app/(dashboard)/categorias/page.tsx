"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Tag, Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
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
  { key: "CATEGORIA", label: "Categorías" },
  { key: "MARCA", label: "Marcas" },
  { key: "COLOR", label: "Colores" },
  { key: "NORMA", label: "Normas" },
  { key: "APLICACION", label: "Aplicaciones" },
  { key: "UNIDAD_VENTA", label: "Unidades de venta" },
  { key: "CLASE_ENVIO", label: "Clases de envío" },
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
        body: JSON.stringify({ tipo, valor: newValor.trim().toLowerCase().replace(/\s+/g, "-"), label: newLabel.trim() }),
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

  return (
    <>
      <Topbar title="Catálogos" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button key={t.key} onClick={() => setTipo(t.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${tipo === t.key ? "bg-cm-yellow text-cm-black" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Agregar nuevo */}
        <div className="card p-4">
          <h3 className="text-[12px] font-semibold text-gray-700 mb-3 flex items-center gap-2"><Plus size={13} /> Agregar nuevo</h3>
          <div className="flex gap-3">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nombre visible (ej: Malla Sombra)" className="input flex-1" />
            <input value={newValor} onChange={(e) => setNewValor(e.target.value)} placeholder="Slug (ej: malla-sombra)" className="input flex-1" />
            <button onClick={handleAdd} disabled={adding} className="btn-primary">
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Agregar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-[13px] font-semibold text-gray-800">
              {TIPOS.find((t) => t.key === tipo)?.label} ({items.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-[12px] text-gray-400">Cargando…</div>
            ) : !items.length ? (
              <div className="p-8 text-center">
                <Tag size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-500">No hay items en este catálogo</p>
              </div>
            ) : items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                <span className="sku-tag text-[10px]">{item.valor}</span>
                {editId === item.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="input flex-1 py-1 text-[12px]" autoFocus />
                    <button onClick={() => handleEdit(item.id)} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                ) : (
                  <span className="flex-1 text-[13px] text-gray-700">{item.label}</span>
                )}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => { setEditId(item.id); setEditLabel(item.label); }} className="text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CategoriasPage() {
  return <Suspense><CategoriasContent /></Suspense>;
}
