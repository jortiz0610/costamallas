"use client";

// La pantalla de cotización nueva. Todo el formulario vive en
// components/crm/Cotizador.tsx, que es el mismo que usa la edición.
//
// `?visita=<id>` la abre CON la visita técnica delante: es el enlace del
// botón «Cotizar esto» y el del correo que recibe el asesor cuando
// producción cierra la visita en el sitio.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Cotizador } from "@/components/crm/Cotizador";

function Contenido() {
  const params = useSearchParams();
  return <Cotizador visitaId={params.get("visita") ?? undefined} />;
}

export default function Page() {
  return (
    <Suspense>
      <Contenido />
    </Suspense>
  );
}
