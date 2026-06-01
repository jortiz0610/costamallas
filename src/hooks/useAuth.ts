"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
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

  return {
    user: query.data ?? user,
    isLoading: query.isLoading,
    isAdmin: user?.rol === "ADMIN",
    canWrite: user?.rol === "ADMIN" || user?.rol === "USUARIO",
    logout,
  };
}
