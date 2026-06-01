"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import type { SeveridadError } from "@/types";

const sevBadge: Record<SeveridadError, string> = {
  CRITICO: "badge-red", ALTO: "badge-orange", MEDIO: "badge-yellow",
  BAJO: "badge-blue", INFO: "badge-gray",
};

async function fetchErrores() {
  const res = await fetch("/api/productos?limit=100"); // placeholder — idealmente /api/errores
  return (await res.json());
}

export default function ErroresPage() {
  return (
    <>
      <Topbar title="Errores de validación" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card p-8 text-center">
          <p className="text-[13px] text-gray-500">
            Los errores de validación se generan al exportar productos con datos incompletos.
            Corrige los productos marcados en la tabla de Productos y vuelve a validar.
          </p>
        </div>
      </div>
    </>
  );
}
