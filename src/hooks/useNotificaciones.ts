"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificacionDTO } from "@/types";

interface NotificacionesResponse {
  data: NotificacionDTO[];
  noLeidas: number;
}

async function fetchNotificaciones(): Promise<NotificacionesResponse> {
  const res = await fetch("/api/notificaciones");
  if (!res.ok) throw new Error("Error al cargar notificaciones");
  const json = await res.json();
  return { data: json.data, noLeidas: json.noLeidas };
}

export function useNotificaciones() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notificaciones"],
    queryFn: fetchNotificaciones,
    refetchInterval: 30_000, // Refrescar cada 30s
  });

  const marcarLeidas = useMutation({
    mutationFn: async (ids?: string[]) => {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { marcarTodas: true }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
  });

  return {
    notificaciones: query.data?.data ?? [],
    noLeidas: query.data?.noLeidas ?? 0,
    isLoading: query.isLoading,
    marcarLeidas: marcarLeidas.mutate,
    marcarTodasLeidas: () => marcarLeidas.mutate(undefined),
  };
}
