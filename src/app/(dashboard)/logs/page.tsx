"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ScrollText } from "lucide-react";
import { formatDate } from "@/lib/utils";

async function fetchLogs(page: number) {
  const res = await fetch(`/api/logs?page=${page}&limit=50`);
  if (!res.ok) throw new Error("Error");
  return res.json();
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["logs", page], queryFn: () => fetchLogs(page) });

  return (
    <>
      <Topbar title="Logs de auditoría" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th><th>Acción</th><th>Usuario</th><th>Resultado</th><th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando…</td></tr>
              ) : !data?.data.length ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Sin registros</td></tr>
              ) : (
                data.data.map((l: { id: string; createdAt: string; accion: string; usuario: { nombre: string } | null; resultado: string | null; detalle: string | null }) => (
                  <tr key={l.id}>
                    <td className="text-[11px] text-gray-500 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                    <td><span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded">{l.accion}</span></td>
                    <td className="text-[12px]">{l.usuario?.nombre ?? "Sistema"}</td>
                    <td>
                      {l.resultado === "OK"
                        ? <span className="badge-green badge">{l.resultado}</span>
                        : <span className="badge-yellow badge">{l.resultado ?? "—"}</span>
                      }
                    </td>
                    <td className="text-[11px] text-gray-500 max-w-xs truncate">{l.detalle ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data?.totalPages > 1 && (
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">← Anterior</button>
            <span className="text-[12px] text-gray-500 self-center">Página {page} de {data.totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary btn-sm">Siguiente →</button>
          </div>
        )}
      </div>
    </>
  );
}
