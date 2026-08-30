"use client";

// ============================================================
// Una instalación, abierta por su propia dirección.
//
// Existía la ficha (como panel dentro del listado) y existía el acta,
// pero NO existía esta página. El calendario enlazaba a
// `/crm/instalaciones/<id>` desde dos sitios y los dos daban 404: la
// carpeta solo tenía `[id]/acta`.
//
// Hace falta como página propia y no solo como panel porque el enlace se
// comparte: al coordinador le llega la dirección de una obra en un aviso
// y tiene que abrirla, no buscarla en un listado.
// ============================================================

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Loader2, Wrench } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { FichaInstalacion, type InstalacionFicha } from "@/components/crm/FichaInstalacion";

function InstalacionContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: inst, isLoading, isError } = useQuery<InstalacionFicha | null>({
    queryKey: ["instalacion", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/instalaciones/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "No se pudo cargar");
      return json.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: "#BA7517" }} />
      </div>
    );
  }

  if (isError || !inst) {
    return (
      <>
        <Topbar title="Instalación" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 page-bg p-8 text-center">
          <Wrench size={28} className="text-gray-300" />
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
            Esta instalación no existe o se borró
          </p>
          <Link href="/crm/instalaciones" className="btn-primary btn-sm">
            Ver todas las instalaciones
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title={`Instalación · ${inst.pedido.numero}`}
        actions={
          <Link href="/crm/instalaciones" className="btn-secondary btn-sm">
            <ArrowLeft size={13} /> <span className="hidden sm:inline">Volver</span>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto page-bg">
        {/* La ficha se cierra volviendo al calendario: aquí no hay panel
            del que salir, es la pantalla entera. */}
        <FichaInstalacion inst={inst} onClose={() => router.push("/crm/instalaciones")} />
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><InstalacionContent /></Suspense>;
}
