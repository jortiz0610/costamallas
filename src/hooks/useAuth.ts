"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { esAdmin, permisosEfectivos } from "@/lib/permisos";
import type { UsuarioDTO } from "@/types";

async function fetchMe(): Promise<UsuarioDTO> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new Error("No autenticado");
  const json = await res.json();
  return json.data;
}

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  const router = useRouter();

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    } else if (query.isError) {
      setUser(null);
    }
  }, [query.data, query.isError, setUser]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  const actual = query.data ?? user;

  // Los permisos vienen calculados del servidor. Si todavía no llegaron
  // (primer render, o una respuesta vieja en caché de una versión
  // anterior del portal) se cae al juego por defecto del rol: es lo
  // mismo que se veía antes de que existieran las excepciones, así que
  // el menú no parpadea vacío.
  const permisos = useMemo(
    () => new Set(actual?.permisos ?? [...permisosEfectivos(actual?.rol)]),
    [actual?.permisos, actual?.rol],
  );

  return {
    user: actual,
    isLoading: query.isLoading,
    // Los dos estaban mal y por eso nadie los usaba: `isAdmin` dejaba
    // fuera al SUPERADMIN y `canWrite` solo daba permiso a ADMIN y
    // USUARIO, cuando en el servidor escribe todo el mundo menos
    // SOLO_LECTURA. Un vendedor no habría podido ni crear un cliente.
    // Ahora dicen lo mismo que el servidor.
    isAdmin: esAdmin(actual?.rol),
    canWrite: Boolean(actual?.rol) && actual?.rol !== "SOLO_LECTURA",
    permisos,
    /**
     * ⚠️ Esto sirve para NO PINTAR algo, nunca para protegerlo: corre en
     * el navegador. El permiso de verdad lo impone la route handler con
     * `exigirPermiso()`.
     */
    puedeVer: (clave: string) => permisos.has(clave),
    logout,
  };
}
