"use client";

// La pantalla de cotización nueva. Todo el formulario vive en
// components/crm/Cotizador.tsx, que es el mismo que usa la edición.

import { Suspense } from "react";
import { Cotizador } from "@/components/crm/Cotizador";

export default function Page() {
  return (
    <Suspense>
      <Cotizador />
    </Suspense>
  );
}
