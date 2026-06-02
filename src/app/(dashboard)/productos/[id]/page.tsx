"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Trash2, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import ProductoFormDinamico from "@/components/productos/ProductoFormDinamico";

async function fetchProducto(id: string) {
  const res = await fetch(`/api/productos/${id}`);
  if (!res.ok) throw new Error("Producto no encontrado");
  return (await res.json()).data;
}

function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: producto, isLoading, error } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => fetchProducto(id),
  });

  const handleDelete = async () => {
    if (!confirm(`¿Archivar este producto?`)) return;
    const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Producto archivado");
      qc.invalidateQueries({ queryKey: ["productos"] });
      router.push("/productos");
    } else {
      toast.error(json.error ?? "Error");
    }
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-[13px]">
      <Loader2 size={18} className="animate-spin mr-2" />Cargando producto…
    </div>
  );

  if (error || !producto) return (
    <div className="flex-1 flex items-center justify-center text-red-400 text-[13px]">
      Producto no encontrado
    </div>
  );

  return (
    <>
      <Topbar
        title={producto.nombre}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/productos" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
            {producto.wcId && (
              <a href={`https://costamallas.com/?p=${producto.wcId}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                <ExternalLink size={13} /> Ver en tienda
              </a>
            )}
            <button onClick={handleDelete} className="btn-secondary btn-sm text-red-500"><Trash2 size={13} /></button>
          </div>
        }
      />
      <ProductoFormDinamico modo="editar" productoId={id} initialData={producto} />
    </>
  );
}

export default function Page() {
  return <Suspense><ProductoDetallePage /></Suspense>;
}
