"use client";

// ============================================================
// El portón de las pantallas del portal.
//
// Va en el layout y no en cada página, por el mismo motivo por el que el
// bloqueo del modo prueba vive en el middleware: una comprobación por
// página falla el día que alguien agregue una y se le olvide. Aquí, una
// ruta nueva solo tiene que aparecer en `RUTAS_PROTEGIDAS`.
//
// ⚠️ Esto es una cortesía, no una defensa: corre en el navegador y solo
// evita que alguien vea una pantalla que no le sirve. Los DATOS los
// protege cada route handler con `exigirPermiso()`, que es lo único que
// un `fetch` desde la consola no puede saltarse.
// ============================================================

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { permisoDeRuta, PERMISOS_POR_CLAVE } from "@/lib/permisos";

export function GuardiaRuta({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, permisos } = useAuth();

  const clave = permisoDeRuta(pathname);

  // Sin sesión resuelta todavía no se decide nada: negar aquí pintaría un
  // "no tienes acceso" durante medio segundo en cada carga.
  if (!clave || isLoading || !user) return <>{children}</>;
  if (permisos.has(clave)) return <>{children}</>;

  const meta = PERMISOS_POR_CLAVE[clave];

  return (
    <div className="flex-1 flex items-center justify-center p-8 page-bg">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
          <Lock size={20} className="text-gray-400" />
        </div>
        <h1 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
          Esta pantalla no está en tu perfil
        </h1>
        <p className="text-[12.5px] text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
          {meta
            ? <>Para entrar hace falta el permiso <strong>{meta.label}</strong>. {meta.ayuda}</>
            : <>No tienes el permiso que esta pantalla necesita.</>}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-3">
          Si lo necesitas para tu trabajo, pídeselo a un administrador: se activa
          en Usuarios y Roles, sin tocar tu rol.
        </p>
        <Link href="/" className="btn-primary btn-sm mt-5 inline-flex">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

/** El mismo portón, para envolver un trozo suelto de una pantalla. */
export function SiPuede({
  clave,
  children,
  fallback = null,
}: {
  clave: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { permisos, isLoading } = useAuth();
  if (isLoading) return <Loader2 size={14} className="animate-spin text-gray-300" />;
  return <>{permisos.has(clave) ? children : fallback}</>;
}
