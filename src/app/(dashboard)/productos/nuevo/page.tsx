"use client";

import { Suspense } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import ProductoFormDinamico from "@/components/productos/ProductoFormDinamico";

function NuevoProductoContent() {
  return (
    <>
      <Topbar
        title="Nuevo producto"
        actions={<Link href="/productos" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>}
      />
      <ProductoFormDinamico modo="crear" />
    </>
  );
}

export default function Page() {
  return <Suspense><NuevoProductoContent /></Suspense>;
}
