"use client";

// Editar una cotización. Usa el MISMO formulario que la creación
// (components/crm/Cotizador.tsx): tener una pantalla de crear y otra de
// editar significa que dentro de un mes una tiene el AIU y la otra no.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Cotizador } from "@/components/crm/Cotizador";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <Cotizador cotizacionId={id} />
    </Suspense>
  );
}
